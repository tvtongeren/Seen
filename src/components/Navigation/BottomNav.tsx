import { Map, Clock, Search, Star, Settings } from 'lucide-react'
import type { Tab } from '@/types'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'check', label: 'Check', icon: Search },
  { id: 'swarm', label: 'Swarm', icon: Star },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function BottomNav({ active, onNavigate }: { active: Tab; onNavigate: (t: Tab) => void }) {
  return (
    <nav className="flex-shrink-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 safe-area-bottom">
      <div className="flex items-stretch">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onNavigate(id)} aria-label={label}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${active === id ? 'text-brand-400' : 'text-slate-600 hover:text-slate-400'}`}>
            <Icon size={20} strokeWidth={active === id ? 2.5 : 1.75} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
