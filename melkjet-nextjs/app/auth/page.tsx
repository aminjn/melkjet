'use client';

import { useState } from 'react';
import Nav from '@/app/components/Nav';
import Footer from '@/app/components/Footer';

type AuthMode = 'login' | 'register';
type LoginTab = 'password' | 'sms';

const ROLES = [
  'خریدار',
  'مشاور',
  'آژانس',
  'سازنده',
  'مالک',
  'مستاجر',
  'سرمایه‌گذار',
  'ارزیاب',
  'حقوقی',
  'مدیریت',
  'پشتیبانی',
  'عکاس',
  'بازاریاب',
];

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginTab, setLoginTab] = useState<LoginTab>('password');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [rememberMe, setRememberMe] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPhone, setLoginPhone] = useState('');

  // Register form state
  const [fullName, setFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid var(--line)',
    background: 'var(--bg2)',
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    direction: 'rtl',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    color: 'var(--muted)',
    marginBottom: 6,
    fontWeight: 500,
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: 16,
  };

  const btnPrimaryStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.5px',
    transition: 'opacity 0.2s',
    marginTop: 4,
  };

  const socialBtnStyle: React.CSSProperties = {
    flex: 1,
    padding: '11px',
    borderRadius: 10,
    border: '1px solid var(--line)',
    background: 'var(--bg2)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.2s',
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <Nav />

      <main style={{ flex: 1, display: 'flex', alignItems: 'stretch', minHeight: 'calc(100vh - 120px)' }}>
        {/* Left branding panel */}
        <div
          style={{
            flex: '0 0 42%',
            background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '60px 48px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative circle */}
          <div style={{
            position: 'absolute',
            top: -80,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            bottom: -60,
            right: -60,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Logo */}
          <div style={{ marginBottom: 32, position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 42,
              fontWeight: 900,
              background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-1px',
              lineHeight: 1,
            }}>
              MelkJet
            </div>
            <div style={{ color: 'var(--gold)', fontSize: 13, marginTop: 4, opacity: 0.8, letterSpacing: 2 }}>
              ✦ پلتفرم هوشمند ملک
            </div>
          </div>

          {/* Tagline */}
          <h2 style={{
            color: '#fff',
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.6,
            marginBottom: 12,
            position: 'relative',
            zIndex: 1,
          }}>
            خرید، فروش و اجاره ملک
            <br />
            <span style={{ color: 'var(--gold)' }}>با اطمینان کامل</span>
          </h2>

          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.8, marginBottom: 40, position: 'relative', zIndex: 1 }}>
            بزرگ‌ترین بازار آنلاین ملک ایران با هزاران آگهی تایید‌شده
          </p>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>
            {[
              { icon: '🏠', text: 'بیش از ۵۰۰ هزار ملک ثبت‌شده' },
              { icon: '✅', text: 'آگهی‌های تایید‌شده و معتبر' },
              { icon: '🤝', text: 'ارتباط مستقیم با مالکان و مشاوران' },
              { icon: '📊', text: 'تحلیل هوشمند قیمت بازار' },
              { icon: '🔒', text: 'امنیت و حفاظت از اطلاعات شما' },
            ].map((item) => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right form panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          background: 'var(--bg)',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 460,
            background: 'var(--surface)',
            borderRadius: 20,
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow)',
            padding: '36px 36px 28px',
          }}>
            {/* Mode toggle header */}
            <div style={{
              display: 'flex',
              borderRadius: 12,
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              padding: 4,
              marginBottom: 28,
              gap: 4,
            }}>
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 9,
                    border: 'none',
                    background: mode === m ? 'linear-gradient(135deg, var(--gold), var(--gold2))' : 'transparent',
                    color: mode === m ? '#fff' : 'var(--muted)',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {m === 'login' ? 'ورود' : 'ثبت‌نام'}
                </button>
              ))}
            </div>

            {mode === 'login' && (
              <>
                {/* SMS / Password tabs */}
                <div style={{ display: 'flex', gap: 0, marginBottom: 22, borderBottom: '1px solid var(--line)' }}>
                  {([['password', 'ورود با رمز'], ['sms', 'ورود با پیامک']] as const).map(([tab, label]) => (
                    <button
                      key={tab}
                      onClick={() => setLoginTab(tab)}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        border: 'none',
                        background: 'transparent',
                        color: loginTab === tab ? 'var(--gold)' : 'var(--muted)',
                        fontSize: 14,
                        fontWeight: loginTab === tab ? 700 : 400,
                        cursor: 'pointer',
                        borderBottom: loginTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
                        marginBottom: -1,
                        transition: 'all 0.2s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {loginTab === 'password' ? (
                  <>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>شماره موبایل یا ایمیل</label>
                      <input
                        type="text"
                        placeholder="09xxxxxxxxx یا example@email.com"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>رمز عبور</label>
                      <input
                        type="password"
                        placeholder="رمز عبور خود را وارد کنید"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          style={{ accentColor: 'var(--gold)', width: 15, height: 15 }}
                        />
                        مرا به خاطر بسپار
                      </label>
                      <a href="#" style={{ color: 'var(--gold)', fontSize: 13, textDecoration: 'none' }}>
                        فراموشی رمز عبور؟
                      </a>
                    </div>
                  </>
                ) : (
                  <div style={fieldStyle}>
                    <label style={labelStyle}>شماره موبایل</label>
                    <input
                      type="tel"
                      placeholder="09xxxxxxxxx"
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      style={inputStyle}
                    />
                    <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>
                      کد تایید به این شماره ارسال خواهد شد
                    </p>
                  </div>
                )}

                <button style={btnPrimaryStyle}>
                  {loginTab === 'sms' ? 'ارسال کد تایید' : 'ورود به حساب'}
                </button>
              </>
            )}

            {mode === 'register' && (
              <>
                <div style={fieldStyle}>
                  <label style={labelStyle}>نام و نام خانوادگی</label>
                  <input
                    type="text"
                    placeholder="مثال: علی محمدی"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>شماره موبایل</label>
                  <input
                    type="tel"
                    placeholder="09xxxxxxxxx"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>ایمیل (اختیاری)</label>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>رمز عبور</label>
                  <input
                    type="password"
                    placeholder="حداقل ۸ کاراکتر"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>تکرار رمز عبور</label>
                  <input
                    type="password"
                    placeholder="رمز عبور را دوباره وارد کنید"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <button style={btnPrimaryStyle}>ایجاد حساب کاربری</button>
              </>
            )}

            {/* Role selection */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, fontWeight: 500 }}>
                نقش خود را انتخاب کنید:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(selectedRole === role ? '' : role)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: `1px solid ${selectedRole === role ? 'var(--gold)' : 'var(--line2)'}`,
                      background: selectedRole === role
                        ? 'linear-gradient(135deg, var(--gold), var(--gold2))'
                        : 'var(--bg2)',
                      color: selectedRole === role ? '#fff' : 'var(--muted)',
                      fontSize: 13,
                      fontWeight: selectedRole === role ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.18s',
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Social login */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
              <p style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center', marginBottom: 14 }}>
                یا با حساب‌های دیگر وارد شوید
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={socialBtnStyle}>
                  <span style={{ fontSize: 18 }}>G</span>
                  گوگل
                </button>
                <button style={socialBtnStyle}>
                  <span style={{ fontSize: 18 }}></span>
                  اپل
                </button>
              </div>
            </div>

            {/* Toggle mode link */}
            <p style={{ textAlign: 'center', marginTop: 22, fontSize: 14, color: 'var(--muted)' }}>
              {mode === 'login' ? 'حساب کاربری ندارید؟' : 'قبلاً ثبت‌نام کرده‌اید؟'}{' '}
              <button
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gold)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {mode === 'login' ? 'ثبت‌نام کنید' : 'وارد شوید'}
              </button>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
