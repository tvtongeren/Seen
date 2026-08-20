import { useState, useEffect, useCallback } from 'react'
import {
  getStoredToken, getStoredUser, clearAuth, buildAuthUrl,
  fetchSelf, syncCheckins, loadCachedCheckins, captureTokenFromRedirect,
} from '@/services/swarmService'
import { hasClientId } from '@/services/config'
import { importCheckinsFromFile } from '@/services/swarmImport'
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
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<string | null>(null)

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

  /** Import check-ins from a Foursquare data export file. */
  const importFile = useCallback(async (file: File) => {
    setImporting(true); setError(null); setImportNotice(null)
    try {
      const { checkins: imported, skipped } = await importCheckinsFromFile(file)
      setCheckins(imported)
      setImportNotice(
        `Imported ${imported.length.toLocaleString()} check-ins` +
        (skipped > 0 ? ` · ${skipped.toLocaleString()} entries skipped (no coordinates or date)` : '')
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }, [])

  return {
    auth, checkins, isConnected: !!auth.accessToken,
    syncing, syncProgress, error, configured,
    importing, importNotice,
    connect, disconnect, sync, refreshConfigured, importFile,
  }
}
