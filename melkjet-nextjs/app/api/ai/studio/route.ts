import { NextRequest, NextResponse } from 'next/server'
import { chatCompleteSafe, chatVision, generateImageSafe, agentModel } from '@/app/lib/gapgpt'
import { renderFloorPlanSVG, renderIsoSVG, svgDataUrl, type PlanLayout } from '@/app/lib/floorplan-svg'

export const runtime = 'nodejs'
export const maxDuration = 300

// استخراج اولین آبجکت JSON معتبر از خروجی مدل (با حذف ```json و متن اضافه)
function extractJson(s: string): any | null {
  if (!s) return null
  const cleaned = s.replace(/```json/gi, '').replace(/```/g, '')
  const a = cleaned.indexOf('{'), b = cleaned.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try { return JSON.parse(cleaned.slice(a, b + 1)) } catch { return null }
}

// استودیو: اگر عکس آپلود شده باشد، چیدمانِ واقعی را با مدل بینایی استخراج و نقشه را
// خودمان قطعی رسم می‌کنیم (بازسازی وضع موجود). در غیر این صورت با مدل تصویر یک پلان می‌سازد.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const area = Number(String(b.area || '').replace(/[^\d]/g, '')) || 100
  const bedrooms = String(b.bedrooms || '2')
  const style = String(b.style || 'مدرن')
  const openPlan = !!b.openPlan
  const rooms: string[] = Array.isArray(b.rooms) ? b.rooms.filter(Boolean).slice(0, 12) : []
  const photos: { label: string; image: string }[] = Array.isArray(b.photos)
    ? b.photos.filter((p: any) => p && typeof p.image === 'string' && p.image.startsWith('data:')).slice(0, 8)
    : []

  const visionModel = agentModel('studio', 'text') || agentModel('image', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')

  // ===== حالت بازسازی وضع موجود (وقتی عکس داریم) =====
  if (photos.length && visionModel) {
    const labels = photos.map(p => p.label).join('، ')
    let raw = ''
    try {
      raw = await chatVision(visionModel,
        `These photos show the rooms of ONE existing unit (~${area} m²; room labels: ${labels}). Reconstruct its AS-BUILT floor plan as a SCHEMATIC GRID — do NOT design or improve anything, only reflect what's really there.\n` +
        `Model the footprint as a grid of cols×rows cells (pick cols,rows between 3 and 6 to fit the real proportions). Place EVERY real room as a rectangle on the grid in its REAL relative position/adjacency as seen in the photos; rooms should tile the rectangle with minimal gaps/overlaps. Use ONLY rooms visible in the photos — never invent rooms.\n` +
        `"type" must be one of: kitchen, living, bedroom, bathroom, hall, balcony, office, dining, other.\n` +
        `Return ONLY valid JSON, no markdown, exactly this shape:\n` +
        `{"cols":N,"rows":N,"rooms":[{"name":"<persian label>","type":"<type>","x":0,"y":0,"w":1,"h":1}],"summaryFa":"<one short Persian sentence describing the EXISTING layout, no suggestions>"}\n` +
        `x,y are 0-based top-left grid coords; w,h are sizes in cells; every room must fit inside cols×rows.`,
        photos.map(p => p.image), { max_tokens: 800 }).catch(() => '')
    } catch { raw = '' }

    const parsed = extractJson(raw) as PlanLayout | null
    if (parsed && Array.isArray(parsed.rooms) && parsed.rooms.length) {
      const planUrl = svgDataUrl(renderFloorPlanSVG(parsed, area, 'پلان وضع موجود'))
      const renderUrl = svgDataUrl(renderIsoSVG(parsed, area, 'نمای سه‌بعدی'))
      const description = String(parsed.summaryFa || '').trim()
        || `این واحد شامل ${parsed.rooms.map(r => r.name).filter(Boolean).join('، ')} است که از روی عکس‌ها بازسازی شده است.`
      return NextResponse.json({ ok: true, mode: 'photo', description, planUrl, renderUrl, svg: true })
    }
    // اگر بینایی نتوانست چیدمان بدهد، با پیام شفاف ادامه نده به حالت طراحی (که خواستهٔ کاربر نیست)
    return NextResponse.json({
      error: 'مدل بینایی نتوانست چیدمان را از عکس‌ها استخراج کند. عکس‌های واضح‌تر و کامل‌تر از هر فضا بده، یا مطمئن شو مدلِ متنِ StudioAgent یک مدل چندوجهی (مثل chatgpt-4o-latest) است.',
    }, { status: 200 })
  }

  // ===== حالت پارامتری (بدون عکس) — با مدل تصویر یک پلان نمونه می‌سازد =====
  const textModel = agentModel('studio', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')
  const imgModel = agentModel('studio', 'image') || agentModel('content', 'image')
  if (!imgModel) {
    return NextResponse.json({ error: 'برای ساخت پلان بدون عکس، به StudioAgent یک «مدل تولید تصویر» تخصیص بده — یا چند عکس از فضا اضافه کن تا از روی عکس بازسازی شود.' }, { status: 400 })
  }
  const styleEn = style.includes('کلاسیک') ? 'classic' : style.includes('مینیمال') ? 'minimal' : 'modern'
  const roomsFa = rooms.length ? rooms.join('، ') : 'نشیمن، آشپزخانه، اتاق‌خواب، سرویس بهداشتی'
  const planPrompt = `Architectural 2D floor plan, top-down blueprint view, ${area} square meter residential apartment, ${bedrooms} bedrooms, ${styleEn} style, ${openPlan ? 'open-plan kitchen and living room' : 'separated kitchen and living room'}, clearly labeled rooms, walls and doors, furniture layout, dimension lines, clean technical line drawing, white background, high detail`
  const renderPrompt = `3D isometric dollhouse cutaway render of a ${styleEn} residential apartment interior, ${area} square meters, ${bedrooms} bedrooms, ${openPlan ? 'open-plan living and kitchen' : 'separate rooms'}, realistic furniture and materials, soft natural lighting, architectural visualization, high quality`

  const descTask: Promise<string> = textModel
    ? chatCompleteSafe(textModel, [
        { role: 'system', content: 'تو معمار داخلی هستی. بر اساس پارامترها چیدمان منطقی فضاها و توزیع متراژ را در ۳ تا ۴ جملهٔ فارسی توضیح بده. کوتاه و کاربردی.' },
        { role: 'user', content: `متراژ کل: ${area} مترمربع\nتعداد خواب: ${bedrooms}\nسبک: ${style}\nپلان ${openPlan ? 'اوپن' : 'بسته'}\nفضاها: ${roomsFa}` },
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

  if (!planUrl && !renderUrl) {
    const reason = planRes.status === 'rejected' ? planRes.reason : renderRes.status === 'rejected' ? renderRes.reason : null
    const detail = reason?.message || ''
    const is404 = /HTTP 404|bad_response_status_code|openai_error/i.test(detail)
    const msg = is404
      ? `مدل تصویرِ «${imgModel}» برای تولید تصویر معتبر نیست. یک «مدل تولید تصویر» معتبر (مثل dall-e-3) به StudioAgent بده.`
      : (detail || 'خطا در تولید تصویر — دوباره تلاش کنید')
    return NextResponse.json({ error: msg }, { status: 200 })
  }
  return NextResponse.json({ ok: true, mode: 'params', description, planUrl, renderUrl })
}
