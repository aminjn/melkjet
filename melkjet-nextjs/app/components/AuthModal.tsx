'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// پاپ‌آپِ ورود/ثبت‌نام — سراسری. با رویدادِ window «mj-open-auth» باز می‌شود.
// پس از ورودِ موفق: رویدادِ «mj-auth-success» را می‌فرستد و بسته می‌شود (روی همان صفحه می‌ماند).

type Tab = 'phone' | 'email'
type OtpStep = 'enter-phone' | 'shahkar' | 'enter-code' | 'onboard'
const faToEn = (v: string) => (v || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
const ROLE_ICONS: Record<string, string> = { '/buyer': '🔑', '/owner': '🏠', '/pros': '🤝', '/agency': '🏢', '/builder': '🏗', '/materials': '🧱', '/legal': '⚖' }
const FALLBACK_ROLES = [
  { id: 'کاربر عادی', name: 'کاربر عادی', dashboard: '/buyer' },
  { id: 'مشاور املاک', name: 'مشاور املاک', dashboard: '/pros' },
  { id: 'آژانس املاک', name: 'آژانس املاک', dashboard: '/agency' },
  { id: 'سازنده / انبوه‌ساز', name: 'سازنده / انبوه‌ساز', dashboard: '/builder' },
]

export default function AuthModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [tab, setTab] = useState<Tab>('phone')
  const [phone, setPhone] = useState('')
  const [otpStep, setOtpStep] = useState<OtpStep>('enter-phone')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [name, setName] = useState('')
  const [nameVerified, setNameVerified] = useState(false)
  // شاهکار
  const [nid, setNid] = useState('')
  const [by, setBy] = useState(''); const [bm, setBm] = useState(''); const [bd, setBd] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [roles, setRoles] = useState(FALLBACK_ROLES)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onOpen = (e: Event) => { setReason((e as CustomEvent).detail?.reason || ''); setOpen(true); setError(''); setOtpStep('enter-phone'); setTab('phone'); setCode(''); setNameVerified(false); setNid(''); setBy(''); setBm(''); setBd('') }
    window.addEventListener('mj-open-auth', onOpen)
    return () => window.removeEventListener('mj-open-auth', onOpen)
  }, [])
  useEffect(() => { if (open && roles === FALLBACK_ROLES) fetch('/api/roles').then(r => r.ok ? r.json() : null).then(d => { if (d?.roles?.length) setRoles(d.roles) }).catch(() => {}) }, [open, roles])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])

  const success = () => { setOpen(false); window.dispatchEvent(new CustomEvent('mj-auth-success')) }
  function startCountdown() { setCountdown(120); const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 }), 1000) }

  async function sendOTP() {
    setError(''); if (!/^09[0-9]{9}$/.test(phone)) { setError('شماره موبایل معتبر نیست — مثال: 09123456789'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/phone-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'خطا'); return }
      if (data.needsShahkar) { setOtpStep('shahkar'); return }  // کاربرِ جدید → تأییدِ هویتِ شاهکار
      setOtpStep('enter-code'); setCode(data.code || ''); setDevCode(data.dev ? (data.code || '') : ''); startCountdown()
    } catch { setError('خطا در اتصال به سرور') } finally { setLoading(false) }
  }
  async function submitShahkar() {
    setError('')
    const y = faToEn(by).replace(/\D/g, ''), m = faToEn(bm).replace(/\D/g, ''), d = faToEn(bd).replace(/\D/g, '')
    if (y.length !== 4 || !m || !d) { setError('تاریخ تولدِ شمسی را کامل وارد کنید (سال/ماه/روز).'); return }
    const jbd = y + m.padStart(2, '0') + d.padStart(2, '0')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/shahkar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, nationalCode: nid, jBirthDate: jbd }) })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'خطا در تأییدِ هویت'); return }
      setName(data.name || ''); setNameVerified(true)
      setOtpStep('enter-code'); setCode(data.code || ''); setDevCode(data.dev ? (data.code || '') : ''); startCountdown()
    } catch { setError('خطا در اتصال به سرور') } finally { setLoading(false) }
  }
  async function resend() {
    setError('')
    try { const r = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) }); const d = await r.json(); if (d.dev) setDevCode(d.code || ''); startCountdown() } catch {}
  }
  async function verifyOTP() {
    setError(''); if (code.length !== 6) { setError('کد ۶ رقمی را وارد کنید'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'کد اشتباه است'); return }
      if (data.token) { try { localStorage.setItem('mj_token', data.token) } catch {} }
      if (data.role === 'super_admin') { setOpen(false); router.push('/admin'); return }
      if (data.needsOnboarding) { if (data.name) setName(data.name); if (data.nameVerified) setNameVerified(true); setOtpStep('onboard'); return }
      success()
    } catch { setError('خطا در اتصال به سرور') } finally { setLoading(false) }
  }
  async function submitOnboarding() {
    setError(''); if (!name.trim()) { setError('نام خود را وارد کنید'); return } if (!selectedRole) { setError('نقش خود را انتخاب کنید'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), role: selectedRole }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'خطا'); return }
      success() // روی همان صفحه می‌ماند؛ کاربر به جایی که بود برمی‌گردد
    } catch { setError('خطا در اتصال به سرور') } finally { setLoading(false) }
  }
  async function loginEmail() {
    setError(''); if (!email || !password) { setError('ایمیل و رمز عبور را وارد کنید'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'ایمیل یا رمز اشتباه است'); return }
      if (data.token) { try { localStorage.setItem('mj_token', data.token) } catch {} }
      if (data.role === 'super_admin') { setOpen(false); router.push('/admin'); return }
      success()
    } catch { setError('خطا در اتصال به سرور') } finally { setLoading(false) }
  }

  if (!open) return null
  const inp: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box', direction: 'ltr', textAlign: 'right', fontFamily: 'Vazirmatn, sans-serif' }
  const lab: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 7, fontWeight: 500 }
  const btn: React.CSSProperties = { width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold),var(--gold2))', color: '#16140f', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4, opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }
  const errBox = error && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(220,53,69,.1)', border: '1px solid rgba(220,53,69,.25)', color: '#e25563', fontSize: 13 }}>{error}</div>

  return (
    <div dir="rtl" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'mjFade .2s ease', fontFamily: 'Vazirmatn, sans-serif' }}>
      <style>{`@keyframes mjFade{from{opacity:0}to{opacity:1}}@keyframes mjPop{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line2)', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)', overflow: 'hidden', animation: 'mjPop .25s cubic-bezier(.2,.8,.2,1)' }}>
        {/* سربرگِ جذاب */}
        <div style={{ position: 'relative', padding: '26px 26px 22px', background: 'linear-gradient(135deg,#1a1a2e,#16213e 55%,#0f3460)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, insetInlineEnd: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(212,175,55,.22),transparent 70%)' }} />
          <button onClick={() => setOpen(false)} aria-label="بستن" style={{ position: 'absolute', top: 14, insetInlineStart: 14, width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(0,0,0,.25)', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 30, fontWeight: 900, background: 'linear-gradient(135deg,var(--gold),var(--gold2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-.5px' }}>ملک‌جت</div>
            <div style={{ color: 'rgba(255,255,255,.82)', fontSize: 14, marginTop: 6, fontWeight: 600 }}>{reason || 'ورود یا ثبت‌نام'}</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 3 }}>سریع، با شمارهٔ موبایل — بدونِ نیاز به رمز</div>
          </div>
        </div>

        <div style={{ padding: '22px 24px 24px' }}>
          <div style={{ display: 'flex', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)', padding: 4, marginBottom: 22, gap: 4 }}>
            {([['phone', 'ورود / ثبت‌نام'], ['email', 'ورود با ایمیل']] as const).map(([t, label]) => (
              <button key={t} onClick={() => { setTab(t); setError(''); setOtpStep('enter-phone') }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: tab === t ? 'linear-gradient(135deg,var(--gold),var(--gold2))' : 'transparent', color: tab === t ? '#16140f' : 'var(--muted)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
            ))}
          </div>

          {tab === 'phone' && otpStep === 'enter-phone' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={lab}>شماره موبایل</label>
                <input type="tel" inputMode="numeric" placeholder="09xxxxxxxxx" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} onKeyDown={e => e.key === 'Enter' && sendOTP()} style={inp} autoFocus />
                <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>کد تایید ۶ رقمی به این شماره ارسال می‌شود</p>
              </div>
              {errBox}
              <button onClick={sendOTP} disabled={loading} style={btn}>{loading ? 'در حال بررسی…' : 'ادامه'}</button>
            </>
          )}
          {tab === 'phone' && otpStep === 'shahkar' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <button onClick={() => { setOtpStep('enter-phone'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22 }}>←</button>
                <div><p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 700 }}>تأییدِ هویت (سامانهٔ شاهکار)</p><p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '3px 0 0' }}>برای ثبت‌نام، هویتت با ثبت‌احوال و شاهکار راستی‌آزمایی می‌شود.</p></div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lab}>کد ملی</label>
                <input type="tel" inputMode="numeric" placeholder="کد ملی ۱۰ رقمی" value={nid} onChange={e => setNid(e.target.value.replace(/\D/g, '').slice(0, 10))} style={{ ...inp, textAlign: 'center', letterSpacing: 2 }} autoFocus />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={lab}>تاریخ تولد (شمسی)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
                  <input type="tel" inputMode="numeric" placeholder="سال ۱۳۷۰" value={by} onChange={e => setBy(e.target.value.replace(/\D/g, '').slice(0, 4))} style={{ ...inp, textAlign: 'center' }} />
                  <input type="tel" inputMode="numeric" placeholder="ماه" value={bm} onChange={e => setBm(e.target.value.replace(/\D/g, '').slice(0, 2))} style={{ ...inp, textAlign: 'center' }} />
                  <input type="tel" inputMode="numeric" placeholder="روز" value={bd} onChange={e => setBd(e.target.value.replace(/\D/g, '').slice(0, 2))} style={{ ...inp, textAlign: 'center' }} />
                </div>
              </div>
              {errBox}
              <button onClick={submitShahkar} disabled={loading} style={btn}>{loading ? 'در حال راستی‌آزمایی…' : 'تأیید هویت و دریافت کد'}</button>
            </>
          )}
          {tab === 'phone' && otpStep === 'enter-code' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <button onClick={() => { setOtpStep('enter-phone'); setCode(''); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22 }}>←</button>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>کد ارسال‌شده به <strong style={{ color: 'var(--text)' }}>{phone}</strong></p>
              </div>
              {devCode && <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 13 }}>کد ورود شما:<strong style={{ display: 'block', fontSize: 26, letterSpacing: 8, textAlign: 'center', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>{devCode}</strong></div>}
              <div style={{ marginBottom: 16 }}>
                <label style={lab}>کد تایید ۶ رقمی</label>
                <input type="tel" inputMode="numeric" placeholder="_ _ _ _ _ _" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && verifyOTP()} style={{ ...inp, fontSize: 24, textAlign: 'center', letterSpacing: 8, fontFamily: 'JetBrains Mono, monospace' }} autoFocus />
              </div>
              {errBox}
              <button onClick={verifyOTP} disabled={loading} style={btn}>{loading ? 'در حال تایید…' : 'تایید و ورود'}</button>
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>{countdown > 0 ? <span>ارسال مجدد پس از {countdown} ثانیه</span> : <button onClick={resend} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>ارسال مجدد کد</button>}</div>
            </>
          )}
          {tab === 'phone' && otpStep === 'onboard' && (
            <>
              <div style={{ marginBottom: 16 }}><p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 4px' }}>به ملک‌جت خوش آمدی! 🎉</p><p style={{ fontSize: 12.5, color: 'var(--faint)', margin: 0 }}>نام و نقشت را انتخاب کن.</p></div>
              <div style={{ marginBottom: 16 }}><label style={lab}>نام و نام خانوادگی {nameVerified && <span style={{ color: '#5fd98a', fontSize: 11 }}>✓ تأییدشده با شاهکار</span>}</label><input value={name} onChange={e => setName(e.target.value)} readOnly={nameVerified} placeholder="مثلاً علی رضایی" style={{ ...inp, direction: 'rtl', textAlign: 'right', opacity: nameVerified ? 0.8 : 1 }} autoFocus={!nameVerified} /></div>
              <div style={{ marginBottom: 16 }}>
                <label style={lab}>نقش شما</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {roles.map(r => <button key={r.id} onClick={() => setSelectedRole(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, textAlign: 'right', border: `1px solid ${selectedRole === r.id ? 'var(--gold)' : 'var(--line)'}`, background: selectedRole === r.id ? 'var(--goldDim)' : 'var(--bg2)', color: selectedRole === r.id ? 'var(--gold)' : 'var(--text)', fontWeight: selectedRole === r.id ? 700 : 500 }}><span style={{ fontSize: 16 }}>{ROLE_ICONS[r.dashboard] || '◆'}</span>{r.name}</button>)}
                </div>
              </div>
              {errBox}
              <button onClick={submitOnboarding} disabled={loading} style={btn}>{loading ? 'در حال ثبت…' : 'تکمیل ثبت‌نام و ورود'}</button>
            </>
          )}
          {tab === 'email' && (
            <>
              <div style={{ marginBottom: 16 }}><label style={lab}>ایمیل</label><input type="email" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && loginEmail()} style={{ ...inp, direction: 'ltr', textAlign: 'left' }} autoFocus /></div>
              <div style={{ marginBottom: 16 }}><label style={lab}>رمز عبور</label><input type="password" placeholder="رمز عبور" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && loginEmail()} style={inp} /></div>
              {errBox}
              <button onClick={loginEmail} disabled={loading} style={btn}>{loading ? 'در حال ورود…' : 'ورود به حساب'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// کمکی برای باز کردنِ پاپ‌آپ از هر جای سایت
export function openAuth(reason?: string) { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mj-open-auth', { detail: { reason } })) }
