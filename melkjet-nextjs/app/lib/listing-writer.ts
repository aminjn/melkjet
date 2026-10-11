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

/** توضیحاتِ منسجم و روانِ گراندشده. همیشه متن برمی‌گرداند (نیازی به پیکرهٔ بزرگ ندارد). */
export async function writeDescriptionFromData(f: ListingFields): Promise<string | null> {
  const c = await ensureWriterCorpus().catch(() => null)
  const pool = descriptorPool(c)
  const type = f.propertyType || 'ملک'
  const isRent = f.deal === 'اجاره'
  const dealWord = isRent ? pick(['آمادهٔ اجاره', 'برای اجاره']) : pick(['آمادهٔ فروش', 'برای فروش'])
  const loc = f.hood || f.city || ''
  const adjs = take(pool, maybe(0.6) ? 2 : 1).join(' و ')

  // بندِ ۱ — معرفیِ روان (نوع + صفت‌های امن + متراژ + موقعیت + معامله)
  const p1 = `${type}${adjs ? `ِ ${adjs}` : ''}${f.area ? ` ${f.area}متری` : ''}${loc ? ` در ${loc}` : ''}، ${dealWord}.`

  // بندِ ۲ — مشخصات و امکاناتِ واقعی، در یک جملهٔ روان
  const specBits: string[] = []
  if (f.rooms != null && f.rooms !== '' && Number(f.rooms) > 0) specBits.push(`${f.rooms} خوابه`)
  const ft = floorText(f.floor, f.totalFloors); if (ft) specBits.push(ft)
  const feats = [f.parking && 'پارکینگ', f.elevator && 'آسانسور', f.storage && 'انباری', f.patio && 'پاسیو'].filter(Boolean) as string[]
  const subject = type.includes('آپارتمان') ? pick(['این واحد', 'این آپارتمان']) : pick(['این ملک', 'این واحد'])
  let p2 = ''
  if (specBits.length && feats.length) p2 = `${subject} ${specBits.join(' و ')} و ${pick(['مجهز به', 'دارای', 'بهره‌مند از'])} ${feats.join('، ')} است.`
  else if (specBits.length) p2 = `${subject} ${specBits.join(' و ')} است.`
  else if (feats.length) p2 = `${subject} ${pick(['مجهز به', 'دارای'])} ${feats.join('، ')} است.`

  const ageTxt = f.age ? pick([`سنِ بنا ${f.age}.`, `ساختِ ${f.age}.`]) : ''
  const soft = maybe(0.65) ? pick(SOFT_LINE) + '.' : ''
  const cta = (f.advisorName
    ? pick([`برای هماهنگیِ بازدید با ${f.advisorName} تماس بگیرید.`, `${f.advisorName} آمادهٔ پاسخ‌گویی و هماهنگیِ بازدید است.`])
    : pick([`برای بازدید و اطلاعاتِ بیشتر تماس بگیرید.`, `برای هماهنگیِ بازدید در تماس باشید.`])) + ' ' + pick(['🔑', '🏠', ''])

  // چیدمان: بندِ معرفی، بندِ مشخصات/کیفیت (روان، نه تکه‌تکه)، دعوت
  const midParts = [p2, ageTxt, soft].filter(Boolean)
  const blocks = [p1 + ' ' + pick(['🏠', '✨', '📍', '']), midParts.join(' '), cta].filter(s => s && s.trim())
  const out = faShow(blocks.join('\n\n').replace(/[ \t]+/g, ' ').trim())
  return out.length > 40 ? out : null
}

/** فقط برای تست: تزریقِ پیکره بدونِ خواندن از دیتابیس. */
export function __setWriterCorpus(c: WriterCorpus | null) { CORPUS = c; buildingAt = Date.now() }

export async function writerCorpusStats(): Promise<{ ready: boolean; samples: number; vocab: number }> {
  const c = await ensureWriterCorpus()
  return { ready: !!c, samples: c?.n || 0, vocab: c ? Object.keys(c.descCount).length : 0 }
}
