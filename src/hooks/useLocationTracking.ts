import { useState, useEffect, useCallback } from 'react'
import { startTracking, stopTracking, isTracking, getCurrentPosition } from '@/services/locationService'
import { getLocations, getSettings } from '@/services/db'
import type { LocationPoint, AppSettings } from '@/types'

export function useLocationTracking() {
  const [currentPosition, setCurrentPosition] = useState<LocationPoint | null>(null)
  const [history, setHistory] = useState<LocationPoint[]>([])
  const [pointCount, setPointCount] = useState(0)
  const [tracking, setTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    getLocations(2000).then(pts => { setHistory(pts); setPointCount(pts.length) })
    setTracking(isTracking())
  }, [])

  const handleNewPoint = useCallback((point: LocationPoint) => {
    setCurrentPosition(point)
    setHistory(prev => [...prev, point].slice(-2000))
    setPointCount(c => c + 1)
  }, [])

  const start = useCallback((intervalSeconds = 30) => {
    startTracking(intervalSeconds, handleNewPoint, err => setError(err.message))
    setTracking(true); setError(null)
  }, [handleNewPoint])

  const stop = useCallback(() => { stopTracking(); setTracking(false) }, [])

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

  return { currentPosition, history, pointCount, tracking, error, settings, start, stop, snapCurrentPosition }
}
