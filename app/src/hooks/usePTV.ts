import { useState, useCallback } from 'react'
import { searchStops, getDepartures, getStopsNearLocation } from '../lib/ptv'
import type { PTVStop } from '../lib/ptv'
import { getSafetyStatus, formatTime } from './useSunset'
import type { PTDeparture } from '../types'

const DEV_ID = import.meta.env.VITE_PTV_DEV_ID as string
const API_KEY = import.meta.env.VITE_PTV_API_KEY as string

export function usePTVSearch() {
  const [results, setResults] = useState<PTVStop[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (query: string) => {
    if (!DEV_ID || !API_KEY) {
      setError('PTV API keys not configured')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const stops = await searchStops(query, DEV_ID, API_KEY)
      setResults(stops.slice(0, 8))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  return { results, loading, error, search, setResults }
}

export function usePTVDepartures() {
  const [departures, setDepartures] = useState<PTDeparture[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDepartures = useCallback(async (
    stopId: number,
    routeType: number,
    deadline: Date,
    directionId: number | null = null
  ) => {
    if (!DEV_ID || !API_KEY) {
      setError('PTV API keys not configured — add them to .env')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { departures: raw, runs } = await getDepartures(stopId, routeType, directionId, 20, DEV_ID, API_KEY)

      const now = new Date()
      const mapped: PTDeparture[] = raw
        .filter(d => {
          const depTime = new Date(d.estimated_departure_utc || d.scheduled_departure_utc)
          return depTime > now
        })
        .map(d => {
          const depTime = new Date(d.estimated_departure_utc || d.scheduled_departure_utc)
          const run = runs[String(d.run_id)]
          const status = getSafetyStatus(depTime, deadline)
          return {
            routeName: run?.destination_name || 'Unknown',
            routeType,
            departureTime: formatTime(depTime),
            direction: run?.destination_name || '',
            runId: String(d.run_id),
            platform: d.platform_number || undefined,
            safetyStatus: status,
            minutesBuffer: Math.round((deadline.getTime() - depTime.getTime()) / 60000),
          }
        })
        .slice(0, 10)

      setDepartures(mapped)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch departures')
    } finally {
      setLoading(false)
    }
  }, [])

  return { departures, loading, error, fetchDepartures }
}

export async function findNearbyStops(lat: number, lng: number, maxDistanceM = 5000): Promise<PTVStop[]> {
  if (!DEV_ID || !API_KEY) return []
  return getStopsNearLocation(lat, lng, maxDistanceM, DEV_ID, API_KEY)
}
