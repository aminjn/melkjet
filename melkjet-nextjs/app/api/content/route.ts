import { NextRequest, NextResponse } from 'next/server'
import { listItems, SourceType } from '@/app/lib/scraper-store'

// Public read endpoint — feeds search, directory, store, home.
// Returns all non-rejected, non-duplicate scraped items.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const type = sp.get('type') as SourceType | null
  const category = sp.get('category') || undefined
  const owner = (sp.get('owner') || '').replace(/\s+/g, ' ').trim()
  const limit = Math.min(parseInt(sp.get('limit') || '60', 10) || 60, 200)
  const valid = type && ['listing', 'directory', 'product', 'article', 'price'].includes(type)
  let items = listItems(valid ? type : undefined, { category, publicOnly: true })
  // پیش‌نویس‌های CMS نباید در فهرست عمومی بیایند
  items = items.filter(i => !(i.type === 'article' && i.meta?.cmsStatus === 'draft'))
  // فیلتر بر اساس آگهی‌دهنده/نویسنده (برای لینک داخلیِ مقاله ↔ آگهی‌های همان شخص)
  if (owner) { const n = owner.toLocaleLowerCase(); items = items.filter(i => (i.owner || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() === n) }
  // featured first, then newest
  items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.scrapedAt - a.scrapedAt)
  return NextResponse.json({ items: items.slice(0, limit), total: items.length })
}
