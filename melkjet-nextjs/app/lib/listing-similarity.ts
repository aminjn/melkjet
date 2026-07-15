// هستهٔ خالصِ «تشخیصِ هم‌ملک‌بودن» — یادگیریِ ماشینیِ قطعیِ ویژگی‌محور (بدونِ LLM):
// از متن (هم‌پوشانیِ توکن‌های عنوان)، مشخصات (متراژ/اتاق/قیمت) و لوکیشن (محله) امتیازِ شباهتِ ۰..۱ می‌سازد.
// بدونِ وابستگی به استورها تا هم در ingest (scraper-store)، هم dedupe، هم واردکنندهٔ دیوار استفاده شود.

export function faToEn(s: string): string {
  return (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}
export function norm(s?: string): string { return (s || '').replace(/‌/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() }
function toks(s?: string): Set<string> { return new Set(norm(s).split(/[\s,،.\/\-+*()]+/).filter(t => t.length > 2)) }
function overlap(a: Set<string>, b: Set<string>): number { if (!a.size || !b.size) return 0; let c = 0; for (const t of a) if (b.has(t)) c++; return c / Math.min(a.size, b.size) }
function near(a: number, b: number, tol: number): boolean { if (!a || !b) return false; return Math.abs(a - b) / Math.max(a, b) <= tol }
function firstInt(s?: string): number { const m = faToEn(s || '').match(/\d[\d,]*/); return m ? parseInt(m[0].replace(/,/g, ''), 10) : 0 }

// فاز ۱۴۵ (فیدبک: «شهر، استان، موقعیت، نوع ملک و همهٔ جزئیات باید مورد توجه باشد»)
export interface SimFields {
  deal: 'sale' | 'rent'; title: string; hood: string; price: number; area: number; rooms: number; priceStr: string; floor: number
  city: string; province: string; ptype: string; yearBuilt: number; totalFloors: number; lat: number; lng: number
}

// کلاس‌بندیِ کانونیِ «نوع ملک» — تفاوتِ کلاس یعنی قطعاً دو ملکِ متفاوت.
export function ptypeClassOf(s?: string): string {
  const t = norm(s)
  if (!t) return ''
  if (/مغازه|تجاری|سرقفلی|غرفه|پاساژ/.test(t)) return 'shop'
  if (/اداری|دفتر|مطب/.test(t)) return 'office'
  if (/زمین|قطعه|باغ|کلنگی/.test(t)) return 'land'
  if (/سوله|انبار|کارگاه|صنعتی/.test(t)) return 'industrial'
  if (/ویلا|ویلایی|خانه|دوبلکس/.test(t)) return 'villa'
  if (/آپارتمان|برج|مجتمع|سوئیت|پنت/.test(t)) return 'apt'
  return ''
}

// فاصلهٔ تقریبیِ دو مختصات به متر (equirectangular — برای فاصله‌های شهری کاملاً کافی).
export function geoDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, rad = Math.PI / 180
  const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad)
  const y = (lat2 - lat1) * rad
  return Math.sqrt(x * x + y * y) * R
}

// از شکلِ آیتمِ اسکرپ‌شده ({title, price, location, meta}) بردارِ ویژگی می‌سازد.
export function fieldsOf(it: { title?: string; price?: string; location?: string; meta?: Record<string, string> }): SimFields {
  const priceTxt = faToEn(it.price || '')
  const dealTxt = `${it.meta?.['نوع معامله'] || ''} ${it.price || ''} ${it.title || ''}`
  const deal: 'sale' | 'rent' = (it.meta?.['نوع معامله'] === 'اجاره' || /اجاره|رهن|ودیعه/.test(dealTxt)) ? 'rent' : 'sale'
  const nums = (priceTxt.match(/\d[\d,]*/g) || []).map(n => parseInt(n.replace(/,/g, ''), 10)).filter(n => n > 0)
  const price = nums.length ? Math.max(...nums) : 0
  const segs = (it.location || '').split(/[،,]/).map(s => s.trim()).filter(Boolean)
  const hood = norm(it.meta?.['محله'] || (segs.length > 1 ? segs[segs.length - 1] : segs[0] || ''))
  const area = firstInt(it.meta?.['متراژ']) || (faToEn(it.title || '').match(/(\d+)\s*متر/) ? parseInt(faToEn(it.title || '').match(/(\d+)\s*متر/)![1], 10) : 0)
  const rooms = firstInt(it.meta?.['اتاق خواب']) || (faToEn(it.title || '').match(/(\d+)\s*خواب/) ? parseInt(faToEn(it.title || '').match(/(\d+)\s*خواب/)![1], 10) : 0)
  // فاز ۱۴۴: طبقه — تنها تمایزِ واقعیِ دو واحدِ هم‌شکل در یک ساختمان (متای «طبقه» یا خودِ عنوان)
  const floor = firstInt(it.meta?.['طبقه']) || (faToEn(it.title || '').match(/طبقه[یهٔ‌\s]*(\d+)/) ? parseInt(faToEn(it.title || '').match(/طبقه[یهٔ‌\s]*(\d+)/)![1], 10) : 0)
  // فاز ۱۴۵: شهر/استان (متا یا اولین تکهٔ location)، نوعِ ملک، سالِ ساخت، تعدادِ طبقات، مختصات
  const city = norm(it.meta?.['شهر'] || (segs.length > 1 ? segs[0] : ''))
  const province = norm(it.meta?.['استان'])
  const ptype = ptypeClassOf(it.meta?.['نوع ملک'] || it.title)
  const yearBuilt = firstInt(it.meta?.['سال ساخت'])
  const totalFloors = firstInt(it.meta?.['تعداد طبقات'])
  const lat = Number(it.meta?.['__lat']) || 0
  const lng = Number(it.meta?.['__lng']) || 0
  return { deal, title: it.title || '', hood, price, area, rooms, priceStr: norm(it.price), floor, city, province, ptype, yearBuilt, totalFloors, lat, lng }
}

// ساختِ مستقیمِ بردارِ ویژگی از مقادیرِ عددی (برای فایل‌های مشاور که ساختارِ متفاوتی دارند).
export function fieldsFromParts(p: { deal?: 'sale' | 'rent'; title?: string; hood?: string; price?: number; area?: number; rooms?: number; floor?: number; city?: string; province?: string; ptype?: string; yearBuilt?: number; totalFloors?: number; lat?: number; lng?: number }): SimFields {
  return {
    deal: p.deal === 'rent' ? 'rent' : 'sale', title: p.title || '', hood: norm(p.hood), price: p.price || 0, area: p.area || 0, rooms: p.rooms || 0, priceStr: p.price ? String(p.price) : '', floor: p.floor || 0,
    city: norm(p.city), province: norm(p.province), ptype: ptypeClassOf(p.ptype || p.title), yearBuilt: p.yearBuilt || 0, totalFloors: p.totalFloors || 0, lat: p.lat || 0, lng: p.lng || 0,
  }
}

// امتیازِ شباهت (۰..۱). ≥ آستانه یعنی «همان ملک».
// فاز ۱۴۴ (فیدبک: «آگهی‌های درست را تکراری می‌کند و حذف می‌کند») — دو اصلاحِ ریشه‌ای:
//  ۱) وتوی طبقه: دو واحدِ هم‌شکلِ یک ساختمان (متراژ/قیمت/محلهٔ یکسان) با طبقهٔ متفاوت «همان ملک» نیستند.
//  ۲) کفِ شواهد: وقتی مشخصات (متراژ/قیمت/محله) در دسترس نیست، صرفِ شباهتِ عنوان دیگر
//     نمی‌تواند به آستانهٔ تکراری برسد — مخرج هرگز از 0.9 کمتر نمی‌شود.
export function similarity(x: SimFields, y: SimFields): number {
  if (x.deal !== y.deal) return 0
  // ── فاز ۱۴۴/۱۴۵ — وتوهای قطعی «قبل از هر میان‌بری»: هر تفاوتِ ساختاریِ مسلم = دو ملکِ متفاوت ──
  // (عنوان+قیمتِ یکسان هم با شهر/طبقه/نوعِ متفاوت تکراری نیست — قالب‌نویسی‌های مشاورها یکسان است.)
  const strDiff = (a: string, b: string) => !!a && !!b && a !== b && !a.includes(b) && !b.includes(a)
  if (strDiff(x.city, y.city)) return 0                                   // شهرِ متفاوت
  if (strDiff(x.province, y.province)) return 0                           // استانِ متفاوت
  if (x.ptype && y.ptype && x.ptype !== y.ptype) return 0                 // نوعِ ملکِ متفاوت (آپارتمان/ویلا/مغازه/…)
  if (x.floor && y.floor && x.floor !== y.floor) return 0                 // طبقهٔ متفاوت = واحدِ متفاوت
  if (x.rooms && y.rooms && x.rooms !== y.rooms) return 0                 // تعدادِ خوابِ متفاوت
  if (x.totalFloors && y.totalFloors && x.totalFloors !== y.totalFloors) return 0   // ساختمانِ متفاوت
  if (x.yearBuilt && y.yearBuilt && Math.abs(x.yearBuilt - y.yearBuilt) >= 2) return 0   // سالِ ساختِ متفاوت
  const dist = (x.lat && x.lng && y.lat && y.lng) ? geoDistanceM(x.lat, x.lng, y.lat, y.lng) : -1
  if (dist >= 0 && dist > 250) return 0                                   // موقعیتِ GPS دورتر از ~۲۵۰ متر
  if (x.priceStr && x.priceStr === y.priceStr && norm(x.title) === norm(y.title)) return 1   // بعد از وتوها
  let s = 0, w = 0
  if (x.hood && y.hood) { w += 0.25; if (x.hood === y.hood || x.hood.includes(y.hood) || y.hood.includes(x.hood)) s += 0.25 }
  if (x.area && y.area) { w += 0.3; if (near(x.area, y.area, 0.05)) s += 0.3 }
  if (x.price && y.price) { w += 0.3; if (near(x.price, y.price, 0.03)) s += 0.3 }
  if (x.rooms && y.rooms) { w += 0.1; if (x.rooms === y.rooms) s += 0.1 }
  if (dist >= 0) { w += 0.15; if (dist <= 75) s += 0.15 }                 // هم‌موقعیتی (< ~۷۵ متر) = شاهدِ قوی
  const ov = overlap(toks(x.title), toks(y.title)); w += 0.35; s += 0.35 * ov
  return w ? s / Math.max(w, 0.9) : 0
}

export const DUP_THRESHOLD = 0.85

// کلیدهای بلوکه‌کردن (محله / سطلِ ~۵متریِ متراژ) — مقایسه فقط داخلِ بلوک، نه O(n²).
export function blockKeys(f: SimFields): string[] {
  const ks: string[] = []
  if (f.hood) ks.push(`${f.deal}|h:${f.hood}`)
  if (f.area) ks.push(`${f.deal}|a:${Math.round(f.area / 5)}`)
  if (!ks.length) ks.push(`${f.deal}|x`)
  return ks
}

// ایندکسِ بلوکه‌شدهٔ سبک برای جست‌وجوی «هم‌ملک» در یک مجموعه (مثلاً هنگامِ ingest).
export class TwinIndex<T> {
  private blocks = new Map<string, { f: SimFields; ref: T }[]>()
  add(f: SimFields, ref: T) {
    for (const k of blockKeys(f)) { let a = this.blocks.get(k); if (!a) { a = []; this.blocks.set(k, a) } a.push({ f, ref }) }
  }
  // بهترین هم‌ملک با شباهت ≥ آستانه (یا null).
  find(f: SimFields, threshold = DUP_THRESHOLD): T | null {
    let best: T | null = null, bestS = threshold - 1e-9
    const seen = new Set<{ f: SimFields; ref: T }>()
    for (const k of blockKeys(f)) {
      const arr = this.blocks.get(k); if (!arr) continue
      for (const c of arr) {
        if (seen.has(c)) continue
        seen.add(c)
        const s = similarity(c.f, f)
        if (s > bestS) { bestS = s; best = c.ref }
      }
    }
    return best
  }
}
