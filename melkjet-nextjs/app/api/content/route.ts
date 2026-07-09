import { NextRequest, NextResponse } from 'next/server'
import { listItems, SourceType } from '@/app/lib/scraper-store'

// Public read endpoint — feeds search, directory, store, home.
// Returns all non-rejected, non-duplicate scraped items.
// کشِ کوتاهِ در-حافظه (هر نمونهٔ pm2 مالِ خودش): این روت پرترافیک‌ترین مسیرِ عمومی است و از فیکسِ
// جستجو (slim=1) تا ۱۰۰۰ آیتم map می‌کند — بدونِ کش، هر بازدیدِ /search کلِ این کار را تکرار می‌کرد.
const RESP_CACHE = new Map<string, { at: number; body: string }>()
const RESP_TTL = 20_000

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const type = sp.get('type') as SourceType | null
  const category = sp.get('category') || undefined
  const owner = (sp.get('owner') || '').replace(/\s+/g, ' ').trim()
  // حالتِ سبک (slim=1): فقط فیلدهای لازمِ جستجو، ولی با سقفِ کاملِ استخر (۱۰۰۰) — تا /search همهٔ
  // آگهی‌ها را ببیند نه فقط ۸۰ تای آخر (باگِ «در پنل هست ولی در جستجو نیست»).
  const slim = sp.get('slim') === '1'
  const limit = Math.min(parseInt(sp.get('limit') || '60', 10) || 60, slim ? 1000 : 200)
  const cacheKey = `${type || ''}|${category || ''}|${owner}|${slim ? 1 : 0}|${limit}`
  const hit = RESP_CACHE.get(cacheKey)
  if (hit && Date.now() - hit.at < RESP_TTL) return new NextResponse(hit.body, { headers: { 'Content-Type': 'application/json' } })
  const valid = type && ['listing', 'directory', 'product', 'article', 'price'].includes(type)
  let items = await listItems(valid ? type : undefined, { category, publicOnly: true })
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
  const SLIM_META = ['متراژ', 'طبقه', 'سال ساخت', 'ساخت', 'نوع معامله', 'نوع ملک', 'اتاق خواب', '__lat', '__lng', '__dealStatus']
  const safe = items.slice(0, limit).map(it => {
    const { phone, ...rest } = it as any
    if (!slim) return { ...rest, hasPhone: !!(phone || (it as any).meta?.__ownerPhone) }
    const meta: Record<string, string> = {}
    for (const k of SLIM_META) { const v = it.meta?.[k]; if (v) meta[k] = v }
    return {
      id: it.id, type: it.type, sourceName: it.sourceName, category: it.category, tags: it.tags,
      title: it.title, price: it.price, location: it.location, image: it.image, url: it.url,
      excerpt: (it.excerpt || '').slice(0, 200), scrapedAt: it.scrapedAt, featured: it.featured, meta,
      hasPhone: !!(phone || (it as any).meta?.__ownerPhone),
    }
  })
  const body = JSON.stringify({ items: safe, total: items.length })
  RESP_CACHE.set(cacheKey, { at: Date.now(), body })
  if (RESP_CACHE.size > 200) { const oldest = [...RESP_CACHE.entries()].sort((a, b) => a[1].at - b[1].at)[0]; if (oldest) RESP_CACHE.delete(oldest[0]) }
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json' } })
}
