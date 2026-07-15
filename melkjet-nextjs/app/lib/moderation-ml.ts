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
interface MLData {
  v: number; approved: ClassStat; rejected: ClassStat
  autoDecided: number; aiDecided: number; adminTaught: number; updatedAt: number
  // فاز ۷۷ (اندازه‌گیری): اصلاح‌های ادمین + پنجرهٔ ارزیابیِ اخیر — «مدل به چه نقطه‌ای رسیده» باید عدد داشته باشد
  corrections: number                                        // چند بار ادمین تصمیمِ خودکار را برگرداند (سیگنالِ خطای مدل)
  recent: Array<{ at: number; pred: MLabel; final: MLabel }> // آخرین بازبینی‌های انسانی: پیش‌بینیِ سیستم در برابرِ حکمِ نهایی
}

function cls(): ClassStat { return { docs: 0, total: 0, tok: {} } }
function empty(): MLData { return { v: MODEL_V, approved: cls(), rejected: cls(), autoDecided: 0, aiDecided: 0, adminTaught: 0, updatedAt: 0, corrections: 0, recent: [] } }
function load(): MLData { const d = readJsonCached<MLData | null>(FILE, null); if (!d || d.v !== MODEL_V) return empty(); d.corrections = d.corrections || 0; d.recent = Array.isArray(d.recent) ? d.recent : []; return d }
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
  // فاز ۱۳۸: موبایل فقط با پیشوندِ 0/+98 و بدونِ رقمِ بعدی — قیمتِ بی‌جداکنندهٔ ۱۰+رقمی که با ۹ شروع
  // می‌شود (مثل «۹۵۰۰۰۰۰۰۰۰ تومان») دیگر «شماره» حساب نمی‌شود (یکی از پایه‌های ردِ الکی).
  if (/(?:^|[^\d+])(?:\+?98\s?|0)9\d{9}(?!\d)/.test(faToEn(ex + ' ' + title))) f.push('#phone_in_text')     // شمارهٔ تماس در متن = نشانهٔ اسپم
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
  const reps = teacher === 'admin' ? 3 : 1   // فاز ۷۷: حکمِ ادمین ۳ برابرِ AI وزن دارد — «دستی می‌زنم که یاد بگیرد» باید واقعاً اثر کند
  for (let r = 0; r < reps; r++) {
    c.docs++
    for (const t of featuresOf(it)) { c.tok[t] = (c.tok[t] || 0) + 1; c.total++ }
  }
  if (teacher === 'admin') d.adminTaught++
  d.updatedAt = Date.now()
  save(d)
}

// فاز ۷۷: از-یاد-بردن — وقتی ادمین تصمیمِ خودکار را برمی‌گرداند، فقط «یادگیریِ کلاسِ درست» کافی نیست؛
// شمارشِ همان ویژگی‌ها از کلاسِ غلط هم کم می‌شود تا الگوی مسموم (مثلِ «گول/نخور» در آگهی‌های سالم) واقعاً پاک شود.
export function unlearn(it: Partial<Item>, label: MLabel, reps = 1): void {
  const d = load()
  const c = d[label]
  for (let r = 0; r < reps; r++) {
    if (c.docs > 0) c.docs--
    for (const t of featuresOf(it)) { if ((c.tok[t] || 0) > 0) { c.tok[t]--; c.total = Math.max(0, c.total - 1); if (!c.tok[t]) delete c.tok[t] } }
  }
  d.updatedAt = Date.now()
  save(d)
}

// یادگیریِ اصلاحی از حکمِ ادمین: اگر حکمِ قبلیِ سیستم برعکس بود، اول از کلاسِ غلط unlearn می‌شود (۲ بار —
// هم‌وزنِ آموزشِ اشتباهِ قبلی + یک گام جلوتر)، بعد با وزنِ ادمین در کلاسِ درست یاد می‌گیرد. هر بازبینیِ انسانی
// در پنجرهٔ recent ثبت می‌شود تا «دقتِ مدل روی داوریِ انسانی» قابلِ‌اندازه‌گیری باشد.
export function correctFromAdmin(it: Partial<Item>, final: MLabel, prev?: MLabel): void {
  const d0 = load()
  const flipped = !!prev && prev !== final
  d0.recent.push({ at: Date.now(), pred: prev || final, final })
  d0.recent = d0.recent.slice(-300)
  if (flipped) d0.corrections++
  save(d0)
  if (flipped) unlearn(it, prev!, 2)
  learn(it, final, 'admin')
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

// ── فاز ۱۳۸ (فیدبک: «کلی آگهی را به‌خاطرِ واژه‌هایی که مشکل نیست رد می‌کند») ─────────────
// مدرکِ «قطعی و قابلِ‌نمایشِ» تماس در متن — تنها مجوزِ ردِ خودکار. هر مدرک، خودِ تکهٔ مچ‌شده را
// نقل می‌کند تا ادمین دقیقاً ببیند چه چیزی رد را رقم زده؛ نه پرچمِ فازی، نه شباهتِ واژه‌ای.
// نکته: صرفِ آمدنِ واژهٔ «تلگرام/واتساپ/اینستاگرام» بدونِ لینک/آیدی/شماره مدرک نیست (→ بازبینیِ انسانی).
export function contactEvidenceOf(it: Partial<Item>): string[] {
  const text = `${it.title || ''}\n${(it.excerpt || '').slice(0, 1200)}`
  const en = faToEn(text)
  const out: string[] = []
  const phone = en.match(/(?:^|[^\d+])((?:\+?98\s?|0)9\d{9})(?!\d)/)
  if (phone) out.push(`شمارهٔ موبایلِ «${phone[1].trim()}» داخلِ متن`)
  const link = text.match(/https?:\/\/[^\s]{4,60}|www\.[^\s]{3,60}|t\.me\/[^\s]{2,40}|instagram\.com\/[^\s]{2,40}|wa\.me\/[^\s]{2,40}/i)
  if (link) out.push(`لینکِ «${link[0].slice(0, 48)}» داخلِ متن`)
  const idm = en.match(/@[a-z][a-z0-9_.]{3,31}/i)
  if (idm) out.push(`آیدیِ «${idm[0]}» داخلِ متن`)
  return out
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
  // فاز ۷۷: دقتِ مدل روی داوریِ انسانیِ اخیر — تنها معیارِ صادقانهٔ «به کجا رسیده»: چند درصدِ بازبینی‌های
  // انسانیِ اخیر با پیش‌بینیِ سیستم هم‌نظر بودند. بدونِ بازبینیِ انسانی، عددی ادعا نمی‌شود.
  const win = d.recent.slice(-100)
  const agree = win.filter(x => x.pred === x.final).length
  return {
    approvedSamples: d.approved.docs, rejectedSamples: d.rejected.docs,
    vocab: new Set([...Object.keys(d.approved.tok), ...Object.keys(d.rejected.tok)]).size,
    ready, minPerClass: MIN_PER_CLASS, confidence: CONFIDENCE,
    autoDecided: d.autoDecided, aiDecided: d.aiDecided, adminTaught: d.adminTaught,
    corrections: d.corrections,
    recentReviewed: win.length,
    recentAgreePct: win.length ? Math.round((agree / win.length) * 100) : null,
    updatedAt: d.updatedAt,
  }
}
