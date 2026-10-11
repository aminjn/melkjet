// فاز ۳۰۱ (بازنویسیِ ۳۰۱ب) — «نویسندهٔ آگهیِ یادگیرنده»: متنِ منسجم و روان، گراندشده روی فکت‌های
// واقعیِ خودِ آگهی، با «واژگانِ واقعیِ مشاورها» که از دادهٔ واقعی (کشِ غنی‌سازیِ دیوار) رتبه‌بندی شده‌اند.
//
// درسِ نسخهٔ قبل: «چسباندنِ جمله‌های تصادفیِ آگهی‌های مختلف» متنِ بی‌ربط و ادعاییِ تأییدنشده می‌ساخت
// («تک واحدی پاسیو اختصاصی»). حالا فقط صفت‌های «نرمِ امنِ» واقعی (دلباز/نورگیر/…) استفاده می‌شوند و
// بقیهٔ متن از فکت‌های دادهٔ خودِ کاربر ساخته می‌شود — روان، یکتا، و بدونِ جعل.

import { listItems, type Item } from './scraper-store'
import { getEnrichment } from './enrich-store'
import type { ListingFields } from './listing-copy'

// ارقامِ لاتینِ متن را برای نمایش به فارسی برمی‌گرداند («۹۵متری» نه «95متری») — قاعدهٔ RTLِ پروژه.
const FA = '۰۱۲۳۴۵۶۷۸۹'
const faShow = (s: string) => String(s || '').replace(/[0-9]/g, d => FA[+d])
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const maybe = (p = 0.5) => Math.random() < p
function take<T>(a: T[], n: number): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]] }
  return b.slice(0, Math.min(n, b.length))
}

// صفت‌های «نرمِ امن» (توصیفِ عمومیِ استانداردِ تبلیغاتی — نه ادعای سختِ راستی‌آزمایی‌پذیر).
// همهٔ این‌ها واژگانِ واقعیِ مشاورهاست؛ از دیتا «رتبه‌بندی» می‌شوند (کدام پرکاربردترند) ولی خودِ فهرست
// امن است تا هیچ ادعای نادرستی (نوساز/سند/ویو/پاسیو…) تزریق نشود.
const SAFE_DESC = ['دلباز', 'نورگیر', 'آفتاب‌گیر', 'دنج', 'خوش‌نقشه', 'کاربردی', 'تمیز', 'شیک', 'جمع‌وجور', 'باصفا', 'آرام', 'روشن', 'صمیمی', 'مرتب', 'نقلی', 'دلنشین']
// خطِ «نرمِ» پایانی/کیفی (بدونِ ادعای مکان/عددِ خاص).
const SOFT_LINE = ['فضایی مناسب برای سکونتِ راحت', 'انتخابی مطمئن برای زندگی', 'با چیدمانی اصولی و بدونِ پرتِ فضا', 'محیطی آرام و بی‌دغدغه', 'مناسبِ سلیقه‌های گوناگون', 'گزینه‌ای ارزشمند برای سکونت یا سرمایه‌گذاری']

export interface WriterCorpus { builtAt: number; n: number; descCount: Record<string, number> }
const TTL = 6 * 3600_000
let CORPUS: WriterCorpus | null = null
let buildingAt = 0

/** پیکره را فقط برای «رتبه‌بندیِ واژگان» می‌سازد: کدام صفت‌های امن در آگهی‌های واقعی پرتکرارترند. سبک و امن. */
export function buildWriterCorpusFrom(samples: { text?: string }[]): WriterCorpus {
  const descCount: Record<string, number> = {}
  let n = 0
  for (const s of samples) {
    const t = s.text || ''
    if (t.length < 20) continue
    n++
    for (const d of SAFE_DESC) if (t.includes(d)) descCount[d] = (descCount[d] || 0) + 1
  }
  return { builtAt: Date.now(), n, descCount }
}

export async function ensureWriterCorpus(): Promise<WriterCorpus | null> {
  if (CORPUS && Date.now() - CORPUS.builtAt < TTL) return CORPUS
  if (Date.now() - buildingAt < 30_000 && CORPUS) return CORPUS
  buildingAt = Date.now()
  try {
    const items = (await listItems('listing')) as Item[]
    const samples: { text?: string }[] = []
    for (const it of items) {
      const e = getEnrichment(it.id)
      const text = (e?.description && e.description.length > (it.excerpt?.length || 0)) ? e.description : (it.excerpt || '')
      if (text) samples.push({ text })
    }
    CORPUS = buildWriterCorpusFrom(samples)
  } catch { /* پیکرهٔ قبلی را نگه دار */ }
  return CORPUS
}

// صفت‌ها را بر اساسِ تکرار در دادهٔ واقعی مرتب می‌کند؛ اگر پیکره نبود، خودِ فهرستِ امن.
function descriptorPool(c: WriterCorpus | null): string[] {
  if (!c || !c.n) return [...SAFE_DESC]
  const seen = SAFE_DESC.filter(d => (c.descCount[d] || 0) > 0)
  return seen.length >= 4 ? seen : [...SAFE_DESC]
}

const floorText = (floor?: string, total?: string): string => {
  if (!floor) return ''
  if (floor === 'همکف') return 'همکف'
  if (/\+/.test(floor)) return `طبقهٔ ${floor.replace(/\+/g, '')} به بالا`
  return `طبقهٔ ${floor}${total ? ` از ${total}` : ''}`
}

// فهرست را فارسی‌وار می‌چسباند: «الف، ب و ج».
const joinFa = (a: string[]): string => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join('، ')} و ${a[a.length - 1]}`
const toEnNum = (s: string) => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())

// جملهٔ «سن/سالِ ساخت» — گراندشده روی خودِ سال. «کم‌سن» واقعیتِ محاسبه‌شده از سال است، نه ادعا.
function ageLine(age?: string): string {
  if (!age) return ''
  const a = String(age).trim()
  if (/نوساز|کلید.?نخورد|صفر|تازه.?ساز/.test(a)) return pick([`بنایی ${a} و تمیز.`, `ساختمانی ${a}.`, `${a}.`])
  const yr = parseInt(toEnNum(a).replace(/\D/g, ''), 10)
  const cur = new Date().getFullYear() - 621
  if (Number.isFinite(yr) && yr >= 1300 && yr <= cur) {
    const diff = cur - yr
    if (diff <= 6) return pick([`ساختِ ${a} و بنایی کم‌سن با استهلاکِ پایین.`, `سالِ ساختِ ${a}؛ ساختمانی به‌نسبت تازه و کم‌استهلاک.`])
    if (diff <= 15) return pick([`سالِ ساختِ ${a}.`, `ساختِ ${a}.`])
    return pick([`سالِ ساختِ ${a}.`, `بنایی جاافتاده با ساختِ ${a}.`])
  }
  return pick([`سنِ بنا ${a}.`, `ساختِ ${a}.`])
}

/** توضیحاتِ حرفه‌ای، روان و «پر»: چند بندِ تعریف‌کننده که فقط از فکت‌های واقعیِ همین آگهی ساخته
 *  می‌شوند (بدونِ جعلِ هیچ ادعای راستی‌آزمایی‌پذیر). هر بار چینش/واژگان فرق می‌کند تا یکتا بماند. */
export async function writeDescriptionFromData(f: ListingFields): Promise<string | null> {
  const c = await ensureWriterCorpus().catch(() => null)
  const pool = descriptorPool(c)
  const type = f.propertyType || 'ملک'
  const isRent = f.deal === 'اجاره'
  const loc = f.hood || f.city || ''
  const dealWord = isRent ? pick(['آمادهٔ اجاره', 'برای اجاره', 'آمادهٔ واگذاری به‌صورتِ اجاره']) : pick(['آمادهٔ فروش', 'برای فروش', 'آمادهٔ واگذاری'])
  const adjs = take(pool, 2)
  const areaTxt = f.area ? `${f.area} متری` : ''

  // بندِ ۱ — قلابِ معرفی (نوع + صفت‌های امن + متراژ + موقعیت + معامله)
  const headBits = [`${type}${adjs.length ? `ِ ${joinFa(adjs)}` : ''}`, areaTxt, loc ? `در ${loc}` : ''].filter(Boolean)
  const p1 = `${headBits.join(' ')}، ${dealWord}.` + ' ' + pick(['🏠', '✨', '📍', ''])

  // بندِ ۲ — فضا و اتاق‌ها، با قابِ سبکِ‌زندگی (بدونِ ادعای متراژیِ «جادار» که به عدد وابسته است)
  // ارقامِ فارسیِ اتاق را هم بپذیر (Number('۳')=NaN وگرنه «۳ خوابه» می‌افتاد).
  const roomsN = (f.rooms != null && f.rooms !== '') ? Number(toEnNum(String(f.rooms)).replace(/\D/g, '')) : NaN
  const rooms = Number.isFinite(roomsN) ? roomsN : null
  const ft = floorText(f.floor, f.totalFloors)
  const subject = type.includes('آپارتمان') ? pick(['این واحد', 'این آپارتمان'])
    : (type.includes('ویلا') || type.includes('خانه')) ? pick(['این خانه', 'این ملک'])
    : pick(['این ملک', 'این واحد'])
  const spaceBits: string[] = []
  if (rooms != null) spaceBits.push(rooms === 0 ? 'به‌صورتِ سوئیت (بدونِ اتاقِ خواب)' : `${rooms} خوابه`)
  if (ft) spaceBits.push(ft)
  let p2 = ''
  if (spaceBits.length) {
    const fam = rooms != null && rooms >= 3 ? pick(['، فضایی مناسب برای یک خانوادهٔ پرجمعیت', '، درخورِ یک زندگیِ خانوادگیِ راحت', '']) : ''
    p2 = `${subject} ${joinFa(spaceBits)} است${fam}.`
  }

  // بندِ ۳ — امکاناتِ واقعی (در جملهٔ روانِ تعریف‌کننده) + سنِ بنا
  const feats = [f.parking && 'پارکینگ', f.elevator && 'آسانسور', f.storage && 'انباری', f.patio && 'پاسیو'].filter(Boolean) as string[]
  const featLine = feats.length ? pick([
    `از امکاناتِ آن ${joinFa(feats)} است که آسایشِ روزمره را کامل می‌کند.`,
    `${pick(['بهره‌مند از', 'مجهز به', 'دارای'])} ${joinFa(feats)} است.`,
    `امکاناتی همچون ${joinFa(feats)} رفاهِ ساکنان را تأمین می‌کند.`,
  ]) : ''
  const p3 = [featLine, ageLine(f.age)].filter(Boolean).join(' ')

  // بندِ ۴ — موقعیت و ارزش (نرم و عمومی، بدونِ ادعای خاصِ راستی‌آزمایی‌پذیر مثل «۵ دقیقه تا مترو»)
  const locLine = loc ? pick([
    `موقعیتِ ${loc} دسترسیِ مناسب به امکاناتِ روزمره را فراهم می‌کند.`,
    `قرارگیری در ${loc} از نقاطِ قوتِ این ملک است.`,
    `${loc} یکی از موقعیت‌های مناسب برای ${isRent ? 'سکونت' : 'سکونت و سرمایه‌گذاری'} به شمار می‌رود.`,
    '',
  ]) : ''
  const soft = maybe(0.55) ? pick(SOFT_LINE) + '.' : ''
  const p4 = [locLine, soft].filter(Boolean).join(' ')

  // بندِ دسترسی‌ها — فقط دادهٔ واقعیِ نقشه (NexaMap)؛ گراندشده، با قیدِ «طبقِ نقشه» تا ادعا به‌نظر نرسد.
  const near = (f.nearby || []).filter(Boolean).slice(0, 4)
  const pNear = near.length ? `${pick(['دسترسی‌های نزدیک (طبقِ نقشه): ', 'از نظرِ دسترسی و طبقِ نقشه، نزدیک به ', 'در همسایگیِ این ملک (طبقِ نقشه): '])}${joinFa(near)}.` : ''

  // CTA
  const cta = (f.advisorName
    ? pick([`برای هماهنگیِ بازدید با ${f.advisorName} تماس بگیرید.`, `${f.advisorName} آمادهٔ پاسخ‌گویی و هماهنگیِ بازدید است.`, `جهتِ بازدید و اطلاعاتِ بیشتر با ${f.advisorName} در تماس باشید.`])
    : pick([`برای بازدید و اطلاعاتِ بیشتر تماس بگیرید.`, `برای هماهنگیِ بازدید در تماس باشید.`])) + ' ' + pick(['🔑', '🏠', '📞', ''])

  const blocks = [p1, p2, p3, pNear, p4, cta].filter(s => s && s.trim())
  const out = faShow(blocks.join('\n\n').replace(/[ \t]+/g, ' ').trim())
  return out.length > 40 ? out : null
}

/** فقط برای تست: تزریقِ پیکره بدونِ خواندن از دیتابیس. */
export function __setWriterCorpus(c: WriterCorpus | null) { CORPUS = c; buildingAt = Date.now() }

export async function writerCorpusStats(): Promise<{ ready: boolean; samples: number; vocab: number }> {
  const c = await ensureWriterCorpus()
  return { ready: !!c, samples: c?.n || 0, vocab: c ? Object.keys(c.descCount).length : 0 }
}
