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
    <div
      className="absolute inset-0 z-30 flex flex-col overflow-hidden md:inset-auto md:right-4 md:bottom-4 md:w-[420px] md:top-16 md:rounded-2xl md:shadow-2xl"
      style={{ background: 'var(--paper)', color: 'var(--ink)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-4 flex items-center gap-3 flex-none"
        style={{ background: 'var(--forest)', borderBottom: '3px solid var(--ochre)' }}
      >
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '0.16em', color: 'var(--ochre)', textTransform: 'uppercase' }}>
            You've been invited to hike!
          </p>
          <h2
            className="font-bold truncate"
            style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', color: 'var(--paper)' }}
          >
            {payload.campsiteName}
          </h2>
          {payload.trailName && (
            <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.08em', color: 'var(--moss)', textTransform: 'uppercase' }}>
              {payload.trailName}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg flex-none"
          style={{ background: 'var(--forest-2)', color: 'var(--sand)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
        {/* Date */}
        <div className="flex items-center gap-2" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--sand)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          {dateDisplay}
        </div>

        {/* Meetup callout */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--paper-2)', border: '2px solid var(--moss)' }}
        >
          <p
            className="text-xs mb-1"
            style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.14em', color: 'var(--moss)', textTransform: 'uppercase' }}
          >
            Suggested meetup point
          </p>
          <p
            style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1.2rem', color: 'var(--ink)' }}
          >
            {payload.meetupStopName}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--earth)' }}>
            Be at the station by{' '}
            <strong style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: 'var(--forest)', fontSize: '1rem' }}>
              {payload.meetupTime}
            </strong>
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--sand)', fontStyle: 'italic' }}>You'll start hiking together from here</p>
        </div>

        {/* Auto-saved */}
        <div
          className="rounded-xl px-3 py-2 text-xs flex items-center gap-2"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)', color: 'var(--sand)', fontFamily: 'JetBrains Mono, monospace' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          Trip saved to your saved trips
        </div>

        {/* Your home station */}
        <div>
          <p
            className="mb-2"
            style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.14em', color: 'var(--sand)', textTransform: 'uppercase' }}
          >
            Your home station
          </p>

          {friendStop ? (
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{friendStop.name}</span>
              <button
                onClick={() => { setFriendStop(null); setStopQuery(''); clear() }}
                style={{ fontSize: '0.7rem', color: 'var(--moss)', textDecoration: 'underline', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}
              >
                CHANGE
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
                className="w-full px-4 py-3 text-sm focus:outline-none rounded-xl"
                style={{
                  background: 'var(--paper-2)',
                  border: '1.5px solid var(--fog)',
                  color: 'var(--ink)',
                  fontFamily: 'Lora, Georgia, serif',
                }}
                autoFocus
              />
              {results.length > 0 && (
                <ul className="mt-1 rounded-xl overflow-hidden max-h-44 overflow-y-auto" style={{ border: '1.5px solid var(--fog)' }}>
                  {results.map(stop => (
                    <li key={stop.id} style={{ borderBottom: '1px solid var(--fog)' }}>
                      <button
                        onClick={() => { setFriendStop(stop); setStopQuery(''); clear() }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
                        style={{ background: 'var(--paper-2)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                      >
                        <span className="text-sm font-medium" style={{ color: 'var(--ink)', fontFamily: 'Lora, Georgia, serif' }}>{stop.name}</span>
                        <span
                          className="text-xs ml-2 px-1.5 py-0.5 rounded"
                          style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', background: '#6B2D8B', color: 'var(--paper)' }}
                        >
                          V/LINE
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Departures */}
        {friendStop && (
          <div>
            <p
              className="mb-3"
              style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.14em', color: 'var(--sand)', textTransform: 'uppercase' }}
            >
              Your trains to {payload.meetupStopName}
            </p>
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
