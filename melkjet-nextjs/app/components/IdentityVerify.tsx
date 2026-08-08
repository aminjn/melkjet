'use client'
// فاز ۲۶۲ — کارتِ احرازِ هویتِ «اختیاری» با شاهکار (داخلِ پنلِ کاربر). موفقیت → نشانِ تأیید + پاداشِ ملک‌کوین.
import { useState, useEffect } from 'react'

const REWARD = 500
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, textAlign: 'center' }
const fa = (n: number) => n.toLocaleString('fa-IR')

export default function IdentityVerify() {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [nid, setNid] = useState('')
  const [y, setY] = useState(''); const [m, setM] = useState(''); const [d, setD] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ reward?: number; name?: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/profile').then(r => r.json()).then(j => setVerified(!!j?.account?.identityVerifiedAt)).catch(() => setVerified(false))
  }, [])

  const submit = async () => {
    setErr('')
    if (nid.replace(/\D/g, '').length !== 10) { setErr('کد ملیِ ۱۰ رقمی را کامل وارد کنید.'); return }
    const jbd = `${y.padStart(4, '0')}${m.padStart(2, '0')}${d.padStart(2, '0')}`.replace(/\D/g, '')
    if (jbd.length !== 8) { setErr('تاریخ تولدِ شمسی را کامل وارد کنید (سال/ماه/روز).'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/auth/verify-identity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nationalCode: nid, jBirthDate: jbd }) })
      const j = await r.json()
      if (r.ok && j.verified) { setVerified(true); setDone({ reward: j.reward, name: j.name }) }
      else setErr(j.error || 'احراز ناموفق بود؛ دوباره تلاش کنید.')
    } catch { setErr('خطا در ارتباط با سرور.') } finally { setBusy(false) }
  }

  if (verified === null) return null

  if (verified) return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, borderColor: 'color-mix(in srgb, #3ba55d 45%, var(--line))' }}>
      <span style={{ fontSize: 26 }}>🔵</span>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#4fc97a' }}>هویتِ شما تأیید شده است ✓</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
          {done?.reward ? `پاداشِ ${fa(done.reward)} ملک‌کوین به حسابت اضافه شد 🎁` : 'نشانِ اعتمادِ آبی روی آگهی‌ها و پروفایلِ شما نمایش داده می‌شود.'}
        </div>
      </div>
    </div>
  )

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>🔵</span>
        <div style={{ fontWeight: 800, fontSize: 15 }}>احرازِ هویت <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>(اختیاری)</span></div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9, marginBottom: 14 }}>
        با تأییدِ هویت (کد ملی + شماره‌ات با سامانهٔ شاهکار)، <b style={{ color: 'var(--text)' }}>نشانِ آبیِ اعتماد</b> می‌گیری، آگهی‌هایت بیشتر دیده و بیشتر اعتماد می‌شوند، و <b style={{ color: 'var(--gold)' }}>{fa(REWARD)} ملک‌کوینِ هدیه</b> 🎁 به حسابت اضافه می‌شود.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>کد ملی</label>
          <input value={nid} onChange={e => setNid(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="کد ملیِ ۱۰ رقمی" style={{ ...inp, letterSpacing: 2 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>تاریخ تولد (شمسی)</label>
          <div style={{ display: 'flex', gap: 8, direction: 'rtl' }}>
            <input value={y} onChange={e => setY(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="سال ۱۳۷۰" style={inp} />
            <input value={m} onChange={e => setM(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="ماه ۰۱" style={{ ...inp, maxWidth: 90 }} />
            <input value={d} onChange={e => setD(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="روز ۰۱" style={{ ...inp, maxWidth: 90 }} />
          </div>
        </div>
      </div>
      {err && <div style={{ fontSize: 12.5, color: '#e5736f', marginTop: 10 }}>{err}</div>}
      <button disabled={busy} onClick={submit} style={{ marginTop: 14, width: '100%', padding: '12px', borderRadius: 11, background: busy ? 'var(--bg2)' : 'linear-gradient(135deg,var(--gold2),var(--gold))', color: busy ? 'var(--muted)' : '#16140f', fontWeight: 800, fontSize: 14, border: 'none', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {busy ? 'در حالِ استعلام…' : `✓ تأیید هویت و دریافتِ ${fa(REWARD)} ملک‌کوین`}
      </button>
    </div>
  )
}
