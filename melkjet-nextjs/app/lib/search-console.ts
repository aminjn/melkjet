import { createSign } from 'crypto'
import { proxiedRequest } from './proxy-fetch'
import { getAdminData } from './admin-store'

// ── کلاینتِ Google Search Console (احرازِ سرویس‌اکانت RS256 → توکن → APIها) ──
// گوگل خارجی/فیلتر است → از همان پروکسیِ دیوار (یا پروکسیِ اختصاصی) عبور می‌کند.
// دیتای واقعی که API می‌دهد: Performance (کوئری/صفحه/کلیک/ایمپرشن)، وضعیتِ Sitemapها،
// و URL Inspection (وضعیتِ ایندکسِ هر URL). گزارشِ کاملِ Coverage در API گوگل نیست.

interface SCConfig { serviceAccountJson?: string; propertyUrl?: string; proxyUrl?: string }
export function scConfig(): SCConfig {
  const s = ((getAdminData() as Record<string, any>).seo?.searchConsole) || {}
  return { serviceAccountJson: s.serviceAccountJson, propertyUrl: s.propertyUrl, proxyUrl: s.proxyUrl }
}
export function scConfigured(): boolean {
  const c = scConfig()
  return !!(c.serviceAccountJson && c.propertyUrl)
}
function proxy(): string | undefined {
  const c = scConfig()
  return c.proxyUrl || (getAdminData() as Record<string, any>).divar?.proxyUrl || undefined
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// پارسِ بُردبار: اگر JSONِ استاندارد نبود (مثلاً هنگامِ کپی، private_key با نیم‌فاصله/خطِ
// واقعی شکسته شده و JSON را نامعتبر کرده)، client_email و private_key را با regex درمی‌آورد.
export function parseServiceAccount(raw: string): { client_email?: string; private_key?: string } | null {
  const s = String(raw || '').trim()
  if (!s) return null
  try { const j = JSON.parse(s); if (j && (j.client_email || j.private_key)) return j } catch {}
  const email = s.match(/"client_email"\s*:\s*"([^"]+)"/)?.[1]
  const key = s.match(/"private_key"\s*:\s*"([\s\S]*?-----END PRIVATE KEY-----[\\nrt\s]*)"/)?.[1]
  if (email && key) return { client_email: email, private_key: key }
  return null
}

let TOKEN: { token: string; exp: number } | null = null

async function getToken(): Promise<{ token?: string; error?: string }> {
  if (TOKEN && Date.now() < TOKEN.exp - 60_000) return { token: TOKEN.token }
  const { serviceAccountJson } = scConfig()
  if (!serviceAccountJson) return { error: 'کلیدِ سرویس‌اکانت تنظیم نشده' }
  const sa = parseServiceAccount(serviceAccountJson)
  if (!sa) return { error: 'JSONِ سرویس‌اکانت نامعتبر است — کلِ محتوای فایل را کپی کن' }
  if (!sa.client_email || !sa.private_key) return { error: 'client_email یا private_key در کلید نیست' }

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }))
  const signingInput = `${header}.${claim}`
  let signature: string
  try {
    const signer = createSign('RSA-SHA256'); signer.update(signingInput); signer.end()
    signature = b64url(signer.sign(sa.private_key.replace(/\\n/g, '\n')))
  } catch (e: any) { return { error: 'امضای JWT شکست خورد: ' + (e?.message || '') } }
  const assertion = `${signingInput}.${signature}`

  try {
    const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`
    const res = await proxiedRequest('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, proxyUrl: proxy(), timeout: 20000,
    })
    const j = JSON.parse(res.body || '{}')
    if (!j.access_token) return { error: `دریافتِ توکن ناموفق (${res.status}): ${j.error_description || j.error || res.body.slice(0, 120)}` }
    TOKEN = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
    return { token: j.access_token }
  } catch (e: any) { return { error: 'اتصال به گوگل ناموفق: ' + (e?.message || 'خطای شبکه (پروکسی؟)') } }
}

async function scApi(url: string, method: 'GET' | 'POST', payload?: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  const t = await getToken()
  if (!t.token) return { ok: false, error: t.error }
  try {
    const res = await proxiedRequest(url, {
      method, proxyUrl: proxy(), timeout: 25000,
      headers: { Authorization: `Bearer ${t.token}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
      body: payload ? JSON.stringify(payload) : undefined,
    })
    const data = res.body ? JSON.parse(res.body) : {}
    if (res.status >= 400) return { ok: false, error: data?.error?.message || `HTTP ${res.status}` }
    return { ok: true, data }
  } catch (e: any) { return { ok: false, error: e?.message || 'خطای شبکه' } }
}

const enc = (s: string) => encodeURIComponent(s)

// وضعیتِ Sitemapهای ثبت‌شده (submitted, lastDownloaded, errors, warnings, contents).
export async function scSitemaps(): Promise<{ ok: boolean; sitemaps?: any[]; error?: string }> {
  const { propertyUrl } = scConfig(); if (!propertyUrl) return { ok: false, error: 'property تنظیم نشده' }
  const r = await scApi(`https://searchconsole.googleapis.com/webmasters/v3/sites/${enc(propertyUrl)}/sitemaps`, 'GET')
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true, sitemaps: r.data?.sitemap || [] }
}

// عملکردِ جستجو (کلیک/ایمپرشن/CTR/جایگاه) + بالاترین کوئری‌ها و صفحه‌ها.
export async function scPerformance(days = 28): Promise<{ ok: boolean; error?: string; totals?: any; queries?: any[]; pages?: any[] }> {
  const { propertyUrl } = scConfig(); if (!propertyUrl) return { ok: false, error: 'property تنظیم نشده' }
  const end = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10)   // گوگل ~۲ روز تأخیر دارد
  const start = new Date(Date.now() - (days + 2) * 86400_000).toISOString().slice(0, 10)
  const base = `https://searchconsole.googleapis.com/webmasters/v3/sites/${enc(propertyUrl)}/searchAnalytics/query`
  const totalsR = await scApi(base, 'POST', { startDate: start, endDate: end, dimensions: [] })
  if (!totalsR.ok) return { ok: false, error: totalsR.error }
  const totals = totalsR.data?.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const qR = await scApi(base, 'POST', { startDate: start, endDate: end, dimensions: ['query'], rowLimit: 25 })
  const pR = await scApi(base, 'POST', { startDate: start, endDate: end, dimensions: ['page'], rowLimit: 25 })
  return { ok: true, totals, queries: qR.data?.rows || [], pages: pR.data?.rows || [] }
}

// بازرسیِ ایندکسِ یک URL (وضعیتِ Coverage، آخرین کراول، کنونیکال).
export async function scInspect(url: string): Promise<{ ok: boolean; error?: string; result?: any }> {
  const { propertyUrl } = scConfig(); if (!propertyUrl) return { ok: false, error: 'property تنظیم نشده' }
  const r = await scApi('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', 'POST', {
    inspectionUrl: url, siteUrl: propertyUrl, languageCode: 'fa',
  })
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true, result: r.data?.inspectionResult || {} }
}

export async function scTest(): Promise<{ ok: boolean; error?: string; email?: string; property?: string }> {
  const c = scConfig()
  const t = await getToken()
  if (!t.token) return { ok: false, error: t.error }
  const sm = await scSitemaps()
  let email = ''
  try { email = JSON.parse(c.serviceAccountJson || '{}').client_email || '' } catch {}
  if (!sm.ok) return { ok: false, error: sm.error, email, property: c.propertyUrl }
  return { ok: true, email, property: c.propertyUrl }
}
