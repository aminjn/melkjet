import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount } from '@/app/lib/account-store'
import { createTicket, listByOwner, getTicket, userReply, markReadByUser, userUnreadCount } from '@/app/lib/ticket-store'

export const dynamic = 'force-dynamic'

// تیکت‌های کاربرِ واردشده.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ ok: false, login: true, tickets: [], unread: 0 }, { status: 401 })
  const tid = new URL(req.url).searchParams.get('id')
  if (tid) {
    const t = await getTicket(tid)
    if (!t || t.owner !== s.phone) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    await markReadByUser(tid, s.phone)
    return NextResponse.json({ ok: true, ticket: t })
  }
  return NextResponse.json({ ok: true, tickets: await listByOwner(s.phone), unread: await userUnreadCount(s.phone) })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای پشتیبانی باید وارد شوید', login: true }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (b.action === 'reply') {
    const t = await userReply(String(b.id), s.phone, String(b.text || ''))
    if (!t) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    return NextResponse.json({ ok: true, ticket: t })
  }
  const subject = String(b.subject || '').trim()
  const text = String(b.text || '').trim()
  if (!subject || !text) return NextResponse.json({ error: 'موضوع و توضیحات الزامی است' }, { status: 400 })
  const t = await createTicket(s.phone, { subject, category: b.category, text, name: getAccount(s.phone)?.name, phone: s.phone, panel: b.panel })
  return NextResponse.json({ ok: true, ticket: t })
}
