import { Loader2, Link2, Link2Off, RefreshCw, Star, User } from 'lucide-react'
import type { SwarmCheckin } from '@/types'
import { format } from 'date-fns'

interface Props {
  isConnected: boolean
  user: { firstName: string; lastName: string; photo?: string } | null
  checkins: SwarmCheckin[]
  syncing: boolean
  syncProgress: number
  error: string | null
  onConnect: () => void
  onDisconnect: () => void
  onSync: () => void
}

export default function SwarmPage({ isConnected, user, checkins, syncing, syncProgress, error, onConnect, onDisconnect, onSync }: Props) {
  const sorted = [...checkins].reverse()
  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-y-auto">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold">Swarm</h1>
        <p className="text-slate-400 text-sm mt-1">Connect your Swarm account to import your check-in history.</p>
      </div>

      <div className="px-5">
        <div className={`rounded-2xl p-5 border ${isConnected ? 'border-emerald-700 bg-emerald-950/40' : 'border-slate-700 bg-slate-800'}`}>
          {isConnected && user ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden flex-shrink-0">
                {user.photo ? <img src={user.photo} alt={user.firstName} className="w-full h-full object-cover" /> : <User size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{user.firstName} {user.lastName}</div>
                <div className="text-sm text-emerald-400">Connected to Swarm</div>
              </div>
              <button onClick={onDisconnect} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors">
                <Link2Off size={14} />Disconnect
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-orange-500 mx-auto flex items-center justify-center"><Star size={28} className="text-white" /></div>
              <div>
                <div className="font-semibold">Connect Swarm</div>
                <div className="text-sm text-slate-400 mt-1">Import all your check-ins and see them on your map & history.</div>
              </div>
              <button onClick={onConnect} className="flex items-center gap-2 mx-auto bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors">
                <Link2 size={16} />Connect with Swarm
              </button>
            </div>
          )}
        </div>
      </div>

      {isConnected && (
        <div className="px-5 mt-4">
          <button onClick={onSync} disabled={syncing}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-60 transition-colors">
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {syncing ? `Syncing… (${syncProgress} check-ins)` : 'Sync check-ins'}
          </button>
        </div>
      )}

      {error && <div className="px-5 mt-3"><div className="bg-red-950/60 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div></div>}

      {checkins.length > 0 && (
        <div className="px-5 mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Check-ins', value: checkins.length.toLocaleString() },
            { label: 'Venues', value: new Set(checkins.map(c => c.venue.id)).size.toLocaleString() },
            { label: 'Cities', value: new Set(checkins.map(c => c.venue.location.city).filter(Boolean)).size.toLocaleString() },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-brand-300">{s.value}</div>
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
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5"><Star size={13} className="text-orange-400" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{c.venue.name}</div>
                  <div className="text-xs text-slate-400">{c.venue.categories[0]?.name}{c.venue.location.city ? ` · ${c.venue.location.city}` : ''}</div>
                </div>
                <div className="text-xs text-slate-600 flex-shrink-0 text-right">
                  <div>{format(c.createdAt * 1000, 'dd MMM')}</div>
                  <div>{format(c.createdAt * 1000, 'HH:mm')}</div>
                </div>
              </div>
            ))}
            {sorted.length > 30 && <div className="text-center text-xs text-slate-500 py-3">+ {sorted.length - 30} more check-ins</div>}
          </div>
        </div>
      )}
    </div>
  )
}
