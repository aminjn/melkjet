import { NextRequest, NextResponse } from 'next/server'
import { chatCompleteSafe, generateImage, agentModel } from '@/app/lib/gapgpt'

// استودیو: از پارامترهای فضا (و فهرست اتاق‌های عکس‌گرفته‌شده) یک پلان دوبعدی و یک
// رندر سه‌بعدی می‌سازد + توضیح چیدمان. از مدل‌های ایجنت StudioAgent استفاده می‌کند.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const area = String(b.area || '').replace(/[^\d]/g, '') || '۱۰۰'
  const bedrooms = String(b.bedrooms || '2')
  const style = String(b.style || 'مدرن')
  const openPlan = !!b.openPlan
  const rooms: string[] = Array.isArray(b.rooms) ? b.rooms.filter(Boolean).slice(0, 12) : []

  const textModel = agentModel('studio', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')
  const imgModel = agentModel('studio', 'image') || agentModel('content', 'image')
  if (!imgModel) {
    return NextResponse.json({ error: 'به ایجنت StudioAgent یک «مدل تولید تصویر» تخصیص بده (پنل → API و مدل‌های AI → StudioAgent → مدل تصویر).' }, { status: 400 })
  }

  const styleEn = style.includes('کلاسیک') ? 'classic' : style.includes('مینیمال') ? 'minimal' : 'modern'
  const roomsFa = rooms.length ? rooms.join('، ') : 'نشیمن، آشپزخانه، اتاق‌خواب، سرویس بهداشتی'

  // ۱) توضیح چیدمان (متن) — اختیاری ولی مفید
  let description = ''
  if (textModel) {
    try {
      description = await chatCompleteSafe(textModel, [
        { role: 'system', content: 'تو معمار داخلی هستی. بر اساس پارامترها، چیدمان منطقی فضاها و توزیع متراژ را در ۳ تا ۴ جملهٔ فارسی توضیح بده. کوتاه و کاربردی.' },
        { role: 'user', content: `متراژ کل: ${area} مترمربع\nتعداد خواب: ${bedrooms}\nسبک: ${style}\nپلان ${openPlan ? 'اوپن (نشیمن و آشپزخانه یکپارچه)' : 'بسته'}\nفضاهای موجود: ${roomsFa}` },
      ], { max_tokens: 400 })
    } catch { /* توضیح اختیاری */ }
  }

  // ۲) دو تصویر: پلان دوبعدی + رندر سه‌بعدی
  const planPrompt = `Architectural 2D floor plan, top-down blueprint view, ${area} square meter residential apartment, ${bedrooms} bedrooms, ${styleEn} style, ${openPlan ? 'open-plan kitchen and living room' : 'separated kitchen and living room'}, clearly labeled rooms (living room, kitchen, bedrooms, bathroom), walls and doors, furniture layout, dimension lines, clean technical line drawing, white background, high detail`
  const renderPrompt = `3D isometric dollhouse cutaway render of a ${styleEn} residential apartment interior, ${area} square meters, ${bedrooms} bedrooms, ${openPlan ? 'open-plan living and kitchen' : 'separate rooms'}, realistic furniture and materials, soft natural lighting, architectural visualization, high quality`

  const [planRes, renderRes] = await Promise.allSettled([
    generateImage(imgModel, planPrompt),
    generateImage(imgModel, renderPrompt),
  ])
  const planUrl = planRes.status === 'fulfilled' ? planRes.value : ''
  const renderUrl = renderRes.status === 'fulfilled' ? renderRes.value : ''

  if (!planUrl && !renderUrl) {
    const err = planRes.status === 'rejected' ? (planRes.reason?.message || 'خطا در تولید تصویر') : 'خطا در تولید تصویر'
    return NextResponse.json({ error: err }, { status: 200 })
  }

  return NextResponse.json({ ok: true, description, planUrl, renderUrl, model: imgModel })
}
