import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { listAccounts, getAccount, dashForRole } from './account-store'
import { getAgency } from './agency-store'
import { getAdvisor } from './advisor-store'

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

// نام نمایشیِ یک حساب بر اساس نقشش
function advisorNameOf(phone: string): string {
  try { const n = getAdvisor(phone).profile.name; if (n) return n } catch {}
  return getAccount(phone)?.name || phone
}
function agencyNameOf(phone: string): string {
  try { const n = getAgency(phone).profile.name; if (n) return n } catch {}
  return getAccount(phone)?.name || phone
}

// همهٔ آژانس‌های ثبت‌شده (حساب‌هایی که داشبوردشان /agency است)
export function listAgencies(): { phone: string; name: string; branches?: string }[] {
  return listAccounts()
    .filter(a => dashForRole(a.role) === '/agency')
    .map(a => { let branches: string | undefined; try { branches = getAgency(a.phone).profile.branches } catch {} return { phone: a.phone, name: agencyNameOf(a.phone), branches } })
}

export function getAdvisorMembership(advisorPhone: string): Membership | null {
  return load().memberships.find(m => m.advisorPhone === advisorPhone) || null
}
export function listAgencyMembers(agencyPhone: string): Membership[] {
  return load().memberships.filter(m => m.agencyPhone === agencyPhone).sort((a, b) => b.since - a.since)
}
export function requestsForAdvisor(advisorPhone: string): LinkRequest[] {
  return load().requests.filter(r => r.advisorPhone === advisorPhone && r.status === 'pending').sort((a, b) => b.createdAt - a.createdAt)
}
export function requestsForAgency(agencyPhone: string): LinkRequest[] {
  return load().requests.filter(r => r.agencyPhone === agencyPhone && r.status === 'pending').sort((a, b) => b.createdAt - a.createdAt)
}

// مشاور برای یک آژانس درخواست عضویت می‌فرستد
export function advisorRequestJoin(advisorPhone: string, agencyPhone: string): { ok: boolean; error?: string; request?: LinkRequest } {
  const db = load()
  if (db.memberships.find(m => m.advisorPhone === advisorPhone && m.agencyPhone === agencyPhone)) return { ok: false, error: 'شما عضو این آژانس هستید' }
  if (db.requests.find(r => r.advisorPhone === advisorPhone && r.agencyPhone === agencyPhone && r.status === 'pending')) return { ok: false, error: 'درخواست در انتظار بررسی است' }
  const req: LinkRequest = { id: uid('r_'), advisorPhone, advisorName: advisorNameOf(advisorPhone), agencyPhone, agencyName: agencyNameOf(agencyPhone), initiator: 'advisor', status: 'pending', createdAt: Date.now() }
  db.requests.unshift(req); save(db); return { ok: true, request: req }
}
// آژانس یک مشاور را دعوت/اضافه می‌کند
export function agencyInvite(agencyPhone: string, advisorPhone: string): { ok: boolean; error?: string; request?: LinkRequest } {
  if (!advisorPhone) return { ok: false, error: 'شمارهٔ مشاور الزامی است' }
  const db = load()
  if (db.memberships.find(m => m.advisorPhone === advisorPhone && m.agencyPhone === agencyPhone)) return { ok: false, error: 'این مشاور عضو آژانس شماست' }
  if (db.requests.find(r => r.advisorPhone === advisorPhone && r.agencyPhone === agencyPhone && r.status === 'pending')) return { ok: false, error: 'درخواست قبلاً ارسال شده' }
  const req: LinkRequest = { id: uid('r_'), advisorPhone, advisorName: advisorNameOf(advisorPhone), agencyPhone, agencyName: agencyNameOf(agencyPhone), initiator: 'agency', status: 'pending', createdAt: Date.now() }
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
