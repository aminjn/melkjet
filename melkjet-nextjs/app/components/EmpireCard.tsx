'use client'
// کارتِ ورود به «امپراتوری» داخلِ پنل‌های کاربری — نقطهٔ ورودِ مسیرِ رشد (سند: هرگز واژهٔ «بازی»).
// بدونِ امپراتوری → دعوت به شروع؛ با امپراتوری → وضعیتِ زنده (سطح/ارزش/استریک/نامه/صندوقچه) + ورود.
import { useEffect, useState } from 'react'
import Link from 'next/link'

const fa = (n: number) => Math.round(n || 0).toLocaleString('fa-IR')
const faB = (n: number) => n >= 1e9 ? `${(Math.round(n / 1e8) / 10).toLocaleString('fa-IR')} میلیارد` : n >= 1e6 ? `${fa(n / 1e6)} میلیون` : fa(n)

export default function EmpireCard() {
  const [st, setSt] = useState<any>(null)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    fetch('/api/empire', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
      .then(d => { if (!d || d.guest || d.enabled === false) setHidden(true); else setSt(d) })
      .catch(() => setHidden(true))
  }, [])
  if (hidden) return null

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, padding: 16, direction: 'rtl' }
  if (!st) return <div style={{ ...card, borderColor: 'var(--line)', fontSize: 12, color: 'var(--muted)' }}>🏛 امپراتوری...</div>

  // هنوز متولد نشده → دعوت به شروعِ مسیر
  if (!st.empire) return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 26 }}>🏛</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>امپراتوریِ ملکی‌ات را بساز</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.9 }}>
            با سرمایهٔ اولیه شروع کن، روی ملک‌های واقعیِ بازار تمرین کن و قدم‌به‌قدم رشد کن — یک مسیرِ مالیِ واقعی، نه سرگرمیِ خالی.
            {st.count > 0 && <> {fa(st.count)} نفر از قبل شروع کرده‌اند.</>}
          </div>
        </div>
      </div>
      <Link href="/empire" style={{ display: 'inline-block', marginTop: 10, background: 'var(--gold)', color: '#1a1503', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>🚀 شروعِ سفرِ مالی</Link>
    </div>
  )

  const e = st.empire, lv = st.level || {}
  const newLetter = st.brief && !st.brief.openedAt
  const chest = st.chest?.available
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 24 }}>{e.persona || '🏛'}</span>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{e.name} <span style={{ fontSize: 10, color: 'var(--muted)' }}>#{fa(e.no)}</span></div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{lv.titleFa || ''} · 🏆 {fa(st.empireScore || 0)} · ارزشِ خالص {faB(st.netWorth || 0)} تومان</div>
        </div>
        <div style={{ display: 'flex', gap: 6, fontSize: 11, flexWrap: 'wrap' }}>
          {st.streak?.streak > 0 && <span style={{ border: '1px solid var(--line2)', borderRadius: 8, padding: '3px 8px' }}>🔥 {fa(st.streak.streak)}</span>}
          {newLetter && <span style={{ border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 8, padding: '3px 8px' }}>📬 نامهٔ جدید</span>}
          {chest && <span style={{ border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 8, padding: '3px 8px' }}>🎁 صندوقچه</span>}
        </div>
      </div>
      {st.suspense && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>⏳ {st.suspense.text}</div>}
      <Link href="/empire" style={{ display: 'inline-block', marginTop: 10, background: 'var(--gold)', color: '#1a1503', borderRadius: 10, padding: '7px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>ورود به امپراتوری ←</Link>
    </div>
  )
}
