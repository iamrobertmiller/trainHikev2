// Metro GTFS query engine — precomputed departures toward Southern Cross

export interface MetroStop {
  id: string      // parent_station ID e.g. "vic:rail:BOX"
  name: string
  lat: number
  lng: number
  line: string    // e.g. "Belgrave/Lilydale"
}

interface MetroData {
  feed: string
  generated: string
  stops: Record<string, { n: string; la: number; lo: number; li: string }>
  toSSX: Record<string, {
    wd: [number, number][]  // [dep_mins, arr_ssx_mins] weekday
    sa: [number, number][]  // saturday
    su: [number, number][]  // sunday
  }>
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
