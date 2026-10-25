// فاز ۲۵۹ — تولیدِ «عنوان» و «توضیحاتِ» حرفه‌ایِ آگهی (مشترکِ سایت و تلگرام).
// خروجی: متنِ چندخطی، گرم و تعریف‌کننده در سبکِ بهترین آگهی‌های دیوار — نه یک خطِ خشکِ کوتاه.
// اگر AI در دسترس نبود، یک قالبِ محلیِ چندخطیِ خوب برمی‌گرداند (هرگز خطا نمی‌دهد).
import { aiFor, resolveAgent , fallbackModel } from './gapgpt'
import { moderationModel } from './moderation'

export interface ListingFields {
  deal?: string          // اجاره | فروش
  propertyType?: string
  city?: string
  hood?: string
  area?: string
  rooms?: string
  floor?: string
  totalFloors?: string
  age?: string
  parking?: boolean
  elevator?: boolean
  storage?: boolean
  patio?: boolean
  nearby?: string[]   // دسترسی‌های واقعیِ نقشه (مترو/پارک/…)، گراندشده — نه ادعای جعلی
  price?: string
  advisorName?: string
}

const yn = (b?: boolean) => (b ? 'دارد' : 'ندارد')

// فاز ۳۰۰هـ — کمک‌های تنوع: هر آگهی باید متنِ متفاوت بگیرد (کاربر: «هیچ آگهی شبیه هم نباشد»).
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const maybe = (p = 0.5) => Math.random() < p
function take<T>(arr: T[], n: number): T[] {            // n موردِ متمایزِ تصادفی، با ترتیبِ تصادفی
  const b = [...arr]
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]] }
  return b.slice(0, Math.min(n, b.length))
}

/** مشخصاتِ ملک به‌صورتِ خط‌به‌خط (ورودیِ AI و قالبِ محلی). */
export function specLines(f: ListingFields): string[] {
  return [
    f.deal && `نوعِ معامله: ${f.deal}`,
    f.propertyType && `نوعِ ملک: ${f.propertyType}`,
    (f.city || f.hood) && `موقعیت: ${[f.city, f.hood].filter(Boolean).join('، ')}`,
    f.area && `متراژ: ${f.area} متر`,
    f.rooms != null && f.rooms !== '' && `اتاقِ خواب: ${f.rooms}`,
    f.floor && `طبقه: ${f.floor}${f.totalFloors ? ' از ' + f.totalFloors : ''}`,
    f.age && `سنِ بنا: ${f.age}`,
    f.parking != null && `پارکینگ: ${yn(f.parking)}`,
    f.elevator != null && `آسانسور: ${yn(f.elevator)}`,
    f.storage != null && `انباری: ${yn(f.storage)}`,
    f.patio != null && `پاسیو: ${yn(f.patio)}`,
    f.price && `قیمت: ${f.price}`,
  ].filter(Boolean) as string[]
}

/** عنوانِ محلیِ متنوع وقتی AI نبود (ساختار و چینشِ تصادفی). */
export function fallbackTitle(f: ListingFields): string {
  const type = f.propertyType || 'ملک'
  const size = f.area ? `${f.area} متری` : ''
  const rooms = f.rooms && Number(f.rooms) > 0 ? `${f.rooms} خوابه` : ''
  const loc = f.hood || f.city || ''
  const deal = f.deal || ''
  const t = pick([
    `${deal} ${type} ${size} ${rooms} ${loc}`,
    `${type} ${size} ${rooms}${deal ? ' ' + deal : ''}${loc ? ' در ' + loc : ''}`,
    `${deal} ${type} ${rooms} ${size}${loc ? '، ' + loc : ''}`,
    `${type} ${size}${rooms ? ' ' + rooms : ''}${loc ? ' — ' + loc : ''}`,
  ])
  return t.replace(/\s+/g, ' ').replace(/\s+،/g, '،').trim() || `${type}${loc ? ' ' + loc : ''}`
}

/** توضیحاتِ محلیِ چندخطیِ «ترکیبی» — هر بار متفاوت، تا دو آگهی شبیه هم نشوند. */
export function fallbackDescription(f: ListingFields): string {
  const type = f.propertyType || 'ملک'
  const isRent = f.deal === 'اجاره'
  const size = f.area ? `${f.area} متری` : ''
  const loc = f.hood
    ? pick([`محدودهٔ ${f.hood}`, `منطقهٔ خوش‌نامِ ${f.hood}`, `${f.hood}`, `قلبِ ${f.hood}`, `بهترین نقطهٔ ${f.hood}`]) + (f.city && f.city !== f.hood ? `، ${f.city}` : '')
    : (f.city || 'موقعیتی مناسب')

  const feats: string[] = []
  if (f.parking) feats.push(pick(['پارکینگِ اختصاصی', 'پارکینگِ سرپوشیده', 'جای پارکِ اختصاصی']))
  if (f.elevator) feats.push('آسانسور')
  if (f.storage) feats.push(pick(['انباری', 'انباریِ مجزا']))

  // بندِ آغازین
  const open = pick([
    `${type}${size ? ` ${size}` : ''} در ${loc} ${isRent ? 'آمادهٔ اجاره' : 'برای فروش'} است.`,
    `یک ${type}${size ? ` ${size}` : ''} ${isRent ? 'اجاره‌ای' : 'فروشی'} در ${loc}.`,
    `فرصتی برای ${isRent ? 'اجاره' : 'خرید'}؛ ${type}${size ? ` ${size}` : ''} واقع در ${loc}.`,
    `${loc}؛ ${type}${size ? ` ${size}` : ''} ${isRent ? 'برای اجاره' : 'برای فروش'}.`,
    `${type}${size ? ` ${size}` : ''} با موقعیتی مناسب در ${loc}، ${isRent ? 'آمادهٔ اجاره' : 'آمادهٔ فروش'}.`,
  ]) + ' ' + pick(['🏠', '✨', '📍', '🔑', ''])

  // نقاطِ قوتِ تصادفی (۲ تا ۳ تا از استخر) تا بدنه هر بار فرق کند
  const sellingPool = [
    'نقشهٔ کاربردی و بدونِ پرتِ فضا',
    'نورگیریِ عالی در طولِ روز',
    'دسترسیِ آسان به خیابانِ اصلی و حمل‌ونقل',
    'بافتِ آرام و همسایگیِ مناسب',
    'نزدیک به مراکزِ خرید و خدماتِ روزمره',
    'دیدِ باز و فضای دلباز',
    'کفِ تمیز و دیوارهای سالم',
    'آشپزخانهٔ مرتب و کاربردی',
    'نزدیک به پارک و فضای سبز',
    'مناسبِ خانواده‌های کوچک و بزرگ',
  ]
  const sell = take(sellingPool, maybe(0.5) ? 3 : 2)

  // بدنه: مشخصاتِ واقعی + نقاطِ قوت، با رابط‌های متغیر
  const bodyBits: string[] = []
  if (f.rooms != null && f.rooms !== '' && Number(f.rooms) > 0) bodyBits.push(pick([`${f.rooms} اتاقِ خواب`, `${f.rooms} خوابِ نورگیر`, `دارای ${f.rooms} اتاق`]))
  else if (f.rooms === '0') bodyBits.push(pick(['سوئیت/بدونِ اتاقِ خواب', 'نقشهٔ یکپارچه و جمع‌وجور']))
  if (f.floor) bodyBits.push(pick([`طبقهٔ ${f.floor}${f.totalFloors ? ` از ${f.totalFloors}` : ''}`, `واقع در طبقهٔ ${f.floor}`]))
  const body = pick([
    `این ملک ${[...bodyBits, ...sell].join('، ')} است.`,
    `${bodyBits.length ? bodyBits.join('، ') + '؛ ' : ''}${sell.join('، ')}.`,
    `از ویژگی‌هایش: ${[...bodyBits, ...sell].join(' • ')}.`,
  ]) + (maybe(0.4) ? ' ' + pick(['✨', '👌', '🌿', '']) : '')

  const featSent = feats.length
    ? pick([`از امکانات: ${feats.join('، ')}.`, `مجهز به ${feats.join(' و ')}.`, `این واحد ${feats.join('، ')} دارد.`]) + (maybe(0.4) ? ' 🚗' : '')
    : ''

  const ageSent = f.age
    ? pick([`بنا ${f.age} و در وضعیتِ مطلوب.`, `سنِ بنا ${f.age}، تمیز و آمادهٔ بهره‌برداری.`, `ساختِ ${f.age} با نگهداریِ خوب.`])
    : ''

  const valueSent = pick([
    `گزینه‌ای مناسب برای ${isRent ? 'سکونت' : 'سکونت یا سرمایه‌گذاری'}.`,
    'انتخابی مطمئن و به‌صرفه.',
    'ارزشِ دیدن دارد؛ از دستش نده.',
    'فرصتی که زود از بین می‌رود.',
    '',
  ])

  const cta = (f.advisorName
    ? pick([`برای هماهنگیِ بازدید با ${f.advisorName} تماس بگیرید.`, `جهتِ بازدید با ${f.advisorName} در تماس باشید.`, `${f.advisorName} آمادهٔ پاسخ‌گویی و هماهنگیِ بازدید است.`])
    : pick([`برای بازدید و جزئیاتِ بیشتر تماس بگیرید.`, `همین حالا برای هماهنگیِ بازدید تماس بگیرید.`, `مشتاقِ پاسخ‌گویی و هماهنگیِ بازدید هستیم.`, `سؤالی بود؟ در تماس باشید.`])
  ) + ' ' + pick(['🔑', '📞', '🤝', ''])

  // مونتاژ: آغاز ثابت، بندهای میانی با ترتیبِ کمی متغیر، سپس ارزش و دعوت.
  const middle = [body, featSent, ageSent].filter(Boolean)
  if (maybe(0.3) && middle.length > 1) { const i = Math.floor(Math.random() * (middle.length - 1)); [middle[i], middle[i + 1]] = [middle[i + 1], middle[i]] }
  return [open, ...middle, valueSent, cta].filter(Boolean).join('\n\n').replace(/[ \t]+/g, ' ').trim()
}

/** پارسِ خروجیِ AI با فرمتِ «عنوان: …» + جداکننده + توضیحات (پایدارتر از JSON برای متنِ چندخطی). */
function parseCopy(raw: string): { title?: string; description?: string } {
  if (!raw) return {}
  const text = raw.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim()
  const lines = text.split('\n')
  let title: string | undefined
  let descStart = 0
  for (let i = 0; i < lines.length; i++) {
    const mt = lines[i].match(/^\s*(?:عنوان|تیتر|title)\s*[:：]\s*(.+)$/i)
    if (mt) { title = mt[1].trim().replace(/^["'«»\s]+|["'«»\s]+$/g, ''); descStart = i + 1; continue }
    if (/^\s*[-–—_=*]{2,}\s*$/.test(lines[i])) { descStart = i + 1; break }
  }
  const description = lines.slice(descStart).join('\n').replace(/^\s*(?:توضیحات|description)\s*[:：]\s*/i, '').trim()
  return { title, description: description || undefined }
}

/** عنوان + توضیحاتِ حرفه‌ای برای یک ملک. هرگز throw نمی‌کند — در نبودِ AI، قالبِ محلی. */
export async function generateListingCopy(f: ListingFields): Promise<{ title: string; description: string; ai: boolean }> {
  // ۱) مسیرِ اصلی (فاز ۳۰۱): نویسندهٔ یادگیرنده از دادهٔ واقعی (بدونِ هوشِ مصنوعی). اگر پیکره
  //    کافی بود، متنِ گراندشده با بافتِ واقعیِ آگهی‌های دیوار برمی‌گرداند — یکتا و حرفه‌ای.
  try {
    const { writeDescriptionFromData } = await import('./listing-writer')
    const learned = await writeDescriptionFromData(f)
    if (learned && learned.length > 60) return { title: fallbackTitle(f), description: learned, ai: false }
  } catch { /* می‌افتد روی AI/قالب */ }

  const specs = specLines(f).join('\n')
  const { model, provider } = resolveAgent([['content', 'text'], ['chat', 'text'], ['moderation', 'text']])
  const use = model || moderationModel() || fallbackModel()
  const prompt = `تو یک مشاورِ املاکِ حرفه‌ای و کاربلدِ ایرانی هستی که آگهی‌های جذاب و پرفروش می‌نویسی (سبکِ بهترین آگهی‌های دیوار).
بر اساسِ مشخصاتِ زیر، برای این ملک یک «عنوان» و یک «توضیحاتِ» حرفه‌ای بنویس.

قوانینِ توضیحات:
- گرم، پرانرژی و تعریف‌کننده باشد؛ نقاطِ قوتِ ملک، موقعیت و دسترسی‌ها را با آب‌وتاب و کامل توصیف کن (نه خشک و کوتاه).
- چند بند باشد و هر بند در چند خطِ کوتاه؛ بینِ بندها یک خطِ خالی بگذار تا روی موبایل خوانا شود.
- امکانات را یک‌به‌یک و برجسته بیاور. چند اموجیِ مرتبط (🏠 ✨ 🚗 🔑 📍) کم و بجا استفاده کن.
- در پایان یک دعوتِ گرم به بازدید/تماس بگذار.${f.advisorName ? ` حتماً نامِ «${f.advisorName}» را به‌عنوانِ مشاورِ تنظیم‌کننده در پایان بیاور.` : ''}
- فقط دربارهٔ همین ملک و همین مشخصات بنویس؛ هیچ چیزی از خودت جعل نکن (شمارهٔ تماس، آدرسِ دقیق، یا امکاناتی که داده نشده).
- بسیار مهم: متن باید «یکتا» باشد. از جمله‌های کلیشه‌ایِ تکراری («ملکِ دلباز و خوش‌نقشه»، «گزینه‌ای مطمئن و ارزشمند»، «موقعیتی عالی») پرهیز کن. ساختار، لحن و جمله‌بندی را هر بار عوض کن تا هیچ دو آگهی شبیه هم نباشند.

عنوان: کوتاه و گویا، شاملِ نوعِ ملک، متراژ و محله — خلاقانه، نه قالبی.

مشخصاتِ ملک:
${specs}

خروجی را دقیقاً به این شکل بده (بدونِ هیچ توضیحِ اضافه):
عنوان: <یک خط>
———
<متنِ توضیحات، چندخطی>`
  try {
    const raw = await aiFor('توضیحاتِ آگهی').chatCompleteSafe(use, [
      { role: 'system', content: 'تو نویسندهٔ آگهیِ املاکِ حرفه‌ای و فارسی‌زبان هستی. دقیقاً قالبِ خواسته‌شده را رعایت کن.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.98, max_tokens: 900 }, provider)
    const p = parseCopy(raw)
    if (p.description && p.description.length > 40) {
      return { title: p.title || fallbackTitle(f), description: p.description, ai: true }
    }
  } catch { /* می‌افتد روی قالبِ محلی */ }
  return { title: fallbackTitle(f), description: fallbackDescription(f), ai: false }
}
