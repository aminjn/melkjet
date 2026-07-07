import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { referralStats, recordInvite, recordConversion } from '@/app/lib/reos/growth'

// GET /api/reos/growth — کدِ دعوت + آمارِ کاربر.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  return NextResponse.json({ ok: true, referral: await referralStats(s.phone) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/growth — {action: invite|convert, code}. invite عمومی (هنگامِ ثبت‌نام)؛ convert فقط مدیر/سیستم.
export async function POST(req: NextRequest) {
  const s = await getSession()
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const a = String(b.action || ''), code = String(b.code || '')
  if (!code) return NextResponse.json({ error: 'code لازم است' }, { status: 400 })
  if (a === 'invite') return NextResponse.json({ ok: true, referral: await recordInvite(code) })
  const admin = !!s && (s.role === 'super_admin' || s.phone === '09122862184')
  if (a === 'convert') { if (!admin) return NextResponse.json({ error: 'مدیر' }, { status: 403 }); return NextResponse.json({ ok: true, referral: await recordConversion(code, Number(b.reward) || 100000) }) }
  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}
