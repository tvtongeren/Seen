import { useState, useEffect } from 'react'
import { useLocationTracking } from './hooks/useLocationTracking'
import { useSwarm } from './hooks/useSwarm'
import { getSettings, saveSettings } from './services/db'
import BottomNav from './components/Navigation/BottomNav'
import MapPage from './components/Map/MapPage'
import HistoryPage from './components/History/HistoryPage'
import ProximityCheckPage from './components/ProximityCheck/ProximityCheckPage'
import SwarmPage from './components/Swarm/SwarmPage'
import SettingsPage from './components/Settings/SettingsPage'
import type { Tab, AppSettings } from './types'

const DEFAULT_SETTINGS: AppSettings = {
  trackingEnabled: false,
  trackingIntervalSeconds: 30,
  swarmSync: false,
  adsEnabled: true,
  visitRadiusMetres: 100,
}

/**
 * Detect an OAuth redirect synchronously during the first render, before
 * useSwarm's effect scrubs the token out of the URL — so we can land the
 * user back on the Swarm tab.
 */
function initialTab(): Tab {
  const hash = window.location.hash
  return hash.includes('access_token') || hash.includes('error') ? 'swarm' : 'map'
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  const {
    currentPosition, history, pointCount, tracking,
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

  const pages: Record<Tab, React.ReactNode> = {
    map: (
      <MapPage
        history={history} currentPosition={currentPosition} checkins={swarm.checkins}
        tracking={tracking} pointCount={pointCount}
        onStartTracking={() => startTracking(settings.trackingIntervalSeconds)}
        onStopTracking={stopTracking} onSnapPosition={snapCurrentPosition}
      />
    ),
    history: <HistoryPage history={history} checkins={swarm.checkins} adsEnabled={settings.adsEnabled} />,
    check: <ProximityCheckPage currentPosition={currentPosition} />,
    swarm: (
      <SwarmPage
        isConnected={swarm.isConnected} user={swarm.auth.user} checkins={swarm.checkins}
        syncing={swarm.syncing} syncProgress={swarm.syncProgress} error={swarm.error}
        configured={swarm.configured} onConnect={swarm.connect}
        onDisconnect={swarm.disconnect} onSync={swarm.sync}
        onConfigured={swarm.refreshConfigured}
      />
    ),
    settings: <SettingsPage settings={settings} pointCount={pointCount} onSettingsChange={handleSettingsChange} />,
  }

  return (
    <div className="flex flex-col w-full h-dvh bg-slate-900 overflow-hidden font-sans">
      <main className="flex-1 min-h-0 relative">
        {(Object.keys(pages) as Tab[]).map(tab => (
          <div key={tab} className={`absolute inset-0 ${activeTab === tab ? 'block' : 'hidden'}`}>
            {pages[tab]}
          </div>
        ))}
      </main>
      <BottomNav active={activeTab} onNavigate={setActiveTab} />
    </div>
  )
}
