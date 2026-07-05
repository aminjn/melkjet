import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { auctionSlotsForRole, auctionStatus, placeBid, cancelBid, auctionSlotOf } from '@/app/lib/auction-store'
import { getAccount, dashForRole } from '@/app/lib/account-store'
import { getItemById } from '@/app/lib/scraper-store'
import { ensurePromoPricing } from '@/app/lib/promo-pricing-store'

const dashFor = (phone: string, role?: string) => role === 'super_admin' ? '/pros' : dashForRole(getAccount(phone)?.role)

// GET → جایگاه‌های مزایده‌ایِ نقشِ کاربر + وضعیتِ هرکدام (با تسویهٔ تنبلِ دورهای تمام‌شده).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  await ensurePromoPricing()
  const dash = dashFor(s.phone, s.role)
  const slots = auctionSlotsForRole(dash)
  const statuses = (await Promise.all(slots.map(sl => auctionStatus(sl.id, s.phone)))).filter(Boolean)
  return NextResponse.json({ auctions: statuses }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST → ثبت/لغوِ پیشنهاد. پیشنهاد فقط برای آگهیِ منتشرشدهٔ خودِ کاربر.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const act = String(b.action || '')
  const slot = String(b.slot || '')
  if (!auctionSlotOf(slot)) return NextResponse.json({ error: 'جایگاهِ مزایده یافت نشد' }, { status: 400 })

  if (act === 'cancelBid') { await cancelBid(slot, s.phone); return NextResponse.json({ ok: true }) }

  if (act === 'placeBid') {
    const targetId = String(b.targetId || '')
    const amount = Math.round(Number(b.amount) || 0)
    if (!targetId) return NextResponse.json({ error: 'آگهیِ موردِ نظر را انتخاب کنید' }, { status: 400 })
    // آگهی باید منتشرشده و متعلق به خودِ کاربر باشد.
    const it = await getItemById(targetId)
    if (!it) return NextResponse.json({ error: 'آگهیِ منتشرشده‌ای با این شناسه یافت نشد' }, { status: 400 })
    if (String((it as any).meta?.__ownerPhone || '') !== s.phone) return NextResponse.json({ error: 'فقط برای آگهی‌های خودتان می‌توانید پیشنهاد دهید' }, { status: 403 })
    const r = await placeBid(slot, s.phone, targetId, it.title, amount)
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 })
  }

  return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
}
