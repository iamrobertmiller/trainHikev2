import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { AppMode, Campsite, CustomWaypoint, Hut, SavedTrip, Trail, UserLocation, WaterFrontage } from '../types'
import { routeLengthKm } from '../lib/geo'

interface MapProps {
  campsites: Campsite[]
  trails: GeoJSON.FeatureCollection
  huts: Hut[]
  waterFrontage: WaterFrontage[]
  selectedCampsite: Campsite | null
  onSelectCampsite: (c: Campsite | null) => void
  selectedTrail: Trail | null
  onSelectTrail: (t: Trail | null) => void
  onSelectHut: (h: Hut) => void
  onSelectWaterFrontage: (w: WaterFrontage) => void
  // Plan mode — route drawing
  isDrawingRoute: boolean
  customWaypoints: CustomWaypoint[]
  onRouteUpdated: (km: number) => void
  onAddWaypoint: (wp: CustomWaypoint) => void
  // Trip planner — station-to-campsite walking route
  tripRouteCoords: [number, number][]
  // Navigate mode
  appMode: AppMode
  activeTrip: SavedTrip | null
  onLocationUpdate: (loc: UserLocation) => void
}

const VICTORIA_CENTER: [number, number] = [144.9, -37.0]
const VICTORIA_BOUNDS: [[number, number], [number, number]] = [[140.9, -39.2], [149.9, -34.0]]

function makeCampsiteSVG(selected: boolean): string {
  const w = selected ? 30 : 26
  const h = selected ? 39 : 34
  const fill = selected ? '#ea580c' : '#059669'
  return `<svg width="${w}" height="${h}" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="cursor:pointer;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));transition:transform 0.15s" class="hover:scale-110"><path d="M13 1C6.37 1 1 6.37 1 13C1 19.63 13 34 13 34S25 19.63 25 13C25 6.37 19.63 1 13 1Z" fill="${fill}"/><path d="M13 5L5 19H21L13 5Z" fill="white" opacity="0.95"/><path d="M11 19V15H15V19Z" fill="${fill}"/></svg>`
}

export default function Map({
  campsites, trails, huts, waterFrontage,
  selectedCampsite, onSelectCampsite,
  selectedTrail, onSelectTrail,
  onSelectHut, onSelectWaterFrontage,
  isDrawingRoute, customWaypoints, onRouteUpdated, onAddWaypoint,
  tripRouteCoords,
  appMode, activeTrip, onLocationUpdate,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersMapRef = useRef<Record<number, { marker: maplibregl.Marker; el: HTMLDivElement }>>({})
  const markersRemovedRef = useRef(false)
  const hutMarkersRef = useRef<maplibregl.Marker[]>([])
  const waterFrontageMarkersRef = useRef<maplibregl.Marker[]>([])
  const waypointMarkersRef = useRef<maplibregl.Marker[]>([])
  const destMarkerRef = useRef<maplibregl.Marker | null>(null)
  const geoWatchRef = useRef<number | null>(null)

  // Refs to avoid stale closures in map event handlers
  const isDrawingRef = useRef(isDrawingRoute)
  const onAddWaypointRef = useRef(onAddWaypoint)
  const onLocationUpdateRef = useRef(onLocationUpdate)
  const onSelectCampsiteRef = useRef(onSelectCampsite)

  // Tracks the currently-selected campsite id — updated each render (not in an effect)
  // so effects can read the latest value without adding selectedCampsite to their deps.
  const selectedCampsiteIdRef = useRef<number | undefined>(selectedCampsite?.id)
  selectedCampsiteIdRef.current = selectedCampsite?.id

  // Tracks previous selected id for the incremental marker update effect
  const prevSelectedIdRef = useRef<number | undefined>(selectedCampsite?.id)

  useEffect(() => { isDrawingRef.current = isDrawingRoute }, [isDrawingRoute])
  useEffect(() => { onAddWaypointRef.current = onAddWaypoint }, [onAddWaypoint])
  useEffect(() => { onLocationUpdateRef.current = onLocationUpdate }, [onLocationUpdate])
  useEffect(() => { onSelectCampsiteRef.current = onSelectCampsite }, [onSelectCampsite])

  const flyToCampsite = useCallback((c: Campsite) => {
    mapRef.current?.flyTo({ center: [c.lng, c.lat], zoom: 13, duration: 800 })
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: VICTORIA_CENTER,
      zoom: 6.5,
      maxBounds: VICTORIA_BOUNDS,
    })

    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }), 'top-right')

    map.on('load', () => {
      // Trail lines
      map.addSource('trails', { type: 'geojson', data: trails })

      map.addLayer({
        id: 'trails-outline',
        type: 'line',
        source: 'trails',
        paint: { 'line-color': '#fff', 'line-width': 5, 'line-opacity': 0.6 },
      })

      map.addLayer({
        id: 'trails-line',
        type: 'line',
        source: 'trails',
        paint: {
          'line-color': '#2d7a4f',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      })

      map.addLayer({
        id: 'trails-selected',
        type: 'line',
        source: 'trails',
        filter: ['==', ['get', 'id'], -1],
        paint: { 'line-color': '#f97316', 'line-width': 5 },
      })

      map.on('click', 'trails-line', (e) => {
        if (isDrawingRef.current) return
        const feat = e.features?.[0]
        if (feat?.properties) {
          onSelectTrail(feat.properties as Trail)
        }
      })

      map.on('mouseenter', 'trails-line', () => {
        if (!isDrawingRef.current) map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'trails-line', () => {
        if (!isDrawingRef.current) map.getCanvas().style.cursor = ''
      })

      // Custom route source + layer
      map.addSource('custom-route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      })
      map.addLayer({
        id: 'custom-route-line',
        type: 'line',
        source: 'custom-route',
        paint: { 'line-color': '#6366f1', 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
      })

      // Trip planner walking route — station to campsite (emerald green, solid)
      map.addSource('trip-route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      })
      map.addLayer({
        id: 'trip-route-line',
        type: 'line',
        source: 'trip-route',
        paint: { 'line-color': '#059669', 'line-width': 4, 'line-opacity': 0.85 },
      })

      // Map click — add waypoint when drawing
      map.on('click', (e) => {
        if (!isDrawingRef.current) return
        onAddWaypointRef.current({
          id: crypto.randomUUID(),
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
        })
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update cursor when drawing mode changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = isDrawingRoute ? 'crosshair' : ''
  }, [isDrawingRoute])

  // In navigate mode, hide all trails except the active one
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const visibility = appMode === 'navigate' ? 'none' : 'visible'
      map.setLayoutProperty('trails-line', 'visibility', visibility)
      map.setLayoutProperty('trails-outline', 'visibility', visibility)
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [appMode])

  // Update selected trail highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const trailId = appMode === 'navigate' && activeTrip
      ? (activeTrip.trailId ?? selectedTrail?.id ?? -1)
      : (selectedTrail?.id ?? -1)
    map.setFilter('trails-selected', ['==', ['get', 'id'], trailId])
  }, [selectedTrail, appMode, activeTrip])

  // Keep stable refs so the async route callback can read current values
  const onRouteUpdatedRef = useRef(onRouteUpdated)
  useEffect(() => { onRouteUpdatedRef.current = onRouteUpdated }, [onRouteUpdated])

  // Draw station-to-campsite walking route when trip planner is open
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false
    const apply = () => {
      if (cancelled) return
      const source = map.getSource('trip-route') as maplibregl.GeoJSONSource | undefined
      source?.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: tripRouteCoords },
        properties: {},
      })
      if (tripRouteCoords.length >= 2) {
        const lngs = tripRouteCoords.map(c => c[0])
        const lats = tripRouteCoords.map(c => c[1])
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 80, duration: 800, maxZoom: 14 }
        )
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
    return () => { cancelled = true }
  }, [tripRouteCoords])

  // Update waypoint markers + fetch routed path whenever waypoints change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const updateSource = (coords: [number, number][]) => {
      const source = map.getSource('custom-route') as maplibregl.GeoJSONSource | undefined
      source?.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      })
    }

    // Redraw numbered markers
    waypointMarkersRef.current.forEach(m => m.remove())
    waypointMarkersRef.current = []
    customWaypoints.forEach((wp, i) => {
      const el = document.createElement('div')
      el.innerHTML = `
        <div class="w-6 h-6 rounded-full bg-indigo-500 border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold cursor-default select-none">
          ${i + 1}
        </div>
      `
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map)
      waypointMarkersRef.current.push(marker)
    })

    if (customWaypoints.length < 2) {
      updateSource([])
      onRouteUpdatedRef.current(0)
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
    const orsKey = import.meta.env.VITE_ORS_API_KEY as string | undefined
    const fallback = () => {
      updateSource(customWaypoints.map(wp => [wp.lng, wp.lat]))
      onRouteUpdatedRef.current(routeLengthKm(customWaypoints))
    }

    if (orsKey) {
      // OpenRouteService foot-hiking: prefers tracks, footpaths, and trails over roads
      fetch('https://api.openrouteservice.org/v2/directions/foot-hiking/geojson', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Authorization': orsKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: customWaypoints.map(wp => [wp.lng, wp.lat]),
          preference: 'recommended',
          options: {
            avoid_features: ['highways'],
            profile_params: { weightings: { green: { factor: 0.8 } } },
          },
        }),
      })
        .then(r => r.json())
        .then(data => {
          const coords = data?.features?.[0]?.geometry?.coordinates
          const dist = data?.features?.[0]?.properties?.summary?.distance
          if (coords?.length && dist != null) {
            updateSource(coords)
            onRouteUpdatedRef.current(dist / 1000)
          } else {
            fallback()
          }
        })
        .catch(() => { if (!controller.signal.aborted) fallback() })
    } else {
      const lonlats = customWaypoints.map(wp => `${wp.lng},${wp.lat}`).join('|')
      fetch(`https://brouter.de/brouter?lonlats=${lonlats}&profile=hiking-mountain&alternativeidx=0&format=geojson`, {
        signal: controller.signal,
      })
        .then(r => r.json())
        .then(data => {
          const coords = data?.features?.[0]?.geometry?.coordinates
          const distKm = parseFloat(data?.features?.[0]?.properties?.['track-length'] ?? '0') / 1000
          if (coords?.length) {
            updateSource(coords)
            onRouteUpdatedRef.current(distKm)
          } else {
            fallback()
          }
        })
        .catch(() => { if (!controller.signal.aborted) fallback() })
    }

    return () => { clearTimeout(timeoutId); controller.abort() }
  }, [customWaypoints]) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate mode — GPS watchPosition
  useEffect(() => {
    if (appMode !== 'navigate') {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current)
        geoWatchRef.current = null
      }
      return
    }

    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        onLocationUpdateRef.current(loc)
        const map = mapRef.current
        if (map) {
          map.easeTo({
            center: [loc.lng, loc.lat],
            zoom: Math.max(map.getZoom(), 14),
            duration: 500,
          })
        }
      },
      (err) => console.warn('GPS error', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )

    return () => {
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current)
        geoWatchRef.current = null
      }
    }
  }, [appMode])

  // Effect A: sync marker set with the filtered campsites array and appMode changes.
  // Does NOT depend on selectedCampsite — selection appearance is handled by Effect B.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (appMode === 'navigate') {
      markersRemovedRef.current = true
      Object.values(markersMapRef.current).forEach(({ marker }) => marker.remove())
      return
    }

    const existingIds = Object.keys(markersMapRef.current).map(Number)
    const newCampsiteIds = new Set(campsites.map(c => c.id))

    // Remove markers for campsites no longer in the filtered list
    for (const id of existingIds) {
      if (!newCampsiteIds.has(id)) {
        markersMapRef.current[id].marker.remove()
        delete markersMapRef.current[id]
      }
    }

    // Add new markers; restore markers removed when entering navigate mode
    for (const site of campsites) {
      const existing = markersMapRef.current[site.id]
      if (existing) {
        if (markersRemovedRef.current) {
          existing.marker.addTo(map)
          existing.el.innerHTML = makeCampsiteSVG(selectedCampsiteIdRef.current === site.id)
        }
      } else {
        const el = document.createElement('div')
        el.className = 'campsite-marker'
        el.innerHTML = makeCampsiteSVG(selectedCampsiteIdRef.current === site.id)
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([site.lng, site.lat])
          .addTo(map)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectCampsiteRef.current(site)
          flyToCampsite(site)
        })
        markersMapRef.current[site.id] = { marker, el }
      }
    }

    markersRemovedRef.current = false
  }, [campsites, appMode, flyToCampsite]) // eslint-disable-line react-hooks/exhaustive-deps

  // Effect B: update only the two affected markers when selection changes.
  // Avoids touching the full marker set on every campsite click.
  useEffect(() => {
    const prevId = prevSelectedIdRef.current
    const newId = selectedCampsite?.id
    prevSelectedIdRef.current = newId

    if (prevId !== undefined && prevId !== newId) {
      const entry = markersMapRef.current[prevId]
      if (entry) entry.el.innerHTML = makeCampsiteSVG(false)
    }
    if (newId !== undefined) {
      const entry = markersMapRef.current[newId]
      if (entry) entry.el.innerHTML = makeCampsiteSVG(true)
    }
  }, [selectedCampsite])

  // Render hut markers (hidden in navigate mode)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    hutMarkersRef.current.forEach(m => m.remove())
    hutMarkersRef.current = []

    if (appMode === 'navigate') return

    huts.forEach(hut => {
      const el = document.createElement('div')
      el.innerHTML = `
        <svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="cursor:pointer;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));transition:transform 0.15s" class="hover:scale-110">
          <path d="M13 1C6.37 1 1 6.37 1 13C1 19.63 13 34 13 34S25 19.63 25 13C25 6.37 19.63 1 13 1Z" fill="#b45309"/>
          <path d="M4 13L13 5L22 13" stroke="white" stroke-width="2" stroke-linejoin="round" fill="none"/>
          <rect x="6" y="13" width="14" height="9" fill="white" opacity="0.95" rx="0.5"/>
          <rect x="11" y="17" width="4" height="5" fill="#b45309"/>
        </svg>
      `

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([hut.lng, hut.lat])
        .addTo(map)

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectHut(hut)
        map.flyTo({ center: [hut.lng, hut.lat], zoom: Math.max(map.getZoom(), 12), duration: 600 })
      })

      hutMarkersRef.current.push(marker)
    })
  }, [huts, appMode])

  // Render water frontage markers (hidden in navigate mode)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    waterFrontageMarkersRef.current.forEach(m => m.remove())
    waterFrontageMarkersRef.current = []

    if (appMode === 'navigate') return

    waterFrontage.forEach(site => {
      const el = document.createElement('div')
      el.innerHTML = `
        <svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="cursor:pointer;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));transition:transform 0.15s" class="hover:scale-110">
          <path d="M13 1C6.37 1 1 6.37 1 13C1 19.63 13 34 13 34S25 19.63 25 13C25 6.37 19.63 1 13 1Z" fill="#1d4ed8"/>
          <path d="M4 13Q7 9 10 13Q13 17 16 13Q19 9 22 13" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 18Q7 14 10 18Q13 22 16 18Q19 14 22 18" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
        </svg>
      `

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([site.lng, site.lat])
        .addTo(map)

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectWaterFrontage(site)
        map.flyTo({ center: [site.lng, site.lat], zoom: Math.max(map.getZoom(), 12), duration: 600 })
      })

      waterFrontageMarkersRef.current.push(marker)
    })
  }, [waterFrontage, appMode])

  // Render destination marker in navigate mode
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    destMarkerRef.current?.remove()
    destMarkerRef.current = null

    if (appMode !== 'navigate' || !activeTrip?.campsite) return

    const campsite = activeTrip.campsite
    const el = document.createElement('div')
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;">
        <div style="background:#1a3328;color:#f0ebe0;font-family:'Oswald',sans-serif;font-size:0.6rem;font-weight:600;letter-spacing:0.1em;padding:2px 7px;border-radius:4px;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 5px rgba(0,0,0,0.4);border:1px solid #c07c28;">
          ${campsite.asset_desc || campsite.name}
        </div>
        <svg width="32" height="42" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,0.45));">
          <path d="M13 1C6.37 1 1 6.37 1 13C1 19.63 13 34 13 34S25 19.63 25 13C25 6.37 19.63 1 13 1Z" fill="#c07c28"/>
          <path d="M13 5L5 19H21L13 5Z" fill="white" opacity="0.95"/>
          <path d="M11 19V15H15V19Z" fill="#c07c28"/>
        </svg>
      </div>
    `

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([campsite.lng, campsite.lat])
      .addTo(map)

    destMarkerRef.current = marker
  }, [appMode, activeTrip])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      // Hide MapLibre controls in navigate mode (they obscure the overlay)
      style={appMode === 'navigate' ? { '--nav-display': 'none' } as React.CSSProperties : undefined}
    />
  )
}
