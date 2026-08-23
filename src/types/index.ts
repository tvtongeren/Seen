export interface Coordinates {
  lat: number
  lng: number
}

export interface LocationPoint {
  id: string
  coords: Coordinates
  accuracy: number
  timestamp: number
  label?: string
}

export interface Place {
  id: string
  name: string
  coords: Coordinates
  category: string
  categoryIcon?: string
  address?: string
  firstSeen?: number
  lastSeen?: number
  visitCount: number
  source: 'swarm' | 'foursquare' | 'manual' | 'detected'
}

/**
 * A persistent "you've been here" marker — one per ~10m radius, deduplicated
 * across every tracked point that ever fell within it. Deliberately lightweight:
 * a place visited a thousand times (home, gym) costs the same handful of numbers
 * as one visited once, because only a bounded sample of visit dates is kept.
 */
export interface Spot {
  id: string
  coords: Coordinates
  visitCount: number
  firstSeen: number
  lastSeen: number
  /** Calendar-day timestamps, capped at MAX_SAMPLE_DATES — a sample, not a full log. */
  sampleDates: number[]
}

export interface SwarmCheckin {
  id: string
  createdAt: number
  venue: {
    id: string
    name: string
    location: {
      lat: number
      lng: number
      city?: string
      country?: string
      address?: string
    }
    categories: Array<{ id: string; name: string; icon?: string }>
  }
  photos?: string[]
  likes?: number
}

export interface SwarmAuthState {
  accessToken: string | null
  user: { id: string; firstName: string; lastName: string; photo?: string } | null
}

export interface GeoAd {
  id: string
  title: string
  description: string
  ctaLabel: string
  ctaUrl: string
  category: 'food' | 'retail' | 'travel' | 'entertainment' | 'generic'
  advertiser: string
  distanceHint?: string
}

export type Tab = 'map' | 'history' | 'check' | 'swarm' | 'settings'

export interface AppSettings {
  trackingEnabled: boolean
  trackingIntervalSeconds: number
  swarmSync: boolean
  adsEnabled: boolean
  visitRadiusMetres: number
}
