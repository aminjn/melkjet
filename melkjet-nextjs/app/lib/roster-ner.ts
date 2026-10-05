// برچسب‌زنِ توکنِ نامِ مشاور — جایگزینِ «دسته‌بندیِ رشته».
//
// چرا بازنویسی شد: مدلِ قبلی می‌پرسید «آیا رشتهٔ X نام است؟» و فقط از آمارِ سراسری
// جواب می‌داد. برای همین «لطفی هستم» را نام می‌دید و «مرادی» را در «کارشناس املاک :
// مرادی» نمی‌دید — و ما مجبور بودیم جای ویژگیِ گم‌شده قاعده بگذاریم. سؤالِ درست
// این است: «در این متن کدام توکن نامِ مشاور است؟» که جوابش به بافتِ محلی بستگی دارد.
//
// برچسب‌ها از دادهٔ خودمان می‌آیند: ۲۲۳ مشاورِ فارغ‌التحصیل (نامِ تأییدشدهٔ مدیر +
// شماره + فهرستِ توکنِ آگهی‌ها). در هر آگهی، توکنِ برابر با آن نام مثبت است و بقیهٔ
// توکن‌های ناحیهٔ امضا منفی. هر تأییدِ تازهٔ مدیر خودکار به دادهٔ آموزشی اضافه می‌شود.
import { kvGet, kvSet } from './db'
import { deEmoji, keyOf, isNoiseWord } from './agency-name-lexicon'
import { getCorpus, norm, type Corpus } from './roster-name-model'

export const NER_KV = 'roster_ner_model'
const KEYW = /(کارشناس|مشاور|فروشنده|املاک|مسکن|امضا|احترام|تشکر|هماهنگی|راهنمایی|تماس)/
const SUFFIX = /(?:زاده|نژاد|پور|یان|فرد|منش|مهر|راد|نیا|لو|فر|مند|خواه|طلب|دوست|بخش|ی)$/
// صورتِ فعلی: «بزارید» از «شماره‌تون رو بزارید»، «بگیرید» از «تماس بگیرید».
// نامِ آدم پیشوندِ ب/می/ن با پایانِ ید/ند/یم ندارد. ویژگی است، نه دروازه.
const VERBISH = /^(?:ب|می|نمی|ن)[\u0621-\u06cc]{2,}(?:ید|ند|یم)$|(?:ایید|یید|مایید)$/

export interface Tok { w: string; line: number; iDoc: number; iLine: number; keyDist: number; sigLine: boolean }

/** توکن‌های ناحیهٔ جست‌وجو: خطوطِ دارای کلیدواژه + سه خطِ پایانی. همان ناحیه‌ای که
 *  در آموزش و در استنتاج استفاده می‌شود، وگرنه توزیعِ ویژگی‌ها جابه‌جا می‌شود. */
export function tokenize(desc: string): { toks: Tok[]; nLines: number; nDoc: number } {
  const lines = deEmoji(String(desc || '')).split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  const toks: Tok[] = []
  let iDoc = 0
  lines.forEach((line, li) => {
    const sigLine = KEYW.test(line)
    const parts = line.split(/([^\u0621-\u06ccA-Za-z]+)/)
    let keyDist = 99, iLine = 0
    for (const p of parts) {
      if (!/[\u0621-\u06ccA-Za-z]/.test(p)) continue
      if (KEYW.test(p)) { keyDist = 0 } else if (keyDist < 99) keyDist++
      if (p.length > 1) {
        if (sigLine || li >= lines.length - 3) toks.push({ w: p, line: li, iDoc, iLine, keyDist, sigLine })
        iLine++
      }
      iDoc++
    }
  })
  return { toks, nLines: lines.length, nDoc: Math.max(1, iDoc) }
}

export const NER_FEATURES = [
  'bias', 'logB', 'logS', 'sigRatio', 'agSpread', 'afterKey', 'afterAddr',
  'keyNear', 'inSigLine', 'posDoc', 'lineFromEnd', 'prevKey',
  'nextB', 'nextSig', 'prevSig', 'suffix', 'lenNorm', 'inTitle', 'repeat', 'noiseWord', 'verbish',
] as const

const ST = (c: Corpus | null, w: string) => c?.get(norm(w)) || { b: 0, s: 0, ag: 0, k: 0, a: 0 }

/** بردارِ ویژگیِ یک توکن در بافتِ خودش. هیچ قاعده‌ای اینجا نیست — فقط اندازه‌گیری. */
export function featsOf(
  toks: Tok[], i: number, nLines: number, nDoc: number, titleSet: Set<string>, c: Corpus | null,
): number[] {
  const t = toks[i]
  const st = ST(c, t.w)
  const prev = i > 0 ? toks[i - 1] : null
  const next = i + 1 < toks.length ? toks[i + 1] : null
  const stPrev = prev ? ST(c, prev.w) : { b: 0, s: 0, ag: 0, k: 0, a: 0 }
  const stNext = next ? ST(c, next.w) : { b: 0, s: 0, ag: 0, k: 0, a: 0 }
  const rep = toks.filter(x => x.w === t.w).length
  return [
    1,
    Math.log1p(st.b) / 8,
    Math.log1p(st.s) / 8,
    st.s / (st.s + st.b + 1),
    Math.min(1, st.ag / 40),
    st.k / (st.k + st.b + 1),
    st.a / (st.a + st.k + 1),
    t.keyDist >= 99 ? 0 : Math.max(0, 1 - t.keyDist / 6),   // نزدیکیِ توکنی به کلیدواژه
    t.sigLine ? 1 : 0,
    t.iDoc / nDoc,                                          // نام معمولاً انتهای متن است
    Math.max(0, 1 - (nLines - 1 - t.line) / 5),
    prev && KEYW.test(prev.w) ? 1 : 0,
    Math.log1p(stNext.b) / 8,                               // «لطفی هستم»: بعدی خیلی پرتکرار
    stNext.s / (stNext.s + stNext.b + 1),
    stPrev.s / (stPrev.s + stPrev.b + 1),
    SUFFIX.test(t.w) ? 1 : 0,
    Math.min(1, t.w.length / 10),
    titleSet.has(keyOf(t.w)) ? 1 : 0,                       // نام در عنوان نمی‌آید
    Math.min(1, rep / 3),
    isNoiseWord(t.w) ? 1 : 0,                               // ویژگی است، نه دروازه
    VERBISH.test(t.w) ? 1 : 0,
  ]
}

export const titleTokens = (title: string) =>
  new Set(deEmoji(String(title || '')).split(/[^\u0621-\u06ccA-Za-z]+/).filter(Boolean).map(keyOf))

export interface NerModel { w: number[]; trainedAt: number; n: number; metrics?: Record<string, number> }
let NER: NerModel | null = null
export async function loadNer(): Promise<NerModel | null> {
  await loadSparse().catch(() => false)
  if (NER) return NER
  const m = await kvGet<NerModel | null>(NER_KV, null)
  if (m && Array.isArray(m.w) && m.w.length === NER_FEATURES.length) NER = m
  return NER
}
export async function saveNer(m: NerModel) { NER = m; await kvSet(NER_KV, m) }

const sig = (z: number) => 1 / (1 + Math.exp(-z))
export const dot = (x: number[], w: number[]) => sig(x.reduce((s, v, i) => s + v * (w[i] || 0), 0))

export function trainNer(X: number[][], y: number[], epochs = 500, lr = 0.5, l2 = 0.01): number[] {
  const d = X[0]?.length || NER_FEATURES.length
  const w = new Array(d).fill(0)
  const nPos = y.reduce((s, v) => s + v, 0), nNeg = y.length - nPos
  const wP = nPos ? y.length / (2 * nPos) : 1, wN = nNeg ? y.length / (2 * nNeg) : 1
  for (let e = 0; e < epochs; e++) {
    const g = new Array(d).fill(0)
    for (let i = 0; i < X.length; i++) {
      const p = dot(X[i], w), err = (p - y[i]) * (y[i] ? wP : wN)
      for (let j = 0; j < d; j++) g[j] += err * X[i][j]
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (g[j] / X.length + (j ? l2 * w[j] : 0))
  }
  return w
}

export const NER_THRESHOLD = 0.55

// ── فاز ۲۹۵ — امضای «برچسب‌دار»: مشاور/کارشناس … : نام ────────────────────────
// وقتی خودِ آگهی صریح نوشته «مشاور و کارشناس منطقه:رها» دیگر جای حدسِ مدل نیست؛
// مدل برای این شکل (نامِ چسبیده به دونقطه، نامِ کوتاه/کم‌تکرار) نمره نمی‌داد و آگهی
// بی‌نام می‌ماند (۱ اکتبر — «اسم کارشناس همچنان هست و نمی‌فهمه»). قاعدهٔ دقتِ بالا،
// فقط در ناحیهٔ امضا (۶ خطِ پایانی) و با ردِ واژه‌های نقشی/نویز تا مثبتِ کاذب نسازد.
// فاز ۲۹۷ث — کیس‌استادیِ شاهان: «⚜️ مشاور تخصصی منطقه ~ علیرضا فلاحی» ×۲ بی‌نام مانده بود،
// چون فقط دونقطه جداکننده بود. ~ ـ – — | و خطِ تیره هم جداکننده‌اند. چون خطِ تیره در
// خط‌های امکانات هم رایج است، کلیدواژه «مرزِ کلمهٔ فارسی» گرفت (حروفِ پایه، نه اعراب —
// «کارشناسِ فروش» سالم می‌مانَد) تا «کارشناسی شده - تک برگ» نامِ جعلیِ p=0.98 نسازد؛
// جمع‌ها (مشاورین/مشاوران/کارشناسان) صریح در الگو هستند.
const PBASE = '\\u0621-\\u064A\\u0671-\\u06D5'
// جداکننده: فقط «:» و «-» بعد از deEmoji زنده می‌مانند (بقیه به فاصله می‌شوند). پس ~ – — |
// و تطویل را «پیش از» deEmoji به «:» نرمال می‌کنیم تا به‌عنوان جداکنندهٔ شناخته‌شده بمانند.
const LABELED_SEP = '[:：\\-]'
const LABELED_RE = new RegExp(
  `(?<![${PBASE}])(?:مشاور(?:ین|ان)?|کارشناس(?:ان)?)(?![${PBASE}])[^:：\\-\\n]{0,25}${LABELED_SEP}[ \\t]*([ء-ی]{2,}(?:[ ‌][ء-ی]{2,})?)`,
)
const LABELED_REJECT = /^(?:ملک|املاک|مسکن|خرید|فروش|رهن|اجاره|قیمت|بازدید|پاسخگویی|شماره|منطقه|محدوده|تخصصی|رسمی|ارشد|فایل|شما)$/
// نام‌های ناحیه/محلهٔ تهران که ممکن است بعد از جداکنندهٔ ضعیف بیایند (نه اسمِ آدم).
const PLACE_WORDS = new Set(['غرب', 'شرق', 'شمال', 'جنوب', 'مرکز', 'ونک', 'نیاوران', 'فرمانیه', 'جردن', 'الهیه', 'سعادت', 'پاسداران', 'ولنجک', 'زعفرانیه', 'اختیاریه', 'قیطریه', 'دروس', 'تجریش', 'شهرک', 'گیشا', 'صادقیه', 'پونک', 'ستارخان', 'یوسف‌آباد', 'نیلوفر'])
export function labeledName(desc: string): string | null {
  // فاز ۲۹۷ث۲ — جداکننده‌های ~ – — | ـ را پیش از deEmoji (که آن‌ها را به فاصله می‌کُشد) به «:» نرمال کن.
  const normalized = String(desc || '').replace(/[~ـ–—|]/g, ':')
  const lines = deEmoji(normalized).split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  for (const line of lines.slice(-6)) {
    const m = line.match(LABELED_RE)
    if (!m) continue
    const name = m[1].replace(/‌/g, ' ').trim()
    const toks = name.split(/\s+/)
    if (!toks.length) continue
    if (toks.some(w => KEYW.test(w) || VERBISH.test(w) || LABELED_REJECT.test(w) || isNoiseWord(w))) continue
    // فاز ۲۹۷ث۲ — جداکنندهٔ ضعیف (~ – — |) پیش از نامِ مکان هم می‌آید: «منطقه ~ سعادت‌آباد».
    // چون برچسب‌دار p=0.98 می‌گیرد و از دروازهٔ nameProb رد نمی‌شود، نامِ مکان (پسوندِ آباد/
    // شهر/ده یا واژهٔ ناحیه) اینجا رد می‌شود تا مشاورِ جعلیِ «سعادت آباد» ساخته نشود.
    if (toks.some(w => /(?:آباد|اباد|شهر|پارک)$/.test(w) || PLACE_WORDS.has(w))) continue
    return name
  }
  return null
}

// ── فاز ۲۹۸ل — واژه‌نامهٔ «نامِ کوچک» (ریشه‌ایِ کیس‌استادیِ شاهان) ──────────────────
// چرا این کار ریشه‌ای است و نه وصله: تا امروز نام را با «موقعیت» (بعد از کلیدواژه) و
// «فهرستِ سیاه» پیدا می‌کردیم؛ هر جمله‌بندیِ تازه («کارشناس منطقه محمد طهرانی» بدونِ
// دونقطه) می‌شکست و آگهی بی‌نام می‌ماند. سیگنالِ مثبت بسیار مطمئن‌تر است: «محمد» قطعاً
// نامِ آدم است و هیچ‌وقت واژهٔ ملکی/مکانی نیست. با لنگرِ «نامِ کوچکِ شناخته‌شده» (+ نامِ
// خانوادگیِ پس از آن، یا عنوانِ آقای/خانم) نام را مستقیم می‌گیریم — فارغ از جداکننده.
const FIRST_NAMES = new Set<string>([
  'محمد','علی','رضا','حسن','حسین','مهدی','امیر','سعید','مجید','حمید','وحید','مسعود','مرتضی','مصطفی','جواد','کاظم','ابراهیم','اسماعیل','یوسف','احمد','محمود','محسن','مهران','مهرداد','بهرام','بهزاد','بابک','آرش','آرمان','آرمین','نیما','پیمان','پوریا','پدرام','فرهاد','فرزاد','فریبرز','فرشید','کامران','کاوه','کوروش','داریوش','سیاوش','سهراب','سینا','شهاب','شایان','علیرضا','محمدرضا','امیرحسین','امیرعلی','امیرمحمد','غلامرضا','عباس','قاسم','ناصر','نادر','هادی','هاشم','یاسر','مهیار','میلاد','مجتبی','بهنام','بیژن','پرویز','پژمان','جمشید','جعفر','حامد','خسرو','رامین','رسول','رحیم','سامان','سجاد','شاهین','صادق','صالح','طاها','طه','عارف','عرفان','فاضل','کریم','کیان','کیانوش','مانی','ماکان','مبین','متین','منصور','موسی','نریمان','نوید','هومن','هوشنگ','یحیی','ابوالفضل','اردشیر','اشکان','افشین','اکبر','الیاس','امین','ایمان','بردیا','بهادر','پارسا','پاشا','تورج','جلال','حیدر','داود','داوود','روزبه','سبحان','سروش','سلمان','سهیل','شهرام','شهریار','صدرا','عادل','فربد','فرید','کسری','مازیار','میثم','نیکان','یاشار','مرسل','رامتین','ادریس','عطا',
  // زنانه
  'فاطمه','زهرا','مریم','سارا','نرگس','الهام','نسرین','زینب','معصومه','مرضیه','فرشته','فرزانه','فریبا','فریده','نازنین','نگار','نگین','نیلوفر','نیوشا','هانیه','هدیه','هستی','پریسا','پریا','پرنیان','پگاه','ترانه','حنانه','خدیجه','رقیه','راضیه','رویا','ریحانه','سمانه','سمیرا','سمیه','سودابه','سوگند','شیدا','شیما','شیوا','صدف','طاهره','عاطفه','عسل','غزاله','غزل','فائزه','فرحناز','کتایون','کیمیا','گلناز','لیلا','مائده','مبینا','محدثه','مژگان','مهسا','مهشید','مهناز','مهرناز','مهرنوش','مینا','نادیا','ندا','یاسمن','یگانه','آتنا','آرزو','آناهیتا','الناز','الهه','بهناز','بیتا','پانیذ','پرستو','تارا','تینا','حلما','دینا','راحله','زهره','سپیده','سحر','سلما','سها','سونیا','شهرزاد','شهلا','عارفه','فروغ','فیروزه','ملیکا','ملینا','منیره','نجمه','نسترن','نوشین','هلیا','ویدا','یسنا',
].map(keyOf))
const TITLES_GAZ = new Set<string>(['آقای', 'آقا', 'خانم', 'سرکار', 'جناب', 'مهندس', 'دکتر', 'حاج', 'حاجی', 'استاد', 'مهندسِ'].map(keyOf))
const PLACE_SUFFIX = /(?:آباد|اباد|شهر|پارک|ده|کلا|جان)$/
// آیا این توکن می‌تواند نامِ خانوادگی باشد؟ (فارسی ۲+، نه کلیدواژه/فعل/نویز/مکان/واژهٔ ملکی)
function surnameOk(w: string): boolean {
  if (!w || w.length < 2) return false
  if (!/^[ء-ی‌]+$/.test(w)) return false
  if (KEYW.test(w) || VERBISH.test(w) || LABELED_REJECT.test(w) || isNoiseWord(w)) return false
  const k = keyOf(w)
  if (PLACE_WORDS.has(k) || PLACE_SUFFIX.test(w)) return false
  return true
}
// نامِ لنگرخورده به «نامِ کوچکِ شناخته‌شده» یا «عنوان (آقای/خانم/…)» — فارغ از جداکننده.
// فقط در بلوکِ امضا (۸ خطِ پایانی) تا متنِ آگهی نامِ جعلی نسازد.
const ROLE_ANCHOR = new Set<string>(['کارشناس', 'کارشناسان', 'مشاور', 'مشاورین', 'مشاوران', 'نماینده'].map(keyOf))
// فاز ۲۹۸ه — «نامِ خانوادگیِ تنها» پس از کلیدواژهٔ نقش یا دونقطه: «کارشناس منطقه باقریان»،
// «مشاور شما پارسافر»، «در کنارتان هستیم: فریدمهر». چون نامِ کوچک ندارند، لنگرِ قبلی نمی‌گرفت.
// پسوندِ قویِ نام‌خانوادگی (نه «ی»ِ تنها که «طلایی/آبی» را می‌گیرد) تا نامِ مکان/طلا جعل نشود.
const STRONG_SURNAME = /(?:زاده|نژاد|پور|یان|فرد|منش|مهر|راد|نیا|مند|خواه|طلب|دوست|بخش|فر|لو)$/
function surnameStrong(w: string): boolean {
  return !!w && w.length >= 4 && STRONG_SURNAME.test(w) && surnameOk(w) && !FIRST_NAMES.has(keyOf(w))
}
const toksOfLine = (line: string) => line.split(/[^ء-ی‌]+/).map(w => w.replace(/^‌|‌$/g, '')).filter(w => w.length >= 2)
export function gazetteerName(desc: string): string | null {
  const scan = deEmoji(String(desc || '')).split(/[\n\r]+/).map(l => l.trim()).filter(Boolean).slice(-10)
  for (let L = scan.length - 1; L >= 0; L--) {   // از پایان به بالا (امضا معمولاً آخر است)
    const toks = toksOfLine(scan[L])
    if (!toks.length) continue
    // نخستین «کلیدواژهٔ نقش» روی این خط — لنگرِ نامِ کوچک فقط «پس از» آن معتبر است (وگرنه
    // «خیابان محمد علی جناح» نامِ جعلی می‌سازد). عنوان (آقای/خانم) لنگرِ مستقلِ خودش است.
    let roleIdx = -1
    for (let i = 0; i < toks.length; i++) if (ROLE_ANCHOR.has(keyOf(toks[i]))) { roleIdx = i; break }
    for (let i = 0; i < toks.length; i++) {
      const k = keyOf(toks[i])
      // (الف) عنوان: «خانم شیدایی» / «آقای محمد رضایی»
      if (TITLES_GAZ.has(k) && i + 1 < toks.length) {
        const a = toks[i + 1], b = toks[i + 2]
        if (surnameOk(a)) {
          if (FIRST_NAMES.has(keyOf(a)) && surnameOk(b)) return `${a} ${b}`   // نام کوچک + خانوادگی
          return a                                                             // فقط نامِ خانوادگی پس از عنوان
        }
      }
      // (ب) نامِ کوچکِ شناخته‌شده، فقط پس از کلیدواژهٔ نقشِ همین خط: «کارشناس … محمد طهرانی».
      if (roleIdx >= 0 && i > roleIdx && FIRST_NAMES.has(k)) {
        const b = toks[i + 1]
        if (surnameOk(b) && !FIRST_NAMES.has(keyOf(b))) return `${toks[i]} ${b}`
      }
    }
    // (ب۲) نامِ خانوادگیِ تنها پس از کلیدواژهٔ نقش (تا ۳ واژه بعدتر): «کارشناس منطقه باقریان»،
    // «مشاور شما پارسافر». پسوندِ قوی + ردِ مکان/طلا تا «غرب/طلایی» جعل نشود.
    if (roleIdx >= 0) for (let i = roleIdx + 1; i < toks.length && i <= roleIdx + 3; i++) {
      if (surnameStrong(toks[i])) return toks[i]
    }
    // (د) «… : فامیل» در انتهای خط (معرفیِ بی‌کلیدواژه): «در کنارتان هستیم: فریدمهر».
    const mcol = scan[L].match(/[:：]\s*([ء-ی‌]{4,})\s*$/)
    if (mcol) { const w = mcol[1].replace(/‌/g, '').trim(); if (surnameStrong(w)) return w }
    // (ج) فاز ۲۹۸م — برچسب روی یک خط، نام روی خطِ بعد: «کارشناس ملکی شما ؛ \n احمد باغبانی».
    // بسیار رایج است و مدل آن را از دست می‌داد (و به‌جایش نامِ مکان از آدرس را می‌گرفت، مثلِ
    // «رازقی» از «یاس رز رازقی»). فقط وقتی کلیدواژهٔ نقش نزدیکِ پایانِ خطِ برچسب است (برچسب،
    // نه وسطِ جمله) و خطِ بعد «نامِ کوچکِ شناخته‌شده + خانوادگی» باشد.
    if (roleIdx >= 0 && toks.length - roleIdx <= 4 && L + 1 < scan.length) {
      const nt = toksOfLine(scan[L + 1])
      if (nt.length >= 2 && FIRST_NAMES.has(keyOf(nt[0])) && surnameOk(nt[1]) && !FIRST_NAMES.has(keyOf(nt[1]))) return `${nt[0]} ${nt[1]}`
    }
  }
  return null
}

// فاز ۲۹۷م — معرفیِ صریحِ خود در پایانِ آگهی: «خوشبین هستم در خدمت شما عزیزان».
// «خوشبین» برای مدل صفت است و سکوت می‌کرد → آگهیِ امضادار به آژانس می‌رفت. خطِ امضایی
// که «با یک نام شروع می‌شود و به هستم/هستیم می‌رسد» معرفیِ قطعیِ خود است (قرینهٔ فاز ۲۹۵)؛
// صفت‌های حسی/آمادگی («مفتخر/خوشحال/آماده هستم…») جداگانه رد می‌شوند.
// ⚠️ \b با حروفِ فارسی کار نمی‌کند (مرزِ کلمهٔ JS فقط ASCII است) — lookahead به‌جایش.
const SELF_INTRO_RE = /^(?:بنده\s+|اینجانب\s+|من\s+)?([ء-ی]{2,}(?:[ ‌][ء-ی]{2,})?)\s+(?:هستم|هستیم)(?![ء-ی])/
const SELF_REJECT = /^(?:مفتخر|خوشحال|خرسند|آماده|مشتاق|منتظر|امیدوار|خوشنود|سپاسگزار|ممنون|متشکر|موظف|متعهد|مصمم|افتخار|خدمت|خدمتگزار|همراه|مطمئن|معتقد)$/
export function selfIntroName(desc: string): string | null {
  const lines = deEmoji(String(desc || '')).split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  for (const line of lines.slice(-4)) {
    if (!/هست(?:م|یم)/.test(line)) continue
    const m = line.match(SELF_INTRO_RE)
    if (!m) continue
    const name = m[1].replace(/‌/g, ' ').trim()
    const toks = name.split(/\s+/)
    if (!toks.length) continue
    if (toks.some(w => KEYW.test(w) || VERBISH.test(w) || LABELED_REJECT.test(w) || SELF_REJECT.test(w) || isNoiseWord(w))) continue
    return name
  }
  return null
}

/** نامِ مشاورِ این آگهی، یا خالی. نامِ دوبخشی وقتی ساخته می‌شود که توکنِ همسایه هم
 *  نمرهٔ بالایی داشته باشد — نه با قاعده، بلکه با همان نمرهٔ مدل. */
export function bestName(title: string, desc: string): { name: string; p: number } | null {
  // فاز ۲۹۵ — امضای برچسب‌دارِ صریح بر مدل مقدم است (دقتِ بالا، بدونِ حدس).
  const ln = labeledName(desc)
  if (ln) return { name: ln, p: 0.98 }
  // فاز ۲۹۷م — معرفیِ صریحِ خود («X هستم در خدمت شما») هم بر مدل مقدم است.
  const sn = selfIntroName(desc)
  if (sn) return { name: sn, p: 0.97 }
  // فاز ۲۹۸ل — لنگرِ «نامِ کوچکِ شناخته‌شده»: «کارشناس منطقه محمد طهرانی» (بدونِ جداکننده)
  // که مدل سکوت می‌کرد و labeledName (نیازمندِ «:») نمی‌گرفت. سیگنالِ مثبت و مطمئن، پس
  // بر مدل مقدم و p≥۰.۹۷ (از دروازهٔ nameProb عبور می‌کند — همان مدلی که اینجا کم آورده).
  const gz = gazetteerName(desc)
  if (gz) return { name: gz, p: 0.97 }
  // مدلِ خلوت (۹۵.۲٪) اگر بارگذاری شده باشد، مرجع است؛ چگال (۹۰.۴٪) تورِ ایمنی.
  if (hasSparse()) return bestNameSparse(title, desc)
  const m = NER
  if (!m) return null
  const c = getCorpus()
  const { toks, nLines, nDoc } = tokenize(desc)
  if (!toks.length) return null
  const ts = titleTokens(title)
  const scores = toks.map((_, i) => dot(featsOf(toks, i, nLines, nDoc, ts, c), m.w))
  let bi = 0
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[bi]) bi = i
  if (scores[bi] < NER_THRESHOLD) return null

  // همسایهٔ چسبیده در همان خط، اگر آن هم نمرهٔ بالایی دارد → نامِ دوبخشی
  const near = (j: number) => j >= 0 && j < toks.length && toks[j].line === toks[bi].line &&
    Math.abs(toks[j].iLine - toks[bi].iLine) === 1 && scores[j] >= NER_THRESHOLD * 0.8
  let name = toks[bi].w
  if (near(bi + 1) && (!near(bi - 1) || scores[bi + 1] >= scores[bi - 1])) name = toks[bi].w + ' ' + toks[bi + 1].w
  else if (near(bi - 1)) name = toks[bi - 1].w + ' ' + toks[bi].w
  return { name, p: scores[bi] }
}

// ── مدلِ خلوت با درهم‌سازیِ ویژگی (فاز ۲۸۲) ─────────────────────────────────
// ۲۱ ویژگیِ دست‌ساز به سقفِ ۸۹٪ خورد، چون هر الگو را باید از قبل حدس می‌زدم.
// اینجا خودِ واژه‌ها و سه‌نگاره‌های نویسه‌ای ویژگی می‌شوند: مدل «ـزاده» و «ـید» و
// «لوکیشن» را از داده یاد می‌گیرد، نه از قاعده‌ای که من نوشته باشم.
export const HASH_BITS = 15
const HASH_SIZE = 1 << HASH_BITS
export const DENSE = NER_FEATURES.length
export const SPARSE_DIM = DENSE + HASH_SIZE

function hsh(s: string): number {
  let x = 2166136261
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) }
  return DENSE + ((x >>> 0) % HASH_SIZE)
}

/** سه‌نگاره‌های نویسه‌ای با نشانهٔ مرزِ واژه — ریشه و پسوند خودشان ویژگی می‌شوند. */
function grams(w: string, pre: string): string[] {
  const s = '^' + w + '$'
  const out: string[] = []
  for (let n = 3; n <= 4; n++) for (let i = 0; i + n <= s.length; i++) out.push(pre + s.slice(i, i + n))
  return out
}

export interface Sparse { idx: number[]; val: number[] }

/** بردارِ خلوت: ۲۱ ویژگیِ چگال + هویتِ واژه‌ها + سه‌نگاره‌ها. */
export function sparseFeats(
  toks: Tok[], i: number, nLines: number, nDoc: number, titleSet: Set<string>, c: Corpus | null,
): Sparse {
  const d = featsOf(toks, i, nLines, nDoc, titleSet, c)
  const idx: number[] = [], val: number[] = []
  for (let j = 0; j < d.length; j++) if (d[j] !== 0) { idx.push(j); val.push(d[j]) }
  const t = toks[i]
  const prev = i > 0 ? toks[i - 1].w : '«'
  const next = i + 1 < toks.length ? toks[i + 1].w : '»'
  const add = (s: string, v = 1) => { idx.push(hsh(s)); val.push(v) }
  add('w=' + t.w)
  add('p=' + prev); add('n=' + next)
  add('pn=' + prev + '|' + next)
  add('pw=' + prev + '|' + t.w); add('wn=' + t.w + '|' + next)
  for (const g of grams(t.w, 'g=')) add(g, 0.5)
  for (const g of grams(next, 'ng=')) add(g, 0.3)
  add('len=' + Math.min(9, t.w.length))
  return { idx, val }
}

export const SPARSE_KV = 'roster_ner_sparse'
export interface SparseModel { i: number[]; w: number[]; dim: number; trainedAt: number; n: number; metrics?: Record<string, number> }

let SP: Float64Array | null = null
let SPat = 0                     // زمانِ آخرین بارگذاری
const SP_TTL = 5 * 60_000        // هر ۵ دقیقه دوباره از KV خوانده می‌شود
export function hasSparse(): boolean { return !!SP }

// کشِ دائمی باگ بود: مدلِ بازآموزی‌شده تا ری‌استارتِ پروسه هرگز دیده نمی‌شد،
// پس بازآموزیِ شبانه عملاً بی‌اثر بود. حالا با TTL خودش تازه می‌شود.
export async function loadSparse(force = false): Promise<boolean> {
  if (SP && !force && Date.now() - SPat < SP_TTL) return true
  const m = await kvGet<SparseModel | null>(SPARSE_KV, null)
  if (!m || !Array.isArray(m.i) || !Array.isArray(m.w)) return false
  const a = new Float64Array(m.dim || SPARSE_DIM)
  for (let k = 0; k < m.i.length; k++) a[m.i[k]] = m.w[k]
  SP = a; SPat = Date.now()
  return true
}
/** فقط وزنِ ناصفر ذخیره می‌شود — بیشترِ ۳۲۷۶۸ خانه هرگز دیده نمی‌شوند. */
export async function saveSparse(w: Float64Array, meta: { n: number; metrics?: Record<string, number> }) {
  const i: number[] = [], v: number[] = []
  for (let k = 0; k < w.length; k++) if (w[k] !== 0) { i.push(k); v.push(Number(w[k].toFixed(5))) }
  SP = w; SPat = Date.now()
  await kvSet(SPARSE_KV, { i, w: v, dim: w.length, trainedAt: Date.now(), ...meta })
  return i.length
}

export function dotSparse(f: Sparse, w: Float64Array): number {
  let z = 0
  for (let k = 0; k < f.idx.length; k++) z += w[f.idx[k]] * f.val[k]
  return 1 / (1 + Math.exp(-z))
}

/** SGD با وزنِ متوازنِ کلاس و L2. ترتیبِ نمونه‌ها با LCG مخلوط می‌شود (قطعی و تکرارپذیر). */
export function trainSparse(
  X: Sparse[], y: number[], opts: { epochs?: number; lr?: number; l2?: number } = {},
): Float64Array {
  const epochs = opts.epochs ?? 12, lr0 = opts.lr ?? 0.25, l2 = opts.l2 ?? 1e-6
  const w = new Float64Array(SPARSE_DIM)
  const nPos = y.reduce((s, v) => s + v, 0), nNeg = y.length - nPos
  const cwP = nPos ? y.length / (2 * nPos) : 1, cwN = nNeg ? y.length / (2 * nNeg) : 1
  const order = new Int32Array(X.length)
  for (let i = 0; i < X.length; i++) order[i] = i
  let seed = 12345
  for (let e = 0; e < epochs; e++) {
    for (let i = X.length - 1; i > 0; i--) {      // مخلوطِ Fisher–Yates با LCG
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const j = seed % (i + 1); const t = order[i]; order[i] = order[j]; order[j] = t
    }
    const lr = lr0 / (1 + e * 0.3)
    for (let k = 0; k < order.length; k++) {
      const i = order[k], f = X[i]
      const p = dotSparse(f, w)
      const g = (p - y[i]) * (y[i] ? cwP : cwN)
      for (let j = 0; j < f.idx.length; j++) {
        const ix = f.idx[j]
        w[ix] -= lr * (g * f.val[j] + l2 * w[ix])
      }
    }
  }
  return w
}

/** نامِ آگهی با مدلِ خلوت (اگر بارگذاری شده باشد). */
export function bestNameSparse(title: string, desc: string): { name: string; p: number } | null {
  if (!SP) return null
  const c = getCorpus()
  const { toks, nLines, nDoc } = tokenize(desc)
  if (!toks.length) return null
  const ts = titleTokens(title)
  const sc = toks.map((_, i) => dotSparse(sparseFeats(toks, i, nLines, nDoc, ts, c), SP!))
  let bi = 0
  for (let i = 1; i < sc.length; i++) if (sc[i] > sc[bi]) bi = i
  if (sc[bi] < NER_THRESHOLD) return null
  const near = (j: number) => j >= 0 && j < toks.length && toks[j].line === toks[bi].line &&
    Math.abs(toks[j].iLine - toks[bi].iLine) === 1 && sc[j] >= NER_THRESHOLD * 0.8
  let name = toks[bi].w
  if (near(bi + 1) && (!near(bi - 1) || sc[bi + 1] >= sc[bi - 1])) name = toks[bi].w + ' ' + toks[bi + 1].w
  else if (near(bi - 1)) name = toks[bi - 1].w + ' ' + toks[bi].w
  return { name, p: sc[bi] }
}
