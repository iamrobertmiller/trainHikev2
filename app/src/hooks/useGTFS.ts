import { useState, useCallback, useEffect } from 'react'
import { loadGTFS, searchStops, findDepartures, findDeparturesArrivingBy, nearestStopWithDistance } from '../lib/gtfs'
import type { GTFSData, GTFSStop, Departure, NearestStopResult } from '../lib/gtfs'
import { loadMetroGTFS, searchMetroStops, latestMetroForVLine, nearestMetroStop, estimateMetroTravelMins } from '../lib/metro_gtfs'
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
    homeNetwork: 'metro' | 'vline' = 'vline',
    trailheadNetwork: 'metro' | 'vline' = 'vline',
    trailheadName = '',
    trailheadMetroLine = ''
  ) => {
    setLoading(true)
    setError(null)
    try {
      const [gtfs, metroData] = await Promise.all([loadGTFS(), loadMetroGTFS()])

      const deadlineMins = deadlineHHMM.split(':').map(Number).reduce((h, m) => h * 60 + m)

      if (trailheadNetwork === 'metro') {
        // Trailhead is a Metro station — V/Line goes to SSX, then Metro to trailhead.
        // Use toSSX travel times as a symmetric proxy for SSX→trailhead travel time.
        const metroMins = estimateMetroTravelMins(metroData, toStopId, dateStr)
        const adjustedDeadlineMins = deadlineMins - metroMins - 5  // 5 min SSX platform buffer
        const adjustedDeadlineHHMM = `${String(Math.floor(adjustedDeadlineMins / 60)).padStart(2, '0')}:${String(adjustedDeadlineMins % 60).padStart(2, '0')}`

        let vlResults: Departure[]

        if (homeNetwork === 'metro') {
          // Metro home → SSX (Metro), then SSX → trailhead (Metro): no V/Line involved.
          // We can't show a full in-app Metro timetable without fromSSX data.
          // Show Metro home → SSX departures so the user knows when to head out.
          setError(`This is an all-Metro journey. V/Line timetables are not shown for Metro-only routes — use PTV to plan your trip from Southern Cross to ${trailheadName || 'the trailhead'}.`)
          setDepartures([])
          return
        }

        // V/Line home → SSX
        vlResults = findDepartures(gtfs, fromStopId, SSX_STOP_ID, dateStr, adjustedDeadlineHHMM)

        if (vlResults.length === 0) {
          setError(`No V/Line services found to Southern Cross in time. You need to arrive at Southern Cross by ${adjustedDeadlineHHMM} to catch Metro to ${trailheadName || 'the trailhead'}.`)
          setDepartures([])
          return
        }

        // Attach Metro trailhead leg info to each departure
        const combined: Departure[] = vlResults.map(vl => {
          const ssxArrMins = vl.arrivalTime.split(':').map(Number).reduce((h, m) => h * 60 + m)
          const estTrailheadArrMins = ssxArrMins + metroMins
          const bufferMins = deadlineMins - estTrailheadArrMins
          const arrH = Math.floor(estTrailheadArrMins / 60) % 24
          const arrM = estTrailheadArrMins % 60
          return {
            ...vl,
            arrivalTime: `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`,
            minutesBuffer: bufferMins,
            safetyStatus: bufferMins > 60 ? 'safe' : bufferMins > 0 ? 'tight' : 'risky',
            metroTrailheadLeg: {
              estimatedMins: metroMins,
              lineName: trailheadMetroLine,
              trailheadName: trailheadName,
            },
          }
        })

        setDepartures(combined)
        return
      }

      if (homeNetwork === 'metro') {
        // Metro home → SSX, then V/Line SSX → V/Line trailhead
        const vlResults = findDepartures(gtfs, SSX_STOP_ID, toStopId, dateStr, deadlineHHMM)

        if (vlResults.length === 0) {
          setError('No V/Line services found from Southern Cross on this date.')
          setDepartures([])
          return
        }

        const combined: Departure[] = []
        for (const vl of vlResults) {
          const metro = latestMetroForVLine(metroData, fromStopId, dateStr, vl.departureTime)
          if (!metro) continue
          combined.push({
            ...vl,
            departureTime: metro.departureTime,
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
        return
      }

      // V/Line home → V/Line trailhead (original behaviour)
      const results = findDepartures(gtfs, fromStopId, toStopId, dateStr, deadlineHHMM)
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
    Promise.all([loadGTFS(), loadMetroGTFS()]).then(([gtfs, metro]) => {
      const vline = nearestStopWithDistance(gtfs, lat, lng)
      const metroResult = nearestMetroStop(metro, lat, lng)
      if (!vline && !metroResult) { setResult(null); return }
      if (!vline) { setResult(metroResult); return }
      if (!metroResult) { setResult(vline); return }
      setResult(metroResult.distanceKm < vline.distanceKm ? metroResult : vline)
    })
  }, [lat, lng])

  return result  // undefined = loading, null = none found, NearestStopResult = found
}
