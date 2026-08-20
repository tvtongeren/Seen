/// <reference types="vite/client" />
/**
 * Runtime credential configuration.
 *
 * Seen is a fully static app with no backend, so there is nowhere safe to keep
 * a client secret. We therefore use the OAuth *implicit* flow, which needs only
 * a Client ID — a public value that is safe to expose.
 *
 * Credentials are read from (in priority order):
 *   1. localStorage  — entered by the user in Settings, never committed to git
 *   2. build-time env vars — convenient for self-hosted builds
 *
 * This means the deployed app ships with no credentials baked in at all.
 */

const CLIENT_ID_KEY = 'seen_fsq_client_id'
const API_KEY_KEY = 'seen_fsq_api_key'

/** Foursquare OAuth Client ID (public value, safe in a browser). */
export function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) || (import.meta.env.VITE_FOURSQUARE_CLIENT_ID ?? '')
}

export function setClientId(id: string): void {
  const trimmed = id.trim()
  if (trimmed) localStorage.setItem(CLIENT_ID_KEY, trimmed)
  else localStorage.removeItem(CLIENT_ID_KEY)
}

/** Foursquare Places API key — used only for place search on the Check tab. */
export function getPlacesApiKey(): string {
  return localStorage.getItem(API_KEY_KEY) || (import.meta.env.VITE_FOURSQUARE_API_KEY ?? '')
}

export function setPlacesApiKey(key: string): void {
  const trimmed = key.trim()
  if (trimmed) localStorage.setItem(API_KEY_KEY, trimmed)
  else localStorage.removeItem(API_KEY_KEY)
}

export function hasClientId(): boolean {
  return getClientId().length > 0
}

/**
 * The OAuth redirect target. Must match the Foursquare app's configured
 * redirect URI *exactly*.
 *
 * We redirect back to the app's own base path (e.g. https://user.github.io/Seen/)
 * rather than a sub-route, because a static host has no router to serve one.
 */
export function getRedirectUri(): string {
  const override = import.meta.env.VITE_FOURSQUARE_REDIRECT_URI
  if (override) return override
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}
