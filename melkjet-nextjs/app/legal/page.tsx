'use client'
import { useState } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

interface Message {
  id: number
  role: 'ai' | 'user'
  text: string
  error?: boolean
}

const initialMessages: Message[] = [
  {
    id: 1,
    role: 'ai',
    text: 'سلام! من دستیار حقوقی هوشمند ملک‌جت هستم. می‌توانم در خصوص قراردادها، اسناد مالکیتی، حقوق خریدار و فروشنده و مشاوره حقوقی ملکی کمکتان کنم.',
  },
  {
    id: 2,
    role: 'user',
    text: 'می‌خواهم یک آپارتمان بخرم. چه مدارکی لازم است؟',
  },
  {
    id: 3,
    role: 'ai',
    text: 'برای خرید آپارتمان به مدارک زیر نیاز دارید:\n۱) سند مالکیت تک‌برگ\n۲) استعلام ثبت اسناد\n۳) گواهی عدم خلافی\n۴) کد رهگیری از سامانه هوشمند\n۵) مبایعه‌نامه رسمی\n\nآیا سوال دیگری دارید؟',
  },
]

const quickChips = ['سند مالکیت', 'قرارداد اجاره', 'مشاوره خرید', 'حقوق مستاجر']

const strategies = [
  {
    id: 'aggressive',
    label: 'تهاجمی',
    icon: '⚡',
    desc: 'پیشنهاد ۱۵٪ زیر قیمت',
    percentage: 85,
    color: '#ef4444',
    tip: 'مناسب برای بازار راکد یا ملک با مدت طولانی فروش‌نرفته',
  },
  {
    id: 'conservative',
    label: 'محافظه‌کارانه',
    icon: '🛡',
    desc: 'پیشنهاد ۵٪ زیر قیمت',
    percentage: 95,
    color: '#3b82f6',
    tip: 'مناسب برای ملک پرتقاضا یا فروشنده با قیمت منصفانه',
  },
  {
    id: 'smart',
    label: 'هوشمند',
    icon: '✦',
    desc: 'پیشنهاد ۱۰٪ زیر قیمت + شرایط پرداخت',
    percentage: 90,
    color: '#f59e0b',
    tip: 'ترکیب تخفیف معقول با شرایط پرداخت انعطاف‌پذیر',
  },
]

function getAcceptanceData(pct: number): { prob: number; color: string; label: string; strategy: string } {
  if (pct >= 100) return { prob: 95, color: '#22c55e', label: 'بسیار بالا', strategy: 'پیشنهاد شما بالاتر یا برابر قیمت درخواستی است. احتمال پذیرش بسیار زیاد است.' }
  if (pct >= 95) return { prob: 80, color: '#22c55e', label: 'بالا', strategy: 'پیشنهاد معقول با احتمال پذیرش بالا. فروشنده احتمالاً با مذاکره جزئی موافقت می‌کند.' }
  if (pct >= 90) return { prob: 62, color: '#f59e0b', label: 'متوسط', strategy: 'فاصله مناسب برای مذاکره. می‌توانید با ارائه شرایط پرداخت بهتر احتمال پذیرش را افزایش دهید.' }
  if (pct >= 85) return { prob: 40, color: '#f97316', label: 'پایین', strategy: 'پیشنهاد چالش‌برانگیز است. پیشنهاد می‌شود دلایل قوی برای توجیه قیمت داشته باشید.' }
  return { prob: 18, color: '#ef4444', label: 'بسیار پایین', strategy: 'احتمال رد شدن بسیار زیاد است. این استراتژی فقط در بازارهای راکد یا ملک‌های مشکل‌دار توصیه می‌شود.' }
}

function formatRial(n: number): string {
  return n.toLocaleString('fa-IR') + ' ریال'
}

export default function LegalPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [offerPct, setOfferPct] = useState(90)
  const [selectedStrategy, setSelectedStrategy] = useState<string>('smart')

  const propertyValue = 4_500_000_000

  const sendMessage = async (text: string) => {
    const q = text.trim()
    if (!q || loading) return
    const userMsg: Message = { id: Date.now(), role: 'user', text: q }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'chat',
          input: `به‌عنوان مشاور حقوقی املاک پاسخ بده: ${q}`,
        }),
      })
      const d: { ok?: boolean; text?: string; error?: string } = await res.json().catch(() => ({}))
      if (d.ok && d.text) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: d.text as string }])
      } else {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'ai',
          text: d.error || 'خطا در دریافت پاسخ. لطفاً دوباره تلاش کنید.',
          error: true,
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: 'خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.',
        error: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleChip = (chip: string) => sendMessage(chip)

  const handleStrategy = (strat: typeof strategies[0]) => {
    setSelectedStrategy(strat.id)
    setOfferPct(strat.percentage)
  }

  const offerAmount = Math.round((propertyValue * offerPct) / 100)
  const counterOffer = Math.round(propertyValue * 0.975)
  const acceptance = getAcceptanceData(offerPct)

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
      <Nav />

      {/* Page Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg2) 100%)',
        borderBottom: '1px solid var(--line)',
        padding: '2.5rem 2rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>⚖️</span>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            دستیار حقوقی
          </h1>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '1rem', margin: 0 }}>
          مشاوره حقوقی هوشمند و موتور مذاکره ملکی
        </p>
      </div>

      {/* Two-column layout */}
      <div className="mjl-2col" style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
        alignItems: 'start',
      }}>

        {/* LEFT COLUMN: Legal Chat */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: '1rem',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow)',
          minHeight: '680px',
        }}>
          {/* Chat Header */}
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.1rem', color: 'var(--gold)' }}>✦</span>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>دستیار حقوقی</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#22c55e',
                display: 'inline-block',
                boxShadow: '0 0 0 0 rgba(34,197,94,0.4)',
                animation: 'pulse-green 2s infinite',
              }} />
              <span style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 500 }}>آنلاین</span>
            </div>
          </div>

          {/* Chat messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            minHeight: '340px',
            maxHeight: '420px',
          }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
                gap: '0.6rem',
                alignItems: 'flex-end',
              }}>
                {msg.role === 'ai' && (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', flexShrink: 0, fontWeight: 700, color: '#000',
                  }}>
                    ✦
                  </div>
                )}
                <div style={{
                  maxWidth: '75%',
                  padding: '0.75rem 1rem',
                  borderRadius: msg.role === 'ai'
                    ? '0.75rem 0.75rem 0.75rem 0.1rem'
                    : '0.75rem 0.75rem 0.1rem 0.75rem',
                  background: msg.role === 'ai'
                    ? (msg.error ? 'rgba(239,68,68,0.12)' : 'var(--bg2)')
                    : 'linear-gradient(135deg, var(--gold), var(--gold2))',
                  color: msg.role === 'ai' ? (msg.error ? '#ef4444' : 'var(--text)') : '#000',
                  fontSize: '0.875rem',
                  lineHeight: '1.7',
                  border: msg.role === 'ai' ? `1px solid ${msg.error ? '#ef4444' : 'var(--line)'}` : 'none',
                  whiteSpace: 'pre-line',
                  fontWeight: msg.role === 'user' ? 600 : 400,
                }}>
                  {msg.text}
                </div>
                {msg.role === 'user' && (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'var(--line2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', flexShrink: 0,
                  }}>
                    👤
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', alignItems: 'flex-end' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', flexShrink: 0, fontWeight: 700, color: '#000',
                }}>
                  ✦
                </div>
                <div style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '0.75rem 0.75rem 0.75rem 0.1rem',
                  background: 'var(--bg2)',
                  border: '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--gold)', animation: 'typing-dot 1.2s infinite', animationDelay: '0s' }} />
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--gold)', animation: 'typing-dot 1.2s infinite', animationDelay: '0.2s' }} />
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--gold)', animation: 'typing-dot 1.2s infinite', animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
          </div>

          {/* Quick chips */}
          <div style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            {quickChips.map(chip => (
              <button
                key={chip}
                onClick={() => handleChip(chip)}
                disabled={loading}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '999px',
                  border: '1px solid var(--gold)',
                  background: 'transparent',
                  color: 'var(--gold)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#000'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--gold)'
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            gap: '0.65rem',
            background: 'var(--bg2)',
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              disabled={loading}
              placeholder="سوال حقوقی خود را بنویسید..."
              style={{
                flex: 1,
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: '0.6rem',
                padding: '0.65rem 1rem',
                color: 'var(--text)',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                outline: 'none',
                direction: 'rtl',
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
                border: 'none',
                borderRadius: '0.6rem',
                padding: '0 1.1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                color: '#000',
                fontSize: '1.1rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ↩
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Negotiation Engine */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          {/* Header card */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '1rem',
            padding: '1.25rem',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🤝</span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>موتور مذاکره</h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
              پیشنهاد بهینه خود را با کمک هوش مصنوعی تنظیم کنید
            </p>
          </div>

          {/* Property value + slider */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '1rem',
            padding: '1.25rem',
            boxShadow: 'var(--shadow)',
          }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>
              ارزش ملک
            </label>
            <div style={{
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
              borderRadius: '0.6rem',
              padding: '0.65rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--gold)',
              marginBottom: '1.25rem',
              letterSpacing: '0.01em',
            }}>
              ۴٬۵۰۰٬۰۰۰٬۰۰۰ ریال
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                قیمت پیشنهادی شما
              </label>
              <span style={{
                background: 'var(--goldDim)',
                color: 'var(--gold)',
                borderRadius: '999px',
                padding: '0.15rem 0.7rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: '1px solid var(--gold)',
              }}>
                {offerPct}٪
              </span>
            </div>

            <input
              type="range"
              min={80}
              max={110}
              value={offerPct}
              onChange={e => { setOfferPct(Number(e.target.value)); setSelectedStrategy('') }}
              style={{
                width: '100%',
                accentColor: 'var(--gold)',
                cursor: 'pointer',
                height: '4px',
                marginBottom: '0.75rem',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--faint)', marginBottom: '0.5rem' }}>
              <span>۸۰٪</span>
              <span>۱۰۰٪</span>
              <span>۱۱۰٪</span>
            </div>

            <div style={{
              background: 'var(--bg2)',
              borderRadius: '0.6rem',
              padding: '0.65rem 1rem',
              fontSize: '0.9rem',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              fontWeight: 600,
            }}>
              مبلغ پیشنهاد: <span style={{ color: 'var(--gold)' }}>{formatRial(offerAmount)}</span>
            </div>
          </div>

          {/* AI Analysis */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '1rem',
            padding: '1.25rem',
            boxShadow: 'var(--shadow)',
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
              تحلیل هوش مصنوعی
            </h3>

            {/* Acceptance probability */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.85rem',
              padding: '0.75rem 1rem',
              background: 'var(--bg2)',
              borderRadius: '0.6rem',
              border: '1px solid var(--line)',
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>احتمال پذیرش پیشنهاد</span>
              <span style={{
                background: acceptance.color + '22',
                color: acceptance.color,
                border: `1px solid ${acceptance.color}`,
                borderRadius: '999px',
                padding: '0.2rem 0.85rem',
                fontSize: '0.9rem',
                fontWeight: 700,
              }}>
                {acceptance.prob}٪ — {acceptance.label}
              </span>
            </div>

            {/* Strategy text */}
            <div style={{
              fontSize: '0.845rem',
              color: 'var(--muted)',
              lineHeight: '1.8',
              marginBottom: '1rem',
              padding: '0.65rem 0.9rem',
              background: 'var(--bg2)',
              borderRadius: '0.6rem',
              borderRight: '3px solid var(--gold)',
            }}>
              {acceptance.strategy}
            </div>

            {/* Counter-offer suggestion */}
            <div style={{
              border: '1px solid var(--gold)',
              borderRadius: '0.75rem',
              padding: '0.85rem 1rem',
              background: 'var(--goldDim)',
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--gold)', fontWeight: 600, marginBottom: '0.3rem', opacity: 0.85 }}>
                پیشنهاد مقابل پیش‌بینی‌شده
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold)' }}>
                {formatRial(counterOffer)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                بر اساس میانگین مذاکرات مشابه
              </div>
            </div>
          </div>

          {/* Strategy cards */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '1rem',
            padding: '1.25rem',
            boxShadow: 'var(--shadow)',
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
              استراتژی مذاکره
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {strategies.map(strat => {
                const isSelected = selectedStrategy === strat.id
                return (
                  <button
                    key={strat.id}
                    onClick={() => handleStrategy(strat)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.85rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.75rem',
                      border: isSelected ? `1.5px solid ${strat.color}` : '1px solid var(--line)',
                      background: isSelected ? strat.color + '14' : 'var(--bg2)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'right',
                      width: '100%',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '0.5rem',
                      background: strat.color + '22',
                      border: `1px solid ${strat.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1rem', flexShrink: 0,
                    }}>
                      {strat.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: '0.2rem',
                      }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: isSelected ? strat.color : 'var(--text)' }}>
                          {strat.label}
                        </span>
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 600,
                          color: strat.color,
                          background: strat.color + '18',
                          padding: '0.1rem 0.55rem',
                          borderRadius: '999px',
                          border: `1px solid ${strat.color}44`,
                        }}>
                          {strat.percentage}٪
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>
                        {strat.desc}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--faint)' }}>
                        {strat.tip}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          70% { box-shadow: 0 0 0 7px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @media (max-width: 768px) {
          .legal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer />
    </div>
  )
}
