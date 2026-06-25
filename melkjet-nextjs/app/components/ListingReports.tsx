'use client'
import { useEffect, useState } from 'react'

// گزارشِ بازدید و کلیکِ تماسِ آگهی‌های کاربر — مشترک در پنل‌ها.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
interface Row { id: string; title: string; location: string; price: string; image?: string; views: number; contacts: number; lastView?: number }

export default function ListingReports({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [totals, setTotals] = useState({ views: 0, contacts: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/listing-stats?mine=1').then(r => r.ok ? r.json() : null).then(d => { if (d) { setRows(d.listings || []); setTotals(d.totals || { views: 0, contacts: 0 }) } setLoading(false) }).catch(() => setLoading(false)) }, [])

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT }
  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div><div style={{ fontSize: 16, fontWeight: 900 }}>گزارشِ بازدید آگهی‌ها</div><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هر آگهی چند بار باز و دیده شده و چند نفر اطلاعات تماس را گرفته‌اند.</div></div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[['کلِ بازدید', totals.views, '👁'], ['کلِ کلیکِ تماس', totals.contacts, '☎'], ['تعدادِ آگهی', rows.length, '▤']].map(([l, v, ic]: any) => (
          <div key={l} style={card}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{l}</span><span style={{ fontSize: 16 }}>{ic}</span></div><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)', marginTop: 8 }}>{fa(v)}</div></div>
        ))}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>در حال بارگذاری…</div>
          : rows.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>هنوز آگهیِ منتشرشده‌ای ندارید یا بازدیدی ثبت نشده است.</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {['آگهی', 'بازدید', 'کلیکِ تماس', 'نرخِ تماس'].map(h => <th key={h} style={{ padding: '11px 14px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textAlign: 'right', borderBottom: '1px solid var(--line)' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const rate = r.views > 0 ? Math.round((r.contacts / r.views) * 100) : 0
                      return (
                        <tr key={r.id}>
                          <td style={{ padding: '11px 14px', borderTop: '1px solid var(--line)' }}>
                            <a href={`/property/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
                              <span style={{ width: 38, height: 38, borderRadius: 8, background: r.image ? `center/cover no-repeat url(${r.image})` : 'var(--bg2)', flexShrink: 0, border: '1px solid var(--line)' }} />
                              <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{r.title}</span><span style={{ fontSize: 11, color: 'var(--faint)' }}>{r.location}</span></span>
                            </a>
                          </td>
                          <td style={{ padding: '11px 14px', borderTop: '1px solid var(--line)', fontWeight: 700, fontSize: 13.5 }}>{fa(r.views)}</td>
                          <td style={{ padding: '11px 14px', borderTop: '1px solid var(--line)', fontWeight: 700, fontSize: 13.5, color: 'var(--gold)' }}>{fa(r.contacts)}</td>
                          <td style={{ padding: '11px 14px', borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)' }}>{fa(rate)}٪</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
      </div>
    </div>
  )
}
