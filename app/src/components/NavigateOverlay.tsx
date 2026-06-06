import { useEffect, useState, useMemo } from 'react'
import type { SavedTrip, UserLocation } from '../types'
import { haversineKm, bearingDeg, routeLengthKm } from '../lib/geo'
import { naismithMinutes } from '../lib/naismith'

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
    <div className={`rounded-2xl p-3 ${accent ? 'bg-indigo-600 text-white' : 'bg-white/90 text-gray-800'}`}>
      <p className={`text-xs mb-1 ${accent ? 'text-indigo-200' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-xl font-bold leading-tight ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-indigo-200' : 'text-gray-400'}`}>{sub}</p>}
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

  const totalRouteKm = useMemo(() => {
    if (activeTrip.customWaypoints && activeTrip.customWaypoints.length > 1) {
      return routeLengthKm(activeTrip.customWaypoints)
    }
    return activeTrip.trail?.length_km ?? null
  }, [activeTrip])

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

  const trainCountdown = useMemo(() => {
    if (!activeTrip.chosenDepartureTime) return null
    const [h, m] = activeTrip.chosenDepartureTime.split(':').map(Number)
    const dep = new Date()
    dep.setHours(h, m, 0, 0)
    const ms = dep.getTime() - now
    if (ms < -60000) return 'Departed'
    return formatCountdown(ms)
  }, [activeTrip.chosenDepartureTime, now])

  return (
    <>
      {/* Top strip */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          {bearing !== null && (
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{ transform: `rotate(${bearing}deg)` }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                <path d="M12 2l-4 18 4-3 4 3z"/>
              </svg>
            </div>
          )}
          <div>
            <p className="text-xs text-indigo-200">Navigating to</p>
            <p className="font-bold text-sm leading-tight truncate max-w-[200px]">{tripName}</p>
          </div>
        </div>
        <button
          onClick={onExit}
          className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          Exit
        </button>
      </div>

      {/* Stats card */}
      <div className="absolute bottom-20 left-3 right-3 z-20 pointer-events-auto">
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="To trailhead"
            value={distToTrailhead != null ? `${distToTrailhead.toFixed(1)} km` : '—'}
            sub={userLocation ? `±${Math.round(userLocation.accuracy)}m accuracy` : 'Waiting for GPS…'}
          />
          <StatTile
            label="Route length"
            value={totalRouteKm != null ? `${totalRouteKm.toFixed(1)} km` : '—'}
            sub={activeTrip.customWaypoints?.length ? `${activeTrip.customWaypoints.length} waypoints` : undefined}
          />
          <StatTile
            label="Est. hike time"
            value={etaMinutes != null ? `${Math.floor(etaMinutes / 60)}h ${Math.round(etaMinutes % 60)}m` : '—'}
            sub="Naismith's rule"
          />
          {trainCountdown ? (
            <StatTile
              label="Train departs"
              value={trainCountdown}
              sub={activeTrip.chosenDepartureTime}
              accent={trainCountdown !== 'Departed'}
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
