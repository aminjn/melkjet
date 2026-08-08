// فاز ۲۵۹ — تولیدِ «عنوان» و «توضیحاتِ» حرفه‌ایِ آگهی (مشترکِ سایت و تلگرام).
// خروجی: متنِ چندخطی، گرم و تعریف‌کننده در سبکِ بهترین آگهی‌های دیوار — نه یک خطِ خشکِ کوتاه.
// اگر AI در دسترس نبود، یک قالبِ محلیِ چندخطیِ خوب برمی‌گرداند (هرگز خطا نمی‌دهد).
import { aiFor, resolveAgent } from './gapgpt'
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
  price?: string
  advisorName?: string
}

const yn = (b?: boolean) => (b ? 'دارد' : 'ندارد')

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
    f.price && `قیمت: ${f.price}`,
  ].filter(Boolean) as string[]
}

/** عنوانِ محلیِ خوب وقتی AI نبود. */
export function fallbackTitle(f: ListingFields): string {
  const parts = [
    f.propertyType || 'ملک',
    f.area && `${f.area} متری`,
    f.rooms && Number(f.rooms) > 0 && `${f.rooms} خوابه`,
    f.hood || f.city,
  ].filter(Boolean)
  return `${f.deal ? f.deal + ' ' : ''}${parts.join(' ')}`.replace(/\s+/g, ' ').trim()
}

/** توضیحاتِ محلیِ چندخطی و تعریف‌کننده وقتی AI نبود. */
export function fallbackDescription(f: ListingFields): string {
  const feats: string[] = []
  if (f.parking) feats.push('پارکینگِ اختصاصی')
  if (f.elevator) feats.push('آسانسور')
  if (f.storage) feats.push('انباری')
  const loc = f.hood ? `محدودهٔ خوش‌نامِ ${f.hood}` : f.city || 'موقعیتی مناسب'
  const blocks = [
    `🏠 ${f.propertyType || 'ملکی'} ${f.deal === 'اجاره' ? 'برای اجاره' : 'برای فروش'}${f.area ? ` با متراژِ ${f.area} متر` : ''} در ${loc}`,
    `این ملکِ دلباز و خوش‌نقشه${f.rooms && Number(f.rooms) > 0 ? ` با ${f.rooms} اتاقِ خواب` : ''}${f.floor ? ` در طبقهٔ ${f.floor}` : ''}، در موقعیتی عالی و با دسترسیِ آسان به امکاناتِ شهری، مغازه‌ها و حمل‌ونقلِ عمومی قرار گرفته است. ✨`,
    feats.length ? `از امکاناتِ این ملک می‌توان به ${feats.join('، ')} اشاره کرد. 🚗` : '',
    f.age ? `بنا ${f.age} و در وضعیتِ بسیار مطلوبی است و آمادهٔ بهره‌برداری می‌باشد.` : '',
    `گزینه‌ای مطمئن و ارزشمند برای سکونت یا سرمایه‌گذاری. 🔑`,
    f.advisorName ? `جهتِ هماهنگیِ بازدید با ${f.advisorName} تماس بگیرید.` : `برای بازدید و اطلاعاتِ بیشتر همین حالا تماس بگیرید.`,
  ].filter(Boolean)
  return blocks.join('\n\n')
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
  const specs = specLines(f).join('\n')
  const { model, provider } = resolveAgent([['content', 'text'], ['chat', 'text'], ['moderation', 'text']])
  const use = model || moderationModel() || 'gpt-4o-mini'
  const prompt = `تو یک مشاورِ املاکِ حرفه‌ای و کاربلدِ ایرانی هستی که آگهی‌های جذاب و پرفروش می‌نویسی (سبکِ بهترین آگهی‌های دیوار).
بر اساسِ مشخصاتِ زیر، برای این ملک یک «عنوان» و یک «توضیحاتِ» حرفه‌ای بنویس.

قوانینِ توضیحات:
- گرم، پرانرژی و تعریف‌کننده باشد؛ نقاطِ قوتِ ملک، موقعیت و دسترسی‌ها را با آب‌وتاب و کامل توصیف کن (نه خشک و کوتاه).
- چند بند باشد و هر بند در چند خطِ کوتاه؛ بینِ بندها یک خطِ خالی بگذار تا روی موبایل خوانا شود.
- امکانات را یک‌به‌یک و برجسته بیاور. چند اموجیِ مرتبط (🏠 ✨ 🚗 🔑 📍) کم و بجا استفاده کن.
- در پایان یک دعوتِ گرم به بازدید/تماس بگذار.${f.advisorName ? ` حتماً نامِ «${f.advisorName}» را به‌عنوانِ مشاورِ تنظیم‌کننده در پایان بیاور.` : ''}
- فقط دربارهٔ همین ملک و همین مشخصات بنویس؛ هیچ چیزی از خودت جعل نکن (شمارهٔ تماس، آدرسِ دقیق، یا امکاناتی که داده نشده).

عنوان: کوتاه و گویا، شاملِ نوعِ ملک، متراژ و محله.

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
    ], { temperature: 0.85, max_tokens: 900 }, provider)
    const p = parseCopy(raw)
    if (p.description && p.description.length > 40) {
      return { title: p.title || fallbackTitle(f), description: p.description, ai: true }
    }
  } catch { /* می‌افتد روی قالبِ محلی */ }
  return { title: fallbackTitle(f), description: fallbackDescription(f), ai: false }
}
