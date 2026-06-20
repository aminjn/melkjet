'use client'
import { useState, useEffect } from 'react'
import { fetchContent, type ContentItem } from '../lib/content-display'
import PanelReturnBar from '../components/PanelReturnBar'

type View = 'dashboard' | 'listings' | 'pipeline' | 'tasks' | 'calendar'

// Mirrors app/lib/crm-store.ts Task (the API shape). `time` is derived from due/createdAt for display.
interface Task {
  id: string
  done: boolean
  title: string
  due?: string
  priority?: 'high' | 'medium' | 'low'
  createdAt: number
}

// Mirrors app/lib/leads-store.ts Lead (the API shape).
type Stage = 'new' | 'review' | 'offered' | 'contract' | 'lost'
interface Lead {
  id: string
  name: string
  phone?: string
  need?: string
  budget?: string
  stage: Stage
  score?: number
  note?: string
  createdAt: number
  updatedAt: number
}

// Pipeline stage columns (kanban). Order matters for ‹ › moves.
const stageColumns: { id: Stage; label: string; color: string }[] = [
  { id: 'new', label: 'لید جدید', color: '#7a8fae' },
  { id: 'review', label: 'در حال بررسی', color: '#e7a14a' },
  { id: 'offered', label: 'پیشنهاد داده‌شده', color: 'var(--gold)' },
  { id: 'contract', label: 'قرارداد', color: '#5fd98a' },
  { id: 'lost', label: 'از دست‌رفته', color: '#e74c3c' },
]

const navItems = [
  { id: 'dashboard', icon: '◈', label: 'داشبورد' },
  { id: 'listings', icon: '◰', label: 'فایل‌ها' },
  { id: 'pipeline', icon: '◴', label: 'پایپ‌لاین CRM' },
  { id: 'tasks', icon: '✓', label: 'وظایف' },
  { id: 'calendar', icon: '◫', label: 'تقویم' },
]

const kpis = [
  { label: 'لیدهای فعال', value: '۲۴', change: '+۳', changeDir: 'up', icon: '◈' },
  { label: 'معاملات ماه', value: '۷', change: '+۲', changeDir: 'up', icon: '◰' },
  { label: 'درآمد ماه', value: '۸۵ م.ت', change: '+۱۲٪', changeDir: 'up', icon: '◴' },
  { label: 'نرخ تبدیل', value: '۲۹٪', change: '-۲٪', changeDir: 'down', icon: '◫' },
]

const salesData = [
  { month: 'بهمن', value: 45, deals: 4 },
  { month: 'اسفند', value: 62, deals: 5 },
  { month: 'فروردین', value: 38, deals: 3 },
  { month: 'اردیبهشت', value: 71, deals: 6 },
  { month: 'خرداد', value: 85, deals: 7 },
  { month: 'تیر', value: 58, deals: 5 },
]

const insights = [
  { icon: '✦', text: 'لید «رضا موسوی» ۳ روز است بدون پاسخ. پیگیری کنید.' },
  { icon: '◈', text: 'قیمت سعادت‌آباد ۴٪ این هفته رشد کرده. به لیدها اطلاع دهید.' },
  { icon: '◰', text: '۲ ملک با بودجه لید «شیوا حیدری» منطبق است.' },
]

const recentLeads = [
  { name: 'رضا موسوی', need: 'خرید · سعادت‌آباد', budget: '۲۰ میلیارد', status: 'داغ', statusColor: '#e74c3c', lastContact: '۳ روز پیش' },
  { name: 'شیوا حیدری', need: 'اجاره · ونک', budget: '۱۵ م.ت', status: 'گرم', statusColor: '#e7a14a', lastContact: 'دیروز' },
  { name: 'کاوه اسدی', need: 'خرید · جردن', budget: '۱۵ میلیارد', status: 'سرد', statusColor: '#7a8fae', lastContact: 'هفته پیش' },
  { name: 'نیلوفر رشیدی', need: 'پیش‌فروش · شهرک غرب', budget: '۱۸ میلیارد', status: 'گرم', statusColor: '#e7a14a', lastContact: 'امروز' },
]

const todayTasksData = [
  { done: false, text: 'تماس با رضا موسوی برای پیگیری', time: '۱۰:۰۰' },
  { done: true, text: 'ارسال قرارداد به خانواده احمدی', time: '۱۱:۳۰' },
  { done: false, text: 'بازدید ملک سعادت‌آباد با شیوا حیدری', time: '۱۴:۰۰' },
  { done: false, text: 'تنظیم آگهی جدید برج آرین', time: '۱۶:۳۰' },
]

const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه']
const weekDates = ['۱۵', '۱۶', '۱۷', '۱۸', '۱۹', '۲۰', '۲۱']
const calendarEvents = [
  { day: 0, time: '۱۰:۰۰', title: 'بازدید سعادت‌آباد', duration: 1.5, color: 'var(--gold)' },
  { day: 1, time: '۱۱:۳۰', title: 'جلسه با خانواده احمدی', duration: 1, color: '#7a8fae' },
  { day: 2, time: '۱۴:۰۰', title: 'بازدید پنت‌هاوس', duration: 2, color: '#5fd98a' },
  { day: 3, time: '۱۰:۰۰', title: 'تماس با رضا موسوی', duration: 0.5, color: '#e7a14a' },
  { day: 4, time: '۱۶:۰۰', title: 'امضای قرارداد', duration: 1, color: '#e74c3c' },
]

const viewTitles: Record<View, string> = {
  dashboard: 'داشبورد',
  listings: 'فایل‌های ملکی',
  pipeline: 'پایپ‌لاین CRM',
  tasks: 'وظایف',
  calendar: 'تقویم هفتگی',
}

function getInitials(name: string) {
  return name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)
}

const avatarGradients = [
  'linear-gradient(135deg,#c9a84c,#e8c96d)',
  'linear-gradient(135deg,#7a8fae,#a0b4cc)',
  'linear-gradient(135deg,#5fd98a,#3ab06a)',
  'linear-gradient(135deg,#e7a14a,#c97c2a)',
  'linear-gradient(135deg,#e74c3c,#c0392b)',
]

function getGradient(name: string) {
  return avatarGradients[name.charCodeAt(0) % avatarGradients.length]
}

const persianDigits = '۰۱۲۳۴۵۶۷۸۹'

function persianToLatin(str: string) {
  return str.split('').map(c => {
    const idx = persianDigits.indexOf(c)
    return idx >= 0 ? String(idx) : c
  }).join('')
}

function timeToMinutesFrom9(timeStr: string) {
  const latin = persianToLatin(timeStr)
  const [h, m] = latin.split(':').map(Number)
  return (h - 9) * 60 + (m || 0)
}

const priorityColor: Record<string, string> = { high: '#e74c3c', medium: '#e7a14a', low: '#5fd98a' }
const calendarHours = Array.from({ length: 10 }, (_, i) => i + 9)

// Display label for a task's time: its due text, else creation date.
function taskTimeLabel(t: Task): string {
  if (t.due) return t.due
  try { return new Date(t.createdAt).toLocaleDateString('fa-IR') } catch { return 'بدون زمان' }
}

export default function CRMPage() {
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [todayTasks, setTodayTasks] = useState(todayTasksData)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  // Real scraped listings for the "فایل‌ها" view.
  const [listings, setListings] = useState<ContentItem[]>([])
  const [listingsLoaded, setListingsLoaded] = useState(false)

  // Real CRM leads for the pipeline (kanban) and dashboard recent-leads.
  const [leads, setLeads] = useState<Lead[]>([])

  // Real neighbourhood growth for the dashboard insights card.
  const [growth, setGrowth] = useState<number | null>(null)

  // AI assistant modal state.
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiReply, setAiReply] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Load persisted tasks on mount.
  useEffect(() => {
    fetch('/api/crm/tasks')
      .then(r => r.ok ? r.json() : { tasks: [] })
      .then(d => setTasks(Array.isArray(d.tasks) ? d.tasks : []))
      .catch(() => {})
  }, [])

  // Load real CRM leads on mount.
  useEffect(() => {
    fetch('/api/crm/leads')
      .then(r => r.ok ? r.json() : { leads: [] })
      .then(d => setLeads(Array.isArray(d.leads) ? d.leads : []))
      .catch(() => {})
  }, [])

  // Load real listings on mount.
  useEffect(() => {
    fetchContent('listing', undefined, 20)
      .then(items => setListings(items))
      .catch(() => {})
      .finally(() => setListingsLoaded(true))
  }, [])

  // Load real neighbourhood price growth (سعادت‌آباد، تهران) from the market trend.
  useEffect(() => {
    fetch('/api/market/stats?city=' + encodeURIComponent('تهران') + '&district=' + encodeURIComponent('سعادت‌آباد'))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const trend: { avg: number }[] = d?.stats?.trend || []
        if (trend.length >= 2) {
          const first = trend[0].avg, last = trend[trend.length - 1].avg
          if (first > 0) setGrowth(Math.round(((last - first) / first) * 100))
        }
      })
      .catch(() => {})
  }, [])

  const toggleTheme = () => {
    const html = document.documentElement
    if (theme === 'dark') {
      html.classList.add('light')
      setTheme('light')
    } else {
      html.classList.remove('light')
      setTheme('dark')
    }
  }

  const addTask = async () => {
    const title = newTaskText.trim()
    if (!title) return
    setNewTaskText('')
    try {
      const r = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority: 'medium' }),
      })
      if (r.ok) {
        const { task } = await r.json()
        if (task) setTasks(prev => [task, ...prev])
      }
    } catch {}
  }

  const toggleTask = (id: string) => {
    // optimistic
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
    fetch('/api/crm/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    fetch('/api/crm/tasks?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {})
  }

  // Create a lead via a simple prompt flow, then refresh from state.
  const addLead = async () => {
    const name = window.prompt('نام لید:')?.trim()
    if (!name) return
    const need = window.prompt('نیاز (مثلاً خرید · سعادت‌آباد):')?.trim() || undefined
    const budget = window.prompt('بودجه (مثلاً ۲۰ میلیارد):')?.trim() || undefined
    const phone = window.prompt('تلفن:')?.trim() || undefined
    try {
      const r = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, need, budget, phone }),
      })
      if (r.ok) {
        const { lead } = await r.json()
        if (lead) setLeads(prev => [lead, ...prev])
      }
    } catch {}
  }

  // Move a lead to a new stage (optimistic) and PATCH the backend.
  const moveLead = (id: string, stage: Stage) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l))
    fetch('/api/crm/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage }),
    }).catch(() => {})
  }

  // Shift a lead one column left/right in the pipeline order.
  const shiftLead = (lead: Lead, dir: -1 | 1) => {
    const idx = stageColumns.findIndex(c => c.id === lead.stage)
    const next = stageColumns[idx + dir]
    if (next) moveLead(lead.id, next.id)
  }

  const deleteLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id))
    fetch('/api/crm/leads?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {})
  }

  const runAi = async () => {
    const input = aiInput.trim()
    if (!input || aiLoading) return
    setAiLoading(true)
    setAiReply('')
    try {
      const r = await fetch('/api/ai/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'chat', input }),
      })
      const d = await r.json()
      setAiReply(d.text || d.error || 'پاسخی دریافت نشد.')
    } catch {
      setAiReply('خطا در ارتباط با دستیار.')
    } finally {
      setAiLoading(false)
    }
  }

  // Dashboard "recent leads" — real leads when present, else the original demo copy.
  const stageMeta: Record<Stage, { status: string; color: string }> = {
    new: { status: 'سرد', color: '#7a8fae' },
    review: { status: 'گرم', color: '#e7a14a' },
    offered: { status: 'داغ', color: '#e74c3c' },
    contract: { status: 'قرارداد', color: '#5fd98a' },
    lost: { status: 'از دست‌رفته', color: '#7a8fae' },
  }
  const recentLeadsLive = leads.length > 0
    ? leads.slice(0, 5).map(l => ({
        name: l.name,
        need: l.need || '—',
        budget: l.budget || '—',
        status: stageMeta[l.stage].status,
        statusColor: stageMeta[l.stage].color,
        lastContact: (() => { try { return new Date(l.updatedAt).toLocaleDateString('fa-IR') } catch { return '—' } })(),
      }))
    : recentLeads

  // Real growth sentence when available, else the original copy.
  const insightsLive = insights.map(ins =>
    ins.text.startsWith('قیمت سعادت‌آباد') && growth !== null
      ? { ...ins, text: `قیمت سعادت‌آباد ${growth >= 0 ? '+' : ''}${growth}٪ تغییر کرده (بر اساس داده‌های واقعی). به لیدها اطلاع دهید.` }
      : ins
  )

  const maxSales = Math.max(...salesData.map(d => d.value))

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>
      <PanelReturnBar tool="CRM و مشتریان" />

      {/* ===== SIDEBAR ===== */}
      <aside className="mjc-side" style={{
        width: 248,
        flexShrink: 0,
        background: 'var(--bg2)',
        borderLeft: '1px solid var(--line)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 18px -6px var(--gold)',
              flexShrink: 0,
            }}>
              <div style={{ width: 14, height: 14, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 3 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>ملک‌جت</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>میز کار مشاور</div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = activeView === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as View)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive ? 'var(--goldDim)' : 'transparent',
                  color: isActive ? 'var(--gold)' : 'var(--muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14,
                  textAlign: 'right',
                  transition: 'all 0.15s',
                  marginBottom: 2,
                  fontFamily: 'Vazirmatn, system-ui, sans-serif',
                }}
              >
                <span style={{ fontSize: 16, opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                <span className="mjc-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                {isActive && (
                  <span style={{
                    width: 5, height: 5,
                    borderRadius: '50%',
                    background: 'var(--gold)',
                    display: 'inline-block',
                  }} />
                )}
              </button>
            )
          })}
          <a href="/content" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600, fontSize: 14, marginTop: 4, border: '1px solid rgba(212,175,55,0.25)' }}>
            <span style={{ fontSize: 16 }}>✎</span>
            <span className="mjc-sidelabel">مقالات و وبلاگ</span>
          </a>
          <a href="/website-builder" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600, fontSize: 14, marginTop: 4, border: '1px solid rgba(212,175,55,0.25)' }}>
            <span style={{ fontSize: 16 }}>◳</span>
            <span className="mjc-sidelabel">وب‌سایت من (سایت‌ساز)</span>
          </a>

          {/* AI Promo */}
          <div style={{
            margin: '16px 8px 0',
            border: '1px solid var(--gold)',
            borderRadius: 14,
            padding: 14,
            background: 'var(--goldDim)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 }}>✦ دستیار هوشمند</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>پیشنهادهای هوشمند برای لیدهای شما</div>
            <button style={{
              marginTop: 10, width: '100%', padding: '8px',
              borderRadius: 8, background: 'var(--gold)', border: 'none',
              color: '#16140f', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              fontFamily: 'Vazirmatn, system-ui, sans-serif',
            }}>فعال‌سازی</button>
          </div>
        </nav>

        {/* Agent profile */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#16140f',
            flexShrink: 0,
          }}>سم</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>سارا محمدی</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>مشاور ارشد</div>
          </div>
          <button
            onClick={toggleTheme}
            title="تغییر تم"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--line)',
              color: 'var(--text)', cursor: 'pointer', fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          backdropFilter: 'blur(16px)',
          background: 'var(--navbg)',
          borderBottom: '1px solid var(--line)',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>{viewTitles[activeView]}</h2>
          <input
            placeholder="جستجو..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              fontSize: 13,
              width: 200,
              outline: 'none',
              fontFamily: 'Vazirmatn, system-ui, sans-serif',
            }}
          />
          <button
            onClick={() => setAiOpen(true)}
            style={{
              padding: '8px 16px', borderRadius: 10,
              background: 'var(--goldDim)', border: '1px solid var(--gold)',
              color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Vazirmatn, system-ui, sans-serif',
            }}>✦ دستیار</button>
          <button style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--surface)', border: '1px solid var(--line)',
            color: 'var(--text)', cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🔔</button>
        </div>

        {/* Content */}
        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>

          {/* ==================== DASHBOARD ==================== */}
          {activeView === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* KPI Cards */}
              <div className="mjc-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {kpis.map((kpi, i) => (
                  <div key={i} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 16,
                    padding: 20,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: 10, left: 14,
                      fontSize: 48, opacity: 0.05, color: 'var(--gold)',
                      fontWeight: 900, userSelect: 'none', lineHeight: 1,
                    }}>{kpi.icon}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{kpi.label}</span>
                      <span style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: 'var(--goldDim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, color: 'var(--gold)',
                      }}>{kpi.icon}</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.5px' }}>{kpi.value}</div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 600,
                      color: kpi.changeDir === 'up' ? '#5fd98a' : '#e74c3c',
                      background: kpi.changeDir === 'up' ? 'rgba(95,217,138,0.12)' : 'rgba(231,76,60,0.12)',
                      padding: '3px 8px', borderRadius: 6,
                    }}>
                      <span>{kpi.changeDir === 'up' ? '↑' : '↓'}</span>
                      <span>{kpi.change} این ماه</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar Chart + AI Insights */}
              <div className="mjc-2col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

                {/* Sales Bar Chart */}
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 24,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>عملکرد فروش</h3>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>۶ ماه گذشته</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 168, paddingTop: 32 }}>
                    {salesData.map((d, i) => {
                      const pct = (d.value / maxSales) * 100
                      const isLast = i === salesData.length - 1
                      return (
                        <div key={i} style={{
                          flex: 1,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: 6,
                          height: '100%', justifyContent: 'flex-end',
                        }}>
                          <span style={{
                            fontSize: 11, color: 'var(--gold)',
                            fontWeight: 700, opacity: isLast ? 1 : 0.65,
                          }}>{d.deals}</span>
                          <div style={{
                            width: '100%',
                            height: `${pct}%`,
                            background: isLast
                              ? 'linear-gradient(180deg,var(--gold2),var(--gold))'
                              : 'linear-gradient(180deg,rgba(201,168,76,0.55),rgba(201,168,76,0.28))',
                            borderRadius: '6px 6px 0 0',
                            position: 'relative',
                            minHeight: 8,
                          }}>
                            {isLast && (
                              <div style={{
                                position: 'absolute', top: -26, left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'var(--gold)', color: '#16140f',
                                fontSize: 10, fontWeight: 700,
                                padding: '2px 6px', borderRadius: 4,
                                whiteSpace: 'nowrap',
                              }}>{d.value} م.ت</div>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{d.month}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* AI Insights */}
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--gold)',
                  borderRadius: 16,
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <span style={{ fontSize: 16, color: 'var(--gold)' }}>✦</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>بینش‌های هوش مصنوعی</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {insightsLive.map((ins, i) => (
                      <div key={i} style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'var(--goldDim)',
                        border: '1px solid rgba(201,168,76,0.2)',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                      }}>
                        <span style={{ color: 'var(--gold)', fontSize: 14, flexShrink: 0, marginTop: 2 }}>{ins.icon}</span>
                        <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8 }}>{ins.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Leads + Today Tasks */}
              <div className="mjc-dash" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>

                {/* Recent Leads */}
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>لیدهای اخیر</h3>
                    <button
                      onClick={() => setActiveView('pipeline')}
                      style={{
                        fontSize: 12, color: 'var(--gold)',
                        background: 'none', border: 'none',
                        cursor: 'pointer', fontFamily: 'Vazirmatn, system-ui, sans-serif',
                      }}
                    >مشاهده همه ←</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recentLeadsLive.map((lead, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: getGradient(lead.name),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: '#16140f',
                          flexShrink: 0,
                        }}>{getInitials(lead.name)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{lead.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{lead.need}</div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: lead.statusColor, display: 'inline-block',
                            }} />
                            <span style={{ fontSize: 12, color: lead.statusColor, fontWeight: 600 }}>{lead.status}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{lead.lastContact}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Today's Tasks */}
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>وظایف امروز</h3>
                    <span style={{
                      fontSize: 11, background: 'var(--goldDim)',
                      color: 'var(--gold)', padding: '2px 8px',
                      borderRadius: 6, fontWeight: 600,
                    }}>{todayTasks.filter(t => !t.done).length} باقی‌مانده</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {todayTasks.map((task, i) => (
                      <div
                        key={i}
                        onClick={() => setTodayTasks(prev => prev.map((t, j) => j === i ? { ...t, done: !t.done } : t))}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'var(--bg)',
                          border: '1px solid var(--line)',
                          cursor: 'pointer',
                          opacity: task.done ? 0.6 : 1,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 5,
                          border: task.done ? '2px solid #5fd98a' : '2px solid var(--line2)',
                          background: task.done ? '#5fd98a' : 'transparent',
                          flexShrink: 0, marginTop: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {task.done && <span style={{ color: '#16140f', fontSize: 11, fontWeight: 900 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 12, fontWeight: 500,
                            textDecoration: task.done ? 'line-through' : 'none',
                            color: task.done ? 'var(--muted)' : 'var(--text)',
                            lineHeight: 1.5,
                          }}>{task.text}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{task.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== LISTINGS ==================== */}
          {activeView === 'listings' && (
            <div className="mjc-table" style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '18px 20px',
                borderBottom: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>فایل‌های ملکی من</h3>
                <button style={{
                  padding: '8px 16px', borderRadius: 10,
                  background: 'var(--gold)', border: 'none',
                  color: '#16140f', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Vazirmatn, system-ui, sans-serif',
                }}>+ افزودن فایل</button>
              </div>

              {/* Table Header */}
              <div className="mjc-row" style={{
                display: 'grid',
                gridTemplateColumns: '2fr 120px 150px 80px 1fr',
                padding: '11px 20px',
                background: 'var(--bg2)',
                borderBottom: '1px solid var(--line)',
              }}>
                {['ملک', 'وضعیت', 'قیمت', 'بازدید', 'پیشنهاد هوش مصنوعی'].map((h, i) => (
                  <div key={i} style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h}</div>
                ))}
              </div>

              {listingsLoaded && listings.length === 0 && (
                <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                  هنوز فایلی ثبت نشده است.
                </div>
              )}

              {listings.map((item, i) => {
                const active = item.status !== 'rejected' && item.status !== 'duplicate'
                const statusLabel = active ? 'فعال' : 'بایگانی'
                const statusColor = active ? '#5fd98a' : 'var(--faint)'
                const suggestion = item.location || item.sourceName || '—'
                return (
                  <div
                    key={item.id}
                    className="mjc-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 120px 150px 80px 1fr',
                      padding: '14px 20px',
                      borderBottom: i < listings.length - 1 ? '1px solid var(--line)' : 'none',
                      background: i % 2 === 1 ? 'rgba(255,255,255,0.018)' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                    <div>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: statusColor,
                        background: `${statusColor}22`,
                        padding: '3px 10px', borderRadius: 6,
                      }}>{statusLabel}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.price || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{item.rating ? '★' : '👁'}</span>
                      <span style={{ fontSize: 13 }}>{item.rating || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--gold)', fontSize: 13 }}>✦</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{suggestion}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ==================== PIPELINE ==================== */}
          {activeView === 'pipeline' && (
            <div>
              {/* Pipeline toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{leads.length} لید در پایپ‌لاین</span>
                <button
                  onClick={addLead}
                  style={{
                    padding: '8px 16px', borderRadius: 10,
                    background: 'var(--gold)', border: 'none',
                    color: '#16140f', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Vazirmatn, system-ui, sans-serif',
                  }}
                >＋ لید جدید</button>
              </div>

              <div className="mjc-kanban" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
                {stageColumns.map((col, colIdx) => {
                  const colLeads = leads.filter(l => l.stage === col.id)
                  return (
                  <div key={col.id} style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column' }}>

                    {/* Column Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 12, padding: '10px 14px',
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      borderTop: `3px solid ${col.color}`,
                    }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{col.label}</span>
                      <span style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: `${col.color}22`,
                        color: col.color,
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{colLeads.length}</span>
                    </div>

                    {/* Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {colLeads.length === 0 && (
                        <div style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', padding: '12px 0' }}>—</div>
                      )}
                      {colLeads.map(card => (
                        <div key={card.id} style={{
                          background: 'var(--surface)',
                          borderRadius: 12,
                          padding: 14,
                          border: '1px solid var(--line)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%',
                              background: getGradient(card.name),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: '#16140f',
                              flexShrink: 0,
                            }}>{getInitials(card.name)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{card.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{card.phone || '—'}</div>
                            </div>
                            <button
                              onClick={() => deleteLead(card.id)}
                              title="حذف لید"
                              style={{
                                width: 22, height: 22, borderRadius: 6,
                                background: 'var(--bg)', border: '1px solid var(--line)',
                                color: 'var(--muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, fontFamily: 'Vazirmatn, system-ui, sans-serif',
                              }}
                            >×</button>
                          </div>
                          {card.need && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{card.need}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{card.budget || '—'}</span>
                            {typeof card.score === 'number' && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                background: 'var(--goldDim)',
                                border: '1px solid rgba(201,168,76,0.3)',
                                borderRadius: 8, padding: '3px 8px',
                              }}>
                                <span style={{ fontSize: 10, color: 'var(--gold)' }}>✦</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>{card.score}</span>
                              </div>
                            )}
                          </div>
                          {/* Stage move controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => shiftLead(card, -1)}
                              disabled={colIdx === 0}
                              title="مرحله قبل"
                              style={{
                                width: 26, height: 26, borderRadius: 7,
                                background: 'var(--bg)', border: '1px solid var(--line)',
                                color: 'var(--text)', cursor: colIdx === 0 ? 'default' : 'pointer',
                                opacity: colIdx === 0 ? 0.4 : 1, fontSize: 13, lineHeight: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: 'Vazirmatn, system-ui, sans-serif',
                              }}
                            >›</button>
                            <select
                              value={card.stage}
                              onChange={e => moveLead(card.id, e.target.value as Stage)}
                              style={{
                                flex: 1, padding: '5px 8px', borderRadius: 7,
                                background: 'var(--bg)', border: '1px solid var(--line)',
                                color: 'var(--text)', fontSize: 11.5, outline: 'none',
                                fontFamily: 'Vazirmatn, system-ui, sans-serif', cursor: 'pointer',
                              }}
                            >
                              {stageColumns.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <button
                              onClick={() => shiftLead(card, 1)}
                              disabled={colIdx === stageColumns.length - 1}
                              title="مرحله بعد"
                              style={{
                                width: 26, height: 26, borderRadius: 7,
                                background: 'var(--bg)', border: '1px solid var(--line)',
                                color: 'var(--text)', cursor: colIdx === stageColumns.length - 1 ? 'default' : 'pointer',
                                opacity: colIdx === stageColumns.length - 1 ? 0.4 : 1, fontSize: 13, lineHeight: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: 'Vazirmatn, system-ui, sans-serif',
                              }}
                            >‹</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ==================== TASKS ==================== */}
          {activeView === 'tasks' && (
            <div style={{ maxWidth: 720 }}>

              {/* Add Task */}
              <div style={{
                display: 'flex', gap: 10, marginBottom: 20,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 14, padding: 14,
              }}>
                <input
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="وظیفه جدید اضافه کنید..."
                  style={{
                    flex: 1, padding: '8px 12px',
                    borderRadius: 10, background: 'var(--bg)',
                    border: '1px solid var(--line)', color: 'var(--text)',
                    fontSize: 13, outline: 'none',
                    fontFamily: 'Vazirmatn, system-ui, sans-serif',
                  }}
                />
                <button
                  onClick={addTask}
                  style={{
                    padding: '8px 20px', borderRadius: 10,
                    background: 'var(--gold)', border: 'none',
                    color: '#16140f', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', fontFamily: 'Vazirmatn, system-ui, sans-serif',
                  }}
                >+ افزودن</button>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'کل', count: tasks.length, color: 'var(--text)' },
                  { label: 'انجام‌شده', count: tasks.filter(t => t.done).length, color: '#5fd98a' },
                  { label: 'باقی‌مانده', count: tasks.filter(t => !t.done).length, color: '#e7a14a' },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, padding: '12px 16px',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 10, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Task List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px',
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      cursor: 'pointer',
                      opacity: task.done ? 0.65 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 6,
                      border: task.done ? '2px solid #5fd98a' : '2px solid var(--line2)',
                      background: task.done ? '#5fd98a' : 'transparent',
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {task.done && <span style={{ color: '#16140f', fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 500,
                        textDecoration: task.done ? 'line-through' : 'none',
                      }}>{task.title}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, color: 'var(--muted)',
                        background: 'var(--bg)',
                        padding: '3px 10px', borderRadius: 6,
                        border: '1px solid var(--line)',
                      }}>{taskTimeLabel(task)}</span>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: priorityColor[task.priority || 'medium'],
                        display: 'inline-block',
                        boxShadow: `0 0 6px ${priorityColor[task.priority || 'medium']}88`,
                      }} />
                      <button
                        onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                        title="حذف"
                        style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: 'var(--bg)', border: '1px solid var(--line)',
                          color: 'var(--muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Vazirmatn, system-ui, sans-serif',
                        }}
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== CALENDAR ==================== */}
          {activeView === 'calendar' && (
            <div className="mjc-cal" style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              {/* Calendar toolbar */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>هفته جاری — خرداد ۱۴۰۴</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: 'var(--bg)', border: '1px solid var(--line)',
                    color: 'var(--text)', fontSize: 13, cursor: 'pointer',
                    fontFamily: 'Vazirmatn, system-ui, sans-serif',
                  }}>← قبلی</button>
                  <button style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: 'var(--goldDim)', border: '1px solid var(--gold)',
                    color: 'var(--gold)', fontSize: 13, cursor: 'pointer', fontWeight: 600,
                    fontFamily: 'Vazirmatn, system-ui, sans-serif',
                  }}>امروز</button>
                  <button style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: 'var(--bg)', border: '1px solid var(--line)',
                    color: 'var(--text)', fontSize: 13, cursor: 'pointer',
                    fontFamily: 'Vazirmatn, system-ui, sans-serif',
                  }}>بعدی →</button>
                </div>
              </div>

              <div className="mjc-cal-inner" style={{ display: 'flex' }}>
                {/* Time axis */}
                <div style={{ width: 56, flexShrink: 0, borderLeft: '1px solid var(--line)', paddingTop: 48 }}>
                  {calendarHours.map(h => (
                    <div key={h} style={{
                      height: 60,
                      display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'flex-end',
                      paddingLeft: 8, paddingTop: 4,
                      fontSize: 11, color: 'var(--faint)',
                    }}>{h}:۰۰</div>
                  ))}
                </div>

                {/* Day columns */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {weekDays.map((day, di) => (
                    <div key={di} style={{
                      borderLeft: di < weekDays.length - 1 ? '1px solid var(--line)' : 'none',
                    }}>
                      {/* Day header */}
                      <div style={{
                        height: 48,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        borderBottom: '1px solid var(--line)',
                        background: di === 0 ? 'var(--goldDim)' : 'transparent',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{day}</div>
                        <div style={{
                          fontSize: 15, fontWeight: 700, marginTop: 2,
                          color: di === 0 ? 'var(--gold)' : 'var(--text)',
                        }}>{weekDates[di]}</div>
                      </div>

                      {/* Hour grid + events */}
                      <div style={{ position: 'relative' }}>
                        {calendarHours.map(h => (
                          <div key={h} style={{
                            height: 60,
                            borderBottom: '1px solid var(--line)',
                          }} />
                        ))}
                        {calendarEvents.filter(ev => ev.day === di).map((ev, ei) => {
                          const topPx = timeToMinutesFrom9(ev.time)
                          const heightPx = ev.duration * 60
                          return (
                            <div key={ei} style={{
                              position: 'absolute',
                              top: topPx,
                              left: 3, right: 3,
                              height: Math.max(heightPx - 4, 28),
                              background: `${ev.color}22`,
                              border: `1px solid ${ev.color}66`,
                              borderRadius: 6,
                              padding: '4px 6px',
                              overflow: 'hidden',
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: ev.color, lineHeight: 1.4 }}>{ev.time}</div>
                              <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.4, marginTop: 1 }}>{ev.title}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ===== AI ASSISTANT MODAL ===== */}
      {aiOpen && (
        <div
          onClick={() => setAiOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520,
              background: 'var(--surface)', border: '1px solid var(--gold)',
              borderRadius: 16, padding: 22,
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 20px 60px -20px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, color: 'var(--gold)' }}>✦</span>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', flex: 1 }}>دستیار هوشمند ملک‌جت</h3>
              <button
                onClick={() => setAiOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'var(--bg)', border: '1px solid var(--line)',
                  color: 'var(--muted)', cursor: 'pointer', fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>

            {aiReply && (
              <div style={{
                fontSize: 13, lineHeight: 1.9, color: 'var(--text)',
                background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 10, padding: '12px 14px', whiteSpace: 'pre-wrap',
                maxHeight: 300, overflowY: 'auto',
              }}>{aiReply}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runAi()}
                placeholder="سوال خود را بپرسید…"
                disabled={aiLoading}
                style={{
                  flex: 1, padding: '10px 14px',
                  borderRadius: 10, background: 'var(--bg)',
                  border: '1px solid var(--line)', color: 'var(--text)',
                  fontSize: 13, outline: 'none',
                  fontFamily: 'Vazirmatn, system-ui, sans-serif',
                }}
              />
              <button
                onClick={runAi}
                disabled={aiLoading}
                style={{
                  padding: '10px 20px', borderRadius: 10,
                  background: 'var(--gold)', border: 'none',
                  color: '#16140f', fontWeight: 700, fontSize: 13,
                  cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.6 : 1,
                  fontFamily: 'Vazirmatn, system-ui, sans-serif',
                }}
              >{aiLoading ? '…' : 'بپرس'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
