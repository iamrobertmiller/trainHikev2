// Metro GTFS query engine — precomputed departures toward Southern Cross

import { haversineKm } from './geo'
import type { NearestStopResult } from './gtfs'

export interface MetroStop {
  id: string      // parent_station ID e.g. "vic:rail:BOX"
  name: string
  lat: number
  lng: number
  line: string    // e.g. "Belgrave/Lilydale"
}

type DayBucket = [number, number][]  // [dep_mins, arr_mins]

interface MetroData {
  feed: string
  generated: string
  stops: Record<string, { n: string; la: number; lo: number; li: string }>
  toSSX: Record<string, { wd: DayBucket; sa: DayBucket; su: DayBucket }>
  fromSSX?: Record<string, { wd: DayBucket; sa: DayBucket; su: DayBucket }>
}

let cached: MetroData | null = null
let loadPromise: Promise<MetroData> | null = null

export async function loadMetroGTFS(): Promise<MetroData> {
  if (cached) return cached
  if (loadPromise) return loadPromise
  loadPromise = fetch('/data/metro_gtfs.json')
    .then(r => r.json())
    .then(data => { cached = data; return data })
  return loadPromise
}

function minsToHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function hhmmToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function dayType(dateStr: string): 'wd' | 'sa' | 'su' {
  // dateStr: YYYYMMDD
  const d = new Date(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(4, 6)) - 1,
    parseInt(dateStr.slice(6, 8))
  )
  const dow = d.getDay() // 0=Sun, 6=Sat
  if (dow === 6) return 'sa'
  if (dow === 0) return 'su'
  return 'wd'
}

export function searchMetroStops(data: MetroData, query: string): MetroStop[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const results: MetroStop[] = []
  for (const [id, s] of Object.entries(data.stops)) {
    if (!s.n.toLowerCase().includes(q)) continue
    results.push({ id, name: s.n, lat: s.la, lng: s.lo, line: s.li })
  }
  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
    return aStarts - bStarts || a.name.localeCompare(b.name)
  })
  return results.slice(0, 10)
}

export interface MetroDepartureToSSX {
  departureTime: string   // HH:MM from home Metro stop
  arrivalSSX: string      // HH:MM arrive at Southern Cross
  lineName: string
}

export function findMetroDeparturesToSSX(
  data: MetroData,
  homeStopId: string,
  dateStr: string
): MetroDepartureToSSX[] {
  const bucket = data.toSSX[homeStopId]
  if (!bucket) return []
  const dt = dayType(dateStr)
  const pairs = bucket[dt]
  if (!pairs || pairs.length === 0) return []

  const stopInfo = data.stops[homeStopId]
  const lineName = stopInfo?.li ?? ''

  return pairs.map(([depMins, arrMins]) => ({
    departureTime: minsToHHMM(depMins),
    arrivalSSX: minsToHHMM(arrMins),
    lineName,
  }))
}

// Estimate travel time (mins) from a Metro station to SSX using toSSX data.
// Used as a proxy for outbound SSX→station journey time (symmetric approximation).
export function estimateMetroTravelMins(data: MetroData, stopId: string, dateStr: string): number {
  const dt = dayType(dateStr)
  const pairs = data.toSSX[stopId]?.[dt] ?? data.toSSX[stopId]?.wd ?? []
  if (pairs.length === 0) return 45  // conservative default
  const avg = pairs.reduce((s, [d, a]) => s + (a - d), 0) / pairs.length
  return Math.max(5, Math.round(avg))
}

// Find the nearest Metro station to a lat/lng within maxKm.
// Returns a NearestStopResult with network='metro' and metroLine set.
export function nearestMetroStop(data: MetroData, lat: number, lng: number, maxKm = 30): NearestStopResult | null {
  let bestId: string | null = null
  let bestDist = Infinity
  for (const [id, s] of Object.entries(data.stops)) {
    // Station must have toSSX services (proxy for being an active station)
    const bucket = data.toSSX[id]
    if (!bucket || (!bucket.wd.length && !bucket.sa.length && !bucket.su.length)) continue
    const d = haversineKm(lat, lng, s.la, s.lo)
    if (d < bestDist && d <= maxKm) {
      bestDist = d
      bestId = id
    }
  }
  if (!bestId) return null
  const s = data.stops[bestId]
  return {
    stop: { id: bestId, name: s.n, lat: s.la, lng: s.lo },
    distanceKm: Math.round(bestDist * 10) / 10,
    network: 'metro',
    metroLine: s.li,
  }
}

// Find the latest Metro departure that still arrives at SSX before vlDepartMins - bufferMins
export function latestMetroForVLine(
  data: MetroData,
  homeStopId: string,
  dateStr: string,
  vlDepartHHMM: string,
  bufferMins = 5
): MetroDepartureToSSX | null {
  const all = findMetroDeparturesToSSX(data, homeStopId, dateStr)
  const vlMins = hhmmToMins(vlDepartHHMM)
  let best: MetroDepartureToSSX | null = null
  for (const d of all) {
    const arrMins = hhmmToMins(d.arrivalSSX)
    if (arrMins + bufferMins <= vlMins) {
      best = d  // last one that fits (list is sorted ascending)
    }
  }
  return best
}

// ---- Outbound Metro (Southern Cross → trailhead station) --------------------

export interface MetroDepartureFromSSX {
  departureSSX: string    // HH:MM depart Southern Cross
  arrivalTime: string     // HH:MM arrive at trailhead Metro station
  lineName: string
}

const SSX_TURNAROUND_MINS = 10  // typical SSX platform turnaround

// Derive approximate outbound (SSX → station) timetable from existing inbound data.
// Metro trains arriving at SSX inbound turn around after ~10 minutes and run outbound
// on the same line, taking approximately the same journey time in reverse.
function deriveOutboundPairs(pairs: DayBucket): DayBucket {
  if (pairs.length === 0) return []
  const avgJourneyMins = Math.round(
    pairs.reduce((s, [dep, arr]) => s + (arr - dep), 0) / pairs.length
  )
  return pairs.map(([, arrSSX]) => {
    const ssxDep = arrSSX + SSX_TURNAROUND_MINS
    return [ssxDep, ssxDep + avgJourneyMins] as [number, number]
  }).sort((a, b) => a[0] - b[0])
}

export function findMetroDeparturesFromSSX(
  data: MetroData,
  trailheadStopId: string,
  dateStr: string,
  deadlineHHMM: string
): MetroDepartureFromSSX[] {
  const dt = dayType(dateStr)
  const deadlineMins = hhmmToMins(deadlineHHMM)
  const stopInfo = data.stops[trailheadStopId]
  const lineName = stopInfo?.li ?? ''

  // Use pre-built fromSSX if available (requires rebuild of metro_gtfs.json),
  // otherwise derive approximate outbound times from inbound toSSX data.
  const bucket = data.fromSSX?.[trailheadStopId] ?? null
  const pairs: DayBucket = bucket
    ? (bucket[dt] ?? [])
    : deriveOutboundPairs(data.toSSX[trailheadStopId]?.[dt] ?? data.toSSX[trailheadStopId]?.wd ?? [])

  return pairs
    .filter(([, arrMins]) => arrMins <= deadlineMins)
    .map(([depMins, arrMins]) => ({
      departureSSX: minsToHHMM(depMins),
      arrivalTime: minsToHHMM(arrMins),
      lineName,
    }))
}
