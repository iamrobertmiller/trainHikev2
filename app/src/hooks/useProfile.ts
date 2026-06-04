import { useState } from 'react'
import type { Profile, SavedTrip } from '../types'

const PROFILE_KEY = 'trainhike_profile'
const TRIPS_KEY = 'trainhike_trips'

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const saveProfile = (p: Profile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
    setProfile(p)
  }

  const clearProfile = () => {
    localStorage.removeItem(PROFILE_KEY)
    setProfile(null)
  }

  return { profile, saveProfile, clearProfile }
}

export function useSavedTrips() {
  const [trips, setTrips] = useState<SavedTrip[]>(() => {
    try {
      const raw = localStorage.getItem(TRIPS_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const saveTrip = (trip: Omit<SavedTrip, 'id' | 'savedAt'>) => {
    const full: SavedTrip = {
      ...trip,
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
    }
    const updated = [...trips, full]
    localStorage.setItem(TRIPS_KEY, JSON.stringify(updated))
    setTrips(updated)
    return full
  }

  const removeTrip = (id: string) => {
    const updated = trips.filter(t => t.id !== id)
    localStorage.setItem(TRIPS_KEY, JSON.stringify(updated))
    setTrips(updated)
  }

  return { trips, saveTrip, removeTrip }
}
