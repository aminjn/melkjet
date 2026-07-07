import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listFlags, setFlag } from '@/app/lib/reos/flags'

function admin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/flags — فهرستِ فلگ‌ها (فقط سوپرادمین).
export async function GET() {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  return NextResponse.json({ ok: true, flags: await listFlags() }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/flags — {key, patch:{enabled?,rolloutPct?,cities?,plans?,roles?}}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const b = await req.json().catch(() => ({})) as { key?: string; patch?: Record<string, unknown> }
  if (!b.key) return NextResponse.json({ error: 'key لازم است' }, { status: 400 })
  return NextResponse.json({ ok: true, flag: await setFlag(b.key, (b.patch || {}) as never) })
}
