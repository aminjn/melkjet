// ── موتورِ سایت‌مپِ مقیاس‌پذیر (Sitemap Index + شاردهای بخش‌بندی‌شده) ──
// /sitemap.xml = ایندکس؛ هر بخش به شاردهای ≤ maxUrls (پیش‌فرض ۱۰٬۰۰۰) خرد می‌شود.
// آگهی‌ها (بزرگ‌ترین بخش) بر اساسِ شهر + نوعِ معامله شارد می‌شوند (سبکِ Zillow).
// نکتهٔ مقیاس: در حجمِ میلیونی باید تولیدِ XML به Job پس‌زمینه + Cloud Storage/CDN منتقل شود؛
// فعلاً تولیدِ پویا با کشِ کوتاه کافی است (آیتم‌ها فعلاً سقفِ ۱۰۰۰ دارند).

import { listItems, type Item } from './scraper-store'
import { locationTree } from './locations-store'
import { BLOG_CATEGORIES, categorySlugForName } from './blog-taxonomy'
import { slugify } from './slugify'
import { listingHref } from './listing-url'
import { getAdminData, saveAdminData } from './admin-store'

export const BASE = 'https://melkjet.com'
export const DEFAULT_MAX = 10000
type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

export interface UrlEntry { url: string; lastModified?: string; changeFrequency?: ChangeFreq; priority?: number }
export interface Shard { name: string; type: string; entries: UrlEntry[] }
export interface ShardInfo { name: string; type: string; count: number; lastmod?: string; status: 'healthy' | 'empty' | 'over' }

export interface SitemapConfig { maxUrls: number; sections: Record<string, boolean> }
export function sitemapConfig(): SitemapConfig {
  const s = ((getAdminData() as Record<string, any>).seo?.sitemap) || {}
  const maxUrls = Math.min(Math.max(Number(s.maxUrls) || DEFAULT_MAX, 100), 50000)
  return { maxUrls, sections: (s.sections && typeof s.sections === 'object') ? s.sections : {} }
}
const enabled = (sections: Record<string, boolean>, key: string) => sections[key] !== false

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length <= size) return arr.length ? [arr] : []
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
const iso = (ts?: number) => (ts ? new Date(ts).toISOString() : undefined)
const dealOf = (it: Item): 'sale' | 'rent' =>
  (it.meta?.['نوع معامله'] === 'اجاره' || /اجاره|رهن|ودیعه/.test(`${it.price || ''} ${it.title || ''}`)) ? 'rent' : 'sale'
const cityOf = (it: Item): string => {
  const c = it.meta?.['شهر'] || (it.location || '').split(/[،,]/)[0] || ''
  const s = slugify(String(c).trim())
  return s || 'other'
}

// کشِ کوتاهِ درون‌حافظه‌ای تا ایندکس/شاردها/داشبورد دوباره‌سازی نکنند.
let CACHE: { at: number; shards: Shard[] } | null = null
const TTL = 60_000

export async function buildShards(force = false): Promise<Shard[]> {
  if (!force && CACHE && Date.now() - CACHE.at < TTL) return CACHE.shards
  const { maxUrls, sections } = sitemapConfig()
  const shards: Shard[] = []
  // بخشِ تک‌نامی؛ اگر از سقف رد شد به name-2/name-3… خرد می‌شود.
  const addSection = (name: string, type: string, entries: UrlEntry[]) => {
    const parts = chunk(entries, maxUrls)
    if (!parts.length) { shards.push({ name, type, entries: [] }); return }
    parts.forEach((part, i) => shards.push({ name: parts.length > 1 ? `${name}-${i + 1}` : name, type, entries: part }))
  }

  // ── ثابت‌ها ──
  if (enabled(sections, 'static')) {
    const s: UrlEntry[] = [{ url: `${BASE}/`, priority: 1, changeFrequency: 'daily' }]
    for (const p of ['/blog', '/locations', '/listings', '/projects', '/search', '/directory', '/store', '/pricing', '/about', '/contact'])
      s.push({ url: `${BASE}${p}`, priority: 0.7, changeFrequency: 'weekly' })
    addSection('static', 'ثابت', s)
  }

  // ── بلاگ ──
  if (enabled(sections, 'blog')) {
    const s: UrlEntry[] = BLOG_CATEGORIES.map(c => ({ url: `${BASE}/blog/${c.slug}`, priority: 0.6, changeFrequency: 'weekly' as ChangeFreq }))
    try {
      for (const a of await listItems('article', { publicOnly: true })) {
        const slug = (a.meta as Record<string, string> | undefined)?.slug || a.id
        s.push({ url: `${BASE}/blog/${categorySlugForName(a.category)}/${slug}`, priority: 0.7, lastModified: iso(a.scrapedAt) })
      }
    } catch {}
    addSection('blog', 'بلاگ', s)
  }

  // ── آگهی‌ها: شارد بر اساسِ شهر + نوعِ معامله ──
  let listings: Item[] = []
  try { listings = await listItems('listing', { publicOnly: true }) } catch {}
  if (enabled(sections, 'listings')) {
    const groups = new Map<string, UrlEntry[]>()   // key = "{city}-{deal}"
    for (const it of listings) {
      const key = `${cityOf(it)}-${dealOf(it)}`
      const e: UrlEntry = { url: `${BASE}${listingHref(it.id, it.title, it.location)}`, priority: 0.6, lastModified: iso(it.scrapedAt), changeFrequency: 'daily' }
      ;(groups.get(key) || groups.set(key, []).get(key)!).push(e)
    }
    for (const [key, entries] of [...groups.entries()].sort()) {
      // شاردهای آگهی همیشه پسوندِ شماره دارند: listings-tehran-sale-1
      chunk(entries, maxUrls).forEach((part, i) => shards.push({ name: `listings-${key}-${i + 1}`, type: 'آگهی', entries: part }))
    }
  }

  // ── مکان‌ها: شهر همیشه؛ منطقه/محله فقط اگر آگهی داشته باشد ──
  if (enabled(sections, 'locations')) {
    const hay = listings.map(it => `${it.location || ''} ${it.title || ''}`)
    const has = (nameFa: string) => !!nameFa && hay.some(h => h.includes(nameFa))
    const s: UrlEntry[] = []
    try {
      for (const prov of locationTree()) for (const city of prov.children) {
        s.push({ url: `${BASE}/locations/${city.path.join('/')}`, priority: 0.6 })
        for (const d of city.children) {
          if (!has(d.nameFa)) continue
          s.push({ url: `${BASE}/locations/${d.path.join('/')}`, priority: 0.55 })
          s.push({ url: `${BASE}/locations/${d.path.join('/')}/buy`, priority: 0.5 })
          s.push({ url: `${BASE}/locations/${d.path.join('/')}/rent`, priority: 0.5 })
          for (const h of d.children) if (has(h.nameFa)) s.push({ url: `${BASE}/locations/${h.path.join('/')}`, priority: 0.55 })
        }
      }
    } catch {}
    addSection('locations', 'مکان', s)
  }

  // ── پروژه‌ها (فقط‌خواندنی: slug از نگاشتِ آماده؛ نبودِ slug → hashId که مسیر resolve می‌کند) ──
  if (enabled(sections, 'projects')) {
    const s: UrlEntry[] = []
    try {
      const { publicQuery } = await import('./persiansaze-store')
      const { allProjectSlugsByHash } = await import('./project-slug-store')
      const map = await allProjectSlugsByHash()
      const items = (publicQuery({ withPhoto: true, pageSize: 20000 }).items || [])
      for (const p of items) { const slug = map[p.hashId] || p.hashId; if (slug) s.push({ url: `${BASE}/projects/${slug}`, priority: 0.55 }) }
    } catch {}
    addSection('projects', 'پروژه', s)
  }

  // ── متخصصان (فقط‌خواندنی: فقط آن‌هایی که slug دارند؛ بقیه را کرون slug می‌دهد) ──
  if (enabled(sections, 'providers')) {
    try {
      const { listAccounts } = await import('./account-store')
      const { urlTypeForRole } = await import('./provider-public')
      const { allProviderSlugsByPhone } = await import('./provider-slug-store')
      const map = await allProviderSlugsByPhone()
      const norm = (p: string) => String(p || '').replace(/\D/g, '')
      const byType = new Map<string, UrlEntry[]>()
      for (const a of listAccounts()) {
        const type = urlTypeForRole(a.role); if (!type) continue
        const slug = map[norm(a.phone)]; if (!slug) continue
        ;(byType.get(type) || byType.set(type, []).get(type)!).push({ url: `${BASE}/${type}/${slug}`, priority: 0.6 })
      }
      for (const [type, entries] of [...byType.entries()].sort()) addSection(`providers-${type}`, 'متخصص', entries)
    } catch {}
  }

  // ── سازنده‌ها (پرشین‌سازه) — فقط‌خواندنی از نگاشتِ slug ──
  if (enabled(sections, 'builders')) {
    try {
      const { allBuilderSlugsById } = await import('./builder-slug-store')
      const map = await allBuilderSlugsById()
      const s = Object.values(map).map(slug => ({ url: `${BASE}/builders/${slug}`, priority: 0.55 } as UrlEntry))
      addSection('builders', 'سازنده', s)
    } catch {}
  }

  // ── محصولاتِ مصالح — فقط‌خواندنی از نگاشتِ slug ──
  if (enabled(sections, 'products')) {
    try {
      const { allProductSlugsById } = await import('./product-slug-store')
      const map = await allProductSlugsById()
      const s = Object.values(map).map(slug => ({ url: `${BASE}/product/${slug}`, priority: 0.5 } as UrlEntry))
      addSection('products', 'محصول', s)
    } catch {}
  }

  // ── فروشگاه‌های مصالح (storefront) — از قبل slug دارند ──
  if (enabled(sections, 'stores')) {
    try {
      const { listPublicShops } = await import('./materials-store')
      const shops = await listPublicShops()
      const s = (shops || []).map((sh: any) => sh.slug ? ({ url: `${BASE}/store/${sh.slug}`, priority: 0.55 } as UrlEntry) : null).filter(Boolean) as UrlEntry[]
      addSection('stores', 'فروشگاه', s)
    } catch {}
  }

  CACHE = { at: Date.now(), shards }
  return shards
}

// فهرستِ شاردها برای ایندکس + داشبورد.
export async function shardList(force = false): Promise<ShardInfo[]> {
  const { maxUrls } = sitemapConfig()
  const shards = await buildShards(force)
  return shards
    .filter(s => s.entries.length > 0)   // شاردِ خالی در ایندکس نمی‌آید
    .map(s => {
      let lastmod: string | undefined
      for (const e of s.entries) if (e.lastModified && (!lastmod || e.lastModified > lastmod)) lastmod = e.lastModified
      const status: ShardInfo['status'] = s.entries.length === 0 ? 'empty' : s.entries.length > maxUrls ? 'over' : 'healthy'
      return { name: s.name, type: s.type, count: s.entries.length, lastmod, status }
    })
}

export async function getShard(name: string): Promise<Shard | null> {
  const clean = name.replace(/\.xml$/i, '')
  const shards = await buildShards()
  return shards.find(s => s.name === clean) || null
}

// ── هشدارِ سوپرادمین وقتی شاردِ جدید اضافه می‌شود (روی instance صفر/کرون اجرا شود) ──
export async function checkNewShards(): Promise<{ added: string[]; total: number }> {
  const list = await shardList(true)
  const names = list.map(s => s.name).sort()
  const data = getAdminData() as Record<string, any>
  const prev: string[] = data.seo?.sitemap?.knownShards || []
  const added = names.filter(n => !prev.includes(n))
  const removed = prev.filter(n => !names.includes(n))
  if (added.length || removed.length || !data.seo?.sitemap?.snapshotAt) {
    data.seo = data.seo || {}
    data.seo.sitemap = { ...(data.seo.sitemap || {}), knownShards: names, snapshotAt: Date.now(), totalUrls: list.reduce((n, s) => n + s.count, 0) }
    saveAdminData(data as any)
    if (added.length) {
      try {
        const { addNotif } = await import('./notif-store')
        const { SUPER_ADMIN_PHONE } = await import('./session')
        const { logAudit } = await import('./audit-store')
        const label = added.slice(0, 5).join('، ') + (added.length > 5 ? ` و ${added.length - 5} مورد دیگر` : '')
        await addNotif(SUPER_ADMIN_PHONE, `🗺 سایت‌مپِ جدید اضافه شد: ${label}. مجموعِ شاردها: ${names.length}. حتماً در سرچ‌کنسول ثبت/بررسی کن.`, 'seo')
        logAudit('سیستم', 'سایت‌مپِ جدید', `${added.length} شارد: ${label}`)
      } catch {}
    }
  }
  return { added, total: names.length }
}

export function snapshotMeta(): { snapshotAt?: number; totalUrls?: number } {
  const s = (getAdminData() as Record<string, any>).seo?.sitemap || {}
  return { snapshotAt: s.snapshotAt, totalUrls: s.totalUrls }
}

// ── پیش‌محاسبهٔ slugِ پروژه‌ها/متخصصان (کرونِ instance صفر) تا سایت‌مپ فقط‌خواندنی و سریع بماند ──
// هر نوعِ موجودیت در «یک نوشتِ واحد» slug می‌گیرد (نه یک نوشت به‌ازای هر آیتم = جلوگیری از ۵۰۴).
export async function precomputeSlugs(): Promise<{ projects: number; providers: number }> {
  let projects = 0, providers = 0
  try {
    const { listAccounts } = await import('./account-store')
    const { urlTypeForRole } = await import('./provider-public')
    const { getProfile } = await import('./profile-store')
    const { ensureManyProviderSlugs, allProviderSlugsByPhone } = await import('./provider-slug-store')
    const have = await allProviderSlugsByPhone()
    const norm = (p: string) => String(p || '').replace(/\D/g, '')
    const need: { phone: string; name: string }[] = []
    for (const a of listAccounts()) {
      const type = urlTypeForRole(a.role); if (!type || have[norm(a.phone)]) continue
      const gp = getProfile(a.phone); const name = (gp.businessName || gp.displayName || a.name || '').trim(); if (!name) continue
      need.push({ phone: a.phone, name })
    }
    if (need.length) providers = await ensureManyProviderSlugs(need)
  } catch {}
  try {
    const { publicQuery } = await import('./persiansaze-store')
    const { ensureManyProjectSlugs, allProjectSlugsByHash } = await import('./project-slug-store')
    const have = await allProjectSlugsByHash()
    const items = (publicQuery({ pageSize: 20000 }).items || [])
    const need = items.filter(p => !have[p.hashId]).map(p => ({ hashId: p.hashId, name: p.address || (p as any).builderName || 'پروژه' }))
    if (need.length) projects = await ensureManyProjectSlugs(need)
  } catch {}
  let builders = 0, products = 0
  try {
    const { getProfiles } = await import('./persiansaze-store')
    const { ensureManyBuilderSlugs, allBuilderSlugsById } = await import('./builder-slug-store')
    const have = await allBuilderSlugsById()
    const profs = getProfiles()
    const need = Object.values(profs).filter(b => b && b.name && !have[b.id]).map(b => ({ id: b.id, name: b.name }))
    if (need.length) builders = await ensureManyBuilderSlugs(need)
  } catch {}
  try {
    const { listProducts } = await import('./catalog-store')
    const { ensureManyProductSlugs, allProductSlugsById } = await import('./product-slug-store')
    const have = await allProductSlugsById()
    const need = listProducts({ activeOnly: true }).filter(p => !have[p.id]).map(p => ({ id: p.id, name: p.name }))
    if (need.length) products = await ensureManyProductSlugs(need)
  } catch {}
  if (projects || providers || builders || products) CACHE = null   // کشِ سایت‌مپ باطل شود
  return { projects, providers, builders, products } as any
}
