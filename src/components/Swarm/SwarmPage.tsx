import { useState } from 'react'
import { Loader2, Link2, Link2Off, RefreshCw, Star, User, Copy, Check, ExternalLink, KeyRound } from 'lucide-react'
import type { SwarmCheckin } from '@/types'
import { getClientId, setClientId, getPlacesApiKey, setPlacesApiKey, getRedirectUri } from '@/services/config'
import { format } from 'date-fns'

interface Props {
  isConnected: boolean
  user: { firstName: string; lastName: string; photo?: string } | null
  checkins: SwarmCheckin[]
  syncing: boolean
  syncProgress: number
  error: string | null
  configured: boolean
  onConnect: () => void
  onDisconnect: () => void
  onSync: () => void
  onConfigured: () => void
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable — the value is visible to copy by hand */ }
  }
  return (
    <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2 border border-slate-700">
      <code className="text-[11px] text-brand-300 flex-1 break-all leading-relaxed">{value}</code>
      <button onClick={copy} className="text-slate-500 hover:text-white transition-colors flex-shrink-0" aria-label="Copy">
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    </div>
  )
}

function SetupPanel({ onConfigured }: { onConfigured: () => void }) {
  const [clientId, setClientIdInput] = useState(getClientId())
  const [apiKey, setApiKeyInput] = useState(getPlacesApiKey())
  const [saved, setSaved] = useState(false)

  function save() {
    setClientId(clientId)
    setPlacesApiKey(apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onConfigured()
  }

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <KeyRound size={15} className="text-brand-400" />
        <span className="text-sm font-semibold">Connect your own Foursquare app</span>
      </div>

      <div className="px-4 py-4 space-y-4">
        <p className="text-xs text-slate-400 leading-relaxed">
          Swarm has no public "sign in" button — every app must register with Foursquare
          first. It takes about two minutes and is free.
        </p>

        <ol className="space-y-3 text-xs text-slate-300">
          <li className="flex gap-2">
            <span className="text-brand-400 font-bold flex-shrink-0">1.</span>
            <span>
              Open{' '}
              <a href="https://foursquare.com/developers/apps" target="_blank" rel="noopener noreferrer"
                 className="text-brand-400 underline inline-flex items-center gap-1">
                foursquare.com/developers/apps <ExternalLink size={10} />
              </a>{' '}
              and click <strong>Create a new app</strong>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-400 font-bold flex-shrink-0">2.</span>
            <div className="space-y-2 min-w-0 flex-1">
              <span>Paste this exact value into the app's <strong>Redirect URI</strong> field:</span>
              <CopyField value={getRedirectUri()} />
              <span className="text-slate-500 block">It must match character-for-character, trailing slash included.</span>
            </div>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-400 font-bold flex-shrink-0">3.</span>
            <span>Copy the app's <strong>Client ID</strong> and paste it below.</span>
          </li>
        </ol>

        <div className="space-y-3 pt-1">
          <label className="block">
            <span className="text-xs text-slate-400 font-medium">Client ID <span className="text-red-400">*</span></span>
            <input
              type="text" value={clientId} onChange={e => setClientIdInput(e.target.value)}
              placeholder="ABCDEF123456…"
              className="mt-1 w-full bg-slate-900 text-white placeholder-slate-600 rounded-lg px-3 py-2 text-sm font-mono border border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 font-medium">Places API key <span className="text-slate-600">(optional)</span></span>
            <input
              type="text" value={apiKey} onChange={e => setApiKeyInput(e.target.value)}
              placeholder="fsq3…"
              className="mt-1 w-full bg-slate-900 text-white placeholder-slate-600 rounded-lg px-3 py-2 text-sm font-mono border border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-[11px] text-slate-600 mt-1 block">Enables place search on the Check tab.</span>
          </label>

          <button
            onClick={save} disabled={!clientId.trim()}
            className="w-full bg-brand-500 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-brand-600 transition-colors"
          >
            {saved ? 'Saved' : 'Save credentials'}
          </button>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            Stored only in this browser — never committed to the repository or sent anywhere.
            The Client ID is a public value; no client secret is used.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SwarmPage({
  isConnected, user, checkins, syncing, syncProgress, error,
  configured, onConnect, onDisconnect, onSync, onConfigured,
}: Props) {
  const [showSetup, setShowSetup] = useState(false)
  const sorted = [...checkins].reverse()

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-y-auto">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold">Swarm</h1>
        <p className="text-slate-400 text-sm mt-1">Import your check-in history into Seen.</p>
      </div>

      <div className="px-5">
        {!configured ? (
          <SetupPanel onConfigured={onConfigured} />
        ) : (
          <div className={`rounded-2xl p-5 border ${isConnected ? 'border-emerald-700 bg-emerald-950/40' : 'border-slate-700 bg-slate-800'}`}>
            {isConnected && user ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {user.photo
                    ? <img src={user.photo} alt="" className="w-full h-full object-cover" />
                    : <User size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{user.firstName} {user.lastName}</div>
                  <div className="text-sm text-emerald-400">Connected to Swarm</div>
                </div>
                <button onClick={onDisconnect} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors flex-shrink-0">
                  <Link2Off size={14} />Disconnect
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-orange-500 mx-auto flex items-center justify-center">
                  <Star size={28} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold">Ready to connect</div>
                  <div className="text-sm text-slate-400 mt-1">
                    You'll be sent to Foursquare to approve access, then straight back here.
                  </div>
                </div>
                <button onClick={onConnect}
                  className="flex items-center gap-2 mx-auto bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors">
                  <Link2 size={16} />Connect with Swarm
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {configured && (
        <div className="px-5 mt-3">
          <button onClick={() => setShowSetup(v => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            {showSetup ? 'Hide credentials' : 'Edit credentials'}
          </button>
          {showSetup && <div className="mt-3"><SetupPanel onConfigured={onConfigured} /></div>}
        </div>
      )}

      {isConnected && (
        <div className="px-5 mt-4">
          <button onClick={onSync} disabled={syncing}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-60 transition-colors">
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {syncing ? `Syncing… (${syncProgress} check-ins)` : 'Sync check-ins'}
          </button>
        </div>
      )}

      {error && (
        <div className="px-5 mt-3">
          <div className="bg-red-950/60 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3 leading-relaxed">
            {error}
          </div>
        </div>
      )}

      {checkins.length > 0 && (
        <div className="px-5 mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Check-ins', value: checkins.length },
            { label: 'Venues', value: new Set(checkins.map(c => c.venue.id)).size },
            { label: 'Cities', value: new Set(checkins.map(c => c.venue.location.city).filter(Boolean)).size },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-brand-300">{s.value.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="px-5 mt-5 pb-6">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Recent check-ins</div>
          <div className="bg-slate-800 rounded-2xl divide-y divide-slate-700/60 overflow-hidden">
            {sorted.slice(0, 30).map(c => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Star size={13} className="text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{c.venue.name}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {c.venue.categories?.[0]?.name}{c.venue.location.city ? ` · ${c.venue.location.city}` : ''}
                  </div>
                </div>
                <div className="text-xs text-slate-600 flex-shrink-0 text-right">
                  <div>{format(c.createdAt * 1000, 'dd MMM')}</div>
                  <div>{format(c.createdAt * 1000, 'HH:mm')}</div>
                </div>
              </div>
            ))}
            {sorted.length > 30 && (
              <div className="text-center text-xs text-slate-500 py-3">+ {sorted.length - 30} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
