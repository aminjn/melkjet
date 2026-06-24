import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { listLeads as crmLeads } from './leads-store'
import { listLeads as advisorLeads } from './advisor-store'
import { listLeads as agencyLeads } from './agency-store'

// «دفترچهٔ مخاطبین» مارکتینگ — per-owner. هر مخاطب: نام، موبایل، ایمیل، گروه‌ها،
// و این‌که برای ایمیل‌مارکتینگ و/یا پیامک استفاده شود. منبعِ گیرندگانِ کمپین‌ها.
const DATA_FILE = join(process.cwd(), '.contacts-data.json')

export interface Contact {
  id: string
  name: string
  phone?: string
  email?: string
  groups: string[]
  forEmail: boolean
  forSms: boolean
  createdAt: number
}
// groups: گروه‌های نام‌دار (دفترچه‌ها) که کاربر صراحتاً می‌سازد — مستقل از این‌که خالی باشند.
interface DB { contacts: Record<string, Contact[]>; groups: Record<string, string[]> }

function id() { return 'ct_' + randomBytes(5).toString('hex') }
function load(): DB { if (existsSync(DATA_FILE)) { try { const d = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); return { contacts: d.contacts || {}, groups: d.groups || {} } } catch {} } return { contacts: {}, groups: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

const normPhone = (s?: string) => (s || '').replace(/[^\d]/g, '')
const normEmail = (s?: string) => (s || '').trim().toLowerCase()
const isEmail = (s?: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || '')

export function listContacts(o: string): Contact[] {
  return (load().contacts[o] || []).slice().sort((a, b) => b.createdAt - a.createdAt)
}
// گروه‌ها = گروه‌های ساخته‌شده + هر گروهی که روی مخاطبی هست (تا چیزی گم نشود)
export function listGroups(o: string): string[] {
  const db = load()
  const set = new Set<string>(db.groups[o] || [])
  for (const c of db.contacts[o] || []) for (const g of c.groups) if (g) set.add(g)
  return Array.from(set).sort()
}
export function addGroup(o: string, name: string): string[] {
  const g = String(name || '').trim(); if (!g) return listGroups(o)
  const db = load(); const list = db.groups[o] || (db.groups[o] = [])
  if (!list.includes(g)) list.push(g)
  save(db); return listGroups(o)
}
export function deleteGroup(o: string, name: string): string[] {
  const db = load()
  if (db.groups[o]) db.groups[o] = db.groups[o].filter(x => x !== name)
  for (const c of db.contacts[o] || []) c.groups = c.groups.filter(x => x !== name)  // برچسبِ گروه از مخاطبین حذف می‌شود (خودِ مخاطب می‌ماند)
  save(db); return listGroups(o)
}
// افزودن/حذفِ یک گروه روی چند مخاطب (دسته‌ای یا تکی)
export function assignGroup(o: string, contactIds: string[], group: string, add: boolean) {
  const g = String(group || '').trim(); if (!g) return
  const db = load(); const list = db.contacts[o] || []
  const ids = new Set(contactIds)
  for (const c of list) {
    if (!ids.has(c.id)) continue
    if (add) { if (!c.groups.includes(g)) c.groups.push(g) }
    else c.groups = c.groups.filter(x => x !== g)
  }
  if (add && !(db.groups[o] || []).includes(g)) (db.groups[o] || (db.groups[o] = [])).push(g)
  save(db)
}

export function addContact(o: string, input: { name?: string; phone?: string; email?: string; groups?: string[]; forEmail?: boolean; forSms?: boolean }): Contact {
  const db = load()
  const list = db.contacts[o] || (db.contacts[o] = [])
  // گروه‌های واردشده را در فهرستِ گروه‌ها هم ثبت کن
  for (const g of (input.groups || []).filter(Boolean)) { const gl = db.groups[o] || (db.groups[o] = []); if (!gl.includes(g)) gl.push(g) }
  const phone = normPhone(input.phone)
  const email = normEmail(input.email)
  // dedupe by phone یا email
  const existing = list.find(c => (phone && normPhone(c.phone) === phone) || (email && normEmail(c.email) === email))
  if (existing) {
    if (input.name && !existing.name) existing.name = input.name
    if (phone && !existing.phone) existing.phone = input.phone
    if (email && !existing.email) existing.email = input.email
    if (input.groups) existing.groups = Array.from(new Set([...existing.groups, ...input.groups.filter(Boolean)]))
    if (input.forEmail !== undefined) existing.forEmail = input.forEmail
    if (input.forSms !== undefined) existing.forSms = input.forSms
    save(db); return existing
  }
  const c: Contact = {
    id: id(), name: String(input.name || '').trim() || (input.phone || email || 'مخاطب'),
    phone: phone ? input.phone : undefined, email: isEmail(email) ? email : undefined,
    groups: (input.groups || []).filter(Boolean),
    forEmail: input.forEmail !== undefined ? input.forEmail : isEmail(email),
    forSms: input.forSms !== undefined ? input.forSms : !!phone,
    createdAt: Date.now(),
  }
  list.unshift(c); save(db); return c
}

export function updateContact(o: string, cid: string, patch: Partial<Contact>): Contact | null {
  const db = load(); const c = (db.contacts[o] || []).find(x => x.id === cid); if (!c) return null
  if (patch.name !== undefined) c.name = String(patch.name)
  if (patch.phone !== undefined) c.phone = patch.phone || undefined
  if (patch.email !== undefined) c.email = patch.email || undefined
  if (patch.groups !== undefined) c.groups = patch.groups.filter(Boolean)
  if (patch.forEmail !== undefined) c.forEmail = !!patch.forEmail
  if (patch.forSms !== undefined) c.forSms = !!patch.forSms
  save(db); return c
}
export function deleteContact(o: string, cid: string) {
  const db = load(); if (!db.contacts[o]) return
  db.contacts[o] = db.contacts[o].filter(c => c.id !== cid); save(db)
}

// ایمپورتِ گروهی (مثلاً از CSVِ اکسل): هر سطر name, phone, email
export function bulkAddContacts(o: string, rows: { name?: string; phone?: string; email?: string }[], groups: string[] = []): { added: number; skipped: number } {
  let added = 0, skipped = 0
  for (const r of rows) {
    if (!normPhone(r.phone) && !isEmail(normEmail(r.email))) { skipped++; continue }
    addContact(o, { ...r, groups }); added++
  }
  return { added, skipped }
}

// افزودنِ همهٔ لیدهای کاربر به دفترچه — از همهٔ منابعِ لید (CRM، مشاور، آژانس) — گروهِ «لیدها»
export function importFromLeads(o: string, group?: string): { added: number } {
  let added = 0
  const groups = [group && group.trim() ? group.trim() : 'لیدها']
  const all: { name?: string; phone?: string; email?: string }[] = []
  try { for (const l of crmLeads(o)) all.push({ name: l.name, phone: l.phone, email: (l as { email?: string }).email }) } catch {}
  try { for (const l of advisorLeads(o)) all.push({ name: l.name, phone: l.phone, email: (l as { email?: string }).email }) } catch {}
  try { for (const l of agencyLeads(o)) all.push({ name: l.name, phone: l.phone, email: (l as { email?: string }).email }) } catch {}
  for (const l of all) {
    if (!normPhone(l.phone) && !isEmail(normEmail(l.email))) continue
    addContact(o, { name: l.name, phone: l.phone, email: l.email, groups }); added++
  }
  return { added }
}

// گیرندگانِ یک گروه برای یک کانال (email/sms) — مقدارهای آمادهٔ ارسال.
export function recipientsForGroup(o: string, group: string, channel: 'email' | 'sms'): string[] {
  const list = load().contacts[o] || []
  const out = new Set<string>()
  for (const c of list) {
    if (group && group !== '__all' && !c.groups.includes(group)) continue
    if (channel === 'email' && c.forEmail && c.email) out.add(c.email)
    if (channel === 'sms' && c.forSms && c.phone) out.add(c.phone)
  }
  return Array.from(out)
}
