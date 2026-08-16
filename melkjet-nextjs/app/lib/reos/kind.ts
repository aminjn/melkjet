// REOS · «مشابه‌های واقعاً مشابه» — طبقه‌بندیِ نوعِ ملک + انتخاب/امتیازدهیِ خالص (بدونِ استور، تست‌پذیر).
//
// باگِ واقعی (فیدبکِ کاربر روی صفحهٔ ملک): برای آپارتمانِ ۲۶۴متریِ جنت‌آباد، کارتِ «مشابه»
// کلنگیِ ۵۲۰متریِ سعادت‌آباد را با «~۸۵٪ مشابه» نشان می‌داد — حتی آگهیِ اجاره‌ای هم می‌آمد.
// علت: شباهت فقط cosineِ بردارِ token-hash (۶۴ بُعد) بود که نوعِ معامله/نوعِ ملک/شهر/متراژ اصلاً
// در آن نبودند و توکن‌های همه‌جایی («تهران»، «متری»، و حتی «آباد» که از شکستنِ نیم‌فاصلهٔ
// «جنت‌آباد»/«سعادت‌آباد» درمی‌آید) همهٔ آگهی‌ها را در باندِ ~۸۴–۸۸٪ فشرده می‌کرد.
// درمان: معیارهای تعیین‌کننده «فیلترِ سخت»اند (وتو، نه وزن) و امتیاز فقط بینِ بازمانده‌ها
// از شواهدِ واقعی (متراژ/قیمتِ هر متر/محله/متن) ساخته می‌شود تا simPct صادق و پخش‌شده باشد.
import { dealOf, cityMatch } from '../listing-filter'
import { similarity, DUP_THRESHOLD } from '../listing-similarity'
import { fieldsOf, ptypeClassOf, norm } from '../listing-similarity'
import { tokenize, embedTokens, cosine } from './features'
import type { Vector } from './types'

// حداقلِ شکلِ آیتم — عمداً زیرمجموعهٔ Itemِ scraper-store تا تابع بدونِ استور تست شود.
export interface SimilarItemLike {
  id: string
  title?: string
  price?: string
  location?: string
  category?: string
  excerpt?: string
  meta?: Record<string, string>
}

// طبقه‌بندیِ درشتِ نوعِ ملک ('apt' | 'villa' | 'shop' | 'office' | 'land' | 'industrial' | '').
// تقدم: متای صریحِ «نوع ملک» → category → عنوان. متا اول است چون عنوانِ
// «آپارتمان با موقعیتِ اداری» نباید office شود وقتی متا صریحاً آپارتمان می‌گوید؛ و اگر متا
// طبقه‌ناپذیر بود («مسکونی») به‌جای جاخالی، از category/عنوان ادامه می‌دهیم.
export function kindOf(it: Pick<SimilarItemLike, 'title' | 'category' | 'meta'>): string {
  return ptypeClassOf(it.meta?.['نوع ملک']) || ptypeClassOf(it.category) || ptypeClassOf(it.title)
}

// نرمال‌سازِ نامِ محله — نیم‌فاصله و فاصله هر دو حذف تا «جنت‌آباد» = «جنت آباد» (normِ خام فاصله را نگه می‌دارد).
const squash = (s?: string) => norm(s).replace(/\s+/g, '')

// نمای فشردهٔ یک آگهی برای مقایسه — یک‌بار ساخته می‌شود، نه در هر جفت‌مقایسه.
interface SimView {
  deal: ReturnType<typeof dealOf>
  kind: string
  city: string
  cityCands: string[]   // فاز ۲۸۴ — نامزدهای «شهر» برای وتو (هر دو ترتیبِ سگمنتِ لوکیشن)
  hood: string
  region: string
  area: number
  price: number    // قیمتِ کل — برای وتوی بودجه (خریدارِ ۱۸ میلیاردی با فایلِ ۹۷ میلیاردی کاری ندارد)
  ppm: number      // قیمتِ هر متر (فقط وقتی قیمت و متراژ هر دو معلوم‌اند)
  vec: Vector      // بردارِ توکنیِ تازه‌محاسبه (نه بردارِ کهنهٔ استور — کهنگی همان باگ را برمی‌گرداند)
}

function viewOf(it: SimilarItemLike): SimView {
  const f = fieldsOf(it)
  // فاز ۲۸۴ (یافتهٔ بازبین): mapRowِ دیوار location را «محله، شهر» می‌سازد ولی fieldsOf قراردادِ
  // «شهر، محله» را فرض می‌کند — پس برای آیتمِ بدونِ متایِ «شهر»، city ممکن است در واقع محله باشد
  // و وتوی سختِ شهر همه را حذف کند (نتیجهٔ خالی → fallbackِ بی‌ربطِ UI؛ عکسِ نقضِ همان باگ).
  // وتو با «هر دو» سرِ لوکیشن سنجیده می‌شود؛ متایِ صریحِ «شهر» اگر بود، تنها مرجع است.
  const segs = String(it.location || '').split(/[،,]/).map(x => x.trim()).filter(Boolean)
  const metaCity = String(it.meta?.['شهر'] || '').trim()
  const cityCands = metaCity ? [metaCity] : [...new Set(segs.length > 1 ? [segs[0], segs[segs.length - 1]] : segs.slice(0, 1))]
  const feats = it.meta?.['امکانات'] ? String(it.meta['امکانات']).split(/[،,]/) : []
  const ptxt = it.meta?.['نوع ملک'] || it.category || ''
  return {
    deal: dealOf(it), kind: kindOf(it), city: f.city, cityCands, hood: squash(f.hood), region: squash(it.meta?.['منطقه']),
    area: f.area, price: f.price, ppm: f.price && f.area ? f.price / f.area : 0,
    vec: embedTokens([...tokenize(ptxt), ...tokenize(it.location), ...tokenize(it.title), ...feats.flatMap(t => tokenize(t))]),
  }
}

// وتوهای سخت + پله‌های شل‌شدنی. خروجی: 0 = «واقعاً مشابه» (باندِ تنگِ متراژ/قیمت + هم‌محله)،
// 1 = فقط برای پُرکردنِ ظرفیت، Infinity = هرگز.
// فاز ۲۸۵ (فیدبکِ زنده: ۷۳متریِ ۱۸.۵B در تهرانپارس، «مشابه»هایش ۲۲۰متریِ ۹۷B پونک و ۱۲۵متریِ
// ۳۲.۶B جنت‌آباد بود): سه ریشه بسته شد —
//   (۱) پلهٔ «بدونِ قیدِ متراژ» حذف شد: خارج از ±۷۰٪ یعنی هرگز، حتی اگر نتیجه خالی بماند.
//   (۲) قیمتِ کل حالا وتو دارد (±۴۰٪ تنگ، تا ±۹۰٪ فقط پُرکننده، بیشتر هرگز).
//   (۳) محله/منطقه دیگر صرفاً امتیاز نیست: غیرهم‌محله فقط پُرکننده است.
// «خالی بهتر از بی‌ربط» — UI بخشِ مشابه را وقتی چیزی نیست پنهان می‌کند.
function vetoLevel(base: SimView, candIt: SimilarItemLike, cand: SimView): number {
  if (cand.deal !== base.deal) return Infinity
  if (base.kind && cand.kind && cand.kind !== base.kind) return Infinity
  if (base.cityCands.length && !base.cityCands.some(c => cityMatch(candIt, c))) return Infinity
  let lvl = 0
  if (base.area && cand.area) {
    const r = Math.abs(cand.area - base.area) / base.area
    if (r > 0.7) return Infinity
    if (r > 0.4) lvl = 1
  } else if (base.area) lvl = 1            // متراژِ نامعلومِ کاندید = شواهدِ ضعیف → فقط پُرکننده
  if (base.price && cand.price) {
    const r = Math.abs(cand.price - base.price) / base.price
    if (r > 0.9) return Infinity
    if (r > 0.4) lvl = 1
  }
  if (base.hood) {
    const hoodMatch = cand.hood && (base.hood === cand.hood || base.hood.includes(cand.hood) || cand.hood.includes(base.hood))
    const regionMatch = base.region && cand.region && base.region === cand.region
    if (!hoodMatch && !regionMatch) lvl = 1
  }
  return lvl
}

// امتیازِ ترکیبی ۰..۱ روی بازمانده‌های فیلترِ سخت — وزن‌ها فقط برای شواهدِ موجود جمع می‌شوند
// (الگوی similarity در listing-similarity.ts) و کفِ مخرج 0.75 نمی‌گذارد جفتِ کم‌شواهد
// (بی‌متراژ/بی‌قیمت) صرفاً با هم‌محله‌بودن امتیازِ دروغینِ بالا بگیرد.
function scoreOf(base: SimView, cand: SimView): number {
  let s = 0, w = 0
  if (base.area && cand.area) { w += 0.35; s += 0.35 * (1 - Math.abs(cand.area - base.area) / Math.max(cand.area, base.area)) }
  if (base.ppm && cand.ppm) { w += 0.25; s += 0.25 * (1 - Math.min(1, Math.abs(cand.ppm - base.ppm) / Math.max(cand.ppm, base.ppm))) }
  if (base.hood && cand.hood) {
    w += 0.25
    if (base.hood === cand.hood || base.hood.includes(cand.hood) || cand.hood.includes(base.hood)) s += 0.25
    else if (base.region && base.region === cand.region) s += 0.125   // هم‌منطقه ولی غیرهم‌محله = نیم‌امتیاز
  }
  // جزءِ متنی کوچک نگه داشته می‌شود (0.15) — همین جزء بود که به‌تنهایی «۸۵٪ برای همه» می‌ساخت.
  w += 0.15; s += 0.15 * cosine(base.vec, cand.vec)
  return Math.round((s / Math.max(w, 0.75)) * 1000) / 1000
}

// انتخابِ k مشابهِ واقعی — خالص و قطعی. شل‌کردنِ کنترل‌شده فقط روی باندِ متراژ
// (±۴۰٪ → ±۷۰٪ → بدونِ قید)؛ نوعِ معامله/نوعِ ملک/شهر هرگز شل نمی‌شوند: کمتر از k نتیجه
// برمی‌گردد و fallbackِ UI («آخرین آگهی‌ها» وقتی <۳) سرِ جای خودش می‌ماند — خالی بهتر از بی‌ربط.
export function pickSimilar(target: SimilarItemLike, candidates: SimilarItemLike[], k = 8): { id: string; sim: number }[] {
  const base = viewOf(target)
  const seen = new Set<string>([target.id])
  const byLevel: { id: string; it: SimilarItemLike; v: SimView }[][] = [[], []]
  for (const c of candidates) {
    if (!c?.id || seen.has(c.id)) continue
    seen.add(c.id)
    const v = viewOf(c)
    const lvl = vetoLevel(base, c, v)
    if (lvl !== Infinity) byLevel[lvl].push({ id: c.id, it: c, v })
  }
  const pool = [...byLevel[0]]
  if (pool.length < k) pool.push(...byLevel[1])
  const ranked = pool.map(p => ({ ...p, sim: scoreOf(base, p.v) })).sort((a, b) => b.sim - a.sim || (a.id < b.id ? -1 : 1))
  // فاز ۲۸۵ — هم‌ملک‌زدایی بینِ خودِ نتایج: دو نسخهٔ یک فایل (همان ۱۲۵متریِ جنت‌آباد که دوبار
  // کنارِ هم نشسته بود) با همان موتورِ twin (similarity ≥ DUP_THRESHOLD) به یکی فرو می‌ریزند.
  const out: { id: string; sim: number }[] = []
  const pickedF: ReturnType<typeof fieldsOf>[] = []
  for (const r of ranked) {
    const f = fieldsOf(r.it)
    if (pickedF.some(pf => similarity(pf, f) >= DUP_THRESHOLD)) continue
    pickedF.push(f)
    out.push({ id: r.id, sim: r.sim })
    if (out.length >= k) break
  }
  return out
}
