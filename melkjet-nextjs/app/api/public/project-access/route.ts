import { NextRequest, NextResponse } from 'next/server'
import { publicProject, regionLabel, phaseLabel } from '@/app/lib/persiansaze-store'
import { ensurePSIntel, getPSEnrich } from '@/app/lib/ps-enrich'

export const dynamic = 'force-dynamic'

// نردبانِ مراحلِ ساخت برای محاسبهٔ درصدِ پیشرفت (هم‌راستا با پنلِ سازنده).
const LADDER = ['پی و اسکلت', 'سفت‌کاری', 'گچ و خاک', 'نازک‌کاری', 'تأسیسات', 'تحویل']
function progressOf(label: string): number {
  let idx = LADDER.findIndex(s => label && (label.includes(s) || s.includes(label)))
  if (idx < 0) {
    if (/اسکلت|پی|فونداسیون|گود/.test(label)) idx = 0
    else if (/سفت/.test(label)) idx = 1
    else if (/گچ|خاک/.test(label)) idx = 2
    else if (/نازک/.test(label)) idx = 3
    else if (/تأسیسات|تاسیسات|مکانیک|برق/.test(label)) idx = 4
    else if (/تحویل|نما|پایان|اتمام/.test(label)) idx = 5
    else idx = 2
  }
  return Math.round((idx / (LADDER.length - 1)) * 100)
}

// هوشِ پروژه (دسترسی‌های واقعی + تحلیلِ سرمایه‌گذاریِ AI) — کش‌شده بر hashId.
export async function GET(req: NextRequest) {
  const hashId = new URL(req.url).searchParams.get('hashId') || ''
  if (!hashId) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })

  const cached = getPSEnrich(hashId)
  if (cached) return NextResponse.json({ ok: true, cached: true, ...cached })

  const data = publicProject(hashId)
  if (!data) return NextResponse.json({ error: 'پروژه پیدا نشد' }, { status: 404 })
  const p = data.project, b = data.builder
  const phase = phaseLabel(p)
  const out = await ensurePSIntel(hashId, {
    address: p.address, region: regionLabel(p), lat: p.latitude, lng: p.longitude,
    phase, progress: progressOf(phase), floors: p.floors, units: p.units,
    residentialArea: p.residentialArea, groundArea: p.groundArea,
    builderName: b.name, builderProjects: b.projectCount,
  })
  return NextResponse.json({ ok: true, cached: false, ...out })
}
