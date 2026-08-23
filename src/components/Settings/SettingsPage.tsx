import { useState, useRef } from 'react'
import { Shield, Trash2, Bell, MapPin, Download, Upload, Loader2 } from 'lucide-react'
import type { AppSettings, SwarmCheckin } from '@/types'
import { saveSettings, clearLocations } from '@/services/db'
import { downloadBackup, restoreBackup } from '@/services/backup'
import SwarmSection from './SwarmSection'

interface SwarmProps {
  isConnected: boolean
  user: { firstName: string; lastName: string; photo?: string } | null
  checkins: SwarmCheckin[]
  syncing: boolean
  syncProgress: number
  error: string | null
  configured: boolean
  importing: boolean
  importNotice: string | null
  onConnect: () => void
  onDisconnect: () => void
  onSync: () => void
  onConfigured: () => void
  onImportFile: (file: File) => void
}

interface Props {
  settings: AppSettings
  pointCount: number
  spotCount: number
  onSettingsChange: (s: AppSettings) => void
  onDataRestored: () => void
  swarm: SwarmProps
}

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

export default function SettingsPage({
  settings, pointCount, spotCount, onSettingsChange, onDataRestored, swarm,
}: Props) {
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [backupNotice, setBackupNotice] = useState<string | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  async function update(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch }
    await saveSettings(next); onSettingsChange(next)
  }

  async function handleClear() {
    if (!window.confirm(`Delete all ${pointCount.toLocaleString()} location points? This cannot be undone.`)) return
    setClearing(true); await clearLocations(); setClearing(false); setCleared(true)
    onDataRestored()
  }

  async function handleBackup() {
    setBackingUp(true); setBackupError(null); setBackupNotice(null)
    try {
      const backup = await downloadBackup()
      setBackupNotice(
        `Backed up ${backup.counts.spots.toLocaleString()} places and ` +
        `${backup.counts.locations.toLocaleString()} points.`
      )
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : String(err))
    } finally {
      setBackingUp(false)
    }
  }

  async function handleRestore(file: File) {
    setRestoring(true); setBackupError(null); setBackupNotice(null)
    try {
      const r = await restoreBackup(file)
      const parts = [
        r.spotsAdded > 0 ? `${r.spotsAdded.toLocaleString()} places restored` : null,
        r.spotsMerged > 0 ? `${r.spotsMerged.toLocaleString()} already present` : null,
        r.locationsAdded > 0 ? `${r.locationsAdded.toLocaleString()} points` : null,
        r.checkinsAdded > 0 ? `${r.checkinsAdded.toLocaleString()} check-ins` : null,
      ].filter(Boolean)
      setBackupNotice(parts.length ? parts.join(' · ') : 'Nothing new — everything in that backup was already here.')
      onDataRestored()
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : String(err))
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-y-auto">
      <div className="px-5 pt-5">
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

      <SwarmSection {...swarm} />

      <div className="px-5 mt-5">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">Backup</div>
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 pt-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Your history lives only in this browser's storage, so clearing website data,
              switching phones, or iOS reclaiming space would take it with it. Save a backup
              file somewhere safe — it's the only copy that survives that.
            </p>
          </div>

          <div className="px-4 py-4 space-y-2">
            <button
              onClick={handleBackup} disabled={backingUp || restoring}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {backingUp ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {backingUp ? 'Preparing…' : `Save backup (${spotCount.toLocaleString()} places)`}
            </button>

            <input
              ref={restoreInputRef} type="file" accept=".json,application/json" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleRestore(file)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => restoreInputRef.current?.click()} disabled={backingUp || restoring}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 border border-slate-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-600 disabled:opacity-60 transition-colors"
            >
              {restoring ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {restoring ? 'Restoring…' : 'Restore from backup'}
            </button>

            {backupNotice && (
              <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl px-3 py-2.5 leading-relaxed">
                {backupNotice}
              </div>
            )}
            {backupError && (
              <div className="bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl px-3 py-2.5 leading-relaxed">
                {backupError}
              </div>
            )}

            <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
              Restoring merges into what's already here — it adds places you're missing and
              never removes ones you have.
            </p>
          </div>
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
          <div className="text-xs text-slate-600 mt-2">Location data is stored locally.</div>
        </div>
      </div>
    </div>
  )
}
