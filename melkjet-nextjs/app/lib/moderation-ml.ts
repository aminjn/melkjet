import { join } from 'path'
import type { Item } from './scraper-store'
import { readJsonCached, writeJsonCached } from './json-file'

// ── مدلِ یادگیرندهٔ ممیزیِ آگهی (Naive Bayes، بدونِ کتابخانهٔ بیرونی) ─────────────
// از هر تصمیمِ «تأیید/رد» (چه هوش مصنوعی، چه ادمین) یاد می‌گیرد. وقتی به‌اندازهٔ کافی
// نمونه دید و به پیش‌بینی‌اش مطمئن بود، خودش تصمیم می‌گیرد و دیگر AI صدا زده نمی‌شود.
// دادهٔ آموزش در .moderation-ml-data.json (مثلِ بقیهٔ storeها، gitignore).

const FILE = join(process.cwd(), '.moderation-ml-data.json')
const MODEL_V = 1
const MIN_PER_CLASS = 40   // حداقل نمونه در هر کلاس تا مدل «آماده» شود
const CONFIDENCE = 0.92    // آستانهٔ اطمینان تا مدل خودش (بدونِ AI) تصمیم بگیرد

export type MLabel = 'approved' | 'rejected'
interface ClassStat { docs: number; total: number; tok: Record<string, number> }
interface MLData { v: number; approved: ClassStat; rejected: ClassStat; autoDecided: number; aiDecided: number; adminTaught: number; updatedAt: number }

function cls(): ClassStat { return { docs: 0, total: 0, tok: {} } }
function empty(): MLData { return { v: MODEL_V, approved: cls(), rejected: cls(), autoDecided: 0, aiDecided: 0, adminTaught: 0, updatedAt: 0 } }
function load(): MLData { const d = readJsonCached<MLData | null>(FILE, null); return d && d.v === MODEL_V ? d : empty() }
function save(d: MLData) { writeJsonCached(FILE, d) }

// پاک‌کردنِ کاملِ مدلِ یادگیرنده — وقتی مدل «مسموم» شده (از دادهٔ غلطِ قبلی رد یاد گرفته)
// و باید از صفر با تصمیم‌های درست دوباره یاد بگیرد.
export function resetMl(): void { save(empty()) }

function faToEn(s: string): string { return (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) }
function norm(s: string): string { return (s || '').replace(/‌/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() }
// فاز ۵۴ (فیدبک: «به‌خاطرِ واژهٔ فرشته رد کرد!»): واژه‌های عمومی/بازاریابی/دامنهٔ املاک از ویژگی‌ها حذف —
// این‌ها در آگهیِ سالم و ناسالم یکسان می‌آیند و فقط مدل را گمراه می‌کنند.
const STOP = new Set(['در', 'با', 'و', 'به', 'از', 'که', 'این', 'برای', 'یک', 'را', 'های', 'می', 'تا', 'رو', 'هم', 'یا', 'شده', 'است',
  'ببینید', 'اعتبار', 'پیشنهاد', 'ویژه', 'فروش', 'اجاره', 'خرید', 'آپارتمان', 'ملک', 'واحد', 'برج', 'پروژه', 'سند', 'طبقه', 'متر', 'متری', 'متراژ',
  'قیمت', 'تومان', 'میلیارد', 'میلیون', 'امکانات', 'کامل', 'عالی', 'لوکس', 'شیک', 'نوساز', 'بسیار', 'جهت', 'مورد', 'بدون', 'دارای', 'داخل',
  'روی', 'بین', 'اگر', 'ولی', 'باشد', 'باشید', 'کنید', 'هست', 'هستش', 'میباشد', 'شما', 'تماس', 'بگیرید', 'مشاور', 'املاک', 'آماده', 'تحویل',
  'شرکت', 'سازنده', 'رسمی', 'قرارداد', 'ساعات', 'پاسخگویی', 'صبح', 'الی', 'تهران'])

// ویژگی‌های یک آگهی: کلماتِ عنوان/توضیحات/موقعیت + نشانه‌های مهندسی‌شده (اسپم/کیفیت).
export function featuresOf(it: Partial<Item>): string[] {
  const title = it.title || ''
  const ex = (it.excerpt || '').slice(0, 800)
  const words = norm(`${title} ${ex} ${it.location || ''}`).split(/[\s,،.\/\-+*()!؟?:؛]+/).filter(t => t.length >= 3 && !STOP.has(t)).slice(0, 90)
  const f = [...words]
  if (title.length < 12) f.push('#short'); else if (title.length > 55) f.push('#long')
  f.push(it.price ? '#has_price' : '#no_price')
  // فاز ۵۴ (فیکسِ باگ): وجودِ فیلدِ متراژ یعنی متراژ دارد — قبلاً واژهٔ «متر» را در «مقدارِ عددی» می‌گشت
  // و هر آگهیِ متراژدار #no_area می‌گرفت (یکی از پایه‌های ردهای الکی).
  f.push(/متر|متراژ/.test(title) || !!String(it.meta?.['متراژ'] || '').trim() ? '#has_area' : '#no_area')
  if (/(?:^|\D)0?9\d{9}/.test(faToEn(ex + ' ' + title))) f.push('#phone_in_text')     // شمارهٔ تماس در متن = نشانهٔ اسپم
  if (/https?:\/\/|www\.|@\w|تلگرام|واتساپ|اینستا/.test(ex)) f.push('#contact_in_text')
  if (it.meta?.['نوع معامله']) f.push('#has_deal')
  if (ex.length < 20) f.push('#thin_desc')
  const priceTxt = faToEn(it.price || '')
  const nums = (priceTxt.match(/\d[\d,]*/g) || []).map(n => parseInt(n.replace(/,/g, ''), 10)).filter(n => n > 0)
  const price = nums.length ? Math.max(...nums) : 0
  f.push('#pb' + (price <= 0 ? 'x' : price < 1e8 ? 'lo' : price < 1e9 ? '0' : price < 1e10 ? '1' : price < 5e10 ? '2' : '3'))
  return f
}

// آموزش از یک تصمیم (تأیید/رد). teacher='admin' وزنِ بیشتری برای شمارش دارد (تصحیحِ انسانی).
export function learn(it: Partial<Item>, label: MLabel, teacher: 'ai' | 'admin' = 'ai'): void {
  if (label !== 'approved' && label !== 'rejected') return
  const d = load()
  const c = d[label]
  const reps = teacher === 'admin' ? 2 : 1   // تصحیحِ ادمین دوبار شمرده می‌شود
  for (let r = 0; r < reps; r++) {
    c.docs++
    for (const t of featuresOf(it)) { c.tok[t] = (c.tok[t] || 0) + 1; c.total++ }
  }
  if (teacher === 'admin') d.adminTaught++
  d.updatedAt = Date.now()
  save(d)
}

export interface MLPrediction { label: MLabel; prob: number; ready: boolean; confident: boolean }
export function predict(it: Partial<Item>): MLPrediction {
  const d = load()
  const ap = d.approved, rj = d.rejected
  const ready = ap.docs >= MIN_PER_CLASS && rj.docs >= MIN_PER_CLASS
  const V = new Set([...Object.keys(ap.tok), ...Object.keys(rj.tok)]).size || 1
  const totalDocs = ap.docs + rj.docs || 1
  const toks = featuresOf(it)
  const logp = (c: ClassStat) => {
    let lp = Math.log((c.docs + 1) / (totalDocs + 2))
    for (const t of toks) lp += Math.log(((c.tok[t] || 0) + 1) / (c.total + V))
    return lp
  }
  const la = logp(ap), lr = logp(rj)
  const m = Math.max(la, lr)
  const pa = Math.exp(la - m), pr = Math.exp(lr - m)
  const probApprove = pa / (pa + pr)
  const label: MLabel = probApprove >= 0.5 ? 'approved' : 'rejected'
  const prob = Math.max(probApprove, 1 - probApprove)
  return { label, prob, ready, confident: ready && prob >= CONFIDENCE }
}

// ── توضیح‌پذیریِ تصمیمِ مدل (خواستهٔ صریح: «هوش مصنوعی که رد می‌کند باید دلیلش را بگوید») ──
// وزنِ هر ویژگی = log-odds به سمتِ کلاسِ پیش‌بینی‌شده؛ پرچم‌های مهندسی‌شده به فارسیِ قابل‌فهم ترجمه می‌شوند
// و واژه‌های متنی به «شباهت به آگهی‌های ردشده/تأییدشدهٔ قبلی». هیچ دلیلی از هوا نمی‌آید — همان محاسبهٔ خودِ مدل است.
const FEATURE_FA: Record<string, string> = {
  '#short': 'عنوانِ خیلی کوتاه',
  '#long': 'عنوانِ خیلی بلند',
  '#no_price': 'قیمت ثبت نشده',
  '#no_area': 'متراژ مشخص نیست',
  '#phone_in_text': 'شمارهٔ تماس داخلِ متن (نشانهٔ اسپم)',
  '#contact_in_text': 'لینک یا آیدیِ تماس در توضیحات',
  '#thin_desc': 'توضیحاتِ خیلی کوتاه و ناقص',
  '#pbx': 'قیمتِ نامشخص یا نامعتبر',
  '#pblo': 'قیمتِ غیرعادی پایین',
}
export function explainPrediction(it: Partial<Item>, top = 3): { label: MLabel; prob: number; reasons: string[] } {
  const d = load()
  const ap = d.approved, rj = d.rejected
  const V = new Set([...Object.keys(ap.tok), ...Object.keys(rj.tok)]).size || 1
  const p = predict(it)
  const toward = p.label === 'rejected' ? rj : ap
  const other = p.label === 'rejected' ? ap : rj
  const w = (t: string) => Math.log(((toward.tok[t] || 0) + 1) / (toward.total + V)) - Math.log(((other.tok[t] || 0) + 1) / (other.total + V))
  const scored = [...new Set(featuresOf(it))].map(t => ({ t, w: w(t) })).filter(x => x.w > 0).sort((a, b) => b.w - a.w)
  const reasons: string[] = []
  for (const x of scored) {
    if (reasons.length >= top) break
    if (x.t.startsWith('#')) { const fa = FEATURE_FA[x.t]; if (fa) reasons.push(fa) }
  }
  if (reasons.length < top) {
    const words = scored.filter(x => !x.t.startsWith('#') && x.t.length >= 3).slice(0, 3).map(x => x.t)
    if (words.length) reasons.push(p.label === 'rejected'
      ? `شباهت به آگهی‌های ردشدهٔ قبلی (واژه‌های «${words.join('»، «')}»)`
      : 'شباهت به آگهی‌های سالمِ تأییدشده')
  }
  return { label: p.label, prob: p.prob, reasons: reasons.slice(0, top) }
}

// فاز ۵۴ — قانونِ سختِ جدید: «شباهتِ صرفاً واژه‌ای هرگز حقِ ردِ خودکار ندارد». این تابع می‌گوید شواهدِ
// ردِ مدل شاملِ کدام نشانه‌های ساختاری (#phone_in_text، #pbx و…) است؛ اگر هیچ، رد فقط واژه‌ای است.
export function rejectEvidenceOf(it: Partial<Item>): { hard: string[]; hardFa: string[]; wordsOnly: boolean } {
  const d = load()
  const ap = d.approved, rj = d.rejected
  const V = new Set([...Object.keys(ap.tok), ...Object.keys(rj.tok)]).size || 1
  const w = (t: string) => Math.log(((rj.tok[t] || 0) + 1) / (rj.total + V)) - Math.log(((ap.tok[t] || 0) + 1) / (ap.total + V))
  const hard = [...new Set(featuresOf(it))].filter(t => t.startsWith('#') && FEATURE_FA[t] && w(t) > 0)
  return { hard, hardFa: hard.map(t => FEATURE_FA[t]), wordsOnly: hard.length === 0 }
}

export function noteDecision(via: 'ml' | 'ai'): void {
  const d = load()
  if (via === 'ml') d.autoDecided++; else d.aiDecided++
  save(d)
}

export function mlStats() {
  const d = load()
  const ready = d.approved.docs >= MIN_PER_CLASS && d.rejected.docs >= MIN_PER_CLASS
  return {
    approvedSamples: d.approved.docs, rejectedSamples: d.rejected.docs,
    ready, minPerClass: MIN_PER_CLASS, confidence: CONFIDENCE,
    autoDecided: d.autoDecided, aiDecided: d.aiDecided, adminTaught: d.adminTaught, updatedAt: d.updatedAt,
  }
}
