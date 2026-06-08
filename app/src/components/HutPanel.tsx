import { memo } from 'react'
import type { Hut } from '../types'
import { BottomSheet, useSheet } from './BottomSheet'

interface Props {
  hut: Hut
  onClose: () => void
  onPlanTrip: () => void
}

function Content({ hut, onPlanTrip }: { hut: Hut; onPlanTrip: () => void }) {
  const { closeSheet } = useSheet()
  return (
    <>
      {/* Header — bark brown */}
      <div className="flex-none px-4 pt-3 pb-4" style={{ background: 'var(--bark)', borderBottom: '3px solid var(--ochre)' }}>
        <div className="md:hidden flex justify-center mb-2.5">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.14em', color: 'var(--ochre)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              {hut.park}
            </p>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '1.2rem', color: '#fff', letterSpacing: '0.02em', lineHeight: 1.2 }}>
              {hut.name}
            </h2>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#c8b898' }}>
              {Math.abs(hut.lat).toFixed(4)}°S &nbsp;{hut.lng.toFixed(4)}°E
            </span>
          </div>
          <button
            onClick={closeSheet}
            className="flex-none w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#d0c0a8' }}
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
              background: 'var(--earth)', color: '#fff', padding: '4px 10px', borderRadius: '4px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l9-8 9 8"/><path d="M5 11v9h14v-9"/><path d="M10 20v-5h4v5"/>
              </svg>
              ROOFED SHELTER
            </span>
          </div>

          <div style={{ background: 'var(--paper-2)', border: '1px solid var(--fog)', borderRadius: '12px', padding: '14px 16px' }}>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--ink)', fontStyle: 'italic' }}>
              Alpine huts are basic roofed shelters managed by Parks Victoria. Many are emergency refuges only — check the park website before relying on one for shelter.
            </p>
          </div>

          <a href="https://www.parks.vic.gov.au/" target="_blank" rel="noopener noreferrer"
            className="block text-xs text-center"
            style={{ color: 'var(--earth)', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em', textDecoration: 'none' }}>
            View on Parks Victoria ↗
          </a>
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

function HutPanel({ hut, onClose, onPlanTrip }: Props) {
  return (
    <>
      <BottomSheet
        onClose={onClose}
        desktopClassName="panel-bottom absolute left-0 right-0 z-10 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden md:left-auto md:right-4 md:w-96 md:rounded-2xl md:max-h-[80vh]"
      >
        <Content hut={hut} onPlanTrip={onPlanTrip} />
      </BottomSheet>
    </>
  )
}

export default memo(HutPanel)
