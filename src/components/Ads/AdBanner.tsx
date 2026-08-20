import { useState, useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { pickAd, categoryFromVenue } from '@/services/adService'
import type { GeoAd, SwarmCheckin } from '@/types'

interface Props { checkins: SwarmCheckin[]; enabled?: boolean }

export default function AdBanner({ checkins, enabled = true }: Props) {
  const [ad, setAd] = useState<GeoAd | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const categoryName = checkins.at(-1)?.venue.categories[0]?.name ?? ''
    setAd(pickAd(categoryFromVenue(categoryName)))
    setDismissed(false)
  }, [checkins, enabled])

  if (!enabled || !ad || dismissed) return null

  return (
    <div className="mx-0 mb-3 rounded-2xl overflow-hidden border border-slate-700 bg-slate-800/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Sponsored · {ad.advertiser}</span>
        <button onClick={() => setDismissed(true)} className="text-slate-600 hover:text-slate-400 transition-colors" aria-label="Dismiss ad"><X size={14} /></button>
      </div>
      <div className="px-4 pb-4">
        <h4 className="text-sm font-semibold text-white leading-snug">{ad.title}</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{ad.description}</p>
        {ad.distanceHint && <div className="mt-2 text-xs text-brand-400 font-medium">{ad.distanceHint}</div>}
        <a href={ad.ctaUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 bg-brand-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-600 transition-colors">
          {ad.ctaLabel}<ExternalLink size={11} />
        </a>
      </div>
    </div>
  )
}
