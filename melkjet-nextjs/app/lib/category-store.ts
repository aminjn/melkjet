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
  parentId?: string   // زیردستهٔ کدام دسته است (خالی = دستهٔ سطحِ‌اول)
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

// slugِ یکتا در دلِ یک لیست (اگر تکراری بود، پسوندِ عددی می‌زند)
function uniqueSlug(list: Category[], want: string, exceptId?: string): string {
  const base = slugify(want)
  let s = base, n = 2
  while (list.some(c => c.slug === s && c.id !== exceptId)) s = `${base}-${n++}`
  return s
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

export function addCategory(type: CategoryType, name: string, opts?: { slug?: string; parentId?: string }): Category {
  const db = load()
  const list = db[type] || (db[type] = [])
  const n = String(name || '').trim().slice(0, 60)
  const parentId = opts?.parentId && list.some(c => c.id === opts.parentId) ? String(opts.parentId) : undefined
  const slug = uniqueSlug(list, opts?.slug ? String(opts.slug) : n)
  const cat: Category = { id: id(), name: n, slug, ...(parentId ? { parentId } : {}), createdAt: Date.now() }
  list.push(cat)
  save(db)
  return cat
}

// ویرایشِ کامل: نام + slug + زیردسته (parent). renameCategory را پوشش می‌دهد.
export function updateCategory(type: CategoryType, catId: string, patch: { name?: string; slug?: string; parentId?: string | null }): Category | null {
  const db = load()
  const list = db[type] || []
  const cat = list.find(c => c.id === catId)
  if (!cat) return null
  if (patch.name !== undefined) cat.name = String(patch.name || '').trim().slice(0, 60)
  if (patch.slug !== undefined && String(patch.slug).trim()) cat.slug = uniqueSlug(list, String(patch.slug), cat.id)
  if (patch.parentId !== undefined) {
    // جلوگیری از حلقه: نمی‌تواند خودش یا یکی از فرزندانش را والد کند
    const pid = patch.parentId ? String(patch.parentId) : ''
    if (!pid) delete cat.parentId
    else if (pid !== cat.id && !isDescendant(list, pid, cat.id)) cat.parentId = pid
  }
  save(db)
  return cat
}

// آیا candidate از فرزندانِ ancestorId است؟ (برای جلوگیری از حلقهٔ والد/فرزند)
function isDescendant(list: Category[], candidateId: string, ancestorId: string): boolean {
  let cur = list.find(c => c.id === candidateId)
  let guard = 0
  while (cur?.parentId && guard++ < 50) {
    if (cur.parentId === ancestorId) return true
    cur = list.find(c => c.id === cur!.parentId)
  }
  return false
}

// back-compat: تغییرِ نام (+ همگام‌سازیِ slug با نامِ جدید)
export function renameCategory(type: CategoryType, catId: string, name: string): Category | null {
  const db = load()
  const cat = (db[type] || []).find(c => c.id === catId)
  if (!cat) return null
  const n = String(name || '').trim().slice(0, 60)
  cat.name = n
  cat.slug = uniqueSlug(db[type] || [], n, cat.id)
  save(db)
  return cat
}

export function deleteCategory(type: CategoryType, catId: string): void {
  const db = load()
  // فرزندان را هم به سطحِ‌بالا منتقل کن تا یتیم نمانند (یا حذف؟ — انتقال امن‌تر است)
  const list = (db[type] || [])
  for (const c of list) if (c.parentId === catId) delete c.parentId
  db[type] = list.filter(c => c.id !== catId)
  save(db)
}

// ── کمکی‌های بلاگ (سرور-ساید) — دسته‌های مقالهٔ سوپرادمین را به مسیریابیِ /blog وصل می‌کند ──
// نامِ فارسیِ دسته → slug (برای URLِ مقاله). فقط سطحِ‌اول (زیردسته‌ها تگ‌اند).
export function articleSlugForName(name?: string): string | null {
  const n = String(name || '').trim(); if (!n) return null
  const cat = (load().article || []).find(c => c.name === n && !c.parentId)
  return cat ? cat.slug : null
}
// slug → دستهٔ مقاله (برای صفحهٔ /blog/[category] که در تاکسونومیِ ثابت نیست).
export function articleCatBySlug(slug: string): Category | null {
  const s = String(slug || '').trim(); if (!s) return null
  return (load().article || []).find(c => c.slug === s && !c.parentId) || null
}
// همهٔ دسته‌های مقالهٔ سطحِ‌اول (برای نقشهٔ سایت + پیمایشِ دسته‌ها).
export function articleTopCategories(): Category[] {
  return (load().article || []).filter(c => !c.parentId).sort((a, b) => a.createdAt - b.createdAt)
}
