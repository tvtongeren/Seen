/// <reference types="vite/client" />
/**
 * Swarm / Foursquare integration.
 *
 * Uses the OAuth 2.0 **implicit flow** (`response_type=token`), which is the
 * flow intended for browser apps with no backend: Foursquare redirects back
 * with the token in the URL *fragment*, so no client secret is ever needed and
 * the token never travels through a server or appears in a query string.
 */
import type { SwarmCheckin, SwarmAuthState, Place } from '@/types'
import { saveCheckins, getCheckins, savePlace } from './db'
import { getClientId, getPlacesApiKey, getRedirectUri } from './config'

const AUTH_URL = 'https://foursquare.com/oauth2/authenticate'
const API_BASE = 'https://api.foursquare.com/v2'
const API_VERSION = '20240101'

const TOKEN_KEY = 'swarm_access_token'
const USER_KEY = 'swarm_user'

// ─── Token storage ────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): SwarmAuthState['user'] | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ─── OAuth (implicit flow) ────────────────────────────────────────────────────

export function buildAuthUrl(): string {
  const clientId = getClientId()
  if (!clientId) throw new Error('No Foursquare Client ID configured')
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',        // implicit flow — no client secret required
    redirect_uri: getRedirectUri(),
  })
  return `${AUTH_URL}?${params}`
}

/**
 * Reads an access token out of the URL fragment after Foursquare redirects
 * back, persists it, and scrubs it from the address bar.
 *
 * Returns the token, or null if this is not an OAuth callback.
 * Throws if Foursquare redirected back with an explicit error.
 */
export function captureTokenFromRedirect(): string | null {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  if (!hash) return null

  const params = new URLSearchParams(hash)

  const error = params.get('error')
  if (error) {
    scrubUrl()
    throw new Error(
      error === 'access_denied'
        ? 'Access was declined on the Foursquare consent screen.'
        : `Foursquare returned an error: ${params.get('error_description') || error}`
    )
  }

  const token = params.get('access_token')
  if (!token) return null

  localStorage.setItem(TOKEN_KEY, token)
  scrubUrl()
  return token
}

/** Remove the token fragment so it isn't left sitting in the address bar. */
function scrubUrl(): void {
  window.history.replaceState({}, '', window.location.pathname + window.location.search)
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function swarmGet<T>(
  path: string,
  token: string,
  extra: Record<string, string> = {}
): Promise<T> {
  const params = new URLSearchParams({ oauth_token: token, v: API_VERSION, ...extra })
  const res = await fetch(`${API_BASE}${path}?${params}`)

  let body: { meta?: { code?: number; errorDetail?: string }; response?: T }
  try {
    body = await res.json()
  } catch {
    throw new Error(`Swarm API returned a non-JSON response (HTTP ${res.status}).`)
  }

  if (res.status === 401 || body.meta?.code === 401) {
    clearAuth()
    throw new Error('Your Swarm session expired. Please reconnect.')
  }
  if (res.status === 403 || body.meta?.code === 403) {
    throw new Error(
      body.meta?.errorDetail ||
      'Foursquare denied access to check-in data for this app. Your developer app may not be approved for the Swarm (users/checkins) endpoints.'
    )
  }
  if (!res.ok || (body.meta?.code && body.meta.code !== 200)) {
    throw new Error(body.meta?.errorDetail || `Swarm API error (HTTP ${res.status}).`)
  }
  if (!body.response) throw new Error('Swarm API returned an empty response.')

  return body.response
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function fetchSelf(token: string): Promise<SwarmAuthState['user']> {
  const data = await swarmGet<{ user: SwarmAuthState['user'] }>('/users/self', token)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  return data.user
}

// ─── Check-ins ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 250

export async function syncCheckins(
  token: string,
  onProgress?: (n: number) => void
): Promise<SwarmCheckin[]> {
  const all: SwarmCheckin[] = []
  let offset = 0

  for (;;) {
    const data = await swarmGet<{ checkins: { items: SwarmCheckin[] } }>(
      '/users/self/checkins',
      token,
      { limit: String(PAGE_SIZE), offset: String(offset), sort: 'newestfirst' }
    )
    const items = data.checkins?.items ?? []
    if (!items.length) break

    all.push(...items)
    onProgress?.(all.length)

    if (items.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  await saveCheckins(all)
  await convertCheckinsToPlaces(all)
  return all
}

export async function loadCachedCheckins(): Promise<SwarmCheckin[]> {
  return getCheckins()
}

async function convertCheckinsToPlaces(checkins: SwarmCheckin[]): Promise<void> {
  const venueMap = new Map<string, Place>()

  for (const c of checkins) {
    const v = c.venue
    if (!v?.location) continue
    const ts = c.createdAt * 1000
    const existing = venueMap.get(v.id)

    if (existing) {
      existing.visitCount++
      if (ts < (existing.firstSeen ?? Infinity)) existing.firstSeen = ts
      if (ts > (existing.lastSeen ?? 0)) existing.lastSeen = ts
    } else {
      venueMap.set(v.id, {
        id: v.id,
        name: v.name,
        coords: { lat: v.location.lat, lng: v.location.lng },
        category: v.categories?.[0]?.name ?? 'Place',
        address: v.location.address,
        firstSeen: ts,
        lastSeen: ts,
        visitCount: 1,
        source: 'swarm',
      })
    }
  }

  await Promise.all([...venueMap.values()].map(savePlace))
}

// ─── Place search (Places API v3) ─────────────────────────────────────────────

export interface FSQPlace {
  fsq_id: string
  name: string
  geocodes: { main: { latitude: number; longitude: number } }
  location: { formatted_address: string }
  categories: Array<{ name: string }>
}

export async function searchPlaces(
  query: string,
  near: { lat: number; lng: number }
): Promise<FSQPlace[]> {
  const apiKey = getPlacesApiKey()
  if (!apiKey) return []

  const params = new URLSearchParams({
    query,
    ll: `${near.lat},${near.lng}`,
    limit: '10',
    fields: 'fsq_id,name,geocodes,location,categories',
  })

  const res = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
    headers: { Authorization: apiKey },
  })
  if (!res.ok) return []
  return (await res.json()).results ?? []
}
