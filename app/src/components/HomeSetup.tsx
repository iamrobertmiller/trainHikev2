import { useState, useEffect } from 'react'
import { useGTFSStopSearch } from '../hooks/useGTFS'
import type { Profile } from '../types'

interface Props {
  onSave: (profile: Profile) => void
  onSkip: () => void
}

export default function HomeSetup({ onSave, onSkip }: Props) {
  const [query, setQuery] = useState('')
  const { results, loading, search, clear, ready } = useGTFSStopSearch()

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.length >= 2) search(query)
      else clear()
    }, 300)
    return () => clearTimeout(t)
  }, [query, search, clear])

  const handleSelect = (stop: { id: string; name: string }) => {
    onSave({
      homeStopName: stop.name,
      homeStopId: stop.id,
      homeStopRouteType: 2,  // V/Line train
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-2xl">
        <div className="p-6 pb-4">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 md:hidden" />
          <h2 className="text-xl font-bold text-gray-900">Set your home station</h2>
          <p className="text-sm text-gray-500 mt-1">
            Search for the V/Line station you depart from. City travellers: use Flinders Street or Southern Cross.
          </p>

          <div className="mt-4 relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={ready ? 'e.g. Flinders Street, Ballarat, Geelong…' : 'Loading timetable data…'}
              disabled={!ready}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400"
              autoFocus
            />
            {loading && (
              <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {results.length > 0 && (
            <ul className="mt-2 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-52 overflow-y-auto">
              {results.map(stop => (
                <li key={stop.id}>
                  <button
                    onClick={() => handleSelect(stop)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 text-left"
                  >
                    <p className="text-sm font-medium text-gray-900">{stop.name}</p>
                    <span className="text-xs text-gray-400 ml-2 flex-none">V/Line</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onSkip}
            className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
