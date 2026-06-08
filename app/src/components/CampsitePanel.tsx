import type { Campsite } from '../types'
import { BottomSheet, useSheet } from './BottomSheet'

interface Props {
  campsite: Campsite
  onClose: () => void
  onPlanTrip: () => void
}

const LABEL = { fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.14em', color: '#5c4830', textTransform: 'uppercase' as const }
const MUTED = { fontSize: '0.78rem', color: '#6b5840' }

function FacilityBadge({ available, label, icon }: { available?: boolean; label: string; icon: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
      style={{
        fontFamily: 'Oswald, sans-serif',
        fontWeight: 500,
        letterSpacing: '0.06em',
        background: available ? 'var(--forest)' : 'var(--paper-2)',
        color: available ? '#fff' : '#7a6650',
        border: available ? '1px solid var(--moss)' : '1px solid var(--fog)',
      }}
    >
      <span style={{ opacity: available ? 1 : 0.6 }}>{icon}</span>
      <span>{label.toUpperCase()}</span>
    </div>
  )
}

function Content({ campsite, onPlanTrip }: { campsite: Campsite; onPlanTrip: () => void }) {
  const { closeSheet } = useSheet()
  return (
    <>
      {/* Header */}
      <div className="flex-none px-4 pt-3 pb-4" style={{ background: 'var(--forest)', borderBottom: '3px solid var(--ochre)' }}>
        {/* drag handle pip — hidden on desktop */}
        <div className="md:hidden flex justify-center mb-2.5">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.14em', color: '#a8d4b8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              {campsite.park_name}
            </p>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '1.2rem', color: '#fff', letterSpacing: '0.02em', lineHeight: 1.2 }}>
              {campsite.asset_desc || campsite.name}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#c0d0c0' }}>
                {Math.abs(campsite.lat).toFixed(4)}°S &nbsp;{campsite.lng.toFixed(4)}°E
              </span>
              {campsite.difficulty && (
                <span style={{
                  fontFamily: 'Oswald, sans-serif', fontWeight: 600, letterSpacing: '0.08em', fontSize: '0.65rem',
                  background: campsite.difficulty === 'easy' ? 'var(--moss)' : campsite.difficulty === 'moderate' ? 'var(--ochre)' : '#8b2020',
                  color: '#fff', padding: '1px 6px', borderRadius: '3px', marginLeft: 'auto',
                }}>
                  {campsite.difficulty.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={closeSheet}
            className="flex-none w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--forest-2)', color: '#c0d0c0' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" data-vaul-no-drag>
        <div className="px-4 py-4 space-y-5">
          {/* Facilities */}
          <div>
            <p style={LABEL} className="mb-3">Facilities</p>
            {campsite.toilets === undefined ? (
              <p style={{ ...MUTED, fontStyle: 'italic' }}>Facility details unavailable — check Parks Victoria</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <FacilityBadge available={campsite.toilets} label="Toilets" icon={
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm10 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM4 10h6v7H9v5H5v-5H4V10zm10 0h6l-1 7h-1v5h-4v-5h-1l-1-7z"/></svg>
                } />
                <FacilityBadge available={campsite.water} label="Water" icon={
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 8 6 12 6 15a6 6 0 0 0 12 0c0-3-2-7-6-13z"/></svg>
                } />
                <FacilityBadge available={campsite.fire_pits} label="Fire pit" icon={
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c0 0 2 4 2 7a2 2 0 0 1-4 0c0-3 2-7 2-7zm-4 8c0 0 1 2 0 4a4 4 0 0 0 8 0c0-2-1-3-2-4 0 1-1 2-2 2s-2-1-2-2c-1 1-2 3-2 4"/></svg>
                } />
                <FacilityBadge available={campsite.shelter} label="Shelter" icon={
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L2 21h20L12 3zm0 5l5.5 10h-11L12 8z"/></svg>
                } />
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px dashed var(--fog)' }} />

          {/* Booking */}
          {(campsite.booking_required !== undefined || campsite.fee_aud !== undefined) && (
            <div>
              <p style={LABEL} className="mb-3">Booking</p>
              <div className="flex items-center gap-3 flex-wrap">
                {campsite.booking_required !== undefined && (
                  <span style={{
                    fontFamily: 'Oswald, sans-serif', fontWeight: 500, letterSpacing: '0.06em', fontSize: '0.72rem',
                    background: campsite.booking_required ? 'var(--earth)' : 'var(--paper-2)',
                    color: campsite.booking_required ? '#fff' : '#6b5840',
                    border: campsite.booking_required ? 'none' : '1px solid var(--fog)',
                    padding: '3px 8px', borderRadius: '4px',
                  }}>
                    {campsite.booking_required ? 'BOOKING REQUIRED' : 'NO BOOKING NEEDED'}
                  </span>
                )}
                {campsite.fee_aud !== undefined && campsite.fee_aud > 0 && (
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--forest)' }}>
                    ${campsite.fee_aud}/night
                  </span>
                )}
              </div>
              {campsite.booking_url && (
                <a href={campsite.booking_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--forest)', textDecoration: 'underline' }}>
                  Book on Parks Victoria →
                </a>
              )}
            </div>
          )}

          {/* Capacity */}
          {campsite.capacity && (
            <div className="flex items-center gap-2">
              <span style={MUTED}>Capacity:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>{campsite.capacity} sites</span>
            </div>
          )}

          {/* Notes */}
          {campsite.notes && (
            <div>
              <p style={LABEL} className="mb-2">Notes</p>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--ink)', fontStyle: 'italic' }}>{campsite.notes}</p>
            </div>
          )}

          <a
            href={`https://www.parks.vic.gov.au/places-to-see/parks/${campsite.park_name.toLowerCase().replace(/\s+/g, '-')}`}
            target="_blank" rel="noopener noreferrer"
            className="block text-xs text-center"
            style={{ color: 'var(--earth)', textDecoration: 'none', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em' }}
          >
            View on Parks Victoria ↗
          </a>
        </div>
      </div>

      {/* Desktop-only footer inside the sheet */}
      <div className="hidden md:block flex-none px-4 pt-3" style={{ borderTop: '1px solid var(--fog)', paddingBottom: '1rem', background: 'var(--paper)' }}>
        <button
          onClick={onPlanTrip}
          className="w-full font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2.5"
          style={{ background: 'var(--forest)', color: '#fff', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.1em', fontSize: '0.875rem' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--forest-2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--forest)')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
          PLAN A TRIP HERE
        </button>
      </div>
    </>
  )
}

export default function CampsitePanel({ campsite, onClose, onPlanTrip }: Props) {
  return (
    <>
      <BottomSheet
        onClose={onClose}
        desktopClassName="panel-bottom absolute left-0 right-0 z-10 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden md:left-auto md:right-4 md:w-96 md:rounded-2xl md:max-h-[80vh]"
      >
        <Content campsite={campsite} onPlanTrip={onPlanTrip} />
      </BottomSheet>
      {/* Mobile-only: fixed outside the transformed drawer so it stays above Safari chrome */}
      <div
        className="md:hidden fixed left-0 right-0 z-30 px-4"
        style={{ top: '3.75rem' }}
      >
        <button
          onClick={onPlanTrip}
          className="w-full font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2.5"
          style={{ background: 'var(--forest)', color: '#fff', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.1em', fontSize: '0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
          PLAN A TRIP HERE
        </button>
      </div>
    </>
  )
}
