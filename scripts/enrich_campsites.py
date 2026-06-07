#!/usr/bin/env python3
"""
Enriches campsites.geojson with facility data scraped from Parks Victoria.
Run from the TrainHikev2 root directory:
    python3 scripts/enrich_campsites.py

Writes updated GeoJSON back to app/public/data/campsites.geojson
"""

import json
import re
import sys
import time
import urllib.request
import urllib.error

GEOJSON_PATH = "app/public/data/campsites.geojson"
SLEEP_BETWEEN = 0.6  # seconds between HTTP requests (be polite)

GENERIC_TITLES = {"parks victoria", "where to stay", "camping in victoria", "home"}


def slugify(text):
    text = re.sub(r"\s*[\(\[].*?[\)\]]", "", text).strip()
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def slug_variants(asset_desc):
    """Return ordered list of URL slug candidates for a campsite name."""
    # Strip park suffix if asset_desc is "Name, Park Name"
    clean = asset_desc.split(",")[0].strip()
    base = slugify(clean)
    seen = []

    def add(s):
        if s and s not in seen:
            seen.append(s)

    add(base)

    # Swap common naming variants
    swaps = [
        ("campground", "camping-area"),
        ("camping-area", "campground"),
        ("camp-ground", "campground"),
        ("camp-ground", "camping-area"),
        ("campsite", "campground"),
        ("campsite", "camping-area"),
        ("camp-site", "campground"),
        ("hike-in-campsite", "campground"),
        ("hike-in-campsite", "camping-area"),
    ]
    for old, new in swaps:
        if old in base:
            add(base.replace(old, new))

    # Strip trailing suffixes
    for suffix in ("-campground", "-camping-area", "-camp", "-campsite"):
        if base.endswith(suffix):
            add(base[: -len(suffix)])

    return seen[:8]


def fetch_html(url):
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; TrainHikeBot/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return None


def is_campsite_page(html, campsite_name):
    """Return True if the fetched HTML is a real campsite page (not the PV homepage)."""
    # Check og:title — real pages include the campsite/park name
    for pat in (
        r'property="og:title"\s+content="([^"]+)"',
        r'content="([^"]+)"\s+property="og:title"',
    ):
        m = re.search(pat, html)
        if m:
            title = m.group(1).lower()
            if any(g in title for g in GENERIC_TITLES):
                return False
            # At least one word from the campsite name should appear in the title
            words = [w for w in campsite_name.lower().split() if len(w) > 3]
            if any(w in title for w in words):
                return True
    return False


def extract_facilities(html):
    """Parse facility flags from page HTML body text."""
    # Strip tags, collapse whitespace, truncate before footer nav
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).lower()
    # Cut off at typical footer anchors to avoid false positives from nav links
    for cutoff in ("about us", "contact us", "statement of commitment"):
        idx = text.find(cutoff)
        if 2000 < idx < len(text) - 500:
            text = text[:idx]

    has_no_water = bool(
        re.search(
            r"no drinking water|no potable water|water not available|no fresh water|"
            r"water is not (available|provided)|bring (your own )?water",
            text,
        )
    )

    return {
        "toilets": bool(
            re.search(
                r"toilet|latrine|outhouse|pit toilet|drop toilet|composting toilet|"
                r"flush toilet|long drop",
                text,
            )
        ),
        "water": (
            bool(
                re.search(
                    r"drinking water|potable water|water tank|tank water|fresh water|"
                    r"bore water|water supply|treated water|filtered water|tap water|"
                    r"rainwater|water available",
                    text,
                )
            )
            and not has_no_water
        ),
        "fire_pits": bool(
            re.search(
                r"fireplace|fire pit|campfire pit|constructed fire|fire ring|"
                r"\bbbq\b|barbeque|barbecue|fire grate|open fire",
                text,
            )
        ),
        "shelter": bool(
            re.search(r"\bshelter\b|picnic shelter|covered area|undercover|roofed", text)
        ),
    }


def lookup_campsite(asset_desc, park_name=""):
    """Try to fetch facility data from Parks Victoria. Returns (facilities_dict, url) or (None, None)."""
    campsite_name = asset_desc.split(",")[0].strip()
    camp_slugs = slug_variants(campsite_name)
    park_slug = slugify(park_name) if park_name else None

    # Keep only the top 2 slug candidates to limit requests per campsite
    top_slugs = camp_slugs[:2]

    # Build list of URLs to try, most specific first
    urls_to_try = []

    # Pattern 1: park-specific where-to-stay page (most reliable for detailed facility info)
    if park_slug:
        for cs in top_slugs:
            urls_to_try.append(
                f"https://www.parks.vic.gov.au/places-to-see/parks/{park_slug}/where-to-stay/{cs}"
            )

    # Pattern 2: generic site page
    for cs in top_slugs:
        urls_to_try.append(f"https://www.parks.vic.gov.au/places-to-see/sites/{cs}")

    for url in urls_to_try:
        html = fetch_html(url)
        time.sleep(SLEEP_BETWEEN)
        if html and is_campsite_page(html, campsite_name):
            return extract_facilities(html), url

    return None, None


def main():
    with open(GEOJSON_PATH) as f:
        data = json.load(f)

    features = data["features"]
    total = len(features)
    print(f"Enriching {total} campsites from Parks Victoria...\n")

    found = 0
    missed = []

    for i, feature in enumerate(features, 1):
        props = feature["properties"]
        asset_desc = props.get("asset_desc") or props.get("name", "")

        park_name = props.get("park_name", "")
        facilities, url = lookup_campsite(asset_desc, park_name)

        if facilities:
            found += 1
            props["toilets"] = facilities["toilets"]
            props["water"] = facilities["water"]
            props["fire_pits"] = facilities["fire_pits"]
            props["shelter"] = facilities["shelter"]
            t = "T" if facilities["toilets"] else "-"
            w = "W" if facilities["water"] else "-"
            fp = "F" if facilities["fire_pits"] else "-"
            s = "S" if facilities["shelter"] else "-"
            print(f"[{i:3d}/{total}] {t}{w}{fp}{s}  {asset_desc[:60]}")
        else:
            missed.append(asset_desc)
            print(f"[{i:3d}/{total}] ????  {asset_desc[:60]}")

        # Flush so progress is visible when run in background
        sys.stdout.flush()

    # Save updated GeoJSON
    with open(GEOJSON_PATH, "w") as f:
        json.dump(data, f)

    print(f"\n--- Done ---")
    print(f"Found:  {found}/{total}")
    print(f"Missed: {total - found}/{total}")
    if missed:
        print(f"\nCampsites without PV pages ({len(missed)}):")
        for name in missed[:20]:
            print(f"  - {name}")
        if len(missed) > 20:
            print(f"  ... and {len(missed) - 20} more")


if __name__ == "__main__":
    main()
