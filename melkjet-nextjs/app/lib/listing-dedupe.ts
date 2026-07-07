import { listItems, setModerationBatch, type Item, type ItemStatus } from './scraper-store'
// هستهٔ تشابه (متن+مشخصات+لوکیشن) در ماژولِ خالصِ مشترک — همان موتور در ingest و واردکنندهٔ دیوار هم استفاده می‌شود.
import { fieldsOf, similarity, blockKeys, DUP_THRESHOLD, type SimFields as Fields } from './listing-similarity'

// تشخیص و حذفِ آگهی‌های تکراریِ منتشرشده (که SEO را خراب می‌کنند).
// کاملاً قطعی (بدونِ هوش مصنوعی) و مستقل — تا در ممیزی/اسکرپ/کرون قابلِ فراخوانی باشد.
// از هر گروهِ تکراری، قدیمی‌ترین آگهی نگه داشته و بقیه «duplicate» (خارج از نمایشِ عمومی) می‌شوند.

const DUP_REASON = 'آگهیِ تکراری — مشابهِ یک آگهیِ منتشرشدهٔ دیگر'

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
