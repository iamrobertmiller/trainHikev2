# TrainHike Victoria

A Progressive Web App for planning hikes in Victoria, Australia, using public transport to reach trailheads. Built for a small hiking community — no app store publishing or developer accounts needed.

## What it does

- Shows 415 Parks Victoria campsites, 22 trails, 102 alpine huts, and 290 Crown water frontage camping sites on an interactive map
- Calculates sunset time and hiking duration (Naismith's Rule) for any campsite and date
- Finds V/Line train services from your home station to the nearest stop, colour-coded by how safely you can arrive before sunset
- Works offline after first load (PWA with service worker caching)

## Map layers

| Icon | Layer | Source | Count |
|------|-------|--------|-------|
| Green tent | Parks Victoria campsites | `campsites.geojson` (converted from Shapefile) | 415 |
| Green line | Trails | GPX + KML files | 22 |
| Amber house | Alpine huts | `huts.xlsx` (Parks Victoria asset data) | 102 |
| Blue drop | Crown water frontage camping | Google My Maps KML export | 290 |

Click any marker to open an info card. Huts and water frontage sites have toggle buttons in the top bar.

## Trip planner

The trip planner uses the **Victorian GTFS static timetable** — no API credentials required.

1. Select a campsite and tap **Plan a trip**
2. Choose a departure date
3. The app calculates:
   - Sunset time at the campsite location (via `suncalc`)
   - Hiking time using Naismith's Rule (4 km/h + 10 min per 100 m elevation)
   - Latest safe arrival time (sunset minus hiking time minus 30 min buffer)
4. Set your home V/Line station (stored in localStorage)
5. The app finds the nearest V/Line stop to the campsite automatically (within 30 km)
6. Departures are fetched from the bundled timetable and colour-coded:
   - **Green (safe)** — more than 60 min buffer before deadline
   - **Amber (tight)** — 0–60 min buffer
   - **Red (risky)** — arrival after deadline

## Stack

| Library | Purpose |
|---------|---------|
| React 18 + Vite + TypeScript | App framework |
| Tailwind CSS v4 | Styling |
| MapLibre GL JS | Interactive map |
| OpenFreeMap (openfreemap.org) | Free map tiles, no API key |
| suncalc | Offline sunset calculation |
| vite-plugin-pwa + Workbox | Service worker, offline support |
| Supabase (optional) | Campsite facility enrichment |

## Data files

All source data lives in `../Data/`:

| File | Contents | How processed |
|------|----------|---------------|
| `Campgrounds.shp` | 415 Parks Victoria campsite polygons | Converted to `campsites.geojson` |
| `*.gpx`, `*.kml` | 22 trail routes | Converted to `trails.geojson` |
| `huts.xlsx` | 102 alpine huts (GDA94 UTM coords) | Converted via `pyproj` to `huts.geojson` |
| `water_frontage.kml` | 290 Crown water frontage sites | Exported from Google My Maps, converted to `water_frontage.geojson` |
| `trail_pois.json` | 681 POIs from KML files | Toilets, water points, car parks |

Processed GeoJSON files are served from `public/data/`.

## GTFS timetable data

The V/Line timetable is pre-processed from the [Victorian GTFS Schedule](https://opendata.transport.vic.gov.au/) open data (no authentication required).

**To update the timetable** (do this when timetables change, roughly every 3–6 months):

1. Download the new GTFS zip:
   ```
   curl -L -o gtfs.zip "https://opendata.transport.vic.gov.au/dataset/3f4e292e-7f8a-4ffe-831f-1953be0fe448/resource/fb152201-859f-4882-9206-b768060b50ad/download/gtfs.zip"
   ```
2. Unzip and extract the V/Line feed (folder `1/google_transit.zip`)
3. Run the preprocessing script:
   ```
   python3 build_gtfs.py
   ```
   This outputs `public/data/gtfs.json` (~5 MB raw, ~0.5 MB gzipped)

The timetable covers V/Line trains only. V/Line coaches (regional buses) are in folder `5` of the same zip and could be added later. Metro trains are in folder `2` but their stop_times file is 44 MB — too large to bundle; city users should set their home stop to Flinders Street or Southern Cross.

## Running locally

```bash
cd app
npm install
npm run dev
```

Open http://localhost:5173

## Building for production

```bash
npm run build
```

Output goes to `dist/`. Deploy to Netlify by dragging the `dist` folder to the Netlify dashboard, or connect the repo for automatic deploys.

## Optional: Supabase facility data

To enable per-campsite facility details (toilets, water, fire pits, booking):

1. Create a free Supabase project at supabase.com
2. Add your credentials to `.env`:
   ```
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

Without credentials the app still works — facility badges show as "not yet available".

## Known limitations

- Trip planning only covers direct V/Line train journeys (no transfers or Metro connections)
- Campsites with no V/Line stop within 30 km show a message and link to ptv.vic.gov.au
- Timetable data expires when new timetables are issued — check the `generated` field in `gtfs.json`
- Trail routes for Goldfields Track, Murray to Mountains Rail Trail, and You Yangs are stored as MultiLineString (two separate segments each) due to how the source KML files combine multiple route variants
