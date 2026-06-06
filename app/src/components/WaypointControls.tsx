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
      <div className="absolute top-16 left-3 z-10 pointer-events-auto">
        <button
          onClick={onToggleDrawing}
          className="flex items-center gap-2 bg-white rounded-2xl shadow-lg border border-indigo-100 px-3 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
        >
          <span>📍</span>
          <span>Draw a route</span>
        </button>
      </div>
    )
  }

  return (
    <div className="absolute top-16 left-3 z-10 pointer-events-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-3 min-w-[200px]">
        {/* Status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isDrawing ? 'bg-indigo-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-xs font-semibold text-gray-700">
              {isDrawing ? 'Tap map to add points' : 'Custom route'}
            </span>
          </div>
          <button
            onClick={onToggleDrawing}
            className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
              isDrawing
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isDrawing ? 'Done' : 'Add points'}
          </button>
        </div>

        {/* Stats */}
        {waypoints.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2 bg-gray-50 rounded-xl px-2 py-1.5">
            <span><strong className="text-gray-800">{waypoints.length}</strong> pts</span>
            <span><strong className="text-indigo-700">{estimatedKm.toFixed(1)}</strong> km</span>
            <span><strong className="text-gray-800">{timeStr}</strong> est.</span>
          </div>
        )}

        {/* Plan trip CTA — shown when route is ready and not actively drawing */}
        {!isDrawing && waypoints.length >= 2 && (
          <button
            onClick={onPlanTrip}
            className="w-full flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold py-2 rounded-xl transition-colors mb-2"
          >
            <span>🚆</span>
            <span>Plan this trip →</span>
          </button>
        )}

        {/* Actions */}
        {waypoints.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={onDeleteLast}
              className="flex-1 text-xs text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg py-1.5 transition-colors"
            >
              ← Undo last
            </button>
            {waypoints.length > 1 && (
              <button
                onClick={onClearAll}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
