'use client'
import { useState } from 'react'
import Link from 'next/link'
import PanelReturnBar from '@/app/components/PanelReturnBar'

import ArticleEditor from '@/app/components/ArticleEditor'

export type MarketingView = 'overview' | 'email' | 'sms' | 'social' | 'articles' | 'reports'

// Sidebar nav entries (one per view). Persian labels/icons match the standalone /marketing sidebar.
export const MARKETING_VIEWS: { id: MarketingView; label: string; icon: string }[] = [
  { id: 'overview', icon: '◍', label: 'داشبورد' },
  { id: 'email', icon: '✉', label: 'کمپین ایمیل' },
  { id: 'sms', icon: '✆', label: 'پیامک' },
  { id: 'social', icon: '◈', label: 'شبکه اجتماعی' },
  { id: 'articles', icon: '✎', label: 'مقالات' },
  { id: 'reports', icon: '◎', label: 'گزارش‌ها' },
]

const kpis = [
  { l: 'ایمیل ارسالی', v: '۰', t: 'هنوز کمپینی ارسال نشده', tc: 'var(--muted)', ic: '✉', bg: 'rgba(95,217,138,0.12)', c: '#5fd98a' },
  { l: 'نرخ بازشدن', v: '—', t: 'پس از ارسالِ کمپین', tc: 'var(--muted)', ic: '◎', bg: 'var(--goldDim)', c: 'var(--gold)' },
  { l: 'نرخ کلیک', v: '—', t: 'پس از ارسالِ کمپین', tc: 'var(--muted)', ic: '◈', bg: 'rgba(91,155,213,0.12)', c: '#5b9bd5' },
  { l: 'تبدیل‌ها', v: '۰', t: 'هنوز تبدیلی ثبت نشده', tc: 'var(--muted)', ic: '◴', bg: 'rgba(95,217,138,0.12)', c: '#5fd98a' },
]

const weeklyOpen: number[] = []
const weeklyClick: number[] = []
const weekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']

const recentActivities: { text: string; time: string; ic: string; c: string }[] = []

const emailCampaigns: { name: string; status: string; statusColor: string; recipients: string; openRate: string; clickRate: string; date: string }[] = []

const smsCampaigns: { name: string; status: string; statusColor: string; recipients: string; delivered: number; date: string }[] = []

const socialPlatforms = [
  { name: 'اینستاگرام', ic: '◉', followers: '۰', engagement: 0, engStr: '—', posts: '۰', color: '#e056a0' },
  { name: 'لینکدین', ic: '◈', followers: '۰', engagement: 0, engStr: '—', posts: '۰', color: '#5b9bd5' },
  { name: 'توییتر', ic: '◆', followers: '۰', engagement: 0, engStr: '—', posts: '۰', color: '#62aee8' },
]

const scheduledDays = new Set([3, 7, 10, 14, 17, 21, 24, 28])
const calDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

const funnelSteps = [
  { label: 'بازدید', value: 0, pct: 0 },
  { label: 'لید', value: 0, pct: 0 },
  { label: 'تماس', value: 0, pct: 0 },
  { label: 'معامله', value: 0, pct: 0 },
]

const roiCards = [
  { label: 'بازگشت سرمایه بازاریابی', value: '—', sub: 'پس از ثبتِ هزینه و درآمد' },
  { label: 'هزینه جذب لید', value: '—', sub: 'میانگین هزینه هر لید' },
  { label: 'ارزش طول عمر مشتری', value: '—', sub: 'میانگین ارزش هر مشتری' },
  { label: 'نرخ تبدیل کلی', value: '—', sub: 'از بازدید تا معامله' },
]

const viewTitles: Record<MarketingView, string> = {
  overview: 'داشبورد بازاریابی',
  email: 'کمپین‌های ایمیل',
  sms: 'کمپین‌های پیامکی',
  social: 'شبکه‌های اجتماعی',
  articles: 'مقالات و وبلاگ',
  reports: 'گزارش‌های بازاریابی',
}

const channelPerf = [
  { label: 'ایمیل', value: 48, color: 'var(--gold)', stat: '۳۲٪ نرخ بازشدن' },
  { label: 'پیامک', value: 35, color: '#5fd98a', stat: '۹۵٪ نرخ تحویل' },
  { label: 'اینستاگرام', value: 62, color: '#e056a0', stat: '۴٫۸٪ تعامل' },
  { label: 'لینکدین', value: 41, color: '#5b9bd5', stat: '۶٫۲٪ تعامل' },
  { label: 'توییتر', value: 28, color: '#62aee8', stat: '۳٫۱٪ تعامل' },
]

function buildPolyline(
  data: number[],
  maxVal: number,
  w: number,
  h: number,
  padX: number,
  padY: number,
): string {
  return data
    .map((v, i) => {
      const x = padX + (i / (data.length - 1)) * (w - padX * 2)
      const y = padY + (1 - v / maxVal) * (h - padY * 2)
      return `${x},${y}`
    })
    .join(' ')
}

export default function MarketingTool({ embedded = false, view: viewProp, onView }: { embedded?: boolean; view?: MarketingView; onView?: (v: MarketingView) => void }) {
  const [internalView, setInternalView] = useState<MarketingView>('overview')
  const activeView: MarketingView = viewProp ?? internalView
  const setActiveView = (v: MarketingView) => { onView ? onView(v) : setInternalView(v) }
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [emailTitle, setEmailTitle] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState('')

  const sendEmail = async () => {
    if (emailSending) return
    if (!emailSubject.trim()) { setEmailResult('⚠ موضوع ایمیل را وارد کنید'); return }
    if (!emailBody.trim()) { setEmailResult('⚠ متن ایمیل را بنویسید'); return }
    if (!emailTo.trim()) { setEmailResult('⚠ ایمیل گیرندگان را وارد کنید'); return }
    setEmailSending(true); setEmailResult('')
    try {
      const r = await fetch('/api/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: emailTo, subject: emailSubject, body: emailBody }),
      })
      const d = await r.json()
      setEmailResult(d.ok ? `✓ ایمیل به ${d.sent} گیرنده ارسال شد` : `⚠ ${d.error || 'خطا'}`)
      if (d.ok) { setEmailBody(''); setEmailTo(''); setEmailSubject('') }
    } catch { setEmailResult('⚠ خطا در ارتباط با سرور') }
    finally { setEmailSending(false) }
  }
  const [smsNumbers, setSmsNumbers] = useState('')
  const [smsText, setSmsText] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsResult, setSmsResult] = useState('')
  const [composing, setComposing] = useState('')

  // نوشتن متن کمپین با هوش مصنوعی
  const composeAi = async (kind: 'sms' | 'email') => {
    if (composing) return
    const topic = window.prompt(kind === 'sms' ? 'موضوع پیامک تبلیغاتی چیست؟ (مثلاً: تخفیف ویژهٔ مشاوره)' : 'موضوع ایمیل کمپین چیست؟')
    if (!topic || !topic.trim()) return
    setComposing(kind)
    try {
      const instruction = kind === 'sms'
        ? `یک متن پیامک تبلیغاتی کوتاه و حرفه‌ای (حداکثر ۱۵۰ کاراکتر) برای املاک ملک‌جت دربارهٔ «${topic}» بنویس. فقط متن پیامک، بدون توضیح اضافه.`
        : `یک متن ایمیل کمپین بازاریابی املاک، جذاب و حرفه‌ای، برای ملک‌جت دربارهٔ «${topic}» بنویس. لحن گرم و انسانی. فقط متن ایمیل.`
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'content', input: instruction }) })
      const d = await r.json()
      if (d.ok && d.text) { if (kind === 'sms') setSmsText(d.text.trim().slice(0, 300)); else { setEmailBody(d.text.trim()); if (!emailSubject) setEmailSubject(topic) } }
      else alert(d.error || 'خطا در تولید')
    } catch { alert('خطا در ارتباط') } finally { setComposing('') }
  }

  const sendSms = async () => {
    if (smsSending) return
    if (!smsText.trim()) { setSmsResult('⚠ متن پیامک را بنویسید'); return }
    if (!smsNumbers.trim()) { setSmsResult('⚠ شماره‌ها را وارد کنید (۰۹...)'); return }
    setSmsSending(true); setSmsResult('')
    try {
      const r = await fetch('/api/sms/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: smsNumbers, message: smsText }),
      })
      const d = await r.json()
      setSmsResult(d.ok ? `✓ پیامک به ${d.sent} شماره ارسال شد` : `⚠ ${d.error || 'خطا'}`)
      if (d.ok) { setSmsText(''); setSmsNumbers('') }
    } catch { setSmsResult('⚠ خطا در ارتباط با سرور') }
    finally { setSmsSending(false) }
  }

  const navStyle = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 11,
    border: 'none',
    background: active ? 'var(--goldDim)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--muted)',
    fontFamily: 'inherit',
    fontSize: 13.5,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'right' as const,
  })

  const th = {
    padding: '11px 16px',
    fontSize: 11.5,
    fontWeight: 700,
    color: 'var(--muted)',
    textAlign: 'right' as const,
    background: 'var(--bg2)',
    borderBottom: '1px solid var(--line)',
  }
  const td = {
    padding: '13px 16px',
    fontSize: 13,
    color: 'var(--text)',
    borderTop: '1px solid var(--line)',
  }

  const svgW = 600
  const svgH = 180
  const padX = 36
  const padY = 20
  const maxVal = Math.max(...weeklyOpen, ...weeklyClick) * 1.1
  const openLine = buildPolyline(weeklyOpen, maxVal, svgW, svgH, padX, padY)
  const clickLine = buildPolyline(weeklyClick, maxVal, svgW, svgH, padX, padY)

  // The per-view content blocks — shared by both standalone (<main>) and embedded modes.
  const content = (
    <>

          {/* ── ARTICLES (مقالات) ── */}
          {activeView === 'articles' && <ArticleEditor compact />}

          {/* ── OVERVIEW ── */}
          {activeView === 'overview' && (
            <div style={{ display: 'grid', gap: 18 }}>

              {/* KPI Cards */}
              <div className="mjk-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {kpis.map((k) => (
                  <div
                    key={k.l}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 16,
                      padding: 18,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{k.l}</span>
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          background: k.bg,
                          color: k.c,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                        }}
                      >
                        {k.ic}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 800,
                        color: 'var(--text)',
                        marginTop: 12,
                        letterSpacing: '-.5px',
                      }}
                    >
                      {k.v}
                    </div>
                    <div style={{ fontSize: 11.5, color: k.tc, marginTop: 4 }}>{k.t}</div>
                  </div>
                ))}
              </div>

              {/* Line Chart */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                    عملکرد هفتگی کمپین‌ها
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 24,
                          height: 3,
                          borderRadius: 2,
                          background: 'var(--gold)',
                        }}
                      />
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>ایمیل‌های باز شده</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{ width: 24, height: 3, borderRadius: 2, background: '#5b9bd5' }}
                      />
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>کلیک‌ها</span>
                    </div>
                  </div>
                </div>
                {weeklyOpen.length === 0 ? (
                  <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 13, textAlign: 'center', lineHeight: 1.9 }}>هنوز کمپینی ارسال نشده — پس از ارسال، نمودارِ عملکرد اینجا نمایش داده می‌شود.</div>
                ) : (
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  style={{ width: '100%', height: 180 }}
                  preserveAspectRatio="none"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                    const y = padY + (1 - t) * (svgH - padY * 2)
                    return (
                      <line
                        key={i}
                        x1={padX}
                        y1={y}
                        x2={svgW - padX}
                        y2={y}
                        stroke="var(--line)"
                        strokeWidth={0.8}
                        strokeDasharray="4,4"
                      />
                    )
                  })}
                  <polyline
                    points={openLine}
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <polyline
                    points={clickLine}
                    fill="none"
                    stroke="#5b9bd5"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {weeklyOpen.map((v, i) => {
                    const x = padX + (i / (weeklyOpen.length - 1)) * (svgW - padX * 2)
                    const y = padY + (1 - v / maxVal) * (svgH - padY * 2)
                    return <circle key={i} cx={x} cy={y} r={3.5} fill="var(--gold)" />
                  })}
                  {weeklyClick.map((v, i) => {
                    const x = padX + (i / (weeklyClick.length - 1)) * (svgW - padX * 2)
                    const y = padY + (1 - v / maxVal) * (svgH - padY * 2)
                    return <circle key={i} cx={x} cy={y} r={3.5} fill="#5b9bd5" />
                  })}
                  {weekDays.map((d, i) => {
                    const x = padX + (i / (weekDays.length - 1)) * (svgW - padX * 2)
                    return (
                      <text
                        key={i}
                        x={x}
                        y={svgH - 4}
                        textAnchor="middle"
                        fontSize={10}
                        fill="var(--faint)"
                      >
                        {d}
                      </text>
                    )
                  })}
                </svg>
                )}
              </div>

              {/* Recent Activity */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text)',
                  }}
                >
                  آخرین فعالیت‌ها
                </div>
                <div style={{ padding: '4px 0' }}>
                  {recentActivities.length === 0 && (
                    <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.9 }}>هنوز فعالیتی ثبت نشده. پس از ارسالِ اولین کمپین، اینجا نمایش داده می‌شود.</div>
                  )}
                  {recentActivities.map((a, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 20px',
                        borderBottom:
                          i < recentActivities.length - 1 ? '1px solid var(--line)' : 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: 'var(--bg2)',
                          color: a.c,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 15,
                          flexShrink: 0,
                        }}
                      >
                        {a.ic}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                          {a.text}
                        </div>
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--faint)', flexShrink: 0 }}>
                        {a.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── EMAIL ── */}
          {activeView === 'email' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  style={{
                    padding: '10px 20px',
                    borderRadius: 11,
                    border: 'none',
                    background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                    color: 'var(--bg)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  کمپین جدید +
                </button>
              </div>

              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th style={th}>نام کمپین</th>
                        <th style={th}>وضعیت</th>
                        <th style={th}>دریافت‌کنندگان</th>
                        <th style={th}>نرخ بازشدن</th>
                        <th style={th}>نرخ کلیک</th>
                        <th style={th}>تاریخ ارسال</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailCampaigns.map((c) => (
                        <tr key={c.name}>
                          <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                          <td style={td}>
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: 999,
                                background: `${c.statusColor}22`,
                                color: c.statusColor,
                                fontSize: 11.5,
                                fontWeight: 700,
                                border: `1px solid ${c.statusColor}44`,
                              }}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td style={td}>{c.recipients}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{c.openRate}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{c.clickRate}</td>
                          <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{c.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Email Composer */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 22,
                }}
              >
                <div
                  style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}
                >
                  ارسال ایمیل جدید
                </div>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <label
                      style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 6 }}
                    >
                      عنوان ایمیل
                    </label>
                    <input
                      value={emailTitle}
                      onChange={(e) => setEmailTitle(e.target.value)}
                      placeholder="عنوان کمپین را وارد کنید"
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--bg2)',
                        color: 'var(--text)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box' as const,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 6 }}
                    >
                      موضوع
                    </label>
                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="موضوع ایمیل را وارد کنید"
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--bg2)',
                        color: 'var(--text)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box' as const,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 6 }}
                    >
                      گیرندگان (ایمیل‌ها با کاما/فاصله جدا شوند)
                    </label>
                    <input
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="a@example.com, b@example.com"
                      style={{
                        width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--line)',
                        background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', boxSizing: 'border-box' as const, direction: 'ltr', textAlign: 'left',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 6 }}
                    >
                      متن ایمیل
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="متن کامل ایمیل را اینجا بنویسید..."
                      style={{
                        width: '100%',
                        height: 120,
                        padding: '11px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--bg2)',
                        color: 'var(--text)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box' as const,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: emailResult.startsWith('✓') ? '#5fd98a' : emailResult ? '#e7a14a' : 'var(--faint)' }}>{emailResult}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => composeAi('email')}
                      disabled={!!composing}
                      style={{ padding: '11px 18px', borderRadius: 11, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: composing ? 0.6 : 1 }}
                    >{composing === 'email' ? 'در حال نوشتن…' : '✦ بنویس با AI'}</button>
                    <button
                      onClick={sendEmail}
                      disabled={emailSending}
                      style={{
                        padding: '11px 28px',
                        borderRadius: 11,
                        border: 'none',
                        background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                        color: 'var(--bg)',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: emailSending ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                        opacity: emailSending ? 0.6 : 1,
                      }}
                    >
                      {emailSending ? 'در حال ارسال…' : 'ارسال'}
                    </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SMS ── */}
          {activeView === 'sms' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
                  gap: 16,
                }}
              >
                {smsCampaigns.map((c) => (
                  <div
                    key={c.name}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 16,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 14,
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                        {c.name}
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: `${c.statusColor}22`,
                          color: c.statusColor,
                          border: `1px solid ${c.statusColor}44`,
                          marginRight: 10,
                          flexShrink: 0,
                        }}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div
                      className="mjk-2col"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginBottom: 3 }}>
                          ارسال شده
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                          {c.recipients}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginBottom: 3 }}>
                          تاریخ
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.date}</div>
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: 'var(--muted)',
                          marginBottom: 6,
                        }}
                      >
                        <span>نرخ تحویل</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{c.delivered}٪</span>
                      </div>
                      <div
                        style={{
                          height: 7,
                          borderRadius: 4,
                          background: 'var(--bg2)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 4,
                            width: `${c.delivered}%`,
                            background:
                              c.delivered > 80
                                ? '#5fd98a'
                                : c.delivered > 0
                                ? 'var(--gold)'
                                : 'var(--line)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick SMS Form */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 22,
                }}
              >
                <div
                  style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}
                >
                  ارسال پیامک سریع
                </div>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <label
                      style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 6 }}
                    >
                      شماره‌های هدف
                    </label>
                    <textarea
                      value={smsNumbers}
                      onChange={(e) => setSmsNumbers(e.target.value)}
                      placeholder="شماره‌ها را وارد کنید (هر شماره در یک خط)"
                      style={{
                        width: '100%',
                        height: 90,
                        padding: '11px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--bg2)',
                        color: 'var(--text)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box' as const,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 6 }}
                    >
                      متن پیامک
                    </label>
                    <textarea
                      value={smsText}
                      onChange={(e) => setSmsText(e.target.value)}
                      placeholder="متن پیامک را بنویسید (حداکثر ۱۶۰ کاراکتر)"
                      style={{
                        width: '100%',
                        height: 90,
                        padding: '11px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--bg2)',
                        color: 'var(--text)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box' as const,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 12, color: smsResult.startsWith('✓') ? '#5fd98a' : smsResult ? '#e7a14a' : 'var(--faint)' }}>
                      {smsResult || `${smsText.length}/۱۶۰ کاراکتر`}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => composeAi('sms')}
                      disabled={!!composing}
                      style={{ padding: '11px 18px', borderRadius: 11, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: composing ? 0.6 : 1 }}
                    >{composing === 'sms' ? 'در حال نوشتن…' : '✦ بنویس با AI'}</button>
                    <button
                      onClick={sendSms}
                      disabled={smsSending}
                      style={{
                        padding: '11px 28px',
                        borderRadius: 11,
                        border: 'none',
                        background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                        color: 'var(--bg)',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: smsSending ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                        opacity: smsSending ? 0.6 : 1,
                      }}
                    >
                      {smsSending ? 'در حال ارسال…' : 'ارسال'}
                    </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SOCIAL ── */}
          {activeView === 'social' && (
            <div style={{ display: 'grid', gap: 18 }}>
              {/* Platform Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                {socialPlatforms.map((p) => (
                  <div
                    key={p.name}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 16,
                      padding: 20,
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}
                    >
                      <span
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: `${p.color}22`,
                          border: `1px solid ${p.color}44`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          color: p.color,
                        }}
                      >
                        {p.ic}
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                          {p.posts} پست این ماه
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginBottom: 3 }}>
                          دنبال‌کنندگان
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                          {p.followers}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginBottom: 3 }}>
                          نرخ تعامل
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: p.color }}>
                          {p.engStr}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11.5,
                          color: 'var(--muted)',
                          marginBottom: 5,
                        }}
                      >
                        <span>تعامل</span>
                        <span style={{ color: p.color }}>{p.engStr}</span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 4,
                          background: 'var(--bg2)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(p.engagement * 10, 100)}%`,
                            background: p.color,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scheduling Calendar */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 18,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                      تقویم زمان‌بندی پست‌ها
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                      خرداد ۱۴۰۳
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: 'var(--goldDim)',
                          border: '1px solid var(--gold)',
                        }}
                      />
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>پست برنامه‌ریزی شده</span>
                    </div>
                    <button
                      style={{
                        padding: '8px 16px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                        color: 'var(--bg)',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      زمان‌بندی پست جدید
                    </button>
                  </div>
                </div>
                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}
                >
                  {calDays.map((d) => (
                    <div
                      key={d}
                      style={{
                        textAlign: 'center' as const,
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: 'var(--muted)',
                        padding: '6px 0',
                      }}
                    >
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => {
                    const hasPost = scheduledDays.has(day)
                    return (
                      <div
                        key={day}
                        style={{
                          textAlign: 'center' as const,
                          padding: '8px 4px',
                          borderRadius: 8,
                          fontSize: 13,
                          background: hasPost ? 'var(--goldDim)' : 'var(--bg2)',
                          color: hasPost ? 'var(--gold)' : 'var(--text)',
                          fontWeight: hasPost ? 700 : 400,
                          border: hasPost ? '1px solid var(--gold)' : '1px solid transparent',
                          position: 'relative' as const,
                          cursor: 'default',
                        }}
                      >
                        {day}
                        {hasPost && (
                          <div
                            style={{
                              position: 'absolute' as const,
                              bottom: 3,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: 'var(--gold)',
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── REPORTS ── */}
          {activeView === 'reports' && (
            <div style={{ display: 'grid', gap: 18 }}>
              {/* Conversion Funnel */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 22,
                }}
              >
                <div
                  style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}
                >
                  قیف تبدیل
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {funnelSteps.map((step, i) => (
                    <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 80,
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--muted)',
                          textAlign: 'right' as const,
                          flexShrink: 0,
                        }}
                      >
                        {step.label}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: 38,
                          borderRadius: 10,
                          background: 'var(--bg2)',
                          overflow: 'hidden',
                          position: 'relative' as const,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${step.pct}%`,
                            background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                            borderRadius: 10,
                            opacity: 1 - i * 0.15,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: 12,
                            boxSizing: 'border-box' as const,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bg)' }}>
                            {step.pct.toFixed(1)}٪
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          width: 70,
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--text)',
                          textAlign: 'left' as const,
                          flexShrink: 0,
                        }}
                      >
                        {step.value.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ROI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
                {roiCards.map((r) => (
                  <div
                    key={r.label}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 16,
                      padding: 22,
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
                      {r.label}
                    </div>
                    <div
                      style={{
                        fontSize: 30,
                        fontWeight: 800,
                        color: 'var(--gold)',
                        letterSpacing: '-.5px',
                        marginBottom: 6,
                      }}
                    >
                      {r.value}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--faint)' }}>{r.sub}</div>
                  </div>
                ))}
              </div>

              {/* Channel Performance */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 22,
                }}
              >
                <div
                  style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}
                >
                  عملکرد کانال‌های بازاریابی
                </div>
                {channelPerf.map((ch) => (
                  <div key={ch.label} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12.5,
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ch.label}</span>
                        <span style={{ color: 'var(--faint)', fontSize: 11.5 }}>{ch.stat}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: ch.color }}>{ch.value}٪</span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 4,
                        background: 'var(--bg2)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${ch.value}%`,
                          background: ch.color,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

    </>
  )

  // ===== EMBEDDED MODE: only the inner content area (no sidebar/header/return-bar/full-page). =====
  if (embedded) {
    return (
      <div dir="rtl" style={{ color: 'var(--text)', fontFamily: "'Vazirmatn', sans-serif" }}>
        {content}
      </div>
    )
  }

  // ===== STANDALONE MODE: full page, pixel-identical to the original /marketing. =====
  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: "'Vazirmatn', sans-serif",
      }}
    >
      <PanelReturnBar tool="مارکتینگ" />
      {/* SIDEBAR */}
      <aside
        className="mjk-side"
        style={{
          width: 240,
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
          background: 'var(--bg2)',
          borderLeft: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 13px',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            textDecoration: 'none',
            color: 'var(--text)',
            padding: '6px 8px 16px',
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: 'var(--bg2)',
              fontWeight: 900,
            }}
          >
            ✦
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.5px' }}>ملک‌جت</div>
            <div style={{ fontSize: 10.5, color: 'var(--gold)' }}>پنل بازاریابی</div>
          </div>
        </Link>

        <nav style={{ display: 'grid', gap: 3 }}>
          {MARKETING_VIEWS.map((m) => (
            <button key={m.id} onClick={() => setActiveView(m.id)} style={navStyle(activeView === m.id)}>
              <span style={{ width: 22, textAlign: 'center' as const, fontSize: 15 }}>{m.icon}</span>
              <span className="mjk-sidelabel" style={{ flex: 1, textAlign: 'right' as const }}>{m.label}</span>
            </button>
          ))}
          <Link href="/content" style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '10px 12px', borderRadius: 10, color: 'var(--gold)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, marginTop: 4, border: '1px solid rgba(212,175,55,0.25)' }}>
            <span style={{ width: 22, textAlign: 'center', fontSize: 15 }}>✎</span>
            <span className="mjk-sidelabel" style={{ flex: 1, textAlign: 'right' }}>مقالات و وبلاگ</span>
          </Link>
          <Link href="/website-builder" style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '10px 12px', borderRadius: 10, color: 'var(--gold)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, marginTop: 4, border: '1px solid rgba(212,175,55,0.25)' }}>
            <span style={{ width: 22, textAlign: 'center', fontSize: 15 }}>◳</span>
            <span className="mjk-sidelabel" style={{ flex: 1, textAlign: 'right' }}>وب‌سایت من (سایت‌ساز)</span>
          </Link>
        </nav>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 6px 4px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#e056a0,#9b7ad0)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>تیم بازاریابی</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>پلن حرفه‌ای</div>
          </div>
          <button
            onClick={() => {
              const n = theme === 'dark' ? 'light' : 'dark'
              setTheme(n)
              document.documentElement.classList.toggle('light', n === 'light')
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'var(--navbg)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--line)',
            padding: '0 24px',
            height: 62,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.4px' }}
          >
            {viewTitles[activeView]}
          </div>
          <div style={{ flex: 1 }} />
          <Link
            href="/agency"
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 36,
              padding: '0 14px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--text)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            پنل آژانس
          </Link>
        </header>

        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {content}
        </main>
      </div>
    </div>
  )
}
