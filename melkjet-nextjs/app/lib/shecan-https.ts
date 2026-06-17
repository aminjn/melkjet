import https from 'node:https'
import dns from 'node:dns'
import { Resolver } from 'node:dns'

// چرا این فایل: سرور آروان اینترنت بین‌الملل ندارد و /etc/resolv.conf (DNS شکن)
// مدام ریست می‌شد، پس api.gapgpt.app / api.neshan.org گاهی resolve نمی‌شدند و
// «fetch failed / timeout» می‌گرفتیم. اینجا IP را مستقیماً با شکن resolve می‌کنیم
// و بعد به همان IP با SNI صحیح وصل می‌شویم — مستقل از resolv.conf سرور.

const SHECAN = ['178.22.122.100', '185.51.200.2']
const resolver = new Resolver()
try { resolver.setServers(SHECAN) } catch { /* ignore */ }

const cache = new Map<string, { ip: string; exp: number }>()
const TTL = 5 * 60 * 1000

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
