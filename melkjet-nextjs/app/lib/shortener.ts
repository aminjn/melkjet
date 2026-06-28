import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'

function cfg() {
  const c = getAdminData().shortener
  if (!c?.apiKey) return null
  return { key: c.apiKey, base: (c.baseUrl || 'https://nxal.ir').replace(/\/$/, ''), domain: c.domain }
}

// کوتاه‌کردنِ لینک با nxal — id را هم برمی‌گرداند تا بعداً آمارش گرفته شود.
export async function shortenUrl(longUrl: string): Promise<{ shortUrl: string; id: string } | null> {
  const c = cfg(); if (!c) return null
  try {
    const res = await shecanRequest(`${c.base}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': c.key, accept: 'application/json' },
      body: JSON.stringify({ url: longUrl, domain: c.domain || undefined, utmSource: 'sms' }),
      timeout: 15000,
    })
    if (res.status < 200 || res.status >= 300) return null
    const d = JSON.parse(res.body)
    if (d?.success && d?.data?.shortUrl) return { shortUrl: String(d.data.shortUrl), id: String(d.data.id || '') }
    return null
  } catch { return null }
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
    const link = createLink({ dest: url, title: opts.title, phone: opts.phone, channel: opts.channel })
    const sh = await shortenUrl(url)
    if (sh) { setLinkMeta(link.code, { shortUrl: sh.shortUrl, linkId: sh.id }); return sh.shortUrl }
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
      const link = createLink({ dest: u, title: opts.title, phone: opts.phone, channel: opts.channel })
      const sh = await shortenUrl(u)
      if (sh) { setLinkMeta(link.code, { shortUrl: sh.shortUrl, linkId: sh.id }); out = out.split(u).join(sh.shortUrl) }
    } catch { /* همان لینکِ بلند می‌ماند */ }
  }
  return out
}
