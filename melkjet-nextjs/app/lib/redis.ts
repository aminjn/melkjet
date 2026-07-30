// فاز ۲۴۰ — Redis برای زیرساختِ میلیونی (دستورِ کاربر: «هرچه بعداً لازم است، امروز باید باشد»).
// دو-حالته مثلِ PG: بدونِ REDIS_URL هیچ رفتاری عوض نمی‌شود؛ با آن، کشِ «مشترکِ بین‌اینستنسی»
// فعال می‌شود (کاشیِ نقشه، دسترسی‌های اطراف، revِ کشِ آگهی‌ها). کلاینتِ RESP2ِ بدونِ وابستگی
// (الگوی smtp.ts/proxy-fetch.ts) — فقط دستورهای لازم؛ خطا/تایم‌اوت هرگز به مسیرِ درخواست پرتاب
// نمی‌شود (معنیِ کش: نبود = miss). تایم‌اوتِ پاسخ سوکت را می‌بندد تا صفِ پاسخ‌ها desync نشود.

import { createConnection, type Socket } from 'net'

export function redisEnabled(): boolean { return !!process.env.REDIS_URL }

function target(): { host: string; port: number; pass?: string } | null {
  const raw = process.env.REDIS_URL || ''
  if (!raw) return null
  try {
    const u = new URL(raw)
    return { host: u.hostname || '127.0.0.1', port: parseInt(u.port || '6379', 10) || 6379, pass: u.password || undefined }
  } catch { return null }
}

let sock: Socket | null = null
let rbuf: Buffer = Buffer.alloc(0) as Buffer
let waiters: { resolve: (v: unknown) => void; timer: NodeJS.Timeout }[] = []
let connectP: Promise<void> | null = null

function teardown() {
  const ws = waiters; waiters = []
  for (const w of ws) { clearTimeout(w.timer); w.resolve(null) }
  try { sock?.destroy() } catch {}
  sock = null; rbuf = Buffer.alloc(0); connectP = null
}

// یک پاسخِ RESP2 را از ابتدای b می‌خواند؛ ناقص → null.
function parseOne(b: Buffer): { val: unknown; size: number } | null {
  if (!b.length) return null
  const nl = b.indexOf('\r\n')
  if (nl < 0) return null
  const head = b.subarray(1, nl).toString()
  const t = b[0]
  if (t === 43 /* + */) return { val: head, size: nl + 2 }
  if (t === 45 /* - */) return { val: null, size: nl + 2 }          // خطای سرور = miss
  if (t === 58 /* : */) return { val: parseInt(head, 10), size: nl + 2 }
  if (t === 36 /* $ */) {
    const len = parseInt(head, 10)
    if (len === -1) return { val: null, size: nl + 2 }
    if (b.length < nl + 2 + len + 2) return null
    return { val: Buffer.from(b.subarray(nl + 2, nl + 2 + len)), size: nl + 2 + len + 2 }
  }
  if (t === 42 /* * */) {
    const n = parseInt(head, 10)
    if (n === -1) return { val: null, size: nl + 2 }
    const items: unknown[] = []
    let off = nl + 2
    for (let i = 0; i < n; i++) {
      const p = parseOne(b.subarray(off))
      if (!p) return null
      items.push(p.val); off += p.size
    }
    return { val: items, size: off }
  }
  return { val: null, size: nl + 2 }
}

function onData(chunk: Buffer) {
  rbuf = rbuf.length ? Buffer.concat([rbuf, chunk]) : chunk
  for (;;) {
    const p = parseOne(rbuf)
    if (!p) return
    rbuf = rbuf.subarray(p.size)
    const w = waiters.shift()
    if (w) { clearTimeout(w.timer); w.resolve(p.val) }
  }
}

function encode(args: (string | Buffer)[]): Buffer {
  const parts: Buffer[] = [Buffer.from(`*${args.length}\r\n`)]
  for (const a of args) {
    const d = Buffer.isBuffer(a) ? a : Buffer.from(String(a))
    parts.push(Buffer.from(`$${d.length}\r\n`), d, Buffer.from('\r\n'))
  }
  return Buffer.concat(parts)
}

function ensureConn(): Promise<void> {
  if (sock && !sock.destroyed) return Promise.resolve()
  if (connectP) return connectP
  const t = target()
  if (!t) return Promise.reject(new Error('no-redis-url'))
  connectP = new Promise((resolve, reject) => {
    const s = createConnection({ host: t.host, port: t.port })
    const ct = setTimeout(() => { try { s.destroy() } catch {} ; connectP = null; reject(new Error('connect-timeout')) }, 1500)
    s.once('connect', () => {
      clearTimeout(ct)
      sock = s
      s.on('data', onData)
      s.on('error', teardown)
      s.on('close', teardown)
      if (t.pass) {
        // AUTH اولین فرمانِ صف است — پاسخش را هم از همان صف می‌گیریم.
        s.write(encode(['AUTH', t.pass]))
        waiters.push({ resolve: () => {}, timer: setTimeout(() => {}, 0) as unknown as NodeJS.Timeout })
      }
      resolve()
    })
    s.once('error', (e) => { clearTimeout(ct); connectP = null; reject(e) })
  })
  return connectP
}

async function cmd(args: (string | Buffer)[], timeoutMs = 800): Promise<unknown> {
  if (!redisEnabled()) return null
  try { await ensureConn() } catch { return null }
  if (!sock || sock.destroyed) return null
  return new Promise((resolve) => {
    // تایم‌اوت = پاسخِ گم‌شده → برای همگام‌ماندنِ صفِ پاسخ‌ها کلِ اتصال بازنشانی می‌شود.
    const timer = setTimeout(() => { teardown() }, timeoutMs)
    waiters.push({ resolve: resolve as (v: unknown) => void, timer })
    try { sock!.write(encode(args)) } catch { teardown() }
  })
}

export async function rPing(): Promise<boolean> { return (await cmd(['PING'])) === 'PONG' }
export async function rGetBuf(key: string): Promise<Buffer | null> { const r = await cmd(['GET', key]); return Buffer.isBuffer(r) ? r : null }
export async function rGet(key: string): Promise<string | null> { const b = await rGetBuf(key); return b === null ? null : b.toString('utf8') }
export async function rSetEx(key: string, ttlSec: number, val: string | Buffer): Promise<boolean> { return (await cmd(['SET', key, val, 'EX', String(Math.max(1, Math.round(ttlSec)))])) === 'OK' }
export async function rSet(key: string, val: string | Buffer): Promise<boolean> { return (await cmd(['SET', key, val])) === 'OK' }
export async function rDel(key: string): Promise<void> { await cmd(['DEL', key]) }

// نوشتنِ یکنواخت‌صعودیِ یک شمارنده (اتمیک با Lua): فقط اگر مقدارِ جدید بزرگ‌تر باشد می‌نشیند.
// چرا: انتشارِ best-effortِ rev ترتیبِ تضمینی ندارد — بدونِ این گارد، یک انتشارِ در-راهِ قدیمی
// می‌توانست revِ تازه‌ترِ اینستنسِ دیگر را بازنویسی کند و کش‌ها را تا بازخوانیِ بعدی کور کند.
const SETMAX_LUA = "local c=redis.call('GET',KEYS[1]) if (not c) or (tonumber(ARGV[1])>tonumber(c)) then redis.call('SET',KEYS[1],ARGV[1]) end return 1"
export async function rSetMax(key: string, n: number): Promise<void> { await cmd(['EVAL', SETMAX_LUA, '1', key, String(n)]) }
