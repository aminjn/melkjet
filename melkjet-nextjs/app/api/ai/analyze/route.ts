import { NextRequest, NextResponse } from 'next/server'
import { chatCompleteSafe, agentModel } from '@/app/lib/gapgpt'
import { knowledgeFor } from '@/app/lib/market-data'

// Structured AI analysis for a property listing → fills the property page design.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const model = agentModel('pricing', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')
  if (!model) return NextResponse.json({ error: 'مدلی به ایجنت تخصیص داده نشده (پنل → API و مدل‌های AI → تخصیص خودکار)' }, { status: 400 })

  // real market knowledge for this neighbourhood (from uploaded docs / dataset)
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

  // detect deal type → relevant score labels
  const txt = `${b.price || ''} ${b.title || ''} ${b.meta?.['نوع معامله'] || ''}`
  const isRent = /ودیعه|اجاره|رهن/.test(txt) && !/فروش|خرید|قیمت کل/.test(txt)
  const scoreKeys = isRent
    ? '"ارزش اجاره":8.5,"موقعیت محله":8,"دسترسی":9,"کیفیت ساخت":8,"امکانات":8.5'
    : '"ارزش خرید":8.5,"سرمایه‌گذاری":8,"موقعیت محله":9,"دسترسی":8.5,"کیفیت ساخت":8'

  const system = `تو کارشناس املاک ملک‌جت هستی. این آگهی ${isRent ? 'اجاره‌ای' : 'فروشی'} را تحلیل کن و مشخصات کلیدی را فقط از متن آگهی استخراج کن (چیزی از خودت نساز؛ اگر فیلدی در متن نبود اصلاً نیاور). فقط یک JSON معتبر برگردان (بدون متن اضافه) با این ساختار:
{"facts":[{"label":"متراژ","value":"۲۸۵ متر"},{"label":"اتاق","value":"۴"}],"amenities":["آسانسور","پارکینگ"],"summary":"خلاصه ۲ تا ۳ جمله‌ای فارسی","pros":["مزیت ۱","مزیت ۲","مزیت ۳"],"cons":["نکته ۱","نکته ۲"],"scores":{${scoreKeys}},"confidence":92,"nearby":[{"type":"مترو","name":"ایستگاه مترو میرداماد","time":"۶ دقیقه پیاده"},{"type":"مرکز خرید","name":"مجتمع تجاری اطلس","time":"۴ دقیقه با ماشین"},{"type":"بیمارستان","name":"بیمارستان آتیه","time":"۹ دقیقه با ماشین"},{"type":"پارک","name":"بوستان نهج‌البلاغه","time":"۷ دقیقه پیاده"}],"priceTrend":{"values":[62,64,65,66,68,70,71,73,74,76,78,80],"yearGrowth":"۸٪","forecast":"ادامهٔ رشد ملایم"},"originality":{"verdict":"اصیل","fakeProbability":"کمتر از ۲٪"}}
- facts فقط مواردی که صریحاً در متن آمده. امتیازها متناسب با نوع ${isRent ? 'اجاره' : 'فروش'}.
- nearby: حداقل ۵ تا ۶ دسترسی واقعی و مهمِ همین محلهٔ «${district || b.location || ''}» با ذکر **نام دقیق و واقعی محل** (نه اسم کلی). مثلاً به‌جای «مترو» بنویس «ایستگاه مترو شهید بهشتی»، به‌جای «بیمارستان» نام واقعی بیمارستان آن منطقه، همین‌طور برای مدرسه/دانشگاه، پارک/بوستان، مرکز خرید/پاساژ، بزرگراه و خیابان اصلی. هر مورد: type نوع کلی (مترو/مرکز خرید/بیمارستان/پارک/مدرسه/اتوبوس/بانک/بزرگراه)، name نام واقعی همان محل، time زمان تقریبی با ذکر پیاده یا با ماشین. فقط مکان‌های واقعی همان محله را بیاور.
- priceTrend.values: ۱۲ عدد (روند نسبی قیمت هر متر در محله، صعودی منطقی). yearGrowth درصد رشد سالانه. forecast پیش‌بینی کوتاه.
- originality: ارزیابی اصالت آگهی بر اساس کامل بودن اطلاعات.
- در cons هرگز نگو امکانی نیست اگر در «امکانات موجود» آمده. اعداد scores ۰ تا ۱۰ و confidence ۰ تا ۱۰۰.`

  try {
    let text = await chatCompleteSafe(model, [{ role: 'system', content: system }, { role: 'user', content: info }], { temperature: 0.5 })
    // strip code fences / extract JSON
    const m = text.match(/\{[\s\S]*\}/)
    if (m) text = m[0]
    const data = JSON.parse(text)
    return NextResponse.json({ ok: true, analysis: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تحلیل' }, { status: 200 })
  }
}
