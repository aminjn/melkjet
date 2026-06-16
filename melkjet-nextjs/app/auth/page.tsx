'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { Suspense } from 'react'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: 12,
  border: '1px solid var(--line2)',
  background: 'var(--bg2)',
  color: 'var(--text)',
  fontSize: 16,
  outline: 'none',
  boxSizing: 'border-box',
  direction: 'ltr',
  textAlign: 'right',
  fontFamily: 'Vazirmatn, sans-serif',
  letterSpacing: 1,
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 12,
  border: 'none',
  background: 'linear-gradient(140deg, var(--gold2), var(--gold))',
  color: '#16140f',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 8,
}

function AuthForm() {
  const router = useRouter()
  const params = useSearchParams()
  const nextUrl = params.get('next') || '/'

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)

  function startCountdown() {
    setCountdown(120)
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function sendOTP() {
    setError('')
    if (!/^09[0-9]{9}$/.test(phone)) {
      setError('شماره موبایل معتبر نیست (مثال: 09123456789)')
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
      setStep('code')
      startCountdown()
    } catch {
      setError('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
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
      if (data.role === 'super_admin') {
        router.push('/admin')
      } else {
        router.push(nextUrl)
      }
    } catch {
      setError('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <Nav />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        {/* Branding panel hidden on mobile */}
        <div className="mj-auth-brand" style={{
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'linear-gradient(145deg,#1a1a2e,#16213e,#0f3460)',
          borderRadius: 24,
          padding: '60px 48px',
          marginLeft: 32,
          width: 360,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -80, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,168,76,.18) 0%,transparent 70%)' }} />
          <div style={{ fontSize: 38, fontWeight: 900, background: 'linear-gradient(135deg,var(--gold),var(--gold2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 8 }}>ملک‌جت</div>
          <div style={{ color: 'var(--gold)', fontSize: 12, marginBottom: 28, opacity: 0.8, letterSpacing: 2 }}>✦ پلتفرم هوشمند ملک</div>
          <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.7, marginBottom: 32 }}>
            خرید، فروش و اجاره ملک<br />
            <span style={{ color: 'var(--gold)' }}>با اطمینان کامل</span>
          </h2>
          {[
            '🏠 بیش از ۵۰۰ هزار ملک ثبت‌شده',
            '✅ آگهی‌های تایید‌شده و معتبر',
            '🤝 ارتباط مستقیم با مالک',
            '📊 تحلیل هوشمند قیمت بازار',
            '🔒 امنیت کامل اطلاعات شما',
          ].map(t => (
            <div key={t} style={{ color: 'rgba(255,255,255,.75)', fontSize: 14, marginBottom: 14 }}>{t}</div>
          ))}
        </div>

        {/* Form card */}
        <div style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--surface)',
          borderRadius: 20,
          border: '1px solid var(--line)',
          padding: '36px 32px 28px',
          boxShadow: 'var(--shadow)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 14, height: 14, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 2 }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 20 }}>ملک‌جت</span>
          </div>

          {step === 'phone' ? (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>ورود به حساب</h1>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
                شماره موبایل خود را وارد کنید — اگر حساب ندارید خودکار ثبت می‌شوید
              </p>

              <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>
                شماره موبایل
              </label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="09xxxxxxxxx"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                onKeyDown={e => e.key === 'Enter' && sendOTP()}
                style={inputStyle}
                autoFocus
              />

              {error && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(220,53,69,.12)', border: '1px solid rgba(220,53,69,.3)', color: '#e25563', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button onClick={sendOTP} disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'در حال ارسال...' : 'ارسال کد تایید'}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <button onClick={() => { setStep('phone'); setCode(''); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>←</button>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 800 }}>کد تایید</h1>
                  <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>کد ارسال شده به {phone} را وارد کنید</p>
                </div>
              </div>

              <input
                type="tel"
                inputMode="numeric"
                placeholder="_ _ _ _ _ _"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && verifyOTP()}
                style={{ ...inputStyle, fontSize: 24, textAlign: 'center', letterSpacing: 8, fontFamily: 'JetBrains Mono, monospace' }}
                autoFocus
              />

              {error && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(220,53,69,.12)', border: '1px solid rgba(220,53,69,.3)', color: '#e25563', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button onClick={verifyOTP} disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'در حال تایید...' : 'تایید و ورود'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
                {countdown > 0 ? (
                  <span>ارسال مجدد کد پس از {countdown} ثانیه</span>
                ) : (
                  <button onClick={sendOTP} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}>
                    ارسال مجدد کد
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  )
}
