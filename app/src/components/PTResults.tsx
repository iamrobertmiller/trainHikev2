import type { Departure } from '../lib/gtfs'

interface Props {
  departures: Departure[]
  loading: boolean
  error: string | null
  deadlineTime: string
  sunsetTime: string
  trailheadStopName: string
  selectedDeparture?: Departure | null
  onSelectDeparture?: (dep: Departure) => void
}

const STATUS_CONFIG = {
  safe:  { color: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', label: 'Safe',     icon: '✅' },
  tight: { color: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-100 text-amber-800',   label: 'Tight',    icon: '⚠️' },
  risky: { color: 'bg-red-50 border-red-200',       badge: 'bg-red-100 text-red-800',       label: 'Too late', icon: '🌑' },
}

export default function PTResults({ departures, loading, error, deadlineTime, sunsetTime, trailheadStopName, selectedDeparture, onSelectDeparture }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-3 text-gray-500">
        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Checking timetables…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-800 font-medium">{error}</p>
        <p className="text-xs text-amber-600 mt-1">
          Try setting your home stop to Southern Cross or Flinders Street, or check{' '}
          <a href="https://ptv.vic.gov.au" target="_blank" rel="noopener noreferrer" className="underline">ptv.vic.gov.au</a>.
        </p>
      </div>
    )
  }

  if (departures.length === 0) {
    return <div className="text-center py-6 text-gray-400 text-sm">No upcoming departures found for this date.</div>
  }

  const safeOnes = departures.filter(d => d.safetyStatus === 'safe')
  const latest = safeOnes[safeOnes.length - 1]

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="bg-emerald-50 rounded-xl p-3 text-sm">
        <div className="text-xs text-gray-500 mb-1">
          Trailhead stop: <strong className="text-gray-800">{trailheadStopName}</strong>
        </div>
        <div className="flex gap-4">
          <div>
            <span className="text-xs text-gray-500">Arrive by</span>
            <p className="font-bold text-emerald-800">{deadlineTime}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Sunset</span>
            <p className="font-bold text-amber-700">{sunsetTime}</p>
          </div>
          {latest && (
            <div className="ml-auto text-right">
              <span className="text-xs text-gray-500">Latest safe dep.</span>
              <p className="font-bold text-emerald-800">{latest.departureTime}</p>
            </div>
          )}
        </div>
      </div>

      {/* Departure cards */}
      {departures.map((dep, i) => {
        const cfg = STATUS_CONFIG[dep.safetyStatus]
        const isSelected = selectedDeparture?.tripId === dep.tripId && selectedDeparture?.departureTime === dep.departureTime
        return (
          <div key={`${dep.tripId}-${i}`} className={`rounded-xl border p-3 ${cfg.color} ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900">{dep.departureTime}</span>
                  <span className="text-xs text-gray-500">V/Line</span>
                </div>

                {dep.transfer ? (
                  // Transfer journey
                  <div className="mt-1 space-y-0.5">
                    <p className="text-sm text-gray-700">→ {dep.headsign}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white/60 rounded px-2 py-1 w-fit">
                      <span>Change at</span>
                      <strong className="text-gray-700">{dep.transfer.stopName}</strong>
                      <span>· arr {dep.transfer.arriveTime} dep {dep.transfer.departTime}</span>
                    </div>
                    <p className="text-sm text-gray-700">→ {dep.transfer.headsign}</p>
                    <p className="text-xs text-gray-500">Arrive {dep.arrivalTime}</p>
                  </div>
                ) : (
                  // Direct service
                  <div className="mt-0.5">
                    <p className="text-sm text-gray-700 truncate">→ {dep.headsign}</p>
                    <p className="text-xs text-gray-500">Arrive {dep.arrivalTime}</p>
                  </div>
                )}
              </div>

              <div className="text-right flex-none flex flex-col items-end gap-1">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.badge}`}>
                  {cfg.icon} {cfg.label}
                </span>
                {dep.minutesBuffer !== undefined && (
                  <p className="text-xs text-gray-400">
                    {dep.minutesBuffer > 0 ? `+${dep.minutesBuffer}m` : `${dep.minutesBuffer}m`}
                  </p>
                )}
                {onSelectDeparture && (
                  <button
                    onClick={() => onSelectDeparture(isSelected ? dep : dep)}
                    className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-700'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Use this'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <p className="text-xs text-center text-gray-400 pt-1">
        V/Line timetable data · check{' '}
        <a href="https://ptv.vic.gov.au" target="_blank" rel="noopener noreferrer" className="underline">ptv.vic.gov.au</a>
        {' '}for live disruptions
      </p>
    </div>
  )
}
