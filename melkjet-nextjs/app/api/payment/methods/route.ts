import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { enabledGateways, getPaymentConfig } from '@/app/lib/payment-store'

// روش‌های پرداختِ فعال برای checkout (کاربرِ واردشده). اطلاعاتِ کارت‌به‌کارت برای واریز نشان داده می‌شود.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای پرداخت وارد شوید' }, { status: 401 })
  return NextResponse.json({ ok: true, gateways: enabledGateways(), pricingMode: getPaymentConfig().pricingMode }, { headers: { 'Cache-Control': 'no-store' } })
}
