import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount, listAccounts } from '@/app/lib/account-store'
import { getItemById } from '@/app/lib/scraper-store'
import { startConversation, replyTo, listForBuyer, listForOwner, getConv, markRead } from '@/app/lib/message-store'
import { createAutoLead } from '@/app/lib/auto-lead'

// صاحبِ آگهی را از روی خودِ آگهی پیدا می‌کند: اول __ownerPhone (هنگام انتشار مهر می‌خورد)،
// سپس تطبیقِ نامِ آگهی‌دهنده با یک حسابِ واقعیِ ملک‌جت (مشاور/آژانس). هر آگهی صاحب دارد.
function norm(s: string) { return (s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() }
function resolveOwner(listingId: string, hintName: string, hintPhone: string): { phone: string; name: string } {
  const it = listingId ? getItemById(listingId) : null
  let phone = String(it?.meta?.__ownerPhone || hintPhone || '').trim()
  const name = (it?.owner || hintName || 'صاحب آگهی').trim()
  if (!phone && name) {
    const acc = listAccounts().find(a => a.name && norm(a.name) === norm(name))
    if (acc) phone = acc.phone
  }
  return { phone, name }
}

// گفتگوی واقعیِ خریدار ↔ صاحبِ آگهی (بدون هوش مصنوعی).
// GET ?role=buyer|owner → گفتگوهای همان نقش برای کاربرِ واردشده.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const role = new URL(req.url).searchParams.get('role') === 'owner' ? 'owner' : 'buyer'
  const conversations = role === 'owner' ? await listForOwner(s.phone) : await listForBuyer(s.phone)
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
      // خریدار از صفحهٔ آگهی پیام می‌دهد؛ صاحب از روی خودِ آگهی پیدا می‌شود.
      if (!b.text || !String(b.text).trim()) return NextResponse.json({ error: 'متن پیام الزامی است' }, { status: 400 })
      const owner = resolveOwner(String(b.listingId || ''), String(b.ownerName || ''), String(b.ownerPhone || ''))
      if (!owner.phone) return NextResponse.json({ error: 'صاحبِ این آگهی پیدا نشد.', noOwner: true }, { status: 400 })
      if (owner.phone === s.phone) return NextResponse.json({ error: 'این آگهیِ خودِ شماست' }, { status: 400 })
      const conv = await startConversation({
        listingId: String(b.listingId || ''), listingTitle: String(b.listingTitle || 'آگهی'),
        buyerPhone: s.phone, buyerName: myName,
        ownerPhone: owner.phone, ownerName: owner.name,
        text: String(b.text).trim(),
      })
      // فقط برای گفتگوی تازه‌ساخته‌شده (اولین پیام) یک لیدِ خودکار در CRMِ صاحبِ آگهی بساز —
      // مطابقِ نقشِ او (مشاور→/pros، آژانس→/agency، بقیه→CRMِ عمومی)، گره‌خورده به همان آگهی.
      if (conv.messages.length === 1) {
        createAutoLead(owner.phone, {
          name: myName, phone: s.phone,
          need: conv.listingTitle, listingTitle: conv.listingTitle,
          note: `پیام دربارهٔ «${conv.listingTitle}»: ${String(b.text).trim()}`,
          source: 'پیامِ آگهی',
        })
      }
      return NextResponse.json({ ok: true, conversation: conv })
    }
    case 'reply': {
      if (!b.convId || !String(b.text || '').trim()) return NextResponse.json({ error: 'شناسه و متن الزامی است' }, { status: 400 })
      const conv = await replyTo(String(b.convId), s.phone, String(b.text).trim())
      if (!conv) return NextResponse.json({ error: 'گفتگو یافت نشد یا دسترسی ندارید' }, { status: 404 })
      return NextResponse.json({ ok: true, conversation: conv })
    }
    case 'read': {
      if (b.convId) await markRead(String(b.convId), s.phone)
      return NextResponse.json({ ok: true })
    }
    case 'get': {
      const conv = b.convId ? await getConv(String(b.convId)) : null
      if (!conv || (conv.buyerPhone !== s.phone && conv.ownerPhone !== s.phone)) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, conversation: conv })
    }
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
