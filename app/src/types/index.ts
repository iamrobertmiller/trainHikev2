export interface Campsite {
  id: number
  name: string
  asset_desc: string
  park_name: string
  park_id: number
  lat: number
  lng: number
  // enriched fields (populated from Supabase or defaults)
  toilets?: boolean
  water?: boolean
  fire_pits?: boolean
  shelter?: boolean
  booking_required?: boolean
  booking_url?: string
  fee_aud?: number
  capacity?: number
  difficulty?: 'easy' | 'moderate' | 'hard'
  notes?: string
}

export interface Trail {
  id: number
  name: string
  source: 'gpx' | 'kml'
  length_km: number
  trailhead_lat: number
  trailhead_lng: number
  park_name?: string
  elevation_gain_m?: number
  difficulty?: 'easy' | 'moderate' | 'hard'
  nearest_pt_stop_id?: string
  nearest_pt_stop_name?: string
}

export interface TrailGeoJSON {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: Trail
}

export interface PTDeparture {
  routeName: string
  routeType: number
  departureTime: string
  estimatedArrivalTime?: string
  platform?: string
  direction: string
  runId: string
  safetyStatus: 'safe' | 'tight' | 'risky' | 'unknown'
  minutesBuffer?: number
}

export interface Profile {
  homeStopName: string
  homeStopId: string
  homeStopRouteType: number
  homeSuburb?: string
}

export type AppMode = 'plan' | 'navigate'

export interface CustomWaypoint {
  id: string
  lat: number
  lng: number
}

export interface UserLocation {
  lat: number
  lng: number
  accuracy: number
}

export interface SavedTrip {
  id: string
  campsiteId: number
  trailId: number | null
  date: string
  savedAt: string
  customWaypoints?: CustomWaypoint[]
  chosenDepartureTime?: string
  chosenArrivalTime?: string    // HH:MM at trailhead stop
  trailheadStopName?: string
  trailheadStopId?: string      // GTFS stop ID of trailhead
  campsite?: Campsite
  trail?: Trail | null
}

export interface SharedTripPayload {
  campsiteId: number
  campsiteName: string
  campsiteLat: number
  campsiteLng: number
  campsiteParkName?: string
  trailName?: string
  date: string             // YYYY-MM-DD
  meetupStopName: string   // Trailhead V/Line station
  meetupStopId: string     // GTFS stop ID
  meetupTime: string       // HH:MM — when original hiker arrives
}

export interface TrailPOI {
  name: string
  lng: number
  lat: number
}

export interface Hut {
  name: string
  park: string
  lat: number
  lng: number
}

export interface WaterFrontage {
  name: string
  river: string
  location: string
  url: string
  lat: number
  lng: number
}
