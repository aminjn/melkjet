import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { allChannels, channelReport, recordTouch, recordSpend, recordConversion } from '@/app/lib/reos/attribution'

function admin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/attribution[?channel=] — CAC/LTV/ROAS به‌تفکیکِ کانال (مدیر).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const channel = new URL(req.url).searchParams.get('channel')
  if (channel) return NextResponse.json({ ok: true, report: await channelReport(channel) }, { headers: { 'Cache-Control': 'no-store, private' } })
  return NextResponse.json({ ok: true, channels: await allChannels(50) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/attribution — {action: touch|spend|convert}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const a = String(b.action || ''), channel = String(b.channel || '')
  if (a === 'touch') { await recordTouch(channel); return NextResponse.json({ ok: true }) }
  if (!admin(s)) return NextResponse.json({ error: 'مدیر' }, { status: 403 })
  if (a === 'spend') { await recordSpend(channel, Number(b.amount) || 0); return NextResponse.json({ ok: true }) }
  if (a === 'convert') { await recordConversion(channel, Number(b.revenue) || 0); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}
