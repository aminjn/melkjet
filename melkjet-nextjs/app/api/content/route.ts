import { NextRequest, NextResponse } from 'next/server'
import { listItems, SourceType } from '@/app/lib/scraper-store'

// Public read endpoint — feeds search, directory, store, home.
// Returns all non-rejected, non-duplicate scraped items.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const type = sp.get('type') as SourceType | null
  const category = sp.get('category') || undefined
  const limit = Math.min(parseInt(sp.get('limit') || '60', 10) || 60, 200)
  const valid = type && ['listing', 'directory', 'product', 'article', 'price'].includes(type)
  const items = listItems(valid ? type : undefined, { category, publicOnly: true })
  return NextResponse.json({ items: items.slice(0, limit) })
}
