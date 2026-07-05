import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

// ── انبارِ آژانس‌های (pro) کشف‌شدهٔ دیوار ──
// هدف: قبل از ساختِ حساب، لینکِ همهٔ صفحه‌های pro دیوار را جمع کنیم (اطلاعاتِ خام).
export interface DivarPro { slug: string; url: string; name?: string; listingCount?: number; city?: string; source: string; firstSeen: number; lastSeen: number }
export interface DiscoveryMeta { running: boolean; startedAt?: number; finishedAt?: number; note?: string; lastFound?: number; lastAdded?: number; scanned?: number }
interface DB { pros: Record<string, DivarPro>; meta: DiscoveryMeta }

const FILE = join(process.cwd(), '.divar-pro-data.json')
const KV = 'divar_pros'
const empty = (): DB => ({ pros: {}, meta: { running: false } })

function fileLoad(): DB { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { pros: d.pros || {}, meta: d.meta || { running: false } } } catch {} } return empty() }
function fileSave(db: DB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV, empty()) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> { if (pgEnabled()) return kvMutate<DB, R>(KV, empty(), fn); const db = fileLoad(); const r = fn(db); fileSave(db); return r }

const cleanSlug = (s: string) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')

// افزودنِ دسته‌ایِ pro‌ها (یک نوشتِ واحد). خروجی = تعدادِ «جدید».
export async function addPros(items: { slug: string; name?: string; listingCount?: number; city?: string; source: string }[]): Promise<number> {
  return mutate(db => {
    const now = Date.now(); let added = 0
    for (const it of items) {
      const slug = cleanSlug(it.slug); if (slug.length < 2) continue
      const ex = db.pros[slug]
      if (ex) { ex.lastSeen = now; if (it.name && !ex.name) ex.name = it.name; if (it.listingCount != null) ex.listingCount = it.listingCount; if (it.city && !ex.city) ex.city = it.city }
      else { db.pros[slug] = { slug, url: `https://divar.ir/pro/${slug}`, name: it.name, listingCount: it.listingCount, city: it.city, source: it.source, firstSeen: now, lastSeen: now }; added++ }
    }
    return added
  })
}

export async function listPros(): Promise<DivarPro[]> {
  return Object.values((await load()).pros).sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0) || (b.lastSeen - a.lastSeen))
}
export async function proStats(): Promise<{ total: number; withCount: number; meta: DiscoveryMeta }> {
  const db = await load()
  const vals = Object.values(db.pros)
  return { total: vals.length, withCount: vals.filter(p => p.listingCount != null).length, meta: db.meta }
}
// وضعیتِ کشف (running) با تایم‌اوتِ کهنگی تا اگر جایی مُرد قفل نماند.
export async function getMeta(): Promise<DiscoveryMeta> {
  const m = (await load()).meta
  if (m.running && m.startedAt && Date.now() - m.startedAt > 20 * 60 * 1000) return { ...m, running: false, note: 'منقضی' }
  return m
}
export async function setMeta(patch: Partial<DiscoveryMeta>): Promise<void> { await mutate(db => { db.meta = { ...db.meta, ...patch } }) }
export async function tryStartMeta(): Promise<boolean> {
  return mutate(db => {
    const m = db.meta
    if (m.running && m.startedAt && Date.now() - m.startedAt < 20 * 60 * 1000) return false
    db.meta = { running: true, startedAt: Date.now(), note: 'در حال کشف…' }
    return true
  })
}
