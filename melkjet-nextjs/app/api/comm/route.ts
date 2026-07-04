import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listPackages, setPackages, getCredit, grantCredit, createOrder, createPlanOrder, listOrders, approveOrder, rejectOrder, getTokenUsage } from '@/app/lib/comm-store'
import { listActive } from '@/app/lib/plan-store'

// ارتباطات: پکیج‌های شارژ + اعتبارِ کاربر + سفارش‌ها.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  // نمای سوپرادمین: همهٔ پکیج‌ها + همهٔ سفارش‌ها
  if (sp.get('admin') === '1') {
    if (s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    return NextResponse.json({ packages: await listPackages(false), orders: await listOrders() }, { headers: { 'Cache-Control': 'no-store' } })
  }
  // نمای کاربر: پکیج‌های فعال + اعتبارِ خودش + سفارش‌های خودش
  return NextResponse.json({ packages: await listPackages(true), credit: await getCredit(s.phone), orders: await listOrders(s.phone), tokenUsed: await getTokenUsage(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const act = String(b.action || '')
  const isAdmin = s.role === 'super_admin'

  // عملیاتِ کاربری
  if (act === 'order') {
    if (!b.packageId) return NextResponse.json({ error: 'پکیج را انتخاب کنید' }, { status: 400 })
    const r = await createOrder(s.phone, String(b.packageId), { gateway: b.gateway ? String(b.gateway) : undefined, receipt: b.receipt ? String(b.receipt).slice(0, 120) : undefined })
    return r.ok ? NextResponse.json({ ok: true, order: r.order }) : NextResponse.json({ error: r.error }, { status: 400 })
  }
  if (act === 'orderPlan') {
    const pl = listActive().find(p => p.id === String(b.planId || ''))
    if (!pl) return NextResponse.json({ error: 'پلن یافت نشد' }, { status: 400 })
    const period = ['monthly', '3m', '6m', 'yearly'].includes(String(b.period)) ? String(b.period) : 'monthly'
    const priceMap: Record<string, number> = { monthly: pl.priceMonthly, '3m': (pl as any).price3m || pl.priceMonthly * 3, '6m': (pl as any).price6m || pl.priceMonthly * 6, yearly: pl.priceYearly }
    const labelMap: Record<string, string> = { monthly: '', '3m': ' (۳ماهه)', '6m': ' (۶ماهه)', yearly: ' (سالانه)' }
    const r = await createPlanOrder(s.phone, pl.id, `${pl.name}${labelMap[period]}`, priceMap[period], { gateway: b.gateway ? String(b.gateway) : undefined, receipt: b.receipt ? String(b.receipt).slice(0, 120) : undefined, period })
    return NextResponse.json({ ok: true, order: r.order })
  }

  // عملیاتِ سوپرادمین
  if (!isAdmin) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  switch (act) {
    case 'savePackages': return NextResponse.json({ ok: true, packages: await setPackages(Array.isArray(b.packages) ? b.packages : []) })
    case 'approveOrder': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const r = await approveOrder(String(b.id)); return r.ok ? NextResponse.json({ ok: true, orders: await listOrders() }) : NextResponse.json({ error: r.error }, { status: 400 }) }
    case 'rejectOrder': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await rejectOrder(String(b.id)); return NextResponse.json({ ok: true, orders: await listOrders() })
    case 'grantCredit': { if (!b.owner || !b.channel) return NextResponse.json({ error: 'گیرنده و کانال الزامی است' }, { status: 400 }); const c = await grantCredit(String(b.owner), b.channel === 'email' ? 'email' : 'sms', Number(b.amount) || 0); return NextResponse.json({ ok: true, credit: c }) }
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
