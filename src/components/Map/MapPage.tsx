import { useState } from 'react'
import { Navigation, Pause, Play, MapPin } from 'lucide-react'
import TrackingMap from './TrackingMap'
import type { LocationPoint, SwarmCheckin } from '@/types'
import { formatDistance } from '@/services/locationService'
import { format } from 'date-fns'

interface Props {
  history: LocationPoint[]
  currentPosition: LocationPoint | null
  checkins: SwarmCheckin[]
  tracking: boolean
  pointCount: number
  onStartTracking: () => void
  onStopTracking: () => void
  onSnapPosition: () => void
}

export default function MapPage({ history, currentPosition, checkins, tracking, pointCount, onStartTracking, onStopTracking, onSnapPosition }: Props) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="relative w-full h-full bg-slate-900">
      <div className="absolute inset-0">
        <TrackingMap history={history} currentPosition={currentPosition} checkins={checkins} />
      </div>

      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 flex items-start gap-3">
        <div className="flex-1 bg-slate-900/80 backdrop-blur rounded-2xl px-4 py-2 text-white">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Seen</div>
          <div className="text-sm font-semibold">
            {pointCount.toLocaleString()} points{checkins.length > 0 && ` · ${checkins.length} check-ins`}
          </div>
        </div>
        <button onClick={onSnapPosition} className="bg-slate-900/80 backdrop-blur rounded-2xl p-3 text-brand-400 hover:text-brand-300 transition-colors" aria-label="Locate me">
          <Navigation size={20} />
        </button>
      </div>

      {tracking && (
        <div className="absolute top-4 right-20 z-[1000] flex items-center gap-1.5 bg-slate-900/80 backdrop-blur px-2 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-xs text-slate-300">Live</span>
        </div>
      )}

      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2 items-end">
        <button
          onClick={tracking ? onStopTracking : onStartTracking}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold shadow-lg transition-all ${tracking ? 'bg-red-500 text-white' : 'bg-brand-500 text-white'}`}
        >
          {tracking ? <Pause size={16} /> : <Play size={16} />}
          {tracking ? 'Pause tracking' : 'Start tracking'}
        </button>
        {currentPosition && (
          <button onClick={() => setShowInfo(v => !v)} className="bg-slate-800/90 backdrop-blur text-slate-300 text-xs px-3 py-2 rounded-xl flex items-center gap-1">
            <MapPin size={12} />{format(currentPosition.timestamp, 'HH:mm')}
          </button>
        )}
      </div>

      {showInfo && currentPosition && (
        <div className="absolute bottom-32 right-4 z-[1000] bg-slate-900/95 backdrop-blur rounded-2xl p-4 text-white max-w-xs shadow-xl">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Current position</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><div className="text-slate-400 text-xs">Lat</div><div className="font-mono">{currentPosition.coords.lat.toFixed(6)}</div></div>
            <div><div className="text-slate-400 text-xs">Lng</div><div className="font-mono">{currentPosition.coords.lng.toFixed(6)}</div></div>
            <div><div className="text-slate-400 text-xs">Accuracy</div><div>{formatDistance(currentPosition.accuracy)}</div></div>
            <div><div className="text-slate-400 text-xs">Updated</div><div>{format(currentPosition.timestamp, 'HH:mm:ss')}</div></div>
          </div>
        </div>
      )}
    </div>
  )
}
