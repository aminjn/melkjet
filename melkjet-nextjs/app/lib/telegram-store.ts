// فاز ۲۵۳ / ۳۰۰ — انبارِ آلارم + پیش‌نویسِ گفت‌وگوِ ربات. فایل‌محور. چندسکویی شد:
// سکوی جاری (تلگرام/بله) از bot-ctx می‌آید و کلیدها را جدا می‌کند تا chatIdهای دو پلتفرم
// با هم قاطی نشوند. پیش‌فرض «tg» است و کلیدش بدونِ پیشوند می‌ماند → دادهٔ تلگرامِ موجود دست‌نخورده.
import { promises as fs } from 'fs'
import { join } from 'path'
import { currentBot, type BotPlatform } from './bot-ctx'

const FILE = join(process.cwd(), '.telegram-data.json')
const plat = (): BotPlatform => currentBot()?.platform || 'tg'
const k = (chatId: number): string => (plat() === 'bale' ? 'bale:' + chatId : String(chatId))   // کلیدِ دیکشنریِ پیش‌نویس
const samePlat = (s: { platform?: BotPlatform }) => (s.platform || 'tg') === plat()

export interface Sub { id: string; chatId: number; deal: string; city: string; region: string; hood: string; createdAt: number; platform?: BotPlatform }
export interface Draft {
  step: 'deal' | 'city' | 'cityText' | 'region' | 'regionText' | 'hood'
  deal?: string; city?: string; region?: string; regions?: string[]; hoods?: string[]
}
// فاز ۲۵۷ — وصلِ حسابِ سایت به چتِ ربات (شمارهٔ تأییدشده با اشتراکِ مخاطب).
export interface Link { chatId: number; phone: string; name?: string; role?: string; linkedAt: number; platform?: BotPlatform }
// فاز ۲۵۷/۲۵۹ — پیش‌نویسِ ثبتِ آگهیِ هوشمند (پرسشِ گام‌به‌گامِ همه‌چیز با دکمه).
export interface LDraft {
  step: 'deal' | 'ptype' | 'city' | 'cityText' | 'hood' | 'hoodText' | 'area'
    | 'rooms' | 'floor' | 'age' | 'parking' | 'elevator' | 'storage'
    | 'price' | 'deposit' | 'rent' | 'photo' | 'gen' | 'editdesc' | 'confirm'
  deal?: string; ptype?: string; city?: string; hood?: string; hoods?: string[]
  area?: string; rooms?: string; floor?: string; age?: string
  parking?: boolean; elevator?: boolean; storage?: boolean
  price?: string; deposit?: string; rent?: string; image?: string; title?: string; description?: string
}
// فاز ۲۶۴ — پیش‌نویسِ جستجوی درون‌ربات (معامله→شهر→محله → نمایشِ آگهی‌های منطبق).
export interface SDraft { step: 'deal' | 'city' | 'cityText' | 'hood' | 'hoodText'; deal?: string; city?: string; hoods?: string[]; hood?: string }
interface DB { subs: Sub[]; drafts: Record<string, Draft>; links: Record<string, Link>; ldrafts: Record<string, LDraft>; sdrafts: Record<string, SDraft> }

async function load(): Promise<DB> {
  try { const d = JSON.parse(await fs.readFile(FILE, 'utf8')); return { subs: d.subs || [], drafts: d.drafts || {}, links: d.links || {}, ldrafts: d.ldrafts || {}, sdrafts: d.sdrafts || {} } }
  catch { return { subs: [], drafts: {}, links: {}, ldrafts: {}, sdrafts: {} } }
}
async function save(db: DB) { await fs.writeFile(FILE, JSON.stringify(db), 'utf8') }
const rid = () => Math.random().toString(36).slice(2, 10)

export async function getDraft(chatId: number) { return (await load()).drafts[k(chatId)] }
export async function setDraft(chatId: number, draft: Draft) { const db = await load(); db.drafts[k(chatId)] = draft; await save(db) }
export async function clearDraft(chatId: number) { const db = await load(); delete db.drafts[k(chatId)]; await save(db) }

export async function addSub(s: Omit<Sub, 'id' | 'createdAt' | 'platform'>): Promise<Sub> {
  const db = await load(); const sub: Sub = { ...s, id: rid(), createdAt: Date.now(), platform: plat() }
  db.subs.unshift(sub); await save(db); return sub
}
export async function listSubs(chatId: number): Promise<Sub[]> { return (await load()).subs.filter(s => s.chatId === chatId && samePlat(s)) }
export async function removeSub(chatId: number, id: string): Promise<boolean> {
  const db = await load(); const before = db.subs.length
  db.subs = db.subs.filter(s => !(s.chatId === chatId && s.id === id && samePlat(s))); await save(db); return db.subs.length < before
}
export async function allSubs(): Promise<Sub[]> { return (await load()).subs }

// ── فاز ۲۵۷: وصلِ حساب ──────────────────────────────────────────────────────
export async function getLink(chatId: number): Promise<Link | undefined> { return (await load()).links[k(chatId)] }
export async function setLink(l: Link) { const db = await load(); db.links[k(l.chatId)] = { ...l, platform: plat() }; await save(db) }
export async function removeLink(chatId: number) { const db = await load(); delete db.links[k(chatId)]; await save(db) }
// فاز ۳۰۰ج — همهٔ چت‌های وصل‌شده به یک شماره (در هر دو سکو) — برای خبرِ «آگهی‌ات تأیید شد».
export async function linksByPhone(phone: string): Promise<Link[]> {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return []
  return Object.values((await load()).links).filter(l => String(l.phone || '').replace(/\D/g, '') === digits)
}

// ── فاز ۲۵۷: پیش‌نویسِ آگهی ──────────────────────────────────────────────────
export async function getLDraft(chatId: number): Promise<LDraft | undefined> { return (await load()).ldrafts[k(chatId)] }
export async function setLDraft(chatId: number, d: LDraft) { const db = await load(); db.ldrafts[k(chatId)] = d; await save(db) }
export async function clearLDraft(chatId: number) { const db = await load(); delete db.ldrafts[k(chatId)]; await save(db) }

export async function getSDraft(chatId: number): Promise<SDraft | undefined> { return (await load()).sdrafts[k(chatId)] }
export async function setSDraft(chatId: number, d: SDraft) { const db = await load(); db.sdrafts[k(chatId)] = d; await save(db) }
export async function clearSDraft(chatId: number) { const db = await load(); delete db.sdrafts[k(chatId)]; await save(db) }
