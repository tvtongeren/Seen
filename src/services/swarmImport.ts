/**
 * Import check-ins from a Foursquare/Swarm **data export** file.
 *
 * This is the fallback for when the live API is unavailable — which is common,
 * because Foursquare restricts the personal check-in endpoints
 * (`users/self/checkins`) and new developer apps are frequently not approved
 * for them. A data export needs no app, no OAuth, and no approval: you request
 * it from Foursquare, they email you a file, you load it here.
 *
 * Export formats vary between the versions Foursquare has shipped over the
 * years, so this parser is deliberately tolerant: it accepts several plausible
 * shapes rather than assuming one, and reports clearly when it recognises none.
 */
import type { SwarmCheckin } from '@/types'
import { saveCheckins } from './db'

export interface ImportResult {
  checkins: SwarmCheckin[]
  /** Entries present in the file that could not be parsed into a check-in. */
  skipped: number
}

export class ImportError extends Error {}

// ─── Shape detection ──────────────────────────────────────────────────────────

/**
 * Pull the check-in array out of whichever wrapper the export used.
 * Known/plausible shapes:
 *   [ … ]                        — bare array
 *   { items: [ … ] }             — v2 paged response body
 *   { checkins: [ … ] }          — flattened export
 *   { checkins: { items: [ … ] } } — full v2 response envelope
 *   { response: { checkins: { items: [ … ] } } } — raw API capture
 */
function locateCheckinArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return null

  const obj = data as Record<string, unknown>

  const candidates: unknown[] = [
    obj.items,
    obj.checkins,
    (obj.checkins as Record<string, unknown> | undefined)?.items,
    ((obj.response as Record<string, unknown> | undefined)?.checkins as Record<string, unknown> | undefined)?.items,
  ]

  for (const c of candidates) {
    if (Array.isArray(c)) return c
  }
  return null
}

/** Parse JSON, or newline-delimited JSON, into a check-in array. */
function parseDocument(text: string): unknown[] {
  const trimmed = text.trim()
  if (!trimmed) throw new ImportError('That file is empty.')

  // Standard JSON first.
  try {
    const found = locateCheckinArray(JSON.parse(trimmed))
    if (found) return found
    throw new ImportError(
      'That file is valid JSON, but no check-in list was found inside it. ' +
      'If the export contained several files, pick the one with "checkins" in its name.'
    )
  } catch (err) {
    if (err instanceof ImportError) throw err
    // Not standard JSON — fall through and try NDJSON.
  }

  // Newline-delimited JSON: one check-in object per line.
  const lines = trimmed.split('\n').filter(l => l.trim())
  const parsed: unknown[] = []
  for (const line of lines) {
    try { parsed.push(JSON.parse(line)) } catch { /* skip unparseable line */ }
  }
  if (parsed.length) return parsed

  throw new ImportError("That file isn't JSON. Expected a .json file from a Foursquare data export.")
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/** Timestamps appear as seconds in some exports and milliseconds in others. */
function normaliseTimestampSeconds(raw: unknown): number | null {
  let n: number | null = null

  if (typeof raw === 'number') n = raw
  else if (typeof raw === 'string') {
    const asNumber = Number(raw)
    n = Number.isFinite(asNumber) ? asNumber : Date.parse(raw) / 1000
  }

  if (n === null || !Number.isFinite(n) || n <= 0) return null
  // Anything past ~2001 in ms range is really milliseconds.
  if (n > 1e11) n = n / 1000
  return Math.floor(n)
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

/**
 * Convert one raw export entry into a SwarmCheckin, or null if it lacks the
 * fields Seen needs (coordinates and a timestamp).
 */
function normaliseCheckin(raw: unknown, index: number): SwarmCheckin | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>

  const venueRaw = (entry.venue ?? entry.place) as Record<string, unknown> | undefined
  if (!venueRaw || typeof venueRaw !== 'object') return null

  const locationRaw = (venueRaw.location ?? venueRaw.geocodes) as Record<string, unknown> | undefined
  if (!locationRaw || typeof locationRaw !== 'object') return null

  // Coordinates may be flat (lat/lng) or nested (geocodes.main.latitude).
  const main = (locationRaw.main ?? locationRaw) as Record<string, unknown>
  const lat = toNumber(main.lat ?? main.latitude)
  const lng = toNumber(main.lng ?? main.longitude)
  if (lat === null || lng === null) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  const createdAt = normaliseTimestampSeconds(entry.createdAt ?? entry.created_at ?? entry.date)
  if (createdAt === null) return null

  const categoriesRaw = Array.isArray(venueRaw.categories) ? venueRaw.categories : []
  const categories = categoriesRaw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c, i) => ({
      id: String(c.id ?? `cat-${i}`),
      name: String(c.name ?? 'Place'),
      icon: undefined,
    }))

  const venueId = String(venueRaw.id ?? venueRaw.fsq_id ?? `venue-${index}`)

  return {
    id: String(entry.id ?? `import-${index}-${createdAt}`),
    createdAt,
    venue: {
      id: venueId,
      name: String(venueRaw.name ?? 'Unknown place'),
      location: {
        lat,
        lng,
        city: typeof locationRaw.city === 'string' ? locationRaw.city : undefined,
        country: typeof locationRaw.country === 'string' ? locationRaw.country : undefined,
        address: typeof locationRaw.address === 'string' ? locationRaw.address : undefined,
      },
      categories,
    },
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function importCheckinsFromFile(file: File): Promise<ImportResult> {
  const text = await file.text()
  const rawEntries = parseDocument(text)

  const checkins: SwarmCheckin[] = []
  let skipped = 0

  rawEntries.forEach((raw, i) => {
    const parsed = normaliseCheckin(raw, i)
    if (parsed) checkins.push(parsed)
    else skipped++
  })

  if (!checkins.length) {
    throw new ImportError(
      `Found ${rawEntries.length} entries but none had both coordinates and a date, ` +
      'so there was nothing to import. This may be the wrong file from the export.'
    )
  }

  // De-duplicate against anything already imported; keep the newest per id.
  const unique = new Map(checkins.map(c => [c.id, c]))
  const deduped = [...unique.values()].sort((a, b) => a.createdAt - b.createdAt)

  await saveCheckins(deduped)
  return { checkins: deduped, skipped }
}
