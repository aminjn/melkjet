import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { scrapeBonyadLawyers, debugBonyadScrape, bonyadLawyerCount } from '@/app/lib/bonyad-lawyers'

// فاز ۲۵۰ — اسکرپِ وکلای ملکیِ بنیاد وکلا برای دایرکتوریِ متخصصان (دستهٔ «حقوقی»).
async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin' ? null : NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
}

export async function GET() {
  const bad = await guard(); if (bad) return bad
  return NextResponse.json({ count: await bonyadLawyerCount() })
}

export async function POST(req: NextRequest) {
  const bad = await guard(); if (bad) return bad
  const body = await req.json().catch(() => ({} as { action?: string }))

  if (body.action === 'debug') {
    return NextResponse.json(await debugBonyadScrape())
  }
  if (body.action === 'scrape') {
    const r = await scrapeBonyadLawyers()
    return NextResponse.json({ ok: r.found > 0, ...r })
  }
  return NextResponse.json({ error: 'action نامعتبر' }, { status: 400 })
}
