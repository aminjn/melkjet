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

  // ۱) اگر عکس فرستاده شده، با مدل بینایی پلانِ «وضع موجود» را از روی عکس‌ها استخراج کن.
  let visionEn = ''   // توصیف انگلیسی برای بازسازی پلانِ موجود
  if (photos.length && visionModel) {
    try {
      const labels = photos.map(p => p.label).join('، ')
      visionEn = await chatVision(visionModel,
        `These photos show the rooms of ONE EXISTING apartment (~${area} m², labels: ${labels}). Your job is to RECONSTRUCT the AS-BUILT floor plan of THIS real unit — not to suggest or improve anything. Infer from the photos: every room and its function, the relative position & adjacency of rooms (which connects to which via doors/openings/hallway), exterior walls and window positions, approximate proportions/sizes, and the existing furniture, flooring and finishes. Output a concise, concrete English spec that an illustrator could use to redraw the EXISTING layout faithfully. Do NOT invent rooms that aren't in the photos. Max 130 words, no preamble.`,
        photos.map(p => p.image), { max_tokens: 550 }).catch(() => '')
    } catch { /* بینایی اختیاری است */ }
  }
  const reconstruct = !!visionEn   // وقتی عکس تحلیل شد → حالت بازسازی وضع موجود

  // در حالت بازسازی، پلانِ واقعی را از روی تحلیل عکس‌ها می‌سازیم (نه یک پلان عمومی/پیشنهادی)
  const planPrompt = reconstruct
    ? `Accurate AS-BUILT 2D floor plan reconstruction of an EXISTING ~${area} square meter apartment. Reproduce EXACTLY this real layout — only the rooms described, correct adjacencies, doors and window positions, furniture matching the photos. Do not add or remove rooms. Top-down architectural blueprint, labeled rooms, walls, doors, furniture, dimension lines, clean technical line drawing, white background, high detail. The real apartment to reproduce: ${visionEn}`
    : `Architectural 2D floor plan, top-down blueprint view, ${area} square meter residential apartment, ${bedrooms} bedrooms, ${styleEn} style, ${openPlan ? 'open-plan kitchen and living room' : 'separated kitchen and living room'}, clearly labeled rooms (living room, kitchen, bedrooms, bathroom), walls and doors, furniture layout, dimension lines, clean technical line drawing, white background, high detail`
  const renderPrompt = reconstruct
    ? `3D isometric dollhouse cutaway render reconstructing THIS EXISTING apartment interior exactly as in the photos — same rooms, same relative layout, matching furniture, flooring and finishes. Realistic materials, soft natural lighting, architectural visualization, high quality. The real apartment to reproduce: ${visionEn}`
    : `3D isometric dollhouse cutaway render of a ${styleEn} residential apartment interior, ${area} square meters, ${bedrooms} bedrooms, ${openPlan ? 'open-plan living and kitchen' : 'separate rooms'}, realistic furniture and materials, soft natural lighting, architectural visualization, high quality`

  // توضیح فارسی: در حالت بازسازی فقط «وضع موجود» را توصیف کن، هیچ پیشنهاد طراحی نده.
  const descTask: Promise<string> = textModel
    ? chatCompleteSafe(textModel, reconstruct
      ? [
        { role: 'system', content: 'تو فقط وضعِ موجودِ یک واحد را از روی تحلیل عکس‌ها توصیف می‌کنی. صرفاً بگو چه فضاهایی وجود دارد، موقعیت و مجاورت آن‌ها، و کاربری هر فضا. هیچ پیشنهاد طراحی، بهبود یا «بهتر است» نده. ۳ تا ۴ جملهٔ فارسی، فقط توصیفِ واقعیت.' },
        { role: 'user', content: `متراژ تقریبی: ${area} مترمربع\nتحلیل عکس‌های واقعی واحد:\n${visionEn}` },
      ]
      : [
        { role: 'system', content: 'تو معمار داخلی هستی. بر اساس پارامترها چیدمان منطقی فضاها و توزیع متراژ را در ۳ تا ۴ جملهٔ فارسی توضیح بده. کوتاه و کاربردی.' },
        { role: 'user', content: `متراژ کل: ${area} مترمربع\nتعداد خواب: ${bedrooms}\nسبک: ${style}\nپلان ${openPlan ? 'اوپن (نشیمن و آشپزخانه یکپارچه)' : 'بسته'}\nفضاهای موجود: ${roomsFa}` },
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
