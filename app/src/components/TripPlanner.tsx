import { useState, useEffect } from 'react'
import type { Campsite, Trail, Profile, CustomWaypoint, SavedTrip } from '../types'
import { getSunset, formatTime } from '../hooks/useSunset'
import { naismithMinutes, arrivalDeadline } from '../lib/naismith'
import { useGTFSDepartures, useNearestStop } from '../hooks/useGTFS'
import type { Departure } from '../lib/gtfs'
import PTResults from './PTResults'

interface Props {
  campsite: Campsite
  trail: Trail | null
  profile: Profile | null
  customWaypoints: CustomWaypoint[]
  customRouteKm: number
  onClose: () => void
  onSetHomeStop: () => void
  onStartDrawing: () => void
  onSaveTrip: (base: Omit<SavedTrip, 'id' | 'savedAt'>) => void
}

function dateToGTFS(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

function deadlineToHHMM(deadline: Date): string {
  return `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`
}

export default function TripPlanner({ campsite, trail, profile, customWaypoints, customRouteKm, onClose, onSetHomeStop, onStartDrawing, onSaveTrip }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [selectedDeparture, setSelectedDeparture] = useState<Departure | null>(null)
  const { departures, loading, error, fetchDepartures } = useGTFSDepartures()

  const effectiveKm = trail ? trail.length_km : (customWaypoints.length > 1 ? customRouteKm : 0)
  const effectiveElevation = trail?.elevation_gain_m

  const selectedDate = new Date(date + 'T12:00:00')
  const sunset = getSunset(campsite.lat, campsite.lng, selectedDate)
  const hikingMins = effectiveKm > 0 ? naismithMinutes(effectiveKm, effectiveElevation) : 0
  const deadline = effectiveKm > 0 ? arrivalDeadline(sunset.getTime(), effectiveKm, effectiveElevation) : sunset

  const sunsetStr = formatTime(sunset)
  const deadlineStr = formatTime(deadline)
  const hikingHrs = Math.floor(hikingMins / 60)
  const hikingMinsRem = Math.round(hikingMins % 60)

  const handleSaveTrip = () => {
    if (!selectedDeparture) return
    onSaveTrip({
      campsiteId: campsite.id,
      trailId: trail?.id ?? null,
      date,
      customWaypoints,
      chosenDepartureTime: selectedDeparture.departureTime,
      chosenArrivalTime: selectedDeparture.arrivalTime,
      trailheadStopName: nearestResult?.stop.name,
      trailheadStopId: nearestResult?.stop.id,
      campsite,
      trail,
    })
  }

  // Auto-detect nearest V/Line stop to campsite
  const nearestResult = useNearestStop(campsite.lat, campsite.lng)

  useEffect(() => {
    if (!profile || !nearestResult) return
    fetchDepartures(
      profile.homeStopId,
      nearestResult.stop.id,
      dateToGTFS(date),
      deadlineToHHMM(deadline)
    )
  }, [date, profile, nearestResult, deadline]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 md:inset-auto md:right-4 md:bottom-4 md:w-[420px] md:top-16 z-20 bg-white rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 flex-none">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-base truncate">Plan trip to {campsite.asset_desc || campsite.name}</h2>
          <p className="text-xs text-emerald-700">{campsite.park_name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Date picker */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
            Departure date
          </label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Sunset + timing */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Timing for {new Date(date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white rounded-lg p-2.5 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Sunset</p>
              <p className="font-bold text-amber-600">{sunsetStr}</p>
            </div>
            <div className="bg-white rounded-lg p-2.5 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">Hike time</p>
              <p className="font-bold text-gray-700">
                {effectiveKm > 0 ? `${hikingHrs}h ${hikingMinsRem}m` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2.5 shadow-sm border-2 border-emerald-200">
              <p className="text-xs text-gray-400 mb-1">Arrive by</p>
              <p className="font-bold text-emerald-700">{deadlineStr}</p>
            </div>
          </div>
          {trail ? (
            <p className="text-xs text-gray-400 text-center">
              Based on {trail.length_km}km trail · Naismith's Rule · 30min safety buffer
            </p>
          ) : customWaypoints.length > 1 ? (
            <p className="text-xs text-indigo-600 text-center">
              Custom route · {customRouteKm.toFixed(1)}km · Naismith's Rule · 30min safety buffer
            </p>
          ) : (
            <p className="text-xs text-amber-600 text-center">
              Select a trail on the map or draw a custom route for hiking time estimates
            </p>
          )}

          {/* Draw route button */}
          {!trail && (
            <button
              onClick={onStartDrawing}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2.5 transition-colors"
            >
              <span>📍</span>
              <span>
                {customWaypoints.length > 1
                  ? `Edit custom route (${customRouteKm.toFixed(1)} km)`
                  : 'Draw custom route on map'}
              </span>
            </button>
          )}
        </div>

        {/* Nearest stop info */}
        {nearestResult === undefined && (
          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">Finding nearest V/Line stop…</div>
        )}
        {nearestResult && (
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <span>🚉</span>
            <span>Nearest V/Line stop: <strong className="text-gray-700">{nearestResult.stop.name}</strong> ({nearestResult.distanceKm} km away)</span>
          </div>
        )}
        {nearestResult === null && (
          <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            No V/Line stop within 30 km of this campsite.
          </div>
        )}

        {/* PT section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">V/Line services from your station</h3>

          {!profile ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center">
              <p className="text-sm text-gray-500 mb-3">Set your home V/Line station to see timetables</p>
              <button
                onClick={onSetHomeStop}
                className="bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-800"
              >
                Set home station
              </button>
            </div>
          ) : nearestResult == null ? null : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">
                  From: <span className="font-medium text-gray-700">{profile.homeStopName}</span>
                </p>
                <button onClick={onSetHomeStop} className="text-xs text-emerald-700 underline">Change</button>
              </div>
              <PTResults
                departures={departures}
                loading={loading}
                error={error}
                deadlineTime={deadlineStr}
                sunsetTime={sunsetStr}
                trailheadStopName={nearestResult.stop.name}
                selectedDeparture={selectedDeparture}
                onSelectDeparture={setSelectedDeparture}
              />
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-4 space-y-2 pb-20 md:pb-4">
        <button
          onClick={handleSaveTrip}
          disabled={!selectedDeparture}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <span>💾</span>
          <span>{selectedDeparture ? 'Save trip' : 'Select a departure above to save'}</span>
        </button>
        <a
          href="https://www.ptv.vic.gov.au/journey"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl text-sm transition-colors"
        >
          Plan full journey on PTV ↗
        </a>
      </div>
    </div>
  )
}
