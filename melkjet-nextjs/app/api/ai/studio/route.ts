import { NextRequest, NextResponse } from 'next/server'
import { chatCompleteSafe, chatVision, generateImageSafe, agentModel } from '@/app/lib/gapgpt'

// تولید تصویر کند است؛ اجازهٔ اجرای طولانی‌تر بده تا قبل از اتمام، پراکسی اتصال را نبندد.
export const runtime = 'nodejs'
export const maxDuration = 300

// استودیو: از پارامترهای فضا (و فهرست اتاق‌های عکس‌گرفته‌شده) یک پلان دوبعدی و یک
// رندر سه‌بعدی می‌سازد + توضیح چیدمان. از مدل‌های ایجنت StudioAgent استفاده می‌کند.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const area = String(b.area || '').replace(/[^\d]/g, '') || '۱۰۰'
  const bedrooms = String(b.bedrooms || '2')
  const style = String(b.style || 'مدرن')
  const openPlan = !!b.openPlan
  const rooms: string[] = Array.isArray(b.rooms) ? b.rooms.filter(Boolean).slice(0, 12) : []
  // عکس‌های واقعی اتاق‌ها: [{ label, image(dataURL) }]
  const photos: { label: string; image: string }[] = Array.isArray(b.photos)
    ? b.photos.filter((p: any) => p && typeof p.image === 'string' && p.image.startsWith('data:')).slice(0, 8)
    : []

  const textModel = agentModel('studio', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')
  // مدل بینایی برای تحلیل عکس‌ها (StudioAgent/ImageAgent چندوجهی‌اند)
  const visionModel = agentModel('studio', 'text') || agentModel('image', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')
  const imgModel = agentModel('studio', 'image') || agentModel('content', 'image')
  if (!imgModel) {
    return NextResponse.json({ error: 'به ایجنت StudioAgent یک «مدل تولید تصویر» تخصیص بده (پنل → API و مدل‌های AI → StudioAgent → مدل تصویر).' }, { status: 400 })
  }

  const styleEn = style.includes('کلاسیک') ? 'classic' : style.includes('مینیمال') ? 'minimal' : 'modern'
  const roomsFa = rooms.length ? rooms.join('، ') : 'نشیمن، آشپزخانه، اتاق‌خواب، سرویس بهداشتی'

  // ۱) اگر عکس فرستاده شده، با مدل بینایی فضاها را تحلیل کن تا پلان با واقعیت بخواند.
  let visionEn = ''   // توصیف انگلیسی برای پرامپتِ تولید تصویر
  if (photos.length && visionModel) {
    try {
      const labels = photos.map(p => p.label).join('، ')
      visionEn = await chatVision(visionModel,
        `These are photos of the rooms of one residential apartment (${labels}). Look carefully and produce a SHORT English architectural brief to recreate THIS specific unit as a floor plan and 3D render: list each room and its function, the relative layout/adjacency of spaces, window/light positions, flooring & wall materials/colors, and the overall interior style. Be concrete and faithful to the photos. Max 120 words, no preamble.`,
        photos.map(p => p.image), { max_tokens: 500 }).catch(() => '')
    } catch { /* بینایی اختیاری است */ }
  }
  const visionLine = visionEn ? ` Match this real apartment as closely as possible: ${visionEn}` : ''

  const planPrompt = `Architectural 2D floor plan, top-down blueprint view, ${area} square meter residential apartment, ${bedrooms} bedrooms, ${styleEn} style, ${openPlan ? 'open-plan kitchen and living room' : 'separated kitchen and living room'}, clearly labeled rooms (living room, kitchen, bedrooms, bathroom), walls and doors, furniture layout, dimension lines, clean technical line drawing, white background, high detail.${visionLine}`
  const renderPrompt = `3D isometric dollhouse cutaway render of a ${styleEn} residential apartment interior, ${area} square meters, ${bedrooms} bedrooms, ${openPlan ? 'open-plan living and kitchen' : 'separate rooms'}, realistic furniture and materials, soft natural lighting, architectural visualization, high quality.${visionLine}`

  // همه هم‌زمان اجرا می‌شوند (متنِ توضیح + دو تصویر) تا مجموع زمان کم بماند و
  // قبل از تمام‌شدن، تایم‌اوت پراکسی اتصال را نبندد.
  const descTask: Promise<string> = textModel
    ? chatCompleteSafe(textModel, [
        { role: 'system', content: 'تو معمار داخلی هستی. بر اساس پارامترها (و در صورت وجود، تحلیل عکس‌های واقعی)، چیدمان منطقی فضاها و توزیع متراژ را در ۳ تا ۴ جملهٔ فارسی توضیح بده. کوتاه و کاربردی.' },
        { role: 'user', content: `متراژ کل: ${area} مترمربع\nتعداد خواب: ${bedrooms}\nسبک: ${style}\nپلان ${openPlan ? 'اوپن (نشیمن و آشپزخانه یکپارچه)' : 'بسته'}\nفضاهای موجود: ${roomsFa}${visionEn ? `\nتحلیل عکس‌های واقعی واحد: ${visionEn}` : ''}` },
      ], { max_tokens: 400 }).catch(() => '')
    : Promise.resolve('')

  const [descRes, planRes, renderRes] = await Promise.allSettled([
    descTask,
    generateImageSafe(imgModel, planPrompt),
    generateImageSafe(imgModel, renderPrompt),
  ])
  const description = descRes.status === 'fulfilled' ? (descRes.value || '') : ''
  const planUrl = planRes.status === 'fulfilled' ? planRes.value.url : ''
  const renderUrl = renderRes.status === 'fulfilled' ? renderRes.value.url : ''
  const usedModel = planRes.status === 'fulfilled' ? planRes.value.model : renderRes.status === 'fulfilled' ? renderRes.value.model : imgModel

  if (!planUrl && !renderUrl) {
    const reason = planRes.status === 'rejected' ? planRes.reason : renderRes.status === 'rejected' ? renderRes.reason : null
    const detail = reason?.message || ''
    const is404 = /HTTP 404|bad_response_status_code|openai_error/i.test(detail)
    const msg = is404
      ? `مدل تصویرِ «${imgModel}» برای تولید تصویر معتبر نیست. در پنل → API و مدل‌های AI → StudioAgent یک «مدل تولید تصویر» معتبر (مثل dall-e-3) انتخاب کن.`
      : (detail || 'خطا در تولید تصویر — دوباره تلاش کنید')
    return NextResponse.json({ error: msg }, { status: 200 })
  }

  return NextResponse.json({ ok: true, description, planUrl, renderUrl, model: usedModel })
}
