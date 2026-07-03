import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'
import { listLeads as crmLeads } from './leads-store'
import { listLeads as advisorLeads } from './advisor-store'
import { listLeads as agencyLeads } from './agency-store'

// «دفترچهٔ مخاطبین» مارکتینگ — per-owner. دومَحاله: Postgres (اگر DATABASE_URL) وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.contacts-data.json')
const KV_KEY = 'contacts'

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
interface DB { contacts: Record<string, Contact[]>; groups: Record<string, string[]> }
const EMPTY: DB = { contacts: {}, groups: {} }

function id() { return 'ct_' + randomBytes(5).toString('hex') }
function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { const d = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); return { contacts: d.contacts || {}, groups: d.groups || {} } } catch {} } return { contacts: {}, groups: {} } }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { contacts: {}, groups: {} }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { contacts: {}, groups: {} }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}
void EMPTY

const normPhone = (s?: string) => (s || '').replace(/[^\d]/g, '')
const normEmail = (s?: string) => (s || '').trim().toLowerCase()
const isEmail = (s?: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || '')

// نسخهٔ همگامِ محاسبهٔ گروه‌ها از یک DBِ لودشده (برای استفادهٔ داخلی در mutate).
function groupsOf(db: DB, o: string): string[] {
  const set = new Set<string>(db.groups[o] || [])
  for (const c of db.contacts[o] || []) for (const g of c.groups) if (g) set.add(g)
  return Array.from(set).sort()
}

export async function listContacts(o: string): Promise<Contact[]> {
  return ((await load()).contacts[o] || []).slice().sort((a, b) => b.createdAt - a.createdAt)
}
export async function listGroups(o: string): Promise<string[]> {
  return groupsOf(await load(), o)
}
export async function addGroup(o: string, name: string): Promise<string[]> {
  const g = String(name || '').trim()
  return mutate((db) => {
    if (g) { const list = db.groups[o] || (db.groups[o] = []); if (!list.includes(g)) list.push(g) }
    return groupsOf(db, o)
  })
}
export async function deleteGroup(o: string, name: string): Promise<string[]> {
  return mutate((db) => {
    if (db.groups[o]) db.groups[o] = db.groups[o].filter(x => x !== name)
    for (const c of db.contacts[o] || []) c.groups = c.groups.filter(x => x !== name)
    return groupsOf(db, o)
  })
}
export async function assignGroup(o: string, contactIds: string[], group: string, add: boolean): Promise<void> {
  const g = String(group || '').trim(); if (!g) return
  await mutate((db) => {
    const list = db.contacts[o] || []
    const ids = new Set(contactIds)
    for (const c of list) {
      if (!ids.has(c.id)) continue
      if (add) { if (!c.groups.includes(g)) c.groups.push(g) }
      else c.groups = c.groups.filter(x => x !== g)
    }
    if (add && !(db.groups[o] || []).includes(g)) (db.groups[o] || (db.groups[o] = [])).push(g)
  })
}

export async function addContact(o: string, input: { name?: string; phone?: string; email?: string; groups?: string[]; forEmail?: boolean; forSms?: boolean }): Promise<Contact> {
  return mutate((db) => {
    const list = db.contacts[o] || (db.contacts[o] = [])
    for (const g of (input.groups || []).filter(Boolean)) { const gl = db.groups[o] || (db.groups[o] = []); if (!gl.includes(g)) gl.push(g) }
    const phone = normPhone(input.phone)
    const email = normEmail(input.email)
    const existing = list.find(c => (phone && normPhone(c.phone) === phone) || (email && normEmail(c.email) === email))
    if (existing) {
      if (input.name && !existing.name) existing.name = input.name
      if (phone && !existing.phone) existing.phone = input.phone
      if (email && !existing.email) existing.email = input.email
      if (input.groups) existing.groups = Array.from(new Set([...existing.groups, ...input.groups.filter(Boolean)]))
      if (input.forEmail !== undefined) existing.forEmail = input.forEmail
      if (input.forSms !== undefined) existing.forSms = input.forSms
      return existing
    }
    const c: Contact = {
      id: id(), name: String(input.name || '').trim() || (input.phone || email || 'مخاطب'),
      phone: phone ? input.phone : undefined, email: isEmail(email) ? email : undefined,
      groups: (input.groups || []).filter(Boolean),
      forEmail: input.forEmail !== undefined ? input.forEmail : isEmail(email),
      forSms: input.forSms !== undefined ? input.forSms : !!phone,
      createdAt: Date.now(),
    }
    list.unshift(c); return c
  })
}

export async function updateContact(o: string, cid: string, patch: Partial<Contact>): Promise<Contact | null> {
  return mutate((db) => {
    const c = (db.contacts[o] || []).find(x => x.id === cid); if (!c) return null
    if (patch.name !== undefined) c.name = String(patch.name)
    if (patch.phone !== undefined) c.phone = patch.phone || undefined
    if (patch.email !== undefined) c.email = patch.email || undefined
    if (patch.groups !== undefined) c.groups = patch.groups.filter(Boolean)
    if (patch.forEmail !== undefined) c.forEmail = !!patch.forEmail
    if (patch.forSms !== undefined) c.forSms = !!patch.forSms
    return c
  })
}
export async function deleteContact(o: string, cid: string): Promise<void> {
  await mutate((db) => { if (db.contacts[o]) db.contacts[o] = db.contacts[o].filter(c => c.id !== cid) })
}

// ایمپورتِ گروهی (مثلاً از CSV): هر سطر name, phone, email
export async function bulkAddContacts(o: string, rows: { name?: string; phone?: string; email?: string }[], groups: string[] = []): Promise<{ added: number; skipped: number }> {
  let added = 0, skipped = 0
  for (const r of rows) {
    if (!normPhone(r.phone) && !isEmail(normEmail(r.email))) { skipped++; continue }
    await addContact(o, { ...r, groups }); added++
  }
  return { added, skipped }
}

// افزودنِ همهٔ لیدهای کاربر به دفترچه — از همهٔ منابعِ لید (CRM، مشاور، آژانس) — گروهِ «لیدها»
export async function importFromLeads(o: string, group?: string): Promise<{ added: number }> {
  let added = 0
  const groups = [group && group.trim() ? group.trim() : 'لیدها']
  const all: { name?: string; phone?: string; email?: string }[] = []
  try { for (const l of await crmLeads(o)) all.push({ name: l.name, phone: l.phone, email: (l as { email?: string }).email }) } catch {}
  try { for (const l of await advisorLeads(o)) all.push({ name: l.name, phone: l.phone, email: (l as { email?: string }).email }) } catch {}
  try { for (const l of await agencyLeads(o)) all.push({ name: l.name, phone: l.phone, email: (l as { email?: string }).email }) } catch {}
  for (const l of all) {
    if (!normPhone(l.phone) && !isEmail(normEmail(l.email))) continue
    await addContact(o, { name: l.name, phone: l.phone, email: l.email, groups }); added++
  }
  return { added }
}

// گیرندگانِ یک گروه برای یک کانال (email/sms) — مقدارهای آمادهٔ ارسال.
export async function recipientsForGroup(o: string, group: string, channel: 'email' | 'sms'): Promise<string[]> {
  const list = (await load()).contacts[o] || []
  const out = new Set<string>()
  for (const c of list) {
    if (group && group !== '__all' && !c.groups.includes(group)) continue
    if (channel === 'email' && c.forEmail && c.email) out.add(c.email)
    if (channel === 'sms' && c.forSms && c.phone) out.add(c.phone)
  }
  return Array.from(out)
}
