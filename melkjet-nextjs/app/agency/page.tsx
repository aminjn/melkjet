'use client'
import { useState } from 'react'
import Link from 'next/link'

type View = 'overview'|'branches'|'advisors'|'finance'

const kpis = [
  { l: 'فروش کل', v: '۸۴ م.د', t: '↗ ۱۸٪ نسبت به ماه قبل', tc: '#5fd98a', ic: '◎', bg: 'rgba(95,217,138,0.12)', c: '#5fd98a' },
  { l: 'مشاوران فعال', v: '۳۸', t: '+۳ این ماه', tc: 'var(--gold)', ic: '♛', bg: 'var(--goldDim)', c: 'var(--gold)' },
  { l: 'لیدهای جدید', v: '۴۲۰', t: '↗ ۲۴٪ نسبت به ماه قبل', tc: '#5b9bd5', ic: '◈', bg: 'rgba(91,155,213,0.12)', c: '#5b9bd5' },
  { l: 'نرخ تبدیل', v: '۱۲٪', t: '+۲٪ بهتر شد', tc: '#5fd98a', ic: '◴', bg: 'rgba(95,217,138,0.12)', c: '#5fd98a' },
]

const branches = [
  { name: 'شعبه تهران مرکز', rank: 'برتر', rankColor: 'var(--gold)', sales: '۳۸ م.د', advisors: 14, conv: '۱۸٪', img: 'linear-gradient(135deg,#caa86a,#8a6f3e)' },
  { name: 'شعبه شمال تهران', rank: 'خوب', rankColor: '#5fd98a', sales: '۲۸ م.د', advisors: 12, conv: '۱۱٪', img: 'linear-gradient(135deg,#7a8fae,#465a78)' },
  { name: 'شعبه غرب تهران', rank: 'متوسط', rankColor: '#e7a14a', sales: '۱۸ م.د', advisors: 12, conv: '۸٪', img: 'linear-gradient(135deg,#7aa88f,#476e58)' },
]

const advisors = [
  { rank: 1, name: 'سارا محمدی', branch: 'مرکز', deals: 12, sales: '۲۸ م.د', commission: '۱٫۴ م.د', goal: 85 },
  { rank: 2, name: 'امیر رضایی', branch: 'شمال', deals: 9, sales: '۲۱ م.د', commission: '۱٫۰ م.د', goal: 70 },
  { rank: 3, name: 'نگار کریمی', branch: 'مرکز', deals: 7, sales: '۱۶ م.د', commission: '۰٫۸ م.د', goal: 62 },
  { rank: 4, name: 'کاوه اسدی', branch: 'غرب', deals: 6, sales: '۱۳ م.د', commission: '۰٫۶ م.د', goal: 54 },
  { rank: 5, name: 'مریم صادقی', branch: 'شمال', deals: 5, sales: '۱۱ م.د', commission: '۰٫۵ م.د', goal: 48 },
]

const navItems: { id: View; ic: string; l: string }[] = [
  { id: 'overview', ic: '◍', l: 'داشبورد' },
  { id: 'branches', ic: '▦', l: 'شعب' },
  { id: 'advisors', ic: '♛', l: 'مشاوران' },
  { id: 'finance', ic: '◎', l: 'مالی' },
]

export default function AgencyPage() {
  const [view, setView] = useState<View>('overview')
  const [theme, setTheme] = useState<'dark'|'light'>('dark')

  const navStyle = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, border: 'none',
    background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)',
    fontFamily: 'inherit', fontSize: 13.5, fontWeight: active ? 700 : 500, cursor: 'pointer', width: '100%', textAlign: 'right' as const,
  })

  const th = { padding: '11px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textAlign: 'right' as const, background: 'var(--bg2)', borderBottom: '1px solid var(--line)' }
  const td = { padding: '13px 16px', fontSize: 13, color: 'var(--text)', borderTop: '1px solid var(--line)' }

  const viewTitles: Record<View, string> = { overview: 'داشبورد آژانس', branches: 'مدیریت شعب', advisors: 'رتبه‌بندی مشاوران', finance: 'گزارش مالی' }

  const salesBars = [42, 58, 51, 67, 74, 84]
  const months = ['دی', 'بهمن', 'اسفند', 'فروردین', 'اردیبهشت', 'خرداد']

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', sans-serif" }}>
      {/* SIDEBAR */}
      <aside className="mjg-side" style={{ width: 240, flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflow: 'auto', background: 'var(--bg2)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '18px 13px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: 'var(--text)', padding: '6px 8px 16px' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 13, height: 13, background: 'var(--bg2)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }}></span>
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.5px' }}>ملک‌جت</div>
            <div style={{ fontSize: 10.5, color: 'var(--gold)' }}>پنل آژانس</div>
          </div>
        </Link>
        <nav style={{ display: 'grid', gap: 3 }}>
          {navItems.map(m => (
            <button key={m.id} onClick={() => setView(m.id)} style={navStyle(view === m.id)}>
              <span style={{ width: 22, textAlign: 'center', fontSize: 15 }}>{m.ic}</span>
              <span className="mjg-sidelabel" style={{ flex: 1, textAlign: 'right' }}>{m.l}</span>
            </button>
          ))}
          <Link href="/website-builder" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, color: 'var(--gold)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, marginTop: 4, border: '1px solid rgba(212,175,55,0.25)' }}>
            <span style={{ width: 22, textAlign: 'center', fontSize: 15 }}>◳</span>
            <span className="mjg-sidelabel" style={{ flex: 1, textAlign: 'right' }}>وب‌سایت من (سایت‌ساز)</span>
          </Link>
          <Link href="/content" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, color: 'var(--gold)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, marginTop: 4, border: '1px solid rgba(212,175,55,0.25)' }}>
            <span style={{ width: 22, textAlign: 'center', fontSize: 15 }}>✎</span>
            <span className="mjg-sidelabel" style={{ flex: 1, textAlign: 'right' }}>مقالات و وبلاگ</span>
          </Link>
        </nav>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 6px 4px', borderTop: '1px solid var(--line)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7a8fae,#465a78)', flexShrink: 0 }}></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>آژانس پارسیان</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>پلن آژانس</div>
          </div>
          <button onClick={() => { const n = theme === 'dark' ? 'light' : 'dark'; setTheme(n); document.documentElement.classList.toggle('light', n === 'light') }} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>{theme === 'dark' ? '☀' : '☾'}</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--navbg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--line)', padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.4px' }}>{viewTitles[view]}</div>
          <div style={{ flex: 1 }}></div>
          <Link href="/crm" style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 11, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>CRM مشاوران</Link>
        </header>

        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>

          {/* OVERVIEW */}
          {view === 'overview' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div className="mjg-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {kpis.map(k => (
                  <div key={k.l} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{k.l}</span>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: k.bg, color: k.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{k.ic}</span>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 12, letterSpacing: '-.5px' }}>{k.v}</div>
                    <div style={{ fontSize: 11.5, color: k.tc, marginTop: 4 }}>{k.t}</div>
                  </div>
                ))}
              </div>

              <div className="mjg-2col" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div><div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>عملکرد فروش شعب</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>۶ ماه گذشته (م.د)</div></div>
                    <div style={{ textAlign: 'left' }}><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>۸۴ م.د</div><div style={{ fontSize: 11.5, color: '#5fd98a' }}>↗ ۱۸٪ رشد</div></div>
                  </div>
                  <div style={{ height: 170, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                    {salesBars.map((v, i) => {
                      const max = Math.max(...salesBars)
                      const h = 20 + (v / max) * 80
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ width: '100%', borderRadius: '7px 7px 0 0', height: `${h}%`, background: i === salesBars.length - 1 ? 'linear-gradient(to top,var(--gold),var(--gold2))' : 'var(--goldDim)' }}></div>
                          <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{months[i]}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>منابع لید</div>
                  {[['ملک‌جت', 48, 'var(--gold)'], ['معرفی', 22, '#5fd98a'], ['شبکه اجتماعی', 18, '#5b9bd5'], ['حضوری', 12, '#9b7ad0']].map(([l, v, c]) => (
                    <div key={String(l)} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                        <span>{String(l)}</span><span style={{ color: 'var(--text)', fontWeight: 700 }}>{String(v)}٪</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: 'var(--bg2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${v}%`, background: String(c), borderRadius: 4 }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BRANCHES */}
          {view === 'branches' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
              {branches.map(b => (
                <div key={b.name} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
                  <div style={{ height: 80, background: b.img, position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 12, left: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(20,18,14,0.7)', color: b.rankColor, fontSize: 11.5, fontWeight: 800, border: `1px solid ${b.rankColor}` }}>{b.rank}</span>
                  </div>
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{b.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                      {[['فروش', b.sales], ['مشاوران', String(b.advisors)], ['تبدیل', b.conv]].map(([l, v]) => (
                        <div key={String(l)} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>{String(v)}</div>
                          <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{String(l)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ADVISORS */}
          {view === 'advisors' && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>رتبه‌بندی مشاوران این ماه</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                  <thead>
                    <tr><th style={th}>رتبه</th><th style={th}>مشاور</th><th style={th}>شعبه</th><th style={th}>معاملات</th><th style={th}>فروش</th><th style={th}>کمیسیون</th><th style={th}>هدف ماهانه</th></tr>
                  </thead>
                  <tbody>
                    {advisors.map(a => (
                      <tr key={a.name}>
                        <td style={td}><span style={{ fontWeight: 800, color: a.rank <= 3 ? 'var(--gold)' : 'var(--muted)', fontSize: 15 }}>#{a.rank}</span></td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#caa86a,#8a6f3e)', flexShrink: 0 }}></div>
                            <span style={{ fontWeight: 600 }}>{a.name}</span>
                          </div>
                        </td>
                        <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{a.branch}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{a.deals}</td>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--gold)' }}>{a.sales}</td>
                        <td style={{ ...td, color: 'var(--muted)' }}>{a.commission}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--bg2)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${a.goal}%`, background: 'var(--gold)', borderRadius: 4 }}></div>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{a.goal}٪</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FINANCE */}
          {view === 'finance' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div className="mjg-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {[['درآمد ناخالص', '۸۴ م.د'], ['کمیسیون مشاوران', '۳۸٫۵ م.د'], ['سهم آژانس', '۴۵٫۵ م.د'], ['هزینه‌ها', '۸٫۲ م.د']].map(([l, v]) => (
                  <div key={String(l)} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{String(l)}</span>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 12 }}>{String(v)}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>گزارش کمیسیون شعب</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>شعبه</th><th style={th}>فروش</th><th style={th}>کمیسیون مشاوران</th><th style={th}>سهم آژانس</th><th style={th}>وضعیت</th></tr></thead>
                  <tbody>
                    {branches.map(b => (
                      <tr key={b.name}>
                        <td style={td}>{b.name}</td>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--gold)' }}>{b.sales}</td>
                        <td style={{ ...td, fontFamily: "'JetBrains Mono', monospace", direction: 'ltr', textAlign: 'right' }}>--</td>
                        <td style={{ ...td, fontFamily: "'JetBrains Mono', monospace", direction: 'ltr', textAlign: 'right' }}>--</td>
                        <td style={td}><span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(95,217,138,0.15)', color: '#5fd98a', fontSize: 11.5, fontWeight: 700, border: '1px solid rgba(95,217,138,0.3)' }}>تسویه شد</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
