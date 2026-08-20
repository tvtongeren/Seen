import { saveLocation, getLocations } from './db'
import type { Coordinates, LocationPoint, ProximityResult } from '@/types'

export function haversineMetres(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`
  return `${(metres / 1000).toFixed(1)} km`
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

let watchId: number | null = null

export function startTracking(
  intervalSeconds: number,
  onPoint: (point: LocationPoint) => void,
  onError: (err: GeolocationPositionError) => void
): void {
  if (watchId !== null) return
  const handle = async (pos: GeolocationPosition) => {
    const point: LocationPoint = {
      id: newId(),
      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    }
    await saveLocation(point)
    onPoint(point)
  }
  watchId = navigator.geolocation.watchPosition(handle, onError, {
    enableHighAccuracy: true,
    maximumAge: intervalSeconds * 1000,
    timeout: 15_000,
  })
}

export function stopTracking(): void {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null }
}

export function isTracking(): boolean { return watchId !== null }

export function getCurrentPosition(): Promise<LocationPoint> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        id: newId(),
        coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      }),
      reject,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 }
    )
  })
}

export async function checkProximity(
  target: Coordinates,
  targetName: string
): Promise<ProximityResult> {
  const history = await getLocations()
  let closestPoint: LocationPoint | null = null
  let closestDistance = Infinity
  const visitDates: number[] = []

  for (const point of history) {
    const dist = haversineMetres(point.coords, target)
    if (dist < closestDistance) { closestDistance = dist; closestPoint = point }
    if (dist <= 100) visitDates.push(point.timestamp)
  }

  const uniqueDays = [
    ...new Set(visitDates.map(ts => new Date(ts).toDateString())),
  ].map(d => new Date(d).getTime())

  return {
    place: { name: targetName, coords: target },
    closestPoint,
    closestDistanceMetres: closestDistance === Infinity ? -1 : closestDistance,
    hasBeenWithin50m: closestDistance <= 50,
    hasBeenWithin200m: closestDistance <= 200,
    hasBeenWithin1km: closestDistance <= 1000,
    visitDates: uniqueDays,
  }
}
