import { useEffect } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Coordinates, LocationPoint, Spot } from '@/types'
import { SPOT_RADIUS_METRES } from '@/services/spotService'
import SpotPopup from '../Map/SpotPopup'
import 'leaflet/dist/leaflet.css'

const targetIcon = L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;background:#f43f5e;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg) translate(-1px,-1px);box-shadow:0 3px 8px rgba(0,0,0,.5)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
})

/** Pans/zooms to a searched or tapped location, the way Google Maps flies to a search result. */
function FlyToTarget({ target }: { target: Coordinates | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { duration: 0.8 })
  }, [map, target?.lat, target?.lng])
  return null
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onClick(e.latlng.lat, e.latlng.lng) })
  return null
}

interface Props {
  spots: Spot[]
  currentPosition: LocationPoint | null
  target: Coordinates | null
  onMapClick: (lat: number, lng: number) => void
}

export default function SearchMap({ spots, currentPosition, target, onMapClick }: Props) {
  const center: [number, number] = target
    ? [target.lat, target.lng]
    : currentPosition
    ? [currentPosition.coords.lat, currentPosition.coords.lng]
    : [52.374, 4.89]

  return (
    <MapContainer center={center} zoom={14} className="w-full h-full" zoomControl={false}>
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
      {currentPosition && (
        <Circle
          center={[currentPosition.coords.lat, currentPosition.coords.lng]}
          radius={Math.max(currentPosition.accuracy, 3)}
          pathOptions={{ color: '#38bdf8', fillColor: '#0ea5e9', fillOpacity: 0.9, weight: 2 }}
        />
      )}
      {target && <Marker position={[target.lat, target.lng]} icon={targetIcon} />}
      <FlyToTarget target={target} />
    </MapContainer>
  )
}
