import type { CustomWaypoint } from '../types'

interface Props {
  waypoints: CustomWaypoint[]
  isDrawing: boolean
  estimatedKm: number
  estimatedMinutes: number
  onToggleDrawing: () => void
  onDeleteLast: () => void
  onClearAll: () => void
  onPlanTrip: () => void
}

export default function WaypointControls({
  waypoints,
  isDrawing,
  estimatedKm,
  estimatedMinutes,
  onToggleDrawing,
  onDeleteLast,
  onClearAll,
  onPlanTrip,
}: Props) {
  const hrs = Math.floor(estimatedMinutes / 60)
  const mins = Math.round(estimatedMinutes % 60)
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`

  if (!isDrawing && waypoints.length === 0) {
    return (
      <div className="absolute bottom-20 right-3 z-10 pointer-events-auto">
        <button
          onClick={onToggleDrawing}
          className="flex items-center gap-2 rounded-xl shadow-lg px-3 py-2.5 transition-colors"
          style={{ background: 'var(--forest)', border: '1px solid var(--forest-2)', color: 'var(--paper)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--forest-2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--forest)')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.75rem', letterSpacing: '0.1em', fontWeight: 600 }}>DRAW A ROUTE</span>
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-20 right-3 z-10 pointer-events-auto">
      <div
        className="rounded-xl shadow-lg p-3 min-w-[210px]"
        style={{ background: 'var(--forest)', border: '1px solid var(--forest-2)' }}
      >
        {/* Status row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: isDrawing ? 'var(--ochre)' : 'var(--sand)', boxShadow: isDrawing ? '0 0 6px var(--ochre)' : 'none' }}
            />
            <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--paper)' }}>
              {isDrawing ? 'TAP MAP TO ADD POINTS' : 'CUSTOM ROUTE'}
            </span>
          </div>
          <button
            onClick={onToggleDrawing}
            className="text-xs px-2 py-1 rounded-lg transition-colors"
            style={{
              fontFamily: 'Oswald, sans-serif',
              letterSpacing: '0.08em',
              fontWeight: 600,
              background: isDrawing ? 'var(--ochre)' : 'var(--forest-2)',
              color: 'var(--paper)',
            }}
          >
            {isDrawing ? 'DONE' : 'ADD'}
          </button>
        </div>

        {/* Stats */}
        {waypoints.length > 0 && (
          <div
            className="flex items-center gap-3 rounded-lg px-2.5 py-2 mb-2.5"
            style={{ background: 'var(--forest-2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--sand)' }}
          >
            <span><strong style={{ color: 'var(--paper)' }}>{waypoints.length}</strong> pts</span>
            <span><strong style={{ color: 'var(--ochre)' }}>{estimatedKm.toFixed(1)}</strong> km</span>
            <span><strong style={{ color: 'var(--paper)' }}>{timeStr}</strong></span>
          </div>
        )}

        {/* Plan trip CTA */}
        {!isDrawing && waypoints.length >= 2 && (
          <button
            onClick={onPlanTrip}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl mb-2 transition-colors"
            style={{ background: 'var(--ochre)', color: '#fff', fontFamily: 'Oswald, sans-serif', fontSize: '0.75rem', letterSpacing: '0.1em', fontWeight: 600 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ochre-lt)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--ochre)')}
          >
            PLAN THIS TRIP →
          </button>
        )}

        {/* Actions */}
        {waypoints.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={onDeleteLast}
              className="flex-1 text-xs py-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--forest-2)', color: 'var(--sand)', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--paper)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--sand)' }}
            >
              ← UNDO
            </button>
            {waypoints.length > 1 && (
              <button
                onClick={onClearAll}
                className="text-xs px-2 py-1.5 rounded-lg transition-colors"
                style={{ color: '#c07c28', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(192,124,40,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                CLEAR
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
