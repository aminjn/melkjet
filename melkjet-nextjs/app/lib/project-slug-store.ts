import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import { slugify, uniqueSlug } from './slugify'

// نگاشتِ Slug ↔ hashIdِ پروژه (پرشین‌سازه) برای URLهای عمومیِ /projects/{slug}.
const FILE = join(process.cwd(), '.project-slug-data.json')
const KV_KEY = 'project_slugs'
interface SDB { bySlug: Record<string, string>; byHash: Record<string, string> }
const EMPTY: SDB = { bySlug: {}, byHash: {} }

function fileLoad(): SDB { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { bySlug: d.bySlug || {}, byHash: d.byHash || {} } } catch {} } return { bySlug: {}, byHash: {} } }
function fileSave(db: SDB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<SDB> { return pgEnabled() ? await kvGet<SDB>(KV_KEY, EMPTY) : fileLoad() }
async function mutate<R>(fn: (db: SDB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<SDB, R>(KV_KEY, EMPTY, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

export async function ensureProjectSlug(hashId: string, nameFa: string): Promise<string> {
  const h = String(hashId || '').trim(); if (!h) return ''
  const existing = (await load()).byHash[h]
  if (existing) return existing
  return mutate(db => {
    if (db.byHash[h]) return db.byHash[h]
    const base = slugify(nameFa || '') || `porozhe-${h.slice(-6)}`
    const slug = uniqueSlug(base, (s) => !!db.bySlug[s] && db.bySlug[s] !== h)
    db.bySlug[slug] = h; db.byHash[h] = slug
    return slug
  })
}
export async function hashForProjectSlug(slug: string): Promise<string | null> {
  return (await load()).bySlug[String(slug || '').trim().toLowerCase()] || null
}
export async function slugForProjectHash(hashId: string): Promise<string | null> {
  return (await load()).byHash[String(hashId || '').trim()] || null
}
// نگاشتِ کاملِ hashId→slug (فقط‌خواندنی) — برای سایت‌مپ تا به‌ازای هر پروژه یک‌بار load نشود.
export async function allProjectSlugsByHash(): Promise<Record<string, string>> {
  return (await load()).byHash
}
// ساختِ دسته‌ایِ slug در یک نوشتِ واحد (نه یک نوشت به‌ازای هر پروژه) — برای پیش‌محاسبهٔ کرون.
export async function ensureManyProjectSlugs(items: { hashId: string; name: string }[]): Promise<number> {
  return mutate(db => {
    const taken = new Set(Object.keys(db.bySlug))
    let n = 0
    for (const { hashId, name } of items) {
      const h = String(hashId || '').trim(); if (!h || db.byHash[h]) continue
      const base = slugify(name || '') || `porozhe-${h.slice(-6)}`
      const slug = uniqueSlug(base, s => taken.has(s))
      taken.add(slug); db.bySlug[slug] = h; db.byHash[h] = slug; n++
    }
    return n
  })
}
