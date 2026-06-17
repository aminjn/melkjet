import { NextRequest, NextResponse } from 'next/server'
import { chatCompleteSafe, agentModel } from '@/app/lib/gapgpt'

// Structured AI analysis for a property listing → fills the property page design.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const model = agentModel('pricing', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')
  if (!model) return NextResponse.json({ error: 'مدلی به ایجنت تخصیص داده نشده (پنل → API و مدل‌های AI → تخصیص خودکار)' }, { status: 400 })

  const info = [
    `عنوان: ${b.title || ''}`,
    `قیمت: ${b.price || ''}`,
    `موقعیت: ${b.location || ''}`,
    ...(Array.isArray(b.facts) ? b.facts.map((f: any) => `${f.label}: ${f.value}`) : []),
    Array.isArray(b.amenities) && b.amenities.length ? `امکانات موجود: ${b.amenities.join('، ')}` : '',
    `توضیحات: ${(b.description || '').slice(0, 1500)}`,
  ].filter(Boolean).join('\n')

  // detect deal type → relevant score labels
  const txt = `${b.price || ''} ${b.title || ''} ${b.meta?.['نوع معامله'] || ''}`
  const isRent = /ودیعه|اجاره|رهن/.test(txt) && !/فروش|خرید|قیمت کل/.test(txt)
  const scoreKeys = isRent
    ? '"ارزش اجاره":8.5,"موقعیت محله":8,"دسترسی":9,"کیفیت ساخت":8,"امکانات":8.5'
    : '"ارزش خرید":8.5,"سرمایه‌گذاری":8,"موقعیت محله":9,"دسترسی":8.5,"کیفیت ساخت":8'

  const system = `تو کارشناس املاک ملک‌جت هستی. این آگهی ${isRent ? 'اجاره‌ای' : 'فروشی'} را تحلیل کن و مشخصات کلیدی را فقط از متن آگهی استخراج کن (چیزی از خودت نساز؛ اگر فیلدی در متن نبود اصلاً نیاور). فقط یک JSON معتبر برگردان (بدون متن اضافه) با این ساختار:
{"facts":[{"label":"متراژ","value":"۲۸۵ متر"},{"label":"اتاق","value":"۴"}],"amenities":["آسانسور","پارکینگ"],"summary":"خلاصه ۲ تا ۳ جمله‌ای فارسی","pros":["مزیت ۱","مزیت ۲","مزیت ۳"],"cons":["نکته ۱","نکته ۲"],"scores":{${scoreKeys}},"confidence":92}
در facts فقط مواردی که صریحاً در متن آمده (متراژ، اتاق/خواب، سال ساخت، طبقه، پارکینگ، ودیعه، اجاره، قیمت). امتیازها باید متناسب با نوع ${isRent ? 'اجاره' : 'فروش'} باشد. مهم: در cons هیچ‌وقت نگو امکانی وجود ندارد اگر در «امکانات موجود» یا متن آمده باشد (مثلاً اگر پارکینگ هست، نبودش را به‌عنوان ضعف ننویس). اعداد scores بین ۰ تا ۱۰ و confidence بین ۰ تا ۱۰۰.`

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
