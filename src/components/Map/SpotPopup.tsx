import type { Spot } from '@/types'
import { format } from 'date-fns'

/**
 * Spots visited more than 10 times (home, gym, …) show a summary rather than
 * every date — the underlying record stays light (a sample, not a full log),
 * and the popup mirrors that rather than pretending to list something it
 * doesn't have.
 */
export default function SpotPopup({ spot }: { spot: Spot }) {
  const showFullList = spot.visitCount <= 10
  return (
    <div className="text-sm min-w-[140px]">
      <div className="font-semibold mb-1.5">
        {spot.visitCount} visit{spot.visitCount !== 1 ? 's' : ''}
      </div>
      {showFullList ? (
        <ul className="text-xs text-gray-600 space-y-0.5">
          {spot.sampleDates.map(d => <li key={d}>{format(d, 'd MMM yyyy')}</li>)}
        </ul>
      ) : (
        <div className="text-xs text-gray-600 space-y-0.5">
          <div>First seen {format(spot.firstSeen, 'd MMM yyyy')}</div>
          <div>Last seen {format(spot.lastSeen, 'd MMM yyyy')}</div>
          <div className="text-gray-400 mt-1 italic">Frequent spot — summary only</div>
        </div>
      )}
    </div>
  )
}
