import { useState, useEffect } from 'react'
import { useLocationTracking } from './hooks/useLocationTracking'
import { useSwarm } from './hooks/useSwarm'
import { getSettings, saveSettings } from './services/db'
import MapPage from './components/Map/MapPage'
import SettingsOverlay from './components/Settings/SettingsOverlay'
import type { AppSettings } from './types'

const DEFAULT_SETTINGS: AppSettings = {
  trackingEnabled: false,
  trackingIntervalSeconds: 30,
  swarmSync: false,
  adsEnabled: true,
  visitRadiusMetres: 100,
}

/**
 * Open Settings automatically on an OAuth redirect back from Foursquare —
 * the map has no other screen to land the user on, and this is where the
 * Swarm section that triggered the redirect lives.
 */
function cameFromOAuthRedirect(): boolean {
  const hash = window.location.hash
  return hash.includes('access_token') || hash.includes('error')
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(cameFromOAuthRedirect)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  const {
    currentPosition, spots, pointCount, tracking,
    start: startTracking, stop: stopTracking, snapCurrentPosition,
  } = useLocationTracking()

  const swarm = useSwarm()

  useEffect(() => { getSettings().then(setSettings) }, [])

  function handleSettingsChange(s: AppSettings) {
    setSettings(s)
    saveSettings(s)
    if (s.trackingEnabled && !tracking) startTracking(s.trackingIntervalSeconds)
    if (!s.trackingEnabled && tracking) stopTracking()
  }

  return (
    <div className="relative w-full h-dvh bg-slate-900 overflow-hidden font-sans">
      <MapPage
        spots={spots} currentPosition={currentPosition} checkins={swarm.checkins}
        tracking={tracking}
        onStartTracking={() => startTracking(settings.trackingIntervalSeconds)}
        onStopTracking={stopTracking} onSnapPosition={snapCurrentPosition}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {settingsOpen && (
        <SettingsOverlay
          settings={settings} pointCount={pointCount} onSettingsChange={handleSettingsChange}
          swarm={{
            isConnected: swarm.isConnected, user: swarm.auth.user, checkins: swarm.checkins,
            syncing: swarm.syncing, syncProgress: swarm.syncProgress, error: swarm.error,
            configured: swarm.configured, importing: swarm.importing, importNotice: swarm.importNotice,
            onConnect: swarm.connect, onDisconnect: swarm.disconnect, onSync: swarm.sync,
            onConfigured: swarm.refreshConfigured, onImportFile: swarm.importFile,
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
