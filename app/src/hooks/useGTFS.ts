import { useState, useCallback, useEffect } from 'react'
import { loadGTFS, searchStops, findDepartures, findDeparturesArrivingBy, nearestStopWithDistance } from '../lib/gtfs'
import type { GTFSData, GTFSStop, Departure, NearestStopResult } from '../lib/gtfs'
import { loadMetroGTFS, searchMetroStops, latestMetroForVLine, nearestMetroStop, findMetroDeparturesToSSX, findMetroDeparturesFromSSX } from '../lib/metro_gtfs'
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

      const toMins = (hhmm: string) => hhmm.split(':').map(Number).reduce((h, m) => h * 60 + m)
      const toHHMM = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
      const deadlineMins = toMins(deadlineHHMM)

      if (trailheadNetwork === 'metro' && homeNetwork === 'metro') {
        // All-Metro: home → SSX (Metro) → trailhead (Metro)
        const outboundTrains = findMetroDeparturesFromSSX(metroData, toStopId, dateStr, deadlineHHMM)

        if (outboundTrains.length === 0) {
          setError(`No Metro services found from Southern Cross to ${trailheadName || 'the trailhead'} before the deadline.`)
          setDepartures([])
          return
        }

        const homeToSSX = findMetroDeparturesToSSX(metroData, fromStopId, dateStr)
        const combined: Departure[] = []
        const seenHomeDep = new Set<string>()

        for (const outbound of outboundTrains) {
          const ssxDepMins = toMins(outbound.departureSSX)
          // Find latest home → SSX train arriving ≥ 5 min before SSX outbound departs
          const inbound = homeToSSX.filter(t => toMins(t.arrivalSSX) <= ssxDepMins - 5)
          const latestInbound = inbound[inbound.length - 1]
          if (!latestInbound) continue
          if (seenHomeDep.has(latestInbound.departureTime)) continue
          seenHomeDep.add(latestInbound.departureTime)

          const arrTrailheadMins = toMins(outbound.arrivalTime)
          const bufferMins = deadlineMins - arrTrailheadMins

          combined.push({
            departureTime: latestInbound.departureTime,
            arrivalTime: outbound.arrivalTime,
            headsign: trailheadName,
            routeName: `Metro · ${outbound.lineName || trailheadMetroLine}`,
            safetyStatus: bufferMins > 60 ? 'safe' : bufferMins > 0 ? 'tight' : 'risky',
            minutesBuffer: bufferMins,
            tripId: `metro-${latestInbound.departureTime}-${outbound.departureSSX}`,
            metroLeg: {
              departureTime: latestInbound.departureTime,
              arrivalSSX: latestInbound.arrivalSSX,
              lineName: latestInbound.lineName,
            },
            metroTrailheadLeg: {
              estimatedMins: toMins(outbound.arrivalTime) - ssxDepMins,
              lineName: outbound.lineName || trailheadMetroLine,
              trailheadName,
              departureSSX: outbound.departureSSX,
              arrivalTime: outbound.arrivalTime,
            },
          })
        }

        if (combined.length === 0) {
          setError(`No Metro connections found from your station to ${trailheadName || 'the trailhead'} on this date.`)
        }
        setDepartures(combined.slice(0, 12))
        return
      }

      if (trailheadNetwork === 'metro') {
        // V/Line home → SSX, then Metro SSX → Metro trailhead
        const outboundTrains = findMetroDeparturesFromSSX(metroData, toStopId, dateStr, deadlineHHMM)

        // Find V/Line trains to SSX; for each, match the earliest Metro connection after arrival
        const vlResults = findDepartures(gtfs, fromStopId, SSX_STOP_ID, dateStr, deadlineHHMM)

        if (vlResults.length === 0) {
          setError(`No V/Line services found to Southern Cross. Arrive by ${deadlineHHMM} to reach ${trailheadName || 'the trailhead'} in time.`)
          setDepartures([])
          return
        }

        const combined: Departure[] = vlResults.map(vl => {
          const ssxArrMins = toMins(vl.arrivalTime)
          // First Metro from SSX departing ≥ 5 min after V/Line arrives
          const metro = outboundTrains.find(t => toMins(t.departureSSX) >= ssxArrMins + 5)
          if (!metro) {
            // No Metro connection found — fall back to estimated arrival
            const fallbackArr = ssxArrMins + 35
            const bufferMins = deadlineMins - fallbackArr
            return {
              ...vl,
              arrivalTime: toHHMM(fallbackArr),
              minutesBuffer: bufferMins,
              safetyStatus: (bufferMins > 60 ? 'safe' : bufferMins > 0 ? 'tight' : 'risky') as 'safe' | 'tight' | 'risky',
              metroTrailheadLeg: {
                estimatedMins: 35,
                lineName: trailheadMetroLine,
                trailheadName,
              },
            }
          }
          const arrTrailheadMins = toMins(metro.arrivalTime)
          const bufferMins = deadlineMins - arrTrailheadMins
          return {
            ...vl,
            arrivalTime: metro.arrivalTime,
            minutesBuffer: bufferMins,
            safetyStatus: (bufferMins > 60 ? 'safe' : bufferMins > 0 ? 'tight' : 'risky') as 'safe' | 'tight' | 'risky',
            metroTrailheadLeg: {
              estimatedMins: toMins(metro.arrivalTime) - toMins(metro.departureSSX),
              lineName: metro.lineName || trailheadMetroLine,
              trailheadName,
              departureSSX: metro.departureSSX,
              arrivalTime: metro.arrivalTime,
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
