import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { listLeads } from './leads-store'

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
interface DB { contacts: Record<string, Contact[]> }

function id() { return 'ct_' + randomBytes(5).toString('hex') }
function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { contacts: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

const normPhone = (s?: string) => (s || '').replace(/[^\d]/g, '')
const normEmail = (s?: string) => (s || '').trim().toLowerCase()
const isEmail = (s?: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || '')

export function listContacts(o: string): Contact[] {
  return (load().contacts[o] || []).slice().sort((a, b) => b.createdAt - a.createdAt)
}
export function listGroups(o: string): string[] {
  const set = new Set<string>()
  for (const c of load().contacts[o] || []) for (const g of c.groups) if (g) set.add(g)
  return Array.from(set).sort()
}

export function addContact(o: string, input: { name?: string; phone?: string; email?: string; groups?: string[]; forEmail?: boolean; forSms?: boolean }): Contact {
  const db = load()
  const list = db.contacts[o] || (db.contacts[o] = [])
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

// افزودنِ همهٔ لیدهای کاربر (شماره/نام) به دفترچه — گروهِ «لیدها»
export function importFromLeads(o: string): { added: number } {
  let added = 0
  for (const l of listLeads(o)) {
    if (!normPhone(l.phone) && !isEmail(normEmail((l as { email?: string }).email))) continue
    addContact(o, { name: l.name, phone: l.phone, email: (l as { email?: string }).email, groups: ['لیدها'] }); added++
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
