import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getTrust, setVerification, setSignals, type Verification, type TrustSignals } from '@/app/lib/reos/trust'

function admin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/trust[?entityId=] — امتیازِ اعتماد. بدونِ entityId = کاربرِ فعلی (موبایلش با OTP تأییدشده).
export async function GET(req: NextRequest) {
  const s = await getSession()
  const entityId = new URL(req.url).searchParams.get('entityId')
  if (entityId) return NextResponse.json({ ok: true, trust: await getTrust(entityId) }, { headers: { 'Cache-Control': 'no-store' } })
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  // موبایلِ کاربرِ لاگین‌شده با OTP تأییدشده است → نشانِ phone به‌صورتِ ضمنی.
  return NextResponse.json({ ok: true, trust: await getTrust(s.phone, ['phone']) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/trust — {action: verify|signals} (فقط مدیر).
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const a = String(b.action || ''), entityId = String(b.entityId || '')
  if (!entityId) return NextResponse.json({ error: 'entityId لازم است' }, { status: 400 })
  if (a === 'verify') { await setVerification(entityId, String(b.verification || 'identity') as Verification, b.on !== false); return NextResponse.json({ ok: true, trust: await getTrust(entityId) }) }
  if (a === 'signals') { await setSignals(entityId, (b.signals as TrustSignals) || {}); return NextResponse.json({ ok: true, trust: await getTrust(entityId) }) }
  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}
