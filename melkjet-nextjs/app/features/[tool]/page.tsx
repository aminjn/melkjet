import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getToolLanding, TOOL_LANDINGS } from '@/app/lib/tool-landings'
import { getSession } from '@/app/lib/session'
import { profilePageSpec } from '@/app/lib/site-templates'

// فاز ۲۹۸ط — «هر پروفایل بداند سایتش دقیقاً چه دارد» (خواستهٔ صریح): روی لندینگِ سایت‌ساز،
// برای هر صنف فهرستِ واقعیِ صفحاتِ سایتِ خودکارش از profilePageSpec نشان داده می‌شود.
const SITE_ROLES: { key: string; glyph: string }[] = [
  { key: 'مشاور', glyph: '🏠' }, { key: 'آژانس', glyph: '🏛' }, { key: 'سازنده', glyph: '🏗' },
  { key: 'معمار', glyph: '📐' }, { key: 'فروشگاه', glyph: '🧱' }, { key: 'سرمایه‌گذار', glyph: '📈' },
]

// فاز ۲۹۸د — صفحهٔ معرفیِ عمومیِ هر ابزارِ کسب‌وکار. لینک‌های فوتر به اینجا می‌رسند (نه مستقیم
// به داشبوردِ گِیت‌شده)؛ دکمهٔ «شروع» بسته به ورود، به ابزار یا به /auth می‌برد.
export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const t = getToolLanding(decodeURIComponent(tool))
  if (!t) return { title: 'ابزارهای ملک‌جت' }
  return {
    title: `${t.name} — ملک‌جت`,
    description: t.tagline,
    alternates: { canonical: `https://melkjet.com/features/${t.id}` },
    openGraph: { title: `${t.name} — ملک‌جت`, description: t.tagline, type: 'website' },
  }
}

export default async function ToolLandingPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const t = getToolLanding(decodeURIComponent(tool))
  if (!t) notFound()
  const session = await getSession()
  const ctaHref = session ? t.href : `/auth?next=${encodeURIComponent(t.href)}`
  const a = t.accent

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(48px,8vw,96px) clamp(16px,5vw,24px) clamp(40px,6vw,72px)', direction: 'rtl' }}>
        <div aria-hidden style={{ position: 'absolute', insetInlineEnd: '-10%', top: '-30%', width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${a}2e, transparent 70%)`, filter: 'blur(8px)', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', insetInlineStart: '-8%', bottom: '-40%', width: 460, height: 460, borderRadius: '50%', background: `radial-gradient(circle, ${a}1f, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 1080, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 999, background: `${a}1a`, border: `1px solid ${a}44`, color: a, fontSize: 13, fontWeight: 800, marginBottom: 22 }}>
            <span style={{ fontSize: 16 }}>{t.glyph}</span>{t.eyebrow}
          </div>
          <h1 style={{ fontSize: 'clamp(30px,6vw,54px)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 18px', color: 'var(--text)' }}>{t.name}</h1>
          <p style={{ fontSize: 'clamp(16px,2.4vw,22px)', fontWeight: 700, color: 'var(--text)', opacity: .9, maxWidth: 720, margin: '0 auto 14px' }}>{t.tagline}</p>
          <p style={{ fontSize: 'clamp(14px,1.8vw,16.5px)', color: 'var(--muted)', lineHeight: 2, maxWidth: 680, margin: '0 auto 30px' }}>{t.intro}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 26 }}>
            <Link href={ctaHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 30px', borderRadius: 14, background: `linear-gradient(135deg, ${a}, ${a}cc)`, color: '#fff', fontWeight: 900, fontSize: 16, textDecoration: 'none', boxShadow: `0 10px 30px -8px ${a}88` }}>
              {session ? t.cta : 'شروعِ رایگان'} <span style={{ fontSize: 18 }}>←</span>
            </Link>
            <Link href={`/pricing?for=${t.id}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 26px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>دیدنِ پلن‌ها</Link>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)', alignSelf: 'center' }}>برای:</span>
            {t.forWho.map(w => (
              <span key={w} style={{ padding: '5px 13px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{w}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: 'clamp(32px,5vw,56px) clamp(16px,5vw,24px)', direction: 'rtl' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(22px,3.5vw,30px)', fontWeight: 900, textAlign: 'center', margin: '0 0 8px', color: 'var(--text)' }}>چه کاری برایت می‌کند؟</h2>
          <div style={{ width: 54, height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${a}, transparent)`, margin: '0 auto 36px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
            {t.features.map(f => (
              <div key={f.title} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '24px 22px', transition: 'transform .2s, box-shadow .2s' }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: `${a}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 15 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 7px', color: 'var(--text)' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.9, margin: 0 }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* فاز ۲۹۸ط — «سایتت چه صفحاتی خواهد داشت» (فقط برای سایت‌ساز) — دادهٔ واقعیِ هر صنف */}
      {t.id === 'website-builder' && (
        <section style={{ padding: '8px clamp(16px,5vw,24px) clamp(28px,4vw,48px)', direction: 'rtl' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, textAlign: 'center', margin: '0 0 6px', color: 'var(--text)' }}>سایتت دقیقاً چه صفحاتی خواهد داشت؟</h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', margin: '0 auto 30px', maxWidth: 560 }}>بسته به صنفت، سایتِ خودکارت این صفحات را می‌گیرد — همه از دادهٔ واقعیِ خودت.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              {SITE_ROLES.map(r => {
                const pages = ['صفحه اصلی', ...profilePageSpec(r.key).map(s => s.menuLabel || s.title)]
                return (
                  <div key={r.key} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '22px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ width: 42, height: 42, borderRadius: 12, background: `${a}1a`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{r.glyph}</span>
                      <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>{r.key}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {pages.map((pg, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, background: i === 0 ? `${a}14` : 'var(--bg)', border: `1px solid ${i === 0 ? `${a}44` : 'var(--line)'}`, fontSize: 12.5, fontWeight: 700, color: i === 0 ? a : 'var(--text)' }}>
                          <span style={{ color: a }}>✓</span>{pg}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* WHAT YOU GET strip */}
      <section style={{ padding: '8px clamp(16px,5vw,24px) clamp(32px,5vw,56px)', direction: 'rtl' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', background: `linear-gradient(135deg, ${a}12, var(--surface))`, border: `1px solid ${a}33`, borderRadius: 22, padding: 'clamp(26px,4vw,40px)' }}>
          <h3 style={{ fontSize: 'clamp(18px,2.6vw,22px)', fontWeight: 900, margin: '0 0 20px', color: 'var(--text)' }}>با این ابزار چه می‌گیری</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {t.bullets.map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                <span style={{ width: 26, height: 26, borderRadius: 999, background: a, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✓</span>
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={{ padding: 'clamp(32px,5vw,64px) clamp(16px,5vw,24px) clamp(48px,7vw,80px)', direction: 'rtl' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center', background: `linear-gradient(135deg, ${a}1a, ${a}08)`, border: `1px solid ${a}3a`, borderRadius: 26, padding: 'clamp(32px,5vw,52px)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{t.glyph}</div>
          <h2 style={{ fontSize: 'clamp(22px,3.5vw,30px)', fontWeight: 900, margin: '0 0 12px', color: 'var(--text)' }}>همین حالا شروع کن</h2>
          <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.9, margin: '0 auto 24px', maxWidth: 480 }}>{t.tagline}</p>
          <Link href={ctaHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 34px', borderRadius: 14, background: `linear-gradient(135deg, ${a}, ${a}cc)`, color: '#fff', fontWeight: 900, fontSize: 16.5, textDecoration: 'none', boxShadow: `0 10px 30px -8px ${a}88` }}>
            {session ? t.cta : 'شروعِ رایگان'} <span style={{ fontSize: 18 }}>←</span>
          </Link>
          {!session ? <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 14 }}>ورود/ثبت‌نام با شمارهٔ موبایل — رایگان</div> : null}
        </div>

        {/* سایر ابزارها */}
        <div style={{ maxWidth: 1080, margin: '44px auto 0' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--muted)', textAlign: 'center', marginBottom: 16 }}>ابزارهای دیگرِ ملک‌جت</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {TOOL_LANDINGS.filter(x => x.id !== t.id).map(x => (
              <Link key={x.id} href={`/features/${x.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>
                <span>{x.glyph}</span>{x.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
