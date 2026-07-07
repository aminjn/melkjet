import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { subgraph, shortestPath, graphStats, syncGraphFromEvents } from '@/app/lib/reos/graph'

function isAdmin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/graph            → آمارِ گراف
// GET /api/reos/graph?node=ID&depth=2   → زیرگراف (نمایش)
// GET /api/reos/graph?from=A&to=B       → کوتاه‌ترین مسیر (چطور A به B وصل است)
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!isAdmin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const node = sp.get('node'), from = sp.get('from'), to = sp.get('to')
  if (from && to) return NextResponse.json({ ok: true, path: await shortestPath(from, to, Math.min(Number(sp.get('maxDepth')) || 5, 8)) }, { headers: { 'Cache-Control': 'no-store, private' } })
  if (node) return NextResponse.json({ ok: true, ...(await subgraph(node, Math.min(Number(sp.get('depth')) || 2, 4))) }, { headers: { 'Cache-Control': 'no-store, private' } })
  return NextResponse.json({ ok: true, stats: await graphStats() }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/graph — همگام‌سازیِ گراف از رویدادها (مدیر).
export async function POST() {
  const s = await getSession()
  if (!isAdmin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const r = await syncGraphFromEvents(5000)
  return NextResponse.json({ ok: true, synced: r, stats: await graphStats() })
}
