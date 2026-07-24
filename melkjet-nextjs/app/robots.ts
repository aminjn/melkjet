import type { MetadataRoute } from 'next'

// robots.txt — عمومی برای صفحاتِ محتوا؛ مسدودِ داشبورد/ادمین/API.
export default function robots(): MetadataRoute.Robots {
  const base = 'https://melkjet.com'
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      // فاز ۲۱۸ (ممیزیِ سئو): داشبوردهای کاربری هم بسته شدند — پوستهٔ کلاینتیِ بی‌محتوا بودجهٔ خزش را
      // هدر می‌داد. مسیرهایی که فرزندِ عمومیِ [slug] دارند با «$» فقط خودِ صفحهٔ داشبورد بسته می‌شوند.
      disallow: [
        '/api/', '/admin', '/auth', '/panel', '/crm', '/marketing', '/workflow', '/website-builder', '/plan-ai', '/content', '/catalog-admin',
        '/empire', '/reos-admin', '/buyer', '/owner', '/club', '/vip', '/compare', '/submit', '/support',
        '/pros$', '/agency$', '/builder$', '/materials$', '/finance$', '/legal$', '/notary$', '/architect$', '/appraiser$', '/contractor$', '/lawfirm$',
      ],
    }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
