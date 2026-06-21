import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listPlans } from '@/app/lib/plan-store'
import { setPlan } from '@/app/lib/account-store'
import { requestPayment, zarinpalConfigured } from '@/app/lib/zarinpal'

// شروع پرداختِ خرید پلن. body: { planId, annual? }
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای خرید ابتدا وارد شوید', needLogin: true }, { status: 401 })

  const b = await req.json().catch(() => ({} as any))
  const planId = String(b.planId || '')
  const annual = !!b.annual
  const plan = listPlans().find(p => p.id === planId)
  if (!plan) return NextResponse.json({ error: 'پلن یافت نشد' }, { status: 404 })

  const amount = annual ? plan.priceYearly : plan.priceMonthly
  // پلن رایگان → بدون پرداخت فعال می‌شود
  if (!amount || amount <= 0) {
    setPlan(s.phone, plan.id)
    return NextResponse.json({ ok: true, free: true })
  }
  if (!zarinpalConfigured()) {
    return NextResponse.json({ error: 'درگاه پرداخت هنوز فعال نشده است (پنل → اتصال‌ها → زرین‌پال).' }, { status: 200 })
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host')
  const callbackUrl = `${proto}://${host}/api/payment/callback?plan=${encodeURIComponent(plan.id)}&cycle=${annual ? 'y' : 'm'}`
  const r = await requestPayment(amount, `خرید پلن ${plan.name}`, callbackUrl, s.phone)
  if (!r.ok || !r.url) return NextResponse.json({ error: r.error || 'خطا در ایجاد پرداخت' }, { status: 200 })
  return NextResponse.json({ ok: true, redirect: r.url })
}
