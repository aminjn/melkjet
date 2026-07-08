import { NextRequest, NextResponse } from 'next/server'
import { listItems, SourceType } from '@/app/lib/scraper-store'

// Public read endpoint — feeds search, directory, store, home.
// Returns all non-rejected, non-duplicate scraped items.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const type = sp.get('type') as SourceType | null
  const category = sp.get('category') || undefined
  const owner = (sp.get('owner') || '').replace(/\s+/g, ' ').trim()
  // حالتِ سبک (slim=1): فقط فیلدهای لازمِ جستجو، ولی با سقفِ کاملِ استخر (۱۰۰۰) — تا /search همهٔ
  // آگهی‌ها را ببیند نه فقط ۸۰ تای آخر (باگِ «در پنل هست ولی در جستجو نیست»).
  const slim = sp.get('slim') === '1'
  const limit = Math.min(parseInt(sp.get('limit') || '60', 10) || 60, slim ? 1000 : 200)
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
  return NextResponse.json({ items: safe, total: items.length })
}
