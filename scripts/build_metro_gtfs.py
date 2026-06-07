"""
Build metro_gtfs.json from the PTV GTFS zip.

Produces a compact data file mapping each Metro station to its outbound
departure times toward Southern Cross, grouped by day type (weekday / saturday / sunday).

Output: app/public/data/metro_gtfs.json
"""

import csv, io, json, zipfile, urllib.request, sys, collections
from pathlib import Path

GTFS_URL = "https://data.ptv.vic.gov.au/downloads/gtfs.zip"
METRO_FOLDER = "2"          # folder 2 = Metro trains
SSX_PARENT = "vic:rail:SSS" # Southern Cross parent station
MIN_DEPARTURE_MINS = 4 * 60  # 04:00
MAX_DEPARTURE_MINS = 25 * 60 # 01:00 next day (for late services)

# Metro line colours → line name (route_short_name → display name)
LINE_NAMES = {
    "Alamein": "Alamein", "Belgrave": "Belgrave", "Craigieburn": "Craigieburn",
    "Cranbourne": "Cranbourne", "Frankston": "Frankston", "Glen Waverley": "Glen Waverley",
    "Hurstbridge": "Hurstbridge", "Lilydale": "Lilydale", "Mernda": "Mernda",
    "Pakenham": "Pakenham", "Sandringham": "Sandringham", "Sunbury": "Sunbury",
    "Upfield": "Upfield", "Werribee": "Werribee", "Williamstown": "Williamstown",
    "Flemington Racecourse": "Flemington Racecourse",
}

def time_to_mins(t: str) -> int:
    h, m = int(t[:2]), int(t[3:5])
    return h * 60 + m

def mins_to_hhmm(mins: int) -> str:
    h = (mins // 60) % 24
    m = mins % 60
    return f"{h:02d}:{m:02d}"

def download_ptv_gtfs(path="/tmp/ptv_gtfs.zip"):
    if Path(path).exists():
        print(f"Using cached {path}")
        return path
    print(f"Downloading PTV GTFS from {GTFS_URL} ...")
    urllib.request.urlretrieve(GTFS_URL, path)
    print("Downloaded.")
    return path

def read_csv_from_zip(inner_zip, filename):
    raw = inner_zip.read(filename).decode("utf-8-sig")
    return list(csv.DictReader(raw.splitlines()))

def classify_service(row):
    """Return 'weekday', 'saturday', 'sunday', or None."""
    days = [int(row.get(d, 0)) for d in ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]]
    mon_fri = any(days[:5])
    sat = bool(days[5])
    sun = bool(days[6])
    if sat and not sun and not mon_fri: return "saturday"
    if sun and not sat and not mon_fri: return "sunday"
    if mon_fri: return "weekday"
    return None

def build_metro_gtfs(zip_path):
    print("Processing Metro GTFS...")
    with zipfile.ZipFile(zip_path) as outer:
        inner_bytes = outer.read(f"{METRO_FOLDER}/google_transit.zip")
    with zipfile.ZipFile(io.BytesIO(inner_bytes)) as metro:
        # --- Stops ---
        print("  Loading stops...")
        stops_raw = read_csv_from_zip(metro, "stops.txt")
        stop_info = {}     # stop_id → {parent, name, lat, lng}
        parent_to_stop = collections.defaultdict(list)  # parent → [stop_id]
        ssx_stop_ids = set()
        for s in stops_raw:
            sid = s["stop_id"]
            parent = s.get("parent_station", "") or sid
            stop_info[sid] = {
                "parent": parent,
                "name": s["stop_name"],
                "lat": float(s["stop_lat"]),
                "lng": float(s["stop_lon"]),
            }
            parent_to_stop[parent].append(sid)
            if parent == SSX_PARENT:
                ssx_stop_ids.add(sid)
        print(f"    {len(stop_info)} stops, {len(ssx_stop_ids)} Southern Cross platform stops")

        # --- Routes (exclude replacement buses) ---
        print("  Loading routes...")
        routes_raw = read_csv_from_zip(metro, "routes.txt")
        valid_route_ids = {
            r["route_id"]: r["route_short_name"]
            for r in routes_raw
            if "-R:" not in r["route_id"] and "Replacement" not in r.get("route_long_name","")
        }
        print(f"    {len(valid_route_ids)} valid routes")

        # --- Calendar ---
        print("  Loading calendar...")
        cal_raw = read_csv_from_zip(metro, "calendar.txt")
        service_day_type = {}  # service_id → 'weekday'|'saturday'|'sunday'
        for row in cal_raw:
            dt = classify_service(row)
            if dt:
                service_day_type[row["service_id"]] = dt

        # --- Trips ---
        print("  Loading trips...")
        trips_raw = read_csv_from_zip(metro, "trips.txt")
        trip_info = {}  # trip_id → {route_short_name, service_id, direction_id}
        for t in trips_raw:
            if t["route_id"] not in valid_route_ids:
                continue
            svc = t["service_id"]
            day_type = service_day_type.get(svc)
            if not day_type:
                continue
            trip_info[t["trip_id"]] = {
                "line": valid_route_ids[t["route_id"]],
                "day_type": day_type,
                "direction": int(t.get("direction_id", 0)),
            }
        print(f"    {len(trip_info)} valid trips")

        # --- Stop times (stream) ---
        print("  Processing stop times (this may take a moment)...")
        # Group stop_times by trip_id (streaming)
        trip_stops = collections.defaultdict(list)  # trip_id → [(seq, stop_id, dep, arr)]
        raw = metro.read("stop_times.txt").decode("utf-8-sig")
        reader = csv.DictReader(raw.splitlines())
        for row in reader:
            tid = row["trip_id"]
            if tid not in trip_info:
                continue
            dep_str = row.get("departure_time","")
            arr_str = row.get("arrival_time","")
            if not dep_str or not arr_str:
                continue
            trip_stops[tid].append((
                int(row["stop_sequence"]),
                row["stop_id"],
                dep_str,
                arr_str,
            ))
        print(f"    Loaded stop times for {len(trip_stops)} trips")

    # --- Build toSSX and fromSSX ---
    print("  Building departure tables...")
    # parent_station → day_type → [(dep_mins, arr_at_ssx_mins)]
    toSSX = collections.defaultdict(lambda: {"weekday": [], "saturday": [], "sunday": []})
    # parent_station → day_type → [(ssx_dep_mins, arr_at_station_mins)]
    fromSSX = collections.defaultdict(lambda: {"weekday": [], "saturday": [], "sunday": []})
    # parent_station → line names seen
    parent_lines = collections.defaultdict(set)
    # parent_station → canonical info (name, lat, lng)
    parent_canonical = {}

    for trip_id, stops in trip_stops.items():
        info = trip_info[trip_id]
        stops_sorted = sorted(stops, key=lambda x: x[0])

        # Find SSX in this trip
        ssx_entry = None
        for seq, sid, dep, arr in stops_sorted:
            if sid in ssx_stop_ids:
                ssx_entry = (seq, time_to_mins(arr), time_to_mins(dep))
                break
        if not ssx_entry:
            continue  # trip doesn't visit SSX

        ssx_seq, ssx_arr_mins, ssx_dep_mins = ssx_entry

        for seq, sid, dep, arr in stops_sorted:
            parent = stop_info.get(sid, {}).get("parent", sid)
            if parent == SSX_PARENT:
                continue

            if seq < ssx_seq:
                # Before SSX — contributes to toSSX
                dep_mins = time_to_mins(dep)
                if dep_mins < MIN_DEPARTURE_MINS or dep_mins > MAX_DEPARTURE_MINS:
                    continue
                toSSX[parent][info["day_type"]].append((dep_mins, ssx_arr_mins))
                parent_lines[parent].add(info["line"])
                if parent not in parent_canonical:
                    si = stop_info.get(sid, {})
                    parent_canonical[parent] = {
                        "n": si["name"].replace(" Station", "").replace(" Railway Station", ""),
                        "la": si["lat"],
                        "lo": si["lng"],
                    }

            elif seq > ssx_seq:
                # After SSX — contributes to fromSSX
                if ssx_dep_mins < MIN_DEPARTURE_MINS or ssx_dep_mins > MAX_DEPARTURE_MINS:
                    continue
                arr_mins = time_to_mins(arr)
                fromSSX[parent][info["day_type"]].append((ssx_dep_mins, arr_mins))
                parent_lines[parent].add(info["line"])
                if parent not in parent_canonical:
                    si = stop_info.get(sid, {})
                    parent_canonical[parent] = {
                        "n": si["name"].replace(" Station", "").replace(" Railway Station", ""),
                        "la": si["lat"],
                        "lo": si["lng"],
                    }

    # Deduplicate and sort each list
    print("  Deduplicating and sorting...")
    for parent in toSSX:
        for day_type in ("weekday", "saturday", "sunday"):
            entries = list(set(toSSX[parent][day_type]))
            entries.sort(key=lambda x: x[0])
            toSSX[parent][day_type] = entries
    for parent in fromSSX:
        for day_type in ("weekday", "saturday", "sunday"):
            entries = list(set(fromSSX[parent][day_type]))
            entries.sort(key=lambda x: x[0])
            fromSSX[parent][day_type] = entries

    # Active parents: union of toSSX and fromSSX stations
    active_toSSX = {p for p, d in toSSX.items() if any(d[k] for k in d)}
    active_fromSSX = {p for p, d in fromSSX.items() if any(d[k] for k in d)}
    active_parents = active_toSSX | active_fromSSX
    print(f"  Active Metro stations (toSSX): {len(active_toSSX)}")
    print(f"  Active Metro stations (fromSSX): {len(active_fromSSX)}")

    # Build stops dict
    stops_out = {}
    for parent in active_parents:
        canonical = parent_canonical.get(parent, {"n": parent, "la": 0, "lo": 0})
        lines = sorted(parent_lines[parent])
        stops_out[parent] = {
            "n": canonical["n"],
            "la": round(canonical["la"], 6),
            "lo": round(canonical["lo"], 6),
            "li": "/".join(lines),
        }

    # Build toSSX dict
    toSSX_out = {}
    for parent in active_toSSX:
        toSSX_out[parent] = {
            "wd": toSSX[parent]["weekday"],
            "sa": toSSX[parent]["saturday"],
            "su": toSSX[parent]["sunday"],
        }

    # Build fromSSX dict
    fromSSX_out = {}
    for parent in active_fromSSX:
        fromSSX_out[parent] = {
            "wd": fromSSX[parent]["weekday"],
            "sa": fromSSX[parent]["saturday"],
            "su": fromSSX[parent]["sunday"],
        }

    from datetime import date
    output = {
        "feed": "Metro trains",
        "generated": date.today().isoformat(),
        "stops": stops_out,
        "toSSX": toSSX_out,
        "fromSSX": fromSSX_out,
    }

    out_path = Path("app/public/data/metro_gtfs.json")
    with open(out_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))
    size_kb = out_path.stat().st_size // 1024
    print(f"\nWritten to {out_path} ({size_kb} KB)")
    print(f"Stations: {len(stops_out)}")

    # Show coverage summary
    print("\nSample stations (toSSX):")
    for parent in list(active_toSSX)[:5]:
        s = stops_out[parent]
        wd = len(toSSX_out[parent]["wd"])
        print(f"  {s['n']} ({s['li']}): wd={wd}")
    print("\nSample stations (fromSSX):")
    for parent in list(active_fromSSX)[:5]:
        s = stops_out[parent]
        wd = len(fromSSX_out[parent]["wd"])
        print(f"  {s['n']} ({s['li']}): wd={wd}")

if __name__ == "__main__":
    zip_path = download_ptv_gtfs()
    build_metro_gtfs(zip_path)
