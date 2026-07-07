'use client'
import { useEffect, useState } from 'react'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
type Ev = { id: string; type: string; at: number; userId?: string; propertyId?: string; agentId?: string; leadId?: string }
type Top = { id: string; title: string; engagement: number; clicks: number; saves: number; contacts: number }
type Data = {
  engine: { publicListings: number; weights: Record<string, Record<string, number>> }
  events: { total: number; byType: Record<string, number>; recent: Ev[] }
  topProperties: Top[]
}
const EV_LABEL: Record<string, string> = {
  user_clicked_property: 'بازدید', user_saved_property: 'سیو', user_searched: 'جستجو',
  contact_made: 'تماس', property_created: 'ثبتِ ملک', lead_created: 'لیدِ جدید', agent_assigned: 'تخصیصِ مشاور',
}

export default function ReosAdminPage() {
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    fetch('/api/reos/admin', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : r.json().then(x => Promise.reject(x)))
      .then(x => { setD(x); setLoading(false) })
      .catch(x => { setErr(x?.error || 'خطا'); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }
  const wrap: React.CSSProperties = { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT, direction: 'rtl', padding: 'clamp(16px,4vw,32px)' }

  if (loading) return <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>در حال بارگذاری REOS…</div>
  if (err) return <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ ...card, textAlign: 'center' }}>{err}<div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>این صفحه فقط برای مدیرِ سیستم است.</div></div></div>
  if (!d) return null

  return (
    <div style={{ ...wrap, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>✦ REOS — مغزِ زندهٔ سیستم</div>
        <button onClick={load} style={{ marginInlineStart: 'auto', padding: '7px 14px', borderRadius: 9, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: FONT }}>به‌روزرسانی</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 18 }}>
        {[
          { label: 'کلِ رویدادها', value: fa(d.events.total), c: 'var(--gold)' },
          { label: 'آگهیِ عمومیِ رتبه‌پذیر', value: fa(d.engine.publicListings), c: '#60a5fa' },
          { label: 'تماس‌ها', value: fa(d.events.byType.contact_made || 0), c: '#34d399' },
          { label: 'سیوها', value: fa(d.events.byType.user_saved_property || 0), c: '#e7a14a' },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.c }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }} className="reos-cols">
        {/* رویداد به‌تفکیکِ نوع */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>رویدادها به‌تفکیکِ نوع</div>
          {Object.keys(d.events.byType).length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز رویدادی ثبت نشده — با بازدید/سیو/تماس روی سایت پر می‌شود.</div> :
            Object.entries(d.events.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => {
              const max = Math.max(...Object.values(d.events.byType))
              return (
                <div key={t} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}><span>{EV_LABEL[t] || t}</span><span style={{ fontWeight: 800 }}>{fa(n)}</span></div>
                  <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 99 }}><div style={{ width: `${(n / max) * 100}%`, height: 6, background: 'var(--gold)', borderRadius: 99 }} /></div>
                </div>
              )
            })}
        </div>

        {/* پرتعامل‌ترین املاک (از feature store) */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>پرتعامل‌ترین املاک (Feature Store)</div>
          {d.topProperties.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز داده‌ای نیست.</div> :
            d.topProperties.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)', width: 20 }}>{fa(i + 1)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>👁 {fa(p.clicks)} · ♥ {fa(p.saves)} · ☎ {fa(p.contacts)}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)' }}>{fa(p.engagement)}</span>
              </div>
            ))}
        </div>
      </div>

      {/* رویدادهای اخیر */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>رویدادهای اخیر (زنده)</div>
        {d.events.recent.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>—</div> :
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {d.events.recent.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: 'var(--gold)', minWidth: 90 }}>{EV_LABEL[e.type] || e.type}</span>
                <span style={{ color: 'var(--muted)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[e.userId && `کاربر ${e.userId}`, e.propertyId && `ملک ${e.propertyId.slice(0, 8)}`, e.agentId && `مشاور ${e.agentId}`, e.leadId && `لید ${e.leadId.slice(0, 8)}`].filter(Boolean).join(' · ')}</span>
                <span style={{ color: 'var(--faint)' }}>{new Date(e.at).toLocaleString('fa-IR')}</span>
              </div>
            ))}
          </div>}
      </div>

      {/* وزن‌های موتور (شفافیت) */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>وزن‌های موتورِ اسکورینگ</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 2, fontFamily: 'monospace', direction: 'ltr' }}>
          <div>Global: {JSON.stringify(d.engine.weights.global)}</div>
          <div>Hybrid: {JSON.stringify(d.engine.weights.hybrid)}</div>
          <div>FeedRank: {JSON.stringify(d.engine.weights.feedRank)}</div>
        </div>
      </div>
      <style>{`@media(max-width:800px){.reos-cols{grid-template-columns:1fr !important}}`}</style>
    </div>
  )
}
