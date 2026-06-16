'use client'
import { useState } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

const plans = [
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
    q: 'آیا دوره آزمایشی رایگان وجود دارد؟',
    a: 'بله، پلن‌های مشاور پایه و حرفه‌ای دارای ۱۴ روز دوره آزمایشی رایگان هستند. در طول این مدت به تمام امکانات دسترسی کامل خواهید داشت و نیازی به ارائه اطلاعات کارت بانکی نیست.',
  },
  {
    q: 'روش‌های پرداخت چیست؟',
    a: 'ما از درگاه‌های معتبر داخلی (زرین‌پال، ایدی‌پی، پارسیان) پشتیبانی می‌کنیم. پرداخت می‌تواند از طریق کارت‌های عضو شتاب، کیف پول الکترونیک یا انتقال بانکی انجام شود. برای پلن‌های سازمانی، فاکتور رسمی صادر می‌گردد.',
  },
  {
    q: 'اگر از پلن ناراضی بودم، بازگشت وجه دارید؟',
    a: 'در صورتی که در ۷ روز اول اشتراک از پلن راضی نباشید، مبلغ پرداختی به‌طور کامل بازگردانده می‌شود. پس از این مدت، بازگشت وجه به‌صورت اعتبار برای دوره‌های بعدی در نظر گرفته می‌شود.',
  },
]

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div dir="rtl" style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <Nav />

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
                  ۲۰٪ تخفیف
                </span>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Plans grid */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 80px' }}>
        <div className="mjr-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {plans.map(plan => (
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

              <button style={{
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

      {/* Comparison Table */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>مقایسه کامل ویژگی‌ها</h2>
        <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 40, fontSize: 15 }}>
          یک نگاه جامع به تمام امکاناتی که هر پلن ارائه می‌دهد
        </p>
        <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid var(--line)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: 13, color: 'var(--muted)', fontWeight: 600, width: '28%' }}>
                  ویژگی
                </th>
                {plans.map(p => (
                  <th key={p.id} style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: p.goldBorder ? 'var(--gold)' : 'var(--text)', fontWeight: 700 }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareFeatures.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    borderBottom: '1px solid var(--line)',
                    background: ri % 2 === 0 ? 'transparent' : 'var(--bg2)',
                  }}
                >
                  <td style={{ padding: '14px 20px', fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>
                    {row.label}
                  </td>
                  {planIds.map((pid, ci) => {
                    const val = row.values ? row.values[ci] : null
                    const included = row.keys ? row.keys.includes(pid) : false
                    return (
                      <td key={pid} style={{ padding: '14px 12px', textAlign: 'center' }}>
                        {val ? (
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{val}</span>
                        ) : included ? (
                          <span style={{ color: 'var(--gold)', fontSize: 16, fontWeight: 800 }}>✓</span>
                        ) : (
                          <span style={{ color: 'var(--faint)', fontSize: 16 }}>✕</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
          <button style={{
            padding: '14px 36px', borderRadius: 12, fontWeight: 700, fontSize: 15,
            background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
            border: 'none', cursor: 'pointer', color: '#1a1200',
            boxShadow: '0 8px 24px -8px var(--gold)',
          }}>
            رزرو مشاوره رایگان
          </button>
          <button style={{
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
