import { useState, useEffect, useCallback } from 'react'
import {
  getStoredToken, getStoredUser, clearAuth, buildAuthUrl,
  fetchSelf, syncCheckins, loadCachedCheckins, captureTokenFromRedirect,
} from '@/services/swarmService'
import { hasClientId } from '@/services/config'
import type { SwarmCheckin, SwarmAuthState } from '@/types'

export function useSwarm() {
  const [auth, setAuth] = useState<SwarmAuthState>({
    accessToken: getStoredToken(),
    user: getStoredUser(),
  })
  const [checkins, setCheckins] = useState<SwarmCheckin[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(hasClientId())

  useEffect(() => { loadCachedCheckins().then(setCheckins) }, [])

  const syncWithToken = useCallback(async (token: string) => {
    setSyncing(true); setSyncProgress(0); setError(null)
    try {
      const user = await fetchSelf(token)
      setAuth({ accessToken: token, user })
      setCheckins(await syncCheckins(token, setSyncProgress))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSyncing(false)
    }
  }, [])

  /** Handle the OAuth redirect back from Foursquare, once on mount. */
  useEffect(() => {
    try {
      const token = captureTokenFromRedirect()
      if (token) syncWithToken(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [syncWithToken])

  const connect = useCallback(() => {
    try {
      window.location.href = buildAuthUrl()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const disconnect = useCallback(() => {
    clearAuth()
    setAuth({ accessToken: null, user: null })
    setCheckins([])
    setError(null)
  }, [])

  const sync = useCallback(async () => {
    if (auth.accessToken) await syncWithToken(auth.accessToken)
  }, [auth.accessToken, syncWithToken])

  const refreshConfigured = useCallback(() => setConfigured(hasClientId()), [])

  return {
    auth, checkins, isConnected: !!auth.accessToken,
    syncing, syncProgress, error, configured,
    connect, disconnect, sync, refreshConfigured,
  }
}
