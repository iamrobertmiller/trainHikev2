import type { WaterFrontage } from '../types'

interface Props {
  site: WaterFrontage
  onClose: () => void
}

export default function WaterFrontagePanel({ site, onClose }: Props) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto md:left-auto md:right-4 md:bottom-4 md:w-96 md:rounded-2xl md:max-h-[80vh]">
      {/* Header */}
      <div className="sticky top-0 bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base leading-tight">{site.name}</h2>
            <p className="text-sm text-blue-700 font-medium mt-0.5 truncate">{site.river}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            ✕
          </button>
        </div>
        <div className="mt-2">
          <span className="text-xs text-gray-500 font-mono">
            {Math.abs(site.lat).toFixed(4)}°S, {site.lng.toFixed(4)}°E
          </span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            💧 Crown water frontage
          </span>
        </div>

        {/* Location */}
        {site.location && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Location</h3>
            <p className="text-sm text-gray-700">{site.location}</p>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 rounded-xl p-3 text-sm text-gray-600">
          Camping on licensed crown water frontages is free and managed by the Department of Energy, Environment and Climate Action. No booking required.
        </div>

        {/* External link */}
        {site.url && (
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
          >
            View site details ↗
          </a>
        )}
      </div>
    </div>
  )
}
