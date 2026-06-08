import { useState } from 'react'
import type { SavedTrip, SharedTripPayload } from '../types'
import { BottomSheet, useSheet } from './BottomSheet'

interface Props {
  trips: SavedTrip[]
  onLoad: (trip: SavedTrip) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function Content({ trips, onLoad, onDelete }: Omit<Props, 'onClose'>) {
  const { closeSheet } = useSheet()
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
    <>
      {/* Header */}
      <div
        className="flex-none px-4 pt-3 pb-4 flex items-center justify-between rounded-t-2xl"
        style={{ background: 'var(--forest)', borderBottom: '3px solid var(--ochre)' }}
      >
        <div className="flex-1">
          <div className="md:hidden flex justify-center mb-2.5">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
          </div>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '1rem', color: 'var(--paper)', letterSpacing: '0.06em' }}>
            SAVED TRIPS
          </h2>
        </div>
        <button
          onClick={closeSheet}
          className="w-8 h-8 flex items-center justify-center rounded-lg flex-none"
          style={{ background: 'var(--forest-2)', color: 'var(--sand)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-2" data-vaul-no-drag>
        {trips.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--fog)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4">
              <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            <p className="font-medium mb-1" style={{ fontFamily: 'Oswald, sans-serif', color: 'var(--sand)', letterSpacing: '0.06em' }}>
              NO SAVED TRIPS YET
            </p>
            <p className="text-sm" style={{ color: 'var(--sand)', fontStyle: 'italic' }}>
              Plan a trip, select a departure, and save it here.
            </p>
          </div>
        ) : (
          trips.slice().reverse().map(trip => {
            const name = trip.campsite?.asset_desc ?? trip.campsite?.name ?? `Campsite #${trip.campsiteId}`
            const date = new Date(trip.date + 'T12:00:00').toLocaleDateString('en-AU', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            })
            return (
              <div
                key={trip.id}
                className="rounded-xl p-3 flex items-start gap-3"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)' }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold truncate"
                    style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.9rem', color: 'var(--ink)', letterSpacing: '0.02em' }}
                  >
                    {name}
                  </p>
                  <p
                    className="mt-0.5"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--sand)' }}
                  >
                    {date}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {trip.chosenDepartureTime && (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em', background: 'var(--forest)', color: 'var(--paper)' }}
                      >
                        DEPARTS {trip.chosenDepartureTime}
                      </span>
                    )}
                    {trip.trailheadStopName && (
                      <span
                        className="text-xs px-2 py-0.5 rounded truncate max-w-[150px]"
                        style={{ fontFamily: 'JetBrains Mono, monospace', background: 'var(--paper)', color: 'var(--sand)', border: '1px solid var(--fog)' }}
                      >
                        → {trip.trailheadStopName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-none">
                  <button
                    onClick={() => onLoad(trip)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'var(--ochre)', color: '#fff', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--ochre-lt)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--ochre)')}
                  >
                    GO
                  </button>
                  {trip.trailheadStopId && trip.chosenArrivalTime && trip.campsite && (
                    <button
                      onClick={() => handleShare(trip)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      style={{ background: 'var(--forest)', color: 'var(--paper)', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--forest-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--forest)')}
                    >
                      {copiedId === trip.id ? '✓' : 'SHARE'}
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(trip.id)}
                    className="text-xs text-center transition-colors"
                    style={{ color: 'var(--sand)', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#8b2020')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--sand)')}
                  >
                    DEL
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

export default function SavedTripsPanel({ trips, onLoad, onDelete, onClose }: Props) {
  return (
    <BottomSheet
      onClose={onClose}
      desktopClassName="panel-bottom absolute left-0 right-0 z-20 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden md:left-auto md:right-4 md:w-96 md:rounded-2xl md:max-h-[72vh]"
    >
      <Content trips={trips} onLoad={onLoad} onDelete={onDelete} />
    </BottomSheet>
  )
}
