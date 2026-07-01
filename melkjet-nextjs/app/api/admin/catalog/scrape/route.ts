import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { hasCap } from '@/app/lib/account-store'
import { getJob, stopJob, startBackgroundScrape, getConfig, setConfig, testConnection, inspectProduct } from '@/app/lib/hypersaz-scraper'

export const dynamic = 'force-dynamic'

async function guard() {
  const s = await getSession()
  if (!s) return null
  if (s.role === 'super_admin' || hasCap(s.phone, 'catalog')) return s
  return null
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ok: true, job: getJob(), config: getConfig() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  switch (b.action) {
    case 'start': { const r = startBackgroundScrape(); return NextResponse.json({ ok: true, ...r, job: getJob() }) }
    case 'stop': return NextResponse.json({ ok: true, job: stopJob() })
    case 'setConfig': return NextResponse.json({ ok: true, config: setConfig(b.config || {}) })
    case 'test': { try { const report = await testConnection(); return NextResponse.json({ ok: true, report }) } catch (e: any) { return NextResponse.json({ error: e?.message || 'خطا در تست' }, { status: 500 }) } }
    case 'inspect': { if (!b.url) return NextResponse.json({ error: 'URL لازم است' }, { status: 400 }); try { const r = await inspectProduct(String(b.url)); return NextResponse.json({ ok: true, inspect: r }) } catch (e: any) { return NextResponse.json({ error: e?.message || 'خطا در بررسی' }, { status: 500 }) } }
    default: return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
  }
}
