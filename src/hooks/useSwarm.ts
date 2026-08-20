import { useState, useEffect, useCallback } from 'react'
import { getStoredToken, getStoredUser, clearAuth, buildAuthUrl, fetchSelf, syncCheckins, loadCachedCheckins } from '@/services/swarmService'
import type { SwarmCheckin, SwarmAuthState } from '@/types'

export function useSwarm() {
  const [auth, setAuth] = useState<SwarmAuthState>({ accessToken: getStoredToken(), user: getStoredUser() })
  const [checkins, setCheckins] = useState<SwarmCheckin[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadCachedCheckins().then(setCheckins) }, [])

  const connect = useCallback(() => { window.location.href = buildAuthUrl() }, [])
  const disconnect = useCallback(() => { clearAuth(); setAuth({ accessToken: null, user: null }); setCheckins([]) }, [])

  const sync = useCallback(async () => {
    if (!auth.accessToken) return
    setSyncing(true); setSyncProgress(0); setError(null)
    try {
      if (!auth.user) {
        const user = await fetchSelf(auth.accessToken)
        setAuth(prev => ({ ...prev, user }))
      }
      setCheckins(await syncCheckins(auth.accessToken, n => setSyncProgress(n)))
    } catch (err) {
      setError(String(err))
    } finally {
      setSyncing(false)
    }
  }, [auth])

  return { auth, checkins, isConnected: !!auth.accessToken, syncing, syncProgress, error, connect, disconnect, sync }
}
