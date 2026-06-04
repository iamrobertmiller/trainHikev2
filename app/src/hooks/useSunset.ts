import SunCalc from 'suncalc'

export function getSunset(lat: number, lng: number, date: Date): Date {
  const times = SunCalc.getTimes(date, lat, lng)
  return times.sunset
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function getSafetyStatus(departureArrival: Date, deadline: Date): 'safe' | 'tight' | 'risky' {
  const bufferMs = deadline.getTime() - departureArrival.getTime()
  const bufferMin = bufferMs / 60000
  if (bufferMin > 60) return 'safe'
  if (bufferMin > 0) return 'tight'
  return 'risky'
}
