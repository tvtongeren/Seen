/**
 * "Have I been here before?" — Google Maps–style: search stays on top of the
 * live map, a result flies the map to that place, and the answer is read
 * straight off the green spot dots already drawn there rather than opening a
 * separate results screen.
 */
import { useState, useEffect, useCallback } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import SearchMap from './SearchMap'
import { searchPlacesFree, type SearchPlace } from '@/services/geocodeService'
import { checkProximityAgainstSpots } from '@/services/spotService'
import { formatDistance } from '@/services/locationService'
import type { LocationPoint, Spot, Coordinates } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'

interface Props {
  currentPosition: LocationPoint | null
  spots: Spot[]
}

const FALLBACK_CENTER: Coordinates = { lat: 52.374, lng: 4.89 } // used only if GPS has never fixed

export default function ProximityCheckPage({ currentPosition, spots }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [target, setTarget] = useState<{ name: string; coords: Coordinates } | null>(null)

  const biasCoords = currentPosition?.coords ?? FALLBACK_CENTER

  // Search-as-you-type, debounced — the dropdown behaves like Google Maps' own search box.
  useEffect(() => {
    const q = query.trim()
    if (!q || (target && target.name === q)) { setSuggestions([]); setSearchError(null); return }

    setSearching(true)
    setSearchError(null)
    const handle = setTimeout(async () => {
      try {
        const results = await searchPlacesFree(q, biasCoords)
        setSuggestions(results)
        if (results.length === 0) setSearchError(`No matches for "${q}".`)
      } catch (err) {
        setSuggestions([])
        setSearchError(err instanceof Error ? err.message : String(err))
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => clearTimeout(handle)
  }, [query, biasCoords.lat, biasCoords.lng, target])

  const selectPlace = useCallback((name: string, coords: Coordinates) => {
    setTarget({ name, coords })
    setQuery(name)
    setSuggestions([])
    setSearchError(null)
  }, [])

  // Tapping the map is the equivalent of a long-press pin drop in Google Maps.
  const handleMapClick = useCallback((lat: number, lng: number) => {
    selectPlace('Pinned location', { lat, lng })
  }, [selectPlace])

  const clearTarget = useCallback(() => {
    setTarget(null)
    setQuery('')
    setSuggestions([])
    setSearchError(null)
  }, [])

  // Derived, not stored: recomputes live if spots change while this screen is open
  // (e.g. tracking adds a new dot near the searched place).
  const result = target ? checkProximityAgainstSpots(target.coords, target.name, spots) : null

  return (
    <div className="relative w-full h-full bg-slate-900">
      <div className="absolute inset-0">
        <SearchMap
          spots={spots}
          currentPosition={currentPosition}
          target={target?.coords ?? null}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Floating search bar, Google Maps style */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <div className="bg-slate-900/95 backdrop-blur rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <Search size={18} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); if (target) setTarget(null) }}
              placeholder="Search a place, or tap the map…"
              className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none min-w-0"
            />
            {searching && <Loader2 size={16} className="animate-spin text-brand-400 flex-shrink-0" />}
            {!searching && (query || target) && (
              <button onClick={clearTarget} className="text-slate-500 hover:text-white flex-shrink-0" aria-label="Clear">
                <X size={16} />
              </button>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="border-t border-slate-700 divide-y divide-slate-700 max-h-64 overflow-y-auto">
              {suggestions.map(p => (
                <button
                  key={p.id} onClick={() => selectPlace(p.name, p.coords)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors"
                >
                  <div className="text-sm font-medium text-white truncate">{p.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">{p.category} · {p.address}</div>
                </button>
              ))}
            </div>
          )}

          {searchError && suggestions.length === 0 && (
            <div className="border-t border-slate-700 px-4 py-3 text-xs text-amber-300">{searchError}</div>
          )}
        </div>
      </div>

      {/* Result card, Google Maps style — floats over the map instead of navigating away */}
      {result && target && (
        <div className="absolute bottom-6 left-4 right-4 z-[1000]">
          <div
            className={`rounded-2xl p-4 shadow-xl border backdrop-blur ${
              result.hasBeenHere ? 'bg-emerald-950/95 border-emerald-700'
              : result.hasBeenNearby ? 'bg-amber-950/95 border-amber-700'
              : 'bg-slate-900/95 border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-white truncate">{target.name}</div>
                <div className="text-sm mt-1">
                  {result.distanceMetres < 0 ? (
                    <span className="text-slate-400">No visited places recorded yet.</span>
                  ) : result.hasBeenHere ? (
                    <span className="text-emerald-300">Yes — you've been right here.</span>
                  ) : result.hasBeenNearby ? (
                    <span className="text-amber-300">Close — {formatDistance(result.distanceMetres)} from a place you've visited.</span>
                  ) : (
                    <span className="text-slate-300">Not yet — closest visited spot is {formatDistance(result.distanceMetres)} away.</span>
                  )}
                </div>
                {result.nearestSpot && (
                  <div className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {result.nearestSpot.visitCount} visit{result.nearestSpot.visitCount !== 1 ? 's' : ''}
                    {result.nearestSpot.visitCount <= 10 ? (
                      <> · {result.nearestSpot.sampleDates.map(d => format(d, 'd MMM yyyy')).join(', ')}</>
                    ) : (
                      <> · first {format(result.nearestSpot.firstSeen, 'd MMM yyyy')} · last {formatDistanceToNow(result.nearestSpot.lastSeen, { addSuffix: true })}</>
                    )}
                  </div>
                )}
              </div>
              <button onClick={clearTarget} className="text-slate-400 hover:text-white flex-shrink-0" aria-label="Dismiss">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
