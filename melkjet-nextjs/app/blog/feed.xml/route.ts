import { listItems } from '@/app/lib/scraper-store'
import { categorySlugForNameDyn } from '@/app/lib/blog-taxonomy-server'

// فاز ۲۵۴ (سئو L3): فیدِ RSS مجله — برای کشف/سیندیکیشن و ایندکسِ سریع‌ترِ مقالاتِ تازه.
export const dynamic = 'force-dynamic'
const BASE = 'https://melkjet.com'
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  let items: Awaited<ReturnType<typeof listItems>> = []
  try { items = await listItems('article', { publicOnly: true }) } catch {}
  const top = items
    .slice()
    .sort((a, b) => (Number(b.scrapedAt) || 0) - (Number(a.scrapedAt) || 0))
    .slice(0, 50)
  const rows = top.map(a => {
    const slug = (a.meta as Record<string, string> | undefined)?.slug || a.id
    const url = `${BASE}/blog/${categorySlugForNameDyn(a.category)}/${slug}`
    const date = new Date(Number(a.scrapedAt) || Date.now()).toUTCString()
    return `    <item>\n      <title>${esc(a.title)}</title>\n      <link>${esc(url)}</link>\n      <guid isPermaLink="true">${esc(url)}</guid>\n      <pubDate>${date}</pubDate>\n      <description>${esc((a.excerpt || '').slice(0, 400))}</description>\n    </item>`
  }).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>مجلهٔ ملک‌جت</title>\n    <link>${BASE}/blog</link>\n    <atom:link href="${BASE}/blog/feed.xml" rel="self" type="application/rss+xml" />\n    <description>مقالات و تحلیل‌های بازارِ املاک و ساختمانِ ایران — ملک‌جت</description>\n    <language>fa-ir</language>\n${rows}\n  </channel>\n</rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
