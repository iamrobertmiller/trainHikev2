// Naismith's Rule: 1hr per 5km + 1hr per 600m ascent
export function naismithMinutes(distanceKm: number, elevationGainM = 0): number {
  return (distanceKm / 5) * 60 + (elevationGainM / 600) * 60
}

// Deadline = sunset minus hiking time minus safety buffer
export function arrivalDeadline(sunsetMs: number, distanceKm: number, elevationGainM = 0, bufferMinutes = 30): Date {
  const hikingMs = naismithMinutes(distanceKm, elevationGainM) * 60 * 1000
  const bufferMs = bufferMinutes * 60 * 1000
  return new Date(sunsetMs - hikingMs - bufferMs)
}
