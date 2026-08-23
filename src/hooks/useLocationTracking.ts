import { useState, useEffect, useCallback } from 'react'
import { startTracking, stopTracking, isTracking, getCurrentPosition } from '@/services/locationService'
import { recordSpotVisit, backfillSpotsFromHistory } from '@/services/spotService'
import { getLocations, getSettings, getSpots } from '@/services/db'
import type { LocationPoint, AppSettings, Spot } from '@/types'

export function useLocationTracking() {
  const [currentPosition, setCurrentPosition] = useState<LocationPoint | null>(null)
  const [history, setHistory] = useState<LocationPoint[]>([])
  const [spots, setSpots] = useState<Spot[]>([])
  const [pointCount, setPointCount] = useState(0)
  const [tracking, setTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    getLocations(2000).then(pts => { setHistory(pts); setPointCount(pts.length) })
    // One-time: builds spots from any history recorded before this feature existed.
    backfillSpotsFromHistory().then(() => getSpots().then(setSpots))
    setTracking(isTracking())
  }, [])

  const handleNewPoint = useCallback((point: LocationPoint) => {
    setCurrentPosition(point)
    setHistory(prev => [...prev, point].slice(-2000))
    setPointCount(c => c + 1)
    recordSpotVisit(point).then(spot => {
      setSpots(prev => {
        const idx = prev.findIndex(s => s.id === spot.id)
        if (idx === -1) return [...prev, spot]
        const next = [...prev]
        next[idx] = spot
        return next
      })
    })
  }, [])

  const start = useCallback((intervalSeconds = 30) => {
    startTracking(intervalSeconds, handleNewPoint, err => setError(err.message))
    setTracking(true); setError(null)
  }, [handleNewPoint])

  const stop = useCallback(() => { stopTracking(); setTracking(false) }, [])

  /** Re-reads stored data — used after a backup restore so the map reflects it immediately. */
  const reloadFromStorage = useCallback(async () => {
    const [pts, loadedSpots] = await Promise.all([getLocations(2000), getSpots()])
    setHistory(pts)
    setPointCount(pts.length)
    setSpots(loadedSpots)
  }, [])

  const snapCurrentPosition = useCallback(async () => {
    try {
      const point = await getCurrentPosition()
      setCurrentPosition(point)
      return point
    } catch (err) {
      setError((err as GeolocationPositionError).message ?? String(err))
      return null
    }
  }, [])

  useEffect(() => {
    if (settings?.trackingEnabled && !isTracking()) start(settings.trackingIntervalSeconds)
  }, [settings, start])

  return {
    currentPosition, history, spots, pointCount, tracking, error, settings,
    start, stop, snapCurrentPosition, reloadFromStorage,
  }
}
