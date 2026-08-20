import { useState } from 'react'
import { Shield, Trash2, Bell, MapPin, BarChart3 } from 'lucide-react'
import type { AppSettings } from '@/types'
import { saveSettings, clearLocations } from '@/services/db'

interface Props { settings: AppSettings; pointCount: number; onSettingsChange: (s: AppSettings) => void }

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} role="switch" aria-checked={checked}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-slate-600'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function Row({ icon: Icon, label, description, children }: { icon: React.ElementType; label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5"><Icon size={15} className="text-slate-300" /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsPage({ settings, pointCount, onSettingsChange }: Props) {
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  async function update(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch }
    await saveSettings(next); onSettingsChange(next)
  }

  async function handleClear() {
    if (!window.confirm(`Delete all ${pointCount.toLocaleString()} location points? This cannot be undone.`)) return
    setClearing(true); await clearLocations(); setClearing(false); setCleared(true)
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-y-auto">
      <div className="px-5 pt-6 pb-4"><h1 className="text-2xl font-bold">Settings</h1></div>

      <div className="px-5">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Tracking</div>
        <div className="bg-slate-800 rounded-2xl divide-y divide-slate-700/60 overflow-hidden">
          <Row icon={MapPin} label="Background tracking" description="Record your position automatically while the app is open.">
            <Toggle checked={settings.trackingEnabled} onChange={v => update({ trackingEnabled: v })} />
          </Row>
          <Row icon={Bell} label="Tracking interval" description="How often to record a new location point.">
            <select value={settings.trackingIntervalSeconds} onChange={e => update({ trackingIntervalSeconds: Number(e.target.value) })}
              className="bg-slate-700 text-white text-sm rounded-lg px-2 py-1 border-none focus:ring-2 focus:ring-brand-500">
              <option value={10}>10 s</option><option value={30}>30 s</option><option value={60}>1 min</option><option value={300}>5 min</option>
            </select>
          </Row>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Ads</div>
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          <Row icon={BarChart3} label="Personalised ads" description="Ads matched to your location category — coarse area only, never precise coordinates.">
            <Toggle checked={settings.adsEnabled} onChange={v => update({ adsEnabled: v })} />
          </Row>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Privacy & Data</div>
        <div className="bg-slate-800 rounded-2xl divide-y divide-slate-700/60 overflow-hidden">
          <Row icon={Shield} label="Data stays on device" description="All location history is stored locally in your browser's IndexedDB.">
            <span className="text-xs text-emerald-400 font-medium">On-device</span>
          </Row>
          <Row icon={Trash2} label="Clear location history" description={`Delete all ${pointCount.toLocaleString()} recorded points from this device.`}>
            <button onClick={handleClear} disabled={clearing || cleared} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors font-medium">
              {clearing ? 'Clearing…' : cleared ? 'Cleared' : 'Clear'}
            </button>
          </Row>
        </div>
      </div>

      <div className="px-5 mt-5 mb-8">
        <div className="bg-slate-800/50 rounded-2xl px-4 py-4 text-center">
          <div className="text-brand-400 font-bold text-lg">Seen</div>
          <div className="text-xs text-slate-500 mt-1">v0.1.0</div>
          <div className="text-xs text-slate-600 mt-2">Location data is stored locally. Ads are served based on coarse location context only. Your precise coordinates are never shared.</div>
        </div>
      </div>
    </div>
  )
}
