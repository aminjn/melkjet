import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// کاتالوگِ مرجعِ مصالح — دسته‌بندی‌ها و کالاهای «رسمی» که ادمین می‌سازد (یا از هایپرساز
// اسکرپ می‌شود). مصالح‌فروش‌ها فقط از همین لیست انتخاب می‌کنند تا نام/دسته‌ها یکدست
// بماند (وگرنه تجمیعِ نرخِ روز و دایرکتوری به‌هم می‌ریزد).
const FILE = join(process.cwd(), '.catalog-data.json')

export interface CatalogSpec { key: string; value: string }
export interface PricePoint { date: string; price: number }
export interface CatalogCategory { id: string; name: string; parentId?: string; order: number; active: boolean; createdAt: number }
export interface CatalogProduct {
  id: string; categoryId: string; name: string
  brand?: string; unit?: string; image?: string; description?: string
  specs?: CatalogSpec[]; tags?: string[]; priceHistory?: PricePoint[]
  source: string   // 'manual' یا شناسهٔ منبعِ اسکرپ (hypersaz، ahanonline، …)
  externalId?: string; externalUrl?: string
  active: boolean; createdAt: number
}
interface DB { categories: CatalogCategory[]; products: CatalogProduct[] }

function id(p = '') { return p + randomBytes(5).toString('hex') }
function load(): DB {
  if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { categories: d.categories || [], products: d.products || [] } } catch {} }
  return { categories: [], products: [] }
}
function save(db: DB) { try { writeFileSync(FILE, JSON.stringify(db)) } catch {} }
function norm(s: string) { return (s || '').replace(/‌/g, '').replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim() }

// ── دسته‌بندی‌ها ──
export function listCategories(activeOnly = false): CatalogCategory[] {
  const cats = load().categories.slice().sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  return activeOnly ? cats.filter(c => c.active) : cats
}
export function addCategory(input: { name: string; parentId?: string; order?: number }): CatalogCategory {
  const db = load()
  const c: CatalogCategory = { id: id('c_'), name: String(input.name).slice(0, 80), parentId: input.parentId || undefined, order: input.order ?? db.categories.length, active: true, createdAt: Date.now() }
  db.categories.push(c); save(db); return c
}
export function updateCategory(cid: string, patch: Partial<Pick<CatalogCategory, 'name' | 'parentId' | 'order' | 'active'>>): CatalogCategory | null {
  const db = load(); const c = db.categories.find(x => x.id === cid); if (!c) return null
  if (patch.name !== undefined) c.name = String(patch.name).slice(0, 80)
  if (patch.parentId !== undefined) c.parentId = patch.parentId || undefined
  if (patch.order !== undefined) c.order = Number(patch.order) || 0
  if (patch.active !== undefined) c.active = !!patch.active
  save(db); return c
}
export function deleteCategory(cid: string) {
  const db = load()
  db.categories = db.categories.filter(c => c.id !== cid)
  db.products = db.products.filter(p => p.categoryId !== cid)   // کالاهای دستهٔ حذف‌شده هم بروند
  save(db)
}
// یافتنِ دسته با نام (برای ادغامِ اسکرپ). ایجاد اگر نبود.
export function ensureCategory(name: string, parentId?: string): CatalogCategory {
  const db = load()
  const n = norm(name)
  const found = db.categories.find(c => norm(c.name) === n && (c.parentId || '') === (parentId || ''))
  if (found) return found
  const c: CatalogCategory = { id: id('c_'), name: String(name).slice(0, 80), parentId: parentId || undefined, order: db.categories.length, active: true, createdAt: Date.now() }
  db.categories.push(c); save(db); return c
}

// ── کالاها ──
function cleanProduct(input: any): Partial<CatalogProduct> {
  const out: any = {}
  if (input.name !== undefined) out.name = String(input.name).slice(0, 160)
  if (input.categoryId !== undefined) out.categoryId = String(input.categoryId)
  if (input.brand !== undefined) out.brand = String(input.brand).slice(0, 80)
  if (input.unit !== undefined) out.unit = String(input.unit).slice(0, 24)
  if (input.image !== undefined) out.image = String(input.image).slice(0, 100000)
  if (input.description !== undefined) out.description = String(input.description).slice(0, 4000)
  if (input.externalId !== undefined) out.externalId = String(input.externalId).slice(0, 120)
  if (input.externalUrl !== undefined) out.externalUrl = String(input.externalUrl).slice(0, 400)
  if (input.active !== undefined) out.active = !!input.active
  if (Array.isArray(input.tags)) out.tags = input.tags.slice(0, 20).map((s: any) => String(s).slice(0, 40)).filter(Boolean)
  if (Array.isArray(input.specs)) out.specs = input.specs.slice(0, 40).map((s: any) => ({ key: String(s.key || '').slice(0, 60), value: String(s.value || '').slice(0, 120) })).filter((s: CatalogSpec) => s.key && s.value)
  return out
}
export function listProducts(opts?: { categoryId?: string; search?: string; activeOnly?: boolean }): CatalogProduct[] {
  let ps = load().products
  if (opts?.activeOnly) ps = ps.filter(p => p.active)
  if (opts?.categoryId) ps = ps.filter(p => p.categoryId === opts.categoryId)
  if (opts?.search) { const q = norm(opts.search); ps = ps.filter(p => norm(p.name).includes(q) || norm(p.brand || '').includes(q)) }
  return ps.slice().sort((a, b) => b.createdAt - a.createdAt)
}
export function getProduct(pid: string): CatalogProduct | null { return load().products.find(p => p.id === pid) || null }
// مسیرِ دسته (والد→…→برگ) برای نمایشِ breadcrumb در صفحهٔ محصول.
export function categoryBreadcrumb(categoryId: string): { id: string; name: string }[] {
  const cats = load().categories
  const out: { id: string; name: string }[] = []
  let cur = cats.find(c => c.id === categoryId)
  let guard = 0
  while (cur && guard++ < 6) { out.unshift({ id: cur.id, name: cur.name }); cur = cur.parentId ? cats.find(c => c.id === cur!.parentId) : undefined }
  return out
}
// چند محصولِ مرتبط (هم‌دسته) برای بخشِ «محصولاتِ مشابه».
export function relatedProducts(categoryId: string, excludeId: string, n = 8): CatalogProduct[] {
  return load().products.filter(p => p.active && p.categoryId === categoryId && p.id !== excludeId).slice(0, n)
}
export function addProduct(input: any): CatalogProduct {
  const db = load()
  const c = cleanProduct(input)
  const p: CatalogProduct = {
    id: id('cp_'), categoryId: c.categoryId || '', name: c.name || '', brand: c.brand, unit: c.unit,
    image: c.image, description: c.description, specs: c.specs, tags: c.tags,
    source: input.source && input.source !== 'manual' ? String(input.source) : 'manual', externalId: c.externalId, externalUrl: c.externalUrl,
    active: c.active ?? true, createdAt: Date.now(),
  }
  db.products.unshift(p); save(db); return p
}
export function updateProduct(pid: string, patch: any): CatalogProduct | null {
  const db = load(); const p = db.products.find(x => x.id === pid); if (!p) return null
  Object.assign(p, cleanProduct(patch)); save(db); return p
}
export function deleteProduct(pid: string) { const db = load(); db.products = db.products.filter(p => p.id !== pid); save(db) }

// ادغامِ نتیجهٔ اسکرپ: بر اساسِ externalId (source=hypersaz) به‌روزرسانی یا افزودن.
// مسیرِ دسته‌ها را سلسله‌مراتبی می‌سازد (والد→زیردسته) و عمیق‌ترین دسته را برمی‌گرداند.
function ensureCategoryPathInDb(db: DB, path: string[]): CatalogCategory | null {
  let parentId: string | undefined = undefined
  let cat: CatalogCategory | null = null
  for (const rawName of path) {
    const name = String(rawName).trim(); if (!name) continue
    const n = norm(name)
    let found = db.categories.find(c => norm(c.name) === n && (c.parentId || '') === (parentId || ''))
    if (!found) { found = { id: id('c_'), name: name.slice(0, 80), parentId, order: db.categories.length, active: true, createdAt: Date.now() }; db.categories.push(found) }
    parentId = found.id; cat = found
  }
  return cat
}

// پاک‌کردنِ دسته‌جمعی — «scraped» فقط اسکرپ‌شده‌ها، «all» همه‌چیز.
// scope: 'all' (همه) | 'scraped' (همهٔ اسکرپ‌شده‌ها، دستی می‌ماند) | یک شناسهٔ منبع (مثلِ 'ahanonline')
export function clearCatalog(scope: string): { products: number; categories: number } {
  const db = load()
  const pBefore = db.products.length, cBefore = db.categories.length
  if (scope === 'all') { db.products = []; db.categories = [] }
  else {
    if (scope === 'scraped') db.products = db.products.filter(p => p.source === 'manual')
    else db.products = db.products.filter(p => p.source !== scope)   // فقط همان منبع
    // دسته‌هایی که دیگر نه محصولی دارند نه زیردسته‌ای، حذف شوند.
    const usedCat = new Set(db.products.map(p => p.categoryId))
    const hasChild = new Set(db.categories.filter(c => c.parentId).map(c => c.parentId!))
    db.categories = db.categories.filter(c => usedCat.has(c.id) || hasChild.has(c.id))
  }
  save(db)
  return { products: pBefore - db.products.length, categories: cBefore - db.categories.length }
}

export function upsertScraped(items: { name: string; categoryName?: string; categoryPath?: string[]; brand?: string; unit?: string; image?: string; description?: string; specs?: CatalogSpec[]; priceHistory?: PricePoint[]; externalId?: string; externalUrl?: string }[], source = 'hypersaz'): { added: number; updated: number } {
  let added = 0, updated = 0
  const db = load()
  for (const it of items) {
    if (!it.name) continue
    const cat = (it.categoryPath && it.categoryPath.length ? ensureCategoryPathInDb(db, it.categoryPath) : null) || ensureCategoryInDb(db, it.categoryName || 'دسته‌بندی‌نشده')
    const ext = it.externalId ? String(it.externalId) : ''
    let existing = ext ? db.products.find(p => p.source === source && p.externalId === ext) : undefined
    if (!existing) existing = db.products.find(p => p.source === source && norm(p.name) === norm(it.name))
    if (existing) {
      existing.categoryId = cat.id; existing.name = it.name.slice(0, 160)
      if (it.brand) existing.brand = it.brand.slice(0, 80)
      if (it.unit) existing.unit = it.unit.slice(0, 24)
      if (it.image) existing.image = it.image.slice(0, 100000)
      if (it.description) existing.description = it.description.slice(0, 4000)
      if (it.specs?.length) existing.specs = it.specs.slice(0, 40)
      if (it.priceHistory?.length) existing.priceHistory = it.priceHistory.slice(0, 40)
      if (it.externalUrl) existing.externalUrl = it.externalUrl
      updated++
    } else {
      db.products.unshift({
        id: id('cp_'), categoryId: cat.id, name: it.name.slice(0, 160), brand: it.brand?.slice(0, 80),
        unit: it.unit?.slice(0, 24), image: it.image?.slice(0, 100000), description: it.description?.slice(0, 4000),
        specs: it.specs?.slice(0, 40), priceHistory: it.priceHistory?.slice(0, 40),
        source, externalId: ext || undefined, externalUrl: it.externalUrl,
        active: true, createdAt: Date.now(),
      })
      added++
    }
  }
  save(db)
  return { added, updated }
}
function ensureCategoryInDb(db: DB, name: string): CatalogCategory {
  const n = norm(name)
  const found = db.categories.find(c => norm(c.name) === n)
  if (found) return found
  const c: CatalogCategory = { id: id('c_'), name: String(name).slice(0, 80), order: db.categories.length, active: true, createdAt: Date.now() }
  db.categories.push(c); return c
}

// نرخِ مرجعِ کالاها (از دادهٔ اسکرپ‌شده) — قیمتِ آخر + روند + اسپارک‌لاین، همه به تومان.
export function referencePriceIndex(opts?: { category?: string; search?: string }) {
  const db = load()
  const catName = (id: string) => db.categories.find(c => c.id === id)?.name || ''
  const toToman = (rial: number) => Math.round(rial / 10)
  let rows = db.products.filter(p => p.active && p.priceHistory && p.priceHistory.length > 0).map(p => {
    const ph = p.priceHistory!
    const last = toToman(ph[ph.length - 1].price)
    const first = toToman(ph[0].price)
    const changePct = first ? Math.round(((last - first) / first) * 100) : 0
    return { id: p.id, name: p.name, image: p.image || '', brand: p.brand || '', category: catName(p.categoryId), unit: p.unit || '', price: last, changePct, spark: ph.slice(-14).map(x => toToman(x.price)), updatedAt: ph[ph.length - 1].date, source: p.source }
  })
  if (opts?.category && opts.category !== 'همه') { const g = norm(opts.category); rows = rows.filter(r => norm(r.category).includes(g)) }
  if (opts?.search) { const q = norm(opts.search); rows = rows.filter(r => norm(r.name).includes(q) || norm(r.brand).includes(q)) }
  rows.sort((a, b) => norm(a.category).localeCompare(norm(b.category)) || b.price - a.price)
  const categories = Array.from(new Set(db.products.filter(p => p.active && p.priceHistory?.length).map(p => catName(p.categoryId)).filter(Boolean)))
  return { rows: rows.slice(0, 600), categories, count: rows.length }
}

export function catalogStats() {
  const db = load()
  const bySource: Record<string, number> = {}
  for (const p of db.products) bySource[p.source] = (bySource[p.source] || 0) + 1
  return { categories: db.categories.length, products: db.products.length, manual: bySource['manual'] || 0, bySource }
}
