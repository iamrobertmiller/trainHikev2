import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Campsite, Hut, Trail, WaterFrontage } from '../types'

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
}

const VICTORIA_CENTER: [number, number] = [144.9, -37.0]
const VICTORIA_BOUNDS: [[number, number], [number, number]] = [[140.9, -39.2], [149.9, -34.0]]

export default function Map({ campsites, trails, huts, waterFrontage, selectedCampsite, onSelectCampsite, selectedTrail, onSelectTrail, onSelectHut, onSelectWaterFrontage }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const hutMarkersRef = useRef<maplibregl.Marker[]>([])
  const waterFrontageMarkersRef = useRef<maplibregl.Marker[]>([])

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
        const feat = e.features?.[0]
        if (feat?.properties) {
          onSelectTrail(feat.properties as Trail)
        }
      })

      map.on('mouseenter', 'trails-line', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'trails-line', () => {
        map.getCanvas().style.cursor = ''
      })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update selected trail highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    map.setFilter('trails-selected', ['==', ['get', 'id'], selectedTrail?.id ?? -1])
  }, [selectedTrail])

  // Render campsite markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    campsites.forEach(site => {
      const el = document.createElement('div')
      el.className = 'campsite-marker'
      el.innerHTML = `
        <div class="w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 cursor-pointer transition-transform hover:scale-110 ${
          selectedCampsite?.id === site.id
            ? 'bg-orange-500 border-orange-200 scale-125'
            : 'bg-emerald-700 border-emerald-300'
        }">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="w-4 h-4">
            <path d="M12 2L2 20h20L12 2zm0 4l6.5 12h-13L12 6z"/>
          </svg>
        </div>
      `

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([site.lng, site.lat])
        .addTo(map)

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectCampsite(site)
        flyToCampsite(site)
      })

      markersRef.current.push(marker)
    })
  }, [campsites, selectedCampsite, onSelectCampsite, flyToCampsite])

  // Render hut markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    hutMarkersRef.current.forEach(m => m.remove())
    hutMarkersRef.current = []

    huts.forEach(hut => {
      const el = document.createElement('div')
      el.innerHTML = `
        <div class="w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 cursor-pointer transition-transform hover:scale-110 bg-amber-700 border-amber-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="w-3.5 h-3.5">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </div>
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
  }, [huts])

  // Render water frontage markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    waterFrontageMarkersRef.current.forEach(m => m.remove())
    waterFrontageMarkersRef.current = []

    waterFrontage.forEach(site => {
      const el = document.createElement('div')
      el.innerHTML = `
        <div class="w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 cursor-pointer transition-transform hover:scale-110 bg-blue-600 border-blue-200">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="w-3.5 h-3.5">
            <path d="M12 2c0 0-4 5.5-4 9a4 4 0 0 0 8 0c0-3.5-4-9-4-9z"/>
          </svg>
        </div>
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
  }, [waterFrontage])

  return <div ref={containerRef} className="w-full h-full" />
}
