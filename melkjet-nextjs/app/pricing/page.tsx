'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

// Shape returned by GET /api/plans (active plans, sorted by order).
interface ApiPlan {
  id: string
  name: string
  priceMonthly: number
  priceYearly: number
  currency?: string
  features: string[]
  highlighted: boolean
  cta?: string
  order: number
  active: boolean
}

// Card shape consumed by the plans grid below.
interface CardPlan {
  id: string
  name: string
  price: { monthly: number | string; annual: number | string }
  unit: string
  desc: string
  badge: string | null
  goldBorder: boolean
  cta: string
  ctaStyle: 'gold' | 'outline'
  features: string[]
}

// Persian-digit + تومان price formatter for live plans.
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
function toFaDigits(s: string): string {
  return s.replace(/\d/g, d => FA_DIGITS[Number(d)])
}
function formatToman(amount: number): string {
  if (!amount) return 'رایگان'
  return `${toFaDigits(amount.toLocaleString('en-US'))} تومان`
}

// Map an API plan to the existing card design.
function apiPlanToCard(p: ApiPlan): CardPlan {
  return {
    id: p.id,
    name: p.name,
    price: {
      monthly: formatToman(p.priceMonthly),
      annual: formatToman(p.priceYearly),
    },
    unit: p.priceMonthly ? '/ماه' : '',
    desc: '',
    badge: p.highlighted ? 'محبوب' : null,
    goldBorder: false,
    cta: p.cta || 'شروع',
    ctaStyle: p.highlighted ? 'gold' : 'outline',
    features: p.features,
  }
}

const plans: CardPlan[] = [
  {
    id: 'free',
    name: 'رایگان',
    price: { monthly: 0, annual: 0 },
    unit: '',
    desc: 'برای خریداران و مستأجران',
    badge: null,
    goldBorder: false,
    cta: 'شروع رایگان',
    ctaStyle: 'outline',
    features: [
      'جستجوی پیشرفته ملک',
      'مشاهده ۱۰ آگهی در روز',
      'فیلترهای پایه',
      'ذخیره ۵ ملک موردعلاقه',
      'اعلان‌های ایمیلی پایه',
    ],
  },
  {
    id: 'advisor-basic',
    name: 'مشاور پایه',
    price: { monthly: '۲۹۰', annual: '۲۳۲' },
    unit: 'هزار/ماه',
    desc: 'برای مشاوران تازه‌کار',
    badge: 'محبوب',
    goldBorder: false,
    cta: 'شروع آزمایشی',
    ctaStyle: 'gold',
    features: [
      'همه امکانات رایگان',
      'آگهی نامحدود',
      'پنل مدیریت آگهی',
      'آمار بازدید هر آگهی',
      'تماس مستقیم با خریدار',
      'پروفایل مشاور حرفه‌ای',
      'تأییدیه هویت و مجوز',
      'پشتیبانی ایمیلی',
      'اپلیکیشن موبایل',
      'ذخیره جستجو و هشدار',
    ],
  },
  {
    id: 'advisor-pro',
    name: 'مشاور حرفه‌ای',
    price: { monthly: '۵۹۰', annual: '۴۷۲' },
    unit: 'هزار/ماه',
    desc: 'برای مشاوران با تجربه',
    badge: null,
    goldBorder: false,
    cta: 'شروع آزمایشی',
    ctaStyle: 'outline',
    features: [
      'همه امکانات پایه',
      'آگهی ویژه در نتایج',
      'تحلیل قیمت هوشمند AI',
      'نقشه حرارتی بازار',
      'گزارش ماهانه عملکرد',
      'CRM پیشرفته مشتریان',
      'امضای دیجیتال قراردادها',
      'پشتیبانی تلفنی اولویت‌دار',
      'آموزش و وبینار اختصاصی',
      'قرارداد اجاره آنلاین',
      'قرارداد خرید آنلاین',
      'تقویم جلسات هوشمند',
      'تخمین زمان فروش',
      'مقایسه ملک رقبا',
      'API پایه',
    ],
  },
  {
    id: 'agency',
    name: 'آژانس',
    price: { monthly: '۱٫۴۹ م', annual: '۱٫۱۹ م' },
    unit: '/ماه',
    desc: 'برای آژانس‌های املاک',
    badge: null,
    goldBorder: true,
    cta: 'تماس با فروش',
    ctaStyle: 'gold',
    features: [
      'همه امکانات حرفه‌ای',
      'تا ۱۵ حساب مشاور',
      'پنل مدیریت آژانس',
      'برند و لوگوی اختصاصی',
      'صفحه آژانس در دایرکتوری',
      'گزارش تیمی پیشرفته',
      'تخصیص آگهی بین مشاوران',
      'آمار مقایسه‌ای تیم',
      'API کامل',
      'SSO سازمانی',
      'پشتیبانی ۲۴/۷ اختصاصی',
      'مدیر حساب اختصاصی',
      'آموزش تیمی حضوری',
      'سفارشی‌سازی گزارشات',
      'اتوماسیون بازاریابی',
      'ابزار تولید محتوای AI',
      'پیامک هوشمند',
      'مدیریت لید',
      'فانل فروش دیجیتال',
      'پیگیری معاملات',
    ],
  },
  {
    id: 'builder',
    name: 'سازنده',
    price: { monthly: '۱٫۹۹ م', annual: '۱٫۵۹ م' },
    unit: '/ماه',
    desc: 'برای سازندگان و توسعه‌دهندگان',
    badge: null,
    goldBorder: false,
    cta: 'تماس با فروش',
    ctaStyle: 'outline',
    features: [
      'همه امکانات آژانس',
      'صفحه پروژه اختصاصی',
      'ابزار پیش‌فروش آنلاین',
      'مشاور مجازی AI پروژه',
      'بازاریابی هدفمند پروژه',
      'گزارش بازار هدف',
      'مدیریت رزرو واحد',
      'قرارداد پیش‌فروش دیجیتال',
      'پورتال خریداران پروژه',
      'مجوز و اسناد دیجیتال',
      'نقشه و تور مجازی',
      'رندر سه‌بعدی یکپارچه',
      'API پیشرفته',
      'Webhook سفارشی',
      'پشتیبانی فنی اختصاصی',
    ],
  },
  {
    id: 'enterprise',
    name: 'سازمانی',
    price: { monthly: 'تماس', annual: 'تماس' },
    unit: '',
    desc: 'برای هلدینگ‌ها و سازمان‌های بزرگ',
    badge: null,
    goldBorder: false,
    cta: 'درخواست دمو',
    ctaStyle: 'outline',
    features: [
      'همه امکانات سازنده',
      'کاربران نامحدود',
      'استقرار ابری اختصاصی',
      'SLA تضمین‌شده ۹۹٫۹٪',
      'یکپارچه‌سازی ERP',
      'یکپارچه‌سازی CRM سازمانی',
      'حسابداری مالی یکپارچه',
      'امنیت سطح بانکی',
      'ممیزی و لاگ کامل',
      'قرارداد SLA اختصاصی',
      'نماینده پشتیبانی ۲۴/۷',
      'آموزش سازمانی',
      'سفارشی‌سازی کامل UI',
      'محیط آزمایش (Sandbox)',
      'مهاجرت داده رایگان',
      'گزارش‌های BI',
      'داشبورد تحلیلی سازمانی',
      'احراز هویت چندمرحله‌ای',
      'مدیریت دسترسی نقش‌محور',
      'هر ویژگی سفارشی که نیاز دارید',
    ],
  },
]

const compareFeatures = [
  { label: 'جستجوی ملک پیشرفته', keys: ['free', 'advisor-basic', 'advisor-pro', 'agency', 'builder', 'enterprise'] },
  { label: 'تعداد آگهی فعال', values: ['—', 'نامحدود', 'نامحدود', 'نامحدود', 'نامحدود', 'نامحدود'] },
  { label: 'پنل مدیریت آگهی', keys: ['', 'advisor-basic', 'advisor-pro', 'agency', 'builder', 'enterprise'] },
  { label: 'تحلیل قیمت هوشمند AI', keys: ['', '', 'advisor-pro', 'agency', 'builder', 'enterprise'] },
  { label: 'نقشه حرارتی بازار', keys: ['', '', 'advisor-pro', 'agency', 'builder', 'enterprise'] },
  { label: 'CRM مشتریان', keys: ['', '', 'advisor-pro', 'agency', 'builder', 'enterprise'] },
  { label: 'امضای دیجیتال قراردادها', keys: ['', '', 'advisor-pro', 'agency', 'builder', 'enterprise'] },
  { label: 'پنل مدیریت آژانس', keys: ['', '', '', 'agency', 'builder', 'enterprise'] },
  { label: 'برند اختصاصی', keys: ['', '', '', 'agency', 'builder', 'enterprise'] },
  { label: 'API کامل', keys: ['', '', '', 'agency', 'builder', 'enterprise'] },
  { label: 'پروژه پیش‌فروش آنلاین', keys: ['', '', '', '', 'builder', 'enterprise'] },
  { label: 'پورتال خریداران پروژه', keys: ['', '', '', '', 'builder', 'enterprise'] },
  { label: 'استقرار ابری اختصاصی', keys: ['', '', '', '', '', 'enterprise'] },
  { label: 'یکپارچه‌سازی ERP/CRM', keys: ['', '', '', '', '', 'enterprise'] },
  { label: 'پشتیبانی اختصاصی ۲۴/۷', keys: ['', '', '', 'agency', 'builder', 'enterprise'] },
]

const planIds = ['free', 'advisor-basic', 'advisor-pro', 'agency', 'builder', 'enterprise']

const faqs = [
  {
    q: 'آیا می‌توانم پلن خود را هر زمان تغییر دهم؟',
    a: 'بله، شما می‌توانید در هر زمان پلن خود را ارتقا یا تغییر دهید. در صورت ارتقا، مبلغ مازاد بر اساس روزهای باقی‌مانده محاسبه می‌شود و در صورت کاهش پلن، اعتبار به دوره بعدی منتقل می‌شود.',
  },
  {
    q: 'آیا پلنِ رایگان وجود دارد؟',
    a: 'بله، امکاناتِ پایه (جستجو، ذخیره، پیشنهادهای هوشمند) رایگان است. جزئیاتِ دقیقِ هر پلن روی همین صفحه از سیستمِ زنده خوانده می‌شود.',
  },
  {
    q: 'روش‌های پرداخت چیست؟',
    a: 'پرداخت از طریقِ درگاهِ امنِ داخلی و کارت‌های عضو شتاب انجام می‌شود. برای پلن‌های سازمانی امکانِ صدورِ فاکتور وجود دارد.',
  },
  {
    q: 'اگر سؤالی دربارهٔ پلن‌ها داشتم؟',
    a: 'از بخشِ پشتیبانی در پنلِ کاربری یا صفحهٔ تماسِ با ما پیام بدهید — تیمِ ملک‌جت پاسخ می‌دهد.',
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Live plans from the public API; fall back to the hardcoded array so the
  // page never looks empty (fetch error / empty response).
  const [livePlans, setLivePlans] = useState<CardPlan[] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/plans')
      .then(r => r.json())
      .then((data: { plans?: ApiPlan[] }) => {
        if (cancelled) return
        const list = Array.isArray(data?.plans) ? data.plans : []
        if (list.length > 0) setLivePlans(list.map(apiPlanToCard))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // فقط پلن‌های واقعی از API — نه قیمتِ ساختگیِ هاردکد (تا کاربر بر اساسِ قیمتِ غیرواقعی تصمیم نگیرد).
  const cardPlans: CardPlan[] = livePlans ?? []

  // بنر نتیجهٔ پرداخت (پس از بازگشت از زرین‌پال)
  const [payBanner, setPayBanner] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const pay = sp.get('pay')
    if (pay === 'success') setPayBanner({ ok: true, text: `✓ پرداخت موفق — پلن «${sp.get('plan') || ''}» فعال شد.` })
    else if (pay === 'failed') setPayBanner({ ok: false, text: `پرداخت انجام نشد${sp.get('reason') ? ` — ${sp.get('reason')}` : ''}.` })
  }, [])

  // فاز ۵۳ («فعلاً کل سایت با شماره کارت»): چک‌اوتِ کارت‌به‌کارت — کارت/شبا از تنظیماتِ ادمین + کدِ رهگیری
  const [checkout, setCheckout] = useState<{ plan: CardPlan; amount: number; card: any; zarinpal?: boolean } | null>(null)
  const [receipt, setReceipt] = useState('')
  const [sendingReceipt, setSendingReceipt] = useState(false)

  // شروع خرید/ارتقای پلن
  const buy = async (plan: CardPlan) => {
    if (/تماس/.test(plan.cta)) { router.push('/contact'); return }
    try {
      const r = await fetch('/api/payment/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: plan.id, annual }) })
      const d = await r.json().catch(() => ({}))
      if (r.status === 401 || d.needLogin) { router.push('/auth?next=/pricing'); return }
      if (d.card2card) { setCheckout({ plan, amount: d.amount, card: d.card, zarinpal: !!d.zarinpal }); setReceipt(''); return }
      if (d.redirect) { window.location.href = d.redirect; return }
      if (d.ok) { setPayBanner({ ok: true, text: '✓ پلن فعال شد.' }); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      alert(d.error || 'خطا در شروع پرداخت')
    } catch { alert('اتصال به سرور برقرار نشد') }
  }
  const submitReceipt = async () => {
    if (!checkout || !receipt.trim()) { alert('کدِ رهگیری/چهار رقمِ آخرِ کارت را وارد کنید'); return }
    setSendingReceipt(true)
    try {
      const r = await fetch('/api/payment/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: checkout.plan.id, annual, receipt: receipt.trim() }) })
      const d = await r.json().catch(() => ({}))
      if (d.pending) { setCheckout(null); setPayBanner({ ok: true, text: `✓ ${d.message || 'درخواستت ثبت شد — پس از تأییدِ واریزی، پلن خودکار فعال می‌شود.'}` }); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      alert(d.error || 'ثبتِ سفارش ناموفق بود')
    } catch { alert('اتصال به سرور برقرار نشد') } finally { setSendingReceipt(false) }
  }

  return (
    <div dir="rtl" style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <Nav />

      {/* فاز ۵۳: چک‌اوتِ کارت‌به‌کارت */}
      {checkout && (
        <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(8,9,12,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setCheckout(null)}>
          <div onClick={ev => ev.stopPropagation()} style={{ maxWidth: 440, width: '100%', background: 'var(--surface)', border: '1px solid var(--goldDim)', borderRadius: 18, padding: 24, boxShadow: '0 16px 48px -12px rgba(0,0,0,.6)' }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>💳 پرداختِ کارت‌به‌کارت — پلنِ «{checkout.plan.name}»</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>مبلغِ قابلِ‌واریز: <b style={{ color: 'var(--gold)', fontSize: 15 }}>{(checkout.amount || 0).toLocaleString('fa-IR')} تومان</b></div>
            <div style={{ background: 'var(--bg2)', border: '1px dashed var(--line2)', borderRadius: 12, padding: 14, marginTop: 12, fontSize: 13, lineHeight: 2.2 }}>
              {checkout.card.cardNumber && <div>شمارهٔ کارت: <b dir="ltr" style={{ letterSpacing: 2, color: 'var(--gold)', userSelect: 'all' }}>{checkout.card.cardNumber}</b></div>}
              {checkout.card.iban && <div>شبا: <b dir="ltr" style={{ userSelect: 'all' }}>{checkout.card.iban}</b></div>}
              {checkout.card.holderName && <div>به نامِ: <b>{checkout.card.holderName}</b>{checkout.card.bank ? ` — ${checkout.card.bank}` : ''}</div>}
              {checkout.card.note && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{checkout.card.note}</div>}
            </div>
            <input value={receipt} onChange={ev => setReceipt(ev.target.value)} placeholder="کدِ رهگیری / چهار رقمِ آخرِ کارتِ خودتان" style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, padding: '11px 13px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13.5 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button disabled={sendingReceipt} onClick={submitReceipt} style={{ flex: 1, background: 'linear-gradient(140deg,var(--gold2,#e8c96a),var(--gold))', color: '#16140f', border: 'none', borderRadius: 12, padding: '12px 0', fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{sendingReceipt ? 'در حالِ ثبت…' : 'واریز کردم — ثبتِ درخواست'}</button>
              <button onClick={() => setCheckout(null)} style={{ border: '1px solid var(--line2)', background: 'transparent', color: 'var(--text)', borderRadius: 12, padding: '12px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>انصراف</button>
            </div>
            {/* فاز ۶۹: اگر ادمین درگاهِ زرین‌پال را هم فعال کرده، پرداختِ آنلاینِ فوری گزینهٔ دوم است */}
            {checkout.zarinpal && <button onClick={async () => {
              try {
                const r = await fetch('/api/payment/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: checkout.plan.id, annual, gateway: 'zarinpal' }) })
                const d = await r.json().catch(() => ({}))
                if (d.redirect) { window.location.href = d.redirect; return }
                alert(d.error || 'خطا در اتصال به درگاه')
              } catch { alert('اتصال به سرور برقرار نشد') }
            }} style={{ width: '100%', marginTop: 10, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', borderRadius: 12, padding: '11px 0', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>⚡ پرداختِ آنلاین و فعال‌سازیِ فوری (زرین‌پال)</button>}
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 10 }}>پس از تأییدِ واریزی توسطِ ملک‌جت (معمولاً کمتر از چند ساعت)، پلن خودکار روی حسابت فعال می‌شود.</div>
          </div>
        </div>
      )}

      {payBanner && (
        <div style={{ maxWidth: 1280, margin: '18px auto 0', padding: '0 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            background: payBanner.ok ? 'rgba(34,160,90,.12)' : 'rgba(200,60,60,.12)',
            border: `1px solid ${payBanner.ok ? 'rgba(34,160,90,.5)' : 'rgba(200,60,60,.5)'}`,
            borderRadius: 14, padding: '14px 18px',
            color: payBanner.ok ? '#3ec27a' : '#e06a6a', fontSize: 14.5, fontWeight: 700,
          }}>
            <span>{payBanner.text}</span>
            <button
              onClick={() => setPayBanner(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 18, lineHeight: 1, opacity: .7 }}
              aria-label="بستن"
            >✕</button>
          </div>
        </div>
      )}

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, var(--goldDim), transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={{
            display: 'inline-block', marginBottom: 18,
            background: 'var(--goldDim)', border: '1px solid var(--gold)',
            borderRadius: 999, padding: '5px 18px',
            fontSize: 13, color: 'var(--gold)', fontWeight: 600,
          }}>
            شفاف، منعطف، بدون هزینه پنهان
          </span>
          <h1 style={{ fontSize: 'clamp(32px,5vw,54px)', fontWeight: 900, lineHeight: 1.2, marginBottom: 18 }}>
            پلن‌ها و اشتراک
          </h1>
          <p style={{ fontSize: 18, color: 'var(--muted)', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.8 }}>
            از جستجوی رایگان تا راه‌حل سازمانی — هر پلن برای یک نیاز واقعی طراحی شده است.
            بدون قرارداد بلندمدت اجباری، هر زمان که خواستید تغییر دهید.
          </p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 6px 6px 18px' }}>
            <span style={{ fontSize: 14, color: annual ? 'var(--muted)' : 'var(--text)', fontWeight: annual ? 400 : 700, transition: 'color .2s' }}>
              ماهانه
            </span>
            <button
              onClick={() => setAnnual(v => !v)}
              style={{
                width: 52, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: annual ? 'var(--gold)' : 'var(--line2)',
                position: 'relative', transition: 'background .2s',
              }}
              aria-label="تغییر نوع اشتراک"
            >
              <span style={{
                position: 'absolute', top: 4, borderRadius: '50%',
                width: 20, height: 20, background: '#fff',
                right: annual ? 4 : 28, transition: 'right .2s',
                boxShadow: '0 1px 4px rgba(0,0,0,.3)',
              }} />
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: annual ? 'var(--text)' : 'var(--muted)', fontWeight: annual ? 700 : 400 }}>
              سالانه
              {annual && (
                <span style={{ background: 'var(--gold)', color: '#1a1200', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 999 }}>
                  به‌صرفه‌تر
                </span>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Plans grid */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 80px' }}>
        {cardPlans.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '40px 0' }}>در حال دریافتِ پلن‌ها…</div>
        )}
        <div className="mjr-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {cardPlans.map(plan => (
            <div
              key={plan.id}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${plan.goldBorder ? 'var(--gold)' : 'var(--line)'}`,
                borderRadius: 18,
                padding: '28px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                position: 'relative',
                boxShadow: plan.goldBorder ? '0 0 0 1px var(--gold), var(--shadow)' : 'var(--shadow)',
                transition: 'transform .2s, box-shadow .2s',
              }}
            >
              {plan.badge && (
                <span style={{
                  position: 'absolute', top: -12, right: 22,
                  background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                  color: '#1a1200', fontSize: 11, fontWeight: 800,
                  padding: '3px 14px', borderRadius: 999,
                  boxShadow: '0 4px 12px -4px var(--gold)',
                }}>
                  {plan.badge}
                </span>
              )}
              {plan.goldBorder && (
                <span style={{
                  position: 'absolute', top: -12, right: 22,
                  background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                  color: '#1a1200', fontSize: 11, fontWeight: 800,
                  padding: '3px 14px', borderRadius: 999,
                }}>
                  سازمانی
                </span>
              )}

              <div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{plan.desc}</p>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>{plan.name}</h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: plan.id === 'free' ? 'var(--text)' : 'var(--gold)' }}>
                    {typeof plan.price.monthly === 'number'
                      ? 'تومان ۰'
                      : annual
                        ? plan.price.annual
                        : plan.price.monthly}
                  </span>
                  {plan.unit && (
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{plan.unit}</span>
                  )}
                </div>
                {annual && plan.price.annual !== plan.price.monthly && plan.price.monthly !== 'تماس' && plan.price.monthly !== 0 && (
                  <p style={{ fontSize: 12, color: 'var(--gold)', marginTop: 4 }}>
                    به جای {plan.price.monthly} {plan.unit} — ۲۰٪ صرفه‌جویی
                  </p>
                )}
              </div>

              <button
                onClick={() => buy(plan)}
                style={{
                width: '100%', padding: '12px 0', borderRadius: 12, fontWeight: 700,
                fontSize: 15, cursor: 'pointer', border: '1px solid',
                transition: 'opacity .15s',
                ...(plan.ctaStyle === 'gold'
                  ? {
                    background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                    borderColor: 'transparent',
                    color: '#1a1200',
                    boxShadow: '0 6px 20px -8px var(--gold)',
                  }
                  : {
                    background: 'transparent',
                    borderColor: 'var(--line2)',
                    color: 'var(--text)',
                  }),
              }}>
                {plan.cta}
              </button>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--gold)', marginTop: 1, flexShrink: 0, fontSize: 15 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* جدولِ مقایسهٔ ساختگیِ قبلی حذف شد — امکاناتِ واقعیِ هر پلن روی خودِ کارت‌ها (از API) دیده می‌شود */}

      {/* FAQ */}
      <section style={{ maxWidth: 780, margin: '0 auto', padding: '0 24px 100px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>سؤالات متداول</h2>
        <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 44, fontSize: 15 }}>
          اگر پاسخ سؤالتان را پیدا نکردید، با پشتیبانی ما تماس بگیرید
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${openFaq === i ? 'var(--gold)' : 'var(--line)'}`,
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'border-color .2s',
              }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%', textAlign: 'right', padding: '20px 22px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  color: 'var(--text)', fontSize: 15.5, fontWeight: 700,
                }}
              >
                <span>{faq.q}</span>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: openFaq === i ? 'var(--gold)' : 'var(--line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 14, color: openFaq === i ? '#1a1200' : 'var(--muted)',
                  transition: 'background .2s, transform .2s',
                  transform: openFaq === i ? 'rotate(45deg)' : 'none',
                }}>
                  +
                </span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 22px 20px', fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.9 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{
        textAlign: 'center', padding: '60px 24px 80px',
        background: 'var(--bg2)', borderTop: '1px solid var(--line)',
      }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 14 }}>هنوز مطمئن نیستید؟</h2>
        <p style={{ color: 'var(--muted)', fontSize: 15, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.8 }}>
          تیم متخصص ما آماده است تا بهترین پلن را با توجه به نیاز و بودجه شما پیشنهاد دهد.
          جلسه مشاوره رایگان رزرو کنید.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/submit')}
            style={{
            padding: '14px 36px', borderRadius: 12, fontWeight: 700, fontSize: 15,
            background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
            border: 'none', cursor: 'pointer', color: '#1a1200',
            boxShadow: '0 8px 24px -8px var(--gold)',
          }}>
            رزرو مشاوره رایگان
          </button>
          <button
            onClick={() => router.push('/submit')}
            style={{
            padding: '14px 36px', borderRadius: 12, fontWeight: 700, fontSize: 15,
            background: 'transparent', border: '1px solid var(--line2)', cursor: 'pointer',
            color: 'var(--text)',
          }}>
            مشاهده دمو
          </button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
