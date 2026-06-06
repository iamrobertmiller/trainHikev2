import { useState } from 'react'
import type { SavedTrip, SharedTripPayload } from '../types'

interface Props {
  trips: SavedTrip[]
  onLoad: (trip: SavedTrip) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function SavedTripsPanel({ trips, onLoad, onDelete, onClose }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleShare = async (trip: SavedTrip) => {
    if (!trip.trailheadStopId || !trip.chosenArrivalTime || !trip.campsite) return
    const payload: SharedTripPayload = {
      campsiteId: trip.campsiteId,
      campsiteName: trip.campsite.asset_desc ?? trip.campsite.name,
      campsiteLat: trip.campsite.lat,
      campsiteLng: trip.campsite.lng,
      campsiteParkName: trip.campsite.park_name,
      trailName: trip.trail?.name,
      date: trip.date,
      meetupStopName: trip.trailheadStopName!,
      meetupStopId: trip.trailheadStopId,
      meetupTime: trip.chosenArrivalTime,
    }
    const encoded = encodeURIComponent(JSON.stringify(payload))
    const url = `${window.location.origin}${window.location.pathname}?shared=${encoded}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'TrainHike trip', text: `Join me hiking to ${payload.campsiteName}!`, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopiedId(trip.id)
        setTimeout(() => setCopiedId(null), 2500)
      }
    } catch {
      // user cancelled share or clipboard failed
    }
  }
  return (
    <div className="absolute bottom-16 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col md:left-auto md:right-4 md:bottom-20 md:w-96 md:rounded-2xl">
      {/* Header */}
      <div className="sticky top-0 bg-white px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
        <h2 className="font-bold text-gray-900 text-base">Saved trips</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
        >
          ✕
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-3 space-y-2">
        {trips.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-3xl mb-3">🗺️</p>
            <p className="font-medium text-gray-700 mb-1">No saved trips yet</p>
            <p className="text-sm text-gray-400">Plan a trip, select a departure, and tap Save to save it here.</p>
          </div>
        ) : (
          trips.slice().reverse().map(trip => {
            const name = trip.campsite?.asset_desc ?? trip.campsite?.name ?? `Campsite #${trip.campsiteId}`
            const date = new Date(trip.date + 'T12:00:00').toLocaleDateString('en-AU', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            })
            return (
              <div key={trip.id} className="bg-gray-50 rounded-2xl p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{date}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {trip.chosenDepartureTime && (
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        🚆 {trip.chosenDepartureTime}
                      </span>
                    )}
                    {trip.trailheadStopName && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                        → {trip.trailheadStopName}
                      </span>
                    )}
                    {(trip.customWaypoints?.length ?? 0) > 0 && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        📍 {trip.customWaypoints!.length} waypoints
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-none">
                  <button
                    onClick={() => onLoad(trip)}
                    className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl transition-colors"
                  >
                    Navigate
                  </button>
                  {trip.trailheadStopId && trip.chosenArrivalTime && trip.campsite && (
                    <button
                      onClick={() => handleShare(trip)}
                      className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition-colors"
                    >
                      {copiedId === trip.id ? '✓ Copied!' : '🔗 Share'}
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(trip.id)}
                    className="text-xs text-gray-400 hover:text-red-500 text-center transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
