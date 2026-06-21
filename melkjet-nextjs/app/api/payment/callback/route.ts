import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listPlans } from '@/app/lib/plan-store'
import { setPlan } from '@/app/lib/account-store'
import { verifyPayment } from '@/app/lib/zarinpal'

// بازگشت از زرین‌پال: ?Authority=...&Status=OK|NOK  + plan,cycle که خودمان گذاشتیم.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const authority = url.searchParams.get('Authority') || ''
  const status = url.searchParams.get('Status') || ''
  const planId = url.searchParams.get('plan') || ''
  const annual = url.searchParams.get('cycle') === 'y'
  const origin = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`

  const fail = (reason: string) => NextResponse.redirect(`${origin}/pricing?pay=failed&reason=${encodeURIComponent(reason)}`)

  if (status !== 'OK' || !authority) return fail('پرداخت لغو شد')
  const s = await getSession()
  if (!s) return NextResponse.redirect(`${origin}/auth?next=/pricing`)
  const plan = listPlans().find(p => p.id === planId)
  if (!plan) return fail('پلن نامعتبر')

  const amount = annual ? plan.priceYearly : plan.priceMonthly
  const v = await verifyPayment(authority, amount)
  if (!v.ok) return fail(v.error || 'تأیید ناموفق')

  setPlan(s.phone, plan.id)
  return NextResponse.redirect(`${origin}/pricing?pay=success&plan=${encodeURIComponent(plan.name)}&ref=${encodeURIComponent(v.refId || '')}`)
}
