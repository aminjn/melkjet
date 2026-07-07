import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { send, commsLog, channels, type Channel } from '@/app/lib/reos/comms-hub'

// GET /api/reos/comms — کانال‌ها + لاگِ پیام‌های کاربر.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  return NextResponse.json({ ok: true, channels: channels(), log: await commsLog(s.phone, 50) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/comms — {channel, to, message, subject?}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const channel = String(b.channel || 'sms') as Channel
  const to = String(b.to || ''), message = String(b.message || '')
  if (!to || !message) return NextResponse.json({ error: 'گیرنده و متن لازم است' }, { status: 400 })
  return NextResponse.json({ ok: true, message: await send({ channel, to, message, subject: b.subject ? String(b.subject) : undefined, ownerId: s.phone }) })
}
