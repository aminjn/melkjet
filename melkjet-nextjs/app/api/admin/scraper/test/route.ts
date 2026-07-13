import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { scrapeSource } from '@/app/lib/scraper-engine'
import type { Source } from '@/app/lib/scraper-store'

// Dry-run a source config without saving. Returns a preview of extracted items.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).length > 0)) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  if (!b.url) return NextResponse.json({ error: 'آدرس الزامی است' }, { status: 400 })
  try { new URL(b.url) } catch { return NextResponse.json({ error: 'آدرس نامعتبر' }, { status: 400 }) }

  const fake: Source = {
    id: 'test', name: 'test', url: String(b.url),
    type: b.type || 'listing', category: b.category,
    method: b.method || 'auto', enabled: true, schedule: 'manual',
    container: b.container, fields: b.fields, meta: b.meta,
    pages: b.pages ? Math.max(1, Math.min(20, parseInt(b.pages) || 1)) : undefined,
    useProxy: b.useProxy === true,
    lastRun: null, lastCount: 0, status: 'idle',
  }
  try {
    const items = await scrapeSource(fake)
    return NextResponse.json({ ok: true, count: items.length, items: items.slice(0, 8) })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'خطا در واکشی' }, { status: 200 })
  }
}
