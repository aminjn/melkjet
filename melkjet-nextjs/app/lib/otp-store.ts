// ذخیرهٔ کدِ یک‌بارمصرف — اشتراکی بینِ همهٔ اینستنس‌ها (dual-mode مثلِ بقیهٔ storeها).
// ریشهٔ باگِ «کد درست را می‌زنم، می‌گوید اشتباه است»: نسخهٔ قبلی Map درون-حافظه‌ای بود؛ پیامک را
// اینستنسِ A می‌فرستاد و ذخیره می‌کرد، تأیید به اینستنسِ B (پشتِ nginx) می‌رسید که کدی نداشت → invalid.
// حالا: PG (kv «otp» — اتمیک با FOR UPDATE) وگرنه فایلِ مشترکِ ‎.otp-data.json‎ (cwd مشترکِ pm2).
// + محدودیتِ ارسالِ مجددِ «سمتِ سرور»: رفرشِ صفحه دیگر تایمر را دور نمی‌زند — سرور تا پایانِ مهلت، پیامکِ تازه نمی‌فرستد.
import fs from 'fs'
import path from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

interface OTPEntry { code: string; expires: number; attempts: number; sentAt: number }
type OTPMap = Record<string, OTPEntry>

const FILE = path.join(process.cwd(), '.otp-data.json')
const KV = 'otp'
const TTL_MS = 5 * 60 * 1000            // اعتبارِ کد
export const RESEND_COOLDOWN_S = 120    // مهلتِ ارسالِ مجدد (همان ۱۲۰ ثانیه‌ای که UI نشان می‌دهد — حالا سمتِ سرور هم)
const MAX_ATTEMPTS = 5

const prune = (m: OTPMap, now: number): OTPMap => {
  for (const k of Object.keys(m)) if (m[k].expires < now) delete m[k]
  return m
}
async function loadAll(): Promise<OTPMap> {
  if (pgEnabled()) return await kvGet<OTPMap>(KV, {}).catch(() => ({} as OTPMap))
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return {} }
}
async function mutate<R>(fn: (m: OTPMap) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<OTPMap, R>(KV, {}, m => fn(prune(m, Date.now())))
  const m = prune(await loadAll(), Date.now())
  const out = fn(m)
  fs.writeFileSync(FILE, JSON.stringify(m))
  return out
}

// آیا الان می‌شود کدِ تازه فرستاد؟ (پیش از مصرفِ هزینهٔ پیامک صدا زده می‌شود)
export async function canSendOTP(phone: string, now = Date.now()): Promise<{ ok: true } | { ok: false; retryIn: number }> {
  const m = await loadAll()
  const e = m[phone]
  if (e && now - e.sentAt < RESEND_COOLDOWN_S * 1000) return { ok: false, retryIn: Math.ceil((e.sentAt + RESEND_COOLDOWN_S * 1000 - now) / 1000) }
  return { ok: true }
}

export async function setOTP(phone: string, code: string, now = Date.now()): Promise<void> {
  await mutate(m => { m[phone] = { code, expires: now + TTL_MS, attempts: 0, sentAt: now } })
}

export async function verifyOTP(phone: string, code: string): Promise<'valid' | 'invalid' | 'expired' | 'too_many'> {
  return mutate(m => {
    const e = m[phone]
    if (!e) return 'invalid'
    if (Date.now() > e.expires) { delete m[phone]; return 'expired' }
    if (e.attempts >= MAX_ATTEMPTS) return 'too_many'
    if (e.code !== code) { e.attempts++; return 'invalid' }
    delete m[phone]
    return 'valid'
  })
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
