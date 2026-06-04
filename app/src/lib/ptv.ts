// PTV Timetable API v3 — HMAC-SHA1 signed requests

const BASE = 'https://timetableapi.ptv.vic.gov.au'

async function sign(path: string, devId: string, apiKey: string): Promise<string> {
  const withDev = `${path}${path.includes('?') ? '&' : '?'}devid=${devId}`
  const encoder = new TextEncoder()
  const keyData = encoder.encode(apiKey)
  const msgData = encoder.encode(withDev)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${BASE}${withDev}&signature=${hex.toUpperCase()}`
}

export interface PTVStop {
  stop_id: number
  stop_name: string
  stop_latitude: number
  stop_longitude: number
  route_type: number
}

export interface PTVDeparture {
  scheduled_departure_utc: string
  estimated_departure_utc: string | null
  platform_number: string | null
  run_id: number
  direction_id: number
  route_id: number
}

export interface PTVRun {
  destination_name: string
  run_id: number
}

export async function searchStops(query: string, devId: string, apiKey: string): Promise<PTVStop[]> {
  const path = `/v3/search/${encodeURIComponent(query)}?include_outlets=false`
  const url = await sign(path, devId, apiKey)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PTV search failed: ${res.status}`)
  const data = await res.json()
  return data.stops || []
}

export async function getStopsNearLocation(
  lat: number, lng: number, maxDistance: number,
  devId: string, apiKey: string
): Promise<PTVStop[]> {
  const path = `/v3/stops/location/${lat},${lng}?max_distance=${maxDistance}`
  const url = await sign(path, devId, apiKey)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PTV location stops failed: ${res.status}`)
  const data = await res.json()
  return data.stops || []
}

export async function getDepartures(
  stopId: number, routeType: number, directionId: number | null,
  maxResults: number,
  devId: string, apiKey: string
): Promise<{ departures: PTVDeparture[]; runs: Record<string, PTVRun> }> {
  let path = `/v3/departures/route_type/${routeType}/stop/${stopId}?max_results=${maxResults}&expand=Run`
  if (directionId !== null) path += `&direction_id=${directionId}`
  const url = await sign(path, devId, apiKey)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PTV departures failed: ${res.status}`)
  const data = await res.json()
  return { departures: data.departures || [], runs: data.runs || {} }
}

export const ROUTE_TYPE_LABELS: Record<number, string> = {
  0: 'Tram',
  1: 'Train',
  2: 'V/Line',
  3: 'Bus',
  4: 'Night Bus',
}
