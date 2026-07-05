import type { MetadataRoute } from 'next'

// robots.txt — عمومی برای صفحاتِ محتوا؛ مسدودِ داشبورد/ادمین/API.
export default function robots(): MetadataRoute.Robots {
  const base = 'https://melkjet.com'
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/auth', '/panel', '/crm', '/marketing', '/workflow', '/website-builder', '/plan-ai', '/content', '/catalog-admin'],
    }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
