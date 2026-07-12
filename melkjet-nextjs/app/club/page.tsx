'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

// فاز ۱۱۰ — باشگاهِ کسب‌وکار (Business Club، سند ۲۲): شبکه‌سازیِ اعضای واقعی + خلاصهٔ بازار.
// چندسطحی = چند پلنِ ادمین با مجوزِ «club» — قیمت/مدت/نامِ هر سطح کاملاً دستِ ادمین.
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
const faB = (n: number) => n >= 1e9 ? `${fa(Math.round(n / 1e8) / 10)} میلیارد` : n >= 1e6 ? `${fa(Math.round(n / 1e6))} میلیون` : fa(n)
const faDate = (t?: number) => t ? new Date(t).toLocaleDateString('fa-IR') : ''

export default function ClubPage() {
  const [d, setD] = useState<any>(null)
  const [lock, setLock] = useState<any>(null)
  const [needLogin, setNeedLogin] = useState(false)
  useEffect(() => {
    fetch('/api/club').then(async r => {
      const j = await r.json().catch(() => null)
      if (r.status === 401) setNeedLogin(true)
      else if (r.status === 403 && j?.code === 'plan') setLock(j)
      else if (j?.ok) setD(j)
    }).catch(() => {})
  }, [])
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', system-ui, sans-serif" }}>
      <Nav />
      <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 18px 70px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>🤝 باشگاهِ کسب‌وکار</h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.9, marginTop: 8 }}>حلقهٔ اعضای حرفه‌ایِ ملک‌جت — شبکه‌سازی با فعالانِ واقعیِ بازار و خلاصهٔ ماهانهٔ بازار، مخصوصِ اعضا.</p>
        </div>

        {needLogin && <div style={{ ...card, textAlign: 'center' }}>برای مشاهده اول <Link href="/auth" style={{ color: 'var(--goldText)', fontWeight: 800 }}>وارد شو</Link>.</div>}

        {lock && <div style={{ ...card, textAlign: 'center', borderColor: 'var(--gold)' }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 800, margin: '8px 0' }}>{lock.error}</div>
          <Link href={lock.upgrade || '/pricing'} style={{ display: 'inline-block', marginTop: 8, padding: '10px 26px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>مشاهدهٔ پلن‌ها ←</Link>
        </div>}

        {d && <>
          {/* کارتِ عضویتِ من */}
          <div style={{ ...card, borderColor: 'var(--gold)', background: 'linear-gradient(165deg, rgba(212,175,55,.1), rgba(212,175,55,.02) 60%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 30 }}>🎖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 900 }}>عضوِ باشگاه — سطحِ «{d.me?.tier}»</div>
                {d.me?.expiresAt ? <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>اعتبارِ عضویت تا {faDate(d.me.expiresAt)}</div> : <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>عضویتِ فعال</div>}
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fa((d.members || []).length)} عضوِ فعال</span>
            </div>
          </div>

          {/* اعضای باشگاه — شبکه‌سازیِ واقعی */}
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>👥 اعضای باشگاه</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{d.note}</div>
            {(d.members || []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>تو اولین عضوِ باشگاهی — اعضای بعدی همین‌جا دیده می‌شوند.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
              {(d.members || []).map((m: any, i: number) => (
                <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 13px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>🎖</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{m.role}{m.role ? ' · ' : ''}سطحِ {m.tier}</div>
                  </div>
                  <span style={{ fontSize: 9.5, color: 'var(--faint)' }}>از {faDate(m.since)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* خلاصهٔ بازارِ اعضا */}
          {(d.digest || []).length > 0 && <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>📊 خلاصهٔ بازار — ۱۰ محلهٔ برتر <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 400 }}>از اسنپ‌شات‌های واقعیِ رصدخانهٔ ملک‌جت</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}><th style={{ padding: 6 }}>محله</th><th style={{ padding: 6 }}>متری (تومان)</th><th style={{ padding: 6 }}>نمونه</th></tr></thead>
                <tbody>
                  {d.digest.map((h: any) => (
                    <tr key={h.hood} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: 6, fontWeight: 700 }}>{h.hood}</td>
                      <td style={{ padding: 6, color: 'var(--goldText)', fontWeight: 700 }}>{faB(h.perM)}</td>
                      <td style={{ padding: 6, color: 'var(--muted)' }}>{fa(h.samples)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>تحلیلِ عمیق‌تر (روند، Δ هفتگی، هشدارِ فرصت) در <Link href="/vip" style={{ color: 'var(--goldText)' }}>حسابِ حرفه‌ای</Link> است.</div>
          </div>}
        </>}
      </main>
      <Footer />
    </div>
  )
}
