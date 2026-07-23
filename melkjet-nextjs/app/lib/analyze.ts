import { aiFor, agentModel } from './gapgpt'
const { chatCompleteSafe } = aiFor('تحلیلِ هوشمندِ آگهی')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI
import { knowledgeFor } from './market-data'

export interface AnalyzePayload {
  title?: string; price?: string; location?: string
  facts?: { label: string; value: string }[]
  amenities?: string[]
  description?: string
  meta?: Record<string, string>
}

// تحلیل ساختاریافتهٔ یک آگهی → خروجی JSON برای صفحهٔ ملک. (بدون HTTP؛ مستقیم قابل فراخوانی)
export async function analyzeListing(b: AnalyzePayload): Promise<{ analysis?: any; error?: string }> {
  const model = agentModel('pricing', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')
  if (!model) return { error: 'مدلی به ایجنت تخصیص داده نشده (پنل → API و مدل‌های AI → تخصیص خودکار)' }

  const city = b.meta?.['شهر'] || ''
  const district = b.meta?.['محله'] || (b.location || '').split('،')[0]?.trim() || ''
  const knowledge = knowledgeFor(city, district)
  const knowledgeLine = knowledge.length
    ? 'دادهٔ واقعی بازار (از پایگاه دانش):\n' + knowledge.map(k => `- ${[k.district, k.city].filter(Boolean).join(' ')} ${k.period || ''} | ${k.metric}: ${k.value.toLocaleString('fa-IR')} ${k.unit || ''}`).join('\n')
    : ''

  const info = [
    `عنوان: ${b.title || ''}`,
    `قیمت: ${b.price || ''}`,
    `موقعیت: ${b.location || ''}`,
    ...(Array.isArray(b.facts) ? b.facts.map((f: any) => `${f.label}: ${f.value}`) : []),
    Array.isArray(b.amenities) && b.amenities.length ? `امکانات موجود: ${b.amenities.join('، ')}` : '',
    knowledgeLine,
    `توضیحات: ${(b.description || '').slice(0, 1500)}`,
  ].filter(Boolean).join('\n')

  const txt = `${b.price || ''} ${b.title || ''} ${b.meta?.['نوع معامله'] || ''}`
  const isRent = /ودیعه|اجاره|رهن/.test(txt) && !/فروش|خرید|قیمت کل/.test(txt)
  const scoreKeys = isRent
    ? '"ارزش اجاره":8.5,"موقعیت محله":8,"دسترسی":9,"کیفیت ساخت":8,"امکانات":8.5'
    : '"ارزش خرید":8.5,"سرمایه‌گذاری":8,"موقعیت محله":9,"دسترسی":8.5,"کیفیت ساخت":8'

  const system = `تو کارشناس املاک ملک‌جت هستی. این آگهی ${isRent ? 'اجاره‌ای' : 'فروشی'} را تحلیل کن و مشخصات کلیدی را فقط از متن آگهی استخراج کن (چیزی از خودت نساز؛ اگر فیلدی در متن نبود اصلاً نیاور). فقط یک JSON معتبر برگردان (بدون متن اضافه) با این ساختار:
{"facts":[{"label":"متراژ","value":"۲۸۵ متر"},{"label":"اتاق","value":"۴"}],"amenities":["آسانسور","پارکینگ"],"summary":"خلاصه ۲ تا ۳ جمله‌ای فارسی","pros":["مزیت ۱","مزیت ۲","مزیت ۳"],"cons":["نکته ۱","نکته ۲"],"scores":{${scoreKeys}},"confidence":92,"priceTrend":{"values":[62,64,65,66,68,70,71,73,74,76,78,80],"yearGrowth":"۸٪","forecast":"ادامهٔ رشد ملایم"},"originality":{"verdict":"اصیل","fakeProbability":"کمتر از ۲٪"}}
- facts فقط مواردی که صریحاً در متن آمده. امتیازها متناسب با نوع ${isRent ? 'اجاره' : 'فروش'}.
- priceTrend.values: ۱۲ عدد (روند نسبی قیمت هر متر در محله، صعودی منطقی). yearGrowth درصد رشد سالانه. forecast پیش‌بینی کوتاه.
- originality: ارزیابی اصالت آگهی بر اساس کامل بودن اطلاعات.
- در cons هرگز نگو امکانی نیست اگر در «امکانات موجود» آمده. اعداد scores ۰ تا ۱۰ و confidence ۰ تا ۱۰۰.`

  try {
    // فاز ۲۱۴ (لاگِ واقعیِ prod: «Unexpected end of JSON input» — تخلیهٔ بک‌لاگ ~۱/دقیقه به‌جای ~۲۰):
    // بدونِ max_tokens، سقفِ پیش‌فرضِ gateway جوابِ JSONِ بلند را وسط می‌بُرید → parse شکست →
    // کول‌داون → چرخهٔ بی‌پایان. سقفِ صریحِ کافی برای کلِ ساختار (facts+priceTrend+…).
    // فاز ۲۱۶ (سنجهٔ ۲۱۵: «analysis 187s» — مدلِ کند تا تایم‌اوتِ ۹۰ث می‌سوزد بعد fallback دوباره وقت
    // می‌گیرد): تایم‌اوتِ کوتاه‌تر تا fallbackِ سریع (gpt-4o-mini) زودتر بیاید؛ مدلِ سالم در ۴۵ث جواب می‌دهد.
    let text = await chatCompleteSafe(model, [{ role: 'system', content: system }, { role: 'user', content: info }], { temperature: 0.5, max_tokens: 2200, timeoutMs: 45_000 })
    const m = text.match(/\{[\s\S]*\}/)
    if (m) text = m[0]
    return { analysis: JSON.parse(text) }
  } catch (e: any) {
    return { error: e?.message || 'خطا در تحلیل' }
  }
}
