import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { hasCap } from '@/app/lib/account-store'
import { getJob, stopJob, startBackgroundScrape } from '@/app/lib/hypersaz-scraper'

export const dynamic = 'force-dynamic'

async function guard() {
  const s = await getSession()
  if (!s) return null
  if (s.role === 'super_admin' || hasCap(s.phone, 'catalog')) return s
  return null
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ok: true, job: getJob() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  if (b.action === 'start') { const r = startBackgroundScrape(); return NextResponse.json({ ok: true, ...r, job: getJob() }) }
  if (b.action === 'stop') { return NextResponse.json({ ok: true, job: stopJob() }) }
  return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
}
