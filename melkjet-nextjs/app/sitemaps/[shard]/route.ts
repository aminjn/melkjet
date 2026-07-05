import { getShard } from '@/app/lib/sitemap-store'

export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// یک شاردِ سایت‌مپ (urlset) — مثلاً /sitemaps/listings-tehran-sale-1.xml
export async function GET(_req: Request, { params }: { params: Promise<{ shard: string }> }) {
  const { shard } = await params
  const s = await getShard(shard)
  if (!s) return new Response('Not found', { status: 404 })
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${s.entries.map(e => `  <url>
    <loc>${esc(e.url)}</loc>${e.lastModified ? `
    <lastmod>${e.lastModified}</lastmod>` : ''}${e.changeFrequency ? `
    <changefreq>${e.changeFrequency}</changefreq>` : ''}${e.priority != null ? `
    <priority>${e.priority}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=600' } })
}
