import { memo, useState, useEffect } from 'react'
import type { Campsite, Trail, Profile, CustomWaypoint, SavedTrip } from '../types'
import { getSunset, formatTime } from '../hooks/useSunset'
import { naismithMinutes, arrivalDeadline } from '../lib/naismith'
import { useGTFSDepartures, useNearestStop } from '../hooks/useGTFS'
import type { Departure } from '../lib/gtfs'
import PTResults from './PTResults'
import { BottomSheet } from './BottomSheet'

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

function TripPlanner({ campsite, trail, profile, customWaypoints, customRouteKm, onClose, onSetHomeStop, onStartDrawing, onSaveTrip }: Props) {
  const _d = new Date()
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`
  const [date, setDate] = useState(today)
  const [selectedDeparture, setSelectedDeparture] = useState<Departure | null>(null)
  const { departures, loading, error, fetchDepartures } = useGTFSDepartures()

  const nearestResult = useNearestStop(campsite.lat, campsite.lng)

  const effectiveKm = customWaypoints.length > 1
    ? customRouteKm
    : (nearestResult?.distanceKm ?? 0)
  const effectiveElevation = customWaypoints.length > 1 ? trail?.elevation_gain_m : undefined

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

  const deadlineHHMM = deadlineToHHMM(deadline)

  useEffect(() => {
    if (!profile || !nearestResult) return
    fetchDepartures(
      profile.homeStopId,
      nearestResult.stop.id,
      dateToGTFS(date),
      deadlineHHMM,
      profile.homeNetwork ?? 'vline',
      nearestResult.network,
      nearestResult.stop.name,
      nearestResult.metroLine ?? ''
    )
  }, [date, profile, nearestResult, deadlineHHMM]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <BottomSheet
      onClose={onClose}
      snapPoints={[0.15, 0.88]}
      desktopClassName="absolute md:inset-auto md:right-4 md:bottom-4 md:w-[420px] md:top-16 z-20 flex flex-col overflow-hidden md:rounded-2xl shadow-2xl"
    >
      {/* Header */}
      <div
        className="flex-none"
        style={{ background: 'var(--forest)', borderBottom: '3px solid var(--ochre)' }}
      >
        {/* drag handle pip — mobile only */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg flex-none transition-colors"
          style={{ background: 'var(--forest-2)', color: 'var(--sand)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--paper)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--sand)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '0.16em', color: 'var(--moss)', textTransform: 'uppercase' }}>
            Planning trip to
          </p>
          <h2
            className="leading-tight truncate"
            style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '1rem', color: 'var(--paper)' }}
          >
            {campsite.asset_desc || campsite.name}
          </h2>
          <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--ochre)' }}>
            {campsite.park_name}
          </p>
        </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-5" data-vaul-no-drag>
        {/* Date picker */}
        <div>
          <label
            className="block mb-2"
            style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.14em', color: 'var(--sand)', textTransform: 'uppercase' }}
          >
            Departure date
          </label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 text-sm focus:outline-none rounded-xl"
            style={{
              background: 'var(--paper-2)',
              border: '1.5px solid var(--fog)',
              color: 'var(--ink)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>

        {/* Sunset + timing card */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)' }}
        >
          <p
            style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.14em', color: 'var(--sand)', textTransform: 'uppercase' }}
          >
            Timing · {new Date(date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-lg p-2.5" style={{ background: 'var(--paper)', border: '1px solid var(--fog)' }}>
              <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--sand)' }}>SUNSET</p>
              <p style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--ochre)' }}>{sunsetStr}</p>
            </div>
            <div className="rounded-lg p-2.5" style={{ background: 'var(--paper)', border: '1px solid var(--fog)' }}>
              <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--sand)' }}>HIKE</p>
              <p style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>
                {effectiveKm > 0 ? `${hikingHrs}h ${hikingMinsRem}m` : '—'}
              </p>
            </div>
            <div className="rounded-lg p-2.5" style={{ background: 'var(--paper)', border: '2px solid var(--moss)' }}>
              <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--sand)' }}>ARRIVE BY</p>
              <p style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--forest)' }}>{deadlineStr}</p>
            </div>
          </div>

          {customWaypoints.length > 1 ? (
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--moss)', textAlign: 'center' }}>
              Custom route · {customRouteKm.toFixed(1)}km · Naismith + 30min buffer
            </p>
          ) : nearestResult ? (
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--sand)', textAlign: 'center' }}>
              {nearestResult.distanceKm}km from {nearestResult.stop.name}
              {nearestResult.network === 'metro' && nearestResult.metroLine ? ` · Metro ${nearestResult.metroLine}` : ''}
              {' '}· Naismith + 30min buffer
            </p>
          ) : (
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--sand)', textAlign: 'center' }}>
              Finding nearest station…
            </p>
          )}

          <button
            onClick={onStartDrawing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors"
            style={{
              background: 'var(--paper)',
              border: '1.5px solid var(--fog)',
              color: 'var(--forest)',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--moss)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--fog)')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {customWaypoints.length > 1
              ? `EDIT ROUTE (${customRouteKm.toFixed(1)} KM)`
              : 'DRAW A CUSTOM ROUTE'}
          </button>
        </div>

        {/* Nearest stop */}
        {nearestResult === undefined && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--paper-2)', color: 'var(--sand)', fontFamily: 'JetBrains Mono, monospace' }}>
            Finding nearest V/Line stop…
          </div>
        )}
        {nearestResult && (
          <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2.5" style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="13" rx="2"/><path d="M4 13h16M8 18l-2 3M16 18l2 3M12 16v5"/>
            </svg>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--sand)', flex: 1 }}>
              Nearest: <strong style={{ color: 'var(--ink)' }}>{nearestResult.stop.name}</strong> · {nearestResult.distanceKm} km
            </span>
            <span
              className="flex-none text-xs px-2 py-0.5 rounded"
              style={{
                fontFamily: 'Oswald, sans-serif',
                letterSpacing: '0.08em',
                fontSize: '0.65rem',
                background: nearestResult.network === 'metro' ? '#005C8B' : '#6B2D8B',
                color: '#fff',
              }}
            >
              {nearestResult.network === 'metro' ? 'METRO' : 'V/LINE'}
            </span>
          </div>
        )}
        {nearestResult === null && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(139,32,32,0.1)', border: '1px solid rgba(139,32,32,0.3)', color: '#8b2020', fontFamily: 'JetBrains Mono, monospace' }}>
            No V/Line stop within 30 km of this campsite.
          </div>
        )}

        {/* PT section */}
        <div>
          <p className="mb-3" style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.14em', color: 'var(--sand)', textTransform: 'uppercase' }}>
            Transit services from your station
          </p>

          {!profile ? (
            <div
              className="rounded-xl p-4 text-center"
              style={{ border: '1.5px dashed var(--fog)', background: 'var(--paper-2)' }}
            >
              <p className="text-sm mb-3" style={{ color: 'var(--sand)', fontStyle: 'italic' }}>Set your home V/Line station to see timetables</p>
              <button
                onClick={onSetHomeStop}
                className="text-sm px-4 py-2 rounded-lg transition-colors"
                style={{ background: 'var(--forest)', color: 'var(--paper)', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.1em' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--forest-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--forest)')}
              >
                SET HOME STATION
              </button>
            </div>
          ) : nearestResult == null ? null : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--sand)' }}>
                  From: <span style={{ color: 'var(--ink)' }}>{profile.homeStopName}</span>
                </p>
                <button
                  onClick={onSetHomeStop}
                  style={{ fontSize: '0.7rem', color: 'var(--moss)', textDecoration: 'underline', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}
                >
                  CHANGE
                </button>
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

          {/* PTV link — in scroll body so it's never clipped */}
          <a
            href="https://www.ptv.vic.gov.au/journey"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 rounded-xl text-sm"
            style={{
              background: 'var(--paper-2)',
              color: 'var(--earth)',
              fontFamily: 'Oswald, sans-serif',
              letterSpacing: '0.08em',
              border: '1px solid var(--fog)',
            }}
          >
            PLAN FULL JOURNEY ON PTV ↗
          </a>
        </div>
      </div>

      {/* Desktop-only footer */}
      <div
        className="hidden md:block p-4 flex-none"
        style={{ background: 'var(--paper)', borderTop: '1px solid var(--fog)', paddingBottom: '1rem' }}
      >
        <button
          onClick={handleSaveTrip}
          disabled={!selectedDeparture}
          className="w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
          style={{
            background: selectedDeparture ? 'var(--forest)' : 'var(--paper-2)',
            color: selectedDeparture ? 'var(--paper)' : 'var(--sand)',
            fontFamily: 'Oswald, sans-serif',
            letterSpacing: '0.1em',
            fontWeight: 600,
            border: selectedDeparture ? 'none' : '1px solid var(--fog)',
          }}
        >
          {selectedDeparture ? 'SAVE TRIP' : 'SELECT A DEPARTURE TO SAVE'}
        </button>
      </div>
    </BottomSheet>
    {/* Mobile-only: fixed outside the transformed drawer so it stays above Safari chrome */}
    <div
      className="md:hidden absolute left-0 right-0 z-30 px-4"
      style={{ top: '3.75rem' }}
    >
      <button
        onClick={handleSaveTrip}
        disabled={!selectedDeparture}
        className="w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2"
        style={{
          background: selectedDeparture ? 'var(--forest)' : 'var(--paper-2)',
          color: selectedDeparture ? 'var(--paper)' : 'var(--sand)',
          fontFamily: 'Oswald, sans-serif',
          letterSpacing: '0.1em',
          fontWeight: 600,
          border: selectedDeparture ? 'none' : '1px solid var(--fog)',
          boxShadow: selectedDeparture ? '0 4px 16px rgba(0,0,0,0.35)' : 'none',
        }}
      >
        {selectedDeparture ? 'SAVE TRIP' : 'SELECT A DEPARTURE TO SAVE'}
      </button>
    </div>
    </>
  )
}

export default memo(TripPlanner)
