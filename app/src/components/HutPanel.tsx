import type { Hut } from '../types'

interface Props {
  hut: Hut
  onClose: () => void
}

export default function HutPanel({ hut, onClose }: Props) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto md:left-auto md:right-4 md:bottom-4 md:w-96 md:rounded-2xl md:max-h-[80vh]">
      {/* Header */}
      <div className="sticky top-0 bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base leading-tight">{hut.name}</h2>
            <p className="text-sm text-amber-700 font-medium mt-0.5 truncate">{hut.park}</p>
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
            {Math.abs(hut.lat).toFixed(4)}°S, {hut.lng.toFixed(4)}°E
          </span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            🏚️ Roofed accommodation
          </span>
        </div>

        {/* Info */}
        <div className="bg-amber-50 rounded-xl p-3 text-sm text-gray-600">
          Alpine huts are basic roofed shelters managed by Parks Victoria. Many are emergency refuges only — check the park website before relying on one for shelter.
        </div>

        {/* Park link */}
        <a
          href={`https://www.parks.vic.gov.au/`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-center text-gray-400 hover:text-amber-700"
        >
          View on Parks Victoria website ↗
        </a>
      </div>
    </div>
  )
}
