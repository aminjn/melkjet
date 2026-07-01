import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { upsertScraped, type CatalogSpec } from './catalog-store'

// موتورِ اسکرپِ فروشگاه (پیش‌فرض hypersaz.com) → کاتالوگِ مرجع.
// چند-استراتژی با تشخیصِ خودکار: (۱) WordPress REST v2، (۲) نقشهٔ سایت + JSON-LD،
// (۳) HTML با سِلکتورهای قابلِ‌تنظیم. «تستِ اتصال» پلتفرم را تشخیص می‌دهد.
const CFG_FILE = join(process.cwd(), '.hypersaz-config.json')
const JOB_FILE = join(process.cwd(), '.hypersaz-job.json')

export interface ScraperConfig {
  baseUrl: string
  strategy: 'auto' | 'wp' | 'sitemap' | 'html'
  maxProducts: number
  // زمان‌بندیِ خودکار
  schedule: 'off' | 'daily' | 'weekly'
  scheduleHour: number   // ساعتِ اجرا (۰..۲۳ به وقتِ تهران)
  lastAutoAt?: number    // زمانِ آخرین اجرای خودکار
  // سِلکتورهای HTML (برای استراتژیِ html وقتی سایت WP نیست)
  productLinkSel?: string
  nameSel?: string; priceSel?: string; imageSel?: string; categorySel?: string
}
const DEFAULT_CFG: ScraperConfig = { baseUrl: 'https://www.hypersaz.com', strategy: 'auto', maxProducts: 3000, schedule: 'off', scheduleHour: 3 }

export function getConfig(): ScraperConfig {
  if (existsSync(CFG_FILE)) { try { return { ...DEFAULT_CFG, ...JSON.parse(readFileSync(CFG_FILE, 'utf-8')) } } catch {} }
  return { ...DEFAULT_CFG }
}
export function setConfig(patch: Partial<ScraperConfig>): ScraperConfig {
  const cur = getConfig()
  const next: ScraperConfig = {
    ...cur,
    baseUrl: patch.baseUrl !== undefined ? String(patch.baseUrl).replace(/\/+$/, '') : cur.baseUrl,
    strategy: (['auto', 'wp', 'sitemap', 'html'] as const).includes(patch.strategy as any) ? patch.strategy as any : cur.strategy,
    maxProducts: patch.maxProducts !== undefined ? Math.max(50, Math.min(20000, Number(patch.maxProducts) || cur.maxProducts)) : cur.maxProducts,
    schedule: (['off', 'daily', 'weekly'] as const).includes(patch.schedule as any) ? patch.schedule as any : cur.schedule,
    scheduleHour: patch.scheduleHour !== undefined ? Math.max(0, Math.min(23, Number(patch.scheduleHour) || 0)) : cur.scheduleHour,
    lastAutoAt: patch.lastAutoAt !== undefined ? Number(patch.lastAutoAt) : cur.lastAutoAt,
    productLinkSel: patch.productLinkSel !== undefined ? String(patch.productLinkSel) : cur.productLinkSel,
    nameSel: patch.nameSel !== undefined ? String(patch.nameSel) : cur.nameSel,
    priceSel: patch.priceSel !== undefined ? String(patch.priceSel) : cur.priceSel,
    imageSel: patch.imageSel !== undefined ? String(patch.imageSel) : cur.imageSel,
    categorySel: patch.categorySel !== undefined ? String(patch.categorySel) : cur.categorySel,
  }
  writeFileSync(CFG_FILE, JSON.stringify(next, null, 2)); return next
}

// ── وضعیتِ کار ──
export interface ScrapeJob {
  running: boolean; total: number; done: number; added: number; updated: number; categories: number
  label?: string; error?: string; strategy?: string; startedAt?: number; finishedAt?: number; lastProgressAt?: number
}
const EMPTY: ScrapeJob = { running: false, total: 0, done: 0, added: 0, updated: 0, categories: 0 }
function loadJob(): ScrapeJob { if (existsSync(JOB_FILE)) { try { return { ...EMPTY, ...JSON.parse(readFileSync(JOB_FILE, 'utf-8')) } } catch {} } return { ...EMPTY } }
function saveJob(j: ScrapeJob) { try { writeFileSync(JOB_FILE, JSON.stringify(j)) } catch {} }
export function getJob(): ScrapeJob {
  const j = loadJob()
  if (j.running) { const last = j.lastProgressAt || j.startedAt || 0; if (!last || Date.now() - last > 4 * 60 * 1000) { j.running = false; j.error = j.error || 'اسکرپ متوقف شد (هنگ یا ری‌استارتِ سرور).'; saveJob(j) } }
  return j
}
export function stopJob(): ScrapeJob { const j = loadJob(); j.running = false; j.finishedAt = Date.now(); j.error = 'به‌صورتِ دستی متوقف شد.'; saveJob(j); return j }
function patch(p: Partial<ScrapeJob>) { const j = { ...loadJob(), ...p, lastProgressAt: Date.now() }; saveJob(j); return j }

// ── ابزارِ شبکه ──
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
async function fetchText(url: string, timeoutMs = 20000): Promise<{ ok: boolean; status: number; text: string; ct: string }> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'fa,en;q=0.8' }, signal: ac.signal, redirect: 'follow', cache: 'no-store' as any })
    const ct = r.headers.get('content-type') || ''
    const text = await r.text()
    return { ok: r.ok, status: r.status, text, ct }
  } catch (e: any) { return { ok: false, status: 0, text: '', ct: '', ...({ err: e?.message } as any) } }
  finally { clearTimeout(t) }
}
async function fetchJson(url: string, timeoutMs = 20000): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetchText(url, timeoutMs)
  if (!r.ok) return { ok: false, status: r.status, data: null }
  try { return { ok: true, status: r.status, data: JSON.parse(r.text) } } catch { return { ok: false, status: r.status, data: null } }
}
function stripHtml(s: string): string { return (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim() }
function abs(base: string, u: string): string { try { return new URL(u, base).href } catch { return u } }

// استخراجِ همهٔ بلوک‌های JSON-LD از HTML
function jsonLdBlocks(html: string): any[] {
  const out: any[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) { try { const j = JSON.parse(m[1].trim()); out.push(j) } catch {} }
  return out
}
function findProductLd(html: string): any | null {
  for (const b of jsonLdBlocks(html)) {
    const arr = Array.isArray(b) ? b : (b['@graph'] ? b['@graph'] : [b])
    for (const node of arr) {
      const t = node && node['@type']
      if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) return node
    }
  }
  return null
}
// کلِ مسیرِ دسته از breadcrumb: [صفحه اصلی, والد, زیردسته, نامِ محصول] → [والد, زیردسته]
function categoryPathFromLd(html: string, productName?: string): string[] {
  for (const b of jsonLdBlocks(html)) {
    const arr = Array.isArray(b) ? b : (b['@graph'] ? b['@graph'] : [b])
    for (const node of arr) {
      const t = node && node['@type']
      if (t === 'BreadcrumbList' || (Array.isArray(t) && t.includes('BreadcrumbList'))) {
        let names = (node.itemListElement || []).map((it: any) => String(it?.name || it?.item?.name || '').trim()).filter(Boolean)
        // حذفِ «صفحه اصلی/خانه» از ابتدا
        if (names.length && /^(صفحه اصلی|خانه|home|فروشگاه)$/i.test(names[0])) names = names.slice(1)
        // حذفِ نامِ محصول از انتها
        const nName = (s: string) => s.replace(/‌/g, '').replace(/\s+/g, ' ').trim()
        if (names.length && productName && nName(names[names.length - 1]) === nName(productName)) names = names.slice(0, -1)
        return names.filter(Boolean).slice(0, 4)
      }
    }
  }
  return []
}
function categoryFromLd(html: string): string {
  const p = categoryPathFromLd(html)
  return p.length ? p[p.length - 1] : ''
}
function ogImage(html: string): string { const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i); return m ? m[1] : '' }

// ── تستِ اتصال / تشخیصِ پلتفرم ──
export interface Probe { name: string; url: string; ok: boolean; status: number; note: string }
export async function testConnection(): Promise<{ base: string; platform: string; probes: Probe[]; recommend: ScraperConfig['strategy']; sample?: any; smUrl?: string; sitemapType?: string; sitemapLocs?: string[]; subSample?: string[] }> {
  const cfg = getConfig(); const base = cfg.baseUrl
  const probes: Probe[] = []
  let recommend: ScraperConfig['strategy'] = 'html'
  let sample: any

  // ۱) صفحهٔ اصلی — تشخیصِ WordPress/WooCommerce + نقشهٔ سایت
  const home = await fetchText(base + '/')
  const isWp = /wp-content|wp-json|woocommerce/i.test(home.text)
  probes.push({ name: 'صفحهٔ اصلی', url: base + '/', ok: home.ok, status: home.status, note: home.ok ? (isWp ? 'وردپرس/ووکامرس شناسایی شد' : 'وردپرس شناسایی نشد') : 'در دسترس نیست' })

  // ۲) WordPress REST v2 product
  const wp = await fetchJson(base + '/wp-json/wp/v2/product?per_page=1')
  const wpOk = wp.ok && Array.isArray(wp.data) && wp.data.length > 0
  probes.push({ name: 'WordPress REST (product)', url: base + '/wp-json/wp/v2/product?per_page=1', ok: wpOk, status: wp.status, note: wpOk ? 'کار می‌کند ✓' : (wp.status === 404 ? 'یافت نشد (۴۰۴)' : `ناموفق (${wp.status})`) })
  if (wpOk) { recommend = 'wp'; sample = { name: wp.data[0]?.title?.rendered } }

  // ۳) WooCommerce Store API
  const store = await fetchJson(base + '/wp-json/wc/store/v1/products?per_page=1')
  const storeOk = store.ok && Array.isArray(store.data) && store.data.length > 0
  probes.push({ name: 'WooCommerce Store API', url: base + '/wp-json/wc/store/v1/products?per_page=1', ok: storeOk, status: store.status, note: storeOk ? 'کار می‌کند ✓' : (store.status === 404 ? 'یافت نشد (۴۰۴)' : `ناموفق (${store.status})`) })

  // ۴) نقشهٔ سایت
  let smUrl = ''
  for (const p of ['/sitemap_index.xml', '/sitemap.xml', '/product-sitemap.xml', '/wp-sitemap.xml']) {
    const r = await fetchText(base + p, 12000)
    if (r.ok && /<(sitemapindex|urlset)/i.test(r.text)) { smUrl = base + p; probes.push({ name: 'نقشهٔ سایت', url: base + p, ok: true, status: r.status, note: 'یافت شد ✓' }); break }
  }
  if (!smUrl) probes.push({ name: 'نقشهٔ سایت', url: base + '/sitemap.xml', ok: false, status: 0, note: 'یافت نشد' })

  // ۵) JSON-LD روی صفحهٔ اصلی (فقط جهتِ اطلاع؛ Schema معمولاً روی صفحاتِ محصول است نه خانه)
  const hasLd = home.ok && /application\/ld\+json/i.test(home.text)
  probes.push({ name: 'JSON-LD (Schema)', url: base + '/', ok: hasLd, status: home.status, note: hasLd ? 'در صفحهٔ اصلی موجود ✓' : 'در صفحهٔ اصلی نیست (روی صفحاتِ محصول بررسی می‌شود)' })

  // نقشهٔ سایت که باشد، اسکرپ ممکن است — از هر صفحهٔ محصول با آبشارِ Schema→OG→HTML استخراج می‌کنیم.
  if (recommend !== 'wp') { if (smUrl) recommend = 'sitemap'; else if (storeOk) recommend = 'wp' }
  const platform = wpOk || storeOk || isWp ? 'وردپرس/ووکامرس' : (smUrl ? 'دارای نقشهٔ سایت' : 'نامشخص (نیاز به سِلکتورِ HTML)')

  // ── نمونهٔ محتوای نقشهٔ سایت (برای عیب‌یابیِ ساختار) ──
  let sitemapType = '', sitemapLocs: string[] = [], subSample: string[] = []
  if (smUrl) {
    const r = await fetchText(smUrl, 12000)
    if (r.ok) {
      const isIndex = /<sitemapindex/i.test(r.text)
      sitemapType = isIndex ? 'ایندکس (زیرنقشه‌ها)' : 'urlset (لینکِ صفحات)'
      sitemapLocs = [...r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, 12)
      if (isIndex && sitemapLocs[0]) {
        const sub = await fetchText(sitemapLocs[0].replace(/&amp;/g, '&'), 12000)
        if (sub.ok) subSample = [...sub.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, 8)
      }
    }
  }
  return { base, platform, probes, recommend, sample, smUrl, sitemapType, sitemapLocs, subSample }
}

// ── استراتژی‌ها ──
function specsFromWp(p: any): CatalogSpec[] {
  const out: CatalogSpec[] = []
  const meta = p.meta || {}
  for (const k of Object.keys(meta)) { const v = meta[k]; if (typeof v === 'string' && v && !k.startsWith('_')) out.push({ key: k.slice(0, 60), value: v.slice(0, 120) }) }
  return out.slice(0, 12)
}
async function runWp(cfg: ScraperConfig) {
  const base = cfg.baseUrl
  // دسته‌ها
  const catMap = new Map<number, string>()
  for (let p = 1; p <= 20; p++) {
    const r = await fetchJson(`${base}/wp-json/wp/v2/product_cat?per_page=100&page=${p}`)
    if (!r.ok || !Array.isArray(r.data) || !r.data.length) break
    for (const c of r.data) catMap.set(c.id, stripHtml(c.name || ''))
    patch({ categories: catMap.size })
    if (r.data.length < 100) break
  }
  // محصولات
  let page = 1, added = 0, updated = 0, done = 0
  while (loadJob().running) {
    const r = await fetchJson(`${base}/wp-json/wp/v2/product?per_page=50&page=${page}&_embed`)
    if (!r.ok || !Array.isArray(r.data) || !r.data.length) break
    const items = r.data.map((p: any) => {
      const catIds: number[] = Array.isArray(p.product_cat) ? p.product_cat : []
      const catName = catIds.map(id => catMap.get(id)).find(Boolean) || (p._embedded?.['wp:term']?.flat?.().find((t: any) => t?.taxonomy === 'product_cat')?.name) || 'دسته‌بندی‌نشده'
      const img = p._embedded?.['wp:featuredmedia']?.[0]?.source_url || ''
      return {
        name: stripHtml(p.title?.rendered || ''), categoryName: stripHtml(catName),
        image: img || undefined, description: stripHtml(p.excerpt?.rendered || p.content?.rendered || '').slice(0, 800),
        specs: specsFromWp(p), externalId: String(p.id || ''), externalUrl: p.link ? String(p.link) : undefined,
      }
    }).filter((x: any) => x.name)
    const res = upsertScraped(items); added += res.added; updated += res.updated
    done += r.data.length
    patch({ added, updated, done, total: Math.max(done + 50, loadJob().total) })
    if (r.data.length < 50 || done >= cfg.maxProducts) break
    page++
  }
  return { added, updated }
}

async function collectSitemapUrls(base: string, cap: number): Promise<{ urls: string[]; productSpecific: boolean }> {
  const urls = new Set<string>()
  let text = ''
  for (const s of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml', '/product-sitemap.xml']) {
    const r = await fetchText(base + s, 15000)
    if (r.ok && /<(sitemapindex|urlset)/i.test(r.text)) { text = r.text; break }
  }
  if (!text) return { urls: [], productSpecific: false }
  const locsOf = (t: string) => [...t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1].replace(/&amp;/g, '&').trim())
  const topLocs = locsOf(text)
  // زیرنقشه = هر loc که به .xml ختم شود — چه <sitemapindex> استاندارد، چه <urlset>ی که
  // مثلِ هایپرساز فایل‌های نقشهٔ فرعی (…-product.xml) را به‌صورتِ <url> فهرست کرده.
  const subSitemaps = topLocs.filter(l => /\.xml(\?.*)?$/i.test(l))
  let productSpecific = false
  if (subSitemaps.length) {
    let subs = subSitemaps.filter(l => /product|kala|mahsul|shop/i.test(l))   // زیرنقشه‌های محصول
    if (subs.length) productSpecific = true
    else subs = subSitemaps.filter(l => !/(static|page|category|cat|tag|author|user|post|blog)/i.test(l))
    if (!subs.length) subs = subSitemaps
    for (const sm of subs) {
      if (urls.size >= cap) break
      const r = await fetchText(sm, 15000)
      if (!r.ok) continue
      for (const u of locsOf(r.text)) { if (!/\.xml(\?.*)?$/i.test(u)) { urls.add(u); if (urls.size >= cap) break } }
    }
  } else {
    // urlsetِ واقعی (لینکِ صفحات)
    for (const u of topLocs) { urls.add(u); if (urls.size >= cap) break }
    productSpecific = /product|kala|mahsul|shop/i.test(text)
  }
  const all = [...urls]
  const prod = all.filter(u => /\/product\/|\/products\/|\/kala\/|\/shop\/|mahsul/i.test(u))
  if (prod.length) return { urls: prod.slice(0, cap), productSpecific: true }
  return { urls: all.slice(0, cap), productSpecific }
}
// نامِ محصول از HTMLِ ساده (h1 → og:title → title)
function htmlName(html: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1) { const n = stripHtml(h1[1]); if (n) return n }
  const og = ogMeta(html, 'og:title'); if (og) return og
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (t) return stripHtml(t[1]).split(/[|–—\-]/)[0].trim()
  return ''
}
const BAD_IMG = /logo|icon|placeholder|sprite|banner|no-?image|default|avatar|blank/i
function firstImg(html: string, base: string): string {
  // عکسِ واقعیِ محصول را ترجیح بده؛ لوگو/آیکون/بنر را رد کن. (og:image در هایپرساز لوگوست.)
  const imgs = [...html.matchAll(/<img[^>]+>/gi)].map(t => t[0])
  for (const tag of imgs) {
    const src = (tag.match(/\bsrc=["']([^"']+)["']/i) || tag.match(/\bdata-src=["']([^"']+)["']/i))?.[1]
    if (!src || !/\.(jpg|jpeg|png|webp)/i.test(src)) continue
    if (BAD_IMG.test(src) || BAD_IMG.test(tag)) continue
    return abs(base, src)
  }
  const og = ogImage(html)
  if (og && !BAD_IMG.test(og)) return abs(base, og)
  return ''
}
// عکسِ محصولِ هایپرساز: <img class="xzoom" src="app/...jpg"> (عکس‌های محصول در پوشهٔ app/).
function productImg(html: string, base: string): string {
  const xz = html.match(/<img[^>]*class=["'][^"']*xzoom[^"']*["'][^>]*\bsrc=["']([^"']+)["']/i)
    || html.match(/<img[^>]*\bsrc=["'](app\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)
  if (xz && xz[1]) return abs(base, xz[1])
  return firstImg(html, base)   // fallbackِ عمومی
}
// مشخصاتِ هایپرساز: <div class="prodAttributes"><ul><li><p>عنوان: مقدار</p></li>…
function listSpecs(html: string): CatalogSpec[] {
  const out: CatalogSpec[] = []
  const seen = new Set<string>()
  const block = html.match(/<div[^>]*class=["'][^"']*prodAttributes[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''
  const scope = block || html
  for (const li of scope.matchAll(/<li[^>]*>\s*(?:<p[^>]*>)?([\s\S]*?)(?:<\/p>)?\s*<\/li>/gi)) {
    const txt = stripHtml(li[1])
    const m = txt.match(/^(.{1,40}?)\s*[:：]\s*(.+)$/)
    if (m) { const k = m[1].trim(), v = m[2].trim(); if (k && v && v.length <= 300 && !seen.has(k)) { seen.add(k); out.push({ key: k, value: v }) } }
  }
  return out.slice(0, 30)
}
function allSpecs(html: string): CatalogSpec[] {
  const li = listSpecs(html)
  return li.length ? li : tableSpecs(html)
}
// نمودارِ تغییرِ قیمت (Highcharts): آرایهٔ تاریخ‌ها (categories) + قیمت‌ها (data).
export interface PricePoint { date: string; price: number }
function priceHistoryOf(html: string): PricePoint[] {
  const dataM = html.match(/data\s*:\s*\[\s*([\d.,\s]+?)\s*\]/i)
  if (!dataM) return []
  const prices = dataM[1].split(',').map(s => Number(s.trim())).filter(n => n > 1000)
  if (prices.length < 2) return []
  const catM = html.match(/categories\s*:\s*\[([^\]]*)\]/i)
  const dates = catM ? catM[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean) : []
  const out: PricePoint[] = []
  const n = dates.length ? Math.min(prices.length, dates.length) : prices.length
  for (let i = 0; i < n; i++) out.push({ date: dates[i] || '', price: prices[i] })
  return out.slice(-30)
}
// جدولِ مشخصاتِ فنی: هر ردیفِ دوستونیِ <tr><td>عنوان</td><td>مقدار</td></tr> (یا th/dt-dd).
function tableSpecs(html: string): CatalogSpec[] {
  const out: CatalogSpec[] = []
  const seen = new Set<string>()
  const add = (k: string, v: string) => { k = stripHtml(k); v = stripHtml(v); if (k && v && k.length <= 40 && v.length <= 200 && !seen.has(k)) { seen.add(k); out.push({ key: k, value: v }) } }
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => c[1])
    if (cells.length === 2) add(cells[0], cells[1])
  }
  // الگوی dt/dd
  const dts = [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)]
  for (const d of dts) add(d[1], d[2])
  return out.slice(0, 30)
}
function ogMeta(html: string, prop: string): string {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
  return m ? m[1].trim() : ''
}
async function runSitemap(cfg: ScraperConfig) {
  const base = cfg.baseUrl
  patch({ label: 'خواندنِ نقشهٔ سایت' })
  const { urls, productSpecific } = await collectSitemapUrls(base, cfg.maxProducts)
  if (urls.length === 0) throw new Error('در نقشهٔ سایت هیچ لینکی پیدا نشد — «تستِ اتصال» را بزنید یا آدرسِ سایت را بررسی کنید.')
  patch({ total: urls.length, label: `اسکرپِ ${urls.length.toLocaleString('fa-IR')} صفحه` })
  let added = 0, updated = 0, done = 0, hits = 0
  const batch: any[] = []
  const flush = () => { if (batch.length) { const r = upsertScraped(batch.splice(0)); added += r.added; updated += r.updated } }
  const CONC = 8   // همزمانیِ بیشتر برای سرعت (fetchِ سبک است، نه کروم)
  let idx = 0
  let stop = false
  const stopWatch = setInterval(() => { if (!loadJob().running) stop = true }, 3000)
  async function worker() {
    while (!stop && idx < urls.length) {
      const u = urls[idx++]
      const r = await fetchText(u, 15000)
      done++
      if (r.ok && r.text) {
        const ld = findProductLd(r.text)
        const ogType = ogMeta(r.text, 'og:type')
        // اگر لینک از نقشهٔ محصول آمده، همه محصول‌اند؛ وگرنه فقط صفحاتِ دارای Schema/OG-product.
        const isProduct = productSpecific || !!ld || /product/i.test(ogType)
        if (isProduct) {
          // آبشارِ استخراج: JSON-LD → OG → HTMLِ ساده (h1/عنوان)
          const name = stripHtml(String(ld?.name || '')) || htmlName(r.text)
          if (name && name.length > 1) {
            hits++
            const image = productImg(r.text, base)   // عکسِ واقعیِ محصول (xzoom / app/…)
            const specs = allSpecs(r.text)            // مشخصاتِ ویژگی‌ها
            const brand = specs.find(s => /تولید\s*کننده|^برند|مبدا\s*برند|سازنده/.test(s.key))?.value
              || (ld?.brand ? String(ld.brand.name || ld.brand) : undefined)
            // توضیحات: «سایر توضیحات» از مشخصات، وگرنه og:description اگر عمومی نبود.
            const other = specs.find(s => /سایر\s*توضیحات|توضیحات/.test(s.key))?.value
            const og = ogMeta(r.text, 'og:description')
            const description = other || (og && !/خرید آنلاین انواع/.test(og) ? og : '')
            const priceHistory = priceHistoryOf(r.text)
            const catPath = categoryPathFromLd(r.text, name)
            batch.push({
              name,
              categoryPath: catPath.length ? catPath : undefined,
              categoryName: catPath[catPath.length - 1] || (ld?.category ? String(ld.category) : 'دسته‌بندی‌نشده'),
              image: image || undefined,
              description: stripHtml(description).slice(0, 800),
              brand,
              specs: specs.length ? specs : undefined,
              priceHistory: priceHistory.length ? priceHistory : undefined,
              externalId: (u.match(/id=([\w-]+)/)?.[1]) || (u.match(/(\d{4,})/)?.[1]) || undefined, externalUrl: u,
            })
          }
        }
      }
      if (batch.length >= 20) flush()
      if (done % 5 === 0) patch({ done, added, updated })
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()))
  clearInterval(stopWatch)
  flush()
  patch({ done, added, updated })
  if (hits === 0) throw new Error(`${urls.length.toLocaleString('fa-IR')} صفحه بررسی شد ولی صفحهٔ محصولی با Schema/OG یافت نشد. احتمالاً لینک‌های نقشهٔ سایت محصول نیستند — با «تست» بررسی می‌کنیم.`)
  return { added, updated }
}

async function run() {
  const cfg = getConfig()
  patch({ running: true, done: 0, added: 0, updated: 0, categories: 0, error: undefined, startedAt: Date.now(), finishedAt: undefined, label: 'تشخیصِ پلتفرم', strategy: cfg.strategy })
  try {
    let strat = cfg.strategy
    if (strat === 'auto') { const t = await testConnection(); strat = t.recommend; patch({ strategy: strat, label: `استراتژی: ${strat}` }) }
    let res = { added: 0, updated: 0 }
    if (strat === 'wp') res = await runWp(cfg)
    else res = await runSitemap(cfg)   // sitemap و html هر دو از کرالِ نقشهٔ سایت + آبشارِ استخراج استفاده می‌کنند
    if (res.added === 0 && res.updated === 0) throw new Error('هیچ محصولی یافت نشد — «تستِ اتصال» را بزنید تا پلتفرم مشخص شود.')
    patch({ running: false, finishedAt: Date.now(), label: 'پایان' })
  } catch (e: any) {
    patch({ running: false, finishedAt: Date.now(), error: e?.message || 'خطا در اسکرپ' })
  }
}

// بررسیِ یک صفحهٔ محصول — برای عیب‌یابیِ استخراج (چه چیزی درمی‌آید + نمونهٔ HTML).
export async function inspectProduct(url: string) {
  const r = await fetchText(url, 20000)
  if (!r.ok) return { ok: false, status: r.status }
  const html = r.text
  const origin = (() => { try { return new URL(url).origin } catch { return getConfig().baseUrl } })()
  const specs = allSpecs(html)
  const ph = priceHistoryOf(html)
  const extracted = {
    name: (findProductLd(html)?.name && stripHtml(String(findProductLd(html)!.name))) || htmlName(html),
    image: productImg(html, origin),
    categoryPath: categoryPathFromLd(html, (findProductLd(html)?.name && stripHtml(String(findProductLd(html)!.name))) || htmlName(html)),
    specsCount: specs.length,
    specs: specs.slice(0, 25),
    priceHistoryCount: ph.length,
    priceHistory: ph.slice(0, 6),
  }
  // نمونهٔ اسکریپتِ نمودار (برای تنظیمِ استخراجِ قیمت اگر لازم شد)
  const ci = html.search(/Highcharts|series\s*:|نمودار/i)
  const chartSnippet = ci >= 0 ? html.slice(ci, ci + 900).replace(/\s+/g, ' ') : ''
  return { ok: true, extracted, chartSnippet }
}

export function startBackgroundScrape(): { started: boolean } {
  const j = getJob()
  if (j.running) return { started: false }
  patch({ running: true, startedAt: Date.now(), error: undefined })
  run().catch(err => patch({ running: false, error: String(err?.message || err) }))
  return { started: true }
}

// ساعتِ فعلی به وقتِ تهران
function tehranHour(now: number): number {
  try { return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date(now))) % 24 } catch { return new Date(now).getHours() }
}
// اجرای خودکارِ زمان‌بندی‌شده — از کرون فراخوانی می‌شود (فقط اینستنسِ صفر).
export function maybeAutoScrape(now = Date.now()): boolean {
  const cfg = getConfig()
  if (cfg.schedule === 'off') return false
  if (getJob().running) return false
  const interval = cfg.schedule === 'weekly' ? 6.8 * 24 * 3600 * 1000 : 22 * 3600 * 1000
  const last = cfg.lastAutoAt || 0
  if (now - last < interval) return false        // هنوز زمانش نرسیده
  if (tehranHour(now) !== cfg.scheduleHour) return false  // فقط در ساعتِ تعیین‌شده
  setConfig({ lastAutoAt: now })
  startBackgroundScrape()
  return true
}
