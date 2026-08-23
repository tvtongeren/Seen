/**
 * Backup and restore of everything Seen has recorded.
 *
 * All of Seen's data lives in IndexedDB in the browser, which means it is
 * only as durable as the browser's storage for this site: clearing website
 * data, switching devices, or the OS reclaiming storage all take it with
 * them. A backup file is the only thing that survives that, so restore is
 * shipped alongside export — a backup you can't restore isn't a backup.
 *
 * Restore MERGES rather than overwrites: it can never make you worse off
 * than before you ran it.
 */
import type { LocationPoint, Place, SwarmCheckin, Spot } from '@/types'
import {
  getAllLocations, saveLocations,
  getPlaces, savePlaces,
  getCheckins, saveCheckins,
  getSpots, replaceSpots,
} from './db'
import { haversineMetres } from './locationService'
import { SPOT_RADIUS_METRES, MAX_SAMPLE_DATES } from './spotService'

/** Bumped only if the file layout changes in a way restore must branch on. */
const BACKUP_FORMAT_VERSION = 1

export interface BackupFile {
  format: 'seen-backup'
  version: number
  exportedAt: number
  counts: { spots: number; locations: number; checkins: number; places: number }
  spots: Spot[]
  locations: LocationPoint[]
  checkins: SwarmCheckin[]
  places: Place[]
}

export class BackupError extends Error {}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function buildBackup(): Promise<BackupFile> {
  const [spots, locations, checkins, places] = await Promise.all([
    getSpots(), getAllLocations(), getCheckins(), getPlaces(),
  ])

  return {
    format: 'seen-backup',
    version: BACKUP_FORMAT_VERSION,
    exportedAt: Date.now(),
    counts: {
      spots: spots.length,
      locations: locations.length,
      checkins: checkins.length,
      places: places.length,
    },
    spots, locations, checkins, places,
  }
}

/**
 * Hands the backup to the browser as a file download. On iOS this surfaces
 * the share sheet, so it can be saved to Files, iCloud Drive, or sent
 * somewhere off-device — which is the point.
 */
export async function downloadBackup(): Promise<BackupFile> {
  const backup = await buildBackup()
  const json = JSON.stringify(backup)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const stamp = new Date(backup.exportedAt).toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `seen-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // Give the browser a moment to start the download before dropping the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)

  return backup
}

// ─── Restore ──────────────────────────────────────────────────────────────────

export interface RestoreResult {
  spotsAdded: number
  spotsMerged: number
  locationsAdded: number
  checkinsAdded: number
  placesAdded: number
}

function parseBackup(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BackupError("That file isn't valid JSON — pick a Seen backup file.")
  }

  const b = parsed as Partial<BackupFile>
  if (!b || typeof b !== 'object' || b.format !== 'seen-backup') {
    throw new BackupError("That doesn't look like a Seen backup file.")
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      `That backup was made by a newer version of Seen (format ${b.version}). Update the app first.`
    )
  }
  return {
    format: 'seen-backup',
    version: b.version,
    exportedAt: typeof b.exportedAt === 'number' ? b.exportedAt : 0,
    counts: b.counts ?? { spots: 0, locations: 0, checkins: 0, places: 0 },
    spots: Array.isArray(b.spots) ? b.spots : [],
    locations: Array.isArray(b.locations) ? b.locations : [],
    checkins: Array.isArray(b.checkins) ? b.checkins : [],
    places: Array.isArray(b.places) ? b.places : [],
  }
}

/**
 * Folds one spot record into another describing the same place.
 *
 * visitCount takes the MAX of the two rather than the sum. Restoring a
 * backup onto the data it came from is the common case, where both records
 * describe the same visits — summing would silently double every count.
 * Max is exact there, and errs toward undercounting in the rarer case where
 * the two hold genuinely different visits; inflating a history you can't
 * verify is the worse failure.
 */
function mergeSpotInto(target: Spot, incoming: Spot): void {
  const days = new Set([...target.sampleDates, ...incoming.sampleDates])
  target.sampleDates = [...days].sort((a, b) => a - b).slice(0, MAX_SAMPLE_DATES)
  target.firstSeen = Math.min(target.firstSeen, incoming.firstSeen)
  target.lastSeen = Math.max(target.lastSeen, incoming.lastSeen)
  target.visitCount = Math.max(target.visitCount, incoming.visitCount, target.sampleDates.length)
}

/**
 * Merges backup spots into the existing set, matching first by id and then
 * by position. The positional pass matters: after data loss the app may have
 * re-recorded the same physical place under a fresh id, and an id-only merge
 * would leave two green dots stacked on one spot.
 */
function mergeSpots(existing: Spot[], incoming: Spot[]): { spots: Spot[]; added: number; merged: number } {
  const spots = existing.map(s => ({ ...s, sampleDates: [...s.sampleDates] }))
  const byId = new Map(spots.map(s => [s.id, s]))
  let added = 0
  let merged = 0

  for (const inc of incoming) {
    const sameId = byId.get(inc.id)
    if (sameId) {
      mergeSpotInto(sameId, inc)
      merged++
      continue
    }

    const nearby = spots.find(s => haversineMetres(s.coords, inc.coords) <= SPOT_RADIUS_METRES)
    if (nearby) {
      mergeSpotInto(nearby, inc)
      merged++
      continue
    }

    const copy = { ...inc, sampleDates: [...inc.sampleDates] }
    spots.push(copy)
    byId.set(copy.id, copy)
    added++
  }

  return { spots, added, merged }
}

export async function restoreBackup(file: File): Promise<RestoreResult> {
  const backup = parseBackup(await file.text())

  const [existingSpots, existingLocations, existingCheckins, existingPlaces] = await Promise.all([
    getSpots(), getAllLocations(), getCheckins(), getPlaces(),
  ])

  // Spots need a real merge (id + position). Everything else is keyed by a
  // stable id, so putting them back is idempotent — re-restoring the same
  // file changes nothing.
  const { spots, added, merged } = mergeSpots(existingSpots, backup.spots)
  await replaceSpots(spots)

  const existingLocationIds = new Set(existingLocations.map(l => l.id))
  const newLocations = backup.locations.filter(l => l && l.id && !existingLocationIds.has(l.id))
  if (newLocations.length) await saveLocations(newLocations)

  const existingCheckinIds = new Set(existingCheckins.map(c => c.id))
  const newCheckins = backup.checkins.filter(c => c && c.id && !existingCheckinIds.has(c.id))
  if (newCheckins.length) await saveCheckins(newCheckins)

  const existingPlaceIds = new Set(existingPlaces.map(p => p.id))
  const newPlaces = backup.places.filter(p => p && p.id && !existingPlaceIds.has(p.id))
  if (newPlaces.length) await savePlaces(newPlaces)

  return {
    spotsAdded: added,
    spotsMerged: merged,
    locationsAdded: newLocations.length,
    checkinsAdded: newCheckins.length,
    placesAdded: newPlaces.length,
  }
}
