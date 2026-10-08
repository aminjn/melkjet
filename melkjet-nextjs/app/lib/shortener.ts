import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'

function cfg() {
  const c = getAdminData().shortener
  if (!c?.apiKey) return null
  return { key: c.apiKey, base: (c.baseUrl || 'https://nxal.ir').replace(/\/$/, ''), domain: c.domain }
}

// فاز ۲۹۷ص — کوتاه‌کردن با «علتِ دقیقِ» شکست؛ شکستِ بی‌صدا ممنوع (قانون شمارهٔ یک):
// nxal که خطا بدهد باید معلوم شود چرا (کلید نامعتبر؟ URL رد شد؟ شبکه؟) نه این‌که
// لینکِ بلندِ درصد-encoded بی‌خبر راهیِ پیامک شود.
export async function shortenUrlDetailed(longUrl: string): Promise<{ ok: true; shortUrl: string; id: string } | { ok: false; error: string }> {
  const c = cfg(); if (!c) return { ok: false, error: 'کوتاه‌کننده پیکربندی نشده (کلیدِ nxal خالی است)' }
  try {
    const res = await shecanRequest(`${c.base}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': c.key, accept: 'application/json' },
      body: JSON.stringify({ url: longUrl, domain: c.domain || undefined, utmSource: 'sms' }),
      timeout: 15000,
    })
    if (res.status < 200 || res.status >= 300) return { ok: false, error: `HTTP ${res.status} از nxal: ${String(res.body || '').slice(0, 120)}` }
    const d = JSON.parse(res.body)
    if (d?.success && d?.data?.shortUrl) return { ok: true, shortUrl: String(d.data.shortUrl), id: String(d.data.id || '') }
    return { ok: false, error: `پاسخِ نامعتبرِ nxal: ${String(res.body || '').slice(0, 120)}` }
  } catch (e: any) { return { ok: false, error: `خطای شبکه تا nxal: ${e?.message || 'نامشخص'}` } }
}

// کوتاه‌کردنِ لینک با nxal — id را هم برمی‌گرداند تا بعداً آمارش گرفته شود.
export async function shortenUrl(longUrl: string): Promise<{ shortUrl: string; id: string } | null> {
  const r = await shortenUrlDetailed(longUrl)
  if (r.ok) return { shortUrl: r.shortUrl, id: r.id }
  // کانال‌هایی که با لینکِ بلند هم می‌توانند ادامه بدهند، دستِ‌کم باید در لاگ فریاد بزنند.
  if (getAdminData().shortener?.apiKey) console.error(`[shortener] کوتاه‌کردن شکست خورد: ${r.error} — ${longUrl.slice(0, 100)}`)
  return null
}

// فاز ۲۹۷ص — لینکِ کوتاهِ «الزامی» برای کانال‌هایی که لینکِ بلند برایشان قابل‌قبول نیست
// (پیامکِ سایت‌ساز: لینکِ درصد-encodedِ فارسی چند صفحه پیامک هزینه دارد و اعتماد را می‌کُشد).
// شکست = خطا برمی‌گردد تا ارسال متوقف و علت در پنل دیده شود؛ نه ارسالِ لینکِ غول‌پیکر.
export async function mustShortenUrl(url: string, opts: { channel: string; phone?: string; title?: string }): Promise<{ ok: true; shortUrl: string } | { ok: false; error: string }> {
  const r = await shortenUrlDetailed(url)
  if (!r.ok) return { ok: false, error: r.error }
  try {
    const { createLink, setLinkMeta } = await import('./tracker-links-store')
    const link = await createLink({ dest: url, title: opts.title, phone: opts.phone, channel: opts.channel })
    await setLinkMeta(link.code, { shortUrl: r.shortUrl, linkId: r.id })
  } catch { /* شکستِ ثبتِ گزارش نباید ارسال را بشکند — لینکِ کوتاه معتبر است */ }
  return { ok: true, shortUrl: r.shortUrl }
}

// آمارِ کلیکِ یک لینک از nxal.
export async function getNxalStats(id: string): Promise<{ clicks: number; uniqueClicks: number; lastClickedAt?: string } | null> {
  const c = cfg(); if (!c || !id) return null
  try {
    const res = await shecanRequest(`${c.base}/api/v1/links/${encodeURIComponent(id)}`, {
      method: 'GET', headers: { 'X-Api-Key': c.key, accept: 'application/json' }, timeout: 15000,
    })
    if (res.status < 200 || res.status >= 300) return null
    const d = JSON.parse(res.body)
    if (!d?.success || !d?.data) return null
    return { clicks: Number(d.data.clicks) || 0, uniqueClicks: Number(d.data.uniqueClicks) || 0, lastClickedAt: d.data.lastClickedAt }
  } catch { return null }
}

// آدرسِ پایهٔ سایتِ ما (برای لینکِ ریدایرکتِ اختیاری).
export function siteBase(): string {
  return (getAdminData().shortener?.siteBase || 'https://melkjet.com').replace(/\/$/, '')
}

// نامِ متغیرِ «لینک» در پترن‌ها (اگر ادمین تنظیم کرده باشد). اگر تنظیم باشد، یعنی همهٔ
// پترن‌های لینک‌دار باید این placeholder را داشته باشند و لینکِ کوتاه در آن می‌رود.
export function linkVarName(): string | null {
  const v = (getAdminData().ippanel?.linkVar || '').trim()
  return v || null
}

// یک URL را در گزارش ثبت + با nxal کوتاه می‌کند و خودِ لینکِ کوتاه (رشته) را برمی‌گرداند.
// برای پر کردنِ متغیرِ %link% در پترن‌های خطِ خدماتی. اگر کوتاه‌کننده نباشد، همان لینکِ بلند.
export async function trackAndShorten(url: string, opts: { channel: string; phone?: string; title?: string }): Promise<string> {
  if (!getAdminData().shortener?.apiKey || !url) return url
  const { createLink, setLinkMeta } = await import('./tracker-links-store')
  try {
    const link = await createLink({ dest: url, title: opts.title, phone: opts.phone, channel: opts.channel })
    const sh = await shortenUrl(url)
    if (sh) { await setLinkMeta(link.code, { shortUrl: sh.shortUrl, linkId: sh.id }); return sh.shortUrl }
  } catch { /* همان لینکِ بلند */ }
  return url
}

// اولین لینکِ http(s) داخلِ یک متن (یا undefined).
export function firstUrl(text?: string): string | undefined {
  return (String(text || '').match(/https?:\/\/[^\s"'<>]+/) || [])[0]
}

// هر لینکِ http(s) داخلِ متن را با nxal کوتاه می‌کند، در گزارش ثبت و در متن جایگزین می‌کند.
// اگر کوتاه‌کننده تنظیم نشده باشد، متن بدونِ تغییر برمی‌گردد. برای همهٔ کانال‌های پیامکی.
export async function shortenLinksInText(text: string, opts: { channel: string; phone?: string; title?: string }): Promise<string> {
  if (!getAdminData().shortener?.apiKey || !text) return text
  // import پویا برای پرهیز از وابستگیِ حلقوی بینِ shortener و tracker-links-store
  const { createLink, setLinkMeta } = await import('./tracker-links-store')
  const urls = Array.from(new Set(text.match(/https?:\/\/[^\s"'<>]+/g) || []))
  let out = text
  for (const u of urls.slice(0, 5)) {
    try {
      const link = await createLink({ dest: u, title: opts.title, phone: opts.phone, channel: opts.channel })
      const sh = await shortenUrl(u)
      if (sh) { await setLinkMeta(link.code, { shortUrl: sh.shortUrl, linkId: sh.id }); out = out.split(u).join(sh.shortUrl) }
    } catch { /* همان لینکِ بلند می‌ماند */ }
  }
  return out
}
