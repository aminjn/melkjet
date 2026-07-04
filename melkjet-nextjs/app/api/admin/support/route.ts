import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAll, getTicket, adminReply, setStatus, markReadByAdmin, adminUnreadCount, type TicketStatus } from '@/app/lib/ticket-store'

export const dynamic = 'force-dynamic'
async function guard() { const s = await getSession(); return !!(s && s.role === 'super_admin') }

// همهٔ تیکت‌ها برای سوپرادمین + شمارشِ خوانده‌نشده (نوتیف).
export async function GET(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'دسترسی ندارید' }, { status: 403 })
  const u = new URL(req.url).searchParams
  if (u.get('count') === '1') return NextResponse.json({ ok: true, unread: await adminUnreadCount() })
  const tid = u.get('id')
  if (tid) { const t = await getTicket(tid); if (!t) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 }); await markReadByAdmin(tid); return NextResponse.json({ ok: true, ticket: t }) }
  return NextResponse.json({ ok: true, tickets: await listAll(), unread: await adminUnreadCount() })
}

export async function POST(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'دسترسی ندارید' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (b.action === 'reply') {
    const t = await adminReply(String(b.id), String(b.text || ''))
    if (!t) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    return NextResponse.json({ ok: true, ticket: t })
  }
  if (b.action === 'status') {
    const t = await setStatus(String(b.id), b.status as TicketStatus)
    if (!t) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    return NextResponse.json({ ok: true, ticket: t })
  }
  return NextResponse.json({ error: 'اقدام نامعتبر' }, { status: 400 })
}
