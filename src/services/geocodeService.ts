/**
 * Free place search via OpenStreetMap's Nominatim geocoder.
 *
 * The Check tab previously required a Foursquare Places API key that almost
 * no one had configured — search silently returned zero results with no
 * explanation, which just looked broken. Nominatim needs no key, no signup,
 * and no CORS workaround, so search works immediately for everyone.
 */
export interface SearchPlace {
  id: string
  name: string
  address: string
  category: string
  coords: { lat: number; lng: number }
}

export class SearchError extends Error {}

export async function searchPlacesFree(
  query: string,
  near: { lat: number; lng: number }
): Promise<SearchPlace[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  // Bias results toward the user's area without excluding matches elsewhere.
  const delta = 0.35
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: trimmed,
    limit: '8',
    addressdetails: '0',
    viewbox: `${near.lng - delta},${near.lat + delta},${near.lng + delta},${near.lat - delta}`,
    bounded: '0',
  })

  let res: Response
  try {
    res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new SearchError('Could not reach the place search service — check your connection.')
  }

  if (!res.ok) {
    throw new SearchError(`Place search failed (HTTP ${res.status}). Try again in a moment.`)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new SearchError('Place search returned an unreadable response.')
  }
  if (!Array.isArray(data)) {
    throw new SearchError('Place search returned an unexpected response.')
  }

  return data
    .map((raw): SearchPlace | null => {
      const r = raw as Record<string, unknown>
      const lat = parseFloat(String(r.lat))
      const lng = parseFloat(String(r.lon))
      const displayName = typeof r.display_name === 'string' ? r.display_name : null
      if (!displayName || !Number.isFinite(lat) || !Number.isFinite(lng)) return null

      return {
        id: String(r.place_id ?? `${lat},${lng}`),
        name: displayName.split(',')[0],
        address: displayName,
        category: typeof r.type === 'string' ? r.type.replace(/_/g, ' ') : String(r.class ?? 'Place'),
        coords: { lat, lng },
      }
    })
    .filter((p): p is SearchPlace => p !== null)
}
