'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { listingHref } from '@/app/lib/listing-url'

// فاز ۱۰۶ — حسابِ حرفه‌ای (VIP): «اطلاعاتِ بهتر، نه قدرت» (سند ۲۲ Part 05).
// دسترسی با پلنِ دارای مجوزِ «vip» — قیمت را ادمین در پنلِ پلن‌ها تعیین می‌کند.
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
const faB = (n: number) => n >= 1e9 ? `${fa(Math.round(n / 1e8) / 10)} میلیارد` : n >= 1e6 ? `${fa(Math.round(n / 1e6))} میلیون` : fa(n)

export default function VipPage() {
  const [d, setD] = useState<any>(null)
  const [lock, setLock] = useState<any>(null)
  const [needLogin, setNeedLogin] = useState(false)
  useEffect(() => {
    fetch('/api/vip').then(async r => {
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
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>👑 حسابِ حرفه‌ای</h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.9, marginTop: 8 }}>هوشِ بازار برای تصمیمِ بهتر: مقایسهٔ محله‌ها، روندِ قیمت و هشدارِ فرصت — همه از دادهٔ واقعیِ ملک‌جت.</p>
        </div>

        {needLogin && <div style={{ ...card, textAlign: 'center' }}>برای مشاهده اول <Link href="/auth" style={{ color: 'var(--goldText)', fontWeight: 800 }}>وارد شو</Link>.</div>}

        {lock && <div style={{ ...card, textAlign: 'center', borderColor: 'var(--gold)' }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 800, margin: '8px 0' }}>{lock.error}</div>
          <Link href={lock.upgrade || '/pricing'} style={{ display: 'inline-block', marginTop: 8, padding: '10px 26px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>مشاهدهٔ پلن‌ها ←</Link>
        </div>}

        {d && <>
          {/* روندِ بازار */}
          {d.trend?.length > 1 && <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>📈 روندِ متریِ بازار <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 400 }}>— {fa(d.coverage.snapshots)} اسنپ‌شاتِ روزانه</span></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
              {(() => { const max = Math.max(...d.trend.map((t: any) => t.perM)); return d.trend.map((t: any, i: number) => (
                <div key={i} title={`روزِ ${t.day}: ${faB(t.perM)}`} style={{ flex: 1, height: `${Math.max(8, Math.round(t.perM / max * 100))}%`, background: i === d.trend.length - 1 ? 'var(--gold)' : 'var(--goldDim)', borderRadius: 3 }} />
              )) })()}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>آخرین: <b style={{ color: 'var(--goldText)' }}>{faB(d.trend[d.trend.length - 1].perM)}</b> تومان/متر</div>
          </div>}

          {/* مقایسهٔ محله‌ها */}
          {d.hoods?.length > 0 && <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>🗺 مقایسهٔ محله‌ها</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}><th style={{ padding: 6 }}>محله</th><th style={{ padding: 6 }}>متری (تومان)</th><th style={{ padding: 6 }}>Δ هفته</th><th style={{ padding: 6 }}>نمونه</th></tr></thead>
                <tbody>
                  {d.hoods.map((h: any) => (
                    <tr key={h.hood} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: 6, fontWeight: 700 }}>{h.hood}</td>
                      <td style={{ padding: 6, color: 'var(--goldText)', fontWeight: 700 }}>{faB(h.perM)}</td>
                      <td style={{ padding: 6, color: h.weekPct == null ? 'var(--faint)' : h.weekPct > 0 ? '#e06a5a' : h.weekPct < 0 ? '#3f9e63' : 'var(--muted)' }}>{h.weekPct == null ? '—' : `${h.weekPct > 0 ? '▲' : h.weekPct < 0 ? '▼' : ''} ${fa(Math.abs(h.weekPct))}٪`}</td>
                      <td style={{ padding: 6, color: 'var(--muted)' }}>{fa(h.samples)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

          {/* هشدارِ فرصت */}
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>💡 هشدارِ فرصت — زیرِ میانهٔ محله</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{d.note}</div>
            {(d.opportunities || []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>فعلاً آگهی‌ای با فاصلهٔ معنادار از میانهٔ محله‌اش نیست — فردا دوباره سر بزن.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
              {(d.opportunities || []).map((o: any) => (
                <Link key={o.id} href={listingHref(o.id, o.title, o.hood)} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 13px', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0' }}>{o.hood}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11.5 }}>
                    <b style={{ color: '#3f9e63' }}>{fa(o.belowPct)}٪ زیرِ میانه</b>
                    <span style={{ color: 'var(--muted)' }}>متری {faB(o.perM)} در برابرِ {faB(o.hoodPerM)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>}
      </main>
      <Footer />
    </div>
  )
}
