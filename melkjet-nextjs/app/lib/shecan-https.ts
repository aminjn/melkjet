import https from 'node:https'
import dns from 'node:dns'
import { Resolver } from 'node:dns'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { writeFileSync } from './fs-atomic'

// چرا این فایل: سرور آروان اینترنت بین‌الملل ندارد و /etc/resolv.conf (DNS شکن)
// مدام ریست می‌شد، پس api.gapgpt.app / api.neshan.org گاهی resolve نمی‌شدند و
// «fetch failed / timeout» می‌گرفتیم. اینجا IP را مستقیماً با شکن resolve می‌کنیم
// و بعد به همان IP با SNI صحیح وصل می‌شویم — مستقل از resolv.conf سرور.

const SHECAN = ['178.22.122.100', '185.51.200.2']
// فاز ۱۷۰ — تشخیصِ قیفِ ورود: resolverِ پیش‌فرضِ Node تا ~۲۰ ثانیه روی شکنِ کند/مسدود گیر می‌کرد و
// «اولین» درخواستِ هر اینستنس (کشِ سرد) کلِ مهلتِ پیامک را می‌سوزاند → «بار اول ارور». حالا شکن سریع
// شکست می‌خورد (۲ ثانیه × ۲ تلاش) و fallback فوری است. ترتیبِ شکن‌اول عمداً حفظ شده: برای دامنه‌های
// فیلترشده (gapgpt) جوابِ resolverِ سیستم ممکن است IPِ فیلتر باشد — نباید مسابقه‌ای شود.
const resolver = new Resolver({ timeout: 2000, tries: 2 })
try { resolver.setServers(SHECAN) } catch { /* ignore */ }

const cache = new Map<string, { ip: string; exp: number }>()
const TTL = 30 * 60 * 1000   // فاز ۱۷۰: ۵→۳۰ دقیقه — IPهای این سرویس‌ها پایدارند؛ کشِ سرد یعنی تأخیرِ کاربر
// ۱۹ سپتامبر — لاگِ پرود نشان داد resolve گاهی ۱۲ ثانیه طول می‌کشد (شکن ۴ث می‌سوزاند،
// بعد dns.lookup هشت ثانیهٔ دیگر) و ۸ از ۲۹ ارسالِ OTP بینِ ۹ تا ۱۳ ثانیه طول کشیده بود.
//
// دو تغییر تا کاربر هرگز پشتِ resolve نماند:
// (۱) کش روی دیسک می‌ماند. هر reloadِ pm2 چهار پراسسِ تازه با کشِ خالی می‌ساخت و
//     اولین کاربرِ هر کدام هزینه‌اش را می‌داد — دقیقاً بعد از هر دیپلوی.
// (۲) منقضی‌شده فوراً برگردانده می‌شود و تازه‌سازی در پس‌زمینه انجام می‌شود. اگر IPِ کهنه
//     مرده باشد، درخواست خطا می‌دهد و مسیرِ retry با bustDns همان را دور می‌ریزد — همان طراحیِ فاز ۱۷۰.
const STALE_MAX = 7 * 24 * 60 * 60 * 1000
const CACHE_FILE = join(/*turbopackIgnore: true*/ process.cwd(), '.dns-cache.json')
const refreshing = new Set<string>()

function loadCache(): void {
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as Record<string, { ip: string; exp: number }>
    for (const [h, v] of Object.entries(raw || {})) {
      if (v && typeof v.ip === 'string' && v.ip) cache.set(h, { ip: v.ip, exp: Number(v.exp) || 0 })
    }
  } catch { /* نبود/خراب بود — از صفر پر می‌شود */ }
}
loadCache()

function saveCache(): void {
  try { writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache)), 'utf-8') } catch { /* کش است؛ نشد نشد */ }
}

// فاز ۱۷۰ — ابطالِ کشِ یک هاست (بینِ تلاش‌های retry: شاید IPِ کش‌شده مرده باشد)
export function bustDns(hostname: string): void { if (cache.delete(hostname)) saveCache() }
// گرم‌کردنِ DNS در بوتِ اینستنس (instrumentation) — اولین کاربرِ واقعی دیگر هزینهٔ resolve را نمی‌دهد
export function warmDns(hostname: string): void { resolveIp(hostname).catch(() => { /* بی‌صدا؛ در اولین استفاده دوباره تلاش می‌شود */ }) }

// خودِ پرسِ شبکه — شکن اول، بعد resolverِ سیستم. ترتیب عمداً مسابقه‌ای نیست: برای
// دامنهٔ فیلترشده، جوابِ resolverِ سیستم ممکن است IPِ فیلتر باشد.
function lookupFresh(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    resolver.resolve4(hostname, (err, addrs) => {
      if (!err && addrs && addrs.length && addrs[0]) return resolve(addrs[0])
      dns.lookup(hostname, { family: 4 }, (e, address) => {
        if (!e && address) resolve(address)
        else reject(e || err || new Error('dns resolve failed: ' + hostname))
      })
    })
  })
}

function remember(hostname: string, ip: string): void {
  const prev = cache.get(hostname)
  cache.set(hostname, { ip, exp: Date.now() + TTL })
  if (!prev || prev.ip !== ip) saveCache()
}

// تازه‌سازیِ پس‌زمینه — یک بار برای هر هاست، بدونِ معطل‌کردنِ کسی.
function refreshInBackground(hostname: string): void {
  if (refreshing.has(hostname)) return
  refreshing.add(hostname)
  lookupFresh(hostname)
    .then(ip => remember(hostname, ip))
    .catch(() => { /* کهنه را نگه می‌داریم؛ بهتر از هیچ است */ })
    .finally(() => refreshing.delete(hostname))
}

// resolve یک هاست به IPv4 — تازه فوری، کهنه فوری + تازه‌سازی، نبود → منتظر.
async function resolveIp(hostname: string): Promise<string> {
  const c = cache.get(hostname)
  if (c) {
    if (c.exp > Date.now()) return c.ip
    if (Date.now() - c.exp < STALE_MAX) { refreshInBackground(hostname); return c.ip }
  }
  const ip = await lookupFresh(hostname)
  remember(hostname, ip)
  return ip
}

// ۱۹ سپتامبر — مهلتی که کلِ تلاش را بپوشاند، نه فقط بخشی از آن.
//
// تا امروز resolveIp بیرونِ مهلت بود: مهلتِ ۷ ثانیه‌ایِ پیامک فقط از لحظهٔ https.request
// شروع می‌شد. مسیرِ DNS می‌تواند خیلی طول بکشد — شکن ۲ث × ۲ تلاش، و بعد fallback به
// dns.lookup که هیچ مهلتی ندارد و روی resolv.confِ خراب ده‌ها ثانیه می‌ماند. دو تلاشِ
// «۷ ثانیه‌ای» عملاً ۱۵٫۵ ثانیه طول می‌کشید و کاربر همان‌قدر منتظرِ کدِ ورود می‌ماند.
function withDeadline<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Error(what)), ms); t.unref?.() }),
  ])
}

// IP را درونِ بودجهٔ خودِ درخواست حل می‌کند و باقیماندهٔ مهلت را برمی‌گرداند.
// سهمِ DNS سقف دارد تا همیشه وقتی برای خودِ درخواست بماند.
const DNS_SHARE = 0.45
const SLOW_DNS_MS = 1000
async function resolveWithin(hostname: string, budgetMs: number): Promise<{ ip: string; left: number }> {
  const t0 = Date.now()
  const dnsBudget = Math.max(800, Math.round(budgetMs * DNS_SHARE))
  const ip = await withDeadline(resolveIp(hostname), dnsBudget, 'dns timeout: ' + hostname)
  const took = Date.now() - t0
  // بدونِ این خط، سهمِ DNS از تأخیر در لاگ ناپیدا بود و باید حدس می‌زدیم.
  if (took > SLOW_DNS_MS) console.log('[dns] slow resolve ' + hostname + ': ' + took + 'ms')
  return { ip, left: Math.max(500, budgetMs - took) }
}

// اتصالِ keep-alive مشترک — درخواستِ دوم به همان سرویس دیگر هزینهٔ TLS نمی‌دهد (تأخیرِ OTP)
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 20, timeout: 60000 })

// مهلتِ سخت. تایمرِ بی‌کاریِ سوکت (چه گزینهٔ timeout چه req.setTimeout) کافی نبود:
// با هر فعالیتی صفر می‌شود، پس روی هندشیکِ آویزان (ClientHello می‌رود، جواب نمی‌آید)
// دو برابرِ بودجه طول می‌کشید — تستِ سرورِ ساکت دقیقاً ۲× را نشان داد.
function armDeadline(req: { destroy: (e?: Error) => void }, ms: number, fire: () => void) {
  const t = setTimeout(() => { fire(); try { req.destroy() } catch { /* قبلاً بسته شده */ } }, ms)
  t.unref?.()
  return t
}

export interface ShecanResp { status: number; body: string }

// درخواست HTTPS با IP حل‌شده توسط شکن (مستقل از resolv.conf، بدون پروکسی)
export async function shecanRequest(url: string, init: { method: string; headers: Record<string, string>; body?: string; timeout?: number }): Promise<ShecanResp> {
  const u = new URL(url)
  const timeout = init.timeout ?? 90000
  const { ip, left } = await resolveWithin(u.hostname, timeout)
  return new Promise((resolve, reject) => {
    let done = false
    let killer: ReturnType<typeof setTimeout>
    const finish = (fn: () => void) => { if (done) return; done = true; clearTimeout(killer); fn() }
    const req = https.request({
      host: ip, port: 443, path: u.pathname + u.search, method: init.method,
      headers: { ...init.headers, Host: u.hostname },
      servername: u.hostname,   // SNI صحیح برای اعتبارسنجی گواهی
      agent: keepAliveAgent,    // فاز ۱۷۰: اتصالِ گرم — درخواستِ بعدی TLS handshake نمی‌خواهد
    }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { data += c })
      res.on('end', () => finish(() => resolve({ status: res.statusCode || 0, body: data })))
    })
    killer = armDeadline(req, left, () => { if (!done) { done = true; reject(new Error('request timeout')) } })
    req.on('error', (e) => finish(() => reject(e)))
    if (init.body) req.write(init.body)
    req.end()
  })
}

export interface ShecanBuf { status: number; buffer: Buffer; contentType: string }

// مثل بالا ولی پاسخ باینری (مثلاً تصویر نقشهٔ استاتیک نشان)
export async function shecanRequestBuffer(url: string, init: { method?: string; headers?: Record<string, string>; timeout?: number } = {}): Promise<ShecanBuf> {
  const u = new URL(url)
  const timeout = init.timeout ?? 15000
  const { ip, left } = await resolveWithin(u.hostname, timeout)
  return new Promise((resolve, reject) => {
    let done = false
    let killer: ReturnType<typeof setTimeout>
    const finish = (fn: () => void) => { if (done) return; done = true; clearTimeout(killer); fn() }
    const req = https.request({
      host: ip, port: 443, path: u.pathname + u.search, method: init.method || 'GET',
      headers: { ...(init.headers || {}), Host: u.hostname },
      servername: u.hostname,
      agent: keepAliveAgent,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c as Buffer))
      res.on('end', () => finish(() => resolve({ status: res.statusCode || 0, buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/png' })))
    })
    killer = armDeadline(req, left, () => { if (!done) { done = true; reject(new Error('request timeout')) } })
    req.on('error', (e) => finish(() => reject(e)))
    req.end()
  })
}
