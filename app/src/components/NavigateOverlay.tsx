import { useEffect, useState, useMemo } from 'react'
import type { SavedTrip, UserLocation } from '../types'
import { haversineKm, bearingDeg, routeLengthKm } from '../lib/geo'
import { naismithMinutes } from '../lib/naismith'
import { useNearestStop } from '../hooks/useGTFS'

interface Props {
  activeTrip: SavedTrip
  userLocation: UserLocation | null
  onExit: () => void
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Now'
  const totalMins = Math.floor(ms / 60000)
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: accent ? 'var(--ochre)' : 'rgba(253,249,240,0.97)',
        color: accent ? '#fff' : 'var(--ink)',
        border: accent ? 'none' : '1.5px solid rgba(0,0,0,0.12)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      }}
    >
      <p
        className="mb-1"
        style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.12em', color: accent ? 'rgba(255,255,255,0.8)' : 'var(--earth)' }}
      >
        {label.toUpperCase()}
      </p>
      <p
        className="font-bold leading-tight"
        style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', color: accent ? '#fff' : 'var(--ink)' }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="mt-1"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: accent ? 'rgba(255,255,255,0.75)' : 'var(--sand)' }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

export default function NavigateOverlay({ activeTrip, userLocation, onExit }: Props) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const tripName = activeTrip.campsite?.asset_desc ?? activeTrip.campsite?.name ?? `Trip #${activeTrip.campsiteId}`

  const nearestStop = useNearestStop(
    activeTrip.campsite?.lat ?? null,
    activeTrip.campsite?.lng ?? null
  )

  const totalRouteKm = useMemo(() => {
    if (activeTrip.customWaypoints && activeTrip.customWaypoints.length > 1) {
      return routeLengthKm(activeTrip.customWaypoints)
    }
    if (activeTrip.trail?.length_km) return activeTrip.trail.length_km
    return nearestStop?.distanceKm ?? null
  }, [activeTrip, nearestStop])

  const distToTrailhead = useMemo(() => {
    if (!userLocation) return null
    const dest = activeTrip.customWaypoints?.[0] ?? activeTrip.campsite
    if (!dest) return null
    return haversineKm(userLocation.lat, userLocation.lng, dest.lat, dest.lng)
  }, [userLocation, activeTrip])

  const bearing = useMemo(() => {
    if (!userLocation) return null
    const dest = activeTrip.customWaypoints?.[0] ?? activeTrip.campsite
    if (!dest) return null
    return bearingDeg(userLocation, dest)
  }, [userLocation, activeTrip])

  const etaMinutes = useMemo(() => {
    if (totalRouteKm == null) return null
    return naismithMinutes(totalRouteKm, 0)
  }, [totalRouteKm])

  const trainTile = useMemo(() => {
    if (!activeTrip.chosenDepartureTime) return null
    const [h, m] = activeTrip.chosenDepartureTime.split(':').map(Number)
    const dep = new Date(activeTrip.date + 'T00:00:00')
    dep.setHours(h, m, 0, 0)
    const ms = dep.getTime() - now
    if (ms < -60000) return { value: 'Departed', label: 'Train', accent: false }
    if (ms > 6 * 60 * 60 * 1000) {
      return {
        value: dep.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
        label: 'Departure date',
        accent: true,
      }
    }
    return { value: formatCountdown(ms), label: 'Departing in', accent: true }
  }, [activeTrip.chosenDepartureTime, activeTrip.date, now])

  return (
    <>
      {/* Top navigation strip */}
      <div
        className="absolute top-0 left-0 right-0 z-20 px-4 py-3 flex items-center justify-between shadow-xl"
        style={{ background: 'var(--forest)', borderBottom: '3px solid var(--ochre)' }}
      >
        <div className="flex items-center gap-3">
          {bearing !== null && (
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{ transform: `rotate(${bearing}deg)` }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--ochre)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
            </div>
          )}
          <div>
            <p
              className="text-xs"
              style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.14em', color: 'var(--moss)' }}
            >
              NAVIGATING TO
            </p>
            <p
              className="font-bold leading-tight truncate max-w-[200px]"
              style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', color: 'var(--paper)' }}
            >
              {tripName}
            </p>
          </div>
        </div>
        <button
          onClick={onExit}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.1em', background: 'var(--forest-2)', color: 'var(--paper)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--ochre)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--forest-2)')}
        >
          EXIT
        </button>
      </div>

      {/* Stats card */}
      <div className="absolute left-3 right-3 z-20 pointer-events-auto" style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            label="To trailhead"
            value={distToTrailhead != null ? `${distToTrailhead.toFixed(1)} km` : '—'}
            sub={userLocation ? `±${Math.round(userLocation.accuracy)}m` : 'Waiting for GPS'}
          />
          <StatTile
            label="Route"
            value={totalRouteKm != null ? `${totalRouteKm.toFixed(1)} km` : nearestStop === undefined ? 'Loading…' : '—'}
            sub={
              activeTrip.customWaypoints?.length ? `${activeTrip.customWaypoints.length} waypoints` :
              activeTrip.trail?.length_km ? activeTrip.trail.name ?? 'trail' :
              nearestStop ? `from ${nearestStop.stop.name}` : undefined
            }
          />
          <StatTile
            label="Est. hike"
            value={etaMinutes != null ? `${Math.floor(etaMinutes / 60)}h ${Math.round(etaMinutes % 60)}m` : '—'}
            sub="Naismith's rule"
          />
          {trainTile ? (
            <StatTile
              label={trainTile.label}
              value={trainTile.value}
              sub={activeTrip.chosenDepartureTime}
              accent={trainTile.accent}
            />
          ) : (
            <StatTile
              label="Train"
              value="—"
              sub="No departure saved"
            />
          )}
        </div>
      </div>
    </>
  )
}
