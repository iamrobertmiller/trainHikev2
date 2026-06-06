import { useState, useCallback, useEffect } from 'react'
import { loadGTFS, searchStops, findDepartures, findDeparturesArrivingBy, nearestStopWithDistance } from '../lib/gtfs'
import type { GTFSData, GTFSStop, Departure, NearestStopResult } from '../lib/gtfs'

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
    deadlineHHMM: string
  ) => {
    setLoading(true)
    setError(null)
    try {
      const gtfs = await loadGTFS()
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
    loadGTFS().then(gtfs => {
      setResult(nearestStopWithDistance(gtfs, lat, lng))
    })
  }, [lat, lng])

  return result  // undefined = loading, null = none found, NearestStopResult = found
}
