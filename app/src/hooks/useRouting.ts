import { useState, useEffect } from 'react'
import type { CustomWaypoint } from '../types'
import { routeLengthKm } from '../lib/geo'

export interface RoutingResult {
  routedCoords: [number, number][]
  distanceKm: number
  loading: boolean
}

export function useRouting(waypoints: CustomWaypoint[]): RoutingResult {
  const [routedCoords, setRoutedCoords] = useState<[number, number][]>([])
  const [distanceKm, setDistanceKm] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (waypoints.length < 2) {
      setRoutedCoords(waypoints.map(wp => [wp.lng, wp.lat]))
      setDistanceKm(0)
      return
    }

    const controller = new AbortController()
    setLoading(true)

    const coordStr = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/foot/${coordStr}?overview=full&geometries=geojson`

    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.code === 'Ok' && data.routes?.[0]) {
          const route = data.routes[0]
          setRoutedCoords(route.geometry.coordinates as [number, number][])
          setDistanceKm(route.distance / 1000)
        } else {
          setRoutedCoords(waypoints.map(wp => [wp.lng, wp.lat]))
          setDistanceKm(routeLengthKm(waypoints))
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRoutedCoords(waypoints.map(wp => [wp.lng, wp.lat]))
          setDistanceKm(routeLengthKm(waypoints))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [waypoints]) // eslint-disable-line react-hooks/exhaustive-deps

  return { routedCoords, distanceKm, loading }
}
