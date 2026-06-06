import type { AppMode } from '../types'

interface Props {
  mode: AppMode
  onSwitchMode: (m: AppMode) => void
}

export default function BottomTabBar({ mode, onSwitchMode }: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        onClick={() => onSwitchMode('plan')}
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
          mode === 'plan' ? 'text-emerald-700' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M15 3.5L12 2 9 3.5 6 2l-3 1.5v17l3-1.5 3 1.5 3-1.5 3 1.5 3-1.5V3.5L15 3.5zM15 18l-3-1.5L9 18l-3 1.5V6l3-1.5L12 6l3-1.5L18 6v13.5L15 18zM11 7h2v2h-2zm0 4h2v6h-2z"/>
        </svg>
        <span className="text-xs font-medium">Plan</span>
      </button>
      <div className="w-px bg-gray-200 my-2" />
      <button
        onClick={() => onSwitchMode('navigate')}
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
          mode === 'navigate' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <span className="text-xs font-medium">Navigate</span>
      </button>
    </div>
  )
}
