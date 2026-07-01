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
  // سِلکتورهای HTML (برای استراتژیِ html وقتی سایت WP نیست)
  productLinkSel?: string   // مثلاً a.product-title  (لینکِ صفحهٔ محصول)
  nameSel?: string
  priceSel?: string
  imageSel?: string
  categorySel?: string
}
const DEFAULT_CFG: ScraperConfig = { baseUrl: 'https://www.hypersaz.com', strategy: 'auto', maxProducts: 3000 }

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
function categoryFromLd(html: string): string {
  for (const b of jsonLdBlocks(html)) {
    const arr = Array.isArray(b) ? b : (b['@graph'] ? b['@graph'] : [b])
    for (const node of arr) {
      const t = node && node['@type']
      if (t === 'BreadcrumbList' || (Array.isArray(t) && t.includes('BreadcrumbList'))) {
        const items = node.itemListElement || []
        // یکی‌مانده‌به‌آخر معمولاً دستهٔ محصول است
        if (items.length >= 2) { const it = items[items.length - 2]; const name = it?.name || it?.item?.name; if (name) return String(name) }
      }
    }
  }
  return ''
}
function ogImage(html: string): string { const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i); return m ? m[1] : '' }

// ── تستِ اتصال / تشخیصِ پلتفرم ──
export interface Probe { name: string; url: string; ok: boolean; status: number; note: string }
export async function testConnection(): Promise<{ base: string; platform: string; probes: Probe[]; recommend: ScraperConfig['strategy']; sample?: any }> {
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

  // ۵) JSON-LD روی صفحهٔ اصلی (نشانهٔ اینکه صفحاتِ محصول Schema دارند)
  const hasLd = home.ok && /application\/ld\+json/i.test(home.text)
  probes.push({ name: 'JSON-LD (Schema)', url: base + '/', ok: hasLd, status: home.status, note: hasLd ? 'موجود ✓ (اسکرپ با نقشهٔ سایت ممکن است)' : 'یافت نشد' })

  if (recommend !== 'wp') { if (smUrl && hasLd) recommend = 'sitemap'; else if (storeOk) recommend = 'wp' }
  const platform = wpOk || storeOk || isWp ? 'وردپرس/ووکامرس' : (smUrl ? 'دارای نقشهٔ سایت' : 'نامشخص (نیاز به سِلکتورِ HTML)')
  return { base, platform, probes, recommend, sample }
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

async function collectSitemapUrls(base: string, cap: number): Promise<string[]> {
  const urls = new Set<string>()
  // ۱) یک نقشهٔ سایت (index یا urlset) پیدا کن
  let text = '', found = ''
  for (const s of ['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml', '/product-sitemap.xml']) {
    const r = await fetchText(base + s, 15000)
    if (r.ok && /<(sitemapindex|urlset)/i.test(r.text)) { text = r.text; found = base + s; break }
  }
  if (!text) return []
  const locsOf = (t: string) => [...t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1].replace(/&amp;/g, '&'))
  const locs = locsOf(text)
  if (/<urlset/i.test(text) && !/<sitemapindex/i.test(text)) {
    // نقشهٔ سایتِ مستقیم (احتمالاً همان product-sitemap)
    for (const l of locs) { urls.add(l); if (urls.size >= cap) break }
  } else {
    // index → زیرنقشه‌های «محصول» را ترجیح بده؛ اگر نبود، همه را بخوان.
    let subs = locs.filter(l => /product/i.test(l))
    if (!subs.length) subs = locs.filter(l => !/(post|page|category|tag|author|user)[-_]?sitemap/i.test(l))
    if (!subs.length) subs = locs
    for (const sm of subs) {
      if (urls.size >= cap) break
      const r = await fetchText(sm, 15000)
      if (!r.ok) continue
      for (const u of locsOf(r.text)) { urls.add(u); if (urls.size >= cap) break }
    }
  }
  const all = [...urls]
  // اگر زیرنقشهٔ محصول را گرفته باشیم همه محصول‌اند؛ وگرنه با مسیر فیلتر کن.
  const prod = all.filter(u => /\/product\/|\/products\/|\/kala\/|\/shop\/|\/mahsul|\/mahsulat/i.test(u))
  return (prod.length ? prod : all).slice(0, cap)
}
function ogMeta(html: string, prop: string): string {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
  return m ? m[1].trim() : ''
}
async function runSitemap(cfg: ScraperConfig) {
  const base = cfg.baseUrl
  patch({ label: 'خواندنِ نقشهٔ سایت' })
  const urls = await collectSitemapUrls(base, cfg.maxProducts)
  if (urls.length === 0) throw new Error('در نقشهٔ سایت هیچ لینکی پیدا نشد — «تستِ اتصال» را بزنید یا آدرسِ سایت را بررسی کنید.')
  patch({ total: urls.length, label: `اسکرپِ ${urls.length.toLocaleString('fa-IR')} صفحه` })
  let added = 0, updated = 0, done = 0, hits = 0
  const batch: any[] = []
  const flush = () => { if (batch.length) { const r = upsertScraped(batch.splice(0)); added += r.added; updated += r.updated } }
  const CONC = 5
  let idx = 0
  async function worker() {
    while (loadJob().running && idx < urls.length) {
      const u = urls[idx++]
      const r = await fetchText(u, 15000)
      done++
      if (r.ok && r.text) {
        const ld = findProductLd(r.text)
        const ogType = ogMeta(r.text, 'og:type')
        const isProduct = !!ld || /product/i.test(ogType)
        if (isProduct) {
          const name = stripHtml(String(ld?.name || ogMeta(r.text, 'og:title') || ''))
          if (name) {
            hits++
            const ldImg = ld ? (Array.isArray(ld.image) ? ld.image[0] : ld.image) : ''
            const image = (typeof ldImg === 'object' ? ldImg?.url : ldImg) || ogImage(r.text)
            batch.push({
              name,
              categoryName: categoryFromLd(r.text) || (ld?.category ? String(ld.category) : 'دسته‌بندی‌نشده'),
              image: image ? abs(base, String(image)) : undefined,
              description: stripHtml(String(ld?.description || ogMeta(r.text, 'og:description') || '')).slice(0, 800),
              brand: ld?.brand ? String(ld.brand.name || ld.brand) : undefined,
              externalId: (u.match(/(\d+)(?:\/?$)/)?.[1]) || undefined, externalUrl: u,
            })
          }
        }
      }
      if (batch.length >= 20) flush()
      if (done % 5 === 0) patch({ done, added, updated })
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()))
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
    else if (strat === 'sitemap') res = await runSitemap(cfg)
    else throw new Error('این سایت با REST/نقشهٔ سایت اسکرپ نشد. لطفاً «تستِ اتصال» را بزنید و در صورت نیاز استراتژیِ HTML را با سِلکتورها تنظیم کنید.')
    if (res.added === 0 && res.updated === 0) throw new Error('هیچ محصولی یافت نشد — «تستِ اتصال» را بزنید تا پلتفرم مشخص شود.')
    patch({ running: false, finishedAt: Date.now(), label: 'پایان' })
  } catch (e: any) {
    patch({ running: false, finishedAt: Date.now(), error: e?.message || 'خطا در اسکرپ' })
  }
}

export function startBackgroundScrape(): { started: boolean } {
  const j = getJob()
  if (j.running) return { started: false }
  patch({ running: true, startedAt: Date.now(), error: undefined })
  run().catch(err => patch({ running: false, error: String(err?.message || err) }))
  return { started: true }
}
