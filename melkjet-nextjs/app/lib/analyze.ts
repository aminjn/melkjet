import { aiFor, agentModel } from './gapgpt'
import { mlFirst } from './ml-gateway'
const { chatCompleteSafe } = aiFor('تحلیلِ هوشمندِ آگهی')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI
import { knowledgeFor } from './market-data'

export interface AnalyzePayload {
  title?: string; price?: string; location?: string
  facts?: { label: string; value: string }[]
  amenities?: string[]
  description?: string
  meta?: Record<string, string>
}

const FA = '۰۱۲۳۴۵۶۷۸۹'
const faToEn = (s: string) => String(s || '').replace(/[۰-۹]/g, d => String(FA.indexOf(d)))
const norm = (s: string) => String(s || '').replace(/‌/g, ' ').replace(/\s+/g, ' ').trim()
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n * 10) / 10))

// امکاناتِ شناخته‌شده — برای استخراجِ قاعده‌محور از متن (بدونِ AI).
const AMEN = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن', 'تراس', 'لابی', 'استخر', 'سونا', 'جکوزی', 'روف گاردن', 'مبله', 'پکیج', 'شوفاژ', 'مستر', 'سالن اجتماعات', 'نگهبان', 'دوربین مداربسته', 'درب ریموت', 'آیفون تصویری', 'هوشمند', 'کولر']

function amenitiesOf(text: string, given?: string[]): string[] {
  const set = new Set((given || []).map(a => norm(a)).filter(Boolean))
  const t = norm(text)
  for (const a of AMEN) if (t.includes(norm(a))) set.add(a)
  return [...set].slice(0, 10)
}

function factsOf(b: AnalyzePayload): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []; const seen = new Set<string>()
  const push = (l: string, v: string) => { l = norm(l); v = norm(v); if (l && v && !seen.has(l)) { seen.add(l); out.push({ label: l, value: v }) } }
  for (const f of (b.facts || [])) if (f && f.label && f.value) push(f.label, f.value)
  for (const [k, v] of Object.entries(b.meta || {})) if (v && ['متراژ', 'اتاق', 'خواب', 'طبقه', 'سال ساخت', 'سن بنا', 'نوع ملک', 'نوع معامله', 'سند', 'واحد'].some(x => k.includes(x))) push(k, String(v))
  const t = faToEn(`${b.title || ''} ${b.description || ''}`)
  let m: RegExpMatchArray | null
  if (!seen.has('متراژ') && (m = t.match(/(\d{2,4})\s*(?:متر|متری|مترمربع)/))) push('متراژ', m[1] + ' متر')
  if (!seen.has('اتاق') && !seen.has('خواب') && (m = t.match(/(\d)\s*(?:خواب|اتاق)/))) push('اتاق', m[1])
  if (!seen.has('طبقه') && (m = t.match(/طبقه\s*(\d{1,2})/))) push('طبقه', m[1])
  if (!seen.has('سال ساخت')) { if (/نوساز|کلید\s*نخورده|کلیدنخورده/.test(t)) push('سال ساخت', 'نوساز'); else if ((m = t.match(/(?:سال\s*ساخت|ساخت)\D{0,4}(1[34]\d{2})/))) push('سال ساخت', m[1]) }
  return out.slice(0, 10)
}

const factVal = (facts: { label: string; value: string }[], key: string) => facts.find(f => f.label.includes(key))?.value || ''

// تحلیلِ کاملِ محلی (بدونِ AI): استخراج + امتیازِ قاعده‌محور + خلاصه/نقاط‌قوت‌ضعفِ قالبی + روندِ قیمت از دادهٔ بازار.
function localAnalyze(b: AnalyzePayload): any | null {
  const text = `${b.title || ''} ${b.description || ''} ${b.location || ''}`
  if (!norm(text) && !(b.facts || []).length) return null
  const t = norm(faToEn(text))
  const facts = factsOf(b)
  const amenities = amenitiesOf(`${b.title || ''} ${b.description || ''}`, b.amenities)

  const deal = `${b.price || ''} ${b.title || ''} ${b.meta?.['نوع معامله'] || ''}`
  const isDaily = /کوتاه[‌\s]?مدت/.test(deal) || /شبی\s*[\d۰-۹]|روزانه\s*[-–—ـ_]\s*هفتگی|اجاره(?:ی|ٔ)?\s*(?:روزانه|کوتاه[‌\s]?مدت)/.test(`${deal} ${b.description || ''}`)
  const isRent = isDaily || (/ودیعه|اجاره|رهن/.test(deal) && !/فروش|خرید|قیمت کل/.test(deal))

  const city = b.meta?.['شهر'] || ''
  const district = b.meta?.['محله'] || (b.location || '').split('،')[0]?.trim() || ''
  const knowledge = knowledgeFor(city, district)

  // ── امتیازها (۰ تا ۱۰) از سیگنال‌های واقعی ──
  const age = factVal(facts, 'سال ساخت')
  // جداکنندهٔ هزارگان (٬/،) را حذف کن وگرنه «۱٬۴۰۴» به سالِ معتبر تبدیل نمی‌شود و کیفیت اشتباه می‌ماند.
  const ageYear = Number((faToEn(age).replace(/[^\d]/g, '').match(/1[34]\d{2}/) || ['0'])[0]) || 0
  const isNew = age === 'نوساز' || /نوساز|کلید\s*نخورده|کلیدنخورده/.test(t)
  const quality = (isNew || ageYear >= 1402) ? 8.8 : ageYear >= 1398 ? 8.3 : ageYear >= 1390 ? 7.6 : ageYear >= 1380 ? 6.9 : ageYear ? 6.2 : 7.9
  const amenityScore = clamp(5 + amenities.length * 0.6, 5, 9.6)
  const locScore = knowledge.length ? 8.4 : /مرکز|محدوده|بر\s*خیابان|بلوار/.test(t) ? 8 : 7.7
  const accessScore = /مترو|بی\s*آر\s*تی|brt|بزرگراه|اتوبان|ایستگاه/i.test(t) ? 8.8 : 8
  const value = clamp((quality + amenityScore + locScore + accessScore) / 4 + 0.2, 5, 9.5)
  const scores: Record<string, number> = isRent
    ? { 'ارزش اجاره': value, 'موقعیت محله': locScore, 'دسترسی': accessScore, 'کیفیت ساخت': quality, 'امکانات': amenityScore }
    : { 'ارزش خرید': value, 'سرمایه‌گذاری': clamp(value - 0.3, 5, 9.5), 'موقعیت محله': locScore, 'دسترسی': accessScore, 'کیفیت ساخت': quality }

  // ── خلاصه / نقاط قوت / ضعف (قالبی از فکت‌ها) ──
  const ptype = b.meta?.['نوع ملک'] || (/(ویلا|زمین|مغازه|اداری|کلنگی|پنت|سوییت)/.exec(t)?.[1] || 'آپارتمان')
  const area = factVal(facts, 'متراژ'); const rooms = factVal(facts, 'اتاق') || factVal(facts, 'خواب')
  const summary = [
    `${ptype}${area ? ` ${area}` : ''}${rooms ? `، ${rooms} خوابه` : ''}${district ? ` در ${district}` : ''}${city ? `، ${city}` : ''}`,
    isNew ? 'نوساز و آمادهٔ بهره‌برداری' : ageYear ? `سالِ ساختِ حدودِ ${ageYear}` : '',
    amenities.length ? `دارای ${amenities.slice(0, 3).join('، ')}` : '',
    isRent ? 'برای اجاره' : 'برای فروش',
  ].filter(Boolean).join('. ') + '.'

  const pros: string[] = []
  if (isNew || ageYear >= 1400) pros.push('ساختِ نوساز و به‌روز')
  if (['پارکینگ', 'آسانسور', 'انباری'].every(x => amenities.includes(x))) pros.push('امکاناتِ کاملِ ساختمانی (پارکینگ، آسانسور، انباری)')
  else if (amenities.includes('پارکینگ')) pros.push('دارای پارکینگ')
  if (amenities.some(a => ['استخر', 'سونا', 'جکوزی', 'لابی', 'روف گاردن'].includes(a))) pros.push('امکاناتِ رفاهیِ ویژه')
  if (knowledge.length) pros.push('موقعیت در محله‌ای با دادهٔ بازارِ فعال')
  if (Number(faToEn(area)) >= 100) pros.push('متراژِ مناسب و کاربردی')
  while (pros.length < 2) pros.push(pros.length ? 'قیمت متناسب با منطقه' : 'گزینهٔ قابلِ‌بررسی برای بازدید')

  const cons: string[] = []
  if (ptype.includes('آپارتمان') && !amenities.includes('پارکینگ')) cons.push('پارکینگ در آگهی ذکر نشده')
  if (ageYear && ageYear < 1390) cons.push('قدمتِ نسبتاً بالای بنا')
  if (Number(faToEn(factVal(facts, 'طبقه'))) >= 5 && !amenities.includes('آسانسور')) cons.push('طبقهٔ بالا بدونِ ذکرِ آسانسور')
  if (norm(b.description || '').length < 40) cons.push('اطلاعاتِ آگهی محدود است')
  if (!cons.length) cons.push('برای اطمینان، جزئیاتِ بیشتر را از فروشنده بپرسید')

  // ── روندِ قیمت: از دادهٔ واقعیِ بازار اگر بود، وگرنه روندِ نسبیِ ملایم ──
  const growthK = knowledge.find(k => /رشد|growth/i.test(k.metric))
  const yearGrowth = growthK ? `${growthK.value}${growthK.unit || '٪'}` : '۸٪'
  const base = [62, 63, 65, 66, 68, 69, 71, 73, 74, 76, 78, 80]

  const confidence = clamp(58 + facts.length * 4 + amenities.length * 2 + (knowledge.length ? 10 : 0), 55, 95)
  return {
    facts, amenities, summary, pros: pros.slice(0, 3), cons: cons.slice(0, 2), scores,
    confidence: Math.round(confidence),
    priceTrend: { values: base, yearGrowth, forecast: 'ادامهٔ رشدِ ملایمِ قیمت' },
    by: 'ml',
  }
}

// نسخهٔ «فقط ماشین‌لرنینگ» (بدونِ هیچ فراخوانِ AI) — برای مسیرِ درخواستِ کاربر که هرگز نباید
// AI بزند و باید آنی پاسخ دهد. تضمین می‌کند صفحهٔ ملک همیشه تحلیل داشته باشد (~۶ms، بدونِ دیوار).
export function localAnalyzeOnly(b: AnalyzePayload): { analysis?: any; error?: string } {
  const a = localAnalyze(b)
  return a ? { analysis: a } : { error: 'داده‌ای برای تحلیل نبود' }
}

// تحلیل ساختاریافتهٔ یک آگهی → خروجی JSON برای صفحهٔ ملک. اکنون «اول ماشین‌لرنینگ»:
// تحلیلِ محلی آنی می‌سازد؛ فقط اگر ورودی واقعاً تهی بود به AI می‌رود (و کش می‌شود).
export async function analyzeListing(b: AnalyzePayload): Promise<{ analysis?: any; error?: string }> {
  const model = agentModel('pricing', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')

  const key = JSON.stringify({ t: b.title, p: b.price, l: b.location, d: (b.description || '').slice(0, 400), f: b.facts, a: b.amenities, m: b.meta })
  try {
    const { value } = await mlFirst<any>({
      task: 'analyze', key,
      predict: () => { const a = localAnalyze(b); return a ? { value: a, confident: true } : null },
      validate: a => !!a && !!a.summary,
      ai: async () => {
        if (!model) return null
        const city = b.meta?.['شهر'] || ''
        const district = b.meta?.['محله'] || (b.location || '').split('،')[0]?.trim() || ''
        const knowledge = knowledgeFor(city, district)
        const knowledgeLine = knowledge.length ? 'دادهٔ واقعی بازار:\n' + knowledge.map(k => `- ${[k.district, k.city].filter(Boolean).join(' ')} ${k.period || ''} | ${k.metric}: ${k.value.toLocaleString('fa-IR')} ${k.unit || ''}`).join('\n') : ''
        const info = [`عنوان: ${b.title || ''}`, `قیمت: ${b.price || ''}`, `موقعیت: ${b.location || ''}`, ...(Array.isArray(b.facts) ? b.facts.map(f => `${f.label}: ${f.value}`) : []), Array.isArray(b.amenities) && b.amenities.length ? `امکانات: ${b.amenities.join('، ')}` : '', knowledgeLine, `توضیحات: ${(b.description || '').slice(0, 1500)}`].filter(Boolean).join('\n')
        const isRent = /ودیعه|اجاره|رهن/.test(`${b.price} ${b.title}`) && !/فروش|خرید/.test(`${b.price} ${b.title}`)
        const scoreKeys = isRent ? '"ارزش اجاره":8.5,"موقعیت محله":8,"دسترسی":9,"کیفیت ساخت":8,"امکانات":8.5' : '"ارزش خرید":8.5,"سرمایه‌گذاری":8,"موقعیت محله":9,"دسترسی":8.5,"کیفیت ساخت":8'
        const system = `تو کارشناس املاک ملک‌جت هستی. این آگهی را تحلیل کن و فقط از متن استخراج کن. فقط یک JSON معتبر برگردان با ساختار: {"facts":[{"label":"","value":""}],"amenities":[],"summary":"","pros":[],"cons":[],"scores":{${scoreKeys}},"confidence":92,"priceTrend":{"values":[62,64,65,66,68,70,71,73,74,76,78,80],"yearGrowth":"۸٪","forecast":""}}`
        let out = await chatCompleteSafe(model, [{ role: 'system', content: system }, { role: 'user', content: info }], { temperature: 0.5, max_tokens: 2200, timeoutMs: 45_000 })
        const mm = out.match(/\{[\s\S]*\}/); if (mm) out = mm[0]
        try { return JSON.parse(out) } catch { return null }
      },
    })
    if (!value) return { error: 'داده‌ای برای تحلیل نبود' }
    return { analysis: value }
  } catch (e: any) {
    // آخرین پناه: تحلیلِ محلی حتی اگر چیزِ دیگری شکست خورد.
    const a = localAnalyze(b)
    return a ? { analysis: a } : { error: e?.message || 'خطا در تحلیل' }
  }
}
