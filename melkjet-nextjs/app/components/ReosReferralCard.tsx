'use client'
import { useEffect, useState } from 'react'

// کارتِ دعوت و اعتبار (REOS Growth Engine). به /api/reos/growth وصل است.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
type Ref = { code: string; invited: number; converted: number; credits: number; conversionRate: number }

export default function ReosReferralCard() {
  const [d, setD] = useState<Ref | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let on = true
    fetch('/api/reos/growth', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(x => { if (on) setD(x?.referral || null) }).catch(() => {})
    return () => { on = false }
  }, [])
  if (!d) return null
  const link = typeof window !== 'undefined' ? `${window.location.origin}/auth?ref=${d.code}` : ''
  const copy = () => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🎁</span><span style={{ fontSize: 15, fontWeight: 800 }}>دعوت و اعتبار</span>
        <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--faint)' }}>هر دعوتِ موفق = اعتبارِ کیفِ پول</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180, background: 'var(--bg2)', border: '1px dashed var(--line2)', borderRadius: 10, padding: '9px 12px', fontFamily: 'monospace', direction: 'ltr', fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link || d.code}</div>
        <button onClick={copy} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>{copied ? 'کپی شد ✓' : 'کپیِ لینک'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[{ l: 'دعوت‌شده', v: fa(d.invited) }, { l: 'موفق', v: fa(d.converted), c: '#34d399' }, { l: 'اعتبارِ کسب‌شده', v: fa(d.credits), c: 'var(--gold)' }].map(k => (
          <div key={k.l} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{k.l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.c || 'var(--text)' }}>{k.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
