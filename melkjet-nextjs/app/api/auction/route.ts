import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { auctionConfig, auctionAreaStatus, myAuctionBids, placeBid, cancelBid } from '@/app/lib/auction-store'
import { getItemById } from '@/app/lib/scraper-store'

// GET            → پیکربندیِ مزایده + پیشنهادهای فعالِ کاربر
// GET ?area=X    → وضعیتِ مزایدهٔ آن محله برای کاربر
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const area = (new URL(req.url).searchParams.get('area') || '').trim()
  if (area) return NextResponse.json({ status: await auctionAreaStatus(area, s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
  const cfg = auctionConfig()
  return NextResponse.json({ config: { enabled: cfg.enabled, minBid: cfg.minBid, step: cfg.step, periodDays: cfg.periodDays, label: cfg.label }, myBids: await myAuctionBids(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST → ثبت/لغوِ پیشنهاد در یک محله. فقط برای آگهیِ منتشرشدهٔ خودِ کاربر.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const act = String(b.action || '')
  const area = String(b.area || '').trim()
  if (!area) return NextResponse.json({ error: 'محله را انتخاب کنید' }, { status: 400 })

  if (act === 'cancelBid') { await cancelBid(area, s.phone); return NextResponse.json({ ok: true }) }

  if (act === 'placeBid') {
    const targetId = String(b.targetId || '')
    const amount = Math.round(Number(b.amount) || 0)
    if (!targetId) return NextResponse.json({ error: 'آگهیِ موردِ نظر را انتخاب کنید' }, { status: 400 })
    const it = await getItemById(targetId)
    if (!it) return NextResponse.json({ error: 'آگهیِ منتشرشده‌ای با این شناسه یافت نشد' }, { status: 400 })
    if (String((it as any).meta?.__ownerPhone || '') !== s.phone) return NextResponse.json({ error: 'فقط برای آگهی‌های خودتان می‌توانید پیشنهاد دهید' }, { status: 403 })
    const r = await placeBid(area, s.phone, targetId, it.title, amount)
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 })
  }

  return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
}
