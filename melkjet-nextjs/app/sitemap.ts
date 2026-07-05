import type { MetadataRoute } from 'next'
import { locationTree } from '@/app/lib/locations-store'
import { listItems } from '@/app/lib/scraper-store'
import { BLOG_CATEGORIES, categorySlugForName } from '@/app/lib/blog-taxonomy'

export const dynamic = 'force-dynamic'
const BASE = 'https://melkjet.com'

// نقشهٔ سایتِ پویا — استاتیک + بلاگ + مکان‌ها + آگهی‌ها + متخصصان.
// در مقیاسِ میلیونی باید به sitemap-index شارد شود؛ فعلاً حجم زیرِ سقفِ ۵۰هزار است.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = []
  const add = (path: string, o?: { lastModified?: Date; changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency']; priority?: number }) =>
    out.push({ url: `${BASE}${path}`, changeFrequency: o?.changeFrequency || 'weekly', priority: o?.priority ?? 0.6, lastModified: o?.lastModified })

  // صفحاتِ ثابت
  add('', { priority: 1, changeFrequency: 'daily' })
  for (const p of ['/blog', '/locations', '/search', '/directory', '/store', '/pricing', '/about', '/contact']) add(p, { priority: 0.7 })

  // بلاگ: دسته‌ها + مقالات
  for (const c of BLOG_CATEGORIES) add(`/blog/${c.slug}`, { priority: 0.6 })
  try {
    for (const a of await listItems('article', { publicOnly: true })) {
      const slug = (a.meta as Record<string, string> | undefined)?.slug || a.id
      add(`/blog/${categorySlugForName(a.category)}/${slug}`, { priority: 0.7, lastModified: a.scrapedAt ? new Date(a.scrapedAt) : undefined })
    }
  } catch {}

  // مکان‌ها: شهرها همیشه (صفحهٔ هاب)؛ منطقه/محله فقط اگر آگهی داشته باشند
  // (هم‌سو با noindexِ صفحه — تا صفحهٔ «تُنُک» در سایت‌مپ نباشد و اخطارِ سرچ‌کنسول ندهد).
  try {
    const listings = await listItems('listing', { publicOnly: true })
    const hay = listings.map(it => `${it.location || ''} ${it.title || ''}`)
    const hasListings = (nameFa: string) => !!nameFa && hay.some(h => h.includes(nameFa))
    for (const prov of locationTree()) for (const city of prov.children) {
      add(`/locations/${city.path.join('/')}`, { priority: 0.6 })   // شهر: همیشه
      for (const d of city.children) {
        if (!hasListings(d.nameFa)) continue
        add(`/locations/${d.path.join('/')}`, { priority: 0.55 })
        add(`/locations/${d.path.join('/')}/buy`, { priority: 0.5 })
        add(`/locations/${d.path.join('/')}/rent`, { priority: 0.5 })
        for (const h of d.children) if (hasListings(h.nameFa)) add(`/locations/${h.path.join('/')}`, { priority: 0.55 })
      }
    }
  } catch {}

  // آگهی‌ها → canonicalِ /listing/{id}-{slug}
  try {
    const { listingHref } = await import('@/app/lib/listing-url')
    for (const it of await listItems('listing', { publicOnly: true })) add(listingHref(it.id, it.title, it.location), { priority: 0.6, lastModified: it.scrapedAt ? new Date(it.scrapedAt) : undefined })
  } catch {}

  // پروژه‌ها: /projects/{slug} (سقف‌دار تا حجمِ سایت‌مپ کنترل‌شده بماند؛ کاملش با شارد)
  try {
    const { publicQuery } = await import('@/app/lib/persiansaze-store')
    const { ensureProjectSlug } = await import('@/app/lib/project-slug-store')
    const items = (publicQuery({ withPhoto: true, pageSize: 2000 }).items || [])
    for (const p of items) { const slug = await ensureProjectSlug(p.hashId, p.address || (p as any).builderName || 'پروژه'); if (slug) add(`/projects/${slug}`, { priority: 0.55 }) }
  } catch {}

  // متخصصان: /{type}/{slug}
  try {
    const { listAccounts } = await import('@/app/lib/account-store')
    const { urlTypeForRole } = await import('@/app/lib/provider-public')
    const { ensureProviderSlug } = await import('@/app/lib/provider-slug-store')
    const { getProfile } = await import('@/app/lib/profile-store')
    for (const a of listAccounts()) {
      const type = urlTypeForRole(a.role); if (!type) continue
      const gp = getProfile(a.phone)
      const name = (gp.businessName || gp.displayName || a.name || '').trim(); if (!name) continue
      const slug = await ensureProviderSlug(a.phone, name)
      if (slug) add(`/${type}/${slug}`, { priority: 0.6 })
    }
  } catch {}

  return out
}
