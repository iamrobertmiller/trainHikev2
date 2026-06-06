// GTFS static query engine — works offline, no API credentials needed

import { haversineKm } from './geo'

export interface GTFSStop {
  id: string
  name: string
  lat: number
  lng: number
}

export interface GTFSTrip {
  routeId: string
  serviceId: string
  headsign: string
}

export interface GTFSService {
  days: number[]  // [mon,tue,wed,thu,fri,sat,sun]
  startDate: string
  endDate: string
}

export interface GTFSData {
  stops: Record<string, { n: string; la: number; lo: number }>
  routes: Record<string, { sn: string; ln: string }>
  services: Record<string, { days: number[]; sd: string; ed: string }>
  calExceptions: Record<string, Record<string, string>>
  trips: Record<string, { r: string; sv: string; h: string }>
  tripStops: Record<string, [number, string, string, string][]>  // [seq, stopId, dep, arr]
  stopTrips: Record<string, [string, string, number][]>           // [dep, tripId, seq]
  generated: string
}

let cached: GTFSData | null = null
let loadPromise: Promise<GTFSData> | null = null

export async function loadGTFS(): Promise<GTFSData> {
  if (cached) return cached
  if (loadPromise) return loadPromise
  loadPromise = fetch('/data/gtfs.json')
    .then(r => r.json())
    .then(data => { cached = data; return data })
  return loadPromise
}

export function searchStops(gtfs: GTFSData, query: string): GTFSStop[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  // Only include stops that have actual departures, deduplicate by name
  const seen = new Set<string>()
  const results: GTFSStop[] = []

  for (const [id, s] of Object.entries(gtfs.stops)) {
    if (!s.n.toLowerCase().includes(q)) continue
    if (!gtfs.stopTrips[id]?.length) continue  // skip stops with no services
    if (seen.has(s.n)) continue                 // deduplicate by name
    seen.add(s.n)
    results.push({ id, name: s.n, lat: s.la, lng: s.lo })
  }

  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
    return aStarts - bStarts || a.name.localeCompare(b.name)
  })
  return results.slice(0, 10)
}


export function nearestStop(gtfs: GTFSData, lat: number, lng: number, maxKm = 30): GTFSStop | null {
  let best: GTFSStop | null = null
  let bestDist = Infinity
  for (const [id, s] of Object.entries(gtfs.stops)) {
    if (!gtfs.stopTrips[id]?.length) continue  // skip stops with no services
    const d = haversineKm(lat, lng, s.la, s.lo)
    if (d < bestDist && d <= maxKm) {
      bestDist = d
      best = { id, name: s.n, lat: s.la, lng: s.lo }
    }
  }
  return best
}

export interface NearestStopResult {
  stop: GTFSStop
  distanceKm: number
}

export function nearestStopWithDistance(gtfs: GTFSData, lat: number, lng: number, maxKm = 30): NearestStopResult | null {
  let best: GTFSStop | null = null
  let bestDist = Infinity
  for (const [id, s] of Object.entries(gtfs.stops)) {
    if (!gtfs.stopTrips[id]?.length) continue  // skip stops with no services
    const d = haversineKm(lat, lng, s.la, s.lo)
    if (d < bestDist && d <= maxKm) {
      bestDist = d
      best = { id, name: s.n, lat: s.la, lng: s.lo }
    }
  }
  return best ? { stop: best, distanceKm: Math.round(bestDist * 10) / 10 } : null
}

function serviceRunsOn(gtfs: GTFSData, serviceId: string, dateStr: string): boolean {
  // dateStr format: YYYYMMDD
  const svc = gtfs.services[serviceId]
  if (!svc) return false

  // Check calendar_dates exceptions first
  const exceptions = gtfs.calExceptions[serviceId]
  if (exceptions?.[dateStr]) {
    return exceptions[dateStr] === '1'  // 1=added, 2=removed
  }

  if (dateStr < svc.sd || dateStr > svc.ed) return false

  const date = new Date(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(4, 6)) - 1,
    parseInt(dateStr.slice(6, 8))
  )
  const dow = (date.getDay() + 6) % 7  // Mon=0 … Sun=6
  return svc.days[dow] === 1
}

function timeStrToMinutes(t: string): number {
  // HH:MM format (may be >24 for overnight)
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// V/Line transfer hubs — all lines pass through these stations
const TRANSFER_STOPS = ['20043', '11212']  // Southern Cross, Flinders Street
const MIN_TRANSFER_MINS = 10  // minimum connection time in minutes

export interface Transfer {
  stopName: string
  arriveTime: string    // HH:MM arrive at transfer stop on leg 1
  departTime: string    // HH:MM depart transfer stop on leg 2
  headsign: string      // leg 2 destination
  tripId: string        // leg 2 trip
}

export interface Departure {
  departureTime: string     // HH:MM at home stop
  arrivalTime: string       // HH:MM at destination stop
  headsign: string
  routeName: string
  safetyStatus: 'safe' | 'tight' | 'risky'
  minutesBuffer: number
  tripId: string
  transfer?: Transfer       // present when journey requires a change
}

function makeDeparture(
  gtfs: GTFSData,
  dep: string, tripId: string, arrMins: number, deadlineMins: number,
  transfer?: Transfer
): Departure {
  const trip = gtfs.trips[tripId]
  const route = gtfs.routes[trip?.r ?? '']
  const bufferMins = deadlineMins - arrMins
  return {
    departureTime: dep,
    arrivalTime: minutesToTimeStr(arrMins),
    headsign: trip?.h ?? '',
    routeName: route?.ln || route?.sn || trip?.h || '',
    safetyStatus: bufferMins > 60 ? 'safe' : bufferMins > 0 ? 'tight' : 'risky',
    minutesBuffer: bufferMins,
    tripId,
    transfer,
  }
}

export function findDepartures(
  gtfs: GTFSData,
  fromStopId: string,
  toStopId: string,
  dateStr: string,
  deadlineHHMM: string
): Departure[] {
  const deadlineMins = timeStrToMinutes(deadlineHHMM)
  const fromTrips = gtfs.stopTrips[fromStopId]
  if (!fromTrips) return []

  const serviceCache = new Map<string, boolean>()
  const runsOn = (sv: string) => {
    if (!serviceCache.has(sv)) serviceCache.set(sv, serviceRunsOn(gtfs, sv, dateStr))
    return serviceCache.get(sv)!
  }

  const results: Departure[] = []
  const seen = new Set<string>()

  for (const [dep, tripId, fromSeq] of fromTrips) {
    const trip = gtfs.trips[tripId]
    if (!trip || !runsOn(trip.sv)) continue

    const tripStops = gtfs.tripStops[tripId]
    if (!tripStops) continue

    // --- Direct service ---
    const destEntry = tripStops.find(([seq, sid]) => sid === toStopId && seq > fromSeq)
    if (destEntry) {
      const arrMins = timeStrToMinutes(destEntry[3])
      const key = `${dep}-${destEntry[3]}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push(makeDeparture(gtfs, dep, tripId, arrMins, deadlineMins))
      }
      continue  // direct beats transfer for same departure time
    }

    // --- One-transfer via hub stations ---
    for (const hubId of TRANSFER_STOPS) {
      if (hubId === fromStopId || hubId === toStopId) continue

      const hubEntry = tripStops.find(([seq, sid]) => sid === hubId && seq > fromSeq)
      if (!hubEntry) continue

      const arriveHubMins = timeStrToMinutes(hubEntry[3])
      const earliestConnect = arriveHubMins + MIN_TRANSFER_MINS

      // Find connecting trips from hub to destination
      const hubTrips = gtfs.stopTrips[hubId]
      if (!hubTrips) continue

      for (const [dep2, tripId2, hubSeq] of hubTrips) {
        if (tripId2 === tripId) continue
        const dep2Mins = timeStrToMinutes(dep2)
        if (dep2Mins < earliestConnect) continue

        const trip2 = gtfs.trips[tripId2]
        if (!trip2 || !runsOn(trip2.sv)) continue

        const trip2Stops = gtfs.tripStops[tripId2]
        if (!trip2Stops) continue

        const destEntry2 = trip2Stops.find(([seq, sid]) => sid === toStopId && seq > hubSeq)
        if (!destEntry2) continue

        const arrMins = timeStrToMinutes(destEntry2[3])
        const key = `${dep}-${dep2}-${destEntry2[3]}`
        if (seen.has(key)) continue
        seen.add(key)

        const hubStop = gtfs.stops[hubId]
        results.push(makeDeparture(gtfs, dep, tripId, arrMins, deadlineMins, {
          stopName: hubStop?.n ?? 'Transfer',
          arriveTime: minutesToTimeStr(arriveHubMins),
          departTime: minutesToTimeStr(dep2Mins),
          headsign: trip2.h,
          tripId: tripId2,
        }))
        break  // take the earliest connecting service from this hub
      }
    }
  }

  results.sort((a, b) => timeStrToMinutes(a.departureTime) - timeStrToMinutes(b.departureTime))
  return results.slice(0, 12)
}
