'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

type Tab = 'phone' | 'email'
type OtpStep = 'enter-phone' | 'enter-code' | 'onboard'

const ROLE_ICONS: Record<string, string> = { '/buyer': '🔑', '/owner': '🏠', '/pros': '🤝', '/agency': '🏢', '/builder': '🏗', '/materials': '🧱', '/legal': '⚖' }
const FALLBACK_ROLES = [
  { id: 'خریدار / مستأجر', name: 'خریدار / مستأجر', dashboard: '/buyer' },
  { id: 'فروشنده / مالک', name: 'فروشنده / مالک', dashboard: '/owner' },
  { id: 'مشاور املاک', name: 'مشاور املاک', dashboard: '/pros' },
  { id: 'سازنده / انبوه‌ساز', name: 'سازنده / انبوه‌ساز', dashboard: '/builder' },
]

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('phone')

  // SMS OTP state
  const [phone, setPhone] = useState('')
  const [otpStep, setOtpStep] = useState<OtpStep>('enter-phone')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)

  // Onboarding state (new users)
  const [name, setName] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [roles, setRoles] = useState<{ id: string; name: string; dashboard: string }[]>(FALLBACK_ROLES)
  useEffect(() => { fetch('/api/roles').then(r => r.ok ? r.json() : null).then(d => { if (d?.roles?.length) setRoles(d.roles) }).catch(() => {}) }, [])

  // Email state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function startCountdown() {
    setCountdown(120)
    const t = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 })
    }, 1000)
  }

  async function sendOTP() {
    setError('')
    if (!/^09[0-9]{9}$/.test(phone)) {
      setError('شماره موبایل معتبر نیست — مثال: 09123456789')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'خطا در ارسال پیامک'); return }
      setOtpStep('enter-code')
      setCode('')
      startCountdown()
    } catch { setError('خطا در اتصال به سرور') }
    finally { setLoading(false) }
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
      if (data.role === 'super_admin') { router.push('/admin'); return }
      if (data.needsOnboarding) { setOtpStep('onboard'); return }   // کاربر جدید → تکمیل پروفایل
      router.push(data.redirect || '/buyer')
    } catch { setError('خطا در اتصال به سرور') }
    finally { setLoading(false) }
  }

  async function submitOnboarding() {
    setError('')
    if (!name.trim()) { setError('نام خود را وارد کنید'); return }
    if (!selectedRole) { setError('نقش خود را انتخاب کنید'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), role: selectedRole }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'خطا'); return }
      router.push(data.redirect || '/buyer')
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
      router.push(data.role === 'super_admin' ? '/admin' : (data.redirect || '/buyer'))
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
                      {loading ? 'در حال ارسال...' : 'ارسال کد تایید'}
                    </button>
                  </>
                ) : otpStep === 'enter-code' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                      <button onClick={() => { setOtpStep('enter-phone'); setCode(''); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22, padding: 0 }}>←</button>
                      <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                        کد ارسال شده به <strong style={{ color: 'var(--text)' }}>{phone}</strong>
                      </p>
                    </div>
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
                        : <button onClick={sendOTP} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>ارسال مجدد کد</button>
                      }
                    </div>
                  </>
                ) : (
                  /* ─── Onboarding (new user): name + role ─── */
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 4px' }}>به ملک‌جت خوش آمدی! 🎉</p>
                      <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: 0 }}>برای تکمیل ثبت‌نام، نام و نقشت را انتخاب کن.</p>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>نام و نام خانوادگی</label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="مثلاً علی رضایی" style={inputStyle} autoFocus />
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>نقش شما در ملک‌جت</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {roles.map(r => (
                          <button key={r.id} onClick={() => setSelectedRole(r.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, textAlign: 'right',
                            border: `1px solid ${selectedRole === r.id ? 'var(--gold)' : 'var(--line)'}`,
                            background: selectedRole === r.id ? 'var(--goldDim)' : 'var(--bg2)',
                            color: selectedRole === r.id ? 'var(--gold)' : 'var(--text)', fontWeight: selectedRole === r.id ? 700 : 500,
                          }}><span style={{ fontSize: 16 }}>{ROLE_ICONS[r.dashboard] || '◆'}</span>{r.name}</button>
                        ))}
                      </div>
                    </div>
                    {error && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(220,53,69,.1)', border: '1px solid rgba(220,53,69,.25)', color: '#e25563', fontSize: 13 }}>{error}</div>}
                    <button onClick={submitOnboarding} disabled={loading} style={btnStyle}>
                      {loading ? 'در حال ثبت...' : 'تکمیل ثبت‌نام و ورود'}
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
