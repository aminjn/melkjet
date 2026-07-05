import { NextRequest, NextResponse } from 'next/server'
import { verifyIngestToken, saveIngestData } from '@/app/lib/search-console'

export const dynamic = 'force-dynamic'

// نقطهٔ ورودِ دادهٔ Search Console از GitHub Action.
// احراز با توکنِ اشتراکی (هدرِ x-gsc-token) — نه session، چون GitHub صدایش می‌زند.
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-gsc-token') || new URL(req.url).searchParams.get('token') || ''
  if (!verifyIngestToken(token)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'bad body' }, { status: 400 })
  // فقط بخش‌های موردِانتظار ذخیره می‌شوند.
  saveIngestData({
    performance: body.performance || null,
    sitemaps: Array.isArray(body.sitemaps) ? body.sitemaps : [],
    property: body.property || '',
    ranAt: body.ranAt || null,
  })
  return NextResponse.json({ ok: true })
}
