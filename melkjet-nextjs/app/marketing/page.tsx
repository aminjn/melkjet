'use client'
import { useState } from 'react'
import Link from 'next/link'

type View = 'overview' | 'email' | 'sms' | 'social' | 'reports'

const kpis = [
  { l: 'ایمیل ارسالی', v: '۴۸٬۲۰۰', t: '↗ ۲۲٪ نسبت به ماه قبل', tc: '#5fd98a', ic: '✉', bg: 'rgba(95,217,138,0.12)', c: '#5fd98a' },
  { l: 'نرخ بازشدن', v: '۳۲٫۴٪', t: '↗ ۴٪ بهتر شد', tc: 'var(--gold)', ic: '◎', bg: 'var(--goldDim)', c: 'var(--gold)' },
  { l: 'نرخ کلیک', v: '۸٫۷٪', t: '+۱٫۲٪ بهتر شد', tc: '#5b9bd5', ic: '◈', bg: 'rgba(91,155,213,0.12)', c: '#5b9bd5' },
  { l: 'تبدیل‌ها', v: '۳۸۴', t: '↗ ۱۵٪ رشد', tc: '#5fd98a', ic: '◴', bg: 'rgba(95,217,138,0.12)', c: '#5fd98a' },
]

const weeklyOpen = [42, 58, 51, 67, 74, 62, 80, 88]
const weeklyClick = [18, 24, 20, 30, 28, 25, 35, 40]
const weekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']

const recentActivities = [
  { text: "کمپین ایمیل 'بهترین آپارتمان‌های تهران' راه‌اندازی شد", time: '۲ ساعت پیش', ic: '✉', c: '#5fd98a' },
  { text: '۱۲۰ کلیک جدید از کمپین پیامکی ثبت شد', time: '۵ ساعت پیش', ic: '✆', c: 'var(--gold)' },
  { text: 'کمپین اینستاگرام ویلاهای لوکس شمال منتشر شد', time: 'دیروز', ic: '◈', c: '#5b9bd5' },
  { text: 'گزارش هفتگی بازاریابی آماده است', time: 'دیروز', ic: '◎', c: '#9b7ad0' },
  { text: 'لیست مخاطبان جدید با ۲٬۴۰۰ کاربر بارگذاری شد', time: '۲ روز پیش', ic: '◍', c: '#5fd98a' },
]

const emailCampaigns = [
  { name: 'بهترین آپارتمان‌های تهران', status: 'فعال', statusColor: '#5fd98a', recipients: '۱۲٬۵۰۰', openRate: '۳۴٪', clickRate: '۹٪', date: '۱۴۰۳/۰۳/۱۵' },
  { name: 'فرصت‌های سرمایه‌گذاری', status: 'در حال ارسال', statusColor: 'var(--gold)', recipients: '۸٬۲۰۰', openRate: '۲۸٪', clickRate: '۷٪', date: '۱۴۰۳/۰۳/۱۸' },
  { name: 'ویلاهای لوکس شمال', status: 'پیش‌نویس', statusColor: 'var(--muted)', recipients: '۵٬۰۰۰', openRate: '--', clickRate: '--', date: '۱۴۰۳/۰۳/۲۰' },
  { name: 'آپارتمان‌های اجاره‌ای', status: 'تکمیل شد', statusColor: '#5b9bd5', recipients: '۱۵٬۳۰۰', openRate: '۳۱٪', clickRate: '۸٪', date: '۱۴۰۳/۰۳/۱۰' },
  { name: 'خانه‌های نوساز', status: 'متوقف', statusColor: '#e05a5a', recipients: '۳٬۸۰۰', openRate: '۲۲٪', clickRate: '۵٪', date: '۱۴۰۳/۰۳/۰۵' },
]

const smsCampaigns = [
  { name: 'اطلاع‌رسانی ملک جدید', status: 'ارسال شد', statusColor: '#5fd98a', recipients: '۸٬۴۰۰', delivered: 94, date: '۱۴۰۳/۰۳/۱۵' },
  { name: 'پیشنهاد ویژه خرید', status: 'در صف', statusColor: 'var(--gold)', recipients: '۵٬۲۰۰', delivered: 0, date: '۱۴۰۳/۰۳/۲۲' },
  { name: 'یادآوری جلسه مشاوره', status: 'ارسال شد', statusColor: '#5fd98a', recipients: '۱٬۱۵۰', delivered: 97, date: '۱۴۰۳/۰۳/۱۲' },
]

const socialPlatforms = [
  { name: 'اینستاگرام', ic: '◉', followers: '۱۲٬۴۰۰', engagement: 4.8, engStr: '۴٫۸٪', posts: '۴۸', color: '#e056a0' },
  { name: 'لینکدین', ic: '◈', followers: '۳٬۸۰۰', engagement: 6.2, engStr: '۶٫۲٪', posts: '۲۲', color: '#5b9bd5' },
  { name: 'توییتر', ic: '◆', followers: '۶٬۲۰۰', engagement: 3.1, engStr: '۳٫۱٪', posts: '۳۵', color: '#62aee8' },
]

const scheduledDays = new Set([3, 7, 10, 14, 17, 21, 24, 28])
const calDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

const funnelSteps = [
  { label: 'بازدید', value: 12400, pct: 100 },
  { label: 'لید', value: 3200, pct: 25.8 },
  { label: 'تماس', value: 840, pct: 6.8 },
  { label: 'معامله', value: 192, pct: 1.55 },
]

const roiCards = [
  { label: 'بازگشت سرمایه بازاریابی', value: '۳۲۰٪', sub: 'به ازای هر ۱ تومان هزینه' },
  { label: 'هزینه جذب لید', value: '۴۵٬۰۰۰ ت', sub: 'میانگین هزینه هر لید' },
  { label: 'ارزش طول عمر مشتری', value: '۸٫۴ م.د', sub: 'میانگین ارزش هر مشتری' },
  { label: 'نرخ تبدیل کلی', value: '۱٫۵۵٪', sub: 'از بازدید تا معامله' },
]

const navItems: { id: View; ic: string; l: string }[] = [
  { id: 'overview', ic: '◍', l: 'داشبورد' },
  { id: 'email', ic: '✉', l: 'کمپین ایمیل' },
  { id: 'sms', ic: '✆', l: 'پیامک' },
  { id: 'social', ic: '◈', l: 'شبکه اجتماعی' },
  { id: 'reports', ic: '◎', l: 'گزارش‌ها' },
]

const viewTitles: Record<View, string> = {
  overview: 'داشبورد بازاریابی',
  email: 'کمپین‌های ایمیل',
  sms: 'کمپین‌های پیامکی',
  social: 'شبکه‌های اجتماعی',
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

export default function MarketingPage() {
  const [view, setView] = useState<View>('overview')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [emailTitle, setEmailTitle] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [smsNumbers, setSmsNumbers] = useState('')
  const [smsText, setSmsText] = useState('')

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
          {navItems.map((m) => (
            <button key={m.id} onClick={() => setView(m.id)} style={navStyle(view === m.id)}>
              <span style={{ width: 22, textAlign: 'center' as const, fontSize: 15 }}>{m.ic}</span>
              <span className="mjk-sidelabel" style={{ flex: 1, textAlign: 'right' as const }}>{m.l}</span>
            </button>
          ))}
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
            {viewTitles[view]}
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

          {/* ── OVERVIEW ── */}
          {view === 'overview' && (
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
          {view === 'email' && (
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
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      style={{
                        padding: '11px 28px',
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
                      ارسال
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SMS ── */}
          {view === 'sms' && (
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
                    <span style={{ fontSize: 12, color: 'var(--faint)' }}>
                      {smsText.length}/۱۶۰ کاراکتر
                    </span>
                    <button
                      style={{
                        padding: '11px 28px',
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
                      ارسال
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SOCIAL ── */}
          {view === 'social' && (
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
          {view === 'reports' && (
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

        </main>
      </div>
    </div>
  )
}
