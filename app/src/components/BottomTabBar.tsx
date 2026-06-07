import type { AppMode } from '../types'

interface Props {
  mode: AppMode
  onSwitchMode: (m: AppMode) => void
}

export default function BottomTabBar({ mode, onSwitchMode }: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex"
      style={{
        background: 'var(--forest)',
        borderTop: '1px solid var(--forest-2)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <button
        onClick={() => onSwitchMode('plan')}
        className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors relative"
        style={{ color: mode === 'plan' ? 'var(--ochre)' : 'var(--sand)' }}
      >
        {mode === 'plan' && (
          <div className="absolute top-0 left-8 right-8 h-0.5 rounded-b-sm" style={{ background: 'var(--ochre)' }} />
        )}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5"/>
          <path d="M16 3v4M8 3v4M3 11h18"/>
          <path d="M19 16l-4 4-2-2"/>
        </svg>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.12em', fontWeight: 600 }}>PLAN</span>
      </button>

      <div className="w-px my-3" style={{ background: 'var(--forest-2)' }} />

      <button
        onClick={() => onSwitchMode('navigate')}
        className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors relative"
        style={{ color: mode === 'navigate' ? 'var(--ochre)' : 'var(--sand)' }}
      >
        {mode === 'navigate' && (
          <div className="absolute top-0 left-8 right-8 h-0.5 rounded-b-sm" style={{ background: 'var(--ochre)' }} />
        )}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.65rem', letterSpacing: '0.12em', fontWeight: 600 }}>NAVIGATE</span>
      </button>
    </div>
  )
}
