import https from 'node:https'
import dns from 'node:dns'
import { Resolver } from 'node:dns'

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

// فاز ۱۷۰ — ابطالِ کشِ یک هاست (بینِ تلاش‌های retry: شاید IPِ کش‌شده مرده باشد)
export function bustDns(hostname: string): void { cache.delete(hostname) }
// گرم‌کردنِ DNS در بوتِ اینستنس (instrumentation) — اولین کاربرِ واقعی دیگر هزینهٔ resolve را نمی‌دهد
export function warmDns(hostname: string): void { resolveIp(hostname).catch(() => { /* بی‌صدا؛ در اولین استفاده دوباره تلاش می‌شود */ }) }

// resolve یک هاست به IPv4 از طریق شکن (با fallback به resolver سیستم)
function resolveIp(hostname: string): Promise<string> {
  const c = cache.get(hostname)
  if (c && c.exp > Date.now()) return Promise.resolve(c.ip)
  return new Promise((resolve, reject) => {
    resolver.resolve4(hostname, (err, addrs) => {
      if (!err && addrs && addrs.length && addrs[0]) {
        cache.set(hostname, { ip: addrs[0], exp: Date.now() + TTL })
        return resolve(addrs[0])
      }
      // fallback: resolver سیستم‌عامل
      dns.lookup(hostname, { family: 4 }, (e, address) => {
        if (!e && address) { cache.set(hostname, { ip: address, exp: Date.now() + TTL }); resolve(address) }
        else reject(e || err || new Error('dns resolve failed: ' + hostname))
      })
    })
  })
}

// اتصالِ keep-alive مشترک — درخواستِ دوم به همان سرویس دیگر هزینهٔ TLS نمی‌دهد (تأخیرِ OTP)
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 20, timeout: 60000 })

export interface ShecanResp { status: number; body: string }

// درخواست HTTPS با IP حل‌شده توسط شکن (مستقل از resolv.conf، بدون پروکسی)
export async function shecanRequest(url: string, init: { method: string; headers: Record<string, string>; body?: string; timeout?: number }): Promise<ShecanResp> {
  const u = new URL(url)
  const timeout = init.timeout ?? 90000
  const ip = await resolveIp(u.hostname)
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: ip, port: 443, path: u.pathname + u.search, method: init.method,
      headers: { ...init.headers, Host: u.hostname },
      servername: u.hostname,   // SNI صحیح برای اعتبارسنجی گواهی
      agent: keepAliveAgent,    // فاز ۱۷۰: اتصالِ گرم — درخواستِ بعدی TLS handshake نمی‌خواهد
      timeout,
    }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { data += c })
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
    })
    req.on('error', reject)
    req.setTimeout(timeout, () => req.destroy(new Error('request timeout')))
    if (init.body) req.write(init.body)
    req.end()
  })
}

export interface ShecanBuf { status: number; buffer: Buffer; contentType: string }

// مثل بالا ولی پاسخ باینری (مثلاً تصویر نقشهٔ استاتیک نشان)
export async function shecanRequestBuffer(url: string, init: { method?: string; headers?: Record<string, string>; timeout?: number } = {}): Promise<ShecanBuf> {
  const u = new URL(url)
  const timeout = init.timeout ?? 15000
  const ip = await resolveIp(u.hostname)
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: ip, port: 443, path: u.pathname + u.search, method: init.method || 'GET',
      headers: { ...(init.headers || {}), Host: u.hostname },
      servername: u.hostname,
      agent: keepAliveAgent,
      timeout,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c as Buffer))
      res.on('end', () => resolve({ status: res.statusCode || 0, buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/png' }))
    })
    req.on('error', reject)
    req.setTimeout(timeout, () => req.destroy(new Error('request timeout')))
    req.end()
  })
}
