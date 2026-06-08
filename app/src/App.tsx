import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Map from './components/Map'
import CampsitePanel from './components/CampsitePanel'
import HutPanel from './components/HutPanel'
import WaterFrontagePanel from './components/WaterFrontagePanel'
import TripPlanner from './components/TripPlanner'
import HomeSetup from './components/HomeSetup'
import WaypointControls from './components/WaypointControls'
import NavigateOverlay from './components/NavigateOverlay'
import SavedTripsPanel from './components/SavedTripsPanel'
import SharedTripView from './components/SharedTripView'
import type { AppMode, Campsite, CustomWaypoint, Hut, Profile, SavedTrip, SharedTripPayload, Trail, UserLocation, WaterFrontage } from './types'
import { useDebounce } from './hooks/useDebounce'
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
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Updated each render so useCallback closures can read current panel without adding it to deps
  const panelRef = useRef(panel)
  panelRef.current = panel

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

  const dismissSharedTrip = useCallback(() => {
    setSharedTrip(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('shared')
    window.history.replaceState({}, '', url.toString())
  }, [])

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
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
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

    return () => { clearTimeout(timeoutId); controller.abort(); setTripRouteCoords([]) }
  }, [panel, appMode, nearestStop, selectedCampsite, activeTrip]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCampsite = useCallback((c: Campsite | null) => {
    if (c && selectedCampsite?.id === c.id && panel === 'campsite') {
      setSelectedCampsite(null)
      setPanel('none')
      return
    }
    setSelectedCampsite(c)
    setPanel(c ? 'campsite' : 'none')
    if (c) setShowCampsiteHint(false)
  }, [selectedCampsite, panel])

  const filteredCampsites = useMemo(() => {
    if (!debouncedSearchQuery) return campsites
    const q = debouncedSearchQuery.toLowerCase()
    return campsites.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.asset_desc?.toLowerCase().includes(q) ||
      c.park_name?.toLowerCase().includes(q)
    )
  }, [campsites, debouncedSearchQuery])

  const handleSaveTrip = useCallback((base: Omit<SavedTrip, 'id' | 'savedAt'>) => {
    const saved = saveTrip({ ...base, customWaypoints })
    setActiveTrip(saved)
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)
  }, [saveTrip, customWaypoints])

  const handleSwitchMode = useCallback((m: AppMode) => {
    if (m === 'navigate' && !activeTrip) {
      setPanel('savedTrips')
      return
    }
    setAppMode(m)
    setIsDrawingRoute(false)
    setPanel('none')
    if (m === 'plan') setUserLocation(null)
  }, [activeTrip])

  const handleStartDrawing = useCallback(() => {
    setIsDrawingRoute(true)
    setPanel('none')
  }, [])

  const handlePlanTrip = useCallback(() => {
    setIsDrawingRoute(false)
    setShowCampsiteHint(true)
    setTimeout(() => setShowCampsiteHint(false), 5000)
  }, [])

  // Stable handlers for Map and child components
  const handleSelectTrail = useCallback((t: Trail | null) => {
    setSelectedTrail(t)
    setPanel('none')
  }, [])

  const handleSelectHut = useCallback((h: Hut) => {
    setSelectedHut(prev => {
      if (prev?.name === h.name && prev?.lat === h.lat && panelRef.current === 'hut') {
        setPanel('none')
        return null
      }
      setPanel('hut')
      return h
    })
  }, [])

  const handleSelectWaterFrontage = useCallback((w: WaterFrontage) => {
    setSelectedWaterFrontage(prev => {
      if (prev?.name === w.name && prev?.lat === w.lat && panelRef.current === 'waterFrontage') {
        setPanel('none')
        return null
      }
      setPanel('waterFrontage')
      return w
    })
  }, [])

  const handleAddWaypoint = useCallback((wp: CustomWaypoint) => {
    setCustomWaypoints(prev => [...prev, wp])
  }, [])

  const handleToggleDrawing = useCallback(() => setIsDrawingRoute(d => !d), [])
  const handleDeleteLastWaypoint = useCallback(() => setCustomWaypoints(prev => prev.slice(0, -1)), [])
  const handleClearAllWaypoints = useCallback(() => { setCustomWaypoints([]); setIsDrawingRoute(false) }, [])
  const handleClosePanel = useCallback(() => setPanel('none'), [])
  const handleCloseTripPanel = useCallback(() => setPanel('campsite'), [])
  const handleOpenTripPanel = useCallback(() => setPanel('trip'), [])
  const handleToggleWaterFrontage = useCallback(() => setShowWaterFrontage(s => !s), [])
  const handleToggleHuts = useCallback(() => setShowHuts(s => !s), [])
  const handleOpenSavedTrips = useCallback(() => setPanel('savedTrips'), [])
  const handleOpenHomeSetup = useCallback(() => setPanel('homeSetup'), [])
  const handleToggleSearch = useCallback(() => setShowSearch(s => !s), [])
  const handleCloseSelectedTrail = useCallback(() => setSelectedTrail(null), [])

  const handleHutPlanTrip = useCallback(() => {
    setSelectedHut(prev => {
      if (prev) {
        setSelectedCampsite({ id: -1, name: prev.name, asset_desc: prev.name, park_name: prev.park, park_id: 0, lat: prev.lat, lng: prev.lng })
        setPanel('trip')
      }
      return prev
    })
  }, [])

  const handleWaterFrontagePlanTrip = useCallback(() => {
    setSelectedWaterFrontage(prev => {
      if (prev) {
        setSelectedCampsite({ id: -1, name: prev.name, asset_desc: prev.name, park_name: prev.river, park_id: 0, lat: prev.lat, lng: prev.lng })
        setPanel('trip')
      }
      return prev
    })
  }, [])

  const handleHomeSave = useCallback((p: Profile) => {
    saveProfile(p)
    setPanel(selectedCampsite ? 'campsite' : 'none')
  }, [saveProfile, selectedCampsite])

  const handleHomeSkip = useCallback(() => {
    setPanel(selectedCampsite ? 'campsite' : 'none')
  }, [selectedCampsite])

  const handleLoadTrip = useCallback((trip: SavedTrip) => {
    setActiveTrip(trip)
    setAppMode('navigate')
    setPanel('none')
  }, [])

  const handleNavigateExit = useCallback(() => setAppMode('plan'), [])

  const handleSearchSelect = useCallback((c: Campsite) => {
    handleSelectCampsite(c)
    setShowSearch(false)
    setSearchQuery('')
  }, [handleSelectCampsite])

  const handlePlanModeSwitch = useCallback(() => handleSwitchMode('plan'), [handleSwitchMode])
  const handleNavigateModeSwitch = useCallback(() => handleSwitchMode('navigate'), [handleSwitchMode])

  return (
    <div className="fixed inset-0 overflow-hidden bg-gray-100">
      {trailsGeoJSON && (
        <Map
          campsites={filteredCampsites}
          trails={trailsGeoJSON}
          huts={showHuts ? huts : []}
          waterFrontage={showWaterFrontage ? waterFrontage : []}
          selectedCampsite={selectedCampsite}
          onSelectCampsite={handleSelectCampsite}
          selectedTrail={selectedTrail}
          onSelectTrail={handleSelectTrail}
          onSelectHut={handleSelectHut}
          onSelectWaterFrontage={handleSelectWaterFrontage}
          isDrawingRoute={isDrawingRoute}
          customWaypoints={customWaypoints}
          onRouteUpdated={setCustomRouteKm}
          onAddWaypoint={handleAddWaypoint}
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
          onExit={handleNavigateExit}
        />
      )}

      {/* Waypoint drawing controls (Plan mode) */}
      {appMode === 'plan' && (
        <WaypointControls
          waypoints={customWaypoints}
          isDrawing={isDrawingRoute}
          estimatedKm={customRouteKm}
          estimatedMinutes={customRouteKm > 0 ? naismithMinutes(customRouteKm, 0) : 0}
          onToggleDrawing={handleToggleDrawing}
          onDeleteLast={handleDeleteLastWaypoint}
          onClearAll={handleClearAllWaypoints}
          onPlanTrip={handlePlanTrip}
        />
      )}

      {/* Top bar — hidden in navigate mode */}
      {appMode === 'plan' && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-1.5 p-2.5 pointer-events-none">
          {/* Brand */}
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl shadow-lg px-3 py-2 flex-1 max-w-[160px]" style={{ background: 'var(--forest)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L2 21h20L12 3z" fill="#4a7a58"/>
              <path d="M12 7l6.5 12h-13L12 7z" fill="#f0ebe0" opacity="0.9"/>
              <path d="M10 21v-4h4v4" fill="var(--forest)"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.12em', color: '#f0ebe0', lineHeight: 1.1 }}>TRAINHIKE</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '0.14em', color: 'var(--sand)', lineHeight: 1 }}>VICTORIA</div>
            </div>
          </div>

          {/* Search */}
          <button
            onClick={handleToggleSearch}
            className="pointer-events-auto w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors"
            style={{ background: showSearch ? 'var(--ink)' : 'var(--paper)', color: showSearch ? '#fff' : 'var(--forest)' }}
            title="Search campsites"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L22 22"/>
            </svg>
          </button>

          {/* Saved trips */}
          <button
            onClick={handleOpenSavedTrips}
            className="pointer-events-auto w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--paper)', color: 'var(--forest)' }}
            title="Saved trips"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>

          {/* Home station */}
          <button
            onClick={handleOpenHomeSetup}
            className="pointer-events-auto w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors"
            style={{ background: profile ? 'var(--paper)' : 'var(--ochre)', color: profile ? 'var(--forest)' : '#fff' }}
            title={profile ? `Home: ${profile.homeStopName}` : 'Set home station'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="1"/>
              <path d="M2 11l10-8 10 8"/>
              <path d="M9 21v-6h6v6"/>
            </svg>
          </button>
        </div>
      )}

      {/* Layer toggles — bottom left, above tab bar */}
      {appMode === 'plan' && panel === 'none' && !selectedTrail && (
        <div className="absolute left-3 z-10 pointer-events-auto flex flex-col gap-1.5" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={handleToggleWaterFrontage}
            className="flex items-center gap-2 rounded-lg shadow-lg px-2.5 py-1.5 transition-colors"
            style={{
              background: showWaterFrontage ? '#1a3d5c' : 'var(--forest)',
              border: showWaterFrontage ? '1px solid #2a6090' : '1px solid var(--forest-2)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showWaterFrontage ? '#90c8e8' : 'var(--sand)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12Q6 8 10 12Q14 16 18 12Q20 10 22 12"/><path d="M2 18Q6 14 10 18Q14 22 18 18Q20 16 22 18"/>
            </svg>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.1em', color: showWaterFrontage ? '#90c8e8' : 'var(--sand)' }}>
              WATERWAYS
            </span>
          </button>
          <button
            onClick={handleToggleHuts}
            className="flex items-center gap-2 rounded-lg shadow-lg px-2.5 py-1.5 transition-colors"
            style={{
              background: showHuts ? '#5a3510' : 'var(--forest)',
              border: showHuts ? '1px solid var(--earth)' : '1px solid var(--forest-2)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showHuts ? 'var(--ochre)' : 'var(--sand)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-8 9 8"/><path d="M5 11v9h14v-9"/><path d="M10 20v-5h4v5"/>
            </svg>
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.1em', color: showHuts ? 'var(--ochre)' : 'var(--sand)' }}>
              HUTS
            </span>
          </button>
        </div>
      )}

      {/* Search */}
      {appMode === 'plan' && showSearch && (
        <div className="absolute top-14 left-2.5 right-2.5 z-10 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search campsites & parks…"
            className="w-full shadow-lg rounded-xl px-4 py-3 text-sm focus:outline-none"
            style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1.5px solid var(--fog)', fontFamily: 'Lora, Georgia, serif', outline: 'none' }}
            autoFocus
          />
          {searchQuery && filteredCampsites.length > 0 && (
            <ul className="mt-1 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto" style={{ background: 'var(--paper)', border: '1.5px solid var(--fog)' }}>
              {filteredCampsites.slice(0, 8).map(c => (
                <li key={c.id} style={{ borderBottom: '1px solid var(--fog)' }}>
                  <button
                    onClick={() => handleSearchSelect(c)}
                    className="w-full text-left px-4 py-3 transition-colors"
                    style={{ fontFamily: 'Lora, Georgia, serif' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{c.asset_desc || c.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--sand)' }}>{c.park_name}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Selected trail banner — Plan mode only */}
      {appMode === 'plan' && selectedTrail && panel === 'none' && (
        <div className="absolute left-4 right-16 md:left-auto md:right-4 md:w-80 z-10 bg-white rounded-2xl shadow-lg p-4" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{selectedTrail.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{selectedTrail.length_km} km</p>
            </div>
            <button onClick={handleCloseSelectedTrail} className="text-gray-400 hover:text-gray-600 flex-none w-6 h-6 flex items-center justify-center">✕</button>
          </div>
        </div>
      )}

      {/* Campsite panel */}
      {panel === 'campsite' && selectedCampsite && (
        <CampsitePanel
          campsite={selectedCampsite}
          onClose={handleClosePanel}
          onPlanTrip={handleOpenTripPanel}
        />
      )}

      {/* Hut panel */}
      {panel === 'hut' && selectedHut && (
        <HutPanel
          hut={selectedHut}
          onClose={handleClosePanel}
          onPlanTrip={handleHutPlanTrip}
        />
      )}

      {/* Water frontage panel */}
      {panel === 'waterFrontage' && selectedWaterFrontage && (
        <WaterFrontagePanel
          site={selectedWaterFrontage}
          onClose={handleClosePanel}
          onPlanTrip={handleWaterFrontagePlanTrip}
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
          onClose={handleCloseTripPanel}
          onSetHomeStop={handleOpenHomeSetup}
          onStartDrawing={handleStartDrawing}
          onSaveTrip={handleSaveTrip}
        />
      )}

      {/* Home setup */}
      {panel === 'homeSetup' && (
        <HomeSetup
          onSave={handleHomeSave}
          onSkip={handleHomeSkip}
        />
      )}

      {/* Saved trips panel */}
      {panel === 'savedTrips' && (
        <SavedTripsPanel
          trips={trips}
          onLoad={handleLoadTrip}
          onDelete={removeTrip}
          onClose={handleClosePanel}
        />
      )}


      {/* Campsite hint banner */}
      {showCampsiteHint && (
        <div className="absolute left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 max-w-[calc(100vw-2rem)] text-center" style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))', background: 'var(--forest)', border: '1px solid var(--ochre)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 3L2 21h20L12 3z" fill="var(--moss)"/>
            <path d="M12 7l6 11H6L12 7z" fill="var(--paper)" opacity="0.9"/>
          </svg>
          <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.8rem', letterSpacing: '0.06em', color: 'var(--paper)' }}>Tap a campsite on the map to plan</span>
        </div>
      )}

      {/* Save toast */}
      {saveToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 max-w-[calc(100vw-2rem)]" style={{ background: 'var(--ochre)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.8rem', letterSpacing: '0.06em', color: '#fff' }}>TRIP SAVED — tap Navigate to go</span>
        </div>
      )}

      {/* Shared trip view — shown when opening a friend's share link */}
      {sharedTrip && (
        <SharedTripView payload={sharedTrip} onClose={dismissSharedTrip} />
      )}

      {/* Mode switcher — top of screen, below the top bar */}
      {panel === 'none' && !(appMode === 'navigate' && activeTrip) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
          style={{ top: '3.75rem' }}
        >
          <div
            className="flex rounded-full shadow-xl overflow-hidden"
            style={{ background: 'var(--forest)', border: '1px solid var(--forest-2)' }}
          >
            <button
              onClick={handlePlanModeSwitch}
              className="flex items-center gap-2 px-5 py-2.5 transition-colors"
              style={{
                background: appMode === 'plan' ? 'var(--forest-2)' : 'transparent',
                color: appMode === 'plan' ? 'var(--ochre)' : 'var(--sand)',
                borderRight: '1px solid var(--forest-2)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5"/>
                <path d="M16 3v4M8 3v4M3 11h18"/>
                <path d="M19 16l-4 4-2-2"/>
              </svg>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.7rem', letterSpacing: '0.12em', fontWeight: 600 }}>PLAN</span>
            </button>
            <button
              onClick={handleNavigateModeSwitch}
              className="flex items-center gap-2 px-5 py-2.5 transition-colors"
              style={{
                background: appMode === 'navigate' ? 'var(--forest-2)' : 'transparent',
                color: appMode === 'navigate' ? 'var(--ochre)' : 'var(--sand)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.7rem', letterSpacing: '0.12em', fontWeight: 600 }}>NAVIGATE</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
