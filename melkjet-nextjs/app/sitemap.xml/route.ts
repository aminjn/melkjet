import { shardList, renderedIndex, renderIndexXml, BASE } from '@/app/lib/sitemap-store'

export const dynamic = 'force-dynamic'

// ایندکسِ سایت‌مپ — اول رشتهٔ پیش‌رندرشده (فوری، ضدِّ ۵۰۴)؛ اگر نبود، زندهٔ سبک می‌سازد.
export async function GET() {
  const headers = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=600' }
  const cached = await renderedIndex()
  if (cached) return new Response(cached, { headers })
  const shards = await shardList()
  const body = renderIndexXml(shards.map(s => ({ name: s.name, lastmod: s.lastmod })))
  return new Response(body, { headers })
}
