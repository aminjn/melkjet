'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

type Tab = 'phone' | 'email'
type OtpStep = 'enter-phone' | 'shahkar' | 'enter-code' | 'onboard'
const faToEn = (v: string) => (v || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
// مقصدِ بازگشت بعد از ورود (مثلِ صفحه‌ای که برای دیدنِ شماره، کاربر را به ورود فرستاد).
const nextParam = (): string | null => { try { const n = new URLSearchParams(window.location.search).get('next'); return n && n.startsWith('/') ? n : null } catch { return null } }


export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('phone')

  // SMS OTP state
  const [phone, setPhone] = useState('')
  const [otpStep, setOtpStep] = useState<OtpStep>('enter-phone')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState('') // وقتی پیامک تنظیم نشده، کد را اینجا نشان می‌دهیم
  const [countdown, setCountdown] = useState(0)
  // شاهکار
  const [nid, setNid] = useState(''); const [by, setBy] = useState(''); const [bm, setBm] = useState(''); const [bd, setBd] = useState('')
  const [nameVerified, setNameVerified] = useState(false)
  const yRef = useRef<HTMLInputElement>(null); const mRef = useRef<HTMLInputElement>(null); const dRef = useRef<HTMLInputElement>(null)

  // Onboarding state (new users)
  const [name, setName] = useState('')

  // Email state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function startCountdown(secs = 120) {
    setCountdown(secs)
    const t = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 })
    }, 1000)
  }

  async function sendOTP() {
    setError('')
    if (!/^09[0-9]{9}$/.test(phone)) { setError('شماره موبایل معتبر نیست — مثال: 09123456789'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/phone-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const data = await res.json()
      if (!res.ok || data.error) { if (data.retryIn) { setOtpStep('enter-code'); startCountdown(data.retryIn); setError(data.error || '') } else setError(data.error || 'خطا'); return }
      if (data.needsShahkar) { setOtpStep('shahkar'); return }  // کاربرِ جدید/تأییدنشده → احرازِ شاهکار
      setOtpStep('enter-code'); setCode(data.code || ''); setDevCode(data.dev ? (data.code || '') : ''); startCountdown(data.retryIn || 120)
    } catch { setError('خطا در اتصال به سرور') }
    finally { setLoading(false) }
  }
  async function submitShahkar() {
    setError('')
    const y = faToEn(by).replace(/\D/g, ''), m = faToEn(bm).replace(/\D/g, ''), d = faToEn(bd).replace(/\D/g, '')
    if (y.length !== 4 || !m || !d) { setError('تاریخ تولدِ شمسی را کامل وارد کنید.'); return }
    const jbd = y + m.padStart(2, '0') + d.padStart(2, '0')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/shahkar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, nationalCode: nid, jBirthDate: jbd }) })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'خطا در تأییدِ هویت'); return }
      setName(data.name || ''); setNameVerified(true)
      setOtpStep('enter-code'); setCode(data.code || ''); setDevCode(data.dev ? (data.code || '') : ''); startCountdown(data.retryIn || 120)
    } catch { setError('خطا در اتصال به سرور') } finally { setLoading(false) }
  }
  async function resendCode() {
    setError('')
    // فاز ۱۷۰: تایمر فقط وقتی ارسال «واقعاً» انجام شد (ok) یا سرور کولداونِ واقعی داد (retryIn) —
    // قبلاً روی خطای ارسال هم ۱۲۰ ثانیه قفلِ الکی می‌گذاشت و کاربر بی‌دلیل صبر می‌کرد.
    try {
      const r = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const d = await r.json()
      if (d.dev) setDevCode(d.code || '')
      if (d.error) setError(d.error)
      if (d.ok || d.retryIn) startCountdown(d.retryIn || 120)
    } catch { setError('اتصال برقرار نشد — همین حالا دوباره بزن') }
  }

  async function verifyOTP() {
    setError('')
    if (code.length !== 6) { setError('کد ۶ رقمی را وارد کنید'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'کد اشتباه است'); return }
      if (data.token) { try { localStorage.setItem('mj_token', data.token) } catch {} }
      if (data.role === 'super_admin') { router.push('/admin'); return }
      if (data.needsOnboarding) { if (data.name) setName(data.name); if (data.nameVerified) setNameVerified(true); setOtpStep('onboard'); return }   // کاربر جدید → تکمیل پروفایل
      router.push(nextParam() || data.redirect || '/buyer')
    } catch { setError('خطا در اتصال به سرور') }
    finally { setLoading(false) }
  }

  async function submitOnboarding() {
    setError('')
    if (!name.trim()) { setError('نام خود را وارد کنید'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),   // فاز ۱۷۱: نقش بعداً داخلِ پنل انتخاب می‌شود
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'خطا'); return }
      router.push(nextParam() || data.redirect || '/buyer')
    } catch { setError('خطا در اتصال به سرور') }
    finally { setLoading(false) }
  }

  async function loginEmail() {
    setError('')
    if (!email || !password) { setError('ایمیل و رمز عبور را وارد کنید'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'ایمیل یا رمز اشتباه است'); return }
      if (data.token) { try { localStorage.setItem('mj_token', data.token) } catch {} }
      router.push(data.role === 'super_admin' ? '/admin' : (nextParam() || data.redirect || '/buyer'))
    } catch { setError('خطا در اتصال به سرور') }
    finally { setLoading(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 14px', borderRadius: 10,
    border: '1px solid var(--line)', background: 'var(--bg2)',
    color: 'var(--text)', fontSize: 15, outline: 'none',
    boxSizing: 'border-box', direction: 'ltr', textAlign: 'right',
    fontFamily: 'Vazirmatn, sans-serif',
  }
  const fieldStyle: React.CSSProperties = { marginBottom: 16 }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 7, fontWeight: 500 }
  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '13px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg,var(--gold),var(--gold2))',
    color: '#16140f', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    marginTop: 4, opacity: loading ? 0.7 : 1,
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <Nav />

      <main style={{ flex: 1, display: 'flex', alignItems: 'stretch', minHeight: 'calc(100vh - 120px)' }}>

        {/* Left branding panel */}
        <div style={{
          flex: '0 0 42%',
          background: 'linear-gradient(145deg,#1a1a2e 0%,#16213e 40%,#0f3460 100%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          alignItems: 'flex-start', padding: '60px 48px',
          position: 'relative', overflow: 'hidden',
        }} className="mj-auth-panel">
          <div style={{ position: 'absolute', top: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(212,175,55,.15) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(212,175,55,.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ marginBottom: 32, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 42, fontWeight: 900, background: 'linear-gradient(135deg,var(--gold),var(--gold2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-1px', lineHeight: 1 }}>MelkJet</div>
            <div style={{ color: 'var(--gold)', fontSize: 13, marginTop: 4, opacity: 0.8, letterSpacing: 2 }}>✦ پلتفرم هوشمند ملک</div>
          </div>
          <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, lineHeight: 1.6, marginBottom: 12, position: 'relative', zIndex: 1 }}>
            خرید، فروش و اجاره ملک<br />
            <span style={{ color: 'var(--gold)' }}>با اطمینان کامل</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 15, lineHeight: 1.8, marginBottom: 40, position: 'relative', zIndex: 1 }}>
            بزرگ‌ترین بازار آنلاین ملک ایران با هزاران آگهی تایید‌شده
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>
            {[
              { icon: '🏠', text: 'بیش از ۵۰۰ هزار ملک ثبت‌شده' },
              { icon: '✅', text: 'آگهی‌های تایید‌شده و معتبر' },
              { icon: '🤝', text: 'ارتباط مستقیم با مالکان و مشاوران' },
              { icon: '📊', text: 'تحلیل هوشمند قیمت بازار' },
              { icon: '🔒', text: 'امنیت و حفاظت از اطلاعات شما' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 14 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right form panel */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--bg)' }}>
          <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)', boxShadow: 'var(--shadow)', padding: '36px 32px 28px' }}>

            {/* Tabs: ورود با موبایل | ورود با ایمیل */}
            <div style={{ display: 'flex', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)', padding: 4, marginBottom: 28, gap: 4 }}>
              {([['phone', 'ورود / ثبت‌نام'], ['email', 'ورود با ایمیل']] as const).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); setOtpStep('enter-phone') }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 9, border: 'none',
                    background: tab === t ? 'linear-gradient(135deg,var(--gold),var(--gold2))' : 'transparent',
                    color: tab === t ? '#16140f' : 'var(--muted)',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ─── Tab: ورود با موبایل ─── */}
            {tab === 'phone' && (
              <>
                {otpStep === 'enter-phone' ? (
                  <>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>شماره موبایل</label>
                      <input
                        type="tel" inputMode="numeric"
                        placeholder="09xxxxxxxxx"
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,11))}
                        onKeyDown={e => e.key === 'Enter' && sendOTP()}
                        style={inputStyle}
                        autoFocus
                      />
                      <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>
                        کد تایید ۶ رقمی به این شماره ارسال می‌شود
                      </p>
                    </div>
                    {error && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(220,53,69,.1)', border: '1px solid rgba(220,53,69,.25)', color: '#e25563', fontSize: 13 }}>{error}</div>}
                    <button onClick={sendOTP} disabled={loading} style={btnStyle}>
                      {loading ? 'در حال بررسی...' : 'ادامه'}
                    </button>
                  </>
                ) : otpStep === 'shahkar' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <button onClick={() => { setOtpStep('enter-phone'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22, padding: 0 }}>←</button>
                      <div><p style={{ fontSize: 14, color: 'var(--text)', margin: 0, fontWeight: 700 }}>تأییدِ هویت (سامانهٔ شاهکار)</p><p style={{ fontSize: 12, color: 'var(--faint)', margin: '3px 0 0' }}>برای ثبت‌نام، هویتت با ثبت‌احوال و شاهکار راستی‌آزمایی می‌شود.</p></div>
                    </div>
                    <div style={fieldStyle}><label style={labelStyle}>کد ملی</label><input type="tel" inputMode="numeric" placeholder="کد ملی ۱۰ رقمی" value={nid} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setNid(v); if (v.length === 10) yRef.current?.focus() }} style={{ ...inputStyle, textAlign: 'center', letterSpacing: 2 }} autoFocus /></div>
                    <div style={fieldStyle}><label style={labelStyle}>تاریخ تولد (شمسی) — سال / ماه / روز</label><div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8, direction: 'ltr' }}><input ref={yRef} type="tel" inputMode="numeric" placeholder="سال ۱۳۷۰" value={by} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setBy(v); if (v.length === 4) mRef.current?.focus() }} style={{ ...inputStyle, textAlign: 'center' }} /><input ref={mRef} type="tel" inputMode="numeric" placeholder="ماه" value={bm} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); setBm(v); if (v.length === 2) dRef.current?.focus() }} style={{ ...inputStyle, textAlign: 'center' }} /><input ref={dRef} type="tel" inputMode="numeric" placeholder="روز" value={bd} onChange={e => setBd(e.target.value.replace(/\D/g, '').slice(0, 2))} style={{ ...inputStyle, textAlign: 'center' }} /></div></div>
                    {error && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(220,53,69,.1)', border: '1px solid rgba(220,53,69,.25)', color: '#e25563', fontSize: 13 }}>{error}</div>}
                    <button onClick={submitShahkar} disabled={loading} style={btnStyle}>{loading ? 'در حال راستی‌آزمایی...' : 'تأیید هویت و دریافت کد'}</button>
                  </>
                ) : otpStep === 'enter-code' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                      <button onClick={() => { setOtpStep('enter-phone'); setCode(''); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22, padding: 0 }}>←</button>
                      <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                        کد ارسال شده به <strong style={{ color: 'var(--text)' }}>{phone}</strong>
                      </p>
                    </div>
                    {devCode && (
                      <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 13, lineHeight: 1.7 }}>
                        پیامک هنوز فعال نشده — کد ورود شما:
                        <strong style={{ display: 'block', fontSize: 26, letterSpacing: 8, textAlign: 'center', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>{devCode}</strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>برای ارسال پیامک واقعی، IPPanel را در پنل مدیریت تنظیم کنید.</span>
                      </div>
                    )}
                    <div style={fieldStyle}>
                      <label style={labelStyle}>کد تایید ۶ رقمی</label>
                      <input
                        type="tel" inputMode="numeric"
                        placeholder="_ _ _ _ _ _"
                        maxLength={6}
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                        onKeyDown={e => e.key === 'Enter' && verifyOTP()}
                        style={{ ...inputStyle, fontSize: 24, textAlign: 'center', letterSpacing: 8, fontFamily: 'JetBrains Mono, monospace' }}
                        autoFocus
                      />
                    </div>
                    {error && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(220,53,69,.1)', border: '1px solid rgba(220,53,69,.25)', color: '#e25563', fontSize: 13 }}>{error}</div>}
                    <button onClick={verifyOTP} disabled={loading} style={btnStyle}>
                      {loading ? 'در حال تایید...' : 'تایید و ورود'}
                    </button>
                    <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
                      {countdown > 0
                        ? <span>ارسال مجدد پس از {countdown} ثانیه</span>
                        : <button onClick={resendCode} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>ارسال مجدد کد</button>
                      }
                    </div>
                  </>
                ) : (
                  /* ─── Onboarding (new user) — فاز ۱۷۱: فقط نام؛ کسب‌وکار بعداً داخلِ پنل انتخاب می‌شود ─── */
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 4px' }}>به ملک‌جت خوش آمدی! 🎉</p>
                      <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: 0 }}>فقط نامت را بگو — تمام.</p>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>نام و نام خانوادگی {nameVerified && <span style={{ color: '#5fd98a', fontSize: 11 }}>✓ تأییدشده با شاهکار</span>}</label>
                      <input value={name} onChange={e => setName(e.target.value)} readOnly={nameVerified} placeholder="مثلاً علی رضایی" style={{ ...inputStyle, opacity: nameVerified ? 0.85 : 1 }} autoFocus={!nameVerified} />
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '0 0 14px', lineHeight: 1.9 }}>
                      🏢 کسب‌وکار داری (مشاور، آژانس، سازنده…)؟ بعد از ورود، از داخلِ پنلت انتخابش می‌کنی — الان لازم نیست.
                    </p>
                    {error && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(220,53,69,.1)', border: '1px solid rgba(220,53,69,.25)', color: '#e25563', fontSize: 13 }}>{error}</div>}
                    <button onClick={submitOnboarding} disabled={loading} style={btnStyle}>
                      {loading ? 'در حال ثبت...' : 'ورود به ملک‌جت'}
                    </button>
                  </>
                )}
              </>
            )}

            {/* ─── Tab: ورود با ایمیل ─── */}
            {tab === 'email' && (
              <>
                <div style={fieldStyle}>
                  <label style={labelStyle}>ایمیل</label>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loginEmail()}
                    style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }}
                    autoFocus
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>رمز عبور</label>
                  <input
                    type="password"
                    placeholder="رمز عبور خود را وارد کنید"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loginEmail()}
                    style={inputStyle}
                  />
                </div>
                {error && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(220,53,69,.1)', border: '1px solid rgba(220,53,69,.25)', color: '#e25563', fontSize: 13 }}>{error}</div>}
                <button onClick={loginEmail} disabled={loading} style={btnStyle}>
                  {loading ? 'در حال ورود...' : 'ورود به حساب'}
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
