import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getConfig, setConfig, resetConfig, DEFAULT_CONFIG } from '@/app/lib/reos/reos-config'

function admin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/config — تنظیماتِ فعلی + پیش‌فرض‌ها (فقط سوپرادمین).
export async function GET() {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  return NextResponse.json({ ok: true, config: await getConfig(), defaults: DEFAULT_CONFIG }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/config — {patch:{...}} یا {reset:true}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  if (b.reset) return NextResponse.json({ ok: true, config: await resetConfig() })
  return NextResponse.json({ ok: true, config: await setConfig((b.patch as Record<string, unknown>) || {}) })
}
