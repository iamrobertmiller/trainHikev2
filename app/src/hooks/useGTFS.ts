import { useState, useCallback, useEffect } from 'react'
import { loadGTFS, searchStops, findDepartures, findDeparturesArrivingBy, nearestStopWithDistance } from '../lib/gtfs'
import type { GTFSData, GTFSStop, Departure, NearestStopResult } from '../lib/gtfs'
import { loadMetroGTFS, searchMetroStops, latestMetroForVLine } from '../lib/metro_gtfs'
import type { MetroStop } from '../lib/metro_gtfs'

const SSX_STOP_ID = '20043'  // Southern Cross Station in V/Line GTFS

export type CombinedStop =
  | { network: 'vline'; stop: GTFSStop }
  | { network: 'metro'; stop: MetroStop }

export function useStopSearch() {
  const [gtfs, setGtfs] = useState<GTFSData | null>(null)
  const [metro, setMetro] = useState<Awaited<ReturnType<typeof loadMetroGTFS>> | null>(null)
  const [results, setResults] = useState<CombinedStop[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadGTFS().then(setGtfs)
    loadMetroGTFS().then(setMetro)
  }, [])

  const search = useCallback((query: string) => {
    if (!gtfs) return
    setLoading(true)
    const vlineResults: CombinedStop[] = searchStops(gtfs, query).map(s => ({ network: 'vline' as const, stop: s }))
    const metroResults: CombinedStop[] = metro ? searchMetroStops(metro, query).map(s => ({ network: 'metro' as const, stop: s })) : []
    // Interleave: show Metro first if query matches, then V/Line
    const combined = [...metroResults, ...vlineResults].slice(0, 10)
    setResults(combined)
    setLoading(false)
  }, [gtfs, metro])

  const clear = useCallback(() => setResults([]), [])

  return { results, loading, search, clear, ready: !!gtfs }
}

// Legacy V/Line-only search (kept for backward compat)
export function useGTFSStopSearch() {
  const [gtfs, setGtfs] = useState<GTFSData | null>(null)
  const [results, setResults] = useState<GTFSStop[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadGTFS().then(setGtfs)
  }, [])

  const search = useCallback((query: string) => {
    if (!gtfs) return
    setLoading(true)
    setResults(searchStops(gtfs, query))
    setLoading(false)
  }, [gtfs])

  const clear = useCallback(() => setResults([]), [])

  return { results, loading, search, clear, ready: !!gtfs }
}

export function useGTFSDepartures() {
  const [departures, setDepartures] = useState<Departure[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDepartures = useCallback(async (
    fromStopId: string,
    toStopId: string,
    dateStr: string,    // YYYYMMDD
    deadlineHHMM: string,
    homeNetwork: 'metro' | 'vline' = 'vline'
  ) => {
    setLoading(true)
    setError(null)
    try {
      const gtfs = await loadGTFS()

      if (homeNetwork === 'metro') {
        // Metro leg: home → Southern Cross, then V/Line: SSX → campsite
        const metroData = await loadMetroGTFS()
        const vlResults = findDepartures(gtfs, SSX_STOP_ID, toStopId, dateStr, deadlineHHMM)

        if (vlResults.length === 0) {
          setError('No V/Line services found from Southern Cross on this date.')
          setDepartures([])
          return
        }

        // For each V/Line departure from SSX, find the best Metro connection
        const combined: Departure[] = []
        for (const vl of vlResults) {
          const metro = latestMetroForVLine(metroData, fromStopId, dateStr, vl.departureTime)
          if (!metro) continue  // no Metro connection for this V/Line
          combined.push({
            ...vl,
            departureTime: metro.departureTime,  // journey starts at home Metro stop
            metroLeg: {
              departureTime: metro.departureTime,
              arrivalSSX: metro.arrivalSSX,
              lineName: metro.lineName,
            },
          })
        }

        if (combined.length === 0) {
          setError('No Metro connections found to Southern Cross for these V/Line services.')
        }
        setDepartures(combined)
      } else {
        // V/Line only (existing behaviour)
        const results = findDepartures(gtfs, fromStopId, toStopId, dateStr, deadlineHHMM)
        if (results.length === 0) {
          setError('No V/Line services found between these stops on this date.')
        }
        setDepartures(results)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timetable data')
    } finally {
      setLoading(false)
    }
  }, [])

  return { departures, loading, error, fetchDepartures }
}

export function useFriendDepartures() {
  const [departures, setDepartures] = useState<Departure[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDepartures = useCallback(async (
    fromStopId: string,
    toStopId: string,
    dateStr: string,
    arrivingByHHMM: string
  ) => {
    setLoading(true)
    setError(null)
    try {
      const gtfs = await loadGTFS()
      const results = findDeparturesArrivingBy(gtfs, fromStopId, toStopId, dateStr, arrivingByHHMM)
      if (results.length === 0) {
        setError('No V/Line services found between these stops on this date.')
      }
      setDepartures(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timetable data')
    } finally {
      setLoading(false)
    }
  }, [])

  return { departures, loading, error, fetchDepartures }
}

export function useNearestStop(lat: number | null, lng: number | null) {
  const [result, setResult] = useState<NearestStopResult | null | undefined>(undefined)

  useEffect(() => {
    if (lat == null || lng == null) return
    setResult(undefined)
    loadGTFS().then(gtfs => {
      setResult(nearestStopWithDistance(gtfs, lat, lng))
    })
  }, [lat, lng])

  return result  // undefined = loading, null = none found, NearestStopResult = found
}
