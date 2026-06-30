import { NextRequest, NextResponse } from 'next/server'
import { publicProject, regionLabel } from '@/app/lib/persiansaze-store'
import { ensurePSEnrich, getPSEnrich } from '@/app/lib/ps-enrich'

export const dynamic = 'force-dynamic'

// غنی‌سازیِ AI برای یک پروژه (دسترسی‌ها/امکاناتِ محله/توضیح) — کش‌شده بر hashId.
export async function GET(req: NextRequest) {
  const hashId = new URL(req.url).searchParams.get('hashId') || ''
  if (!hashId) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })

  const cached = getPSEnrich(hashId)
  if (cached) return NextResponse.json({ ok: true, cached: true, ...cached })

  const data = publicProject(hashId)
  if (!data) return NextResponse.json({ error: 'پروژه پیدا نشد' }, { status: 404 })
  const p = data.project
  const out = await ensurePSEnrich(hashId, { address: p.address, region: regionLabel(p) })
  return NextResponse.json({ ok: true, cached: false, ...out })
}
