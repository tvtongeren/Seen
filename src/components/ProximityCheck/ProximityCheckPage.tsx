import { useState, useCallback } from 'react'
import { Search, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { checkProximity, formatDistance } from '@/services/locationService'
import { searchPlaces, type FSQPlace } from '@/services/swarmService'
import type { ProximityResult, LocationPoint } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function PinDropper({ onDrop }: { onDrop: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onDrop(e.latlng.lat, e.latlng.lng) })
  return null
}

type CheckMode = 'search' | 'pin'

interface Props { currentPosition: LocationPoint | null }

export default function ProximityCheckPage({ currentPosition }: Props) {
  const [mode, setMode] = useState<CheckMode>('search')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FSQPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [result, setResult] = useState<ProximityResult | null>(null)
  const [checking, setChecking] = useState(false)

  const mapCenter: [number, number] = currentPosition
    ? [currentPosition.coords.lat, currentPosition.coords.lng]
    : [52.374, 4.89]

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    try { setSearchResults(await searchPlaces(query, currentPosition?.coords ?? { lat: 52.374, lng: 4.89 })) }
    finally { setSearching(false) }
  }, [query, currentPosition])

  const handleCheckFSQ = useCallback(async (place: FSQPlace) => {
    setChecking(true)
    setResult(await checkProximity({ lat: place.geocodes.main.latitude, lng: place.geocodes.main.longitude }, place.name))
    setSearchResults([])
    setChecking(false)
  }, [])

  const handleCheckPin = useCallback(async () => {
    if (!pinnedCoords) return
    setChecking(true)
    setResult(await checkProximity(pinnedCoords, 'Pinned location'))
    setChecking(false)
  }, [pinnedCoords])

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-y-auto">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold">Have I been here?</h1>
        <p className="text-slate-400 text-sm mt-1">Search for a place or drop a pin — Seen scans your history.</p>
      </div>

      <div className="px-5 mb-4">
        <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
          {(['search', 'pin'] as CheckMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? 'bg-brand-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
              {m === 'search' ? 'Search place' : 'Drop a pin'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'search' && (
        <div className="px-5 space-y-3">
          <div className="flex gap-2">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. Rijksmuseum, Central Park…"
              className="flex-1 bg-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={handleSearch} disabled={searching}
              className="bg-brand-500 text-white rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-medium disabled:opacity-60">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="bg-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-700">
              {searchResults.map(p => (
                <button key={p.fsq_id} onClick={() => handleCheckFSQ(p)} className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors">
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{p.categories[0]?.name} · {p.location.formatted_address}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'pin' && (
        <div className="px-5 space-y-3">
          <div className="rounded-2xl overflow-hidden h-56 border border-slate-700">
            <MapContainer center={mapCenter} zoom={13} className="w-full h-full" zoomControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap' />
              <PinDropper onDrop={(lat, lng) => setPinnedCoords({ lat, lng })} />
              {pinnedCoords && <Marker position={[pinnedCoords.lat, pinnedCoords.lng]} />}
            </MapContainer>
          </div>
          <p className="text-xs text-slate-500 text-center">Tap the map to drop a pin</p>
          {pinnedCoords && (
            <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
              <span className="text-sm text-slate-300 font-mono text-xs">{pinnedCoords.lat.toFixed(5)}, {pinnedCoords.lng.toFixed(5)}</span>
              <button onClick={handleCheckPin} disabled={checking}
                className="bg-brand-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 flex items-center gap-2">
                {checking && <Loader2 size={14} className="animate-spin" />}Check
              </button>
            </div>
          )}
        </div>
      )}

      {checking && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
          <Loader2 size={32} className="animate-spin text-brand-400" />
          <p className="text-sm">Scanning your history…</p>
        </div>
      )}

      {result && !checking && (
        <div className="px-5 mt-6 space-y-4 pb-8">
          <div className={`rounded-2xl p-5 border ${result.hasBeenWithin200m ? 'bg-emerald-950/60 border-emerald-700' : result.hasBeenWithin1km ? 'bg-amber-950/60 border-amber-700' : 'bg-slate-800 border-slate-700'}`}>
            <div className="flex items-start gap-3">
              {result.hasBeenWithin200m
                ? <CheckCircle2 size={24} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                : <XCircle size={24} className="text-slate-500 mt-0.5 flex-shrink-0" />}
              <div>
                <div className="font-bold text-lg leading-tight">{'name' in result.place ? result.place.name : ''}</div>
                <div className="text-sm mt-1">
                  {result.closestDistanceMetres < 0
                    ? <span className="text-slate-400">No location history yet — start tracking first.</span>
                    : result.hasBeenWithin50m
                    ? <span className="text-emerald-300">Yes — you've been right here (within 50 m).</span>
                    : result.hasBeenWithin200m
                    ? <span className="text-emerald-300">Yes — you've been very close ({formatDistance(result.closestDistanceMetres)} away).</span>
                    : result.hasBeenWithin1km
                    ? <span className="text-amber-300">Sort of — closest approach was {formatDistance(result.closestDistanceMetres)}.</span>
                    : <span className="text-slate-300">No — closest you've been is {formatDistance(result.closestDistanceMetres)}.</span>}
                </div>
              </div>
            </div>
          </div>

          {result.closestDistanceMetres >= 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wider">Closest approach</div>
                <div className="text-xl font-bold mt-1 text-brand-300">{formatDistance(result.closestDistanceMetres)}</div>
                {result.closestPoint && <div className="text-xs text-slate-500 mt-1">{formatDistanceToNow(result.closestPoint.timestamp, { addSuffix: true })}</div>}
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wider">Visits (≤100 m)</div>
                <div className="text-xl font-bold mt-1 text-brand-300">{result.visitDates.length}</div>
                {result.visitDates.length > 0 && <div className="text-xs text-slate-500 mt-1">First: {format(result.visitDates[0], 'dd MMM yyyy')}</div>}
              </div>
            </div>
          )}

          {result.visitDates.length > 0 && (
            <div className="bg-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Visit dates</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {[...result.visitDates].reverse().map(ts => (
                  <div key={ts} className="flex items-center gap-2 text-sm">
                    <Clock size={12} className="text-brand-400 flex-shrink-0" />
                    <span>{format(ts, 'EEEE, d MMMM yyyy')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => { setResult(null); setQuery(''); setPinnedCoords(null) }}
            className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-medium hover:border-slate-500 transition-colors">
            Check another place
          </button>
        </div>
      )}
    </div>
  )
}
