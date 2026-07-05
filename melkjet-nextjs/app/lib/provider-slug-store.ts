import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import { slugify, uniqueSlug } from './slugify'

// ── نگاشتِ Slug ↔ شمارهٔ متخصص (برای URLهای عمومیِ /{type}/{slug}) ──
// slug یکتا و پایدار از نامِ کسب‌وکار ساخته و ذخیره می‌شود؛ تغییرِ نام، slug را عوض نمی‌کند.
const FILE = join(process.cwd(), '.provider-slug-data.json')
const KV_KEY = 'provider_slugs'
interface SDB { bySlug: Record<string, string>; byPhone: Record<string, string> }
const EMPTY: SDB = { bySlug: {}, byPhone: {} }
const norm = (p: string) => String(p || '').replace(/\D/g, '')

function fileLoad(): SDB { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { bySlug: d.bySlug || {}, byPhone: d.byPhone || {} } } catch {} } return { bySlug: {}, byPhone: {} } }
function fileSave(db: SDB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<SDB> { return pgEnabled() ? await kvGet<SDB>(KV_KEY, EMPTY) : fileLoad() }
async function mutate<R>(fn: (db: SDB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<SDB, R>(KV_KEY, EMPTY, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

// slugِ یک متخصص (اگر نبود می‌سازد و ذخیره می‌کند). پایه = slug نام؛ fallback = آخرِ شماره.
export async function ensureProviderSlug(phone: string, nameFa: string): Promise<string> {
  const ph = norm(phone); if (!ph) return ''
  const existing = (await load()).byPhone[ph]
  if (existing) return existing
  return mutate(db => {
    if (db.byPhone[ph]) return db.byPhone[ph]
    let base = slugify(nameFa || '') || `melk-${ph.slice(-4)}`
    const slug = uniqueSlug(base, (s) => !!db.bySlug[s] && db.bySlug[s] !== ph)
    db.bySlug[slug] = ph; db.byPhone[ph] = slug
    return slug
  })
}
export async function phoneForProviderSlug(slug: string): Promise<string | null> {
  const s = String(slug || '').trim().toLowerCase()
  return (await load()).bySlug[s] || null
}
export async function slugForProviderPhone(phone: string): Promise<string | null> {
  return (await load()).byPhone[norm(phone)] || null
}
