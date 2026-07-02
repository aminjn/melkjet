import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { hasCap } from '@/app/lib/account-store'
import { getJob, stopJob, startBackgroundScrape, getConfig, setConfig, testConnection, inspectProduct, SOURCES, isSource } from '@/app/lib/hypersaz-scraper'

export const dynamic = 'force-dynamic'

async function guard() {
  const s = await getSession()
  if (!s) return null
  if (s.role === 'super_admin' || hasCap(s.phone, 'catalog')) return s
  return null
}
const srcOf = (v: any) => (isSource(String(v)) ? String(v) : 'hypersaz')

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const source = srcOf(req.nextUrl.searchParams.get('source'))
  return NextResponse.json({
    ok: true, source, sources: SOURCES,
    job: getJob(source), config: getConfig(source),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const source = srcOf(b.source)
  switch (b.action) {
    case 'start': { const r = startBackgroundScrape(source); return NextResponse.json({ ok: true, ...r, job: getJob(source) }) }
    case 'stop': return NextResponse.json({ ok: true, job: stopJob(source) })
    case 'setConfig': return NextResponse.json({ ok: true, config: setConfig(source, b.config || {}) })
    case 'test': { try { const report = await testConnection(source); return NextResponse.json({ ok: true, report }) } catch (e: any) { return NextResponse.json({ error: e?.message || 'خطا در تست' }, { status: 500 }) } }
    case 'inspect': { if (!b.url) return NextResponse.json({ error: 'URL لازم است' }, { status: 400 }); try { const r = await inspectProduct(source, String(b.url)); return NextResponse.json({ ok: true, inspect: r }) } catch (e: any) { return NextResponse.json({ error: e?.message || 'خطا در بررسی' }, { status: 500 }) } }
    default: return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
  }
}
