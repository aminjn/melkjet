'use client'
import { useEffect, useState } from 'react'

// نشانِ اعتمادِ REOS. بدونِ entityId = کاربرِ فعلی؛ با entityId = اعتمادِ یک پروفایل.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
type Trust = { score: number; tier: string; badges: string[]; parts: Record<string, number> }
const LABEL: Record<string, string> = { phone: 'موبایل', identity: 'هویت', agency: 'آژانس', builder: 'سازنده', expert: 'کارشناس', property: 'ملک' }
const tierColor = (t: string) => t === 'طلایی' ? '#f7d774' : t === 'نقره‌ای' ? '#cbd5e1' : t === 'برنزی' ? '#e7a14a' : 'var(--faint)'

export default function ReosTrustBadge({ entityId, compact = false }: { entityId?: string; compact?: boolean }) {
  const [t, setT] = useState<Trust | null>(null)
  useEffect(() => {
    let on = true
    fetch(`/api/reos/trust${entityId ? '?entityId=' + encodeURIComponent(entityId) : ''}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => { if (on) setT(d?.trust || null) }).catch(() => {})
    return () => { on = false }
  }, [entityId])
  if (!t) return null
  const c = tierColor(t.tier)

  if (compact) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONT, fontSize: 11.5, fontWeight: 800, color: c, background: 'var(--bg2)', border: `1px solid ${c}`, borderRadius: 999, padding: '2px 9px' }}>🛡 اعتماد {fa(t.score)} · {t.tier}</span>
  )

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🛡</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>امتیازِ اعتماد</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>سطح: <b style={{ color: c }}>{t.tier}</b></div>
        </div>
        <div style={{ marginInlineStart: 'auto', fontSize: 26, fontWeight: 900, color: c }}>{fa(t.score)}<span style={{ fontSize: 12, color: 'var(--muted)' }}>/۱۰۰</span></div>
      </div>
      <div style={{ height: 7, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}><div style={{ width: `${t.score}%`, height: 7, background: c, borderRadius: 99 }} /></div>
      {t.badges.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {t.badges.map(b => <span key={b} style={{ fontSize: 10.5, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)', borderRadius: 999, padding: '3px 9px' }}>✓ {LABEL[b] || b}</span>)}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 10 }}>ترکیبی از تأییدها، کاملیِ پروفایل، نرخِ پاسخ، معاملات و سابقه. تأییدِ هویت را از پشتیبانی بگیرید.</div>
    </div>
  )
}
