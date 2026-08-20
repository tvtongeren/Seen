/// <reference types="vite/client" />
import type { SwarmCheckin, SwarmAuthState, Place } from '@/types'
import { saveCheckins, getCheckins, savePlace } from './db'

const CLIENT_ID = import.meta.env.VITE_FOURSQUARE_CLIENT_ID ?? ''
const CLIENT_SECRET = import.meta.env.VITE_FOURSQUARE_CLIENT_SECRET ?? ''
const REDIRECT_URI = import.meta.env.VITE_FOURSQUARE_REDIRECT_URI ?? `${window.location.origin}/auth/callback`
const AUTH_URL = 'https://foursquare.com/oauth2/authenticate'
const TOKEN_URL = 'https://foursquare.com/oauth2/access_token'
const API_BASE = 'https://api.foursquare.com/v2'
const API_VERSION = '20240101'

const TOKEN_KEY = 'swarm_access_token'
const USER_KEY = 'swarm_user'

export function getStoredToken(): string | null { return localStorage.getItem(TOKEN_KEY) }
export function getStoredUser(): SwarmAuthState['user'] | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY)
}

export function buildAuthUrl(): string {
  const params = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI })
  return `${AUTH_URL}?${params}`
}

export async function exchangeCode(code: string): Promise<string> {
  const params = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI, code })
  const res = await fetch(`${TOKEN_URL}?${params}`)
  const data = await res.json()
  if (!data.access_token) throw new Error('No access_token in response')
  localStorage.setItem(TOKEN_KEY, data.access_token)
  return data.access_token
}

async function swarmGet<T>(path: string, token: string, extra: Record<string, string> = {}): Promise<T> {
  const params = new URLSearchParams({ oauth_token: token, v: API_VERSION, ...extra })
  const res = await fetch(`${API_BASE}${path}?${params}`)
  if (!res.ok) throw new Error(`Swarm API error ${res.status}: ${path}`)
  return (await res.json()).response as T
}

export async function fetchSelf(token: string): Promise<SwarmAuthState['user']> {
  const data = await swarmGet<{ user: SwarmAuthState['user'] }>('/users/self', token)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  return data.user
}

export async function syncCheckins(token: string, onProgress?: (n: number) => void): Promise<SwarmCheckin[]> {
  const all: SwarmCheckin[] = []
  let offset = 0
  while (true) {
    const data = await swarmGet<{ checkins: { items: SwarmCheckin[] } }>(
      '/users/self/checkins', token, { limit: '250', offset: String(offset), sort: 'newestfirst' }
    )
    const items = data.checkins.items
    if (!items.length) break
    all.push(...items)
    onProgress?.(all.length)
    if (items.length < 250) break
    offset += 250
  }
  await saveCheckins(all)
  await convertCheckinsToPlaces(all)
  return all
}

export async function loadCachedCheckins(): Promise<SwarmCheckin[]> { return getCheckins() }

async function convertCheckinsToPlaces(checkins: SwarmCheckin[]): Promise<void> {
  const venueMap = new Map<string, Place>()
  for (const c of checkins) {
    const v = c.venue
    const existing = venueMap.get(v.id)
    if (existing) {
      existing.visitCount++
      if (c.createdAt * 1000 < (existing.firstSeen ?? Infinity)) existing.firstSeen = c.createdAt * 1000
      if (c.createdAt * 1000 > (existing.lastSeen ?? 0)) existing.lastSeen = c.createdAt * 1000
    } else {
      venueMap.set(v.id, {
        id: v.id, name: v.name,
        coords: { lat: v.location.lat, lng: v.location.lng },
        category: v.categories[0]?.name ?? 'Place',
        address: v.location.address,
        firstSeen: c.createdAt * 1000, lastSeen: c.createdAt * 1000,
        visitCount: 1, source: 'swarm',
      })
    }
  }
  await Promise.all([...venueMap.values()].map(savePlace))
}

export interface FSQPlace {
  fsq_id: string
  name: string
  geocodes: { main: { latitude: number; longitude: number } }
  location: { formatted_address: string }
  categories: Array<{ name: string }>
}

export async function searchPlaces(query: string, near: { lat: number; lng: number }): Promise<FSQPlace[]> {
  const apiKey = import.meta.env.VITE_FOURSQUARE_API_KEY ?? ''
  if (!apiKey) return []
  const params = new URLSearchParams({ query, ll: `${near.lat},${near.lng}`, limit: '10', fields: 'fsq_id,name,geocodes,location,categories' })
  const res = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, { headers: { Authorization: apiKey } })
  if (!res.ok) return []
  return (await res.json()).results ?? []
}
