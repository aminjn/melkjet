import { NextRequest, NextResponse } from 'next/server'
import { chatCompleteSafe, chatVisionSafe, generateImageSafe, agentModel } from '@/app/lib/gapgpt'
import { renderFloorPlanSVG, renderIsoSVG, svgDataUrl, type PlanLayout, type PlanRoom } from '@/app/lib/floorplan-svg'
import { uploadToImgbb } from '@/app/lib/img-host'
import { getAdminData } from '@/app/lib/admin-store'

export const runtime = 'nodejs'
export const maxDuration = 300

// نوعِ فضا را از روی نام فارسی حدس می‌زند
function roomType(label: string): string {
  const s = label || ''
  if (/آشپز/.test(s)) return 'kitchen'
  if (/نشیمن|پذیرا|نشین/.test(s)) return 'living'
  if (/ناهار/.test(s)) return 'dining'
  if (/خواب|اتاق|مستر/.test(s)) return 'bedroom'
  if (/سرویس|حمام|بهداشت|توالت|دستشو/.test(s)) return 'bathroom'
  if (/تراس|بالکن|بالکن|حیاط/.test(s)) return 'balcony'
  if (/راهرو|ورودی|هال|لابی/.test(s)) return 'hall'
  return 'other'
}

// چیدمان تقریبیِ قطعی از روی نام فضاها (وقتی تحلیل عکس در دسترس نیست) — هیچ‌وقت ارورِ خالی ندهیم.
function layoutFromLabels(labelsArr: string[]): PlanLayout {
  const names = labelsArr.filter(Boolean).slice(0, 12)
  const n = Math.max(1, names.length)
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))))
  const rows = Math.ceil(n / cols)
  const rooms: PlanRoom[] = names.map((name, i) => ({ name, type: roomType(name), x: i % cols, y: Math.floor(i / cols), w: 1, h: 1 }))
  return { cols, rows, rooms, summaryFa: `چیدمان تقریبی بر اساس فضاهای واردشده: ${names.join('، ')}.` }
}

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
    // گپ نه base64 می‌پذیرد و نه هاست‌های ایرانی را می‌گیرد؛ عکس‌ها را روی imgbb (i.ibb.co
    // که گپ می‌تواند بخواندش) آپلود می‌کنیم. آپلود از طریق پروکسیِ سرور به api.imgbb.com.
    const admin = getAdminData()
    const imgbbKey = admin.imgbb?.apiKey
    const proxyUrl = admin.divar?.proxyUrl
    const b64s = photos.slice(0, 4).map(p => {
      const ci = p.image.indexOf(',')
      return ci > 0 ? p.image.slice(ci + 1) : ''
    }).filter(Boolean)
    let imgs: string[] = []
    let uploadErr = ''
    if (imgbbKey) {
      const uploaded = await Promise.allSettled(b64s.map(b => uploadToImgbb(imgbbKey, b, proxyUrl)))
      imgs = uploaded.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<string>).value)
      uploadErr = (uploaded.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined)?.reason?.message || ''
    } else {
      uploadErr = 'no_imgbb'
    }
    const visionPrompt =
      `These photos show the rooms of ONE existing unit (~${area} m²; room labels: ${labels}). Reconstruct its AS-BUILT floor plan as a SCHEMATIC GRID — do NOT design or improve anything, only reflect what's really there.\n` +
      `Model the footprint as a grid of cols×rows cells (pick cols,rows between 3 and 6 to fit the real proportions). Place EVERY real room as a rectangle on the grid in its REAL relative position/adjacency as seen in the photos; rooms should tile the rectangle with minimal gaps/overlaps. Use ONLY rooms visible in the photos — never invent rooms.\n` +
      `"type" must be one of: kitchen, living, bedroom, bathroom, hall, balcony, office, dining, other.\n` +
      `Return ONLY valid JSON, no markdown, exactly this shape:\n` +
      `{"cols":N,"rows":N,"rooms":[{"name":"<persian label>","type":"<type>","x":0,"y":0,"w":1,"h":1}],"summaryFa":"<one short Persian sentence describing the EXISTING layout, no suggestions>"}\n` +
      `x,y are 0-based top-left grid coords; w,h are sizes in cells; every room must fit inside cols×rows.`

    let raw = '', visionErr = ''
    if (imgs.length) {
      try {
        raw = (await chatVisionSafe(visionModel, visionPrompt, imgs, { max_tokens: 900, timeout: 40000 })).text
      } catch (e: any) { visionErr = e?.message || 'خطای نامشخص' }
    } else {
      // آپلودِ عکس‌ها روی imgbb ناموفق/تنظیم‌نشده → بدون تحلیل عکس ادامه نده
      visionErr = uploadErr === 'no_imgbb'
        ? 'کلید imgbb تنظیم نشده (پنل → اتصال‌ها → imgbb) تا عکس‌ها برای تحلیل آپلود شوند'
        : `آپلودِ عکس‌ها روی imgbb ناموفق بود: ${uploadErr.slice(0, 150)}`
    }

    let parsed = extractJson(raw) as PlanLayout | null
    // تلاش دوم: اگر مدل پاسخ داد ولی JSON معتبر نبود، با یک مدل متنی به قالب JSON تبدیلش کن
    if (raw && !(parsed && Array.isArray(parsed.rooms) && parsed.rooms.length)) {
      try {
        const fixed = await chatCompleteSafe(visionModel, [
          { role: 'user', content: `این تحلیل را فقط به همین JSON تبدیل کن و چیز دیگری ننویس:\n{"cols":N,"rows":N,"rooms":[{"name","type","x","y","w","h"}],"summaryFa":""}\nتحلیل:\n${raw.slice(0, 2000)}` },
        ], { max_tokens: 700 })
        parsed = extractJson(fixed) as PlanLayout | null
      } catch { /* ادامه به خطای زیر */ }
    }

    if (parsed && Array.isArray(parsed.rooms) && parsed.rooms.length) {
      const planUrl = svgDataUrl(renderFloorPlanSVG(parsed, area, 'پلان وضع موجود'))
      // رندرِ سه‌بعدی: اگر مدلِ تولیدِ تصویر تخصیص داده شده، یک رندرِ واقع‌گرایانه می‌سازیم؛
      // وگرنه به نمای ایزومتریکِ SVG برمی‌گردیم.
      let renderUrl = svgDataUrl(renderIsoSVG(parsed, area, 'نمای سه‌بعدی'))
      let renderReal = false
      const imgModelPhoto = agentModel('studio', 'image') || agentModel('content', 'image')
      if (imgModelPhoto) {
        const roomsList = parsed.rooms.map(r => r.name).filter(Boolean).join(', ')
        const renderPrompt = `3D isometric dollhouse cutaway render of a real residential apartment, about ${area} square meters, containing exactly these rooms in their real relative layout: ${roomsList}. Realistic furniture and materials matching each room's function, soft natural daylight, architectural visualization, top-down isometric angle, clean and high quality. No text labels.`
        try { const r = await generateImageSafe(imgModelPhoto, renderPrompt); if (r.url) { renderUrl = r.url; renderReal = true } } catch { /* به SVG برمی‌گردیم */ }
      }
      const description = String(parsed.summaryFa || '').trim()
        || `این واحد شامل ${parsed.rooms.map(r => r.name).filter(Boolean).join('، ')} است که از روی عکس‌ها بازسازی شده است.`
      // layout را هم برمی‌گردانیم تا در ویرایشگرِ آفلاین قابل‌اصلاح باشد
      return NextResponse.json({ ok: true, mode: 'photo', description, planUrl, renderUrl, svg: !renderReal, layout: { cols: parsed.cols, rows: parsed.rows, rooms: parsed.rooms } })
    }

    // تحلیل عکس در دسترس نبود → به‌جای ارورِ خالی، نقشهٔ تقریبی از روی نام فضاها بساز.
    const fallbackLabels = (rooms.length ? rooms : photos.map(p => p.label))
    if (fallbackLabels.filter(Boolean).length) {
      const layout = layoutFromLabels(fallbackLabels)
      const why = !raw
        ? 'تحلیل عکس روی سرویس هوش مصنوعی فعلی در دسترس نبود'
        : 'تحلیل عکس‌ها به نتیجهٔ ساخت‌یافته نرسید'
      return NextResponse.json({
        ok: true, mode: 'approx',
        description: `این نقشه «تقریبی» است و بر اساس فضاهایی که نام برده‌ای ساخته شده (نه از روی عکس‌ها) — چون ${why}. می‌توانی فضاها را کم/زیاد کنی تا نزدیک‌تر شود.`,
        planUrl: svgDataUrl(renderFloorPlanSVG(layout, area, 'پلان تقریبی')),
        renderUrl: svgDataUrl(renderIsoSVG(layout, area, 'نمای سه‌بعدی')),
        svg: true,
      })
    }
    return NextResponse.json({ error: `پردازش عکس ناموفق بود (${visionErr.slice(0, 140)}) و نام فضایی هم برای ساخت نقشهٔ تقریبی نبود.` }, { status: 200 })
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
