import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { heatmap } from '@/app/lib/reos/geo-intel'

// GET /api/reos/geo-heatmap?precision=2 — نقشهٔ حرارتیِ عرضه/قیمت به‌ازای سلولِ جغرافیایی.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const precision = Math.min(Math.max(Number(new URL(req.url).searchParams.get('precision')) || 2, 1), 3)
  return NextResponse.json({ ok: true, cells: await heatmap(1500, precision) }, { headers: { 'Cache-Control': 'no-store, private' } })
}
