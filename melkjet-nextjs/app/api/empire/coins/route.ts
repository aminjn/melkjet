// 🪙 فروشگاهِ ملک‌کوین (فاز ۲۸) — تنها نقطهٔ ورودِ پولِ واقعی به مسیرِ رشد.
// کوین فقط «سرعت/تحلیل/ظاهر» می‌خرد (قانون ۵) — هرگز قدرت، XP یا اعتبار (بدونِ P2W).
// POST { packId } → ساختِ پرداختِ زرین‌پال و redirect؛ GET = بازگشت از درگاه (verify + شارژِ ایدمپوتنت).
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getEmpire, creditCoinPurchase, activeCoinPacks } from '@/app/lib/empire-store'
import { requestPayment, verifyPayment, zarinpalConfigured } from '@/app/lib/zarinpal'
import { config, primeConfig } from '@/app/lib/reos/reos-config'
import { flagEnabled } from '@/app/lib/reos/flags'
import { logAudit } from '@/app/lib/audit-store'
import { recordRealRevenue } from '@/app/lib/empire-rewards'
import { enabledGateways } from '@/app/lib/payment-store'
import { createCoinOrder } from '@/app/lib/comm-store'

// فاز ۳۳ (بسته‌های زمان‌دار): شروعِ پرداخت فقط برای بستهٔ هنوز-معتبر؛ ولی callbackِ پرداختِ انجام‌شده
// با forVerify تاریخِ until را نادیده می‌گیرد — پولی که رفته باید کوینش برسد، حتی اگر بسته همان لحظه منقضی شد.
function activePack(packId: string, forVerify = false) {
  const shop = config().empire.coinShop
  if (!shop?.enabled) return null
  const pool = forVerify
    ? (shop.packs || []).filter(p => p.enabled && p.coins > 0 && p.priceToman > 0)
    : activeCoinPacks(shop.packs || [])
  return pool.find(p => p.id === packId) || null
}

export async function POST(req: NextRequest) {
  await primeConfig()
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'اول وارد شو' }, { status: 401 })
  if (!await flagEnabled('empire', { userId: s.phone, role: (s as any).role })) return NextResponse.json({ error: 'در دسترس نیست' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const pack = activePack(String(b.packId || ''))
  if (!pack) return NextResponse.json({ error: 'بسته یافت نشد یا غیرفعال است' }, { status: 404 })
  if (!(await getEmpire(s.phone))) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
  // فاز ۵۳ («فعلاً کل سایت با شماره کارت»): مسیرِ پیش‌فرض = کارت‌به‌کارت با کدِ رهگیری و تأییدِ مدیر؛
  // پس از تأیید، کوین خودکار شارژ و درآمدِ واقعی برای استخرِ جوایز ثبت می‌شود (approveOrder).
  const card = enabledGateways().find(g => g.type === 'card2card')
  const wantZarinpal = String(b.gateway || '') === 'zarinpal' && zarinpalConfigured()
  if (card && !wantZarinpal) {
    const receipt = String(b.receipt || '').trim().slice(0, 60)
    if (!receipt) {
      return NextResponse.json({
        ok: true, card2card: true, amount: pack.priceToman,
        card: { label: card.label, cardNumber: card.cardNumber || '', iban: card.iban || '', accountNumber: card.accountNumber || '', holderName: card.holderName || '', bank: card.bank || '', note: card.note || '' },
      })
    }
    const r = await createCoinOrder(s.phone, { id: pack.id, label: pack.label, coins: pack.coins, priceToman: pack.priceToman }, { gateway: 'card2card', receipt })
    if (!r.ok) return NextResponse.json({ error: 'ثبتِ سفارش ناموفق بود' }, { status: 400 })
    logAudit(s.phone, 'سفارشِ کارت‌به‌کارتِ ملک‌کوین', `${pack.label} · ${pack.coins} کوین · رهگیری ${receipt}`)
    return NextResponse.json({ ok: true, pending: true, orderId: r.order?.id, message: 'درخواستت ثبت شد — پس از تأییدِ واریزی، ملک‌کوین‌ها خودکار به کیفت اضافه می‌شوند.' })
  }
  if (!zarinpalConfigured()) return NextResponse.json({ error: 'روشِ پرداختی فعال نیست — در پنل، کارت‌به‌کارت یا زرین‌پال را فعال کنید.' }, { status: 200 })
  const origin = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`
  const r = await requestPayment(pack.priceToman, `شارژ ${pack.coins} ملک‌کوین — ${pack.label}`, `${origin}/api/empire/coins?pack=${encodeURIComponent(pack.id)}`, s.phone)
  if (!r.ok || !r.url) return NextResponse.json({ error: r.error || 'خطا در ایجاد پرداخت' }, { status: 200 })
  return NextResponse.json({ ok: true, redirect: r.url })
}

// بازگشت از زرین‌پال: ?Authority=…&Status=OK|NOK&pack=…
export async function GET(req: NextRequest) {
  await primeConfig()
  const url = new URL(req.url)
  const authority = url.searchParams.get('Authority') || ''
  const status = url.searchParams.get('Status') || ''
  const pack = activePack(url.searchParams.get('pack') || '', true)
  const origin = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`
  const fail = (reason: string) => NextResponse.redirect(`${origin}/empire?coins=fail&reason=${encodeURIComponent(reason)}`)

  if (status !== 'OK' || !authority) return fail('پرداخت لغو شد')
  const s = await getSession()
  if (!s) return NextResponse.redirect(`${origin}/auth?next=/empire`)
  if (!pack) return fail('بستهٔ نامعتبر')
  const v = await verifyPayment(authority, pack.priceToman)
  if (!v.ok) return fail(v.error || 'تأیید ناموفق')
  // شارژِ ایدمپوتنت (کلید = authority) — رفرشِ صفحهٔ بازگشت دوبار شارژ نمی‌کند.
  const r = await creditCoinPurchase(s.phone, { coins: pack.coins, label: pack.label, authority, refId: v.refId })
  if (r.ok) {
    logAudit(s.phone, 'خریدِ ملک‌کوین', `${pack.label} — ${pack.coins} کوین · ref ${v.refId || '-'}`)
    // فاز ۴۸: همین درآمدِ واقعیِ تأییدشده، خوراکِ استخرِ جوایزِ پولِ واقعی است (ایدمپوتنت با همان authority)
    recordRealRevenue(s.phone, pack.priceToman, authority).catch(() => {})
  }
  return NextResponse.redirect(`${origin}/empire?coins=ok&n=${pack.coins}`)
}
