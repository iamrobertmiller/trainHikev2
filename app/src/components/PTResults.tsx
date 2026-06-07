import type { Departure } from '../lib/gtfs'

interface Props {
  departures: Departure[]
  loading: boolean
  error: string | null
  deadlineTime: string
  deadlineLabel?: string
  sunsetTime?: string
  trailheadStopName: string
  selectedDeparture?: Departure | null
  onSelectDeparture?: (dep: Departure) => void
}

const STATUS_CONFIG = {
  safe:  { border: 'var(--moss)',  badge: { bg: 'var(--forest)', color: 'var(--paper)' }, label: 'SAFE',     dot: 'var(--moss)' },
  tight: { border: 'var(--ochre)', badge: { bg: 'var(--ochre)',  color: '#fff'          }, label: 'TIGHT',    dot: 'var(--ochre)' },
  risky: { border: '#8b2020',      badge: { bg: '#8b2020',       color: '#fff'          }, label: 'TOO LATE', dot: '#8b2020' },
}

function parseMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function layoverLabel(arrive: string, depart: string): string {
  const diff = parseMinutes(depart) - parseMinutes(arrive)
  if (diff <= 0) return ''
  if (diff < 60) return `${diff}m wait`
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return m > 0 ? `${h}h ${m}m wait` : `${h}h wait`
}

export default function PTResults({
  departures, loading, error, deadlineTime, deadlineLabel = 'Arrive by',
  sunsetTime, trailheadStopName, selectedDeparture, onSelectDeparture,
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-3" style={{ color: 'var(--sand)' }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--moss)', borderTopColor: 'transparent' }} />
        <span className="text-sm" style={{ fontStyle: 'italic' }}>Checking timetables…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'rgba(192,124,40,0.1)', border: '1px solid var(--ochre)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--earth)' }}>{error}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--sand)' }}>
          Try Southern Cross or Flinders Street, or check{' '}
          <a href="https://ptv.vic.gov.au" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--moss)', textDecoration: 'underline' }}>ptv.vic.gov.au</a>.
        </p>
      </div>
    )
  }

  if (departures.length === 0) {
    return (
      <div className="text-center py-6 text-sm" style={{ color: 'var(--sand)', fontStyle: 'italic' }}>
        No upcoming departures found for this date.
      </div>
    )
  }

  const safeOnes = departures.filter(d => d.safetyStatus === 'safe')
  const latest = safeOnes[safeOnes.length - 1]

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="rounded-xl p-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)' }}>
        <div className="text-xs mb-2" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--sand)' }}>
          Stop: <strong style={{ color: 'var(--ink)' }}>{trailheadStopName}</strong>
        </div>
        <div className="flex gap-5 flex-wrap">
          <div>
            <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--sand)' }}>
              {deadlineLabel.toUpperCase()}
            </p>
            <p style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--forest)' }}>
              {deadlineTime}
            </p>
          </div>
          {sunsetTime && (
            <div>
              <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--sand)' }}>SUNSET</p>
              <p style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--ochre)' }}>{sunsetTime}</p>
            </div>
          )}
          {latest && (
            <div className="ml-auto text-right">
              <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--sand)' }}>LATEST SAFE</p>
              <p style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--forest)' }}>{latest.departureTime}</p>
            </div>
          )}
        </div>
      </div>

      {/* Departure cards */}
      {departures.map((dep, i) => {
        const cfg = STATUS_CONFIG[dep.safetyStatus]
        const isSelected = selectedDeparture?.tripId === dep.tripId && selectedDeparture?.departureTime === dep.departureTime
        const bufferAbs = dep.minutesBuffer !== undefined ? Math.abs(dep.minutesBuffer) : undefined

        return (
          <div
            key={`${dep.tripId}-${i}`}
            className="rounded-xl overflow-hidden"
            style={{
              border: `1.5px solid ${isSelected ? cfg.border : 'var(--fog)'}`,
              outline: isSelected ? `2px solid ${cfg.border}` : 'none',
              outlineOffset: isSelected ? '1px' : '0',
              background: 'var(--paper-2)',
            }}
          >
            {/* Card header: departure time + status */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2.5" style={{ borderBottom: '1px solid var(--fog)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: cfg.dot }} />
                <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1.3rem', color: 'var(--ink)', letterSpacing: '0.02em' }}>
                  {dep.departureTime}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--sand)', marginTop: '2px' }}>
                  {dep.metroLeg ? 'METRO' : 'V/LINE'}
                </span>
              </div>
              <span
                className="text-xs px-2.5 py-1 rounded"
                style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.1em', fontWeight: 700, background: cfg.badge.bg, color: cfg.badge.color }}
              >
                {cfg.label}
              </span>
            </div>

            {/* Journey legs */}
            <div className="px-3 py-2.5 space-y-0">
              {/* Metro prefix leg */}
              {dep.metroLeg && (
                <div className="mb-2 pb-2" style={{ borderBottom: '1px dashed var(--fog)' }}>
                  <div className="flex items-center gap-2 py-0.5">
                    <div className="flex-none w-4 flex flex-col items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#005C8B' }} />
                      <div className="w-px flex-1 min-h-[10px]" style={{ background: 'var(--fog)' }} />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <span style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 500 }}>
                        Metro · {dep.metroLeg.lineName}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--sand)', flexShrink: 0 }}>
                        {dep.metroLeg.departureTime}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-0.5">
                    <div className="flex-none w-4 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full border-2" style={{ borderColor: '#005C8B', background: 'var(--paper-2)' }} />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <span style={{ fontSize: '0.85rem', color: 'var(--sand)', fontWeight: 500 }}>
                        Southern Cross
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--sand)', flexShrink: 0 }}>
                        arr {dep.metroLeg.arrivalSSX}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-0.5 mt-1">
                    <div className="flex-none w-4 flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="3" width="16" height="13" rx="2"/><path d="M4 13h16M8 18l-2 3M16 18l2 3M12 16v5"/>
                      </svg>
                    </div>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--moss)' }}>
                      BOARD V/LINE
                    </span>
                  </div>
                </div>
              )}
              {dep.transfer ? (
                <>
                  {/* Leg 1 */}
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-none w-4 flex flex-col items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--moss)' }} />
                      <div className="w-px flex-1 min-h-[10px]" style={{ background: 'var(--fog)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span style={{ fontSize: '0.95rem', color: 'var(--ink)', fontWeight: 500 }}>
                        To {dep.headsign}
                      </span>
                    </div>
                  </div>

                  {/* Transfer box */}
                  <div className="flex gap-2 py-1">
                    <div className="flex-none w-4 flex flex-col items-center">
                      <div className="w-px h-2" style={{ background: 'var(--fog)' }} />
                      <div className="w-3 h-3 rounded-full border-2 flex-none" style={{ borderColor: 'var(--ochre)', background: 'var(--paper-2)' }} />
                      <div className="w-px h-2" style={{ background: 'var(--fog)' }} />
                    </div>
                    <div
                      className="flex-1 rounded-lg px-2.5 py-2 my-0.5"
                      style={{ background: 'var(--paper)', border: '1px solid var(--fog)' }}
                    >
                      <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.72rem', letterSpacing: '0.1em', color: 'var(--sand)', marginBottom: '4px' }}>
                        CHANGE TRAINS
                      </p>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                        {dep.transfer.stopName}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="rounded px-2.5 py-1" style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)' }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--sand)' }}>ARR </span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink)' }}>
                            {dep.transfer.arriveTime}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--sand)' }}>
                          {layoverLabel(dep.transfer.arriveTime, dep.transfer.departTime)}
                        </div>
                        <div className="rounded px-2.5 py-1" style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)' }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--sand)' }}>DEP </span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink)' }}>
                            {dep.transfer.departTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Leg 2 */}
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-none w-4 flex flex-col items-center gap-0.5">
                      <div className="w-px h-2" style={{ background: 'var(--fog)' }} />
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--forest)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span style={{ fontSize: '0.95rem', color: 'var(--ink)', fontWeight: 500 }}>
                        To {dep.transfer.headsign}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* No transfer */
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-none w-4 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--forest)' }} />
                  </div>
                  <span style={{ fontSize: '0.95rem', color: 'var(--ink)', fontWeight: 500 }}>
                    To {dep.headsign}
                  </span>
                </div>
              )}
            </div>

            {/* Metro trailhead leg: SSX → Metro station */}
            {dep.metroTrailheadLeg && (
              <div className="mt-2 pt-2" style={{ borderTop: '1px dashed var(--fog)' }}>
                <div className="flex items-center gap-2 py-0.5">
                  <div className="flex-none w-4 flex flex-col items-center gap-0.5">
                    <div className="w-px h-2" style={{ background: 'var(--fog)' }} />
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#005C8B' }} />
                    <div className="w-px flex-1 min-h-[10px]" style={{ background: 'var(--fog)' }} />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 500 }}>
                      Metro · {dep.metroTrailheadLeg.lineName || 'Metro train'}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--sand)', flexShrink: 0 }}>
                      ~{dep.metroTrailheadLeg.estimatedMins}m
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <div className="flex-none w-4 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full border-2" style={{ borderColor: '#005C8B', background: 'var(--paper-2)' }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--sand)', fontWeight: 500 }}>
                    {dep.metroTrailheadLeg.trailheadName || 'Trailhead'}
                  </span>
                </div>
                <div className="flex items-center gap-2 py-0.5 mt-0.5">
                  <div className="flex-none w-4 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--moss)' }}>
                    ALIGHT FOR TRAILHEAD
                  </span>
                </div>
              </div>
            )}

            {/* Card footer: arrival + buffer + action */}
            <div
              className="flex items-center justify-between px-3 py-2.5"
              style={{ borderTop: '1px solid var(--fog)', background: 'var(--paper)' }}
            >
              <div>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--sand)' }}>
                  ARRIVE&nbsp;
                </span>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>
                  {dep.arrivalTime}
                </span>
                {bufferAbs !== undefined && (
                  <span
                    className="ml-2"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.75rem',
                      color: dep.minutesBuffer! > 0 ? 'var(--moss)' : '#8b2020',
                    }}
                  >
                    {dep.minutesBuffer! > 0 ? `+${bufferAbs}m margin` : `-${bufferAbs}m late`}
                  </span>
                )}
              </div>

              {onSelectDeparture && (
                <button
                  onClick={() => onSelectDeparture(dep)}
                  className="px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    fontFamily: 'Oswald, sans-serif',
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    background: isSelected ? 'var(--forest)' : 'var(--paper-2)',
                    color: isSelected ? 'var(--paper)' : 'var(--earth)',
                    border: isSelected ? 'none' : '1px solid var(--fog)',
                  }}
                >
                  {isSelected ? '✓ SELECTED' : 'USE'}
                </button>
              )}
            </div>
          </div>
        )
      })}

      <p className="text-xs text-center pt-1" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--sand)' }}>
        Timetable data from PTV · check{' '}
        <a href="https://ptv.vic.gov.au" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--moss)', textDecoration: 'underline' }}>ptv.vic.gov.au</a>
        {' '}for disruptions
      </p>
    </div>
  )
}
