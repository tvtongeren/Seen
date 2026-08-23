import { openDB, type IDBPDatabase } from 'idb'
import type { LocationPoint, Place, SwarmCheckin, AppSettings, Spot } from '@/types'

const DB_NAME = 'seen-db'
const DB_VERSION = 2

export type SeenDB = {
  locations: { key: string; value: LocationPoint; indexes: { byTimestamp: number } }
  places: { key: string; value: Place; indexes: { byLastSeen: number } }
  checkins: { key: string; value: SwarmCheckin; indexes: { byCreatedAt: number } }
  settings: { key: string; value: AppSettings }
  spots: { key: string; value: Spot; indexes: { byLastSeen: number } }
}

let _db: IDBPDatabase<SeenDB> | null = null

export async function getDB(): Promise<IDBPDatabase<SeenDB>> {
  if (_db) return _db
  _db = await openDB<SeenDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('locations', { keyPath: 'id' }).createIndex('byTimestamp', 'timestamp')
        db.createObjectStore('places', { keyPath: 'id' }).createIndex('byLastSeen', 'lastSeen')
        db.createObjectStore('checkins', { keyPath: 'id' }).createIndex('byCreatedAt', 'createdAt')
        db.createObjectStore('settings')
      }
      if (oldVersion < 2) {
        db.createObjectStore('spots', { keyPath: 'id' }).createIndex('byLastSeen', 'lastSeen')
      }
    },
  })
  return _db
}

export async function saveLocation(point: LocationPoint): Promise<void> {
  const db = await getDB()
  await db.put('locations', point)
}

export async function getLocations(limit = 5000): Promise<LocationPoint[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('locations', 'byTimestamp')
  return all.slice(-limit)
}

/** Every stored point, unbounded — for backup export, where truncating would lose data. */
export async function getAllLocations(): Promise<LocationPoint[]> {
  return (await getDB()).getAllFromIndex('locations', 'byTimestamp')
}

export async function getLocationCount(): Promise<number> {
  return (await getDB()).count('locations')
}

export async function saveLocations(points: LocationPoint[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('locations', 'readwrite')
  await Promise.all(points.map(p => tx.store.put(p)))
  await tx.done
}

export async function clearLocations(): Promise<void> {
  await (await getDB()).clear('locations')
}

export async function savePlace(place: Place): Promise<void> {
  await (await getDB()).put('places', place)
}

export async function getPlaces(): Promise<Place[]> {
  return (await getDB()).getAllFromIndex('places', 'byLastSeen')
}

export async function savePlaces(places: Place[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('places', 'readwrite')
  await Promise.all(places.map(p => tx.store.put(p)))
  await tx.done
}

export async function saveCheckins(checkins: SwarmCheckin[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('checkins', 'readwrite')
  await Promise.all(checkins.map(c => tx.store.put(c)))
  await tx.done
}

export async function getCheckins(): Promise<SwarmCheckin[]> {
  return (await getDB()).getAllFromIndex('checkins', 'byCreatedAt')
}

export async function getSpots(): Promise<Spot[]> {
  return (await getDB()).getAll('spots')
}

export async function saveSpot(spot: Spot): Promise<void> {
  await (await getDB()).put('spots', spot)
}

export async function saveSpots(spots: Spot[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('spots', 'readwrite')
  await Promise.all(spots.map(s => tx.store.put(s)))
  await tx.done
}

/** Replaces the whole spots store in one transaction — used when restoring a merged set. */
export async function replaceSpots(spots: Spot[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('spots', 'readwrite')
  await tx.store.clear()
  await Promise.all(spots.map(s => tx.store.put(s)))
  await tx.done
}

export async function clearSpots(): Promise<void> {
  await (await getDB()).clear('spots')
}

const SETTINGS_KEY = 'app'
const DEFAULT_SETTINGS: AppSettings = {
  trackingEnabled: false,
  trackingIntervalSeconds: 30,
  swarmSync: false,
  visitRadiusMetres: 100,
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB()
  return (await db.get('settings', SETTINGS_KEY)) ?? DEFAULT_SETTINGS
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await (await getDB()).put('settings', settings, SETTINGS_KEY)
}
