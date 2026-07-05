import { getShard, renderedShard, renderShardXml } from '@/app/lib/sitemap-store'

export const dynamic = 'force-dynamic'

// یک شاردِ سایت‌مپ — اول رشتهٔ پیش‌رندرشده (فوری)؛ اگر نبود، همان شارد را زنده می‌سازد.
export async function GET(_req: Request, { params }: { params: Promise<{ shard: string }> }) {
  const { shard } = await params
  const name = shard.replace(/\.xml$/i, '')
  const headers = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=600' }
  const cached = await renderedShard(name)
  if (cached != null) return new Response(cached, { headers })
  const s = await getShard(name)
  if (!s) return new Response('Not found', { status: 404 })
  return new Response(renderShardXml(s.entries), { headers })
}
