import type { Campsite, Trail } from '../types'

interface Props {
  campsite: Campsite
  nearbyTrail: Trail | null
  onClose: () => void
  onPlanTrip: () => void
}

function FacilityBadge({ available, label, icon }: { available?: boolean; label: string; icon: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${
      available ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400'
    }`}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  )
}

export default function CampsitePanel({ campsite, nearbyTrail, onClose, onPlanTrip }: Props) {
  return (
    <div className="absolute bottom-16 left-0 right-0 z-10 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto md:left-auto md:right-4 md:bottom-20 md:w-96 md:rounded-2xl md:max-h-[80vh]">
      {/* Header */}
      <div className="sticky top-0 bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base leading-tight">
              {campsite.asset_desc || campsite.name}
            </h2>
            <p className="text-sm text-emerald-700 font-medium mt-0.5 truncate">{campsite.park_name}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            ✕
          </button>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-xs text-gray-500 font-mono">
            {campsite.lat.toFixed(4)}°S, {Math.abs(campsite.lng).toFixed(4)}°E
          </span>
          {campsite.difficulty && (
            <span className={`ml-auto px-2 py-0.5 rounded text-xs font-semibold ${
              campsite.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
              campsite.difficulty === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {campsite.difficulty}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Facilities */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Facilities</h3>
          <div className="flex flex-wrap gap-2">
            <FacilityBadge available={campsite.toilets} label="Toilets" icon="🚻" />
            <FacilityBadge available={campsite.water} label="Water" icon="💧" />
            <FacilityBadge available={campsite.fire_pits} label="Fire pit" icon="🔥" />
            <FacilityBadge available={campsite.shelter} label="Shelter" icon="🏕️" />
          </div>
          {campsite.toilets === undefined && (
            <p className="text-xs text-gray-400 mt-2">Facility details not yet available — check Parks Victoria website</p>
          )}
        </div>

        {/* Booking */}
        {(campsite.booking_required !== undefined || campsite.fee_aud !== undefined) && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Booking</h3>
            <div className="flex items-center gap-3">
              {campsite.booking_required !== undefined && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  campsite.booking_required ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {campsite.booking_required ? 'Booking required' : 'No booking needed'}
                </span>
              )}
              {campsite.fee_aud !== undefined && campsite.fee_aud > 0 && (
                <span className="text-sm font-semibold text-gray-700">${campsite.fee_aud}/night</span>
              )}
            </div>
            {campsite.booking_url && (
              <a
                href={campsite.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs text-emerald-700 underline"
              >
                Book on Parks Victoria →
              </a>
            )}
          </div>
        )}

        {/* Capacity */}
        {campsite.capacity && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Capacity:</span>
            <span className="text-sm font-medium text-gray-700">{campsite.capacity} sites</span>
          </div>
        )}

        {/* Nearest trail */}
        {nearbyTrail && (
          <div className="bg-emerald-50 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nearest trail</h3>
            <p className="font-medium text-gray-800 text-sm">{nearbyTrail.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{nearbyTrail.length_km} km total</p>
          </div>
        )}

        {/* Notes */}
        {campsite.notes && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notes</h3>
            <p className="text-sm text-gray-600">{campsite.notes}</p>
          </div>
        )}

        {/* Parks Victoria link */}
        <a
          href={`https://www.parks.vic.gov.au/places-to-see/parks/${campsite.park_name.toLowerCase().replace(/\s+/g, '-')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-center text-gray-400 hover:text-emerald-700"
        >
          View on Parks Victoria website ↗
        </a>
      </div>

      {/* CTA */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
        <button
          onClick={onPlanTrip}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <span>🚆</span>
          <span>Plan a trip here</span>
        </button>
      </div>
    </div>
  )
}
