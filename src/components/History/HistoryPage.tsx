import { useMemo } from 'react'
import { MapPin, Star } from 'lucide-react'
import type { LocationPoint, SwarmCheckin } from '@/types'
import { format, isSameDay } from 'date-fns'
import AdBanner from '../Ads/AdBanner'

interface Props { history: LocationPoint[]; checkins: SwarmCheckin[]; adsEnabled: boolean }

type DayGroup = { date: Date; checkins: SwarmCheckin[]; locationCount: number; kmTravelled: number | null }

function buildDayGroups(history: LocationPoint[], checkins: SwarmCheckin[]): DayGroup[] {
  const days = new Map<string, DayGroup & { minLat: number; maxLat: number; minLng: number; maxLng: number }>()

  for (const pt of history) {
    const key = format(pt.timestamp, 'yyyy-MM-dd')
    if (!days.has(key)) days.set(key, { date: new Date(pt.timestamp), checkins: [], locationCount: 0, kmTravelled: null, minLat: pt.coords.lat, maxLat: pt.coords.lat, minLng: pt.coords.lng, maxLng: pt.coords.lng })
    const g = days.get(key)!
    g.locationCount++
    g.minLat = Math.min(g.minLat, pt.coords.lat); g.maxLat = Math.max(g.maxLat, pt.coords.lat)
    g.minLng = Math.min(g.minLng, pt.coords.lng); g.maxLng = Math.max(g.maxLng, pt.coords.lng)
  }
  for (const c of checkins) {
    const key = format(c.createdAt * 1000, 'yyyy-MM-dd')
    if (!days.has(key)) days.set(key, { date: new Date(c.createdAt * 1000), checkins: [], locationCount: 0, kmTravelled: null, minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 })
    days.get(key)!.checkins.push(c)
  }

  return [...days.values()].sort((a, b) => b.date.getTime() - a.date.getTime()).map(g => {
    const R = 6371
    const dLat = ((g.maxLat - g.minLat) * Math.PI) / 180
    const dLng = ((g.maxLng - g.minLng) * Math.PI) / 180
    const avgLat = (((g.minLat + g.maxLat) / 2) * Math.PI) / 180
    const km = g.locationCount > 1 ? Math.round(Math.sqrt((dLat * R) ** 2 + (dLng * R * Math.cos(avgLat)) ** 2)) : null
    return { date: g.date, checkins: g.checkins, locationCount: g.locationCount, kmTravelled: km }
  })
}

export default function HistoryPage({ history, checkins, adsEnabled }: Props) {
  const days = useMemo(() => buildDayGroups(history, checkins), [history, checkins])

  if (days.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-slate-900 text-white">
      <MapPin size={48} className="text-slate-700 mb-4" />
      <h2 className="text-xl font-bold mb-2">No history yet</h2>
      <p className="text-slate-400 text-sm">Start tracking on the Map tab — every location you visit will appear here.</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-y-auto">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold">Your history</h1>
        <p className="text-slate-400 text-sm mt-1">{days.length} days · {history.length.toLocaleString()} location points</p>
      </div>
      <div className="px-5 space-y-4 pb-4">
        {days.map((day, i) => (
          <div key={day.date.toISOString()}>
            {i > 0 && i % 7 === 0 && <AdBanner checkins={checkins} enabled={adsEnabled} />}
            <div className="bg-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div>
                  <div className="font-semibold text-sm">{isSameDay(day.date, new Date()) ? 'Today' : format(day.date, 'EEEE, d MMMM')}</div>
                  <div className="text-xs text-slate-400">{format(day.date, 'yyyy')}</div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {day.locationCount > 0 && <div className="flex items-center gap-1 justify-end"><MapPin size={10} />{day.locationCount} pts{day.kmTravelled && day.kmTravelled > 0 ? ` · ~${day.kmTravelled} km` : ''}</div>}
                  {day.checkins.length > 0 && <div className="flex items-center gap-1 justify-end mt-0.5"><Star size={10} className="text-orange-400" />{day.checkins.length} check-in{day.checkins.length !== 1 ? 's' : ''}</div>}
                </div>
              </div>
              {day.checkins.length > 0 && (
                <div className="divide-y divide-slate-700/50">
                  {day.checkins.map(c => (
                    <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5"><Star size={14} className="text-orange-400" /></div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{c.venue.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{c.venue.categories[0]?.name}{c.venue.location.city ? ` · ${c.venue.location.city}` : ''}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{format(c.createdAt * 1000, 'HH:mm')} · via Swarm</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
