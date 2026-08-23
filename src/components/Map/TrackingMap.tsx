import { useEffect } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { LocationPoint, SwarmCheckin, Spot } from '@/types'
import { SPOT_RADIUS_METRES } from '@/services/spotService'
import { format } from 'date-fns'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const swarmIcon = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;background:#f97316;border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
})

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onClick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

function RecenterControl({ position }: { position: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => {
    map.setView([position.lat, position.lng], map.getZoom(), { animate: true })
  }, [map, position.lat, position.lng])
  return null
}

/**
 * Spots visited more than 10 times (home, gym, …) show a summary rather than
 * every date — the underlying record stays light (a sample, not a full log),
 * and the popup mirrors that rather than pretending to list something it
 * doesn't have.
 */
function SpotPopup({ spot }: { spot: Spot }) {
  const showFullList = spot.visitCount <= 10
  return (
    <div className="text-sm min-w-[140px]">
      <div className="font-semibold mb-1.5">
        {spot.visitCount} visit{spot.visitCount !== 1 ? 's' : ''}
      </div>
      {showFullList ? (
        <ul className="text-xs text-gray-600 space-y-0.5">
          {spot.sampleDates.map(d => <li key={d}>{format(d, 'd MMM yyyy')}</li>)}
        </ul>
      ) : (
        <div className="text-xs text-gray-600 space-y-0.5">
          <div>First seen {format(spot.firstSeen, 'd MMM yyyy')}</div>
          <div>Last seen {format(spot.lastSeen, 'd MMM yyyy')}</div>
          <div className="text-gray-400 mt-1 italic">Frequent spot — summary only</div>
        </div>
      )}
    </div>
  )
}

interface Props {
  spots: Spot[]
  currentPosition: LocationPoint | null
  checkins: SwarmCheckin[]
  onMapClick?: (lat: number, lng: number) => void
}

export default function TrackingMap({ spots, currentPosition, checkins, onMapClick }: Props) {
  const defaultCenter: [number, number] = currentPosition
    ? [currentPosition.coords.lat, currentPosition.coords.lng]
    : [52.374, 4.89]

  return (
    <MapContainer center={defaultCenter} zoom={14} className="w-full h-full" zoomControl={false}>
      <ClickHandler onClick={onMapClick} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {spots.map(spot => (
        <Circle
          key={spot.id}
          center={[spot.coords.lat, spot.coords.lng]}
          radius={SPOT_RADIUS_METRES}
          pathOptions={{ color: '#4ade80', fillColor: '#4ade80', fillOpacity: 0.6, weight: 1.5 }}
        >
          <Popup><SpotPopup spot={spot} /></Popup>
        </Circle>
      ))}
      {checkins.map(c => (
        <Marker key={c.id} position={[c.venue.location.lat, c.venue.location.lng]} icon={swarmIcon}>
          <Popup>
            <div className="text-sm font-medium">{c.venue.name}</div>
            <div className="text-xs text-gray-500">{c.venue.categories[0]?.name}</div>
            <div className="text-xs text-gray-400 mt-1">{new Date(c.createdAt * 1000).toLocaleDateString()}</div>
          </Popup>
        </Marker>
      ))}
      {currentPosition && (
        <>
          <Circle
            center={[currentPosition.coords.lat, currentPosition.coords.lng]}
            radius={Math.max(currentPosition.accuracy, 3)}
            pathOptions={{ color: '#38bdf8', fillColor: '#0ea5e9', fillOpacity: 0.9, weight: 2 }}
          />
          <RecenterControl position={currentPosition.coords} />
        </>
      )}
    </MapContainer>
  )
}
