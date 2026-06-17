import https from 'node:https'
import dns from 'node:dns'
import { Resolver } from 'node:dns'
import type { LookupFunction } from 'node:net'

// چرا این فایل: سرور مدام «fetch failed» می‌داد چون /etc/resolv.conf (DNS شکن)
// ریست می‌شد و api.gapgpt.app دیگر resolve نمی‌شد. اینجا DNS را مستقیماً از داخل
// برنامه روی شکن می‌بریم تا مستقل از resolv.conf سرور همیشه کار کند.

const SHECAN = ['178.22.122.100', '185.51.200.2']
const resolver = new Resolver()
try { resolver.setServers(SHECAN) } catch { /* ignore */ }

const cache = new Map<string, { ip: string; exp: number }>()
const TTL = 5 * 60 * 1000

// lookup سفارشی: اول از شکن resolve می‌کند، اگر نشد به resolver سیستم برمی‌گردد
const shecanLookup: LookupFunction = (hostname, options, callback) => {
  const cb = callback as (err: NodeJS.ErrnoException | null, address: string, family: number) => void
  const c = cache.get(hostname)
  if (c && c.exp > Date.now()) return cb(null, c.ip, 4)
  resolver.resolve4(hostname, (err, addrs) => {
    if (!err && addrs && addrs.length) {
      cache.set(hostname, { ip: addrs[0], exp: Date.now() + TTL })
      return cb(null, addrs[0], 4)
    }
    // fallback: resolver سیستم‌عامل
    dns.lookup(hostname, options as any, cb as any)
  })
}

export interface ShecanResp { status: number; body: string }

// درخواست HTTPS مستقیم با DNS شکن (بدون وابستگی به resolv.conf و بدون پروکسی)
export function shecanRequest(url: string, init: { method: string; headers: Record<string, string>; body?: string; timeout?: number }): Promise<ShecanResp> {
  const u = new URL(url)
  const timeout = init.timeout ?? 90000
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: u.hostname, port: 443, path: u.pathname + u.search, method: init.method,
      headers: { ...init.headers, Host: u.hostname },
      servername: u.hostname,   // SNI صحیح برای اعتبارسنجی گواهی
      lookup: shecanLookup,
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
export function shecanRequestBuffer(url: string, init: { method?: string; headers?: Record<string, string>; timeout?: number } = {}): Promise<ShecanBuf> {
  const u = new URL(url)
  const timeout = init.timeout ?? 15000
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: u.hostname, port: 443, path: u.pathname + u.search, method: init.method || 'GET',
      headers: { ...(init.headers || {}), Host: u.hostname },
      servername: u.hostname,
      lookup: shecanLookup,
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
