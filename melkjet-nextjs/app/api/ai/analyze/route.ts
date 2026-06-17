import { NextRequest, NextResponse } from 'next/server'
import { chatComplete, agentModel } from '@/app/lib/gapgpt'

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
    `توضیحات: ${(b.description || '').slice(0, 1200)}`,
  ].join('\n')

  const system = `تو کارشناس املاک ملک‌جت هستی. این آگهی را تحلیل کن و فقط یک JSON معتبر برگردان (بدون متن اضافه) با این ساختار:
{"summary":"خلاصه ۲ تا ۳ جمله‌ای فارسی","pros":["مزیت ۱","مزیت ۲","مزیت ۳"],"cons":["نکته ۱","نکته ۲"],"scores":{"ارزش خرید":8.5,"کیفیت ساخت":8,"دسترسی":9,"محله":8.5,"سرمایه‌گذاری":8},"confidence":92}
اعداد scores بین ۰ تا ۱۰ و confidence بین ۰ تا ۱۰۰.`

  try {
    let text = await chatComplete(model, [{ role: 'system', content: system }, { role: 'user', content: info }], { temperature: 0.5 })
    // strip code fences / extract JSON
    const m = text.match(/\{[\s\S]*\}/)
    if (m) text = m[0]
    const data = JSON.parse(text)
    return NextResponse.json({ ok: true, analysis: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تحلیل' }, { status: 200 })
  }
}
