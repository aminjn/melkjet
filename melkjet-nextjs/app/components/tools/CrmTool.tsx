'use client'
import { useState, useEffect } from 'react'
import { fetchContent, type ContentItem } from '@/app/lib/content-display'
import PanelReturnBar from '@/app/components/PanelReturnBar'

export type CrmView = 'dashboard' | 'listings' | 'pipeline' | 'tasks' | 'calendar'

// Sidebar nav entries (one per view). Persian labels match the standalone /crm sidebar.
export const CRM_VIEWS: { id: CrmView; label: string; icon: string }[] = [
  { id: 'dashboard', icon: '◈', label: 'داشبورد' },
  { id: 'listings', icon: '◰', label: 'فایل‌ها' },
  { id: 'pipeline', icon: '◴', label: 'پایپ‌لاین CRM' },
  { id: 'tasks', icon: '✓', label: 'وظایف' },
  { id: 'calendar', icon: '◫', label: 'تقویم' },
]

// Mirrors app/lib/crm-store.ts Task (the API shape). `dueTs` is the epoch ms of the due moment.
interface Task {
  id: string
  done: boolean
  title: string
  due?: string
  dueTs?: number
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

const navItems = CRM_VIEWS

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

const viewTitles: Record<CrmView, string> = {
  dashboard: 'داشبورد',
  listings: 'فایل‌های ملکی',
  pipeline: 'پایپ‌لاین CRM',
  tasks: 'وظایف',
  calendar: 'تقویم',
}

// ── تقویم جلالی (بدون وابستگی) — مثل app/pros/page.tsx ──
const J_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const J_WEEK = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
const JF = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric' })
function jParts(d: Date): { jy: number; jm: number; jd: number } {
  const p = JF.formatToParts(d); const g = (t: string) => Number(p.find(x => x.type === t)?.value || 0)
  return { jy: g('year'), jm: g('month'), jd: g('day') }
}
// First Gregorian Date of the Jalali month that is `offset` months from this month.
function firstOfJMonth(offset: number): Date {
  let d = new Date(); const t = jParts(d)
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (t.jd - 1))
  let o = offset
  while (o > 0) { const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 32); const p = jParts(n); d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - (p.jd - 1)); o-- }
  while (o < 0) { const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); const p = jParts(n); d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - (p.jd - 1)); o++ }
  return d
}
// Build the leading-blank + day cells of a Jalali month (cells hold real Gregorian Dates).
function jMonthCells(offset: number): { first: Date; jy: number; jm: number; cells: (Date | null)[] } {
  const first = firstOfJMonth(offset)
  const { jy, jm } = jParts(first)
  const lead = (first.getDay() + 1) % 7 // شنبه‌محور
  const cells: (Date | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let dd = new Date(first); jParts(dd).jm === jm; dd = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() + 1)) cells.push(new Date(dd))
  while (cells.length % 7 !== 0) cells.push(null)
  return { first, jy, jm, cells }
}
const FA = (n: number) => n.toLocaleString('fa-IR')
const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n)
// Display label «jY/jM/jD HH:MM» in Persian digits from a Gregorian Date.
function jDateTimeLabel(d: Date): string {
  const { jy, jm, jd } = jParts(d)
  return `${FA(jy)}/${FA(jm).padStart(2, '۰')}/${FA(jd).padStart(2, '۰')} ${FA(d.getHours()).padStart(2, '۰')}:${FA(d.getMinutes()).padStart(2, '۰')}`
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

const priorityColor: Record<string, string> = { high: '#e74c3c', medium: '#e7a14a', low: '#5fd98a' }
const priorityLabel: Record<string, string> = { high: 'بالا', medium: 'متوسط', low: 'پایین' }
const PRIORITIES: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low']

// Display label for a task's time: its due text, else creation date.
function taskTimeLabel(t: Task): string {
  if (t.due) return t.due
  try { return new Date(t.createdAt).toLocaleDateString('fa-IR') } catch { return 'بدون زمان' }
}

const FONT = 'Vazirmatn, system-ui, sans-serif'

// Sort key: tasks with a dueTs come first (ascending); those without go last.
function dueSortKey(t: Task): number {
  return typeof t.dueTs === 'number' ? t.dueTs : Number.MAX_SAFE_INTEGER
}

// ───── Jalali date+time picker popover ─────
// Builds the month grid FROM Gregorian Dates (no Jalali→Gregorian conversion).
// On day click, combines the cell's real Gregorian Date with the chosen HH:MM.
function JalaliDateTimePicker({ value, onPick, onClose }: { value?: number; onPick: (ts: number, label: string) => void; onClose: () => void }) {
  const base = typeof value === 'number' ? new Date(value) : new Date()
  const [offset, setOffset] = useState(0)
  const [time, setTime] = useState(`${pad2(base.getHours())}:${pad2(base.getMinutes())}`)
  const { jy, jm, cells } = jMonthCells(offset)
  const todayKey = (() => { const t = jParts(new Date()); return `${t.jy}-${t.jm}-${t.jd}` })()
  const selKey = typeof value === 'number' ? (() => { const t = jParts(new Date(value)); return `${t.jy}-${t.jm}-${t.jd}` })() : ''
  const navBtn: React.CSSProperties = { padding: '5px 10px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontFamily: FONT }
  const choose = (d: Date) => {
    const [h, m] = time.split(':').map(Number)
    const picked = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0, 0, 0)
    onPick(picked.getTime(), jDateTimeLabel(picked))
  }
  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'absolute', zIndex: 60, top: 'calc(100% + 6px)', right: 0,
      width: 290, background: 'var(--surface)', border: '1px solid var(--gold)',
      borderRadius: 12, padding: 12, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.6)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{J_MONTHS[jm - 1]} {FA(jy)}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setOffset(o => o - 1)} style={navBtn}>→ قبل</button>
          <button onClick={() => setOffset(0)} style={{ ...navBtn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>امروز</button>
          <button onClick={() => setOffset(o => o + 1)} style={navBtn}>بعد ←</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {J_WEEK.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', fontWeight: 700, padding: '2px 0' }}>{w[0]}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const p = jParts(d)
          const key = `${p.jy}-${p.jm}-${p.jd}`
          const isToday = key === todayKey
          const isSel = key === selKey
          return (
            <button key={i} onClick={() => choose(d)} style={{
              aspectRatio: '1', borderRadius: 7, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: isToday || isSel ? 800 : 500,
              border: `1px solid ${isSel ? 'var(--gold)' : isToday ? 'var(--gold)' : 'var(--line)'}`,
              background: isSel ? 'var(--gold)' : isToday ? 'var(--goldDim)' : 'var(--bg)',
              color: isSel ? '#16140f' : isToday ? 'var(--gold)' : 'var(--text)',
            }}>{FA(p.jd)}</button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>ساعت</span>
        <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{
          flex: 1, padding: '6px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)',
          color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, direction: 'ltr',
        }} />
        <button onClick={onClose} style={{ ...navBtn, color: 'var(--muted)' }}>بستن</button>
      </div>
    </div>
  )
}

export interface CrmOwnListing { id: string; title: string; priceText: string; status: string; location?: string; published?: boolean; publicId?: string; sellerLeadId?: string; buyerLeadIds?: string[] }
export interface CrmLeadRef { id: string; name: string }

export default function CrmTool({ embedded = false, view: viewProp, onView, ownListings, leads: leadRefs, onAddListing, onEditListing, onDeleteListing, onSetListingStatus, onBulkDelete, onBulkStatus, onLinkLeads }: {
  embedded?: boolean; view?: CrmView; onView?: (v: CrmView) => void
  // وقتی این‌ها داده شوند، نمای «فایل‌ها» فایل‌های واقعیِ خودِ کاربر را نشان می‌دهد (نه آگهی‌های سراسری).
  ownListings?: CrmOwnListing[]
  leads?: CrmLeadRef[]
  onAddListing?: () => void
  onEditListing?: (id: string) => void
  onDeleteListing?: (id: string) => void
  onSetListingStatus?: (id: string, status: string) => void
  onBulkDelete?: (ids: string[]) => void
  onBulkStatus?: (ids: string[], status: string) => void
  onLinkLeads?: (listingId: string, sellerLeadId: string, buyerLeadIds: string[]) => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const toggleSel = (id: string) => setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const [leadOpen, setLeadOpen] = useState<string | null>(null)   // id فایلی که پنلِ اتصالِ لید بازست
  const [internalView, setInternalView] = useState<CrmView>('dashboard')
  const activeView: CrmView = viewProp ?? internalView
  const setActiveView = (v: CrmView) => { onView ? onView(v) : setInternalView(v) }
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [newTaskDueTs, setNewTaskDueTs] = useState<number | null>(null)
  const [newTaskDue, setNewTaskDue] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'today' | 'overdue' | 'done'>('all')
  // id of the task whose inline due/priority editor (date picker) is open.
  const [editingDueId, setEditingDueId] = useState<string | null>(null)
  // calendar view month offset + selected day key.
  const [calOffset, setCalOffset] = useState(0)
  const [calSelKey, setCalSelKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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
    const priority = newTaskPriority
    const dueTs = newTaskDueTs
    const due = newTaskDue
    setNewTaskText('')
    setNewTaskPriority('medium')
    setNewTaskDueTs(null)
    setNewTaskDue('')
    setPickerOpen(false)
    try {
      const r = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority, ...(dueTs !== null ? { due, dueTs } : {}) }),
      })
      if (r.ok) {
        const { task } = await r.json()
        if (task) setTasks(prev => [task, ...prev])
      }
    } catch {}
  }

  // Inline edit of a task's priority and/or due — PATCH with the editable fields.
  const patchTask = (id: string, patch: { priority?: 'high' | 'medium' | 'low'; due?: string; dueTs?: number }) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    fetch('/api/crm/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => {})
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
  const recentLeadsLive = leads.slice(0, 5).map(l => ({
    name: l.name,
    need: l.need || '—',
    budget: l.budget || '—',
    status: stageMeta[l.stage].status,
    statusColor: stageMeta[l.stage].color,
    lastContact: (() => { try { return new Date(l.updatedAt).toLocaleDateString('fa-IR') } catch { return '—' } })(),
  }))

  // Real growth sentence when available, else the original copy.
  const insightsLive = insights.map(ins =>
    ins.text.startsWith('قیمت سعادت‌آباد') && growth !== null
      ? { ...ins, text: `قیمت سعادت‌آباد ${growth >= 0 ? '+' : ''}${growth}٪ تغییر کرده (بر اساس داده‌های واقعی). به لیدها اطلاع دهید.` }
      : ins
  )

  const maxSales = Math.max(...salesData.map(d => d.value))

  // ───── Live, derived task collections (single source of truth) ─────
  const now = Date.now()
  const todayKeyG = (() => { const t = jParts(new Date()); return `${t.jy}-${t.jm}-${t.jd}` })()
  const isToday = (t: Task) => typeof t.dueTs === 'number' && (() => { const p = jParts(new Date(t.dueTs)); return `${p.jy}-${p.jm}-${p.jd}` === todayKeyG })()
  const isOverdue = (t: Task) => !t.done && typeof t.dueTs === 'number' && t.dueTs < now
  const openCount = tasks.filter(t => !t.done).length
  const todayCount = tasks.filter(t => !t.done && isToday(t)).length
  const overdueCount = tasks.filter(isOverdue).length
  const sortedTasks = [...tasks].sort((a, b) => dueSortKey(a) - dueSortKey(b))
  const todaysTasks = sortedTasks.filter(t => isToday(t))
  // per-stage lead breakdown for the dashboard
  const stageBreakdown = stageColumns.map(c => ({ ...c, count: leads.filter(l => l.stage === c.id).length }))

  // Filtered + sorted list for the Tasks view
  const filteredTasks = sortedTasks.filter(t => {
    if (taskFilter === 'today') return isToday(t)
    if (taskFilter === 'overdue') return isOverdue(t)
    if (taskFilter === 'done') return t.done
    return true
  })

  // The per-view content blocks — shared by both standalone (<main>) and embedded modes.
  const content = (
    <>
      {/* ==================== DASHBOARD ==================== */}
      {activeView === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* KPI Cards — real numbers from live data */}
          <div className="mjc-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'وظایف باز', value: openCount, sub: `${FA(todayCount)} امروز`, subColor: 'var(--gold)', icon: '✓' },
              { label: 'معوق', value: overdueCount, sub: overdueCount > 0 ? 'نیاز به پیگیری' : 'بدون معوقه', subColor: overdueCount > 0 ? '#e74c3c' : '#5fd98a', icon: '◴' },
              { label: 'کل لیدها', value: leads.length, sub: `${FA(stageBreakdown.find(s => s.id === 'contract')?.count || 0)} قرارداد`, subColor: '#5fd98a', icon: '◈' },
              { label: 'فایل‌های ملکی', value: ownListings ? ownListings.length : listings.length, sub: growth !== null ? `رشد منطقه ${growth >= 0 ? '+' : ''}${FA(growth)}٪` : 'فایل فعال', subColor: 'var(--gold)', icon: '◰' },
            ].map((kpi, i) => (
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
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.5px' }}>{FA(kpi.value)}</div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: kpi.subColor,
                  background: 'var(--bg)', border: '1px solid var(--line)',
                  padding: '3px 8px', borderRadius: 6,
                }}>
                  <span>{kpi.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Per-stage lead breakdown */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 16, padding: 20,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>پایپ‌لاین لیدها</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {stageBreakdown.map(s => (
                <div key={s.id} style={{
                  flex: '1 1 120px', minWidth: 120, background: 'var(--bg)',
                  border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px',
                  borderTop: `3px solid ${s.color}`,
                }}>
                  <div style={{ fontSize: 11.5, color: s.color, fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{FA(s.count)}</div>
                </div>
              ))}
            </div>
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
                {recentLeadsLive.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', padding: '18px 0' }}>هنوز لیدی ثبت نشده است.</div>
                )}
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
                }}>{FA(todaysTasks.filter(t => !t.done).length)} باقی‌مانده</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todaysTasks.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', padding: '18px 0' }}>وظیفه‌ای برای امروز ندارید.</div>
                )}
                {todaysTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 500,
                        textDecoration: task.done ? 'line-through' : 'none',
                        color: task.done ? 'var(--muted)' : 'var(--text)',
                        lineHeight: 1.5,
                      }}>{task.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{task.due || '—'}</div>
                    </div>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                      background: priorityColor[task.priority || 'medium'], display: 'inline-block',
                    }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LISTINGS ==================== */}
      {activeView === 'listings' && (ownListings
        // ── فایل‌های واقعیِ خودِ کاربر (قابلِ ویرایش/حذف/انتخابِ دسته‌ای) ──
        ? (() => {
          const STAT_LABEL: Record<string, string> = { active: 'فعال', sold: 'فروخته‌شده', rented: 'اجاره‌رفته' }
          const STAT_COLOR: Record<string, string> = { active: '#5fd98a', sold: 'var(--faint)', rented: 'var(--faint)' }
          const ids = ownListings.map(l => l.id)
          const allSel = ids.length > 0 && ids.every(id => selectedIds.has(id))
          const selCount = ids.filter(id => selectedIds.has(id)).length
          return (
            <div className="mjc-table" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>فایل‌های ملکی من ({ownListings.length.toLocaleString('fa-IR')})</h3>
                <button onClick={() => onAddListing?.()} style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--gold)', border: 'none', color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>+ افزودن فایل</button>
              </div>

              {/* نوار عملیاتِ دسته‌ای */}
              {selCount > 0 && (
                <div style={{ padding: '10px 20px', background: 'var(--goldDim)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5 }}>
                  <b style={{ color: 'var(--gold)' }}>{selCount.toLocaleString('fa-IR')} انتخاب‌شده</b>
                  <span style={{ flex: 1 }} />
                  <select onChange={e => { if (e.target.value) { onBulkStatus?.([...selectedIds].filter(id => ids.includes(id)), e.target.value); setSelectedIds(new Set()) } e.target.value = '' }} defaultValue="" style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}>
                    <option value="">تغییر وضعیت…</option>
                    <option value="active">فعال</option><option value="sold">فروخته‌شده</option><option value="rented">اجاره‌رفته</option>
                  </select>
                  <button onClick={() => { if (confirm(`${selCount} فایل حذف شود؟`)) { onBulkDelete?.([...selectedIds].filter(id => ids.includes(id))); setSelectedIds(new Set()) } }} style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>حذف انتخاب‌شده‌ها</button>
                </div>
              )}

              {/* Header */}
              <div className="mjc-row" style={{ display: 'grid', gridTemplateColumns: '28px 2fr 120px 130px 180px', padding: '11px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                <input type="checkbox" checked={allSel} onChange={() => setSelectedIds(allSel ? new Set() : new Set(ids))} />
                {['ملک', 'وضعیت', 'قیمت', 'عملیات'].map((h, i) => <div key={i} style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{h}</div>)}
              </div>

              {ownListings.length === 0 && <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>هنوز فایلی ثبت نکرده‌اید.</div>}

              {ownListings.map((l, i) => {
                const buyerCount = (l.buyerLeadIds || []).length
                const open = leadOpen === l.id
                const all = leadRefs || []
                return (
                <div key={l.id} style={{ borderBottom: i < ownListings.length - 1 ? '1px solid var(--line)' : 'none', background: selectedIds.has(l.id) ? 'var(--goldDim)' : (i % 2 === 1 ? 'rgba(255,255,255,0.018)' : 'transparent') }}>
                  <div className="mjc-row" style={{ display: 'grid', gridTemplateColumns: '28px 2fr 120px 130px 180px', padding: '12px 20px', alignItems: 'center' }}>
                    <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSel(l.id)} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                      {l.location && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.location}</div>}
                    </div>
                    <div>
                      <select value={l.status} onChange={e => onSetListingStatus?.(l.id, e.target.value)} style={{ fontSize: 11.5, fontWeight: 600, color: STAT_COLOR[l.status] || 'var(--text)', background: 'var(--bg)', border: `1px solid ${STAT_COLOR[l.status] || 'var(--line)'}`, borderRadius: 7, padding: '4px 8px', fontFamily: 'inherit', cursor: 'pointer' }}>
                        {['active', 'sold', 'rented'].map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{STAT_LABEL[s]}</option>)}
                      </select>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{l.priceText || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => setLeadOpen(open ? null : l.id)} style={{ padding: '5px 9px', borderRadius: 7, background: open ? 'var(--goldDim)' : 'var(--bg)', border: `1px solid ${open || l.sellerLeadId || buyerCount ? 'var(--gold)' : 'var(--line)'}`, color: 'var(--gold)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>🔗 لیدها{(l.sellerLeadId ? 1 : 0) + buyerCount > 0 ? ` (${((l.sellerLeadId ? 1 : 0) + buyerCount).toLocaleString('fa-IR')})` : ''}</button>
                      <button onClick={() => onEditListing?.(l.id)} style={{ padding: '5px 9px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>ویرایش</button>
                      <button onClick={() => { if (confirm('این فایل حذف شود؟')) onDeleteListing?.(l.id) }} style={{ padding: '5px 9px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: '#ef4444', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>حذف</button>
                      {l.published && l.publicId && <a href={`/property/${l.publicId}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--gold)', textDecoration: 'none' }}>↗</a>}
                    </div>
                  </div>
                  {/* پنلِ اتصالِ لیدها: یک لیدِ فروشنده + چند لیدِ خریدار */}
                  {open && (
                    <div style={{ padding: '6px 20px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {all.length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز لیدی ندارید — از بخش «لیدها» اضافه کنید.</div> : <>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>لیدِ فروشنده (یک نفر)</div>
                          <select value={l.sellerLeadId || ''} onChange={e => onLinkLeads?.(l.id, e.target.value, l.buyerLeadIds || [])} style={{ width: '100%', maxWidth: 320, padding: '8px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit' }}>
                            <option value="">— بدون لیدِ فروشنده —</option>
                            {all.map(ld => <option key={ld.id} value={ld.id}>{ld.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>لیدهای خریدار (چند نفر)</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {all.map(ld => {
                              const on = (l.buyerLeadIds || []).includes(ld.id)
                              return (
                                <button key={ld.id} onClick={() => { const cur = l.buyerLeadIds || []; const next = on ? cur.filter(x => x !== ld.id) : [...cur, ld.id]; onLinkLeads?.(l.id, l.sellerLeadId || '', next) }} style={{ padding: '5px 11px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}`, background: on ? 'var(--goldDim)' : 'var(--bg)', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500 }}>{on ? '✓ ' : ''}{ld.name}</button>
                              )
                            })}
                          </div>
                        </div>
                      </>}
                    </div>
                  )}
                </div>
              )})}
            </div>
          )
        })()
        // ── حالتِ پیش‌فرض (بدون ownListings): پیام راهنما به‌جای نشت‌دادنِ آگهی‌های سراسری ──
        : (
          <div className="mjc-table" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            فایل‌های شما در این بخش نمایش داده می‌شوند.
          </div>
        ))}

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
        <div style={{ maxWidth: 760 }}>

          {/* Add Task — title + Jalali date/time picker + priority */}
          <div style={{
            marginBottom: 20,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 14, padding: 14,
          }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="عنوان وظیفه جدید…"
                style={{
                  flex: '2 1 200px', padding: '8px 12px',
                  borderRadius: 10, background: 'var(--bg)',
                  border: '1px solid var(--line)', color: 'var(--text)',
                  fontSize: 13, outline: 'none', fontFamily: FONT,
                }}
              />
              {/* Date/time popover trigger */}
              <div style={{ position: 'relative', flex: '1 1 160px' }}>
                <button
                  onClick={() => setPickerOpen(o => !o)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 10,
                    background: 'var(--bg)', border: `1px solid ${newTaskDueTs !== null ? 'var(--gold)' : 'var(--line)'}`,
                    color: newTaskDueTs !== null ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer',
                    fontSize: 12.5, fontFamily: FONT, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >📅 {newTaskDue || 'انتخاب تاریخ و ساعت'}</button>
                {pickerOpen && (
                  <JalaliDateTimePicker
                    value={newTaskDueTs ?? undefined}
                    onPick={(ts, label) => { setNewTaskDueTs(ts); setNewTaskDue(label); setPickerOpen(false) }}
                    onClose={() => setPickerOpen(false)}
                  />
                )}
              </div>
              <select
                value={newTaskPriority}
                onChange={e => setNewTaskPriority(e.target.value as 'high' | 'medium' | 'low')}
                style={{
                  flex: '0 1 110px', padding: '8px 10px', borderRadius: 10,
                  background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)',
                  fontSize: 12.5, outline: 'none', fontFamily: FONT, cursor: 'pointer',
                }}
              >
                {PRIORITIES.map(p => <option key={p} value={p}>اولویت {priorityLabel[p]}</option>)}
              </select>
              <button
                onClick={addTask}
                disabled={!newTaskText.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 10,
                  background: 'var(--gold)', border: 'none',
                  color: '#16140f', fontWeight: 700, fontSize: 13,
                  cursor: newTaskText.trim() ? 'pointer' : 'default', opacity: newTaskText.trim() ? 1 : 0.5,
                  fontFamily: FONT,
                }}
              >+ افزودن</button>
            </div>
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {([
              { id: 'all', label: 'همه', count: tasks.length },
              { id: 'today', label: 'امروز', count: tasks.filter(t => isToday(t)).length },
              { id: 'overdue', label: 'معوق', count: overdueCount },
              { id: 'done', label: 'انجام‌شده', count: tasks.filter(t => t.done).length },
            ] as const).map(chip => {
              const on = taskFilter === chip.id
              return (
                <button key={chip.id} onClick={() => setTaskFilter(chip.id)} style={{
                  padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5,
                  fontWeight: on ? 700 : 500,
                  border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}`,
                  background: on ? 'var(--goldDim)' : 'var(--surface)',
                  color: on ? 'var(--gold)' : 'var(--muted)',
                }}>{chip.label} ({FA(chip.count)})</button>
              )
            })}
          </div>

          {/* Task List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredTasks.length === 0 && (
              <div style={{
                padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--faint)',
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
              }}>
                {taskFilter === 'all' ? 'هنوز وظیفه‌ای ثبت نشده است.' : 'وظیفه‌ای در این دسته نیست.'}
              </div>
            )}
            {filteredTasks.map(task => {
              const overdue = isOverdue(task)
              const pr = task.priority || 'medium'
              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    background: 'var(--surface)',
                    border: `1px solid ${overdue ? 'rgba(231,76,60,0.45)' : 'var(--line)'}`,
                    borderRadius: 12,
                    opacity: task.done ? 0.65 : 1,
                    position: 'relative',
                  }}
                >
                  <div
                    onClick={() => toggleTask(task.id)}
                    style={{
                      width: 20, height: 20, borderRadius: 6,
                      border: task.done ? '2px solid #5fd98a' : '2px solid var(--line2)',
                      background: task.done ? '#5fd98a' : 'transparent',
                      flexShrink: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    {task.done && <span style={{ color: '#16140f', fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500,
                      textDecoration: task.done ? 'line-through' : 'none',
                    }}>{task.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, color: overdue ? '#e74c3c' : 'var(--muted)',
                        background: 'var(--bg)', padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)',
                      }}>{taskTimeLabel(task)}</span>
                      {overdue && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e74c3c', background: 'rgba(231,76,60,0.14)', padding: '3px 8px', borderRadius: 6 }}>معوق</span>
                      )}
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, color: priorityColor[pr],
                        background: `${priorityColor[pr]}22`, padding: '3px 8px', borderRadius: 6,
                      }}>{priorityLabel[pr]}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* inline priority edit */}
                    <select
                      value={pr}
                      onChange={e => patchTask(task.id, { priority: e.target.value as 'high' | 'medium' | 'low' })}
                      title="اولویت"
                      style={{
                        padding: '5px 6px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)',
                        color: 'var(--text)', fontSize: 11, outline: 'none', fontFamily: FONT, cursor: 'pointer',
                      }}
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{priorityLabel[p]}</option>)}
                    </select>
                    {/* inline due edit (reopen the picker) */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setEditingDueId(id => id === task.id ? null : task.id)}
                        title="ویرایش تاریخ"
                        style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: editingDueId === task.id ? 'var(--goldDim)' : 'var(--bg)',
                          border: `1px solid ${editingDueId === task.id ? 'var(--gold)' : 'var(--line)'}`,
                          color: editingDueId === task.id ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
                        }}
                      >📅</button>
                      {editingDueId === task.id && (
                        <JalaliDateTimePicker
                          value={task.dueTs ?? undefined}
                          onPick={(ts, label) => { patchTask(task.id, { dueTs: ts, due: label }); setEditingDueId(null) }}
                          onClose={() => setEditingDueId(null)}
                        />
                      )}
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      title="حذف"
                      style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: 'var(--bg)', border: '1px solid var(--line)',
                        color: 'var(--muted)', cursor: 'pointer', fontSize: 13, lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
                      }}
                    >×</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ==================== CALENDAR (real Jalali month grid) ==================== */}
      {activeView === 'calendar' && (() => {
        const { jy, jm, cells } = jMonthCells(calOffset)
        const todayK = todayKeyG
        // tasksByDay: jalali day-key → tasks due that day
        const byDay: Record<string, Task[]> = {}
        for (const t of tasks) {
          if (typeof t.dueTs !== 'number') continue
          const p = jParts(new Date(t.dueTs))
          const k = `${p.jy}-${p.jm}-${p.jd}`
          ;(byDay[k] = byDay[k] || []).push(t)
        }
        const selDayTasks = (calSelKey && byDay[calSelKey] ? byDay[calSelKey] : []).sort((a, b) => dueSortKey(a) - dueSortKey(b))
        return (
          <div className="mjc-cal" style={{
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{J_MONTHS[jm - 1]} {FA(jy)}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setCalOffset(o => o - 1)} style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>→ ماه قبل</button>
                <button onClick={() => { setCalOffset(0); setCalSelKey(null) }} style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: FONT }}>امروز</button>
                <button onClick={() => setCalOffset(o => o + 1)} style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>ماه بعد ←</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
              {J_WEEK.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, padding: '4px 0' }}>{w}</div>)}
              {cells.map((d, i) => {
                if (!d) return <div key={i} />
                const p = jParts(d)
                const key = `${p.jy}-${p.jm}-${p.jd}`
                const dayTasks = (byDay[key] || []).sort((a, b) => dueSortKey(a) - dueSortKey(b))
                const isT = key === todayK
                const isSel = key === calSelKey
                return (
                  <div
                    key={i}
                    onClick={() => setCalSelKey(isSel ? null : key)}
                    style={{
                      minHeight: 84, borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${isSel ? 'var(--gold)' : isT ? 'var(--gold)' : 'var(--line)'}`,
                      background: isSel ? 'rgba(201,168,76,0.18)' : isT ? 'var(--goldDim)' : 'var(--bg)',
                      padding: 6, display: 'flex', flexDirection: 'column', gap: 3,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: isT ? 'var(--gold)' : 'var(--text)', textAlign: 'left' }}>{FA(p.jd)}</div>
                    {dayTasks.slice(0, 3).map(t => (
                      <div key={t.id} title={t.title} style={{
                        fontSize: 9.5, lineHeight: 1.5, padding: '1px 5px', borderRadius: 5,
                        background: `${priorityColor[t.priority || 'medium']}22`, color: priorityColor[t.priority || 'medium'],
                        textDecoration: t.done ? 'line-through' : 'none',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{t.title}</div>
                    ))}
                    {dayTasks.length > 3 && <div style={{ fontSize: 9, color: 'var(--muted)' }}>+{FA(dayTasks.length - 3)}</div>}
                  </div>
                )
              })}
            </div>
            {/* Selected-day task list */}
            {calSelKey && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>وظایف این روز</div>
                {selDayTasks.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>وظیفه‌ای برای این روز ثبت نشده.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selDayTasks.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, opacity: t.done ? 0.6 : 1 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColor[t.priority || 'medium'], flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</div>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t.due || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--faint)' }}>وظایف دارای تاریخ روی همین تقویم نمایش داده می‌شوند. روی هر روز بزنید تا فهرست آن را ببینید.</div>
          </div>
        )
      })()}
    </>
  )

  // ===== AI ASSISTANT MODAL ===== (shared by both modes)
  const aiModal = aiOpen && (
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
  )

  // ===== EMBEDDED MODE: only the inner content area (no sidebar/header/return-bar/full-page). =====
  if (embedded) {
    return (
      <div dir="rtl" style={{ color: 'var(--text)', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>
        {content}
        {aiModal}
      </div>
    )
  }

  // ===== STANDALONE MODE: full page, pixel-identical to the original /crm. =====
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
                onClick={() => setActiveView(item.id as CrmView)}
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
          {content}
        </main>
      </div>

      {aiModal}
    </div>
  )
}
