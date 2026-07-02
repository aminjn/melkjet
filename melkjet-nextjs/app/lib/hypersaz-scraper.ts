import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { upsertScraped, pruneSourceCategories, type CatalogSpec } from './catalog-store'
import { enrichCatalogBatch } from './catalog-enrich'

// موتورِ اسکرپِ چند-منبعی → کاتالوگِ مرجع. هر منبع (هایپرساز/آهن‌آنلاین/…) تنظیمات،
// وضعیتِ کار و زمان‌بندیِ مستقلِ خودش را دارد. چند-استراتژی با تشخیصِ خودکار:
// (۱) WordPress REST v2، (۲) نقشهٔ سایت + JSON-LD، (۳) HTML. «تستِ اتصال» پلتفرم را تشخیص می‌دهد.

export const SOURCES: { id: string; label: string; base: string }[] = [
  { id: 'hypersaz', label: 'هایپرساز', base: 'https://www.hypersaz.com' },
  { id: 'ahanonline', label: 'آهن‌آنلاین', base: 'https://ahanonline.com' },
]
export function isSource(id: string): boolean { return SOURCES.some(s => s.id === id) }
const cfgFile = (source: string) => join(process.cwd(), `.scraper-cfg-${source}.json`)
const jobFile = (source: string) => join(process.cwd(), `.scraper-job-${source}.json`)

export interface ScraperConfig {
  baseUrl: string
  strategy: 'auto' | 'wp' | 'sitemap' | 'html'
  maxProducts: number
  schedule: 'off' | 'daily' | 'weekly'
  scheduleHour: number
  lastAutoAt?: number
  aiEnrich?: boolean   // تکمیلِ خودکارِ توضیحات/مشخصات با AI پس از اسکرپ
  productLinkSel?: string; nameSel?: string; priceSel?: string; imageSel?: string; categorySel?: string
}
function defaultCfg(source: string): ScraperConfig {
  return { baseUrl: SOURCES.find(s => s.id === source)?.base || '', strategy: 'auto', maxProducts: 3000, schedule: 'off', scheduleHour: 3, aiEnrich: true }
}
export function getConfig(source: string): ScraperConfig {
  const f = cfgFile(source)
  if (existsSync(f)) { try { return { ...defaultCfg(source), ...JSON.parse(readFileSync(f, 'utf-8')) } } catch {} }
  return defaultCfg(source)
}
export function setConfig(source: string, patchIn: Partial<ScraperConfig>): ScraperConfig {
  const cur = getConfig(source)
  const next: ScraperConfig = {
    ...cur,
    baseUrl: patchIn.baseUrl !== undefined ? String(patchIn.baseUrl).replace(/\/+$/, '') : cur.baseUrl,
    strategy: (['auto', 'wp', 'sitemap', 'html'] as const).includes(patchIn.strategy as any) ? patchIn.strategy as any : cur.strategy,
    maxProducts: patchIn.maxProducts !== undefined ? Math.max(50, Math.min(20000, Number(patchIn.maxProducts) || cur.maxProducts)) : cur.maxProducts,
    schedule: (['off', 'daily', 'weekly'] as const).includes(patchIn.schedule as any) ? patchIn.schedule as any : cur.schedule,
    scheduleHour: patchIn.scheduleHour !== undefined ? Math.max(0, Math.min(23, Number(patchIn.scheduleHour) || 0)) : cur.scheduleHour,
    lastAutoAt: patchIn.lastAutoAt !== undefined ? Number(patchIn.lastAutoAt) : cur.lastAutoAt,
    aiEnrich: patchIn.aiEnrich !== undefined ? !!patchIn.aiEnrich : cur.aiEnrich,
    productLinkSel: patchIn.productLinkSel !== undefined ? String(patchIn.productLinkSel) : cur.productLinkSel,
    nameSel: patchIn.nameSel !== undefined ? String(patchIn.nameSel) : cur.nameSel,
    priceSel: patchIn.priceSel !== undefined ? String(patchIn.priceSel) : cur.priceSel,
    imageSel: patchIn.imageSel !== undefined ? String(patchIn.imageSel) : cur.imageSel,
    categorySel: patchIn.categorySel !== undefined ? String(patchIn.categorySel) : cur.categorySel,
  }
  writeFileSync(cfgFile(source), JSON.stringify(next, null, 2)); return next
}

// ── وضعیتِ کار ──
export interface ScrapeJob {
  running: boolean; total: number; done: number; added: number; updated: number; categories: number
  label?: string; error?: string; strategy?: string; startedAt?: number; finishedAt?: number; lastProgressAt?: number
}
const EMPTY: ScrapeJob = { running: false, total: 0, done: 0, added: 0, updated: 0, categories: 0 }
function loadJob(source: string): ScrapeJob { const f = jobFile(source); if (existsSync(f)) { try { return { ...EMPTY, ...JSON.parse(readFileSync(f, 'utf-8')) } } catch {} } return { ...EMPTY } }
function saveJob(source: string, j: ScrapeJob) { try { writeFileSync(jobFile(source), JSON.stringify(j)) } catch {} }
export function getJob(source: string): ScrapeJob {
  const j = loadJob(source)
  if (j.running) { const last = j.lastProgressAt || j.startedAt || 0; if (!last || Date.now() - last > 4 * 60 * 1000) { j.running = false; j.error = j.error || 'اسکرپ متوقف شد (هنگ یا ری‌استارتِ سرور).'; saveJob(source, j) } }
  return j
}
export function stopJob(source: string): ScrapeJob { const j = loadJob(source); j.running = false; j.finishedAt = Date.now(); j.error = 'به‌صورتِ دستی متوقف شد.'; saveJob(source, j); return j }
function patch(source: string, p: Partial<ScrapeJob>) { const j = { ...loadJob(source), ...p, lastProgressAt: Date.now() }; saveJob(source, j); return j }

// ── ابزارِ شبکه ──
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
async function fetchText(url: string, timeoutMs = 20000): Promise<{ ok: boolean; status: number; text: string; ct: string }> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'fa,en;q=0.8' }, signal: ac.signal, redirect: 'follow', cache: 'no-store' as any })
    const ct = r.headers.get('content-type') || ''
    const text = await r.text()
    return { ok: r.ok, status: r.status, text, ct }
  } catch { return { ok: false, status: 0, text: '', ct: '' } }
  finally { clearTimeout(t) }
}
async function fetchJson(url: string, timeoutMs = 20000): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetchText(url, timeoutMs)
  if (!r.ok) return { ok: false, status: r.status, data: null }
  try { return { ok: true, status: r.status, data: JSON.parse(r.text) } } catch { return { ok: false, status: r.status, data: null } }
}
function stripHtml(s: string): string { return (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim() }
function abs(base: string, u: string): string { try { return new URL(u, base).href } catch { return u } }

function jsonLdBlocks(html: string): any[] {
  const out: any[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) { try { out.push(JSON.parse(m[1].trim())) } catch {} }
  return out
}
function findProductLd(html: string): any | null {
  for (const b of jsonLdBlocks(html)) {
    const arr = Array.isArray(b) ? b : (b['@graph'] ? b['@graph'] : [b])
    for (const node of arr) { const t = node && node['@type']; if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) return node }
  }
  return null
}
function categoryPathFromLd(html: string, productName?: string): string[] {
  for (const b of jsonLdBlocks(html)) {
    const arr = Array.isArray(b) ? b : (b['@graph'] ? b['@graph'] : [b])
    for (const node of arr) {
      const t = node && node['@type']
      if (t === 'BreadcrumbList' || (Array.isArray(t) && t.includes('BreadcrumbList'))) {
        let names = (node.itemListElement || []).map((it: any) => String(it?.name || it?.item?.name || '').trim()).filter(Boolean)
        const nName = (s: string) => s.replace(/‌/g, '').replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
        // نامِ سایت/منبع و آیتم‌های زباله را از مسیرِ دسته حذف کن (نباید در پابلیک دیده شوند)
        const JUNK = /^(صفحه\s*اصلی|خانه|home|فروشگاه|آهن\s*آنلاین|هایپرساز|ahanonline|hypersaz|قیمت\s*روز|قیمت\s*آهن(\s*آلات)?|لیست\s*قیمت|بلاگ|وبلاگ|مقالات|اخبار|دسته\s*بندی(\s*ها)?)$/i
        names = names.filter((n: string) => !JUNK.test(nName(n)))
        if (names.length && productName && nName(names[names.length - 1]) === nName(productName)) names = names.slice(0, -1)
        return names.filter(Boolean).slice(0, 4)
      }
    }
  }
  return []
}
function ogImage(html: string): string { const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i); return m ? m[1] : '' }
function ogMeta(html: string, prop: string): string {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
  return m ? m[1].trim() : ''
}
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
  for (const tag of [...html.matchAll(/<img[^>]+>/gi)].map(t => t[0])) {
    const src = (tag.match(/\bsrc=["']([^"']+)["']/i) || tag.match(/\bdata-src=["']([^"']+)["']/i))?.[1]
    if (!src || !/\.(jpg|jpeg|png|webp)/i.test(src)) continue
    if (BAD_IMG.test(src) || BAD_IMG.test(tag)) continue
    return abs(base, src)
  }
  const og = ogImage(html); if (og && !BAD_IMG.test(og)) return abs(base, og)
  return ''
}
function productImg(html: string, base: string): string {
  const xz = html.match(/<img[^>]*class=["'][^"']*xzoom[^"']*["'][^>]*\bsrc=["']([^"']+)["']/i)
    || html.match(/<img[^>]*\bsrc=["'](app\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)
  if (xz && xz[1]) return abs(base, xz[1])
  return firstImg(html, base)
}
function listSpecs(html: string): CatalogSpec[] {
  const out: CatalogSpec[] = []; const seen = new Set<string>()
  const block = html.match(/<div[^>]*class=["'][^"']*prodAttributes[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''
  const scope = block || html
  for (const li of scope.matchAll(/<li[^>]*>\s*(?:<p[^>]*>)?([\s\S]*?)(?:<\/p>)?\s*<\/li>/gi)) {
    const txt = stripHtml(li[1]); const m = txt.match(/^(.{1,40}?)\s*[:：]\s*(.+)$/)
    if (m) { const k = m[1].trim(), v = m[2].trim(); if (k && v && v.length <= 300 && !seen.has(k)) { seen.add(k); out.push({ key: k, value: v }) } }
  }
  return out.slice(0, 30)
}
function tableSpecs(html: string): CatalogSpec[] {
  const out: CatalogSpec[] = []; const seen = new Set<string>()
  const add = (k: string, v: string) => { k = stripHtml(k); v = stripHtml(v); if (k && v && k.length <= 40 && v.length <= 200 && !seen.has(k)) { seen.add(k); out.push({ key: k, value: v }) } }
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) { const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => c[1]); if (cells.length === 2) add(cells[0], cells[1]) }
  for (const d of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) add(d[1], d[2])
  return out.slice(0, 30)
}
function allSpecs(html: string): CatalogSpec[] { const li = listSpecs(html); return li.length ? li : tableSpecs(html) }
export interface PricePoint { date: string; price: number }
function priceHistoryOf(html: string): PricePoint[] {
  const dataM = html.match(/data\s*:\s*\[\s*([\d.,\s]+?)\s*\]/i)
  if (!dataM) return []
  const prices = dataM[1].split(',').map(s => Number(s.trim())).filter(n => n > 1000)
  if (prices.length < 2) return []
  const catM = html.match(/categories\s*:\s*\[([^\]]*)\]/i)
  const dates = catM ? catM[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean) : []
  const out: PricePoint[] = []; const n = dates.length ? Math.min(prices.length, dates.length) : prices.length
  for (let i = 0; i < n; i++) out.push({ date: dates[i] || '', price: prices[i] })
  return out.slice(-30)
}
function extractProduct(html: string, url: string, base: string) {
  const ld = findProductLd(html)
  const name = stripHtml(String(ld?.name || '')) || htmlName(html)
  if (!name || name.length < 2) return null
  const image = productImg(html, base)
  const specs = allSpecs(html)
  const brand = specs.find(s => /تولید\s*کننده|^برند|مبدا\s*برند|سازنده/.test(s.key))?.value || (ld?.brand ? String(ld.brand.name || ld.brand) : undefined)
  const other = specs.find(s => /سایر\s*توضیحات|توضیحات/.test(s.key))?.value
  const og = ogMeta(html, 'og:description')
  const description = other || (og && !/خرید آنلاین انواع/.test(og) ? og : '')
  const priceHistory = priceHistoryOf(html)
  const catPath = categoryPathFromLd(html, name)
  return {
    name, categoryPath: catPath.length ? catPath : undefined,
    categoryName: catPath[catPath.length - 1] || (ld?.category ? String(ld.category) : 'دسته‌بندی‌نشده'),
    image: image || undefined, description: stripHtml(description).slice(0, 800), brand,
    specs: specs.length ? specs : undefined, priceHistory: priceHistory.length ? priceHistory : undefined,
    externalId: (url.match(/id=([\w-]+)/)?.[1]) || (url.match(/(\d{4,})/)?.[1]) || undefined, externalUrl: url,
  }
}

// ── جدولِ قیمت (مثلِ آهن‌آنلاین): هر ردیف = یک محصول با data-price (ریال) ──
function normName(s: string): string { return (s || '').replace(/‌/g, '').replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim() }
function priceTableProducts(html: string, url: string, base: string) {
  const catPath = categoryPathFromLd(html)
  const category = catPath[catPath.length - 1] || stripHtml(ogMeta(html, 'og:title')).replace(/^قیمت\s+/, '').split(/[|(]/)[0].trim() || 'آهن‌آلات'
  // صفحاتِ جدولِ قیمت (آهن‌آنلاین) عکسِ تک‌محصول ندارند؛ firstImg بنر/عکسِ پشتیبان را می‌گیرد،
  // پس عکس نمی‌گذاریم تا با «عکسِ دسته‌ها با AI» پُر شود.
  const image = undefined as string | undefined
  const items: any[] = []
  // هر صفحه ممکن است چند جدولِ کارخانه داشته باشد (پروفیل تهران، پروفیل اصفهان…). همه را بگیر.
  const tableRe = /<table[\s\S]*?<\/table>/gi
  let tm: RegExpExecArray | null
  while ((tm = tableRe.exec(html))) {
    const table = tm[0]
    if (!/data-price|table_price|product-price/i.test(table)) continue
    // نامِ کارخانه: نزدیک‌ترین عنوان قبل از جدول (مثلِ «پروفیل تهران»). دسته را از آن حذف کن.
    const before = html.slice(Math.max(0, tm.index - 700), tm.index)
    const heads = [...before.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|class=["'][^"']*(?:title|heading|table[_-]?title|tab[_-]?title)[^"']*["'][^>]*>([\s\S]*?)</gi)]
    let factory = ''
    if (heads.length) {
      let h = stripHtml(heads[heads.length - 1][1] || heads[heads.length - 1][2] || '').split('|')[0]
      factory = h.replace(new RegExp(`قیمت|آهن\\s*آنلاین|قوطی|${category}`, 'g'), '').replace(/\s+/g, ' ').trim()
      if (factory.length > 24 || /\d{3,}/.test(factory)) factory = ''
    }
    const headHtml = table.match(/<thead[\s\S]*?<\/thead>/i)?.[0] || table.match(/<tr[\s\S]*?<\/tr>/i)?.[0] || ''
    const headers = [...headHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripHtml(m[1]))
    const bodyHtml = table.match(/<tbody[\s\S]*?<\/tbody>/i)?.[0] || table
    for (const row of bodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const rowHtml = row[1]
      const priceAttr = rowHtml.match(/data-price=["'](\d+)["']/)
      const price = priceAttr ? Number(priceAttr[1]) : 0   // ریال
      if (!price) continue
      // لینکِ صفحهٔ خودِ محصول (اگر در ردیف باشد) — برای منبع + اسکرپِ نمودارِ بلندمدت در آینده
      const linkM = rowHtml.match(/<a[^>]+href=["']([^"'#]+)["']/i)
      const rowUrl = linkM && !/tel:|mailto:|javascript:/i.test(linkM[1]) ? abs(base, linkM[1]) : url
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripHtml(m[1]))
      const specs: CatalogSpec[] = []
      let dateCell = ''
      const BAD = /قیمت|نمودار|price|عملیات|نوسان|تغییر|تاریخ|date|تومان|ریال|درصد/i
      for (let i = 0; i < cells.length; i++) {
        const k = (headers[i] || '').trim(); const v = cells[i]
        if (/\d{3,4}\/\d{1,2}\/\d{1,2}/.test(v)) { dateCell = v; continue }
        // نه کلید و نه مقدار نباید ستونِ قیمت/تاریخ/نمودار باشد (وگرنه «تاریخ: قیمت (تومان)» ثبت می‌شد)
        if (k && v && !BAD.test(k) && !BAD.test(v) && v.length < 40 && !/^\d[\d,]{4,}$/.test(v)) specs.push({ key: k, value: v })
      }
      if (factory) specs.push({ key: 'کارخانه', value: factory })
      const specVal = (re: RegExp) => specs.find(s => re.test(s.key))?.value || ''
      const size = specVal(/سایز|ابعاد|قطر/), thick = specVal(/ضخامت/), len = specVal(/طول|حالت|شاخه/), grade = specVal(/گرید|استاندارد|^نوع/)
      // نام = دسته + سایز + ضخامت + طول + کارخانه (کارخانه نام را یکتا می‌کند)
      const nameParts = [category, size, thick ? `ضخامت ${thick}` : '', len, grade, factory].filter(Boolean)
      const name = (nameParts.length > 1 ? nameParts.join(' ') : [category, ...specs.slice(0, 3).map(s => s.value)].join(' ')).replace(/\s+/g, ' ').trim()
      if (!name || (name === category && !size && !thick)) continue
      items.push({
        name, categoryPath: catPath.length ? catPath : undefined, categoryName: category,
        image, specs: specs.length ? specs : undefined, brand: factory || undefined,
        priceHistory: [{ date: dateCell || '', price }],
        externalId: `ahan-${normName(name).replace(/\s+/g, '-').slice(0, 70)}`, externalUrl: rowUrl,
      })
    }
  }
  return items
}

// ── تستِ اتصال / تشخیصِ پلتفرم ──
export interface Probe { name: string; url: string; ok: boolean; status: number; note: string }
export async function testConnection(source: string) {
  const base = getConfig(source).baseUrl
  const probes: Probe[] = []
  let recommend: ScraperConfig['strategy'] = 'html'
  const home = await fetchText(base + '/')
  const isWp = /wp-content|wp-json|woocommerce/i.test(home.text)
  probes.push({ name: 'صفحهٔ اصلی', url: base + '/', ok: home.ok, status: home.status, note: home.ok ? (isWp ? 'وردپرس/ووکامرس شناسایی شد' : 'وردپرس شناسایی نشد') : 'در دسترس نیست' })
  const wp = await fetchJson(base + '/wp-json/wp/v2/product?per_page=1')
  const wpOk = wp.ok && Array.isArray(wp.data) && wp.data.length > 0
  probes.push({ name: 'WordPress REST (product)', url: base + '/wp-json/wp/v2/product?per_page=1', ok: wpOk, status: wp.status, note: wpOk ? 'کار می‌کند ✓' : (wp.status === 404 ? 'یافت نشد (۴۰۴)' : `ناموفق (${wp.status})`) })
  if (wpOk) recommend = 'wp'
  const store = await fetchJson(base + '/wp-json/wc/store/v1/products?per_page=1')
  const storeOk = store.ok && Array.isArray(store.data) && store.data.length > 0
  probes.push({ name: 'WooCommerce Store API', url: base + '/wp-json/wc/store/v1/products?per_page=1', ok: storeOk, status: store.status, note: storeOk ? 'کار می‌کند ✓' : (store.status === 404 ? 'یافت نشد (۴۰۴)' : `ناموفق (${store.status})`) })
  let smUrl = ''
  for (const p of ['/sitemap.xml', '/sitemap_index.xml', '/product-sitemap.xml', '/wp-sitemap.xml']) {
    const r = await fetchText(base + p, 12000)
    if (r.ok && /<(sitemapindex|urlset)/i.test(r.text)) { smUrl = base + p; probes.push({ name: 'نقشهٔ سایت', url: base + p, ok: true, status: r.status, note: 'یافت شد ✓' }); break }
  }
  if (!smUrl) probes.push({ name: 'نقشهٔ سایت', url: base + '/sitemap.xml', ok: false, status: 0, note: 'یافت نشد' })
  const hasLd = home.ok && /application\/ld\+json/i.test(home.text)
  probes.push({ name: 'JSON-LD (Schema)', url: base + '/', ok: hasLd, status: home.status, note: hasLd ? 'در صفحهٔ اصلی موجود ✓' : 'در صفحهٔ اصلی نیست (روی صفحاتِ محصول بررسی می‌شود)' })
  if (recommend !== 'wp') { if (smUrl) recommend = 'sitemap'; else if (storeOk) recommend = 'wp' }
  const platform = wpOk || storeOk || isWp ? 'وردپرس/ووکامرس' : (smUrl ? 'دارای نقشهٔ سایت' : 'نامشخص (نیاز به سِلکتورِ HTML)')
  let sitemapType = '', sitemapLocs: string[] = [], subSample: string[] = []
  if (smUrl) {
    const r = await fetchText(smUrl, 12000)
    if (r.ok) {
      sitemapType = /<sitemapindex/i.test(r.text) ? 'ایندکس (زیرنقشه‌ها)' : 'urlset (لینکِ صفحات)'
      sitemapLocs = [...r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, 12)
      const firstXml = sitemapLocs.find(l => /\.xml/i.test(l))
      if (firstXml) { const sub = await fetchText(firstXml.replace(/&amp;/g, '&'), 12000); if (sub.ok) subSample = [...sub.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, 8) }
    }
  }
  return { base, platform, probes, recommend, smUrl, sitemapType, sitemapLocs, subSample }
}

// ── استراتژی‌ها ──
function specsFromWp(p: any): CatalogSpec[] {
  const out: CatalogSpec[] = []; const meta = p.meta || {}
  for (const k of Object.keys(meta)) { const v = meta[k]; if (typeof v === 'string' && v && !k.startsWith('_')) out.push({ key: k.slice(0, 60), value: v.slice(0, 120) }) }
  return out.slice(0, 12)
}
async function runWp(source: string, cfg: ScraperConfig) {
  const base = cfg.baseUrl
  const catMap = new Map<number, string>()
  for (let p = 1; p <= 20; p++) {
    const r = await fetchJson(`${base}/wp-json/wp/v2/product_cat?per_page=100&page=${p}`)
    if (!r.ok || !Array.isArray(r.data) || !r.data.length) break
    for (const c of r.data) catMap.set(c.id, stripHtml(c.name || ''))
    patch(source, { categories: catMap.size })
    if (r.data.length < 100) break
  }
  let page = 1, added = 0, updated = 0, done = 0
  while (loadJob(source).running) {
    const r = await fetchJson(`${base}/wp-json/wp/v2/product?per_page=50&page=${page}&_embed`)
    if (!r.ok || !Array.isArray(r.data) || !r.data.length) break
    const items = r.data.map((p: any) => {
      const catIds: number[] = Array.isArray(p.product_cat) ? p.product_cat : []
      const catName = catIds.map(id => catMap.get(id)).find(Boolean) || (p._embedded?.['wp:term']?.flat?.().find((t: any) => t?.taxonomy === 'product_cat')?.name) || 'دسته‌بندی‌نشده'
      return { name: stripHtml(p.title?.rendered || ''), categoryName: stripHtml(catName), image: p._embedded?.['wp:featuredmedia']?.[0]?.source_url || undefined, description: stripHtml(p.excerpt?.rendered || p.content?.rendered || '').slice(0, 800), specs: specsFromWp(p), externalId: String(p.id || ''), externalUrl: p.link ? String(p.link) : undefined }
    }).filter((x: any) => x.name)
    const res = upsertScraped(items, source); added += res.added; updated += res.updated
    done += r.data.length
    patch(source, { added, updated, done, total: Math.max(done + 50, loadJob(source).total) })
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
  // زیرنقشه = هر loc که .xml داشته باشد (حتی با اسلشِ انتهایی مثلِ آهن‌آنلاین: …/index.xml/) یا مسیرِ /sitemap/
  const isXml = (l: string) => /\.xml(\/|\?|$)/i.test(l) || /\/sitemap\//i.test(l)
  const locsOf = (t: string) => [...t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1].replace(/&amp;/g, '&').trim())
  const topLocs = locsOf(text)
  const topXml = topLocs.filter(isXml)
  let productSpecific = false
  if (topXml.length) {
    // زیرنقشه‌های «محصول» و «دستهٔ محصول» را بگیر (صفحاتِ دسته مثلِ آهن‌آنلاین جدولِ قیمت دارند).
    // پست/برگه/برچسب/misc را کنار بگذار.
    let seeds = topXml.filter(l => !/(misc|posts?|\/pages?\/|tag|author|user|blog|comment)/i.test(l))
    if (!seeds.length) seeds = topXml
    // صفحاتِ «دسته/product-category» اول (چون جدولِ قیمتِ کامل دارند) تا در سقفِ تعداد اول بیایند.
    seeds = seeds.sort((a, b) => (/categor/i.test(b) ? 1 : 0) - (/categor/i.test(a) ? 1 : 0))
    productSpecific = true
    const queue = [...seeds]; const visited = new Set<string>()
    while (queue.length && urls.size < cap) {
      const sm = queue.shift()!; if (visited.has(sm)) continue; visited.add(sm)
      const r = await fetchText(sm, 15000); if (!r.ok) continue
      for (const loc of locsOf(r.text)) {
        if (isXml(loc)) { if (!visited.has(loc)) queue.push(loc) }        // نقشهٔ تودرتو → ادامه بده
        else { urls.add(loc); if (urls.size >= cap) break }               // لینکِ صفحه
      }
    }
  } else {
    for (const u of topLocs) { urls.add(u); if (urls.size >= cap) break }
    productSpecific = /product|kala|mahsul|shop|ahan/i.test(text)
  }
  const all = [...urls]
  const prod = all.filter(u => /\/product\/|\/products\/|\/product-category\/|\/category\/|\/kala\/|\/shop\/|mahsul|\/p\//i.test(u))
  if (prod.length) return { urls: prod.slice(0, cap), productSpecific: true }
  return { urls: all.slice(0, cap), productSpecific }
}
async function runSitemap(source: string, cfg: ScraperConfig) {
  const base = cfg.baseUrl
  patch(source, { label: 'خواندنِ نقشهٔ سایت' })
  const { urls, productSpecific } = await collectSitemapUrls(base, cfg.maxProducts)
  if (urls.length === 0) throw new Error('در نقشهٔ سایت هیچ لینکی پیدا نشد — «تستِ اتصال» را بزنید یا آدرسِ سایت را بررسی کنید.')
  patch(source, { total: urls.length, label: `اسکرپِ ${urls.length.toLocaleString('fa-IR')} صفحه` })
  let added = 0, updated = 0, done = 0, hits = 0
  const batch: any[] = []
  const flush = () => { if (batch.length) { const r = upsertScraped(batch.splice(0), source); added += r.added; updated += r.updated } }
  const CONC = 8; let idx = 0, stop = false
  const stopWatch = setInterval(() => { if (!loadJob(source).running) stop = true }, 3000)
  async function worker() {
    while (!stop && idx < urls.length) {
      const u = urls[idx++]
      const r = await fetchText(u, 15000)
      done++
      if (r.ok && r.text) {
        // اول جدولِ قیمت (آهن‌آنلاین): هر ردیف یک محصول. وگرنه صفحهٔ تک‌محصول.
        const tableItems = priceTableProducts(r.text, u, base)
        if (tableItems.length) { hits += tableItems.length; batch.push(...tableItems) }
        else {
          const isProduct = productSpecific || !!findProductLd(r.text) || /product/i.test(ogMeta(r.text, 'og:type'))
          if (isProduct) { const it = extractProduct(r.text, u, base); if (it) { hits++; batch.push(it) } }
        }
      }
      if (batch.length >= 20) flush()
      if (done % 5 === 0) patch(source, { done, added, updated })
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()))
  clearInterval(stopWatch); flush(); patch(source, { done, added, updated })
  if (hits === 0) throw new Error(`${urls.length.toLocaleString('fa-IR')} صفحه بررسی شد ولی صفحهٔ محصولی با Schema/OG یافت نشد. با «بررسیِ یک محصول» ساختارِ سایت را بفرستید تا پارسر تنظیم شود.`)
  return { added, updated }
}
async function run(source: string) {
  const cfg = getConfig(source)
  patch(source, { running: true, done: 0, added: 0, updated: 0, categories: 0, error: undefined, startedAt: Date.now(), finishedAt: undefined, label: 'تشخیصِ پلتفرم', strategy: cfg.strategy })
  try {
    let strat = cfg.strategy
    if (strat === 'auto') { const t = await testConnection(source); strat = t.recommend; patch(source, { strategy: strat, label: `استراتژی: ${strat}` }) }
    let res = { added: 0, updated: 0 }
    if (strat === 'wp') res = await runWp(source, cfg)
    else res = await runSitemap(source, cfg)
    if (res.added === 0 && res.updated === 0) throw new Error('هیچ محصولی یافت نشد — «تستِ اتصال» را بزنید.')
    pruneSourceCategories()   // دسته‌های نامِ منبع (آهن آنلاین/هایپرساز) نباید در سلسله‌مراتب بمانند
    // تکمیلِ توضیحات/مشخصاتِ فنیِ محصولاتِ بدونِ توضیح با AI (فقط جاهای خالی، یک‌بار)
    if (getConfig(source).aiEnrich !== false) {
      patch(source, { label: 'تکمیلِ توضیحات/مشخصات با AI' })
      let enriched = 0
      while (loadJob(source).running) {
        const e = await enrichCatalogBatch({ source, limit: 3 })
        if (e.noModel) break
        enriched += e.enriched
        patch(source, { label: `AI: ${enriched.toLocaleString('fa-IR')} محصول تکمیل شد${e.remaining ? ` · ${e.remaining.toLocaleString('fa-IR')} باقی` : ''}` })
        if (e.remaining === 0 || e.enriched === 0) break
      }
    }
    patch(source, { running: false, finishedAt: Date.now(), label: 'پایان' })
  } catch (e: any) {
    patch(source, { running: false, finishedAt: Date.now(), error: e?.message || 'خطا در اسکرپ' })
  }
}

export async function inspectProduct(source: string, url: string) {
  const r = await fetchText(url, 20000)
  if (!r.ok) return { ok: false, status: r.status }
  const html = r.text
  const origin = (() => { try { return new URL(url).origin } catch { return getConfig(source).baseUrl } })()
  const specs = allSpecs(html); const ph = priceHistoryOf(html)
  const tableItems = priceTableProducts(html, url, origin)
  const extracted = {
    name: (findProductLd(html)?.name && stripHtml(String(findProductLd(html)!.name))) || htmlName(html),
    image: productImg(html, origin),
    categoryPath: categoryPathFromLd(html, (findProductLd(html)?.name && stripHtml(String(findProductLd(html)!.name))) || htmlName(html)),
    specsCount: specs.length, specs: specs.slice(0, 25),
    priceHistoryCount: ph.length, priceHistory: ph.slice(0, 6),
    // برای سایت‌های جدولِ قیمت (آهن‌آنلاین): تعدادِ ردیف‌ها + نمونه
    priceTableRows: tableItems.length, priceTableSample: tableItems.slice(0, 4),
  }
  const ci = html.search(/Highcharts|series\s*:|نمودار/i)
  const chartSnippet = ci >= 0 ? html.slice(ci, ci + 900).replace(/\s+/g, ' ') : ''
  const si = html.search(/ویژگی|مشخصات|مبدا\s*برند|قیمت|price/i)
  const snippet = (si >= 0 ? html.slice(Math.max(0, si - 200), si + 2200) : html.slice(0, 2200)).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+/g, ' ').slice(0, 3000)
  return { ok: true, extracted, chartSnippet, snippet }
}

export function startBackgroundScrape(source: string): { started: boolean } {
  if (getJob(source).running) return { started: false }
  patch(source, { running: true, startedAt: Date.now(), error: undefined })
  run(source).catch(err => patch(source, { running: false, error: String(err?.message || err) }))
  return { started: true }
}

function tehranHour(now: number): number {
  try { return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date(now))) % 24 } catch { return new Date(now).getHours() }
}
// اجرای خودکارِ زمان‌بندی‌شدهٔ همهٔ منابع — از کرون (اینستنسِ صفر).
export function maybeAutoScrape(now = Date.now()): boolean {
  let started = false
  for (const s of SOURCES) {
    const cfg = getConfig(s.id)
    if (cfg.schedule === 'off') continue
    if (getJob(s.id).running) continue
    const interval = cfg.schedule === 'weekly' ? 6.8 * 24 * 3600 * 1000 : 22 * 3600 * 1000
    if (now - (cfg.lastAutoAt || 0) < interval) continue
    if (tehranHour(now) !== cfg.scheduleHour) continue
    setConfig(s.id, { lastAutoAt: now }); startBackgroundScrape(s.id); started = true
  }
  return started
}
