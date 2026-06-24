import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount } from '@/app/lib/account-store'
import { startConversation, replyTo, listForBuyer, listForOwner, getConv, markRead } from '@/app/lib/message-store'

// گفتگوی واقعیِ خریدار ↔ صاحبِ آگهی (بدون هوش مصنوعی).
// GET ?role=buyer|owner → گفتگوهای همان نقش برای کاربرِ واردشده.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const role = new URL(req.url).searchParams.get('role') === 'owner' ? 'owner' : 'buyer'
  const conversations = role === 'owner' ? listForOwner(s.phone) : listForBuyer(s.phone)
  return NextResponse.json({ conversations, role }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای ارسال پیام وارد شوید', needLogin: true }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const me = getAccount(s.phone)
  const myName = me?.name || 'کاربر'

  switch (b.action as string) {
    case 'start': {
      // خریدار از صفحهٔ آگهی پیام می‌دهد.
      const ownerPhone = String(b.ownerPhone || '').trim()
      if (!ownerPhone) return NextResponse.json({ error: 'این آگهی امکانِ گفتگوی مستقیم ندارد (صاحبِ آن کاربرِ ملک‌جت نیست).', noOwner: true }, { status: 400 })
      if (ownerPhone === s.phone) return NextResponse.json({ error: 'این آگهیِ خودِ شماست' }, { status: 400 })
      if (!b.text || !String(b.text).trim()) return NextResponse.json({ error: 'متن پیام الزامی است' }, { status: 400 })
      const conv = startConversation({
        listingId: String(b.listingId || ''), listingTitle: String(b.listingTitle || 'آگهی'),
        buyerPhone: s.phone, buyerName: myName,
        ownerPhone, ownerName: String(b.ownerName || 'صاحب آگهی'),
        text: String(b.text).trim(),
      })
      return NextResponse.json({ ok: true, conversation: conv })
    }
    case 'reply': {
      if (!b.convId || !String(b.text || '').trim()) return NextResponse.json({ error: 'شناسه و متن الزامی است' }, { status: 400 })
      const conv = replyTo(String(b.convId), s.phone, String(b.text).trim())
      if (!conv) return NextResponse.json({ error: 'گفتگو یافت نشد یا دسترسی ندارید' }, { status: 404 })
      return NextResponse.json({ ok: true, conversation: conv })
    }
    case 'read': {
      if (b.convId) markRead(String(b.convId), s.phone)
      return NextResponse.json({ ok: true })
    }
    case 'get': {
      const conv = b.convId ? getConv(String(b.convId)) : null
      if (!conv || (conv.buyerPhone !== s.phone && conv.ownerPhone !== s.phone)) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, conversation: conv })
    }
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
