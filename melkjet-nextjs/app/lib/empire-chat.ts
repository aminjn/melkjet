// 💬 فاز ۱۱۱ — گفت‌وگوی سراسریِ شهر (فصل‌های ۸/۱۰) + ماژولِ نظارت (بلاکرِ قبلیِ همین قابلیت).
// polling سبک (سازگار با ۴ فورکِ pm2 — همان الگوی گفتگوی دوستانِ فاز ۱۰۲)؛ ذخیره dual-mode (kv اتمیک روی PG).
// ضدِ اسپم: کول‌داون + سقفِ طول + فیلترِ واژهٔ ممنوع (قانون ۳) + گیتِ سطح (در API) + سکوتِ ادمین.
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

const FILE = path.join(process.cwd(), '.empire-chat-data.json')
const KEY = 'empire_chat'

export interface ChatMsg { id: string; userId: string; no: number; name: string; text: string; at: number; del?: 1; reports?: string[] }
type ChatDb = { msgs: ChatMsg[]; mutes: Record<string, number> }
const EMPTY: ChatDb = { msgs: [], mutes: {} }

async function load(): Promise<ChatDb> {
  if (pgEnabled()) return kvGet<ChatDb>(KEY, EMPTY).catch(() => ({ ...EMPTY }))
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return { msgs: [], mutes: {} } }
}
async function mutate<R>(fn: (d: ChatDb) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<ChatDb, R>(KEY, EMPTY, fn)
  let d: ChatDb = { msgs: [], mutes: {} }
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch {}
  const r = fn(d)
  try { fs.writeFileSync(FILE, JSON.stringify(d)) } catch {}
  return r
}

export type ChatCfg = { enabled: boolean; maxLen: number; cooldownSec: number; minLevel: number; keep: number }
const BANNED = /بازی|گیم|نورا|قمار|شرط/

// اعتبارسنجیِ خالص (تست‌پذیر): null = مجاز، وگرنه پیامِ فارسیِ صادقانه. lastAt = زمانِ آخرین پیامِ خودِ کاربر.
export function validateChatMsg(text: string, cfg: ChatCfg, lastAt: number, now: number): string | null {
  if (!cfg.enabled) return 'گفت‌وگوی شهر فعال نیست'
  const t = String(text || '').trim()
  if (t.length < 1) return 'پیامی بنویس'
  if (t.length > Math.max(1, cfg.maxLen)) return `پیام حداکثر ${Math.max(1, cfg.maxLen).toLocaleString('fa-IR')} کاراکتر`
  if (BANNED.test(t)) return 'این واژه در گفت‌وگوی شهر مجاز نیست'
  if (/(https?:\/\/|www\.)/i.test(t)) return 'لینک در گفت‌وگوی شهر مجاز نیست'
  if (lastAt && now - lastAt < Math.max(0, cfg.cooldownSec) * 1000)
    return `کمی صبر کن — هر ${Math.max(0, cfg.cooldownSec).toLocaleString('fa-IR')} ثانیه یک پیام`
  return null
}

export async function postChatMsg(
  by: { userId: string; no: number; name: string },
  text: string, cfg: ChatCfg, now = Date.now(),
): Promise<{ ok: boolean; reason?: string }> {
  return mutate(db => {
    const muted = db.mutes[by.userId] || 0
    if (muted > now) return { ok: false, reason: `به تشخیصِ ملک‌جت تا ${new Date(muted).toLocaleDateString('fa-IR')} امکانِ ارسال نداری` }
    const lastAt = [...db.msgs].reverse().find(m => m.userId === by.userId)?.at || 0
    const err = validateChatMsg(text, cfg, lastAt, now)
    if (err) return { ok: false, reason: err }
    db.msgs.push({ id: randomBytes(4).toString('hex'), userId: by.userId, no: by.no, name: by.name, text: String(text).trim(), at: now })
    const keep = Math.max(50, cfg.keep)
    if (db.msgs.length > keep) db.msgs = db.msgs.slice(-keep)
    return { ok: true }
  })
}

// نمای بازیکن: ۴۰ پیامِ آخرِ حذف‌نشده — شمارهٔ گزارش‌ها فقط برای ادمین است، اینجا نمی‌رود.
export async function chatView(userId: string, now = Date.now()) {
  const db = await load()
  return {
    msgs: db.msgs.filter(m => !m.del).slice(-40).map(m => ({
      id: m.id, no: m.no, name: m.name, text: m.text, at: m.at, mine: m.userId === userId,
      reported: (m.reports || []).includes(userId),
    })),
    mutedUntil: (db.mutes[userId] || 0) > now ? db.mutes[userId] : 0,
  }
}

// گزارشِ پیام توسطِ بازیکن — هر بازیکن برای هر پیام یک‌بار؛ فقط علامت‌گذاری (تصمیم با ادمین).
export async function reportChatMsg(userId: string, msgId: string): Promise<{ ok: boolean }> {
  return mutate(db => {
    const m = db.msgs.find(x => x.id === msgId && !x.del)
    if (!m || m.userId === userId) return { ok: false }
    m.reports = m.reports || []
    if (!m.reports.includes(userId)) m.reports.push(userId)
    return { ok: true }
  })
}

// ── ماژولِ نظارت (ادمین) ──
export async function chatModList(now = Date.now()) {
  const db = await load()
  return {
    msgs: db.msgs.slice(-60).reverse().map(m => ({ id: m.id, userId: m.userId, no: m.no, name: m.name, text: m.text, at: m.at, del: !!m.del, reports: (m.reports || []).length })),
    mutes: Object.entries(db.mutes).filter(([, t]) => t > now).map(([userId, until]) => ({ userId, until })),
  }
}
export async function adminDeleteChatMsg(msgId: string): Promise<void> {
  await mutate(db => { const m = db.msgs.find(x => x.id === msgId); if (m) { m.del = 1; m.text = '' } })
}
// hours ≤ 0 = رفعِ سکوت
export async function adminMuteChat(userId: string, hours: number, now = Date.now()): Promise<void> {
  await mutate(db => {
    if (hours > 0) db.mutes[userId] = now + hours * 3600e3
    else delete db.mutes[userId]
  })
}
