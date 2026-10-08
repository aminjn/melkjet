/**
 * لاگِ مرکزیِ پیامک + دروازهٔ سقفِ هر کاربر.
 *
 * چرا ساخته شد (۸ اکتبر ۲۰۲۶ — حادثهٔ واقعی): کاربری بیش از ۱۵۰ پیامک گرفت و شاکی شد، و
 * ما **نمی‌توانستیم از دادهٔ خودمان بگوییم چرا** — هیچ‌جا ثبت نمی‌شد چه کسی چه چیزی گرفت.
 * تنها ردِ پا، ثبتِ کوتاه‌کنندهٔ لینک بود و متنِ هشدار لینک نداشت، پس آن هم خالی بود.
 * گران‌ترین و مزاحم‌ترین کانالِ سایت، تنها کانالی بود که لاگ نداشت.
 *
 * دو کار با یک مکانیزم:
 *   ۱) logSms — هر ارسال ثبت می‌شود (گیرنده، کانال، نتیجه، زمان).
 *   ۲) canSendSms — همان لاگ، دروازهٔ سقف هم می‌شود. سقف از جایی می‌آید که لاگ است،
 *      پس شمارنده و واقعیت هرگز از هم جدا نمی‌شوند (درسِ «شمارندهٔ موازی» در CLAUDE.md).
 *
 * OTP عمداً از دروازه معاف است: کاربر خودش درخواستش کرده و otp-store سقفِ خودش را دارد.
 */
import { join } from 'path'
import { readJsonCached, writeJsonCached } from './json-file'
import { pgEnabled, kvGet, kvMutate } from './db'
import { FA_DIGITS, faDigit } from './digits'

const DATA_FILE = join(process.cwd(), '.sms-log-data.json')
const KV_KEY = 'sms_log'
const MAX_ROWS = 6000   // حلقه — لاگ نباید خودش به بلابِ بزرگ تبدیل شود

export type SmsChannel = 'otp' | 'alert' | 'autosite' | 'profile-gate' | 'tracker' | 'outreach' | 'campaign' | 'manual' | 'other'

export interface SmsRow { at: number; phone: string; ch: SmsChannel; ok: boolean; note?: string }
interface DB { rows: SmsRow[] }

const norm = (p: unknown) => String(p ?? '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')

function fileLoad(): DB { return readJsonCached<DB>(DATA_FILE, { rows: [] }) }
function fileSave(db: DB) { writeJsonCached(DATA_FILE, db) }
async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { rows: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { rows: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

/** ثبتِ یک ارسال. هرگز throw نمی‌کند — لاگ نباید مسیرِ ارسال را بشکند. */
export async function logSms(phone: string, ch: SmsChannel, ok: boolean, note?: string): Promise<void> {
  const p = norm(phone)
  if (!p) return
  try {
    await mutate(db => {
      if (!Array.isArray(db.rows)) db.rows = []
      db.rows.push({ at: Date.now(), phone: p, ch, ok, note: note ? String(note).slice(0, 160) : undefined })
      if (db.rows.length > MAX_ROWS) db.rows = db.rows.slice(db.rows.length - MAX_ROWS)
    })
  } catch { /* لاگ نباید ارسال را بشکند */ }
}

/** چند پیامکِ موفق از این کانال (یا همهٔ کانال‌ها) از زمانِ since به این شماره رفته؟ */
export async function countSince(phone: string, since: number, ch?: SmsChannel): Promise<number> {
  const p = norm(phone)
  if (!p) return 0
  const rows = (await load()).rows || []
  return rows.filter(r => r.phone === p && r.ok && r.at >= since && (!ch || r.ch === ch)).length
}

/** آخرین ارسالِ موفقِ این کانال به این شماره (۰ = هرگز). */
export async function lastSentAt(phone: string, ch?: SmsChannel): Promise<number> {
  const p = norm(phone)
  if (!p) return 0
  const rows = (await load()).rows || []
  let last = 0
  for (const r of rows) if (r.phone === p && r.ok && (!ch || r.ch === ch) && r.at > last) last = r.at
  return last
}

/**
 * دروازه: آیا مجازیم این پیامک را بفرستیم؟
 * perDay = سقفِ روزانهٔ همین کانال؛ minGapMs = حداقل فاصله از آخرین ارسالِ همین کانال.
 * هر دو اختیاری‌اند، ولی هر فرستندهٔ غیرِحیاتی باید دستِ‌کم یکی را بدهد.
 */
export async function canSendSms(
  phone: string, ch: SmsChannel, limits: { perDay?: number; minGapMs?: number },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const p = norm(phone)
  if (!/^09\d{9}$/.test(p)) return { ok: false, reason: 'شمارهٔ نامعتبر' }
  const now = Date.now()
  if (limits.minGapMs) {
    const last = await lastSentAt(p, ch)
    if (last && now - last < limits.minGapMs) {
      const mins = Math.ceil((limits.minGapMs - (now - last)) / 60_000)
      return { ok: false, reason: `فاصلهٔ کمینه رعایت نشده — ${mins} دقیقهٔ دیگر` }
    }
  }
  if (limits.perDay) {
    const n = await countSince(p, now - 86_400_000, ch)
    if (n >= limits.perDay) return { ok: false, reason: `سقفِ روزانهٔ کانالِ ${ch} پر است (${n}/${limits.perDay})` }
  }
  return { ok: true }
}

/** سابقهٔ یک شماره — برای ممیزی و پاسخ به شکایت. */
export async function recentForPhone(phone: string, limit = 200): Promise<SmsRow[]> {
  const p = norm(phone)
  const rows = (await load()).rows || []
  return rows.filter(r => r.phone === p).sort((a, b) => b.at - a.at).slice(0, limit)
}

/** پرگیرنده‌ترین شماره‌ها در بازهٔ اخیر — برای دیدنِ حادثه پیش از شکایتِ کاربر. */
export async function topRecipients(sinceMs = 86_400_000, limit = 15): Promise<{ phone: string; n: number; chans: string }[]> {
  const since = Date.now() - sinceMs
  const rows = (await load()).rows || []
  const by = new Map<string, { n: number; ch: Map<string, number> }>()
  for (const r of rows) {
    if (r.at < since || !r.ok) continue
    let e = by.get(r.phone); if (!e) { e = { n: 0, ch: new Map() }; by.set(r.phone, e) }
    e.n++; e.ch.set(r.ch, (e.ch.get(r.ch) || 0) + 1)
  }
  return [...by.entries()]
    .map(([phone, e]) => ({ phone, n: e.n, chans: [...e.ch.entries()].map(([c, n]) => `${c}=${n}`).join('، ') }))
    .sort((a, b) => b.n - a.n).slice(0, limit)
}
