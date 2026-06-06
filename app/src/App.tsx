import { useState, useEffect, useMemo } from 'react'
import Map from './components/Map'
import CampsitePanel from './components/CampsitePanel'
import HutPanel from './components/HutPanel'
import WaterFrontagePanel from './components/WaterFrontagePanel'
import TripPlanner from './components/TripPlanner'
import HomeSetup from './components/HomeSetup'
import BottomTabBar from './components/BottomTabBar'
import WaypointControls from './components/WaypointControls'
import NavigateOverlay from './components/NavigateOverlay'
import SavedTripsPanel from './components/SavedTripsPanel'
import SharedTripView from './components/SharedTripView'
import type { AppMode, Campsite, CustomWaypoint, Hut, SavedTrip, SharedTripPayload, Trail, UserLocation, WaterFrontage } from './types'
import { useProfile, useSavedTrips } from './hooks/useProfile'
import { useNearestStop } from './hooks/useGTFS'
import { naismithMinutes } from './lib/naismith'

type Panel = 'none' | 'campsite' | 'trip' | 'homeSetup' | 'hut' | 'waterFrontage' | 'savedTrips'

export default function App() {
  const [campsites, setCampsites] = useState<Campsite[]>([])
  const [trailsGeoJSON, setTrailsGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null)
  const [huts, setHuts] = useState<Hut[]>([])
  const [showHuts, setShowHuts] = useState(true)
  const [waterFrontage, setWaterFrontage] = useState<WaterFrontage[]>([])
  const [showWaterFrontage, setShowWaterFrontage] = useState(true)
  const [selectedHut, setSelectedHut] = useState<Hut | null>(null)
  const [selectedWaterFrontage, setSelectedWaterFrontage] = useState<WaterFrontage | null>(null)
  const [selectedCampsite, setSelectedCampsite] = useState<Campsite | null>(null)
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null)
  const [panel, setPanel] = useState<Panel>('none')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Mode & navigation state
  const [appMode, setAppMode] = useState<AppMode>('plan')
  const [customWaypoints, setCustomWaypoints] = useState<CustomWaypoint[]>([])
  const [isDrawingRoute, setIsDrawingRoute] = useState(false)
  const [activeTrip, setActiveTrip] = useState<SavedTrip | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [saveToast, setSaveToast] = useState(false)
  const [sharedTrip, setSharedTrip] = useState<SharedTripPayload | null>(null)
  const [showCampsiteHint, setShowCampsiteHint] = useState(false)

  const { profile, saveProfile } = useProfile()
  const { trips, saveTrip, removeTrip } = useSavedTrips()

  // Decode shared trip from URL and auto-save it once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = params.get('shared')
    if (!shared) return
    try {
      const payload = JSON.parse(decodeURIComponent(shared)) as SharedTripPayload
      setSharedTrip(payload)
      const alreadySaved = trips.some(
        t => t.campsiteId === payload.campsiteId &&
             t.date === payload.date &&
             t.trailheadStopId === payload.meetupStopId
      )
      if (!alreadySaved) {
        const campsite: Campsite = {
          id: payload.campsiteId,
          name: payload.campsiteName,
          asset_desc: payload.campsiteName,
          park_name: payload.campsiteParkName ?? '',
          park_id: 0,
          lat: payload.campsiteLat,
          lng: payload.campsiteLng,
        }
        saveTrip({
          campsiteId: payload.campsiteId,
          trailId: null,
          date: payload.date,
          trailheadStopName: payload.meetupStopName,
          trailheadStopId: payload.meetupStopId,
          chosenArrivalTime: payload.meetupTime,
          campsite,
          trail: null,
        })
      }
    } catch {
      // malformed payload — ignore
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dismissSharedTrip = () => {
    setSharedTrip(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('shared')
    window.history.replaceState({}, '', url.toString())
  }

  useEffect(() => {
    fetch('/data/campsites.geojson')
      .then(r => r.json())
      .then(data => {
        const sites: Campsite[] = data.features.map((f: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }) => ({
          ...f.properties,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        }))
        setCampsites(sites)
      })

    fetch('/data/trails.geojson')
      .then(r => r.json())
      .then(setTrailsGeoJSON)

    fetch('/data/huts.geojson')
      .then(r => r.json())
      .then(data => {
        const h: Hut[] = data.features.map((f: { properties: { name: string; park: string }; geometry: { coordinates: number[] } }) => ({
          name: f.properties.name,
          park: f.properties.park,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        }))
        setHuts(h)
      })

    fetch('/data/water_frontage.geojson')
      .then(r => r.json())
      .then(data => {
        const wf: WaterFrontage[] = data.features.map((f: { properties: { name: string; river: string; location: string; url: string }; geometry: { coordinates: number[] } }) => ({
          name: f.properties.name,
          river: f.properties.river,
          location: f.properties.location,
          url: f.properties.url,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        }))
        setWaterFrontage(wf)
      })
  }, [])

  const trails: Trail[] = useMemo(() =>
    trailsGeoJSON?.features.map(f => f.properties as Trail) ?? [],
    [trailsGeoJSON]
  )


  const [customRouteKm, setCustomRouteKm] = useState(0)
  const [tripRouteCoords, setTripRouteCoords] = useState<[number, number][]>([])

  // The relevant destination: trip planner selection or the active navigate-mode trip
  const routeCampsite = selectedCampsite ?? (appMode === 'navigate' ? (activeTrip?.campsite ?? null) : null)
  const nearestStop = useNearestStop(routeCampsite?.lat ?? null, routeCampsite?.lng ?? null)

  // Draw walking route on map when trip planner is open or navigate mode is active
  useEffect(() => {
    const wantRoute = (panel === 'trip' && !!selectedCampsite) || (appMode === 'navigate' && !!activeTrip)
    const campsite = selectedCampsite ?? activeTrip?.campsite

    if (!wantRoute || !nearestStop || !campsite) {
      setTripRouteCoords([])
      return
    }
    const controller = new AbortController()
    const orsKey = import.meta.env.VITE_ORS_API_KEY as string | undefined
    const origin: [number, number] = [nearestStop.stop.lng, nearestStop.stop.lat]
    const dest: [number, number] = [campsite.lng, campsite.lat]

    if (orsKey) {
      fetch('https://api.openrouteservice.org/v2/directions/foot-hiking/geojson', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Authorization': orsKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [origin, dest] }),
      })
        .then(r => r.json())
        .then(data => {
          const coords = data?.features?.[0]?.geometry?.coordinates
          if (coords?.length) setTripRouteCoords(coords)
          else setTripRouteCoords([origin, dest])
        })
        .catch(() => { if (!controller.signal.aborted) setTripRouteCoords([origin, dest]) })
    } else {
      fetch(`https://router.project-osrm.org/route/v1/foot/${origin[0]},${origin[1]};${dest[0]},${dest[1]}?overview=full&geometries=geojson`, {
        signal: controller.signal,
      })
        .then(r => r.json())
        .then(data => {
          if (data.code === 'Ok' && data.routes?.[0])
            setTripRouteCoords(data.routes[0].geometry.coordinates)
          else
            setTripRouteCoords([origin, dest])
        })
        .catch(() => { if (!controller.signal.aborted) setTripRouteCoords([origin, dest]) })
    }

    return () => { controller.abort(); setTripRouteCoords([]) }
  }, [panel, appMode, nearestStop, selectedCampsite, activeTrip]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCampsite = (c: Campsite | null) => {
    setSelectedCampsite(c)
    setPanel(c ? 'campsite' : 'none')
    if (c) setShowCampsiteHint(false)
  }

  const filteredCampsites = useMemo(() => {
    if (!searchQuery) return campsites
    const q = searchQuery.toLowerCase()
    return campsites.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.asset_desc?.toLowerCase().includes(q) ||
      c.park_name?.toLowerCase().includes(q)
    )
  }, [campsites, searchQuery])

  const handleSaveTrip = (base: Omit<SavedTrip, 'id' | 'savedAt'>) => {
    const saved = saveTrip({ ...base, customWaypoints })
    setActiveTrip(saved)
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)
  }

  const handleSwitchMode = (m: AppMode) => {
    if (m === 'navigate' && !activeTrip) {
      setPanel('savedTrips')
      return
    }
    setAppMode(m)
    setIsDrawingRoute(false)
    if (m === 'plan') setUserLocation(null)
  }

  const handleStartDrawing = () => {
    setIsDrawingRoute(true)
    setPanel('none')
  }

  const handlePlanTrip = () => {
    setIsDrawingRoute(false)
    setShowCampsiteHint(true)
    setTimeout(() => setShowCampsiteHint(false), 5000)
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-100">
      {trailsGeoJSON && (
        <Map
          campsites={filteredCampsites}
          trails={trailsGeoJSON}
          huts={showHuts ? huts : []}
          waterFrontage={showWaterFrontage ? waterFrontage : []}
          selectedCampsite={selectedCampsite}
          onSelectCampsite={handleSelectCampsite}
          selectedTrail={selectedTrail}
          onSelectTrail={t => { setSelectedTrail(t); setPanel('none') }}
          onSelectHut={h => { setSelectedHut(h); setPanel('hut') }}
          onSelectWaterFrontage={w => { setSelectedWaterFrontage(w); setPanel('waterFrontage') }}
          isDrawingRoute={isDrawingRoute}
          customWaypoints={customWaypoints}
          onRouteUpdated={setCustomRouteKm}
          onAddWaypoint={wp => setCustomWaypoints(prev => [...prev, wp])}
          tripRouteCoords={tripRouteCoords}
          appMode={appMode}
          activeTrip={activeTrip}
          onLocationUpdate={setUserLocation}
        />
      )}

      {/* Navigate mode overlay */}
      {appMode === 'navigate' && activeTrip && (
        <NavigateOverlay
          activeTrip={activeTrip}
          userLocation={userLocation}
          onExit={() => setAppMode('plan')}
        />
      )}

      {/* Waypoint drawing controls (Plan mode) */}
      {appMode === 'plan' && (
        <WaypointControls
          waypoints={customWaypoints}
          isDrawing={isDrawingRoute}
          estimatedKm={customRouteKm}
          estimatedMinutes={customRouteKm > 0 ? naismithMinutes(customRouteKm, 0) : 0}
          onToggleDrawing={() => setIsDrawingRoute(d => !d)}
          onDeleteLast={() => setCustomWaypoints(prev => prev.slice(0, -1))}
          onClearAll={() => { setCustomWaypoints([]); setIsDrawingRoute(false) }}
          onPlanTrip={handlePlanTrip}
        />
      )}

      {/* Top bar — hidden in navigate mode */}
      {appMode === 'plan' && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 p-3 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 bg-white rounded-2xl shadow-md px-3 py-2 flex-1 max-w-sm">
            <span className="text-emerald-700 text-lg">🏕️</span>
            <span className="font-bold text-gray-800 text-sm">TrainHike</span>
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-xs text-gray-500">Victoria</span>
          </div>
          <button
            onClick={() => setShowSearch(s => !s)}
            className="pointer-events-auto w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 text-base"
          >
            🔍
          </button>
          <button
            onClick={() => setShowWaterFrontage(s => !s)}
            className={`pointer-events-auto w-10 h-10 rounded-xl shadow-md flex items-center justify-center text-base transition-colors ${showWaterFrontage ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-400'}`}
            title={showWaterFrontage ? 'Hide water frontage camping' : 'Show water frontage camping'}
          >
            🏕️💧
          </button>
          <button
            onClick={() => setShowHuts(s => !s)}
            className={`pointer-events-auto w-10 h-10 rounded-xl shadow-md flex items-center justify-center text-base transition-colors ${showHuts ? 'bg-amber-100 text-amber-700' : 'bg-white text-gray-400'}`}
            title={showHuts ? 'Hide huts' : 'Show huts'}
          >
            🏚️
          </button>
          <button
            onClick={() => setPanel('savedTrips')}
            className="pointer-events-auto w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 text-base"
            title="Saved trips"
          >
            📋
          </button>
          <button
            onClick={() => setPanel('homeSetup')}
            className="pointer-events-auto w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 text-base"
            title={profile ? `Home: ${profile.homeStopName}` : 'Set home station'}
          >
            {profile ? '🏠' : '📍'}
          </button>
        </div>
      )}

      {/* Search */}
      {appMode === 'plan' && showSearch && (
        <div className="absolute top-16 left-3 right-3 z-10 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search campsites & parks…"
            className="w-full bg-white shadow-md rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
          {searchQuery && filteredCampsites.length > 0 && (
            <ul className="mt-1 bg-white rounded-xl shadow-lg border border-gray-100 max-h-64 overflow-y-auto divide-y divide-gray-50">
              {filteredCampsites.slice(0, 8).map(c => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      handleSelectCampsite(c)
                      setShowSearch(false)
                      setSearchQuery('')
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50"
                  >
                    <p className="text-sm font-medium text-gray-900">{c.asset_desc || c.name}</p>
                    <p className="text-xs text-gray-400">{c.park_name}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Selected trail banner — Plan mode only */}
      {appMode === 'plan' && selectedTrail && panel === 'none' && (
        <div className="absolute bottom-20 left-4 right-16 md:left-auto md:right-4 md:w-80 z-10 bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{selectedTrail.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{selectedTrail.length_km} km</p>
            </div>
            <button onClick={() => setSelectedTrail(null)} className="text-gray-400 hover:text-gray-600 flex-none w-6 h-6 flex items-center justify-center">✕</button>
          </div>
        </div>
      )}

      {/* Campsite panel */}
      {panel === 'campsite' && selectedCampsite && (
        <CampsitePanel
          campsite={selectedCampsite}
          onClose={() => setPanel('none')}
          onPlanTrip={() => setPanel('trip')}
        />
      )}

      {/* Hut panel */}
      {panel === 'hut' && selectedHut && (
        <HutPanel
          hut={selectedHut}
          onClose={() => setPanel('none')}
          onPlanTrip={() => {
            setSelectedCampsite({ id: -1, name: selectedHut.name, asset_desc: selectedHut.name, park_name: selectedHut.park, park_id: 0, lat: selectedHut.lat, lng: selectedHut.lng })
            setPanel('trip')
          }}
        />
      )}

      {/* Water frontage panel */}
      {panel === 'waterFrontage' && selectedWaterFrontage && (
        <WaterFrontagePanel
          site={selectedWaterFrontage}
          onClose={() => setPanel('none')}
          onPlanTrip={() => {
            setSelectedCampsite({ id: -1, name: selectedWaterFrontage.name, asset_desc: selectedWaterFrontage.name, park_name: selectedWaterFrontage.river, park_id: 0, lat: selectedWaterFrontage.lat, lng: selectedWaterFrontage.lng })
            setPanel('trip')
          }}
        />
      )}

      {/* Trip planner */}
      {panel === 'trip' && selectedCampsite && (
        <TripPlanner
          campsite={selectedCampsite}
          trail={selectedTrail}
          profile={profile}
          customWaypoints={customWaypoints}
          customRouteKm={customRouteKm}
          onClose={() => setPanel('campsite')}
          onSetHomeStop={() => setPanel('homeSetup')}
          onStartDrawing={handleStartDrawing}
          onSaveTrip={handleSaveTrip}
        />
      )}

      {/* Home setup */}
      {panel === 'homeSetup' && (
        <HomeSetup
          onSave={p => {
            saveProfile(p)
            setPanel(selectedCampsite ? 'campsite' : 'none')
          }}
          onSkip={() => setPanel(selectedCampsite ? 'campsite' : 'none')}
        />
      )}

      {/* Saved trips panel */}
      {panel === 'savedTrips' && (
        <SavedTripsPanel
          trips={trips}
          onLoad={trip => {
            setActiveTrip(trip)
            setAppMode('navigate')
            setPanel('none')
          }}
          onDelete={removeTrip}
          onClose={() => setPanel('none')}
        />
      )}

      {/* Stats — Plan mode only */}
      {appMode === 'plan' && panel === 'none' && !showSearch && (
        <div className="absolute bottom-20 left-4 z-10 pointer-events-none">
          <div className="bg-white/90 backdrop-blur rounded-xl px-3 py-1.5 shadow text-xs text-gray-500">
            {campsites.length} campsites · {trails.length} trails · {huts.length} huts · {waterFrontage.length} water frontage
          </div>
        </div>
      )}

      {/* Campsite hint banner */}
      {showCampsiteHint && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 whitespace-nowrap">
          <span>🏕️</span>
          <span>Now tap a campsite on the map to plan your trip</span>
        </div>
      )}

      {/* Save toast */}
      {saveToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-2">
          <span>✅</span>
          <span>Trip saved! Tap Navigate to go.</span>
        </div>
      )}

      {/* Shared trip view — shown when opening a friend's share link */}
      {sharedTrip && (
        <SharedTripView payload={sharedTrip} onClose={dismissSharedTrip} />
      )}

      {/* Bottom tab bar */}
      <BottomTabBar mode={appMode} onSwitchMode={handleSwitchMode} />
    </div>
  )
}
