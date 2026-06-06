import { useState, useEffect } from 'react'
import type { SharedTripPayload } from '../types'
import { useGTFSStopSearch, useFriendDepartures } from '../hooks/useGTFS'
import PTResults from './PTResults'

interface Props {
  payload: SharedTripPayload
  onClose: () => void
}

function dateToGTFS(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

export default function SharedTripView({ payload, onClose }: Props) {
  const [friendStop, setFriendStop] = useState<{ id: string; name: string } | null>(null)
  const [stopQuery, setStopQuery] = useState('')
  const { results, search, clear, ready } = useGTFSStopSearch()
  const { departures, loading, error, fetchDepartures } = useFriendDepartures()

  const dateDisplay = new Date(payload.date + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  useEffect(() => {
    const t = setTimeout(() => {
      if (stopQuery.length >= 2) search(stopQuery)
      else clear()
    }, 300)
    return () => clearTimeout(t)
  }, [stopQuery, search, clear])

  useEffect(() => {
    if (!friendStop) return
    fetchDepartures(friendStop.id, payload.meetupStopId, dateToGTFS(payload.date), payload.meetupTime)
  }, [friendStop, payload.meetupStopId, payload.date, payload.meetupTime, fetchDepartures])

  return (
    <div className="absolute inset-0 z-30 bg-white flex flex-col overflow-hidden md:inset-auto md:right-4 md:bottom-4 md:w-[420px] md:top-16 md:rounded-2xl md:shadow-2xl">
      {/* Header */}
      <div className="px-4 py-4 border-b border-emerald-600 flex items-center gap-3 bg-emerald-700 text-white flex-none">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-emerald-200">You've been invited to hike!</p>
          <h2 className="font-bold text-base truncate">{payload.campsiteName}</h2>
          {payload.trailName && (
            <p className="text-xs text-emerald-200 truncate">{payload.trailName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-emerald-600 text-emerald-200 flex-none"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>📅</span>
          <span>{dateDisplay}</span>
        </div>

        {/* Meetup callout */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Suggested meetup point</p>
          <p className="font-bold text-gray-900 text-lg">{payload.meetupStopName}</p>
          <p className="text-sm text-gray-600 mt-1">
            Be at the station by <strong className="text-emerald-700">{payload.meetupTime}</strong>
          </p>
          <p className="text-xs text-gray-400 mt-1">You'll both start hiking together from here</p>
        </div>

        {/* Auto-saved banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
          <span>💾</span>
          <span>This trip has been added to your saved trips.</span>
        </div>

        {/* Friend's home station */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Your home station
          </h3>

          {friendStop ? (
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
              <span className="text-sm font-medium text-gray-800">🏠 {friendStop.name}</span>
              <button
                onClick={() => { setFriendStop(null); setStopQuery(''); clear() }}
                className="text-xs text-emerald-700 underline"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={stopQuery}
                onChange={e => setStopQuery(e.target.value)}
                placeholder={ready ? 'e.g. Flinders Street, Ballarat…' : 'Loading timetable data…'}
                disabled={!ready}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400"
                autoFocus
              />
              {results.length > 0 && (
                <ul className="mt-1 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-44 overflow-y-auto">
                  {results.map(stop => (
                    <li key={stop.id}>
                      <button
                        onClick={() => { setFriendStop(stop); setStopQuery(''); clear() }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-emerald-50 text-left"
                      >
                        <span className="text-sm font-medium text-gray-900">{stop.name}</span>
                        <span className="text-xs text-gray-400">V/Line</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Friend's departures */}
        {friendStop && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Your trains to {payload.meetupStopName}
            </h3>
            <PTResults
              departures={departures}
              loading={loading}
              error={error}
              deadlineTime={payload.meetupTime}
              deadlineLabel="Meet by"
              trailheadStopName={payload.meetupStopName}
            />
          </div>
        )}
      </div>
    </div>
  )
}
