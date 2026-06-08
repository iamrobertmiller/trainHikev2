import { memo } from 'react'
import type { WaterFrontage } from '../types'
import { BottomSheet, useSheet } from './BottomSheet'

interface Props {
  site: WaterFrontage
  onClose: () => void
  onPlanTrip: () => void
}

const LABEL = { fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.14em', color: '#5c4830', textTransform: 'uppercase' as const }

function Content({ site, onPlanTrip }: { site: WaterFrontage; onPlanTrip: () => void }) {
  const { closeSheet } = useSheet()
  return (
    <>
      {/* Header — river blue */}
      <div className="flex-none px-4 pt-3 pb-4" style={{ background: 'var(--river)', borderBottom: '3px solid var(--ochre)' }}>
        <div className="md:hidden flex justify-center mb-2.5">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.14em', color: '#90c8e8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              {site.river}
            </p>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '1.2rem', color: '#fff', letterSpacing: '0.02em', lineHeight: 1.2 }}>
              {site.name}
            </h2>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#a8c4d8' }}>
              {Math.abs(site.lat).toFixed(4)}°S &nbsp;{site.lng.toFixed(4)}°E
            </span>
          </div>
          <button
            onClick={closeSheet}
            className="flex-none w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#a8c4d8' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" data-vaul-no-drag>
        <div className="px-4 py-4 space-y-4">
          <div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontFamily: 'Oswald, sans-serif', fontWeight: 500, letterSpacing: '0.08em', fontSize: '0.72rem',
              background: 'var(--river)', color: '#fff', padding: '4px 10px', borderRadius: '4px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12Q6 8 10 12Q14 16 18 12Q20 10 22 12"/>
              </svg>
              CROWN WATER FRONTAGE
            </span>
          </div>

          {site.location && (
            <div>
              <p style={LABEL} className="mb-1.5">Location</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--ink)' }}>{site.location}</p>
            </div>
          )}

          <div style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)', borderRadius: '12px', padding: '14px 16px' }}>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--ink)', fontStyle: 'italic' }}>
              Camping on licensed crown water frontages is free and managed by DEECA. No booking required.
            </p>
          </div>

          {site.url && (
            <a href={site.url} target="_blank" rel="noopener noreferrer"
              className="block text-xs text-center"
              style={{ color: 'var(--earth)', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em', textDecoration: 'none' }}>
              View site details ↗
            </a>
          )}
        </div>
      </div>

      {/* CTA footer — inside Drawer.Content so touch events are not cancelled by vaul */}
      <div data-vaul-no-drag className="flex-none px-4 pt-3" style={{ borderTop: '1px solid var(--fog)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)', background: 'var(--paper)' }}>
        <button
          onClick={onPlanTrip}
          className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2.5"
          style={{ background: 'var(--forest)', color: '#fff', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.1em', fontSize: '0.875rem', fontWeight: 600 }}
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

function WaterFrontagePanel({ site, onClose, onPlanTrip }: Props) {
  return (
    <>
      <BottomSheet
        onClose={onClose}
        desktopClassName="panel-bottom absolute left-0 right-0 z-10 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden md:left-auto md:right-4 md:w-96 md:rounded-2xl md:max-h-[80vh]"
      >
        <Content site={site} onPlanTrip={onPlanTrip} />
      </BottomSheet>
    </>
  )
}

export default memo(WaterFrontagePanel)
