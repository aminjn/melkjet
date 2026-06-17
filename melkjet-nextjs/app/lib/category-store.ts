import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Tiny, dependency-free JSON-file category store, scoped per content type.
// WordPress-like categories: create / rename / delete, used by editors and forms.
// Mirrors the persistence style of crm-store.ts / scraper-store.ts.
const DATA_FILE = join(process.cwd(), '.category-data.json')

// Which content type a category belongs to.
export type CategoryType = 'article' | 'listing' | 'directory' | 'product'

export interface Category {
  id: string
  name: string
  slug: string
  createdAt: number
}

type DB = { [type in CategoryType]?: Category[] }

function id() { return randomBytes(6).toString('hex') }

// Slug from a name — keeps Persian/Arabic letters, swaps spaces for dashes.
function slugify(s: string): string {
  return (s || '').trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w؀-ۿ-]/g, '')
    .replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80) || 'cat'
}

// Sensible Persian defaults, seeded on first load.
const DEFAULTS: { [type in CategoryType]: string[] } = {
  article: ['راهنمای خرید', 'راهنمای اجاره', 'تحلیل بازار', 'سرمایه‌گذاری', 'حقوقی', 'وام و تسهیلات', 'معماری و دکوراسیون', 'اخبار'],
  product: ['مصالح ساختمانی', 'ابزارآلات', 'تأسیسات', 'دکوراسیون'],
  directory: ['مشاور', 'آژانس', 'سازنده', 'حقوقی', 'بیمه'],
  listing: ['آپارتمان', 'ویلا', 'زمین', 'تجاری', 'اداری'],
}

function seed(): DB {
  const now = Date.now()
  const db: DB = {}
  for (const type of Object.keys(DEFAULTS) as CategoryType[]) {
    db[type] = DEFAULTS[type].map((name, i) => ({
      id: id(),
      name,
      slug: slugify(name),
      createdAt: now + i,
    }))
  }
  return db
}

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  const db = seed()
  save(db)
  return db
}

function save(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

export function listCategories(type: CategoryType): Category[] {
  const db = load()
  return (db[type] || []).slice().sort((a, b) => a.createdAt - b.createdAt)
}

export function addCategory(type: CategoryType, name: string): Category {
  const db = load()
  const list = db[type] || (db[type] = [])
  const n = String(name || '').trim().slice(0, 60)
  const cat: Category = { id: id(), name: n, slug: slugify(n), createdAt: Date.now() }
  list.push(cat)
  save(db)
  return cat
}

export function renameCategory(type: CategoryType, catId: string, name: string): Category | null {
  const db = load()
  const cat = (db[type] || []).find(c => c.id === catId)
  if (!cat) return null
  const n = String(name || '').trim().slice(0, 60)
  cat.name = n
  cat.slug = slugify(n)
  save(db)
  return cat
}

export function deleteCategory(type: CategoryType, catId: string): void {
  const db = load()
  db[type] = (db[type] || []).filter(c => c.id !== catId)
  save(db)
}
