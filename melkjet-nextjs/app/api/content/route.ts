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
  // فیلتر بر اساس آگهی‌دهنده/نویسنده. مقاله‌ها نویسنده را در meta.author نگه می‌دارند
  // (نه i.owner)، پس هر دو را تطبیق می‌دهیم تا مثلِ سایتِ منتشرشده، مقالاتِ مشاور دیده شوند.
  if (owner) {
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
    const n = norm(owner)
    items = items.filter(i => norm(i.owner || '') === n || norm(i.meta?.author || '') === n)
  }
  // featured first, then newest
  items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.scrapedAt - a.scrapedAt)
  // شماره هرگز در فهرستِ عمومی نمی‌رود؛ فقط با ورود از /api/listing-reveal دیده و ثبت می‌شود.
  const safe = items.slice(0, limit).map(it => { const { phone, ...rest } = it as any; return { ...rest, hasPhone: !!(phone || (it as any).meta?.__ownerPhone) } })
  return NextResponse.json({ items: safe, total: items.length })
}
