import { fetchDivarProfileTokens, fetchDivarPost, divarProfileSlug, type BrandPost } from './divar-post'
import { aiFor, resolveAgent } from './gapgpt'
import { knownNames, learnName } from './agency-roster-ml'
const { chatCompleteSafe } = aiFor('رصدِ مشاورانِ آژانس')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// ── خوشه‌بندیِ آگهی‌های یک آژانسِ دیوار به تفکیکِ مشاور، از روی «امضای» داخلِ آگهی ──
// ورودی: لینک/slugِ آژانس. خروجی: هر مشاورِ متمایز (بر اساسِ اسمِ امضاشده) + آگهی‌هایش،
// و سطلِ «بی‌نام» (آگهی‌های بدونِ امضا) که به خودِ آژانس نسبت داده می‌شود.
//
// نکته: شماره از API درنمی‌آید (گِیت است) و شناسهٔ پایدارِ مشاور هم عمومی نیست (contact_uuid
// per-آگهی است). تنها سیگنالِ per-مشاور، «اسمِ امضاشده در متنِ آگهی» است — که همین‌جا با
// heuristic + (اختیاری) AI استخراج و نرمال می‌شود. کلید فقط «برچسبِ گروه‌بندی» است، نه هویتِ جهانی؛
// چون دامنه به یک آژانس محدود است، تصادمِ نام («هزار شایان») بی‌اثر است.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const ZWNJ = /‌/g
// نرمال‌سازیِ کلیدِ خوشه: فارسی → یکدست، لاتین → CAPS، فاصله/نیم‌فاصله حذف.
function keyOf(name: string): string {
  const s = String(name || '').replace(ZWNJ, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
  return /^[A-Za-z]+$/.test(s) ? s.toUpperCase() : s
}

// حروفِ لاتینِ فاصله‌دار را جمع می‌کند: "S H A Y G A N" → "SHAYGAN".
function collapseSpacedLatin(t: string): string {
  return t.replace(/(?:[A-Za-z]\s){2,}[A-Za-z]/g, m => m.replace(/\s+/g, ''))
}

const DECOR = '\\u2728\\u2b50\\u2605\\u2733\\ufe0f\\u2734\\u2795\\u274c\\u2705\\u2666\\ud83d\\udd37\\ud83d\\udd36\\*\\u2022\\u25c6\\u25aa\\u066d'
const STOPWORDS = new Set([
  'فروش', 'خرید', 'اجاره', 'ودیعه', 'رهن', 'ملک', 'املاک', 'مشاور', 'کارشناس', 'گروه', 'دپارتمان', 'تخصصی',
  'آپارتمان', 'اداری', 'تجاری', 'ویلا', 'مسکونی', 'شما', 'واحد', 'کد', 'وضعیت', 'طبقه', 'سلام',
  'احترام', 'قیمت', 'تایید', 'تأیید', 'آگهی', 'تماس', 'شماره', 'موبایل', 'آژانس', 'مسکن',
  'متری', 'متراژ', 'نوساز', 'کلنگی', 'بازسازی', 'فول', 'معاوضه', 'فوری', 'بازدید',
  'تحویل', 'اقساط', 'اقساطی', 'نقد', 'نقدی', 'سند', 'وام', 'پارکینگ', 'آسانسور', 'انباری',
  'ویژه', 'ما', 'شما', 'ان', 'آن', 'این', 'ها', 'های', 'بهترین', 'عالی', 'تخفیف', 'شرایط', 'بدون',
  'نمایندگی', 'خدمات', 'ویترین', 'همکار', 'همکاران', 'ارزان', 'حراج', 'استثنایی', 'تضمین', 'کیفیت', 'برج', 'مجتمع', 'سوییت', 'دفترکار', 'مغازه', 'زمین', 'باغ',
  'به', 'با', 'از', 'در', 'که', 'تا', 'را', 'هم', 'یا', 'برای', 'جهت', 'دلیل', 'بازار', 'نوسان',
  'استعلام', 'مشغول', 'هماهنگی', 'باشید', 'بگیرید', 'دارای', 'سابقه', 'شعبه', 'فعال', 'مجرب', 'روز',
  'راهنمایی', 'راهنما', 'مشتریان', 'مشتری', 'گرامی', 'عزیز', 'محترم', 'تماس', 'مشاوره', 'خرید', 'فروش',
])

// واژه‌های دامنهٔ ملک (نوعِ ملک/امکانات + کدهای لاتینِ رایج) — اینها «اسمِ مشاور» نیستند و نباید
// به‌عنوانِ امضا برداشته شوند (همان الگوی خودروجت که مدل/برند را رد می‌کرد).
const CAR_TOKENS = new Set<string>()
{
  const add = (s: string) => { const n = keyOf(s); if (n.length >= 2) CAR_TOKENS.add(n) }
  for (const t of ['آپارتمان', 'ویلا', 'پنت‌هاوس', 'سوییت', 'کلنگی', 'مغازه', 'دفترکار', 'دفتر کار', 'زمین', 'باغ', 'باغچه', 'برج', 'مجتمع', 'مستغلات', 'همکف', 'دوبلکس', 'تریپلکس', 'نوساز', 'بازسازی', 'شهرک', 'اقساط', 'مسکونی', 'اداری', 'تجاری', 'صنعتی', 'کشاورزی', 'ویلایی', 'آپارتمانی']) add(t)
  for (const t of ['VIP', 'FULL', 'BASE', 'PRO', 'PLUS', 'MAX', 'GT', 'TOP', 'LUX', 'LUXURY', 'HOME', 'HOUSE', 'VILLA', 'TOWER', 'RESIDENCE', 'PENTHOUSE', 'OFFICE', 'SUITE', 'DUPLEX']) CAR_TOKENS.add(t)
}

// عناوین/القاب (خودِ اینها اسم نیستند؛ «خانم رضایی» → «رضایی»، «خانم» تنها → رد).
const TITLES = new Set(['خانم', 'آقا', 'آقای', 'اقا', 'اقای', 'جناب', 'سرکار', 'مهندس', 'دکتر', 'حاج', 'حاجی', 'استاد', 'همکار', 'مدیر', 'مدیریت', 'فروشنده', 'مشاور', 'کارشناس', 'آقایان', 'اقایان'].map(keyOf))

// پاک‌سازیِ نام: حذفِ القاب و کلماتِ نوفه/خودرو از ابتدا و میانِ کاندیدا.
function cleanName(s: string): string {
  return s.split(/\s+/).filter(Boolean).filter(w => { const k = keyOf(w); return !TITLES.has(k) && !STOPWORDS.has(w) && !CAR_TOKENS.has(k) }).join(' ').trim()
}

// آیا این کاندیدا نامِ واقعیِ شخص/آژانس است یا نوفه/مدلِ خودرو؟
function isBadName(v: string): boolean {
  const words = v.split(/\s+/).filter(Boolean)
  if (!words.length) return true
  if (words.some(w => w.length < 2)) return true                       // تکه‌های تک‌حرفی مثل «ی تایید»
  if (words.length >= 2 && words.every(w => w.length <= 2)) return true // تکه‌های کوتاهِ مثلِ «ان ما»
  if (CAR_TOKENS.has(keyOf(v))) return true                            // کلِ نام یک مدل/برند است
  if (words.every(w => STOPWORDS.has(w) || CAR_TOKENS.has(keyOf(w)))) return true  // همه‌اش کلمهٔ نوفه/خودرو
  if (/^\d+$/.test(keyOf(v))) return true
  return false
}

// نامِ نهاییِ معتبر یا خالی: پاک‌سازیِ القاب/نوفه + ردِ نامِ خراب + ردِ نامِ خودِ آژانس.
export function validName(s: string, agencyName = ''): string {
  const v = cleanName((s || '').trim())
  if (!v || v.length < 2 || v.length > 24 || isBadName(v)) return ''
  const k = keyOf(v), a = keyOf(agencyName)
  if (a && k.length >= 2 && (k === a || a.includes(k) || k.includes(a))) return ''   // خودِ آژانس امضا نیست
  return v
}

// تطبیقِ لغوی با «نام‌های آموخته‌شده»: اگر یکی از نام‌های تأییدشدهٔ قبلی در متنِ آگهی باشد،
// همان را برمی‌گرداند — قطعی، رایگان، بدونِ AI. هستهٔ «یادگیریِ تدریجیِ ماشین».
// هر کاراکترِ غیرِ (حرفِ فارسی/لاتین، رقم، فاصله، ZWNJ) → فاصله. اموجی/نماد (♀️✅☑️☎️…) که به اسم
// می‌چسبند و مرزِ کلمه را از بین می‌برند، این‌طور جدا می‌شوند. کلیدِ رفعِ «♀️محمدی».
const deEmoji = (s: string) => String(s || '').replace(/[^ء-ی‌\sA-Za-z0-9۰-۹:：.\-،_]/g, ' ')
const normTxt = (s: string) => (' ' + deEmoji(s).replace(/‌/g, '').replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک') + ' ')
function lexiconMatch(text: string, learned: { name: string }[]): string {
  if (!learned.length) return ''
  const t = normTxt(text)
  let best = ''
  for (const { name } of learned) {
    const n = String(name || '').replace(/‌/g, '').replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
    if (n.length < 3) continue                                   // نامِ خیلی کوتاه ریسکِ تطبیقِ اشتباه دارد
    const multi = n.includes(' ')
    const hit = multi
      ? t.includes(' ' + n + ' ') || t.includes(' ' + n)          // نامِ چند-کلمه‌ای: عبارتِ کامل
      : new RegExp(`(?:^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(t)  // تک‌کلمه: مرزِ کلمه
    if (hit && n.length > best.length) best = name                // بلندترین (دقیق‌ترین) تطبیق
  }
  return best
}

// استخراجِ «امضای واقعیِ» آگهی. فقط دو سیگنالِ قابلِ اعتماد:
// (۱) بلوکِ تزئینیِ برند، (۲) نامِ پس از کلیدواژهٔ «مشاور/کارشناس/امضا/…».
// حدسِ «خطِ اولِ متن» حذف شد — منبعِ اصلیِ نوفه بود (آریس صنعت/فروش ویژه/«ی»/«خانم»).
export function extractSignature(title: string, desc: string, agencyName = ''): string[] {
  const raw = collapseSpacedLatin(`${title || ''}\n${desc || ''}`)
  const flat = deEmoji(raw)   // اموجی/نماد → فاصله؛ اسمِ چسبیده به اموجی جدا می‌شود
  const out: string[] = []
  const push = (s?: string) => { const v = validName(s || '', agencyName); if (v && !out.includes(v)) out.push(v) }

  // ۱) بلوکِ تزئینی: بین دو رشتهٔ نماد ( ✦✦✦ SHAYGAN ✦✦✦ / ✨ ملکی ✨ / ✴️SHAYAN✴️ ) — روی متنِ اصلی.
  const deco = new RegExp(`[${DECOR}]{1,8}\\s*([A-Za-z\\u0622-\\u06cc][A-Za-z\\u0622-\\u06cc]{1,22})\\s*[${DECOR}]`, 'g')
  for (const m of raw.matchAll(deco)) push(m[1])

  // ۲) نام پس از عنوان (سرکار خانم/خانم/آقای/جناب …): «کارشناس فروش: سرکار خانم کامرانی».
  for (const m of flat.matchAll(/(?:سرکار\s+)?(?:خانم|آقای?|جناب|مهندس|دکتر|حاج|حاجی|استاد)\s+([ء-ی]{2,15}(?:\s+[ء-ی]{2,15})?)/g)) push(m[1])

  // ۳) نام پس از کلیدواژهٔ امضا (بدونِ عنوان). (?![آ-ی]) جلوی «کارشناسیِ تایید»→«کارشناس» را می‌گیرد.
  for (const m of flat.matchAll(/(?:کارشناسِ?\s*فروش|مشاورِ?\s*فروش|کارشناس|مشاور|فروشنده|امضا|با\s*احترام)(?![ء-ی])\s*[:：\.\-]*\s*([A-Za-zء-ی][A-Za-zء-ی]{1,15}(?:\s+[A-Za-zء-ی]{2,15})?)/g)) push(m[1])

  // ۴) دنبالهٔ امضا: پس از «کارشناس/مشاور فروش» یا «راهنمایی/هماهنگی/تماس»، اولین نامِ معتبرِ ادامه.
  //    «کارشناس فروش جهت راهنمایی ♀️محمدی» → «محمدی» (جهت/راهنمایی stopword‌اند، ♀️ حالا فاصله است).
  for (const m of flat.matchAll(/(?:کارشناسِ?\s*فروش|مشاورِ?\s*فروش|جهتِ?\s*راهنمایی|جهتِ?\s*هماهنگی|هماهنگی|راهنمایی|جهتِ?\s*تماس|با\s*احترام|امضا)([ء-ی\s]{1,45})/g)) {
    const ws = (m[1] || '').trim().split(/\s+/).filter(Boolean)
      .filter(w => { const k = keyOf(w); return !TITLES.has(k) && !STOPWORDS.has(w) && !CAR_TOKENS.has(k) })
    if (ws.length) push(ws.slice(0, 2).join(' '))
  }

  // ۵) نامِ چسبیده به اموجیِ شخص («🙍‍♀️رضایی» / «👤کریمی») — روی متنِ اصلی، اموجیِ آدم/دست فقط.
  const PERSON = '\\u{1F464}-\\u{1F469}\\u{1F481}\\u{1F482}\\u{1F470}\\u{1F935}\\u{1F64B}-\\u{1F64F}\\u{1F9D0}-\\u{1F9DF}\\u{1F471}\\u{1F474}\\u{1F475}'
  const CONNECT = '\\u{200D}\\u{FE0F}\\u{2640}\\u{2642}\\u{1F3FB}-\\u{1F3FF}\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}'
  const re5 = new RegExp(`[${PERSON}][${CONNECT}]*\\s*((?:سرکار\\s+)?(?:خانم|آقای?|جناب|مهندس|دکتر|حاج)?\\s*[ء-ی]{2,15}(?:\\s+[ء-ی]{2,15})?)`, 'gu')
  for (const m of raw.matchAll(re5)) push(m[1])

  return out
}

// (اختیاری) پالایشِ AI: نامِ کانونیِ مشاورِ هر آگهی را برمی‌گرداند (فارسی؛ خالی اگر امضا نبود).
// دسته‌ای صدا زده می‌شود تا هزینهٔ AI کم بماند. اگر مدل نبود/خطا داد → [] (تکیه بر heuristic).
async function aiCanonical(items: { i: number; title: string; desc: string }[]): Promise<{ map: Record<number, string>; raw: string }> {
  const { model, provider } = resolveAgent([['content', 'text'], ['chat', 'text']])
  if (!model) return { map: {}, raw: '(هیچ مدلی تنظیم نشده)' }
  // اموجی/نماد را به فاصله تبدیل می‌کنیم تا اسمِ چسبیده به اموجی («♀️محمدی») برای AI هم خوانا شود.
  const clip = (s: string) => { const d = deEmoji(s || '').replace(/\s+/g, ' ').trim(); return d.length > 1200 ? d.slice(0, 300) + ' … ' + d.slice(-800) : d }
  const list = items.map(it => `${it.i}) ${deEmoji(it.title || '').slice(0, 80)} :: ${clip(it.desc)}`).join('\n')
  const sys = 'تو نامِ «فروشنده/مشاور/کارشناسِ فروشِ» هر آگهیِ ملک را از متن درمی‌آوری تا آگهی‌های یک آژانسِ املاک به تفکیکِ مشاور جدا شوند. ' +
    'نکتهٔ مهم: نامِ فروشنده تقریباً همیشه در «انتهای» متن است، بعد از عبارت‌هایی مثلِ «کارشناس فروش»، «مشاور فروش»، «جهت راهنمایی»، «جهت هماهنگی»، «با تشکر». مثال: «کارشناس فروش جهت راهنمایی محمدی» → نام = «محمدی». «مشاور فروش: خانم کامرانی» → «کامرانی». ' +
    'قواعد: (۱) فقط نامِ واقعیِ شخص (فارسی، مثل «علی رضایی» یا «محمدی» یا «مهدی») یا امضای برند (مثل «SHAYGAN»). ' +
    '(۲) هرگز نوعِ ملک/واژهٔ ملکی را برنگردان (آپارتمان، ویلا، پنت‌هاوس، سوییت، کلنگی، متراژ، نوساز و…). ' +
    '(۳) نامِ خودِ آژانس (مثلِ «املاک سعادت») اسمِ مشاور نیست → خالی. ' +
    '(۴) القاب را حذف کن: «خانم رضایی»→«رضایی». «خانم/آقا» به‌تنهایی = خالی. ' +
    '(۵) عبارتِ تبلیغاتی («فروش ویژه»، «تضمین بهترین خرید»، «کارشناسی رایگان»، «جهت راهنمایی») اسم نیست → خالی. ' +
    '(۶) اگر اسمِ واقعیِ فروشنده در متن نبود، خالی بگذار (حدس نزن). ' +
    'خروجی فقط JSON، بدونِ توضیح: [{"i":<شماره>,"name":"<نام یا خالی>"}]'
  const out = await Promise.race([
    chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: list }], { temperature: 0, max_tokens: 1500 }, provider),
    new Promise<string>(r => setTimeout(() => r('(تایم‌اوت ۳۰ثانیه)'), 30000)),
  ])
  const map: Record<number, string> = {}
  try {
    const j = JSON.parse((out.match(/\[[\s\S]*\]/) || ['[]'])[0])
    for (const r of j) if (r && typeof r.i === 'number' && typeof r.name === 'string' && r.name.trim()) map[r.i] = r.name.trim()
  } catch {}
  return { map, raw: out }
}

export interface RosterAdvisor { key: string; name: string; tokens: string[]; posts: BrandPost[] }
export interface AgencyRoster {
  ok: boolean; error?: string
  slug: string; agencyName?: string
  total: number; scanned: number
  advisors: RosterAdvisor[]
  unnamed: { tokens: string[]; posts: BrandPost[] }   // بدونِ امضا → به خودِ آژانس
}

// ساختِ رُسترِ کامل: همهٔ آگهی‌های آژانس → استخراجِ امضا → خوشه‌بندی.
// throttle‌شده؛ باید روی اینستنسِ ۰ اجرا شود (مثلِ بقیهٔ اسکرپ‌ها).
export async function buildAgencyRoster(
  slugOrUrl: string,
  opts: { useAI?: boolean; maxDetails?: number; onProgress?: (done: number, total: number) => void;
    cached?: Record<string, { title: string; desc: string }>;   // توکن→متنِ قبلاً اسکرپ‌شده (ازسرگیری)
    onRow?: (token: string, r: { title: string; desc: string }) => void } = {},
): Promise<AgencyRoster> {
  // توکنِ برندِ دیوار حساس به بزرگ/کوچکیِ حروف است — هرگز lowercase نکن.
  const slug = (divarProfileSlug(slugOrUrl) || String(slugOrUrl || '').trim())
  const base: AgencyRoster = { ok: false, slug, total: 0, scanned: 0, advisors: [], unnamed: { tokens: [], posts: [] } }
  if (!slug || !/^[A-Za-z0-9_-]{2,}$/.test(slug)) return { ...base, error: 'slug/لینکِ برند نامعتبر است' }

  const { posts, name, reason } = await fetchDivarProfileTokens(slug)
  if (!posts.length) return { ...base, agencyName: name, error: reason === 'unreachable' ? 'به دیوار نرسید (پروکسی؟)' : 'آگهی‌ای یافت نشد' }

  // همهٔ آگهی‌ها پردازش می‌شوند (سقفِ ایمنی ۳۰۰۰). هر آگهی جزئیات + throttle دارد، پس سینکِ بزرگ
  // چند دقیقه طول می‌کشد — با ازسرگیری و heartbeat مشکلی نیست و در پنجرهٔ شبانه اجرا می‌شود.
  const maxDetails = Math.max(1, Math.min(opts.maxDetails ?? 3000, posts.length))
  // برای هر آگهی: عنوان + توضیحات را می‌گیریم و کاندیدای امضا را می‌سازیم.
  const rows: { post: BrandPost; title: string; desc: string; cand: string[] }[] = []
  for (let i = 0; i < maxDetails; i++) {
    const p = posts[i]
    let title = p.title || '', desc = ''
    // ازسرگیری فقط اگر متنِ کامل کش شده باشد. کشِ desc-خالی (از دورهٔ پروکسیِ مرده) دوباره گرفته
    // می‌شود تا اسمِ آخرِ متن از دست نرود (باگِ «خانم هرمزی → بی‌نام»).
    const hit = opts.cached?.[p.token]
    if (hit && hit.desc) { title = (hit.title || title || '').trim(); desc = hit.desc.trim() }
    else {
      try { const d = await fetchDivarPost(p.token); title = (d.title || title || '').trim(); desc = (d.description || '').trim() } catch {}
      try { opts.onRow?.(p.token, { title, desc }) } catch {}   // چک‌پوینت برای ازسرگیری
      await sleep(600)   // نرخِ کندتر تا دیوار زیرِ فشار آگهی‌ها را رد نکند (fetchDivarPost خودش retry هم دارد)
    }
    rows.push({ post: p, title, desc, cand: extractSignature(title, desc, name) })
    try { opts.onProgress?.(i + 1, maxDetails) } catch {}
  }

  // پالایشِ AI (اختیاری) — نامِ کانونی جای بهترین کاندیدای heuristic را می‌گیرد.
  let aiMap: Record<number, string> = {}
  if (opts.useAI !== false) {
    for (let i = 0; i < rows.length; i += 12) {
      const chunk = rows.slice(i, i + 12).map((r, k) => ({ i: i + k, title: r.title, desc: r.desc }))
      try { Object.assign(aiMap, (await aiCanonical(chunk)).map) } catch {}
    }
  }

  // نام‌های آموخته‌شدهٔ قبلی (مدلِ یادگیرنده) — برای تطبیقِ قطعیِ بدونِ AI.
  const learned = await knownNames(1)
  const toLearn = new Set<string>()   // نام‌های تأییدشدهٔ این دور → به مدل اضافه می‌شوند

  // خوشه‌بندی — اولویت: (۱) نامِ آموخته‌شده در متن، (۲) AI، (۳) heuristic. همه از گیتِ validName.
  const clusters = new Map<string, RosterAdvisor>()
  const unnamed: { tokens: string[]; posts: BrandPost[] } = { tokens: [], posts: [] }
  rows.forEach((r, idx) => {
    const lex = validName(lexiconMatch(`${r.title}\n${r.desc}`, learned), name)
    const ai = lex ? '' : validName(aiMap[idx] || '', name)
    const chosen = lex || ai || validName(r.cand[0] || '', name)
    if (!chosen) { unnamed.tokens.push(r.post.token); unnamed.posts.push(r.post); return }
    if (ai) toLearn.add(ai)                 // نامِ تأییدشدهٔ AI → یادگیری برای دفعهٔ بعد (مستقل از AI)
    const k = keyOf(chosen)
    let c = clusters.get(k)
    if (!c) { c = { key: k, name: chosen, tokens: [], posts: [] }; clusters.set(k, c) }
    c.tokens.push(r.post.token); c.posts.push(r.post)
  })

  // یادگیریِ تدریجی: نام‌هایی که AI این دور تأیید کرد را حفظ کن تا دفعهٔ بعد خودِ ماشین بشناسد.
  for (const nm of toLearn) { try { await learnName(nm, 'ai') } catch {} }

  const advisors = [...clusters.values()].sort((a, b) => b.tokens.length - a.tokens.length)
  return { ok: true, slug, agencyName: name, total: posts.length, scanned: rows.length, advisors, unnamed }
}

// ── عیب‌یابی: n آگهیِ واقعی را اسکرپ می‌کند و می‌گوید چند تا «متنِ خالی» دارند (واکشیِ دیوار fail
//    شده؟) و چند تا با AI/heuristic اسم گرفتند و چند تا بی‌نام ماندند — با نمونهٔ کاملِ بی‌نام‌ها. ──
export async function debugRoster(slugOrUrl: string, n = 30): Promise<any> {
  const slug = (divarProfileSlug(slugOrUrl) || String(slugOrUrl || '').trim())
  let gapModel = ''
  try { const { model } = resolveAgent([['content', 'text'], ['chat', 'text']]); gapModel = model || '' } catch { /* بدونِ مدل */ }

  const { posts, name, reason } = await fetchDivarProfileTokens(slug)
  if (!posts.length) return { ok: false, error: reason || 'آگهی‌ای یافت نشد', gapModel }

  const learned = await knownNames(1)
  const rows: { i: number; token: string; title: string; desc: string }[] = []
  for (let i = 0; i < Math.min(n, posts.length); i++) {
    const p = posts[i]; let title = p.title || '', desc = ''
    try { const d = await fetchDivarPost(p.token); title = (d.title || title || '').trim(); desc = (d.description || '').trim() } catch {}
    rows.push({ i, token: p.token, title, desc })
    await sleep(600)
  }

  // AI را دقیقاً مثلِ تولید، دسته‌ایِ ۱۲تایی صدا می‌زنیم و پاسخِ خامِ دستهٔ اول را نگه می‌داریم.
  let aiMap: Record<number, string> = {}, aiError = '', aiRaw = ''
  try {
    for (let i = 0; i < rows.length; i += 12) {
      const chunk = rows.slice(i, i + 12).map(r => ({ i: r.i, title: r.title, desc: r.desc }))
      const res = await aiCanonical(chunk)
      Object.assign(aiMap, res.map)
      if (!aiRaw) aiRaw = res.raw
    }
  } catch (e: any) { aiError = String(e?.message || e) }

  let emptyDesc = 0, byAI = 0, byHeur = 0, byLex = 0, unnamed = 0
  const evaluated = rows.map(r => {
    const lex = lexiconMatch(`${r.title}\n${r.desc}`, learned)
    const heur = extractSignature(r.title, r.desc, name)[0] || ''
    const ai = aiMap[r.i] || ''
    const chosen = validName(lex || ai || heur || '', name)
    if (!r.desc) emptyDesc++
    if (chosen) { if (lex) byLex++; else if (ai && validName(ai, name)) byAI++; else byHeur++ } else unnamed++
    return { token: r.token, title: r.title.slice(0, 70), descLen: r.desc.length, desc: r.desc.replace(/\s+/g, ' '), ai, heuristic: heur, lexicon: lex, chosen: chosen || '' }
  })
  // نمونهٔ کاملِ بی‌نام‌ها (تا ۱۲ تا) — با متنِ کامل تا ببینیم چرا اسم پیدا نشد.
  const unnamedSamples = evaluated.filter(e => !e.chosen).slice(0, 12)
    .map(e => ({ token: e.token, descLen: e.descLen, desc: e.desc.slice(0, 900) }))
  return {
    ok: true, agencyName: name, totalAds: posts.length,
    gapModel: gapModel || '(هیچ مدلی برای AI تنظیم نشده)', learnedNames: learned.length, aiError,
    aiRawFirstBatch: (aiRaw || '').slice(0, 800),   // پاسخِ خامِ AI برای دستهٔ اول — تا ببینیم چه برمی‌گرداند
    summary: { sampled: rows.length, emptyDesc, namedByAI: byAI, namedByHeuristic: byHeur, namedByLexicon: byLex, unnamed },
    unnamedSamples,
  }
}
