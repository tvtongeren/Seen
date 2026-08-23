/**
 * Free place search via Photon (komoot's public geocoder, built on
 * OpenStreetMap data).
 *
 * Previously used Nominatim's demo server, which — unlike Photon — isn't
 * reliably CORS-enabled or friendly to direct browser calls from arbitrary
 * static sites; it's meant for light server-side use and can silently block
 * or drop cross-origin requests. Photon is explicitly designed to be
 * embedded in client apps (it's what komoot's own apps use), needs no key,
 * and works directly from the browser.
 */
export interface SearchPlace {
  id: string
  name: string
  address: string
  category: string
  coords: { lat: number; lng: number }
}

export class SearchError extends Error {}

interface PhotonFeature {
  geometry?: { coordinates?: unknown }
  properties?: Record<string, unknown>
}

export async function searchPlacesFree(
  query: string,
  near: { lat: number; lng: number }
): Promise<SearchPlace[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const params = new URLSearchParams({
    q: trimmed,
    lat: String(near.lat),
    lon: String(near.lng),
    limit: '8',
  })

  let res: Response
  try {
    res = await fetch(`https://photon.komoot.io/api/?${params}`)
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

  const features = (data as { features?: unknown })?.features
  if (!Array.isArray(features)) {
    throw new SearchError('Place search returned an unexpected response.')
  }

  return features
    .map((raw): SearchPlace | null => {
      const f = raw as PhotonFeature
      const coords = f.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) return null

      // GeoJSON order is [lon, lat], not [lat, lon].
      const lng = Number(coords[0])
      const lat = Number(coords[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

      const props = f.properties ?? {}
      const name = (props.name as string) || (props.street as string) || 'Unnamed place'
      const address = [props.street, props.housenumber, props.city, props.state, props.country]
        .filter(Boolean)
        .join(', ') || name
      const category = String(props.osm_value ?? props.osm_key ?? 'place').replace(/_/g, ' ')

      return {
        id: String(props.osm_id ?? `${lat},${lng}`),
        name,
        address,
        category,
        coords: { lat, lng },
      }
    })
    .filter((p): p is SearchPlace => p !== null)
}
