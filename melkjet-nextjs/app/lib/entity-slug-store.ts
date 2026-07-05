import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import { slugify, uniqueSlug } from './slugify'

// ── کارخانهٔ عمومیِ نگاشتِ Slug ↔ id برای هر موجودیت (سازنده، محصول، …) ──
// دومَحاله (PG یا فایل)، دقیقاً مثلِ project-slug-store اما قابلِ‌استفادهٔ مجدد.
interface SDB { bySlug: Record<string, string>; byId: Record<string, string> }
const empty = (): SDB => ({ bySlug: {}, byId: {} })

export interface SlugStore {
  ensure(id: string, nameFa: string): Promise<string>
  ensureMany(items: { id: string; name: string }[]): Promise<number>
  idForSlug(slug: string): Promise<string | null>
  slugForId(id: string): Promise<string | null>
  allById(): Promise<Record<string, string>>
}

export function makeSlugStore(fileName: string, kvKey: string, fallbackPrefix: string): SlugStore {
  const FILE = join(process.cwd(), fileName)
  const fileLoad = (): SDB => { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { bySlug: d.bySlug || {}, byId: d.byId || {} } } catch {} } return empty() }
  const fileSave = (db: SDB) => writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8')
  const load = async (): Promise<SDB> => pgEnabled() ? await kvGet<SDB>(kvKey, empty()) : fileLoad()
  const mutate = async <R>(fn: (db: SDB) => R): Promise<R> => { if (pgEnabled()) return kvMutate<SDB, R>(kvKey, empty(), fn); const db = fileLoad(); const r = fn(db); fileSave(db); return r }

  return {
    async ensure(id, nameFa) {
      const k = String(id || '').trim(); if (!k) return ''
      const ex = (await load()).byId[k]; if (ex) return ex
      return mutate(db => {
        if (db.byId[k]) return db.byId[k]
        const base = slugify(nameFa || '') || `${fallbackPrefix}-${k.slice(-6)}`
        const slug = uniqueSlug(base, s => !!db.bySlug[s] && db.bySlug[s] !== k)
        db.bySlug[slug] = k; db.byId[k] = slug
        return slug
      })
    },
    // ساختِ دسته‌ای در «یک نوشتِ واحد» (نه یک نوشت به‌ازای هر آیتم = بدونِ O(n²)).
    async ensureMany(items) {
      const need = items.filter(x => x.id)
      if (!need.length) return 0
      return mutate(db => {
        const taken = new Set(Object.keys(db.bySlug))
        let n = 0
        for (const { id, name } of need) {
          const k = String(id).trim(); if (!k || db.byId[k]) continue
          const base = slugify(name || '') || `${fallbackPrefix}-${k.slice(-6)}`
          const slug = uniqueSlug(base, s => taken.has(s))
          taken.add(slug); db.bySlug[slug] = k; db.byId[k] = slug; n++
        }
        return n
      })
    },
    async idForSlug(slug) { return (await load()).bySlug[String(slug || '').trim().toLowerCase()] || null },
    async slugForId(id) { return (await load()).byId[String(id || '').trim()] || null },
    async allById() { return (await load()).byId },
  }
}
