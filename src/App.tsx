import { useState, useEffect } from 'react'
import { useLocationTracking } from './hooks/useLocationTracking'
import { useSwarm } from './hooks/useSwarm'
import { exchangeCode } from './services/swarmService'
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

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  const { currentPosition, history, pointCount, tracking, start: startTracking, stop: stopTracking, snapCurrentPosition } = useLocationTracking()
  const swarm = useSwarm()

  useEffect(() => { getSettings().then(setSettings) }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      window.history.replaceState({}, '', window.location.pathname)
      exchangeCode(code).then(() => { setActiveTab('swarm'); swarm.sync() }).catch(console.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSettingsChange(s: AppSettings) {
    setSettings(s); saveSettings(s)
    if (s.trackingEnabled && !tracking) startTracking(s.trackingIntervalSeconds)
    if (!s.trackingEnabled && tracking) stopTracking()
  }

  const pages: Record<Tab, React.ReactNode> = {
    map: <MapPage history={history} currentPosition={currentPosition} checkins={swarm.checkins} tracking={tracking} pointCount={pointCount} onStartTracking={() => startTracking(settings.trackingIntervalSeconds)} onStopTracking={stopTracking} onSnapPosition={snapCurrentPosition} />,
    history: <HistoryPage history={history} checkins={swarm.checkins} adsEnabled={settings.adsEnabled} />,
    check: <ProximityCheckPage currentPosition={currentPosition} />,
    swarm: <SwarmPage isConnected={swarm.isConnected} user={swarm.auth.user} checkins={swarm.checkins} syncing={swarm.syncing} syncProgress={swarm.syncProgress} error={swarm.error} onConnect={swarm.connect} onDisconnect={swarm.disconnect} onSync={swarm.sync} />,
    settings: <SettingsPage settings={settings} pointCount={pointCount} onSettingsChange={handleSettingsChange} />,
  }

  return (
    <div className="flex flex-col w-full h-dvh bg-slate-900 overflow-hidden font-sans">
      <main className="flex-1 min-h-0 relative">
        {Object.entries(pages).map(([tab, page]) => (
          <div key={tab} className={`absolute inset-0 ${activeTab === tab ? 'block' : 'hidden'}`}>{page}</div>
        ))}
      </main>
      <BottomNav active={activeTab} onNavigate={setActiveTab} />
    </div>
  )
}
