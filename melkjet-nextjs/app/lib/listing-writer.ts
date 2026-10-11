// فاز ۳۰۱ — «نویسندهٔ آگهیِ یادگیرنده» (خودآموز از دادهٔ واقعی، بدونِ هوشِ مصنوعی).
// کاربر: «با این همه دیتا باید حرفه‌ای‌تر از هوش شود». منبعِ یادگیری: متنِ کاملِ توضیحاتِ واقعیِ
// آگهی‌های دیوار که در کشِ غنی‌سازی (enrich-store) ذخیره شده. از آن‌ها «جمله‌های تبلیغاتیِ نرمِ
// واقعیِ مشاورها» را استخراج و پاک‌سازی می‌کنیم (بدونِ شماره/نام/آدرس) و برای هر آگهیِ تازه،
// متنی «گراندشده روی واقعیت‌های همان ملک» با بافتِ واقعیِ آگهی‌های دیوار می‌نویسیم.
//
// قانونِ آهنین (ضدِ جعل): هیچ ادعای «قابلِ‌راستی‌آزماییِ» نامطمئن تزریق نمی‌شود — جمله‌هایی که
// ادعای سخت دارند (نوساز/بازسازی/سند/ویو/فول‌امکانات/نامِ مکانِ خاص مثل مترو) کنار گذاشته می‌شوند؛
// فقط واقعیت‌های دادهٔ خودِ کاربر (متراژ/خواب/طبقه/سن/امکانات/معامله/موقعیت) + نثرِ نرمِ عمومی می‌آید.

import { listItems, type Item } from './scraper-store'
import { getEnrichment } from './enrich-store'
import { FA_DIGITS, faDigit } from './digits'
import type { ListingFields } from './listing-copy'

const faToEn = (s: string) => String(s || '').replace(FA_DIGITS, faDigit)
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
function take<T>(a: T[], n: number): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]] }
  return b.slice(0, Math.min(n, b.length))
}

// نشانه‌های «تماس/واسطه/هویت» → کلِ جمله دور ریخته می‌شود (نه متنِ تبلیغاتی).
const BAD = /https?:|www\.|@\w|تلگرام|واتس|اینستا|۰۹\d|0?9\d{8}|\d{7,}|شماره|تماس|هماهنگ|آدرس|پلاک|کوچه|خیابان|بلوار|نبش|میدان|واسطه|کمیسیون|املاک |مشاور |آژانس|دفتر املاک/
// ادعای «سختِ» قابلِ‌راستی‌آزمایی که برای ملکِ دیگری ممکن است دروغ باشد → حذف (ضدِ جعل).
const HARD_CLAIM = /نوساز|بازساز|کلنگ|سند|فول|لوکس|ویو|دوبلکس|پنت|مستر|شوفاژ|پکیج|چیلر|اسپیلت|کولر|تراس|بالکن|روف|استخر|سونا|جکوزی|لابی|کابینت|گلاس|سرامیک|پارکت|متریال|متر|خواب|طبقه|سال ساخت|قیمت|رهن|اجاره|ودیعه|تومان|میلیون|میلیارد/
// ادعای «مکانِ خاصِ نزدیک» (ممکن است برای این ملک نادرست باشد) → حذف.
const PLACE_CLAIM = /مترو|ایستگاه|بی.?آر.?تی|پاساژ|مرکز خرید|بیمارستان|دانشگاه|مدرسه|پارک |فرودگاه|ترمینال/

function splitSentences(text: string): string[] {
  return faToEn(text).split(/[.!?؟\n•]+|[،؛]\s|·|\|/).map(s => s.trim()).filter(Boolean)
}
function cleanSent(s0: string): string | null {
  let s = s0.replace(/\s+/g, ' ').trim().replace(/^[\-–—*✅✨🏠🔑📍🚗🌿👌•\s]+/, '').trim()
  if (!s) return null
  if (BAD.test(s) || PLACE_CLAIM.test(s) || HARD_CLAIM.test(s)) return null
  const words = s.split(' ').filter(Boolean)
  if (words.length < 3 || words.length > 20) return null
  if ((s.match(/\d/g) || []).length > 3) return null         // جملهٔ عددمحور = فکت/قیمت
  if (!/[؀-ۿ]{3,}/.test(s)) return null             // باید فارسی باشد
  return s
}

export interface WriterCorpus { builtAt: number; n: number; byType: Record<string, string[]> }
const CAP_PER_BANK = 600
const MIN_POOL = 40          // کف‌ِ جمله‌های واقعی تا مسیرِ یادگیرنده فعال شود
const TTL = 6 * 3600_000
let CORPUS: WriterCorpus | null = null
let buildingAt = 0

function addSent(bank: Record<string, string[]>, key: string, s: string) {
  const arr = bank[key] || (bank[key] = [])
  if (arr.length < CAP_PER_BANK && !arr.includes(s)) arr.push(s)
}

/** ساختِ پیکره از نمونه‌ها (قابلِ تزریق برای تست). */
export function buildWriterCorpusFrom(samples: { type?: string; text?: string }[]): WriterCorpus {
  const byType: Record<string, string[]> = {}
  let n = 0
  for (const s of samples) {
    const text = s.text || ''
    if (text.length < 40) continue
    const type = (s.type || '').trim() || '*'
    for (const raw of splitSentences(text)) {
      const c = cleanSent(raw)
      if (!c) continue
      addSent(byType, type, c)
      if (type !== '*') addSent(byType, '*', c)
      n++
    }
  }
  return { builtAt: Date.now(), n, byType }
}

/** پیکره را از آگهی‌های واقعی (توضیحاتِ کشِ غنی‌سازی) می‌سازد — با کش و TTL. */
export async function ensureWriterCorpus(): Promise<WriterCorpus | null> {
  if (CORPUS && Date.now() - CORPUS.builtAt < TTL) return CORPUS
  if (Date.now() - buildingAt < 30_000 && CORPUS) return CORPUS   // دیباونس
  buildingAt = Date.now()
  try {
    const items = (await listItems('listing')) as Item[]
    const samples: { type?: string; text?: string }[] = []
    for (const it of items) {
      const e = getEnrichment(it.id)
      const text = (e?.description && e.description.length > (it.excerpt?.length || 0)) ? e.description : (it.excerpt || '')
      if (text && text.length >= 40) samples.push({ type: it.meta?.['نوع ملک'], text })
    }
    const built = buildWriterCorpusFrom(samples)
    if (built.n >= MIN_POOL) CORPUS = built
  } catch { /* پیکرهٔ قبلی را نگه دار */ }
  return CORPUS
}

/** توضیحاتِ گراندشده با بافتِ واقعی — فقط فکت‌های کاربر + نثرِ نرمِ واقعی. null = پیکره کافی نیست. */
export async function writeDescriptionFromData(f: ListingFields): Promise<string | null> {
  const c = await ensureWriterCorpus()
  if (!c) return null
  const type = (f.propertyType || '').trim()
  const pool = [...new Set([...(c.byType[type] || []), ...(c.byType['*'] || [])])]
  if (pool.length < MIN_POOL) return null

  const isRent = f.deal === 'اجاره'
  const loc = f.hood || f.city || ''
  const open = pick([
    `${f.propertyType || 'ملک'}${f.area ? ` ${f.area} متری` : ''}${loc ? ` در ${loc}` : ''} ${isRent ? 'برای اجاره' : 'برای فروش'}.`,
    `${loc ? loc + '؛ ' : ''}${f.propertyType || 'ملک'}${f.area ? ` ${f.area} متری` : ''} ${isRent ? 'آمادهٔ اجاره' : 'آمادهٔ فروش'}.`,
    `فرصتی برای ${isRent ? 'اجاره' : 'خرید'}؛ ${f.propertyType || 'ملک'}${f.area ? ` ${f.area} متری` : ''}${loc ? ` واقع در ${loc}` : ''}.`,
  ]) + ' ' + pick(['🏠', '✨', '📍', ''])

  // فکت‌های واقعیِ کاربر (گراندشده)
  const factBits: string[] = []
  if (f.rooms != null && f.rooms !== '' && Number(f.rooms) > 0) factBits.push(`${f.rooms} خوابه`)
  if (f.floor) factBits.push(`طبقهٔ ${f.floor}${f.totalFloors ? ` از ${f.totalFloors}` : ''}`)
  const factSent = factBits.length ? pick([`این واحد ${factBits.join('، ')} است.`, `${factBits.join(' و ')}.`]) : ''
  const ageSent = f.age ? pick([`سنِ بنا ${f.age}.`, `ساختِ ${f.age}.`]) : ''
  const feats = [f.parking && 'پارکینگ', f.elevator && 'آسانسور', f.storage && 'انباری'].filter(Boolean) as string[]
  const featSent = feats.length ? pick([`از امکانات: ${feats.join('، ')}.`, `مجهز به ${feats.join(' و ')}.`]) : ''

  // ۲ تا ۳ جملهٔ «واقعیِ» مشاورها از پیکره (نثرِ نرم) — همین بخش هر بار متفاوت و «یادگرفته‌شده» است
  const real = take(pool, Math.random() < 0.5 ? 3 : 2).map(s => s.endsWith('.') ? s : s + '.')

  const cta = (f.advisorName
    ? pick([`برای هماهنگیِ بازدید با ${f.advisorName} تماس بگیرید.`, `${f.advisorName} آمادهٔ پاسخ‌گویی و هماهنگیِ بازدید است.`])
    : pick([`برای بازدید و جزئیاتِ بیشتر تماس بگیرید.`, `همین حالا برای هماهنگیِ بازدید در تماس باشید.`])) + ' ' + pick(['🔑', '📞', ''])

  // چیدمان: آغاز، چند جملهٔ واقعی، فکت‌ها/امکانات، دعوت
  const blocks = [open, real[0] || '', factSent, featSent, real[1] || '', ageSent, real[2] || '', cta].filter(Boolean)
  const out = blocks.join('\n\n').replace(/[ \t]+/g, ' ').trim()
  return out.length > 60 ? out : null
}

/** فقط برای تست: تزریقِ پیکره بدونِ خواندن از دیتابیس. */
export function __setWriterCorpus(c: WriterCorpus | null) { CORPUS = c; buildingAt = Date.now() }

/** برای پنل/تشخیص: وضعیتِ پیکرهٔ یادگیری. */
export async function writerCorpusStats(): Promise<{ ready: boolean; sentences: number; types: number }> {
  const c = await ensureWriterCorpus()
  return { ready: !!c && c.n >= MIN_POOL, sentences: c?.n || 0, types: c ? Object.keys(c.byType).filter(k => k !== '*').length : 0 }
}
