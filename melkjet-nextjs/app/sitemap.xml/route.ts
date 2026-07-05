import { shardList, BASE } from '@/app/lib/sitemap-store'

export const dynamic = 'force-dynamic'

// ایندکسِ سایت‌مپ — فقط به شاردهای بخش‌ها اشاره می‌دهد (نه خودِ URLها).
// این‌طور گوگل هر شارد را جدا و کامل فچ می‌کند و در حجمِ بالا به مشکل نمی‌خورد.
export async function GET() {
  const shards = await shardList()
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${shards.map(s => `  <sitemap>
    <loc>${BASE}/sitemaps/${s.name}.xml</loc>${s.lastmod ? `
    <lastmod>${s.lastmod}</lastmod>` : ''}
  </sitemap>`).join('\n')}
</sitemapindex>`
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=600' } })
}
