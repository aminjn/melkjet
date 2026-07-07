import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAccounts, setSuspended, setFlagged } from '@/app/lib/account-store'

function admin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/suspension — حساب‌های پرچم‌خورده/معلق برای بازبینیِ سوپرادمین.
export async function GET() {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const rows = listAccounts()
    .filter(a => a.flagged || a.suspended)
    .map(a => ({ phone: a.phone, name: a.name || a.fullName || '', role: a.role || '', flagged: !!a.flagged, flagReason: a.flagReason || '', suspended: !!a.suspended, suspendReason: a.suspendReason || '', at: a.suspendedAt || a.flaggedAt || 0 }))
    .sort((a, b) => b.at - a.at)
  return NextResponse.json({ ok: true, rows }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST — {action:'suspend'|'unsuspend'|'clearFlag', phone, reason?}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const b = await req.json().catch(() => ({})) as { action?: string; phone?: string; reason?: string }
  const phone = String(b.phone || '').trim()
  if (!phone) return NextResponse.json({ error: 'phone لازم است' }, { status: 400 })
  if (b.action === 'suspend') { setSuspended(phone, true, b.reason || 'تعلیق توسط سوپرادمین'); return NextResponse.json({ ok: true }) }
  if (b.action === 'unsuspend') { setSuspended(phone, false); return NextResponse.json({ ok: true }) }
  if (b.action === 'clearFlag') { setFlagged(phone, false); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'action نامعتبر' }, { status: 400 })
}
