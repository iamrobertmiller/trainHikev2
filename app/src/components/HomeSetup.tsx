import { useState, useEffect } from 'react'
import { useStopSearch } from '../hooks/useGTFS'
import type { Profile } from '../types'

interface Props {
  onSave: (profile: Profile) => void
  onSkip: () => void
}

export default function HomeSetup({ onSave, onSkip }: Props) {
  const [query, setQuery] = useState('')
  const { results, loading, search, clear, ready } = useStopSearch()

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.length >= 2) search(query)
      else clear()
    }, 300)
    return () => clearTimeout(t)
  }, [query, search, clear])

  const handleSelect = (item: typeof results[number]) => {
    if (item.network === 'metro') {
      onSave({
        homeStopName: item.stop.name,
        homeStopId: item.stop.id,
        homeStopRouteType: 400,
        homeNetwork: 'metro',
      })
    } else {
      onSave({
        homeStopName: item.stop.name,
        homeStopId: item.stop.id,
        homeStopRouteType: 2,
        homeNetwork: 'vline',
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{ background: 'rgba(26,51,40,0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--paper)' }}
      >
        {/* Header strip */}
        <div className="px-6 py-5" style={{ background: 'var(--forest)', borderBottom: '3px solid var(--ochre)' }}>
          <div className="w-12 h-1 rounded-full mx-auto mb-4 md:hidden" style={{ background: 'var(--forest-2)' }} />
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: '1.1rem', color: 'var(--paper)', letterSpacing: '0.04em' }}>
            Set your home station
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.25rem' }}>
            Search your nearest Metro or V/Line station
          </p>
        </div>

        <div className="p-6 pb-4">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={ready ? 'e.g. Box Hill, Flinders Street, Ballarat…' : 'Loading timetable data…'}
              disabled={!ready}
              className="w-full px-4 py-3 text-sm focus:outline-none rounded-xl"
              style={{
                background: 'var(--paper-2)',
                border: '1.5px solid var(--fog)',
                color: 'var(--ink)',
                fontFamily: 'Lora, Georgia, serif',
              }}
              autoFocus
            />
            {loading && (
              <div
                className="absolute right-3 top-3.5 w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--moss)', borderTopColor: 'transparent' }}
              />
            )}
          </div>

          {results.length > 0 && (
            <ul
              className="mt-2 rounded-xl overflow-hidden max-h-64 overflow-y-auto"
              style={{ border: '1.5px solid var(--fog)' }}
            >
              {results.map((item, i) => {
                const isMetro = item.network === 'metro'
                const name = item.stop.name
                const sub = isMetro ? (item.stop as import('../lib/metro_gtfs').MetroStop).line : null
                return (
                  <li key={`${item.network}-${item.stop.id}`} style={{ borderBottom: i < results.length - 1 ? '1px solid var(--fog)' : 'none' }}>
                    <button
                      onClick={() => handleSelect(item)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                      style={{ background: 'var(--paper-2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--ink)', fontFamily: 'Lora, Georgia, serif' }}>{name}</p>
                        {sub && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--sand)', fontFamily: 'JetBrains Mono, monospace' }}>{sub}</p>
                        )}
                      </div>
                      <span
                        className="text-xs ml-3 flex-none px-2 py-0.5 rounded"
                        style={{
                          fontFamily: 'Oswald, sans-serif',
                          letterSpacing: '0.08em',
                          background: isMetro ? '#005C8B' : 'var(--forest)',
                          color: '#fff',
                        }}
                      >
                        {isMetro ? 'METRO' : 'V/LINE'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onSkip}
            className="w-full py-3 rounded-xl text-sm transition-colors"
            style={{
              background: 'var(--paper-2)',
              border: '1px solid var(--fog)',
              color: 'var(--sand)',
              fontFamily: 'Oswald, sans-serif',
              letterSpacing: '0.1em',
            }}
          >
            SKIP FOR NOW
          </button>
        </div>
      </div>
    </div>
  )
}
