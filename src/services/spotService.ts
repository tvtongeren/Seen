/**
 * Aggregates raw tracked points into persistent "spots" — one marker per
 * ~10m radius, kept forever, instead of one marker per GPS ping.
 *
 * Storage is kept deliberately light: a spot only ever stores visitCount
 * (a single integer) plus a *sample* of up to MAX_SAMPLE_DATES calendar-day
 * timestamps. A place visited a thousand times — home, the gym — costs the
 * same handful of numbers as one visited once; it never accumulates a full
 * log of every ping.
 */
import { haversineMetres } from './locationService'
import { getSpots, saveSpot, getLocations } from './db'
import type { LocationPoint, Spot } from '@/types'

export const SPOT_RADIUS_METRES = 10
export const MAX_SAMPLE_DATES = 10

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function newId(): string {
  return `spot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function findNearest(spots: Spot[], point: LocationPoint): { spot: Spot; distance: number } | null {
  let nearest: Spot | null = null
  let nearestDist = Infinity
  for (const s of spots) {
    const d = haversineMetres(s.coords, point.coords)
    if (d < nearestDist) { nearestDist = d; nearest = s }
  }
  return nearest ? { spot: nearest, distance: nearestDist } : null
}

/** Folds a single new tracked point into an existing spot, or creates one. */
function foldPointIntoSpot(spot: Spot, point: LocationPoint): void {
  const day = startOfDay(point.timestamp)
  const isNewDay = startOfDay(spot.lastSeen) !== day

  if (isNewDay) {
    spot.visitCount++
    if (spot.sampleDates.length < MAX_SAMPLE_DATES && !spot.sampleDates.includes(day)) {
      spot.sampleDates.push(day)
    }
  }
  if (point.timestamp > spot.lastSeen) spot.lastSeen = point.timestamp
  if (point.timestamp < spot.firstSeen) spot.firstSeen = point.timestamp
}

/**
 * Called once per tracked GPS point. If an existing spot is within
 * SPOT_RADIUS_METRES, that visit is folded into it (no new dot). Otherwise a
 * new spot is created — this is what makes a green dot appear on the map.
 */
export async function recordSpotVisit(point: LocationPoint): Promise<Spot> {
  const spots = await getSpots()
  const nearest = findNearest(spots, point)

  if (nearest && nearest.distance <= SPOT_RADIUS_METRES) {
    foldPointIntoSpot(nearest.spot, point)
    await saveSpot(nearest.spot)
    return nearest.spot
  }

  const spot: Spot = {
    id: newId(),
    coords: point.coords,
    visitCount: 1,
    firstSeen: point.timestamp,
    lastSeen: point.timestamp,
    sampleDates: [startOfDay(point.timestamp)],
  }
  await saveSpot(spot)
  return spot
}

/**
 * One-time migration for accounts that tracked history before spots existed:
 * folds every past raw point into spots so nothing already recorded is lost.
 * No-ops once spots exist, so it's safe to call on every app start.
 */
export async function backfillSpotsFromHistory(): Promise<number> {
  const existing = await getSpots()
  if (existing.length > 0) return 0

  const points = await getLocations(200_000)
  if (!points.length) return 0

  const spots: Spot[] = []
  for (const point of points) {
    const nearest = findNearest(spots, point)
    if (nearest && nearest.distance <= SPOT_RADIUS_METRES) {
      foldPointIntoSpot(nearest.spot, point)
    } else {
      spots.push({
        id: newId(),
        coords: point.coords,
        visitCount: 1,
        firstSeen: point.timestamp,
        lastSeen: point.timestamp,
        sampleDates: [startOfDay(point.timestamp)],
      })
    }
  }

  await Promise.all(spots.map(saveSpot))
  return spots.length
}
