import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { listAccounts, getAccount, dashForRole } from './account-store'
import { getAgency } from './agency-store'
import { getAdvisor } from './advisor-store'
import { getProfile } from './profile-store'

// رابطهٔ «مشاور ↔ آژانس»: درخواست عضویت (دوطرفه) + عضویت.
// هر مشاور حداکثر در یک آژانس عضو است. کلیدها = شمارهٔ تلفن (phone).
const FILE = join(process.cwd(), '.agency-link-data.json')

export type LinkStatus = 'pending' | 'accepted' | 'rejected'
export interface LinkRequest {
  id: string
  advisorPhone: string; advisorName: string
  agencyPhone: string; agencyName: string
  initiator: 'advisor' | 'agency'   // چه کسی درخواست را شروع کرده
  status: LinkStatus
  createdAt: number
}
export interface Membership {
  advisorPhone: string; advisorName: string
  agencyPhone: string; agencyName: string
  since: number
}
interface DB { requests: LinkRequest[]; memberships: Membership[] }

function uid(p = '') { return p + randomBytes(5).toString('hex') }
function load(): DB { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { requests: d.requests || [], memberships: d.memberships || [] } } catch {} } return { requests: [], memberships: [] } }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db, null, 2)) }

// نامِ کسب‌وکار از پروفایلِ کاربر (نامِ آژانس/برند) — منبعِ اصلیِ نامِ آژانس
function bizName(phone: string): string {
  try { const bp = getProfile(phone); const n = (bp.businessName || bp.displayName || '').trim(); if (n) return n } catch {}
  return ''
}
// نامِ نمایشیِ مشاور: نامِ پروفایلِ مشاور → نامِ نمایشیِ کسب‌وکار → نامِ حساب (شخصی)
async function advisorNameOf(phone: string): Promise<string> {
  try { const n = ((await getAdvisor(phone)).profile.name || '').trim(); if (n) return n } catch {}
  const b = bizName(phone); if (b) return b
  return getAccount(phone)?.name || phone
}
// نامِ نمایشیِ آژانس: نامِ کسب‌وکار (آژانس) → نامِ تنظیماتِ آژانس → نامِ حساب (شخصی، فقط آخرین چاره)
async function agencyNameOf(phone: string): Promise<string> {
  const b = bizName(phone); if (b) return b
  try { const n = ((await getAgency(phone)).profile.name || '').trim(); if (n) return n } catch {}
  return getAccount(phone)?.name || phone
}
// نام‌ها در رکوردهای ذخیره‌شده، لحظهٔ ساخت اسنپ‌شات شده‌اند؛ هنگامِ خواندن دوباره و زنده حساب می‌کنیم
// تا همه‌جا نامِ درست (نامِ آژانس) نمایش داده شود — حتی برای رکوردهای قدیمی.
async function freshMembership(m: Membership): Promise<Membership> {
  return { ...m, advisorName: await advisorNameOf(m.advisorPhone), agencyName: await agencyNameOf(m.agencyPhone) }
}
async function freshRequest(r: LinkRequest): Promise<LinkRequest> {
  return { ...r, advisorName: await advisorNameOf(r.advisorPhone), agencyName: await agencyNameOf(r.agencyPhone) }
}

// همهٔ آژانس‌های ثبت‌شده (حساب‌هایی که داشبوردشان /agency است)
export async function listAgencies(): Promise<{ phone: string; name: string; branches?: string }[]> {
  const accts = listAccounts().filter(a => dashForRole(a.role) === '/agency')
  return Promise.all(accts.map(async a => { let branches: string | undefined; try { branches = (await getAgency(a.phone)).profile.branches } catch {} return { phone: a.phone, name: await agencyNameOf(a.phone), branches } }))
}

export async function getAdvisorMembership(advisorPhone: string): Promise<Membership | null> {
  const m = load().memberships.find(m => m.advisorPhone === advisorPhone)
  return m ? await freshMembership(m) : null
}
export async function listAgencyMembers(agencyPhone: string): Promise<Membership[]> {
  return Promise.all(load().memberships.filter(m => m.agencyPhone === agencyPhone).sort((a, b) => b.since - a.since).map(freshMembership))
}
export async function requestsForAdvisor(advisorPhone: string): Promise<LinkRequest[]> {
  return Promise.all(load().requests.filter(r => r.advisorPhone === advisorPhone && r.status === 'pending').sort((a, b) => b.createdAt - a.createdAt).map(freshRequest))
}
export async function requestsForAgency(agencyPhone: string): Promise<LinkRequest[]> {
  return Promise.all(load().requests.filter(r => r.agencyPhone === agencyPhone && r.status === 'pending').sort((a, b) => b.createdAt - a.createdAt).map(freshRequest))
}

// مشاور برای یک آژانس درخواست عضویت می‌فرستد
export async function advisorRequestJoin(advisorPhone: string, agencyPhone: string): Promise<{ ok: boolean; error?: string; request?: LinkRequest }> {
  const db = load()
  if (db.memberships.find(m => m.advisorPhone === advisorPhone && m.agencyPhone === agencyPhone)) return { ok: false, error: 'شما عضو این آژانس هستید' }
  if (db.requests.find(r => r.advisorPhone === advisorPhone && r.agencyPhone === agencyPhone && r.status === 'pending')) return { ok: false, error: 'درخواست در انتظار بررسی است' }
  const req: LinkRequest = { id: uid('r_'), advisorPhone, advisorName: await advisorNameOf(advisorPhone), agencyPhone, agencyName: await agencyNameOf(agencyPhone), initiator: 'advisor', status: 'pending', createdAt: Date.now() }
  db.requests.unshift(req); save(db); return { ok: true, request: req }
}
// آژانس یک مشاور را دعوت/اضافه می‌کند
export async function agencyInvite(agencyPhone: string, advisorPhone: string): Promise<{ ok: boolean; error?: string; request?: LinkRequest }> {
  if (!advisorPhone) return { ok: false, error: 'شمارهٔ مشاور الزامی است' }
  const db = load()
  if (db.memberships.find(m => m.advisorPhone === advisorPhone && m.agencyPhone === agencyPhone)) return { ok: false, error: 'این مشاور عضو آژانس شماست' }
  if (db.requests.find(r => r.advisorPhone === advisorPhone && r.agencyPhone === agencyPhone && r.status === 'pending')) return { ok: false, error: 'درخواست قبلاً ارسال شده' }
  const req: LinkRequest = { id: uid('r_'), advisorPhone, advisorName: await advisorNameOf(advisorPhone), agencyPhone, agencyName: await agencyNameOf(agencyPhone), initiator: 'agency', status: 'pending', createdAt: Date.now() }
  db.requests.unshift(req); save(db); return { ok: true, request: req }
}
// پاسخ به درخواست توسط طرفِ مقابل (byPhone). accept=true → عضویت.
export function respondRequest(reqId: string, byPhone: string, accept: boolean): { ok: boolean; error?: string } {
  const db = load()
  const r = db.requests.find(x => x.id === reqId); if (!r || r.status !== 'pending') return { ok: false, error: 'درخواست یافت نشد' }
  // فقط طرفِ مقابلِ شروع‌کننده می‌تواند پاسخ دهد
  const responder = r.initiator === 'advisor' ? r.agencyPhone : r.advisorPhone
  if (byPhone !== responder) return { ok: false, error: 'دسترسی غیرمجاز' }
  if (accept) {
    db.memberships = db.memberships.filter(m => m.advisorPhone !== r.advisorPhone) // یک آژانس برای هر مشاور
    db.memberships.unshift({ advisorPhone: r.advisorPhone, advisorName: r.advisorName, agencyPhone: r.agencyPhone, agencyName: r.agencyName, since: Date.now() })
    r.status = 'accepted'
    // درخواست‌های دیگرِ همان مشاور را لغو کن
    db.requests.forEach(x => { if (x.id !== r.id && x.advisorPhone === r.advisorPhone && x.status === 'pending') x.status = 'rejected' })
  } else r.status = 'rejected'
  save(db); return { ok: true }
}
export function cancelRequest(reqId: string, byPhone: string): { ok: boolean } {
  const db = load(); const r = db.requests.find(x => x.id === reqId)
  if (r && (r.advisorPhone === byPhone || r.agencyPhone === byPhone)) { db.requests = db.requests.filter(x => x.id !== reqId); save(db) }
  return { ok: true }
}
// خروج مشاور از آژانس یا حذف توسط آژانس
export function removeMembership(advisorPhone: string, agencyPhone: string): { ok: boolean } {
  const db = load(); db.memberships = db.memberships.filter(m => !(m.advisorPhone === advisorPhone && m.agencyPhone === agencyPhone)); save(db); return { ok: true }
}
