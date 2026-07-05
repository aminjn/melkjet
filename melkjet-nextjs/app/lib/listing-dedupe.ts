import { listItems, setModeration, type Item } from './scraper-store'

// تشخیص و حذفِ آگهی‌های تکراریِ منتشرشده (که SEO را خراب می‌کنند).
// کاملاً قطعی (بدونِ هوش مصنوعی) و مستقل — تا در ممیزی/اسکرپ/کرون قابلِ فراخوانی باشد.
// از هر گروهِ تکراری، قدیمی‌ترین آگهی نگه داشته و بقیه «duplicate» (خارج از نمایشِ عمومی) می‌شوند.

function faToEn(s: string): string {
  return (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}
function norm(s?: string): string { return (s || '').replace(/‌/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() }
function toks(s?: string): Set<string> { return new Set(norm(s).split(/[\s,،.\/\-+*()]+/).filter(t => t.length > 2)) }
function overlap(a: Set<string>, b: Set<string>): number { if (!a.size || !b.size) return 0; let c = 0; for (const t of a) if (b.has(t)) c++; return c / Math.min(a.size, b.size) }
function near(a: number, b: number, tol: number): boolean { if (!a || !b) return false; return Math.abs(a - b) / Math.max(a, b) <= tol }
function firstInt(s?: string): number { const m = faToEn(s || '').match(/\d[\d,]*/); return m ? parseInt(m[0].replace(/,/g, ''), 10) : 0 }

interface Fields { deal: 'sale' | 'rent'; title: string; hood: string; price: number; area: number; rooms: number; priceStr: string }
function fieldsOf(it: Item): Fields {
  const priceTxt = faToEn(it.price || '')
  const dealTxt = `${it.meta?.['نوع معامله'] || ''} ${it.price || ''} ${it.title || ''}`
  const deal: 'sale' | 'rent' = (it.meta?.['نوع معامله'] === 'اجاره' || /اجاره|رهن|ودیعه/.test(dealTxt)) ? 'rent' : 'sale'
  // بزرگ‌ترین عددِ قیمت (تومان) از رشتهٔ قیمت
  const nums = (priceTxt.match(/\d[\d,]*/g) || []).map(n => parseInt(n.replace(/,/g, ''), 10)).filter(n => n > 0)
  const price = nums.length ? Math.max(...nums) : 0
  const segs = (it.location || '').split(/[،,]/).map(s => s.trim()).filter(Boolean)
  const hood = norm(it.meta?.['محله'] || (segs.length > 1 ? segs[segs.length - 1] : segs[0] || ''))
  const area = firstInt(it.meta?.['متراژ']) || (faToEn(it.title).match(/(\d+)\s*متر/) ? parseInt(faToEn(it.title).match(/(\d+)\s*متر/)![1], 10) : 0)
  const rooms = firstInt(it.meta?.['اتاق خواب']) || (faToEn(it.title).match(/(\d+)\s*خواب/) ? parseInt(faToEn(it.title).match(/(\d+)\s*خواب/)![1], 10) : 0)
  return { deal, title: it.title || '', hood, price, area, rooms, priceStr: norm(it.price) }
}

// امتیازِ شباهتِ دو آگهی (۰..۱). دو آگهی وقتی «یک ملک» محسوب می‌شوند که ≥ ۰٫۸۵ باشد.
function similarity(x: Fields, y: Fields): number {
  if (x.deal !== y.deal) return 0
  // میان‌بُر: عنوان و قیمتِ کاملاً یکسان → قطعاً تکراری
  if (x.priceStr && x.priceStr === y.priceStr && norm(x.title) === norm(y.title)) return 1
  let s = 0, w = 0
  if (x.hood && y.hood) { w += 0.25; if (x.hood === y.hood || x.hood.includes(y.hood) || y.hood.includes(x.hood)) s += 0.25 }
  if (x.area && y.area) { w += 0.3; if (near(x.area, y.area, 0.05)) s += 0.3 }
  if (x.price && y.price) { w += 0.3; if (near(x.price, y.price, 0.03)) s += 0.3 }
  if (x.rooms && y.rooms) { w += 0.1; if (x.rooms === y.rooms) s += 0.1 }
  const ov = overlap(toks(x.title), toks(y.title)); w += 0.35; s += 0.35 * ov
  return w ? s / w : 0
}

const DUP_THRESHOLD = 0.85

// همهٔ آگهی‌های نمایش‌داده‌شده را می‌گردد و تکراری‌ها را «duplicate» می‌کند (قدیمی‌ترین می‌ماند).
export async function dedupeListings(): Promise<{ removed: number; kept: number }> {
  const items = (await listItems('listing')).filter(i => i.status === 'approved' || i.status === 'pending')
  // قدیمی‌ترین اول → همان نگه داشته می‌شود، جدیدترها اگر تکراری بودند حذف می‌شوند.
  items.sort((a, b) => (a.scrapedAt || 0) - (b.scrapedAt || 0))
  const kept: Fields[] = []
  let removed = 0
  for (const it of items) {
    const f = fieldsOf(it)
    if (kept.some(k => similarity(k, f) >= DUP_THRESHOLD)) {
      await setModeration(it.id, 'duplicate', 'آگهیِ تکراری — مشابهِ یک آگهیِ منتشرشدهٔ دیگر', 0)
      removed++
    } else {
      kept.push(f)
    }
  }
  return { removed, kept: kept.length }
}

// آیا آیتم، تکراریِ یکی از آگهی‌های منتشرشدهٔ موجود است؟ (برای بررسیِ یک آگهیِ تازه)
export async function isDuplicateListing(it: Item): Promise<boolean> {
  const f = fieldsOf(it)
  const others = (await listItems('listing')).filter(x => x.id !== it.id && (x.status === 'approved' || x.status === 'pending'))
  return others.some(o => similarity(fieldsOf(o), f) >= DUP_THRESHOLD)
}

// ── ایندکسِ سبکِ تشخیصِ تکرار (یک‌بار ساخته می‌شود، بارها بررسی) ──
// برای گِیتِ خودکارِ ممیزیِ دسته‌ای: از محاسبهٔ دوبارهٔ fieldsOf در هر بررسی جلوگیری می‌کند.
export interface DupCandidate { id: string; status: string; scrapedAt: number; f: Fields }
export async function buildDupIndex(): Promise<DupCandidate[]> {
  return (await listItems('listing'))
    .filter(x => x.status === 'approved' || x.status === 'pending')
    .map(x => ({ id: x.id, status: String(x.status), scrapedAt: x.scrapedAt || 0, f: fieldsOf(x) }))
}
// «مَستر»ِ تکرار برای یک آیتم را در ایندکس می‌یابد (اگر باشد). قانونِ نگهداریِ قدیمی‌تر:
// یک نامزد فقط وقتی مَستر است که یا از قبل «approved» باشد، یا «pending»ِ قدیمی‌تر
// (تساوی زمان → شناسهٔ کوچک‌تر). این تضمین می‌کند از هر خوشهٔ تکراری فقط یکی می‌ماند.
export function dupMasterInIndex(it: Item, index: DupCandidate[]): DupCandidate | null {
  const f = fieldsOf(it)
  const at = it.scrapedAt || 0
  for (const c of index) {
    if (c.id === it.id) continue
    const isMaster = c.status === 'approved' || c.scrapedAt < at || (c.scrapedAt === at && c.id < it.id)
    if (!isMaster) continue
    if (similarity(c.f, f) >= DUP_THRESHOLD) return c
  }
  return null
}
// تکِ آیتم: آیا تکراریِ یک آگهیِ قدیمی‌تر/منتشرشده است؟ نتیجه = خودِ مَستر (یا null).
export async function findDuplicateOf(it: Item): Promise<Item | null> {
  const m = dupMasterInIndex(it, await buildDupIndex())
  if (!m) return null
  return (await listItems('listing')).find(x => x.id === m.id) || null
}
