'use client'
import { useState, useEffect, useRef } from 'react'

/* ─── Types ─────────────────────────────────────────────────── */
type View =
  | 'overview' | 'scraper' | 'moderation' | 'content' | 'api'
  | 'reports' | 'plans' | 'promos' | 'ads' | 'users'
  | 'settings' | 'health' | 'servers' | 'queue' | 'audit' | 'flags'

interface NavItem { id: View; icon: string; label: string; badge?: string; badgeColor?: string }
interface NavSection { title: string; items: NavItem[] }

/* ─── Sidebar nav data ───────────────────────────────────────── */
const sections: NavSection[] = [
  {
    title: 'عملیات هوش مصنوعی',
    items: [
      { id: 'overview',    icon: '▦',  label: 'نمای کلی' },
      { id: 'scraper',     icon: '⛏',  label: 'موتور اسکرپی AI',   badge: 'زنده',  badgeColor: '#5fd98a' },
      { id: 'moderation',  icon: '✓',  label: 'تأیید آگهی AI',     badge: '32',    badgeColor: '#e7674a' },
      { id: 'content',     icon: '✦',  label: 'محتوا و سئو' },
      { id: 'api',         icon: '◈',  label: 'API و مدل‌های AI' },
    ],
  },
  {
    title: 'گزارش‌ها و داده',
    items: [
      { id: 'reports', icon: '◔', label: 'گزارش‌ها و Big Data' },
    ],
  },
  {
    title: 'درآمد و رشد',
    items: [
      { id: 'plans',  icon: '◔', label: 'پلن‌ها و اشتراک' },
      { id: 'promos', icon: '◈', label: 'پروموت‌ها' },
      { id: 'ads',    icon: '▤', label: 'تبلیغات بنری' },
    ],
  },
  {
    title: 'مدیریت پلتفرم',
    items: [
      { id: 'users', icon: '◍', label: 'کاربران و نقش‌ها' },
    ],
  },
  {
    title: 'پیکربندی',
    items: [
      { id: 'settings', icon: '⚙', label: 'تنظیمات کامل' },
    ],
  },
  {
    title: 'زیرساخت',
    items: [
      { id: 'health',  icon: '◉', label: 'سلامت سیستم' },
      { id: 'servers', icon: '▤', label: 'سرورها' },
      { id: 'queue',   icon: '◳', label: 'صف پردازش' },
      { id: 'audit',   icon: '❖', label: 'لاگ ممیزی' },
      { id: 'flags',   icon: '⚑', label: 'فلگ‌ها' },
    ],
  },
]

const viewTitles: Record<View, string> = {
  overview:   'نمای کلی سیستم',
  scraper:    'موتور اسکرپی هوشمند',
  moderation: 'تأیید آگهی با هوش مصنوعی',
  content:    'استودیو محتوا و سئو',
  api:        'API و مدل‌های هوش مصنوعی',
  reports:    'گزارش‌ها و تحلیل داده',
  plans:      'پلن‌ها و اشتراک‌ها',
  promos:     'پروموت‌ها و کمپین‌ها',
  ads:        'تبلیغات بنری',
  users:      'کاربران و نقش‌ها',
  settings:   'تنظیمات کامل پلتفرم',
  health:     'سلامت سیستم',
  servers:    'مدیریت سرورها',
  queue:      'صف پردازش',
  audit:      'لاگ ممیزی',
  flags:      'فیچر فلگ‌ها',
}

/* ─── Shared sub-components ──────────────────────────────────── */
function KPI({ label, value, trend, icon, iconBg, iconColor, trendUp }:
  { label: string; value: string; trend?: string; icon: string; iconBg?: string; iconColor?: string; trendUp?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
        <span style={{ width: 32, height: 32, borderRadius: 10, background: iconBg ?? 'var(--goldDim)', color: iconColor ?? 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 12, letterSpacing: '-.5px' }}>{value}</div>
      {trend && <div style={{ fontSize: 11.5, color: trendUp ? '#5fd98a' : 'var(--muted)', marginTop: 4 }}>{trend}</div>}
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10.5, borderRadius: 999, padding: '3px 9px', background: `${color}22`, color, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, padding: '16px 16px 5px', userSelect: 'none' }}>
      {title}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, ...style }}>
      {children}
    </div>
  )
}

function GoldButton({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{
      background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
      color: '#16140f', border: 'none', borderRadius: 11, padding: '10px 20px',
      fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
      boxShadow: '0 8px 22px -10px var(--gold)', ...style
    }}>
      {children}
    </button>
  )
}

function OutlineButton({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', color: 'var(--text)', border: '1px solid var(--line2)',
      borderRadius: 11, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', ...style
    }}>
      {children}
    </button>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
      background: on ? '#5fd98a' : 'var(--line2)', position: 'relative', transition: 'background .2s', flexShrink: 0
    }}>
      <span style={{
        position: 'absolute', top: 3,
        right: on ? 3 : 'auto',
        left: on ? 'auto' : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'all .2s',
        boxShadow: '0 1px 4px rgba(0,0,0,.3)'
      }} />
    </button>
  )
}

/* ─── Views ──────────────────────────────────────────────────── */

function OverviewView() {
  const feed = [
    { dot: '#5fd98a', text: 'اسکرپر دیوار ۱۴۳ آگهی جدید واکشی کرد', time: 'همین لحظه' },
    { dot: '#5b9bd5', text: 'مدل Claude محتوای ۸ صفحه سئو تولید کرد', time: '۲ دقیقه پیش' },
    { dot: '#e7a14a', text: 'آگهی #۸۸۴۵ برای بازبینی دستی فلگ شد', time: '۵ دقیقه پیش' },
    { dot: '#e7674a', text: '۳ آگهی تقلبی با امتیاز بالا رد شد', time: '۱۱ دقیقه پیش' },
  ]
  const actions = [
    { icon: '⛏', label: 'اجرای اسکرپر', color: '#5b9bd5' },
    { icon: '✦', label: 'تولید محتوا', color: '#5fd98a' },
    { icon: '◈', label: 'تست مدل AI', color: 'var(--gold)' },
    { icon: '◉', label: 'وضعیت سیستم', color: '#e7a14a' },
  ]
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <KPI label="آگهی فعال" value="۲۴۰٬۰۰۰" trend="↑ ۱٬۸۴۰ این هفته" icon="🏠" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" trendUp />
        <KPI label="تأیید AI امروز" value="۹۸۲" trend="↑ ۱۲٪ نسبت به دیروز" icon="✓" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" trendUp />
        <KPI label="محتوای تولیدشده" value="۳۴۰" trend="مقاله + صفحه سئو" icon="✦" iconBg="var(--goldDim)" iconColor="var(--gold)" />
        <KPI label="مصرف توکن" value="۸٫۴M" trend="↑ ۴٪ هزینه این ماه" icon="◈" iconBg="rgba(231,103,74,.15)" iconColor="#e7674a" />
      </div>

      <div className="mjsa-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>دسترسی سریع</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {actions.map(a => (
              <button key={a.label} style={{
                background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12,
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', fontSize: 13.5, fontWeight: 600
              }}>
                <span style={{ fontSize: 18, color: a.color }}>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>فعالیت زنده هوش مصنوعی</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {feed.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: f.dot, flexShrink: 0, marginTop: 5,
                  boxShadow: `0 0 6px ${f.dot}`, animation: i === 0 ? 'pulse 2s infinite' : undefined
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{f.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{f.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ScraperView() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState(0)
  const steps = ['اتصال به منابع', 'دریافت صفحات', 'پردازش داده', 'پاک‌سازی', 'ذخیره‌سازی']
  const [counts, setCounts] = useState({ total: 0, newItems: 0, dup: 0 })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sources = [
    { name: 'دیوار', status: 'فعال', count: '۱۸۳٬۰۰۰', lastRun: '۱۲ دقیقه پیش', color: '#5fd98a' },
    { name: 'شیپور', status: 'فعال', count: '۳۴٬۵۰۰', lastRun: '۲۵ دقیقه پیش', color: '#5fd98a' },
    { name: 'ملک‌رادار', status: 'فعال', count: '۱۲٬۸۰۰', lastRun: '۱ ساعت پیش', color: '#5fd98a' },
    { name: 'خبرگزاری‌ها', status: 'در انتظار', count: '۲٬۱۰۰', lastRun: '۳ ساعت پیش', color: '#e7a14a' },
    { name: 'سایت سازندگان', status: 'خطا', count: '۸۴۰', lastRun: 'ناموفق', color: '#e7674a' },
  ]
  const recent = [
    { id: '#۸۸۴۹', title: 'آپارتمان ۱۴۰ متری نوساز', location: 'سعادت‌آباد', price: '۱۷٫۸ م.د', source: 'دیوار', status: 'منتظر بررسی' },
    { id: '#۸۸۴۸', title: 'ویلا باغ لواسان', location: 'لواسان', price: '۱۲۰ م.د', source: 'شیپور', status: 'تأیید شد' },
    { id: '#۸۸۴۷', title: 'دفتر اداری', location: 'میرداماد', price: '۶٫۸ م.د', source: 'ملک‌رادار', status: 'تکراری' },
  ]

  const runScraper = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(true); setProgress(0); setStep(0); setCounts({ total: 0, newItems: 0, dup: 0 })
    let p = 0
    intervalRef.current = setInterval(() => {
      p += Math.random() * 4 + 1
      if (p > 100) p = 100
      const s = Math.min(4, Math.floor(p / 20))
      setProgress(Math.round(p))
      setStep(s)
      setCounts({ total: Math.round(p * 14.3), newItems: Math.round(p * 9.8), dup: Math.round(p * 2.1) })
      if (p >= 100) { clearInterval(intervalRef.current!); setRunning(false) }
    }, 180)
  }

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: running ? 18 : 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>اجرای اسکرپر</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>واکشی و ایمپورت آگهی از منابع خارجی</div>
          </div>
          <GoldButton onClick={runScraper} style={{ opacity: running ? .6 : 1, pointerEvents: running ? 'none' : 'auto' }}>
            {running ? '⏳ در حال اجرا…' : '▶ اجرای اسکرپر'}
          </GoldButton>
        </div>
        {running && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              {steps.map((s2, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: i <= step ? '#5fd98a' : 'var(--line2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: i <= step ? '#fff' : 'var(--faint)', transition: 'background .3s' }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 10.5, color: i <= step ? 'var(--text)' : 'var(--faint)', textAlign: 'center' }}>{s2}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--line2)', overflow: 'hidden', marginTop: 8 }}>
              <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,var(--gold2),var(--gold))', width: `${progress}%`, transition: 'width .2s' }} />
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13 }}>
              <span>کل: <strong style={{ color: 'var(--gold)' }}>{counts.total.toLocaleString()}</strong></span>
              <span>جدید: <strong style={{ color: '#5fd98a' }}>{counts.newItems.toLocaleString()}</strong></span>
              <span>تکراری: <strong style={{ color: 'var(--muted)' }}>{counts.dup.toLocaleString()}</strong></span>
            </div>
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>منابع داده</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              {['منبع', 'وضعیت', 'تعداد آگهی', 'آخرین اجرا', ''].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.name} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '12px 0', fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: '12px 0' }}><Badge label={s.status} color={s.color} /></td>
                <td style={{ padding: '12px 0', color: 'var(--muted)' }}>{s.count}</td>
                <td style={{ padding: '12px 0', color: 'var(--faint)', fontSize: 12 }}>{s.lastRun}</td>
                <td style={{ padding: '12px 0' }}><OutlineButton style={{ fontSize: 12, padding: '5px 12px' }}>اجرا</OutlineButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>آگهی‌های اخیراً ایمپورت‌شده</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recent.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 12, color: 'var(--faint)', minWidth: 50 }}>{r.id}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.location} · {r.source}</div>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 13 }}>{r.price}</span>
              <Badge label={r.status} color={r.status === 'تأیید شد' ? '#5fd98a' : r.status === 'تکراری' ? '#e7a14a' : '#5b9bd5'} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function ModerationView() {
  const [threshold, setThreshold] = useState(72)
  const queue = [
    { id: '#۸۸۴۵', title: 'آپارتمان زعفرانیه', score: 94, verdict: 'تأیید', reason: 'اطلاعات کامل، قیمت منطقی' },
    { id: '#۸۸۴۴', title: 'ویلا کردان فوری', score: 38, verdict: 'رد', reason: 'قیمت غیرواقعی، تصاویر تکراری' },
    { id: '#۸۸۴۳', title: 'پنت‌هاوس الهیه', score: 61, verdict: 'بازبینی', reason: 'قیمت بالا، نیاز به تأیید مدارک' },
    { id: '#۸۸۴۲', title: 'دفتر تجاری ونک', score: 88, verdict: 'تأیید', reason: 'آگهی معتبر از مشاور تأییدشده' },
    { id: '#۸۸۴۱', title: 'آپارتمان نوساز پونک', score: 55, verdict: 'بازبینی', reason: 'اطلاعات ناقص، متراژ نامشخص' },
    { id: '#۸۸۴۰', title: 'خانه ویلایی لواسان', score: 91, verdict: 'تأیید', reason: 'مدارک کامل، قیمت بازار' },
    { id: '#۸۸۳۹', title: 'اجاره روزانه شمال', score: 22, verdict: 'رد', reason: 'محتوای مشکوک، گزارش کاربران' },
  ]
  const verdictColor: Record<string, string> = { تأیید: '#5fd98a', رد: '#e7674a', بازبینی: '#e7a14a' }

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <KPI label="در صف بررسی" value="۳۲" trend="↑ ۸ از دیروز" icon="⏳" iconBg="rgba(231,103,74,.15)" iconColor="#e7674a" />
        <KPI label="تأیید خودکار امروز" value="۷۴۶" trend="۹۸.۲٪ دقت مدل" icon="✓" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" trendUp />
        <KPI label="رد شده" value="۱۲۴" trend="۱۲٪ از کل بررسی‌ها" icon="✗" iconBg="rgba(231,103,74,.1)" iconColor="#e7674a" />
        <KPI label="بازبینی دستی" value="۱۱۲" trend="میانگین ۴ دقیقه/آگهی" icon="👁" iconBg="rgba(231,161,74,.15)" iconColor="#e7a14a" />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>آستانه خودکار AI</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>امتیاز بالای این مقدار: تأیید خودکار — پایین‌تر: بازبینی دستی</div>
          </div>
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{threshold}</span>
        </div>
        <input type="range" min={40} max={95} value={threshold} onChange={e => setThreshold(+e.target.value)}
          style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>
          <span>۴۰ – محافظه‌کار</span><span>۶۵ – متعادل</span><span>۹۵ – تهاجمی</span>
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>صف تصمیم‌گیری</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              {['شناسه', 'عنوان', 'امتیاز', 'حکم AI', 'دلیل', ''].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.map(q => (
              <tr key={q.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '11px 0', fontSize: 12, color: 'var(--faint)' }}>{q.id}</td>
                <td style={{ padding: '11px 0', fontWeight: 600, fontSize: 13 }}>{q.title}</td>
                <td style={{ padding: '11px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 36, height: 6, borderRadius: 999, background: 'var(--line2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${q.score}%`, background: verdictColor[q.verdict], borderRadius: 999 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: verdictColor[q.verdict] }}>{q.score}</span>
                  </div>
                </td>
                <td style={{ padding: '11px 0' }}><Badge label={q.verdict} color={verdictColor[q.verdict]} /></td>
                <td style={{ padding: '11px 0', fontSize: 12, color: 'var(--muted)', maxWidth: 180 }}>{q.reason}</td>
                <td style={{ padding: '11px 0' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #5fd98a', color: '#5fd98a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>تأیید</button>
                    <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #e7674a', color: '#e7674a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>رد</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function ContentView() {
  const [type, setType] = useState('مقاله سئو')
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [output, setOutput] = useState('')
  const types = ['مقاله سئو', 'صفحه سئو', 'خبر', 'FAQ']
  const seoQueue = [
    { title: 'راهنمای خرید ملک در سعادت‌آباد', status: 'منتشر', views: '۴٬۲۰۰' },
    { title: '۱۰ نکته مهم قبل از اجاره آپارتمان', status: 'پیش‌نویس', views: '—' },
    { title: 'قیمت ملک در زعفرانیه ۱۴۰۳', status: 'در بررسی', views: '—' },
    { title: 'مقایسه محله‌های شمال تهران', status: 'منتشر', views: '۲٬۸۰۰' },
    { title: 'شرایط دریافت وام مسکن ۱۴۰۳', status: 'در بررسی', views: '—' },
  ]
  const statusColor: Record<string, string> = { منتشر: '#5fd98a', 'پیش‌نویس': '#5b9bd5', 'در بررسی': '#e7a14a' }
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const generate = () => {
    if (!topic) return
    if (ivRef.current) clearInterval(ivRef.current)
    setGenerating(true); setOutput('')
    const text = `# ${topic}\n\nاین یک ${type} جامع درباره ${topic} است که توسط هوش مصنوعی تولید شده.\n\n## مقدمه\n\nبازار ${topic} در سال‌های اخیر شاهد تحولات چشمگیری بوده است. بر اساس داده‌های ملک‌جت، تقاضا برای این حوزه در تهران به شدت افزایش یافته است.\n\n## تحلیل بازار\n\nمیانگین قیمت در این بازار طی ۶ ماه گذشته ۱۲٪ رشد داشته است. کارشناسان انتظار دارند این روند ادامه یابد.\n\n## نتیجه‌گیری\n\nبرای موفقیت در این حوزه، توجه به موقعیت، دسترسی و کیفیت ساخت ضروری است.`
    let i = 0
    ivRef.current = setInterval(() => {
      i += 8
      setOutput(text.slice(0, i))
      if (i >= text.length) { clearInterval(ivRef.current!); setGenerating(false) }
    }, 30)
  }

  return (
    <div style={{ animation: 'fade .35s ease', display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>صف سئو</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {seoQueue.map((s, i) => (
              <div key={i} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{s.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge label={s.status} color={statusColor[s.status]} />
                  <span style={{ fontSize: 11, color: 'var(--faint)' }}>{s.views}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>تنظیمات تولید محتوا</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {types.map(t => (
              <button key={t} onClick={() => setType(t)} style={{
                padding: '8px 16px', borderRadius: 10, border: `1px solid ${type === t ? 'var(--gold)' : 'var(--line2)'}`,
                background: type === t ? 'var(--goldDim)' : 'transparent', color: type === t ? 'var(--gold)' : 'var(--muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
              }}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="موضوع یا کلیدواژه هدف را وارد کنید…"
              style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 11, padding: '11px 14px', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }}
            />
            <GoldButton onClick={generate} style={{ opacity: generating ? .6 : 1, pointerEvents: generating ? 'none' : 'auto' }}>
              {generating ? '✦ در حال تولید…' : '✦ تولید محتوا'}
            </GoldButton>
          </div>
        </Card>

        {(output || generating) && (
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>خروجی AI</div>
            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 16, minHeight: 160, fontSize: 13.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text)', fontFamily: '"JetBrains Mono", monospace' }}>
              {output}
              {generating && <span style={{ animation: 'blink 1s infinite' }}>█</span>}
            </div>
            {!generating && output && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <GoldButton>انتشار</GoldButton>
                <OutlineButton>پیش‌نویس</OutlineButton>
                <OutlineButton>ویرایش</OutlineButton>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

function APIView() {
  const providers = [
    { name: 'Claude (Anthropic)', model: 'claude-sonnet-4-6', status: 'فعال', latency: '۳۴۰ms', cost: '$0.015/1K', color: '#5b9bd5' },
    { name: 'OpenAI', model: 'gpt-4o', status: 'پشتیبان', latency: '۴۲۰ms', cost: '$0.030/1K', color: '#5fd98a' },
    { name: 'Self-hosted (Llama)', model: 'llama-3.1-70B', status: 'غیرفعال', latency: '۸۸۰ms', cost: '$0.001/1K', color: '#e7a14a' },
  ]
  const agents = [
    { name: 'ScraperAgent', task: 'واکشی و پردازش آگهی', model: 'Claude Haiku', status: 'فعال' },
    { name: 'ModerationAgent', task: 'تأیید و امتیازدهی آگهی', model: 'Claude Sonnet', status: 'فعال' },
    { name: 'ContentAgent', task: 'تولید مقاله و سئو', model: 'Claude Opus', status: 'فعال' },
    { name: 'PricingAgent', task: 'تحلیل و برآورد قیمت', model: 'Claude Sonnet', status: 'فعال' },
    { name: 'ChatAgent', task: 'دستیار چت کاربر', model: 'Claude Haiku', status: 'فعال' },
    { name: 'SearchAgent', task: 'جستجوی معنایی', model: 'Self-hosted', status: 'آزمایشی' },
    { name: 'ImageAgent', task: 'تحلیل تصاویر ملک', model: 'GPT-4o Vision', status: 'آزمایشی' },
    { name: 'FraudAgent', task: 'تشخیص تقلب', model: 'Claude Opus', status: 'فعال' },
    { name: 'TranslationAgent', task: 'ترجمه محتوا', model: 'Claude Haiku', status: 'غیرفعال' },
    { name: 'SummaryAgent', task: 'خلاصه‌سازی گزارش', model: 'Claude Sonnet', status: 'فعال' },
    { name: 'LeadAgent', task: 'مدیریت لیدهای فروش', model: 'GPT-4o', status: 'آزمایشی' },
    { name: 'AlertAgent', task: 'اعلان‌های هوشمند', model: 'Claude Haiku', status: 'فعال' },
    { name: 'AnalyticsAgent', task: 'تحلیل رفتار کاربر', model: 'Self-hosted', status: 'فعال' },
    { name: 'NegotiationAgent', task: 'پشتیبانی مذاکره', model: 'Claude Opus', status: 'آزمایشی' },
  ]
  const agentStatusColor: Record<string, string> = { فعال: '#5fd98a', آزمایشی: '#e7a14a', غیرفعال: 'var(--faint)' }

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <KPI label="توکن مصرف‌شده" value="۸٫۴M" trend="این ماه" icon="◈" iconBg="var(--goldDim)" iconColor="var(--gold)" />
        <KPI label="هزینه این ماه" value="$۴۸۴" trend="↓ ۱۲٪ بهینه‌سازی" icon="💰" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" trendUp />
        <KPI label="میانگین لیتنسی" value="۳۸۲ms" trend="P99: ۱.۲s" icon="⚡" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" />
        <KPI label="ایجنت فعال" value="۱۴" trend="۳ در حالت آزمایشی" icon="◍" iconBg="rgba(231,161,74,.15)" iconColor="#e7a14a" />
      </div>

      <div className="mjsa-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>پروایدرهای AI</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {providers.map(p => (
              <div key={p.name} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: '"JetBrains Mono", monospace' }}>{p.model}</div>
                </div>
                <div style={{ textAlign: 'left', fontSize: 12 }}>
                  <div style={{ color: 'var(--muted)' }}>{p.latency}</div>
                  <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{p.cost}</div>
                </div>
                <Badge label={p.status} color={p.status === 'فعال' ? '#5fd98a' : p.status === 'پشتیبان' ? '#5b9bd5' : 'var(--faint)'} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>پایگاه دانش RAG</div>
          {[
            { name: 'قوانین و مقررات ملکی', docs: '۱٬۲۴۰', size: '۸.۳ MB' },
            { name: 'داده‌های تاریخی قیمت', docs: '۴۸٬۰۰۰', size: '۳۴۰ MB' },
            { name: 'مستندات آژانس‌ها', docs: '۳٬۸۰۰', size: '۲۸ MB' },
            { name: 'محتوای سئوی منتشرشده', docs: '۸۴۰', size: '۶.۲ MB' },
          ].map((kb, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{kb.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{kb.docs} سند · {kb.size}</div>
              </div>
              <OutlineButton style={{ fontSize: 11.5, padding: '5px 12px' }}>به‌روزرسانی</OutlineButton>
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>ریجستری ایجنت‌های AI ({agents.length})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {agents.map(a => (
            <div key={a.name} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12.5, fontFamily: '"JetBrains Mono", monospace' }}>{a.name}</span>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: agentStatusColor[a.status], animation: a.status === 'فعال' ? 'pulse 2s infinite' : undefined, display: 'inline-block' }} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>{a.task}</div>
              <Badge label={a.model} color="#5b9bd5" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function UsersView() {
  const [search, setSearch] = useState('')
  const [openRole, setOpenRole] = useState<string | null>(null)
  const users = [
    { name: 'سارا محمدی', email: 'sara@example.com', role: 'مشاور', plan: 'Pro', status: 'فعال', joined: '۱۴۰۳/۰۱/۱۵' },
    { name: 'امیر رضایی', email: 'amir@example.com', role: 'آژانس', plan: 'Business', status: 'فعال', joined: '۱۴۰۲/۱۱/۰۸' },
    { name: 'نگار کریمی', email: 'negar@example.com', role: 'خریدار', plan: 'رایگان', status: 'فعال', joined: '۱۴۰۳/۰۳/۲۰' },
    { name: 'کاوه اسدی', email: 'kaveh@example.com', role: 'سازنده', plan: 'Enterprise', status: 'معلق', joined: '۱۴۰۲/۰۸/۱۲' },
    { name: 'مریم حسینی', email: 'maryam@example.com', role: 'مشاور', plan: 'Pro', status: 'فعال', joined: '۱۴۰۳/۰۲/۰۵' },
    { name: 'رضا کمالی', email: 'reza@example.com', role: 'خریدار', plan: 'رایگان', status: 'غیرفعال', joined: '۱۴۰۳/۰۴/۱۸' },
  ]
  const roles = [
    { name: 'سوپر ادمین', perms: ['دسترسی کامل سیستم', 'مدیریت کاربران', 'تنظیمات سرور', 'گزارش مالی'] },
    { name: 'ادمین محتوا', perms: ['تولید محتوا', 'تأیید آگهی', 'مدیریت سئو', 'مشاهده گزارش'] },
    { name: 'مشاور تأییدشده', perms: ['ثبت آگهی نامحدود', 'CRM', 'آمار فایل‌ها', 'تبلیغات هدفمند'] },
    { name: 'کاربر عادی', perms: ['جستجو', 'ذخیره ملک', 'پیام به مشاور', 'دریافت اعلان'] },
  ]
  const filtered = users.filter(u => !search || u.name.includes(search) || u.email.includes(search))
  const statusColor: Record<string, string> = { فعال: '#5fd98a', معلق: '#e7a14a', غیرفعال: 'var(--faint)' }

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <KPI label="کل کاربران" value="۱۸٬۵۰۰" trend="↑ ۳۴۰ این ماه" icon="◍" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" trendUp />
        <KPI label="مشاور فعال" value="۴٬۲۰۰" trend="↑ ۷٪ رشد" icon="★" iconBg="var(--goldDim)" iconColor="var(--gold)" trendUp />
        <KPI label="آژانس ثبت‌شده" value="۸۴۰" trend="۶۲ جدید این ماه" icon="▦" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" />
        <KPI label="معلق/غیرفعال" value="۲۸۰" trend="نیاز به بررسی" icon="⚠" iconBg="rgba(231,161,74,.15)" iconColor="#e7a14a" />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>جدول کاربران</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی نام یا ایمیل…"
            style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 220 }} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              {['نام', 'ایمیل', 'نقش', 'پلن', 'وضعیت', 'عضویت', ''].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.email} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '11px 0', fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: '11px 0', fontSize: 12, color: 'var(--muted)', fontFamily: '"JetBrains Mono", monospace' }}>{u.email}</td>
                <td style={{ padding: '11px 0' }}><Badge label={u.role} color="#5b9bd5" /></td>
                <td style={{ padding: '11px 0', color: 'var(--gold)', fontWeight: 600, fontSize: 13 }}>{u.plan}</td>
                <td style={{ padding: '11px 0' }}><Badge label={u.status} color={statusColor[u.status]} /></td>
                <td style={{ padding: '11px 0', fontSize: 12, color: 'var(--faint)' }}>{u.joined}</td>
                <td style={{ padding: '11px 0' }}><OutlineButton style={{ fontSize: 11.5, padding: '4px 10px' }}>ویرایش</OutlineButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>نقش‌ها و دسترسی‌ها</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roles.map(r => (
            <div key={r.name} style={{ background: 'var(--bg2)', borderRadius: 12, overflow: 'hidden' }}>
              <button onClick={() => setOpenRole(openRole === r.name ? null : r.name)} style={{
                width: '100%', background: 'transparent', border: 'none', padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', fontWeight: 600, fontSize: 13.5
              }}>
                {r.name}
                <span style={{ color: 'var(--faint)', display: 'inline-block', transition: 'transform .2s', transform: openRole === r.name ? 'rotate(180deg)' : 'none' }}>▾</span>
              </button>
              {openRole === r.name && (
                <div style={{ padding: '4px 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {r.perms.map(p => (
                    <span key={p} style={{ fontSize: 12, background: 'var(--goldDim)', color: 'var(--gold)', borderRadius: 8, padding: '4px 10px' }}>{p}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function PlansView() {
  const segments = [
    {
      name: 'خریدار و مستأجر', color: '#5b9bd5',
      plans: [
        { name: 'رایگان', price: '۰', features: ['جستجوی هوشمند', 'ذخیره ۵ ملک', 'پیام محدود', 'تحلیل پایه'] },
        { name: 'پرمیوم', price: '۴۹۰٬۰۰۰', features: ['جستجو بدون محدودیت', 'اعلان قیمت', 'دستیار AI', 'گزارش کامل محله'] },
      ]
    },
    {
      name: 'مشاور و آژانس', color: 'var(--gold)',
      plans: [
        { name: 'Pro', price: '۱٬۹۹۰٬۰۰۰', features: ['آگهی نامحدود', 'CRM پایه', 'صفحه حرفه‌ای', 'آمار کامل'] },
        { name: 'Business', price: '۴٬۹۹۰٬۰۰۰', features: ['همه‌چیز Pro', 'چند کاربره', 'API دسترسی', 'پشتیبانی اولویت'] },
      ]
    },
    {
      name: 'سازنده و توسعه‌دهنده', color: '#5fd98a',
      plans: [
        { name: 'Builder', price: '۲٬۴۹۰٬۰۰۰', features: ['پروژه نامحدود', 'صفحه پروژه', 'لندینگ اختصاصی', 'لیدهای هدفمند'] },
        { name: 'Enterprise', price: 'توافقی', features: ['برندینگ اختصاصی', 'API کامل', 'داشبورد سفارشی', 'SLA گارانتی‌شده'] },
      ]
    },
    {
      name: 'مصالح و B2B', color: '#e7a14a',
      plans: [
        { name: 'Catalog', price: '۹۹۰٬۰۰۰', features: ['کاتالوگ محصولات', 'صفحه برند', 'درخواست قیمت', 'آمار بازدید'] },
        { name: 'Market', price: '۳٬۴۹۰٬۰۰۰', features: ['همه‌چیز Catalog', 'تبلیغات هدفمند', 'CRM خریداران', 'API سفارش'] },
      ]
    },
  ]

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      {segments.map(seg => (
        <div key={seg.name} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: seg.color }}>{seg.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {seg.plans.map(plan => (
              <Card key={plan.name} style={{ borderColor: seg.color === 'var(--gold)' ? 'rgba(201,168,76,.25)' : seg.color + '33' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{plan.name}</span>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: seg.color === 'var(--gold)' ? 'var(--gold)' : seg.color }}>{plan.price}</span>
                    {plan.price !== 'توافقی' && <span style={{ fontSize: 11, color: 'var(--faint)' }}> تومان/ماه</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: seg.color === 'var(--gold)' ? 'var(--gold)' : seg.color, fontSize: 11 }}>✓</span>
                      <span style={{ color: 'var(--muted)' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <OutlineButton style={{ fontSize: 12, padding: '6px 12px' }}>ویرایش</OutlineButton>
                  <OutlineButton style={{ fontSize: 12, padding: '6px 12px', color: '#e7674a', borderColor: 'rgba(231,103,74,.3)' }}>غیرفعال</OutlineButton>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function HealthView() {
  const servers = [
    { name: 'Web-01 (Primary)', uptime: '۹۹.۹۸٪', cpu: 42, mem: 68, status: 'سالم', location: 'تهران DC1' },
    { name: 'Web-02 (Replica)', uptime: '۹۹.۹۵٪', cpu: 38, mem: 61, status: 'سالم', location: 'تهران DC1' },
    { name: 'API Gateway', uptime: '۹۹.۹۹٪', cpu: 22, mem: 45, status: 'سالم', location: 'تهران DC2' },
    { name: 'AI Worker-01', uptime: '۹۸.۴٪', cpu: 87, mem: 91, status: 'هشدار', location: 'اروپا' },
    { name: 'DB Primary', uptime: '۱۰۰٪', cpu: 31, mem: 74, status: 'سالم', location: 'تهران DC1' },
    { name: 'Cache (Redis)', uptime: '۹۹.۹۷٪', cpu: 12, mem: 38, status: 'سالم', location: 'تهران DC1' },
  ]
  const alerts = [
    { msg: 'AI Worker-01: مصرف CPU بالای ۸۵٪', level: 'هشدار', time: '۸ دقیقه پیش', color: '#e7a14a' },
    { msg: 'نرخ خطای API به ۰.۸٪ رسید', level: 'اطلاع', time: '۲۲ دقیقه پیش', color: '#5b9bd5' },
    { msg: 'به‌روزرسانی موفق پایگاه داده', level: 'موفق', time: '۱ ساعت پیش', color: '#5fd98a' },
  ]

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <KPI label="آپتایم کلی" value="۹۹.۹۷٪" trend="SLA: ۹۹.۹٪" icon="◉" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" trendUp />
        <KPI label="درخواست/ثانیه" value="۴٬۸۴۰" trend="پیک: ۸٬۲۰۰" icon="⚡" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" />
        <KPI label="میانگین پاسخ" value="۱۴۲ms" trend="P99: ۴۸۰ms" icon="⏱" iconBg="var(--goldDim)" iconColor="var(--gold)" />
        <KPI label="نرخ خطا" value="۰.۱۲٪" trend="↓ بهتر از دیروز" icon="✗" iconBg="rgba(231,103,74,.1)" iconColor="#e7674a" trendUp />
      </div>

      <div className="mjsa-2col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>وضعیت سرورها</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {servers.map(s => (
              <div key={s.name} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.status === 'سالم' ? '#5fd98a' : '#e7a14a', animation: 'pulse 2s infinite', display: 'inline-block' }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--faint)' }}>{s.location}</span>
                    <Badge label={s.uptime} color={s.status === 'سالم' ? '#5fd98a' : '#e7a14a'} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[{ l: 'CPU', v: s.cpu }, { l: 'RAM', v: s.mem }].map(m => (
                    <div key={m.l}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)', marginBottom: 3 }}>
                        <span>{m.l}</span><span>{m.v}٪</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: 'var(--line2)' }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${m.v}%`, background: m.v > 80 ? '#e7a14a' : m.v > 60 ? 'var(--gold)' : '#5fd98a', transition: 'width .3s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>هشدارها</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px', borderRight: `3px solid ${a.color}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{a.msg}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge label={a.level} color={a.color} />
                  <span style={{ fontSize: 11, color: 'var(--faint)' }}>{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function SettingsView() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    maintenance: false, registration: true, aiModeration: true,
    autoPublish: false, emailNotifs: true, smsNotifs: true,
    darkDefault: true, rtlForce: true, analyticsPublic: false,
    apiPublic: true, devMode: false, betaFeatures: false,
  })
  const settings = [
    { key: 'maintenance',     label: 'حالت تعمیر و نگهداری',   desc: 'سایت برای کاربران غیرفعال می‌شود' },
    { key: 'registration',    label: 'ثبت‌نام جدید',            desc: 'امکان ایجاد حساب برای کاربران جدید' },
    { key: 'aiModeration',    label: 'تأیید خودکار AI',         desc: 'مدل هوش مصنوعی آگهی‌ها را بررسی می‌کند' },
    { key: 'autoPublish',     label: 'انتشار خودکار',           desc: 'آگهی‌های تأییدشده بلافاصله منتشر می‌شوند' },
    { key: 'emailNotifs',     label: 'اعلان‌های ایمیل',         desc: 'ارسال خودکار ایمیل به کاربران' },
    { key: 'smsNotifs',       label: 'اعلان‌های پیامکی',        desc: 'ارسال خودکار SMS' },
    { key: 'darkDefault',     label: 'تم تاریک پیش‌فرض',       desc: 'کاربران جدید با تم تاریک وارد می‌شوند' },
    { key: 'rtlForce',        label: 'جهت RTL اجباری',          desc: 'رابط کاربری همیشه راست‌به‌چپ' },
    { key: 'analyticsPublic', label: 'آمار عمومی',              desc: 'نمایش آمار سایت به همه کاربران' },
    { key: 'apiPublic',       label: 'API عمومی',               desc: 'امکان دسترسی API برای توسعه‌دهندگان' },
    { key: 'devMode',         label: 'حالت توسعه',              desc: 'نمایش لاگ‌ها و اطلاعات دیباگ' },
    { key: 'betaFeatures',    label: 'ویژگی‌های بتا',           desc: 'فعال‌سازی ویژگی‌های آزمایشی' },
  ]

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>تنظیمات کلی پلتفرم</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {settings.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < settings.length - 1 ? '1px solid var(--line)' : 'none', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.desc}</div>
              </div>
              <Toggle on={toggles[s.key]} onChange={v => setToggles(prev => ({ ...prev, [s.key]: v }))} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function FlagsView() {
  const [flags, setFlags] = useState<Record<string, boolean>>({
    newSearch: true, aiChat: true, mapHeat: false, pricePredict: false,
    videoTour: false, mortgageCalc: true, compareMode: false, agentMatch: true,
    arView: false, blockchainDeed: false, instantOffer: false, virtualStaging: false,
  })
  const featureFlags = [
    { key: 'newSearch',      name: 'جستجوی نسل جدید',     desc: 'موتور جستجوی معنایی بر پایه embeddings',        rollout: '۱۰۰٪', tag: 'پایدار' },
    { key: 'aiChat',         name: 'دستیار AI چت',          desc: 'چت‌بات هوشمند برای راهنمایی کاربران',           rollout: '۱۰۰٪', tag: 'پایدار' },
    { key: 'mapHeat',        name: 'نقشه حرارتی',           desc: 'ویژوالیزیشن قیمت و تقاضا روی نقشه',             rollout: '۲۰٪',  tag: 'بتا' },
    { key: 'pricePredict',   name: 'پیش‌بینی قیمت',        desc: 'مدل پیش‌بینی روند قیمت ملک',                    rollout: '۵٪',   tag: 'آلفا' },
    { key: 'videoTour',      name: 'تور ویدیویی',           desc: 'پشتیبانی از ویدیو در آگهی‌ها',                  rollout: '۰٪',   tag: 'آلفا' },
    { key: 'mortgageCalc',   name: 'ماشین‌حساب وام',       desc: 'محاسبه اقساط و شرایط وام مسکن',                 rollout: '۱۰۰٪', tag: 'پایدار' },
    { key: 'compareMode',    name: 'مقایسه ملک‌ها',        desc: 'مقایسه جدولی چند ملک با هم',                    rollout: '۱۵٪',  tag: 'بتا' },
    { key: 'agentMatch',     name: 'تطبیق مشاور AI',        desc: 'پیشنهاد مشاور بر اساس نیاز کاربر',              rollout: '۸۰٪',  tag: 'پایدار' },
    { key: 'arView',         name: 'نمای واقعیت افزوده',   desc: 'مشاهده ملک با AR در محل',                        rollout: '۰٪',   tag: 'تحقیق' },
    { key: 'blockchainDeed', name: 'سند بلاک‌چین',         desc: 'ثبت سند مالکیت روی بلاک‌چین',                   rollout: '۰٪',   tag: 'تحقیق' },
    { key: 'instantOffer',   name: 'پیشنهاد فوری',          desc: 'خرید مستقیم بدون مذاکره',                        rollout: '۰٪',   tag: 'آلفا' },
    { key: 'virtualStaging', name: 'چیدمان مجازی',          desc: 'دکوراسیون مبله مجازی با AI',                     rollout: '۱۰٪',  tag: 'بتا' },
  ]
  const tagColor: Record<string, string> = { پایدار: '#5fd98a', بتا: '#5b9bd5', آلفا: '#e7a14a', تحقیق: 'var(--muted)' }

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>فیچر فلگ‌های پلتفرم</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {featureFlags.map((f, i) => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < featureFlags.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <Toggle on={flags[f.key]} onChange={v => setFlags(prev => ({ ...prev, [f.key]: v }))} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{f.name}</span>
                  <Badge label={f.tag} color={tagColor[f.tag]} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{f.desc}</div>
              </div>
              <div style={{ textAlign: 'left', minWidth: 60 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: flags[f.key] ? '#5fd98a' : 'var(--faint)' }}>{f.rollout}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)' }}>rollout</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SimpleView({ title }: { title: string }) {
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>◳</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14 }}>این بخش در حال توسعه است</div>
        </div>
      </Card>
    </div>
  )
}

/* ─── Main SuperAdmin Page ───────────────────────────────────── */
export default function SuperAdminPage() {
  const [active, setActive] = useState<View>('overview')
  const [now, setNow] = useState('')

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  function renderView() {
    switch (active) {
      case 'overview':   return <OverviewView />
      case 'scraper':    return <ScraperView />
      case 'moderation': return <ModerationView />
      case 'content':    return <ContentView />
      case 'api':        return <APIView />
      case 'users':      return <UsersView />
      case 'plans':      return <PlansView />
      case 'settings':   return <SettingsView />
      case 'flags':      return <FlagsView />
      case 'health':     return <HealthView />
      default:           return <SimpleView title={viewTitles[active]} />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden', direction: 'rtl' }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="mjsa-side" style={{
        width: 248, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden'
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px var(--gold)', flexShrink: 0 }}>
              <span style={{ width: 14, height: 14, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.5px', color: 'var(--text)' }}>ملک‌جت</div>
              <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, marginTop: 1 }}>سوپر ادمین</div>
            </div>
          </div>
        </div>

        {/* Nav sections */}
        <nav style={{ flex: 1, paddingBottom: 8 }}>
          {sections.map(sec => (
            <div key={sec.title}>
              <SectionHeader title={sec.title} />
              {sec.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  style={{
                    width: '100%',
                    background: active === item.id ? 'rgba(231,103,74,0.12)' : 'transparent',
                    border: 'none',
                    borderRight: active === item.id ? '3px solid #e7674a' : '3px solid transparent',
                    padding: '9px 14px 9px 12px',
                    display: 'flex', alignItems: 'center', gap: 9,
                    cursor: 'pointer', fontFamily: 'inherit',
                    color: active === item.id ? 'var(--text)' : 'var(--muted)',
                    fontSize: 13.5,
                    fontWeight: active === item.id ? 700 : 500,
                    textAlign: 'right',
                    transition: 'all .15s'
                  }}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0, color: active === item.id ? '#e7674a' : 'var(--faint)' }}>{item.icon}</span>
                  <span className="mjsa-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && <Badge label={item.badge} color={item.badgeColor ?? '#5fd98a'} />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* User avatar at bottom */}
        <div style={{ borderTop: '1px solid var(--line)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#e7674a,#c9a84c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#fff', flexShrink: 0 }}>م</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>مدیر سیستم</div>
            <div style={{ fontSize: 11, color: 'var(--faint)' }}>superadmin@melkjet.ir</div>
          </div>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 16, padding: 4 }}>⏻</button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{
          height: 60, flexShrink: 0, background: 'var(--navbg)', borderBottom: '1px solid var(--line)',
          backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{viewTitles[active]}</h1>
          </div>

          {/* Live clock */}
          <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '.5px' }}>{now}</div>

          {/* System status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(95,217,138,.12)', borderRadius: 999, padding: '6px 12px', border: '1px solid rgba(95,217,138,.25)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5fd98a', animation: 'pulse 2s infinite', boxShadow: '0 0 6px #5fd98a', display: 'inline-block' }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5fd98a' }}>همه سیستم‌ها عملیاتی</span>
          </div>

          {/* Notification bell */}
          <button style={{ position: 'relative', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>
            🔔
            <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#e7674a', border: '2px solid var(--navbg)' }} />
          </button>
        </header>

        {/* Scrollable content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {renderView()}
        </main>
      </div>

      {/* ── Injected keyframes ──────────────────────────────── */}
      <style>{`
        @keyframes pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes fade  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
        button:hover { filter: brightness(1.08); }
        aside::-webkit-scrollbar { width: 4px; }
        aside::-webkit-scrollbar-thumb { background: rgba(140,140,140,.15); border-radius: 8px; }
        main::-webkit-scrollbar { width: 6px; }
        main::-webkit-scrollbar-thumb { background: rgba(140,140,140,.22); border-radius: 8px; }
      `}</style>
    </div>
  )
}
