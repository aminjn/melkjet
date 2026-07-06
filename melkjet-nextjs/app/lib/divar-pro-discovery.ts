import { proxiedRequest } from './proxy-fetch'
import { getAdminData } from './admin-store'
import { addPros, setMeta, tryStartMeta, type DiscoveryMeta } from './divar-pro-store'

// ── کشفِ صفحه‌های pro (آژانس) دیوار ──
// روش A: خزشِ سایت‌مپِ دیوار (robots → sitemaps → استخراجِ /pro/{slug}).
// روش B: خزشِ نتایجِ جستجوی املاک → جزئیاتِ هر آگهی → لینکِ /pro/{slug}.
// هر دو به‌صورتِ پس‌زمینه اجرا و در انبار انباشته می‌شوند. (دیوار داخلی است — بدونِ مشکلِ تحریم.)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const proxy = () => getAdminData().divar?.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || 'http://127.0.0.1:1080'
// لینکِ pro/کسب‌وکار در متن (چه ساده چه با \/ فرارگرفته در JSON).
const PRO_RE = /divar\.ir\\?\/(?:pro|businesses|business)\\?\/([A-Za-z0-9_-]{2,40})/gi

async function get(url: string): Promise<string> {
  const res = await proxiedRequest(url, { method: 'GET', headers: { 'user-agent': UA, accept: '*/*', referer: 'https://divar.ir/' }, proxyUrl: proxy(), timeout: 15000 })
  return res.status === 200 ? (res.body || '') : ''
}
const extractPros = (body: string, into: Set<string>) => { for (const m of body.matchAll(PRO_RE)) { const s = m[1].toLowerCase(); if (s !== 'pro' && s.length >= 2) into.add(s) } }

// ── روش A: سایت‌مپ ──
async function discoverFromSitemap(maxSitemaps = 80): Promise<{ found: number; added: number; fetched: number }> {
  const seen = new Set<string>(); const pros = new Set<string>()
  const prio = (u: string) => (/(pro|business|brand|agency)/i.test(u) ? 0 : 1)
  const queue: string[] = []
  try { const robots = await get('https://divar.ir/robots.txt'); for (const m of robots.matchAll(/Sitemap:\s*(\S+)/gi)) queue.push(m[1]) } catch {}
  if (!queue.length) queue.push('https://divar.ir/sitemap.xml')
  let fetched = 0
  while (queue.length && fetched < maxSitemaps) {
    queue.sort((a, b) => prio(a) - prio(b))
    const url = queue.shift()!; if (seen.has(url)) continue; seen.add(url)
    let body = ''
    try { body = await get(url) } catch { continue }
    if (!body) continue
    fetched++
    extractPros(body, pros)
    // اگر sitemapindex بود، فرزندها را به صف اضافه کن (اولویت با pro/business).
    for (const m of body.matchAll(/<loc>\s*([^<\s]+\.xml[^<\s]*)\s*<\/loc>/gi)) { const c = m[1].replace(/&amp;/g, '&'); if (!seen.has(c)) queue.push(c) }
    if (fetched % 3 === 0) await addPros([...pros].map(slug => ({ slug, source: 'sitemap' })))
    await setMeta({ scanned: fetched, note: `سایت‌مپ: ${fetched} فایل خوانده شد، ${pros.size} pro` })
    await sleep(150)
  }
  const added = await addPros([...pros].map(slug => ({ slug, source: 'sitemap' })))
  return { found: pros.size, added, fetched }
}

// ── روش B: خزشِ جستجو → جزئیاتِ آگهی → لینکِ pro ──
async function discoverFromSearch(searchUrl: string, sampleDetails = 80): Promise<{ found: number; added: number; scanned: number }> {
  const { scrapeDivar } = await import('./divar')
  let items: any[] = []
  try { items = await scrapeDivar({ id: 'disc', name: 'کشفِ pro', url: searchUrl, type: 'listing', method: 'divar', enabled: true, schedule: 'manual', meta: {} } as any) } catch {}
  const tokens = items.map(it => (String(it.url || '').match(/\/v\/([A-Za-z0-9_-]+)/) || [])[1]).filter(Boolean).slice(0, sampleDetails)
  const pros = new Set<string>()
  let scanned = 0
  for (const tk of tokens) {
    try { const body = await get(`https://api.divar.ir/v8/posts-v2/web/${tk}`); extractPros(body, pros) } catch {}
    scanned++
    if (scanned % 10 === 0) { await addPros([...pros].map(slug => ({ slug, source: 'search' }))); await setMeta({ scanned, note: `جستجو: ${scanned}/${tokens.length} آگهی، ${pros.size} pro` }) }
    await sleep(350)
  }
  const added = await addPros([...pros].map(slug => ({ slug, source: 'search' })))
  return { found: pros.size, added, scanned }
}

// اجرای پس‌زمینه (fire-and-forget) با قفلِ meta. برمی‌گرداند آیا شروع شد.
export async function startDiscovery(opts: { method: 'sitemap' | 'search'; searchUrl?: string }): Promise<{ started: boolean; reason?: string }> {
  if (opts.method === 'search' && !opts.searchUrl) return { started: false, reason: 'برای روشِ جستجو، لینکِ جستجوی دیوار لازم است' }
  const ok = await tryStartMeta()
  if (!ok) return { started: false, reason: 'یک کشف در حال اجراست' }
  ;(async () => {
    let note = ''
    try {
      const r = opts.method === 'sitemap' ? await discoverFromSitemap() : await discoverFromSearch(opts.searchUrl!)
      note = `پایان — ${r.found} pro یافت شد (${r.added} جدید)`
    } catch (e: any) { note = 'خطا: ' + (e?.message || 'ناموفق') }
    finally { await setMeta({ running: false, finishedAt: Date.now(), note, lastFound: undefined } as Partial<DiscoveryMeta>) }
  })()
  return { started: true }
}
