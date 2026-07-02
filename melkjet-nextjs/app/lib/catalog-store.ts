import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// کاتالوگِ مرجعِ مصالح — دسته‌بندی‌ها و کالاهای «رسمی» که ادمین می‌سازد (یا از هایپرساز
// اسکرپ می‌شود). مصالح‌فروش‌ها فقط از همین لیست انتخاب می‌کنند تا نام/دسته‌ها یکدست
// بماند (وگرنه تجمیعِ نرخِ روز و دایرکتوری به‌هم می‌ریزد).
const FILE = join(process.cwd(), '.catalog-data.json')

export interface CatalogSpec { key: string; value: string }
export interface PricePoint { date: string; price: number }
export interface CatalogCategory { id: string; name: string; parentId?: string; order: number; active: boolean; createdAt: number; image?: string }
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
// نامِ سایت/منبع یا آیتمِ ناوبری (breadcrumb) — دسته نیست؛ بچه‌هایش بالا می‌روند.
const JUNK_SITE = /^(صفحه\s*اصلی|خانه|home|فروشگاه|فروشگاه\s*اینترنتی|آهن\s*آنلاین|هایپرساز|ahanonline|hypersaz|قیمت\s*روز|قیمت\s*آهن(\s*آلات)?|لیست\s*قیمت|محصولات|همه\s*محصولات|دسته\s*بندی(\s*ها)?)$/i
// محتوایی (مجله/بلاگ/فیلم/آموزش/درباره…) — اصلاً محصول نیست؛ کلِ شاخه و محصولاتش حذف می‌شوند.
const JUNK_CONTENT = /(^|\s|«)(مجله|بلاگ|وبلاگ|مقالات?|اخبار|خبر(نامه|ها)?|فیلم|ویدی?و|آموزش|راهنما(ی)?|پرسش|سوالات|پرسش‌?های\s*متداول|درباره|تماس|حریم\s*خصوصی|قوانین|سبد\s*خرید|حساب\s*کاربری|blog|news|magazine|video|article|faq|about|contact)(\s|$|»)/i
export function isJunkCategory(name: string): boolean { const n = norm(name); return JUNK_SITE.test(n) || JUNK_CONTENT.test(n) }

// حدسِ دستهٔ منطقی از نامِ محصول (وقتی مسیرِ دسته خالی است) تا «دسته‌بندی‌نشده» انباشته نشود.
const CAT_GUESS: [RegExp, string][] = [
  [/میلگرد/, 'میلگرد'], [/تیر\s*آهن|هاش|IPE|INP/i, 'تیرآهن'], [/ناودانی/, 'ناودانی'], [/نبشی/, 'نبشی'],
  [/قوطی|پروفیل/, 'قوطی و پروفیل'], [/لوله/, 'لوله'], [/ورق/, 'ورق'], [/سیم\s*جوش|الکترود|مفتول/, 'مصالح جوشکاری'],
  [/توری|رابیتس|مش\b|شبکه\s*جوش/, 'توری و رابیتس'], [/اتصالات|فلنج|زانو|بوشن|سه\s*راه|مغزی/, 'اتصالات'],
  [/پیچ|مهره|بولت/, 'پیچ و مهره'], [/صفحه\s*ستون|صفحه\s*سنگ|گریتینگ|تیرچه/, 'صفحات و سازهٔ فلزی'],
  [/استنلس|استیل/, 'استنلس استیل'], [/سیمان/, 'سیمان'], [/گچ/, 'گچ'], [/کاشی|سرامیک/, 'کاشی و سرامیک'],
  [/رنگ/, 'رنگ'], [/چسب/, 'چسب'], [/کابل|سیم\s*برق/, 'برق'],
]
export function guessCategory(name: string): string {
  const n = norm(name)
  for (const [re, cat] of CAT_GUESS) if (re.test(n)) return cat
  return ''
}
// «برند»هایی که در واقع کشورِ مبدأ هستند (مبدا برندِ هایپرساز) نه برند — باید حذف شوند.
const COUNTRIES = new Set(['ایران', 'آلمان', 'چین', 'بلژیک', 'ایتالیا', 'تایوان', 'ترکیه', 'کرهجنوبی', 'کره', 'ژاپن', 'فرانسه', 'اسپانیا', 'هند', 'امارات', 'روسیه', 'اوکراین', 'انگلیس', 'اتریش', 'سوئد', 'سوئیس', 'لهستان', 'ویتنام', 'مالزی', 'ایرانایتالیا', 'ایرانآلمان', 'ایرانچین'])
export function sanitizeBrand(b?: string): string | undefined {
  if (!b) return undefined
  const n = norm(b)
  if (!n) return undefined
  // برند/کارخانه یک اسمِ کوتاه است، نه جمله/توضیح. اگر بلند یا جمله‌گونه بود، برند نیست.
  if (n.length > 28 || n.split(/\s+/).length > 4) return undefined
  if (/[.!؟?:؛]|بنابراین|هستند|دارد|می\s*باشد|معروف|کیفیت|مرغوب|مختلف|بهترین|انواع|برخوردار|تفاوت/.test(n)) return undefined
  // اگر همهٔ اجزای برند کشور باشند (مثلِ «ایران» یا «ایران-ایتالیا») برند نیست
  const parts = n.split(/[-,،\/]+/).map(s => s.replace(/\s+/g, '')).filter(Boolean)
  if (parts.length && parts.every(p => COUNTRIES.has(p))) return undefined
  if (COUNTRIES.has(n.replace(/\s+/g, ''))) return undefined
  return b.trim()
}
// نام‌هایی که در واقع مقاله/صفحهٔ محتوایی‌اند نه محصول
export function looksLikeArticle(name: string): boolean {
  const n = norm(name)
  return JUNK_CONTENT.test(n) || /(^|\s)(چیست|چگونه|چطور|جدیدترین|معرفی|نحوهٔ?|روشِ?|بررسی|مقایسهٔ?|آشنایی|همه\s*چیز\s*درباره|راهنمای\s*خرید)(\s|$)/.test(n)
}
// مشخصاتِ زبالهٔ اسکرپ (سرستونِ قیمت/تاریخ/نمودار که اشتباهی مشخصه ثبت شده‌اند)
const SPEC_BAD = /قیمت|نمودار|عملیات|نوسان|تغییر|تاریخ|price|date|تومان|ریال|درصد/i
export function sanitizeSpecs(specs?: CatalogSpec[]): CatalogSpec[] | undefined {
  if (!specs || !specs.length) return specs
  const out = specs.filter(s => s && s.key && s.value && !SPEC_BAD.test(s.key) && !SPEC_BAD.test(s.value))
  return out.length ? out : undefined
}

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
export function deleteCategory(cid: string): { categories: number; products: number } {
  const db = load()
  const ids = descendantsOf(db.categories, cid)   // دسته + همهٔ زیردسته‌ها
  const cBefore = db.categories.length, pBefore = db.products.length
  db.categories = db.categories.filter(c => !ids.has(c.id))
  db.products = db.products.filter(p => !ids.has(p.categoryId))   // کالاهای این دسته و زیردسته‌ها هم بروند
  save(db)
  return { categories: cBefore - db.categories.length, products: pBefore - db.products.length }
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
  if (Array.isArray(input.specs)) out.specs = sanitizeSpecs(input.specs.slice(0, 40).map((s: any) => ({ key: String(s.key || '').slice(0, 60), value: String(s.value || '').slice(0, 120) })).filter((s: CatalogSpec) => s.key && s.value)) || []
  return out
}
export function listProducts(opts?: { categoryId?: string; search?: string; activeOnly?: boolean }): CatalogProduct[] {
  let ps = load().products
  if (opts?.activeOnly) ps = ps.filter(p => p.active)
  if (opts?.categoryId) ps = ps.filter(p => p.categoryId === opts.categoryId)
  if (opts?.search) { const q = norm(opts.search); ps = ps.filter(p => norm(p.name).includes(q) || norm(p.brand || '').includes(q)) }
  return ps.slice().sort((a, b) => b.createdAt - a.createdAt)
}
export function getProduct(pid: string): CatalogProduct | null {
  const p = load().products.find(p => p.id === pid) || null
  if (p) p.specs = sanitizeSpecs(p.specs)   // پاک‌سازیِ مشخصاتِ زباله هنگامِ نمایش (بدونِ تغییرِ فایل)
  return p
}

// ── عکسِ دسته (تولیدِ AI برای کالاهایِ بدونِ عکس مثلِ آهن‌آنلاین) ──
// دسته‌هایی که محصولِ بدونِ عکس دارند و خودشان هم عکسِ AI ندارند.
export function categoriesNeedingImage(): CatalogCategory[] {
  const db = load()
  const noImgCats = new Set(db.products.filter(p => p.active && !p.image).map(p => p.categoryId))
  return db.categories.filter(c => noImgCats.has(c.id) && !c.image)
}
// عکسِ تولیدشده را روی دسته می‌نشاند و به همهٔ محصولاتِ بدونِ عکسِ همان دسته می‌دهد.
export function setCategoryImage(categoryId: string, url: string): number {
  const db = load(); const cat = db.categories.find(c => c.id === categoryId); if (!cat) return 0
  cat.image = url; let n = 0
  for (const p of db.products) if (p.categoryId === categoryId && !p.image) { p.image = url; n++ }
  save(db); return n
}
// ── تولیدِ دسته‌جمعیِ عکسِ محصولات با AI (به‌ازای هر دسته یک عکس، روی محصولاتِ آن دسته) ──
function srcMatch(p: CatalogProduct, source?: string) {
  if (!source || source === 'all') return true
  return source === 'scraped' ? p.source !== 'manual' : p.source === source
}
// فهرستِ دسته‌های هدف برای تولیدِ عکس. mode='missing' فقط دسته‌هایی که محصولِ بدونِ عکس دارند،
// mode='all' همهٔ دسته‌های دارای محصول (برای جایگزینیِ عکس‌های خراب/اشتباه).
export function imageGenTargets(mode: 'missing' | 'all', scope?: { source?: string; category?: string }): { id: string; name: string; count: number }[] {
  const db = load()
  const catIds = scope?.category ? descendantsOf(db.categories, scope.category) : null
  const rel = db.products.filter(p => p.active && srcMatch(p, scope?.source) && (!catIds || catIds.has(p.categoryId)))
  const counter = new Map<string, number>()
  for (const p of rel) { if (mode === 'all' || !p.image) counter.set(p.categoryId, (counter.get(p.categoryId) || 0) + 1) }
  return db.categories.filter(c => counter.has(c.id)).map(c => ({ id: c.id, name: c.name, count: counter.get(c.id) || 0 }))
}
// نشاندنِ عکس روی محصولاتِ یک دسته. replace=true همه را بازنویسی می‌کند، وگرنه فقط بدونِ عکس.
export function applyCategoryImage(categoryId: string, url: string, opts?: { replace?: boolean; source?: string }): number {
  const db = load(); const cat = db.categories.find(c => c.id === categoryId); if (!cat || !url) return 0
  cat.image = url; let n = 0
  for (const p of db.products) {
    if (p.categoryId !== categoryId || !srcMatch(p, opts?.source)) continue
    if (opts?.replace || !p.image) { p.image = url; n++ }
  }
  save(db); return n
}
// مسیرِ دسته (والد→…→برگ) برای نمایشِ breadcrumb در صفحهٔ محصول.
export function categoryBreadcrumb(categoryId: string): { id: string; name: string }[] {
  const cats = load().categories
  const out: { id: string; name: string }[] = []
  let cur = cats.find(c => c.id === categoryId)
  let guard = 0
  while (cur && guard++ < 6) { if (!isJunkCategory(cur.name)) out.unshift({ id: cur.id, name: cur.name }); cur = cur.parentId ? cats.find(c => c.id === cur!.parentId) : undefined }
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
// حذفِ چند محصولِ انتخاب‌شده با شناسه
export function deleteProducts(ids: string[]): number {
  const set = new Set(ids); const db = load(); const before = db.products.length
  db.products = db.products.filter(p => !set.has(p.id)); save(db)
  return before - db.products.length
}
// نشاندنِ یک تصویر (لوگو) یا حذفِ عکس روی محصولاتِ یک محدوده (منبع/دسته) — بدونِ AI، آنی.
export function setImagesForScope(opts: { source?: string; category?: string }, url: string): number {
  const db = load(); const catIds = opts.category ? descendantsOf(db.categories, opts.category) : null
  let n = 0
  for (const p of db.products) {
    if (!srcMatch(p, opts.source)) continue
    if (catIds && !catIds.has(p.categoryId)) continue
    p.image = url || undefined; n++
  }
  save(db); return n
}

// ── مدیریتِ تصویر ──
// شمارشِ استفادهٔ یک URLِ تصویر (برای تشخیصِ عکسِ اشتباهِ مشترک مثلِ بنر/عکسِ شخص).
export function countImageUsage(url: string): number { if (!url) return 0; return load().products.filter(p => p.image === url).length }
// پاک‌کردنِ یک تصویرِ مشخص از همهٔ محصولات + دسته‌ها (تا دوباره پخش نشود).
export function clearImageEverywhere(url: string): number {
  if (!url) return 0
  const db = load(); let n = 0
  for (const p of db.products) if (p.image === url) { p.image = undefined; n++ }
  for (const c of db.categories) if (c.image === url) c.image = undefined
  if (n) save(db); return n
}

// ── تکمیلِ AI: محصولاتِ اسکرپ‌شده‌ای که توضیحات یا مشخصاتِ فنیِ کافی ندارند ──
function specCount(p: CatalogProduct) { return (sanitizeSpecs(p.specs) || []).length }
function lacksText(p: CatalogProduct) { return (!p.description || p.description.trim().length < 20) || specCount(p) < 3 }
export function productsNeedingEnrich(source?: string, limit = 0): CatalogProduct[] {
  const db = load()
  const rows = db.products.filter(p => p.active && (source ? p.source === source : p.source !== 'manual') && lacksText(p))
  return limit > 0 ? rows.slice(0, limit) : rows
}
// فقط جاهای خالی را پُر می‌کند (توضیح/مشخصاتِ موجود دست‌نخورده می‌ماند) → «یک‌بار» تولید.
export function setProductEnrichment(pid: string, patch: { description?: string; specs?: CatalogSpec[] }): boolean {
  const db = load(); const p = db.products.find(x => x.id === pid); if (!p) return false
  let changed = false
  if (patch.description && (!p.description || p.description.trim().length < 20)) { p.description = String(patch.description).slice(0, 4000); changed = true }
  const existing = sanitizeSpecs(p.specs) || []
  if (patch.specs?.length && existing.length < 6) {
    const clean = (sanitizeSpecs(patch.specs.slice(0, 40).map(s => ({ key: String(s.key || '').slice(0, 60), value: String(s.value || '').slice(0, 120) }))) || []).filter(s => s.key && s.value)
    const keys = new Set(existing.map(s => norm(s.key)))
    const merged = [...existing, ...clean.filter(s => !keys.has(norm(s.key)))].slice(0, 40)
    if (merged.length > existing.length) { p.specs = merged; changed = true }
  } else if (existing.length !== (p.specs || []).length) { p.specs = existing; changed = true }
  if (changed) save(db)
  return changed
}
// ── تاریخچهٔ قیمت (نمودار): محصولاتی که صفحهٔ اختصاصی دارند ولی هنوز نمودار (≥۲ نقطه) ندارند ──
export function productsNeedingChart(source: string, limit = 0): { id: string; url: string }[] {
  const db = load()
  const rows = db.products.filter(p => p.active && p.source === source && (p.externalUrl && /\/product\//i.test(p.externalUrl)) && !(p.priceHistory && p.priceHistory.length >= 2))
    .map(p => ({ id: p.id, url: p.externalUrl! }))
  return limit > 0 ? rows.slice(0, limit) : rows
}
// جای‌گذاریِ تاریخچهٔ قیمتِ نمودار (با نرمال‌سازیِ واحد نسبت به آخرین قیمتِ ریالیِ موجود).
export function setProductPriceHistory(pid: string, points: PricePoint[]): boolean {
  if (!points || points.length < 2) return false
  const db = load(); const p = db.products.find(x => x.id === pid); if (!p) return false
  let pts = points.filter(x => x && x.price > 0)
  const existingLast = p.priceHistory?.length ? p.priceHistory[p.priceHistory.length - 1].price : 0
  if (existingLast > 0) {
    const ratio = pts[pts.length - 1].price / existingLast
    if (ratio > 0.05 && ratio < 0.2) pts = pts.map(x => ({ date: x.date, price: x.price * 10 })) // تومان → ریال
  }
  if (pts.length >= 2 && pts.length >= (p.priceHistory?.length || 0)) { p.priceHistory = pts.slice(-60); save(db); return true }
  return false
}
export function chartStats(source: string): { total: number; needing: number } {
  const db = load()
  const rows = db.products.filter(p => p.active && p.source === source && p.externalUrl && /\/product\//i.test(p.externalUrl))
  return { total: rows.length, needing: rows.filter(p => !(p.priceHistory && p.priceHistory.length >= 2)).length }
}
export function enrichStats(source?: string): { total: number; needing: number } {
  const db = load()
  const scraped = db.products.filter(p => p.active && (source ? p.source === source : p.source !== 'manual'))
  return { total: scraped.length, needing: scraped.filter(lacksText).length }
}

// ── حذفِ دسته‌جمعی با فیلترِ چندحالته ──
export interface BulkDeleteFilter { source?: string; category?: string; search?: string; brand?: string; missing?: string[] }
function matchesBulk(p: CatalogProduct, f: BulkDeleteFilter, catIds: Set<string> | null): boolean {
  if (f.source === 'scraped') { if (p.source === 'manual') return false }
  else if (f.source && f.source !== 'all') { if (p.source !== f.source) return false }
  if (catIds && !catIds.has(p.categoryId)) return false
  if (f.brand && norm(p.brand || '') !== norm(f.brand)) return false
  if (f.search) { const q = norm(f.search); if (!(norm(p.name).includes(q) || norm(p.brand || '').includes(q))) return false }
  for (const m of (f.missing || [])) {
    if (m === 'price' && p.priceHistory && p.priceHistory.length) return false
    if (m === 'image' && p.image) return false
    if (m === 'specs' && p.specs && p.specs.length >= 2) return false
    if (m === 'description' && p.description && p.description.trim().length >= 20) return false
  }
  return true
}
export function bulkDeleteQuery(f: BulkDeleteFilter): { count: number } {
  const db = load(); const catIds = f.category ? descendantsOf(db.categories, f.category) : null
  return { count: db.products.filter(p => matchesBulk(p, f, catIds)).length }
}
export function bulkDeleteProducts(f: BulkDeleteFilter): { deleted: number; categories: number } {
  const db = load(); const catIds = f.category ? descendantsOf(db.categories, f.category) : null
  const before = db.products.length, cBefore = db.categories.length
  db.products = db.products.filter(p => !matchesBulk(p, f, catIds))
  // پاک‌سازیِ دسته‌های خالی (تا رسیدن به حالتِ پایدار — والدهای بی‌فرزند هم بروند)
  let pruned = true
  while (pruned) {
    const usedCat = new Set(db.products.map(p => p.categoryId))
    const hasChild = new Set(db.categories.filter(c => c.parentId).map(c => c.parentId!))
    const keep = db.categories.filter(c => usedCat.has(c.id) || hasChild.has(c.id))
    pruned = keep.length !== db.categories.length; db.categories = keep
  }
  save(db)
  return { deleted: before - db.products.length, categories: cBefore - db.categories.length }
}

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

// پاک‌سازیِ دسته‌های زباله. «نامِ سایت» (آهن آنلاین/محصولات) → بچه‌ها بالا می‌روند و محصولاتِ
// مستقیم دسته‌ی معنادار می‌گیرند. «محتوایی» (مجله/بلاگ/فیلم) → کلِ شاخه و محصولاتش حذف می‌شوند.
export function pruneSourceCategories(): number {
  const db = load()
  let removed = 0, guard = 0
  while (guard++ < 8) {
    const content = db.categories.filter(c => JUNK_CONTENT.test(norm(c.name)))
    const site = db.categories.filter(c => JUNK_SITE.test(norm(c.name)))
    if (!content.length && !site.length) break
    // محتوایی: کلِ شاخه (دسته + زیردسته + محصولات) حذف
    if (content.length) {
      const kill = new Set<string>()
      for (const c of content) for (const id of descendantsOf(db.categories, c.id)) kill.add(id)
      db.products = db.products.filter(p => !kill.has(p.categoryId))
      db.categories = db.categories.filter(c => !kill.has(c.id))
      removed += content.length
    }
    // نامِ سایت: بچه‌ها یک سطح بالا، محصولاتِ مستقیم به دستهٔ حدس‌زده‌شده (یا دسته‌بندی‌نشده)
    if (site.length) {
      const badIds = new Set(site.map(c => c.id))
      const parentOf = new Map(site.map(c => [c.id, c.parentId]))
      for (const c of db.categories) if (c.parentId && badIds.has(c.parentId)) c.parentId = parentOf.get(c.parentId) || undefined
      for (const p of db.products) if (badIds.has(p.categoryId)) p.categoryId = ensureCategoryInDb(db, guessCategory(p.name) || 'دسته‌بندی‌نشده').id
      db.categories = db.categories.filter(c => !badIds.has(c.id))
      removed += site.length
    }
  }
  // دسته‌بندی‌نشده‌های قابل‌حدس را به دستهٔ درست منتقل کن تا انباشته نشود
  const uncat = db.categories.find(c => norm(c.name) === norm('دسته‌بندی‌نشده'))
  if (uncat) {
    for (const p of db.products) if (p.categoryId === uncat.id) { const g = guessCategory(p.name); if (g) { p.categoryId = ensureCategoryInDb(db, g).id; removed++ } }
  }
  // برندهایی که در واقع کشورِ مبدأ‌اند (ایران/آلمان/…) پاک شوند تا در فیلترِ برند نیایند
  for (const p of db.products) if (p.brand) { const clean = sanitizeBrand(p.brand); if (clean !== p.brand) { p.brand = clean; removed++ } }
  if (removed) save(db)
  return removed
}

export function upsertScraped(items: { name: string; categoryName?: string; categoryPath?: string[]; brand?: string; unit?: string; image?: string; description?: string; specs?: CatalogSpec[]; priceHistory?: PricePoint[]; externalId?: string; externalUrl?: string }[], source = 'hypersaz'): { added: number; updated: number } {
  let added = 0, updated = 0
  const db = load()
  for (const it of items) {
    if (!it.name || looksLikeArticle(it.name)) continue   // صفحاتِ مقاله/محتوایی محصول نمی‌شوند
    const cleanPath = (it.categoryPath || []).filter(n => n && !isJunkCategory(n))
    let cat: CatalogCategory | null = cleanPath.length ? ensureCategoryPathInDb(db, cleanPath) : null
    if (!cat) {
      const named = it.categoryName && !isJunkCategory(it.categoryName) ? it.categoryName : ''
      cat = ensureCategoryInDb(db, named || guessCategory(it.name) || 'دسته‌بندی‌نشده')
    }
    const ext = it.externalId ? String(it.externalId) : ''
    let existing = ext ? db.products.find(p => p.source === source && p.externalId === ext) : undefined
    if (!existing) existing = db.products.find(p => p.source === source && norm(p.name) === norm(it.name))
    if (existing) {
      existing.categoryId = cat.id; existing.name = it.name.slice(0, 160)
      { const b = sanitizeBrand(it.brand); if (b) existing.brand = b.slice(0, 80) }
      if (it.unit) existing.unit = it.unit.slice(0, 24)
      if (it.image) existing.image = it.image.slice(0, 100000)
      if (it.description) existing.description = it.description.slice(0, 4000)
      // ادغامِ مشخصات: مقادیرِ اسکرپ‌شده تازه‌سازی می‌شوند ولی مشخصاتِ AI (جنس/کاربرد/…) حفظ می‌شود
      if (it.specs?.length) {
        const incoming = sanitizeSpecs(it.specs) || []
        const inKeys = new Set(incoming.map(s => norm(s.key)))
        const kept = (existing.specs || []).filter(s => !inKeys.has(norm(s.key)))
        existing.specs = sanitizeSpecs([...incoming, ...kept].slice(0, 40))
      } else existing.specs = sanitizeSpecs(existing.specs)
      // تاریخچهٔ قیمت: اگر نمودارِ کاملِ صفحهٔ محصول آمد (≥۲ نقطه) جایگزین کن؛
      // وگرنه نقطهٔ روزانهٔ جدولِ دسته را انباشته کن تا نمودار به‌مرور ساخته شود.
      if (it.priceHistory?.length) {
        if (it.priceHistory.length >= 2 && it.priceHistory.length >= (existing.priceHistory?.length || 0)) {
          existing.priceHistory = it.priceHistory.slice(-90)
        } else {
          const cur = existing.priceHistory || []
          for (const pt of it.priceHistory) {
            if (!pt || !(pt.price > 0)) continue
            const last = cur[cur.length - 1]
            if (!last || last.date !== pt.date || last.price !== pt.price) cur.push({ date: pt.date || '', price: pt.price })
          }
          existing.priceHistory = cur.slice(-90)
        }
      }
      if (it.externalUrl) existing.externalUrl = it.externalUrl
      updated++
    } else {
      db.products.unshift({
        id: id('cp_'), categoryId: cat.id, name: it.name.slice(0, 160), brand: sanitizeBrand(it.brand)?.slice(0, 80),
        unit: it.unit?.slice(0, 24), image: it.image?.slice(0, 100000) || cat.image, description: it.description?.slice(0, 4000),
        specs: sanitizeSpecs(it.specs?.slice(0, 40)), priceHistory: it.priceHistory?.slice(0, 40),
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

// ── کوئریِ عمومیِ محصولات (صفحهٔ بازارِ مصالح) با فیلتر/جستجو/مرتب‌سازی ──
function descendantsOf(cats: CatalogCategory[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]); let g = true
  while (g) { g = false; for (const c of cats) if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); g = true } }
  return ids
}
export function publicCatalogQuery(opts: { search?: string; category?: string; source?: string; brand?: string; unit?: string; sort?: string; minPrice?: number; maxPrice?: number; withSeller?: boolean; sellerIds?: Set<string>; page?: number; pageSize?: number }) {
  const db = load()
  const catName = (id: string) => db.categories.find(c => c.id === id)?.name || ''
  const refPrice = (p: CatalogProduct) => p.priceHistory?.length ? Math.round(p.priceHistory[p.priceHistory.length - 1].price / 10) : 0
  let items = db.products.filter(p => p.active)
  if (opts.category) { const ids = descendantsOf(db.categories, opts.category); items = items.filter(p => ids.has(p.categoryId)) }
  if (opts.source && opts.source !== 'all') items = items.filter(p => p.source === opts.source)
  if (opts.brand) { const b = norm(opts.brand); items = items.filter(p => norm(p.brand || '').includes(b)) }
  if (opts.unit) { const u = norm(opts.unit); items = items.filter(p => norm(p.unit || '') === u) }
  if (opts.withSeller && opts.sellerIds) items = items.filter(p => opts.sellerIds!.has(p.id))
  if (opts.minPrice) items = items.filter(p => refPrice(p) >= opts.minPrice!)
  if (opts.maxPrice) items = items.filter(p => { const v = refPrice(p); return v > 0 && v <= opts.maxPrice! })
  if (opts.search) { const q = norm(opts.search); items = items.filter(p => norm(p.name).includes(q) || norm(p.brand || '').includes(q) || (p.tags || []).some(t => norm(t).includes(q))) }
  const total = items.length
  if (opts.sort === 'cheap') items = [...items].sort((a, b) => (refPrice(a) || Infinity) - (refPrice(b) || Infinity))
  else if (opts.sort === 'expensive') items = [...items].sort((a, b) => refPrice(b) - refPrice(a))
  else items = [...items].sort((a, b) => b.createdAt - a.createdAt)
  const page = Math.max(1, opts.page || 1), pageSize = Math.min(60, opts.pageSize || 24)
  const paged = items.slice((page - 1) * pageSize, page * pageSize).map(p => ({
    id: p.id, name: p.name, image: p.image || '', brand: p.brand || '', category: catName(p.categoryId),
    unit: p.unit || '', source: p.source, refPrice: refPrice(p),
  }))
  return { items: paged, total, page, pageSize }
}
export function publicCatalogFacets() {
  const db = load()
  const active = db.products.filter(p => p.active)
  // شمارشِ هر دسته شاملِ زیردسته‌ها (سلسله‌مراتبی)
  const catCount = new Map<string, number>()
  for (const p of active) { const ids = new Set<string>(); let c = db.categories.find(x => x.id === p.categoryId); let g = 0; while (c && g++ < 6) { ids.add(c.id); c = c.parentId ? db.categories.find(x => x.id === c!.parentId) : undefined }; for (const id of ids) catCount.set(id, (catCount.get(id) || 0) + 1) }
  // درختِ نمایشی: دسته‌های «نامِ سایت» (آهن آنلاین) شفاف‌اند → بچه‌هایشان بالا می‌آیند؛
  // دسته‌های «محتوایی» (مجله) و زیرشاخه‌شان کلاً حذف می‌شوند. (مستقل از پاک‌سازیِ فایل)
  const catById = new Map(db.categories.map(c => [c.id, c]))
  const isSite = (c: CatalogCategory) => JUNK_SITE.test(norm(c.name))
  const isContent = (c: CatalogCategory) => JUNK_CONTENT.test(norm(c.name))
  const underContent = (c: CatalogCategory) => { let x: CatalogCategory | undefined = c, g = 0; while (x && g++ < 8) { if (isContent(x)) return true; x = x.parentId ? catById.get(x.parentId) : undefined } return false }
  const effParent = (c: CatalogCategory) => { let p = c.parentId ? catById.get(c.parentId) : undefined, g = 0; while (p && isSite(p) && g++ < 8) p = p.parentId ? catById.get(p.parentId) : undefined; return p }
  const mk = (c: CatalogCategory) => ({ id: c.id, name: c.name, count: catCount.get(c.id) || 0 })
  const visible = db.categories.filter(c => (catCount.get(c.id) || 0) > 0 && !isSite(c) && !isContent(c) && !underContent(c))
  const byEff = new Map<string, CatalogCategory[]>()
  for (const c of visible) { const ep = effParent(c); const key = ep ? ep.id : ''; if (!byEff.has(key)) byEff.set(key, []); byEff.get(key)!.push(c) }
  const buildNode = (c: CatalogCategory): any => ({ ...mk(c), children: (byEff.get(c.id) || []).sort((a, b) => (catCount.get(b.id) || 0) - (catCount.get(a.id) || 0)).map(buildNode) })
  const tree = (byEff.get('') || []).sort((a, b) => (catCount.get(b.id) || 0) - (catCount.get(a.id) || 0)).map(buildNode)
  const roots = tree.map(({ children, ...r }: any) => r)   // سازگاریِ عقب‌رو (چیپ‌های تخت)
  const brandCount = new Map<string, number>()
  for (const p of active) { const b = sanitizeBrand(p.brand); if (b) brandCount.set(b, (brandCount.get(b) || 0) + 1) }
  const brands = [...brandCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([label, count]) => ({ label, count }))
  const unitCount = new Map<string, number>()
  for (const p of active) if (p.unit) unitCount.set(p.unit, (unitCount.get(p.unit) || 0) + 1)
  const units = [...unitCount.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }))
  const sourceCount: Record<string, number> = {}
  for (const p of active) sourceCount[p.source] = (sourceCount[p.source] || 0) + 1
  const prices = active.map(p => p.priceHistory?.length ? Math.round(p.priceHistory[p.priceHistory.length - 1].price / 10) : 0).filter(v => v > 0)
  const priceRange = prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null
  return { categories: roots, tree, brands, units, sources: sourceCount, priceRange, total: active.length }
}

export function catalogStats() {
  const db = load()
  const bySource: Record<string, number> = {}
  for (const p of db.products) bySource[p.source] = (bySource[p.source] || 0) + 1
  return { categories: db.categories.length, products: db.products.length, manual: bySource['manual'] || 0, bySource }
}
