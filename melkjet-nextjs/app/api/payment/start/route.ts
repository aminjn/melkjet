import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listPlans } from '@/app/lib/plan-store'
import { setPlan } from '@/app/lib/account-store'
import { requestPayment, zarinpalConfigured } from '@/app/lib/zarinpal'
import { enabledGateways } from '@/app/lib/payment-store'
import { createPlanOrder } from '@/app/lib/comm-store'

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
  // فاز ۵۳ («فعلاً کل سایت با شماره کارت»): اگر درگاهِ کارت‌به‌کارت فعال است، مسیرِ پیش‌فرضِ خرید همین است —
  // مرحلهٔ ۱ (بدونِ receipt): اطلاعاتِ کارت برمی‌گردد؛ مرحلهٔ ۲ (با receipt): سفارشِ «در انتظارِ تأیید» ثبت می‌شود
  // و پس از تأییدِ مدیر، پلن با مدتِ اعتبار خودکار فعال می‌شود (approveOrder).
  const card = enabledGateways().find(g => g.type === 'card2card')
  const wantZarinpal = String(b.gateway || '') === 'zarinpal' && zarinpalConfigured()
  if (card && !wantZarinpal) {
    const receipt = String(b.receipt || '').trim().slice(0, 60)
    if (!receipt) {
      return NextResponse.json({
        ok: true, card2card: true, amount,
        card: { label: card.label, cardNumber: card.cardNumber || '', iban: card.iban || '', accountNumber: card.accountNumber || '', holderName: card.holderName || '', bank: card.bank || '', note: card.note || '' },
      })
    }
    const period = annual ? 'yearly' : 'monthly'
    const r = await createPlanOrder(s.phone, plan.id, plan.name, amount, { gateway: 'card2card', receipt, period })
    if (!r.ok) return NextResponse.json({ error: 'ثبتِ سفارش ناموفق بود' }, { status: 400 })
    return NextResponse.json({ ok: true, pending: true, orderId: r.order?.id, message: 'درخواستِ خریدت ثبت شد — پس از تأییدِ واریزی توسطِ ملک‌جت، پلن خودکار فعال می‌شود.' })
  }
  if (!zarinpalConfigured()) {
    return NextResponse.json({ error: 'روشِ پرداختی فعال نیست — در پنل، درگاهِ کارت‌به‌کارت یا زرین‌پال را فعال کنید.' }, { status: 200 })
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host')
  const callbackUrl = `${proto}://${host}/api/payment/callback?plan=${encodeURIComponent(plan.id)}&cycle=${annual ? 'y' : 'm'}`
  const r = await requestPayment(amount, `خرید پلن ${plan.name}`, callbackUrl, s.phone)
  if (!r.ok || !r.url) return NextResponse.json({ error: r.error || 'خطا در ایجاد پرداخت' }, { status: 200 })
  return NextResponse.json({ ok: true, redirect: r.url })
}
