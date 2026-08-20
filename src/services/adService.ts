import type { GeoAd } from '@/types'

type AdCategory = GeoAd['category']

const MOCK_ADS: Record<AdCategory, GeoAd[]> = {
  food: [
    { id: 'ad-food-1', title: 'Discover Local Eats Near You', description: 'Get 20% off your first order when you explore new restaurants nearby.', ctaLabel: 'Order Now', ctaUrl: '#', category: 'food', advertiser: 'Deliveroo', distanceHint: 'In this area' },
    { id: 'ad-food-2', title: "The Coffee Spot You Haven't Tried Yet", description: 'Specialty coffee roasters — find a new favourite café.', ctaLabel: 'Explore', ctaUrl: '#', category: 'food', advertiser: 'Specialty Coffee Collective' },
  ],
  retail: [
    { id: 'ad-retail-1', title: 'Shopping Perks Waiting for You', description: 'Earn cashback on purchases at stores you visit.', ctaLabel: 'Get Cashback', ctaUrl: '#', category: 'retail', advertiser: 'Curve Card', distanceHint: 'Near here' },
  ],
  travel: [
    { id: 'ad-travel-1', title: "You've Explored This City — What's Next?", description: 'Find flights from your most-visited airports from €49.', ctaLabel: 'Find Flights', ctaUrl: '#', category: 'travel', advertiser: 'Skyscanner' },
    { id: 'ad-travel-2', title: 'Hotels Near Where You Wander', description: "Members-only rates at boutique hotels in your favourite neighbourhoods.", ctaLabel: 'Book Now', ctaUrl: '#', category: 'travel', advertiser: 'Mr & Mrs Smith', distanceHint: 'In this area' },
  ],
  entertainment: [
    { id: 'ad-ent-1', title: 'Events Near Your Favourite Spots', description: 'Concerts, markets & pop-ups happening where you hang out.', ctaLabel: 'See Events', ctaUrl: '#', category: 'entertainment', advertiser: 'Eventbrite' },
  ],
  generic: [
    { id: 'ad-gen-1', title: 'Your City, Your Perks', description: 'Exclusive local deals based on the places you love.', ctaLabel: 'Discover Deals', ctaUrl: '#', category: 'generic', advertiser: 'Seen Partners' },
  ],
}

export function pickAd(category: AdCategory): GeoAd {
  const pool = MOCK_ADS[category] ?? MOCK_ADS.generic
  return pool[Math.floor(Math.random() * pool.length)]
}

export function categoryFromVenue(categoryName: string): AdCategory {
  const lower = categoryName.toLowerCase()
  if (/food|restaurant|café|coffee|bar|bakery|pizza|sushi|burger/.test(lower)) return 'food'
  if (/shop|store|retail|market|fashion|clothing|book/.test(lower)) return 'retail'
  if (/hotel|airport|station|transport|travel/.test(lower)) return 'travel'
  if (/music|cinema|theatre|concert|sport|gym|art|museum/.test(lower)) return 'entertainment'
  return 'generic'
}
