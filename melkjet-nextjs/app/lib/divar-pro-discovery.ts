import { proxiedRequest } from './proxy-fetch'
import { getAdminData } from './admin-store'
import { addPros, setMeta, tryStartMeta, listPros, type DiscoveryMeta } from './divar-pro-store'
import { fetchDivarProfileTokens } from './divar-post'

// ── کشفِ صفحه‌های pro (آژانس) دیوار ──
// روش A: خزشِ سایت‌مپِ دیوار (robots → sitemaps → استخراجِ /pro/{slug}).
//        نکته: سایت‌مپِ عمومیِ دیوار معمولاً لینکِ /pro/ ندارد؛ روشِ جستجو مطمئن‌تر است.
// روش B: خزشِ نتایجِ جستجوی املاک → جزئیاتِ هر آگهی → لینک/توکنِ آژانس (pro).
// هر دو پس‌زمینه اجرا و در انبار انباشته می‌شوند. (دیوار داخلی است — از طریقِ پروکسیِ ادمین.)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const proxy = () => getAdminData().divar?.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || 'http://127.0.0.1:1080'
// لینکِ pro/کسب‌وکار در متن (چه ساده چه با \/ فرارگرفته در JSON).
const PRO_RE = /divar\.ir\\?\/(?:pro|businesses|business)\\?\/([A-Za-z0-9_-]{2,40})/gi
// توکنِ برند/کسب‌وکار به‌صورتِ فیلدِ JSON (پاسخِ آگهیِ آژانس‌ها این را دارد حتی اگر URLِ /pro/ نداشته باشد).
const BRAND_RE = /"(?:brand_token|business_ref_token|subscription_token|business_token)"\s*:\s*"([A-Za-z0-9_-]{2,40})"/gi
const DEFAULT_SEARCH = 'https://divar.ir/s/tehran/real-estate'

// آخرین وضعیتِ get برای تشخیص (چرا خالی است؟)
let lastGet = { status: 0, bytes: 0, error: '' as string | null }

async function get(url: string, opts?: { post?: string; headers?: Record<string, string> }): Promise<string> {
  try {
    const res = await proxiedRequest(url, {
      method: opts?.post ? 'POST' : 'GET',
      headers: { 'user-agent': UA, accept: '*/*', referer: 'https://divar.ir/', ...(opts?.headers || {}) },
      body: opts?.post, proxyUrl: proxy(), timeout: 15000,
    })
    lastGet = { status: res.status, bytes: (res.body || '').length, error: null }
    return res.status === 200 ? (res.body || '') : ''
  } catch (e: any) {
    lastGet = { status: 0, bytes: 0, error: e?.message || 'unreachable' }
    return ''
  }
}
const extractPros = (body: string, into: Set<string>) => {
  for (const m of body.matchAll(PRO_RE)) { const s = m[1].toLowerCase(); if (s !== 'pro' && s.length >= 2) into.add(s) }
  for (const m of body.matchAll(BRAND_RE)) { const s = m[1].toLowerCase(); if (s.length >= 2) into.add(s) }
}

// ── روش A: سایت‌مپ ──
async function discoverFromSitemap(maxSitemaps = 80): Promise<{ found: number; added: number; fetched: number }> {
  const seen = new Set<string>(); const pros = new Set<string>()
  const prio = (u: string) => (/(pro|business|brand|agency)/i.test(u) ? 0 : 1)
  const queue: string[] = []
  const robots = await get('https://divar.ir/robots.txt')
  if (lastGet.error || lastGet.status !== 200) {
    await setMeta({ note: `دسترسی به دیوار ناموفق (robots.txt: ${lastGet.error || 'HTTP ' + lastGet.status}) — پروکسیِ دیوار را در ادمین بررسی کن.` })
    return { found: 0, added: 0, fetched: 0 }
  }
  for (const m of robots.matchAll(/Sitemap:\s*(\S+)/gi)) queue.push(m[1])
  if (!queue.length) queue.push('https://divar.ir/sitemap.xml')
  let fetched = 0
  while (queue.length && fetched < maxSitemaps) {
    queue.sort((a, b) => prio(a) - prio(b))
    const url = queue.shift()!; if (seen.has(url)) continue; seen.add(url)
    const body = await get(url)
    if (!body) continue
    fetched++
    extractPros(body, pros)
    for (const m of body.matchAll(/<loc>\s*([^<\s]+\.xml[^<\s]*)\s*<\/loc>/gi)) { const c = m[1].replace(/&amp;/g, '&'); if (!seen.has(c)) queue.push(c) }
    if (fetched % 3 === 0) await addPros([...pros].map(slug => ({ slug, source: 'sitemap' })))
    await setMeta({ scanned: fetched, note: `سایت‌مپ: ${fetched} فایل خوانده شد، ${pros.size} pro` })
    await sleep(150)
  }
  const added = await addPros([...pros].map(slug => ({ slug, source: 'sitemap' })))
  if (pros.size === 0) await setMeta({ note: `سایت‌مپ: ${fetched} فایل خوانده شد ولی هیچ لینکِ /pro/ نداشت. سایت‌مپِ دیوار آژانس‌ها را فهرست نمی‌کند — از «کشف از این جستجو» استفاده کن.` })
  return { found: pros.size, added, fetched }
}

// استخراجِ توکنِ آگهی از URL یا شیءِ آگهی
function tokenOf(it: any): string | null {
  const u = String(it?.url || it?.token || '')
  const m = u.match(/\/v\/([A-Za-z0-9_-]+)/) || u.match(/^([A-Za-z0-9_-]{5,20})$/)
  return m ? m[1] : (typeof it?.token === 'string' ? it.token : null)
}

// ── روش B: خزشِ جستجو → جزئیاتِ آگهی → آژانس (pro) ──
async function discoverFromSearch(searchUrl: string, sampleDetails = 120): Promise<{ found: number; added: number; scanned: number }> {
  const { scrapeDivar } = await import('./divar')
  let items: any[] = []
  try { items = await scrapeDivar({ id: 'disc', name: 'کشفِ pro', url: searchUrl, type: 'listing', method: 'divar', enabled: true, schedule: 'manual', meta: {} } as any) } catch (e: any) {
    await setMeta({ note: `جستجو اجرا نشد: ${e?.message || 'خطا'} — لینکِ جستجو را بررسی کن.` })
    return { found: 0, added: 0, scanned: 0 }
  }
  const tokens = items.map(tokenOf).filter(Boolean).slice(0, sampleDetails) as string[]
  if (!tokens.length) {
    await setMeta({ note: `جستجو ${items.length} آگهی برگرداند ولی توکنی استخراج نشد. لینکِ جستجوی معتبرِ دیوار بده (مثلِ divar.ir/s/tehran/real-estate).` })
    return { found: 0, added: 0, scanned: 0 }
  }
  const pros = new Set<string>()
  let scanned = 0, proListingHits = 0
  for (const tk of tokens) {
    // دو منبع برای بیشترین پوشش:
    //  الف) JSONِ APIِ تک‌آگهی — آگهیِ آژانس‌ها اغلب business_ref_token دارد.
    //  ب) HTMLِ صفحهٔ آگهی — لینکِ «همه آگهی‌های این آژانس» (/pro/<slug>) آنجا رندر می‌شود.
    const before = pros.size
    const json = await get(`https://api.divar.ir/v8/posts-v2/web/${tk}`, { headers: { origin: 'https://divar.ir', 'x-standard-divar-error': 'true', accept: 'application/json, text/plain, */*' } })
    if (json) extractPros(json, pros)
    if (pros.size === before) {   // اگر از JSON چیزی نیامد، HTML را امتحان کن
      const html = await get(`https://divar.ir/v/${tk}`, { headers: { accept: 'text/html,application/xhtml+xml' } })
      if (html) extractPros(html, pros)
    }
    if (pros.size > before) proListingHits++
    scanned++
    if (scanned % 8 === 0) { await addPros([...pros].map(slug => ({ slug, source: 'search' }))); await setMeta({ scanned, note: `جستجو: ${scanned}/${tokens.length} آگهی خوانده شد، ${pros.size} آژانس (${proListingHits} آگهیِ آژانسی)` }) }
    await sleep(300)
  }
  const added = await addPros([...pros].map(slug => ({ slug, source: 'search' })))
  if (pros.size === 0) await setMeta({ note: `جستجو: ${scanned} آگهی خوانده شد ولی هیچ‌کدام به آژانسِ pro وصل نبودند (یا ساختارِ پاسخ عوض شده). «تشخیصِ اتصال» را بزن تا ببینم چه در پاسخِ آگهی هست.` })
  return { found: pros.size, added, scanned }
}

// اجرای پس‌زمینه (fire-and-forget) با قفلِ meta. برمی‌گرداند آیا شروع شد.
export async function startDiscovery(opts: { method: 'sitemap' | 'search'; searchUrl?: string }): Promise<{ started: boolean; reason?: string }> {
  const ok = await tryStartMeta()
  if (!ok) return { started: false, reason: 'یک کشف در حال اجراست' }
  ;(async () => {
    let note = ''
    try {
      const r = opts.method === 'sitemap'
        ? await discoverFromSitemap()
        : await discoverFromSearch((opts.searchUrl || '').trim() || DEFAULT_SEARCH)
      note = `پایان — ${r.found} pro یافت شد (${r.added} جدید)`
    } catch (e: any) { note = 'خطا: ' + (e?.message || 'ناموفق') }
    finally {
      // اگر توضیحِ دقیق‌تری در note ست شده، آن را نگه‌دار؛ وگرنه خلاصه.
      const m = await import('./divar-pro-store').then(x => x.getMeta())
      const keep = m.note && /سایت‌مپ|جستجو|دسترسی|تشخیص/.test(m.note) ? m.note : note
      await setMeta({ running: false, finishedAt: Date.now(), note: keep, lastFound: undefined } as Partial<DiscoveryMeta>)
    }
  })()
  return { started: true }
}

// ── تشخیصِ اتصال به دیوار (همگام) — دقیقاً می‌گوید کجا می‌شکند ──
export interface ProbeStep { name: string; url: string; ok: boolean; status: number; ms: number; note: string; sample?: string }
export async function probeDivar(searchUrl?: string): Promise<{ proxyUrl: string; steps: ProbeStep[]; verdict: string }> {
  const proxyUrl = proxy()
  const steps: ProbeStep[] = []
  const run = async (name: string, url: string, fn: () => Promise<{ note: string; sample?: string; ok?: boolean }>): Promise<void> => {
    const t0 = Date.now()
    try { const r = await fn(); steps.push({ name, url, ok: r.ok !== false, status: lastGet.status, ms: Date.now() - t0, note: r.note, sample: r.sample }) }
    catch (e: any) { steps.push({ name, url, ok: false, status: lastGet.status, ms: Date.now() - t0, note: 'خطا: ' + (e?.message || 'ناموفق') }) }
  }

  // ۱) دسترسی به وب‌سایتِ دیوار (robots.txt)
  await run('۱) اتصال به divar.ir', 'https://divar.ir/robots.txt', async () => {
    const b = await get('https://divar.ir/robots.txt')
    if (lastGet.error) return { ok: false, note: `اتصال برقرار نشد (${lastGet.error}). پروکسیِ دیوار در ادمین را چک کن.` }
    if (lastGet.status !== 200) return { ok: false, note: `HTTP ${lastGet.status}` }
    const sm = [...b.matchAll(/Sitemap:\s*(\S+)/gi)].map(m => m[1])
    return { note: `وصل شد ✓ — ${sm.length} سایت‌مپ اعلام شده`, sample: sm.slice(0, 5).join('\n') }
  })

  // ۲) APIِ جستجوی دیوار (مسیرِ اصلیِ کشف)
  let firstToken = ''
  await run('۲) APIِ جستجوی املاک', searchUrl || DEFAULT_SEARCH, async () => {
    const { scrapeDivar } = await import('./divar')
    const items = await scrapeDivar({ id: 'probe', name: 'probe', url: (searchUrl || DEFAULT_SEARCH), type: 'listing', method: 'divar', enabled: true, schedule: 'manual', meta: {} } as any)
    const toks = (items || []).map(tokenOf).filter(Boolean) as string[]
    firstToken = toks[0] || ''
    if (!items?.length) return { ok: false, note: 'جستجو ۰ آگهی برگرداند — لینکِ جستجو یا پروکسی مشکل دارد.' }
    return { note: `${items.length} آگهی، ${toks.length} توکن ✓`, sample: firstToken }
  })

  // ۳) جزئیاتِ یک آگهی — آیا ارجاعِ آژانس (pro) در آن هست؟
  await run('۳) آگهی → آژانس؟', firstToken ? `api.divar.ir/v8/posts-v2/web/${firstToken}` : '(بدون توکن)', async () => {
    if (!firstToken) return { ok: false, note: 'توکنی از مرحلهٔ ۲ نیامد.' }
    const json = await get(`https://api.divar.ir/v8/posts-v2/web/${firstToken}`, { headers: { origin: 'https://divar.ir', 'x-standard-divar-error': 'true', accept: 'application/json, text/plain, */*' } })
    const found = new Set<string>(); if (json) extractPros(json, found)
    let src = 'JSON'
    let body = json
    if (!found.size) {   // HTML را هم امتحان کن (لینکِ آژانس آنجا رندر می‌شود)
      const html = await get(`https://divar.ir/v/${firstToken}`, { headers: { accept: 'text/html,application/xhtml+xml' } })
      if (html) { extractPros(html, found); if (found.size) { src = 'HTML'; body = html } else body = json || html }
    }
    if (!body) return { ok: false, note: `پاسخِ آگهی خالی (HTTP ${lastGet.status})` }
    const keys = ['brand_token', 'business_ref_token', 'subscription_token', 'business_token', '/pro/', 'business_data', 'business_ref', 'contact'].filter(k => body.includes(k))
    const proSnippet = (body.match(/.{0,30}(?:brand_token|\/pro\/|business_ref)[^,}"]{0,60}/i) || [''])[0]
    return { ok: found.size > 0, note: found.size ? `✓ ${found.size} آژانس در همین آگهی (منبع: ${src}): ${[...found].join(', ')}` : `آژانسی پیدا نشد. کلیدهای موجودِ کسب‌وکار: ${keys.join(', ') || '—'}`, sample: proSnippet }
  })

  // ۴) صفحهٔ یک آژانسِ معلوم (brand-landing) — تأییدِ خواندنِ آگهی‌های آژانس
  const known = (await listPros())[0]?.slug || 'enfjqago'
  await run('۴) خواندنِ آگهی‌های یک آژانس', `pro/${known}`, async () => {
    const r = await fetchDivarProfileTokens(known)
    if (r.reason && !r.posts.length) return { ok: false, note: `ناموفق (${r.reason})` }
    return { note: `آژانسِ «${r.name || known}»: ${r.posts.length} آگهی خوانده شد ✓` }
  })

  const s1 = steps[0]?.ok, s2 = steps[1]?.ok, s3 = steps[2]?.ok
  const verdict = !s1 && !s2 ? '✗ اپ اصلاً به دیوار وصل نمی‌شود — پروکسیِ دیوار (۱۰۸۰) را در ادمین بررسی کن.'
    : s2 && !s3 ? '△ اتصال برقرار است و جستجو کار می‌کند، ولی در پاسخِ آگهی ارجاعِ pro پیدا نشد — «نمونه»های مرحلهٔ ۳ را برایم بفرست تا استخراج را دقیق کنم.'
    : s2 && s3 ? '✓ همه‌چیز کار می‌کند — «کشف از این جستجو» را بزن (نه سایت‌مپ).'
    : '△ نتیجهٔ مرحله‌به‌مرحله را بالا ببین.'
  return { proxyUrl, steps, verdict }
}
