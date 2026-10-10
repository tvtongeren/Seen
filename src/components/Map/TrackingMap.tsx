import { useEffect } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Coordinates, LocationPoint, SwarmCheckin, Spot } from '@/types'
import { SPOT_RADIUS_METRES } from '@/services/spotService'
import SpotPopup from './SpotPopup'
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

const targetIcon = L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;background:#f43f5e;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg) translate(-1px,-1px);box-shadow:0 3px 8px rgba(0,0,0,.5)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onClick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

/** Reports when the user drags the map by hand, so the parent can stop following the live position. */
function DragHandler({ onDrag }: { onDrag?: () => void }) {
  useMapEvents({ dragstart: () => onDrag?.() })
  return null
}

/**
 * Keeps the map centred on the user — mounted only while following, so new
 * position fixes never yank the map away from a place the user is exploring.
 * Mounting it (e.g. via the locate button) re-centres immediately.
 */
function RecenterControl({ position }: { position: Coordinates }) {
  const map = useMap()
  useEffect(() => {
    map.setView([position.lat, position.lng], map.getZoom(), { animate: true })
  }, [map, position.lat, position.lng])
  return null
}

/** Pans/zooms to a searched or tapped location, the way Google Maps flies to a search result. */
function FlyToTarget({ target }: { target: Coordinates | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { duration: 0.8 })
  }, [map, target?.lat, target?.lng])
  return null
}

interface Props {
  spots: Spot[]
  currentPosition: LocationPoint | null
  checkins: SwarmCheckin[]
  /** A searched or tapped place — shows a pin and stops auto-following the live position. */
  target?: Coordinates | null
  /** Whether the map should keep re-centring on each new position fix. */
  following?: boolean
  onMapClick?: (lat: number, lng: number) => void
  /** Called when the user drags the map, i.e. wants to look somewhere else. */
  onUserPan?: () => void
}

export default function TrackingMap({ spots, currentPosition, checkins, target = null, following = true, onMapClick, onUserPan }: Props) {
  const defaultCenter: [number, number] = currentPosition
    ? [currentPosition.coords.lat, currentPosition.coords.lng]
    : [52.374, 4.89]

  return (
    <MapContainer center={defaultCenter} zoom={14} className="w-full h-full" zoomControl={false}>
      <ClickHandler onClick={onMapClick} />
      <DragHandler onDrag={onUserPan} />
      {/* Standard OSM tiles need no API key (CARTO's dark basemap now serves
          "API Key Required" placeholders); the dark look comes from a CSS filter. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        className="dark-tiles"
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
          {following && !target && <RecenterControl position={currentPosition.coords} />}
        </>
      )}
      {target && <Marker position={[target.lat, target.lng]} icon={targetIcon} />}
      <FlyToTarget target={target} />
    </MapContainer>
  )
}
