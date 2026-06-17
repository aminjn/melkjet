import { NextRequest, NextResponse } from 'next/server'
import { neighbourhoodStats, valueScore, parsePrice, parseArea } from '@/app/lib/market-stats'

// Real market stats for a neighbourhood (from our scraped data).
// ?city=&district=  → stats + trend; optionally &price=&area= → value score.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const city = sp.get('city') || ''
  const district = sp.get('district') || ''
  const stats = neighbourhoodStats(city, district)
  if (!stats) return NextResponse.json({ stats: null })

  let value: number | undefined
  const price = parsePrice(sp.get('price') || '')
  const area = parseArea(sp.get('area') || sp.get('title') || '')
  if (price && area) value = valueScore(price / area, stats.avg)

  return NextResponse.json({ stats, value })
}
