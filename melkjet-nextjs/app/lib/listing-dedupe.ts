import { listItems, setModeration, setModerationBatch, type Item, type ItemStatus } from './scraper-store'

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
const DUP_REASON = 'آگهیِ تکراری — مشابهِ یک آگهیِ منتشرشدهٔ دیگر'

// کلیدهای «بلوکه‌کردن»: فقط آگهی‌هایِ هم‌بلوک با هم مقایسه می‌شوند تا از O(n²) روی ده‌ها‌هزار
// آگهی (که تایم‌اوت می‌داد) جلوگیری شود. آگهی‌هایِ واقعاً‌تکراری هم‌محله و هم‌متراژ هستند،
// پس با کلیدِ محله یا سطلِ متراژ حتماً کنارِ هم می‌افتند؛ خودِ similarity تصمیمِ نهایی را می‌گیرد.
function blockKeys(f: Fields): string[] {
  const ks: string[] = []
  if (f.hood) ks.push(`${f.deal}|h:${f.hood}`)
  if (f.area) ks.push(`${f.deal}|a:${Math.round(f.area / 5)}`)   // سطلِ ~۵متری
  if (!ks.length) ks.push(`${f.deal}|x`)
  return ks
}

// همهٔ آگهی‌های نمایش‌داده‌شده را می‌گردد و تکراری‌ها را «duplicate» می‌کند (قدیمی‌ترین می‌ماند).
// بلوکه‌شده + نوشتِ دسته‌ای (یک نوشت، نه یکی به‌ازای هر آگهی) → روی ده‌ها‌هزار آگهی هم سریع است.
export async function dedupeListings(): Promise<{ removed: number; kept: number }> {
  const items = (await listItems('listing')).filter(i => i.status === 'approved' || i.status === 'pending')
  items.sort((a, b) => (a.scrapedAt || 0) - (b.scrapedAt || 0))   // قدیمی‌ترین اول → می‌ماند
  const blocks = new Map<string, Fields[]>()
  const dupIds: string[] = []
  let kept = 0
  for (const it of items) {
    const f = fieldsOf(it)
    const ks = blockKeys(f)
    let isDup = false
    for (const k of ks) { const arr = blocks.get(k); if (arr && arr.some(x => similarity(x, f) >= DUP_THRESHOLD)) { isDup = true; break } }
    if (isDup) { dupIds.push(it.id) }
    else { kept++; for (const k of ks) { let arr = blocks.get(k); if (!arr) { arr = []; blocks.set(k, arr) } arr.push(f) } }
  }
  if (dupIds.length) await setModerationBatch(dupIds.map(id => ({ id, status: 'duplicate' as ItemStatus, reason: DUP_REASON, score: 0 })))
  return { removed: dupIds.length, kept }
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
// ایندکسِ بلوکه‌شده: نگاشتِ کلیدِ بلوک → نامزدها. جست‌وجو فقط در بلوک‌های مرتبط (نه کلِ ۱۸هزار).
export interface DupIndex { blocks: Map<string, DupCandidate[]> }
export async function buildDupIndex(): Promise<DupIndex> {
  const blocks = new Map<string, DupCandidate[]>()
  for (const x of await listItems('listing')) {
    if (x.status !== 'approved' && x.status !== 'pending') continue
    const c: DupCandidate = { id: x.id, status: String(x.status), scrapedAt: x.scrapedAt || 0, f: fieldsOf(x) }
    for (const k of blockKeys(c.f)) { let a = blocks.get(k); if (!a) { a = []; blocks.set(k, a) } a.push(c) }
  }
  return { blocks }
}
// «مَستر»ِ تکرار برای یک آیتم را در ایندکس می‌یابد (اگر باشد). قانونِ نگهداریِ قدیمی‌تر:
// یک نامزد فقط وقتی مَستر است که یا «approved» باشد، یا «pending»ِ قدیمی‌تر (تساوی زمان → idِ کوچک‌تر).
export function dupMasterInIndex(it: Item, index: DupIndex): DupCandidate | null {
  const f = fieldsOf(it)
  const at = it.scrapedAt || 0
  const seen = new Set<string>()
  for (const k of blockKeys(f)) {
    const arr = index.blocks.get(k); if (!arr) continue
    for (const c of arr) {
      if (c.id === it.id || seen.has(c.id)) continue
      seen.add(c.id)
      const isMaster = c.status === 'approved' || c.scrapedAt < at || (c.scrapedAt === at && c.id < it.id)
      if (!isMaster) continue
      if (similarity(c.f, f) >= DUP_THRESHOLD) return c
    }
  }
  return null
}
// تکِ آیتم: آیا تکراریِ یک آگهیِ قدیمی‌تر/منتشرشده است؟ نتیجه = خودِ مَستر (یا null).
export async function findDuplicateOf(it: Item): Promise<Item | null> {
  const m = dupMasterInIndex(it, await buildDupIndex())
  if (!m) return null
  return (await listItems('listing')).find(x => x.id === m.id) || null
}
