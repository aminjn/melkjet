import { NextRequest, NextResponse } from 'next/server'
import { chatCompleteSafe, generateImage, agentModel } from '@/app/lib/gapgpt'

// System prompts per agent — defines what each agent does
const SYSTEMS: Record<string, string> = {
  chat: 'تو دستیار هوشمند ملک‌جت هستی، یک پلتفرم املاک ایرانی. به فارسی، کوتاه، دقیق و دوستانه پاسخ بده. در خرید، فروش، اجاره، تحلیل قیمت، انتخاب محله و سرمایه‌گذاری ملکی کمک کن.',
  content: 'تو نویسندهٔ محتوای حرفه‌ای املاک هستی. مقالهٔ سئو-محور، روان و فارسی بنویس با تیتر و پاراگراف‌بندی مناسب.',
  moderation: 'تو ناظر آگهی‌های املاک هستی. آگهی داده‌شده را بررسی کن و یک امتیاز ۰ تا ۱۰۰ برای اعتبار/کیفیت بده و دلیل کوتاه بگو. خروجی فارسی و مختصر.',
  pricing: 'تو کارشناس قیمت‌گذاری ملک هستی. بر اساس اطلاعات داده‌شده برآورد قیمت منصفانه و بازهٔ منطقی بده و دلیل بیاور. فارسی و مختصر.',
  summary: 'تو خلاصه‌سازی هستی. متن داده‌شده را به فارسی خلاصه و نکات کلیدی را فهرست کن.',
  translation: 'تو مترجم هستی. متن را به زبان درخواستی (پیش‌فرض فارسی) ترجمه کن.',
  negotiation: 'تو مشاور مذاکرهٔ ملکی هستی. راهکار و جملات مذاکره پیشنهاد بده. فارسی و عملی.',
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const agent: string = body.agent || 'chat'
  const input: string = (body.input || '').toString().slice(0, 8000)
  const wantImage: boolean = !!body.image
  if (!input.trim()) return NextResponse.json({ error: 'ورودی خالی است' }, { status: 400 })

  const textModel = agentModel(agent, 'text')
  if (!textModel) return NextResponse.json({ error: `مدلی به ایجنت «${agent}» تخصیص داده نشده — از پنل API و مدل‌های AI انتخاب کن` }, { status: 400 })

  try {
    const system = SYSTEMS[agent] || SYSTEMS.chat
    const text = await chatCompleteSafe(textModel, [
      { role: 'system', content: system },
      { role: 'user', content: input },
    ])

    let imageUrl: string | undefined
    if (wantImage) {
      const imgModel = agentModel(agent, 'image')
      if (imgModel) {
        try { imageUrl = await generateImage(imgModel, input) } catch { /* image optional */ }
      }
    }
    return NextResponse.json({ ok: true, text, imageUrl, model: textModel })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در اجرای ایجنت' }, { status: 500 })
  }
}
