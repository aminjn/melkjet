'use client'
import { useState } from 'react'
import Link from 'next/link'

type View = 'clients' | 'calendar' | 'tasks' | 'performance'

type DealStage = 'در حال مذاکره' | 'بازدید ملک' | 'پیشنهاد داده شد' | 'قرارداد' | 'تکمیل شد'

const clients = [
  { id: 1, name: 'آرمان حسینی', phone: '۰۹۱۲-۳۴۵-۶۷۸۹', budget: '۵ تا ۸ م.د', type: 'خرید', propertyType: 'آپارتمان', area: 'تهران شمال', stage: 'در حال مذاکره' as DealStage, stageColor: 'var(--gold)', lastContact: '۲ روز پیش', priority: 'بالا' },
  { id: 2, name: 'شیرین کاظمی', phone: '۰۹۳۵-۲۱۴-۸۷۶۵', budget: '۱۲ تا ۱۸ م.د', type: 'خرید', propertyType: 'ویلا', area: 'شمال کشور', stage: 'بازدید ملک' as DealStage, stageColor: '#5b9bd5', lastContact: 'امروز', priority: 'بالا' },
  { id: 3, name: 'داریوش نجفی', phone: '۰۹۱۸-۷۶۵-۴۳۲۱', budget: '۲۰ م.ت/ماه', type: 'اجاره', propertyType: 'دفتر تجاری', area: 'تهران مرکز', stage: 'پیشنهاد داده شد' as DealStage, stageColor: '#9b7ad0', lastContact: '۱ هفته پیش', priority: 'متوسط' },
  { id: 4, name: 'نرگس آقایی', phone: '۰۹۱۱-۱۲۳-۴۵۶۷', budget: '۳ تا ۵ م.د', type: 'خرید', propertyType: 'آپارتمان', area: 'تهران غرب', stage: 'قرارداد' as DealStage, stageColor: '#5fd98a', lastContact: 'دیروز', priority: 'بالا' },
  { id: 5, name: 'بهروز صمدی', phone: '۰۹۱۶-۵۵۵-۰۰۱۱', budget: '۳۵ م.د', type: 'خرید', propertyType: 'پنت‌هاوس', area: 'تهران شمال', stage: 'تکمیل شد' as DealStage, stageColor: '#5fd98a', lastContact: '۳ روز پیش', priority: 'پایین' },
  { id: 6, name: 'فاطمه رحیمی', phone: '۰۹۱۵-۸۸۸-۹۹۷۷', budget: '۸ م.ت/ماه', type: 'اجاره', propertyType: 'خانه مسکونی', area: 'تهران شرق', stage: 'در حال مذاکره' as DealStage, stageColor: 'var(--gold)', lastContact: 'امروز', priority: 'متوسط' },
]

type TaskPriority = 'فوری' | 'عادی' | 'کم‌اهمیت'

const initialTasks = [
  { id: 1, title: 'پیگیری آرمان حسینی برای قرارداد', client: 'آرمان حسینی', priority: 'فوری' as TaskPriority, priorityColor: '#e05a5a', due: '۱۴۰۳/۰۳/۲۰', done: false },
  { id: 2, title: 'هماهنگی بازدید ملک برای شیرین کاظمی', client: 'شیرین کاظمی', priority: 'فوری' as TaskPriority, priorityColor: '#e05a5a', due: '۱۴۰۳/۰۳/۲۱', done: false },
  { id: 3, title: 'ارسال پیشنهاد قیمت به داریوش نجفی', client: 'داریوش نجفی', priority: 'عادی' as TaskPriority, priorityColor: 'var(--gold)', due: '۱۴۰۳/۰۳/۲۲', done: false },
  { id: 4, title: 'تنظیم قرارداد نرگس آقایی', client: 'نرگس آقایی', priority: 'فوری' as TaskPriority, priorityColor: '#e05a5a', due: '۱۴۰۳/۰۳/۱۹', done: true },
  { id: 5, title: 'ارسال پرونده ملکی به وکیل', client: '', priority: 'عادی' as TaskPriority, priorityColor: 'var(--gold)', due: '۱۴۰۳/۰۳/۲۵', done: false },
  { id: 6, title: 'به‌روزرسانی پروفایل ملک شماره ۱۲۴', client: '', priority: 'کم‌اهمیت' as TaskPriority, priorityColor: '#5b9bd5', due: '۱۴۰۳/۰۳/۳۰', done: false },
  { id: 7, title: 'جلسه هفتگی تیم', client: '', priority: 'عادی' as TaskPriority, priorityColor: 'var(--gold)', due: '۱۴۰۳/۰۳/۲۴', done: false },
]

const appointments = [
  { day: 3, title: 'بازدید ملک با شیرین', time: '۱۰:۰۰', color: '#5b9bd5' },
  { day: 7, title: 'جلسه مذاکره آرمان', time: '۱۴:۰۰', color: 'var(--gold)' },
  { day: 10, title: 'امضای قرارداد نرگس', time: '۱۱:۰۰', color: '#5fd98a' },
  { day: 14, title: 'بازدید پنت‌هاوس', time: '۱۵:۳۰', color: '#9b7ad0' },
  { day: 17, title: 'جلسه هفتگی تیم', time: '۰۹:۰۰', color: '#e05a5a' },
  { day: 21, title: 'مشاوره اولیه مشتری جدید', time: '۱۶:۰۰', color: '#5b9bd5' },
  { day: 24, title: 'بازدید دفتر تجاری', time: '۱۰:۳۰', color: 'var(--gold)' },
  { day: 28, title: 'پیگیری معامله بهروز', time: '۱۲:۰۰', color: '#5fd98a' },
]

const monthlyCommissions = [
  { month: 'دی', amount: 28 },
  { month: 'بهمن', amount: 35 },
  { month: 'اسفند', amount: 42 },
  { month: 'فروردین', amount: 38 },
  { month: 'اردیبهشت', amount: 55 },
  { month: 'خرداد', amount: 48 },
]

const performanceKPIs = [
  { l: 'معاملات این ماه', v: '۹', t: '+۳ نسبت به ماه قبل', tc: '#5fd98a', ic: '◎', bg: 'rgba(95,217,138,0.12)', c: '#5fd98a' },
  { l: 'درآمد کمیسیون', v: '۴۸ م.ت', t: '↗ ۲۸٪ رشد', tc: 'var(--gold)', ic: '♛', bg: 'var(--goldDim)', c: 'var(--gold)' },
  { l: 'مشتریان فعال', v: '۶', t: '۲ مشتری جدید', tc: '#5b9bd5', ic: '◈', bg: 'rgba(91,155,213,0.12)', c: '#5b9bd5' },
  { l: 'نرخ تبدیل', v: '۱۸٪', t: '+۵٪ بهتر از میانگین', tc: '#5fd98a', ic: '◴', bg: 'rgba(95,217,138,0.12)', c: '#5fd98a' },
]

const navItems: { id: View; ic: string; l: string }[] = [
  { id: 'clients', ic: '♛', l: 'مشتریان من' },
  { id: 'calendar', ic: '◍', l: 'تقویم' },
  { id: 'tasks', ic: '▦', l: 'وظایف' },
  { id: 'performance', ic: '◎', l: 'عملکرد' },
]

const viewTitles: Record<View, string> = {
  clients: 'مشتریان من',
  calendar: 'تقویم کاری',
  tasks: 'وظایف',
  performance: 'عملکرد و کمیسیون',
}

export default function ProsPage() {
  const [view, setView] = useState<View>('clients')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [tasks, setTasks] = useState(initialTasks)
  const [taskFilter, setTaskFilter] = useState<'همه' | TaskPriority>('همه')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('عادی')
  const [newTaskDue, setNewTaskDue] = useState('')

  const navStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, border: 'none',
    background: active ? 'var(--goldDim)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--muted)',
    fontFamily: 'inherit', fontSize: 13.5, fontWeight: active ? 700 : 500, cursor: 'pointer', width: '100%', textAlign: 'right' as const,
  })

  const th: React.CSSProperties = { padding: '11px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textAlign: 'right' as const, background: 'var(--bg2)', borderBottom: '1px solid var(--line)' }
  const td: React.CSSProperties = { padding: '13px 16px', fontSize: 13, color: 'var(--text)', borderTop: '1px solid var(--line)' }
  const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }
  const smallBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
  const goldBtn: React.CSSProperties = { padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#1a1506', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

  const toggleTask = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const deleteTask = (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const addTask = () => {
    if (!newTaskTitle.trim()) return
    const priorityColorMap: Record<TaskPriority, string> = { 'فوری': '#e05a5a', 'عادی': 'var(--gold)', 'کم‌اهمیت': '#5b9bd5' }
    setTasks(prev => [...prev, {
      id: Date.now(),
      title: newTaskTitle.trim(),
      client: '',
      priority: newTaskPriority,
      priorityColor: priorityColorMap[newTaskPriority],
      due: newTaskDue || '۱۴۰۳/۰۴/۰۱',
      done: false,
    }])
    setNewTaskTitle('')
    setNewTaskDue('')
  }

  const filteredTasks = taskFilter === 'همه' ? tasks : tasks.filter(t => t.priority === taskFilter)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const order: Record<TaskPriority, number> = { 'فوری': 0, 'عادی': 1, 'کم‌اهمیت': 2 }
    return order[a.priority] - order[b.priority]
  })

  const activeDeals = clients.filter(c => c.stage !== 'تکمیل شد').length
  const closingThisWeek = clients.filter(c => c.stage === 'قرارداد').length
  const doneCount = tasks.filter(t => t.done).length

  // Calendar helpers
  const dayHeaders = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
  const todayDay = 15
  // day 1 starts on col index 2 (Wednesday = 'د'), offset = 2
  const calOffset = 2
  const totalCells = calOffset + 28
  const calRows = Math.ceil(totalCells / 7)
  const calCells = Array.from({ length: calRows * 7 }, (_, i) => {
    const dayNum = i - calOffset + 1
    return dayNum >= 1 && dayNum <= 28 ? dayNum : null
  })
  const appointmentByDay = new Map(appointments.map(a => [a.day, a]))
  const todayAppts = appointments.filter(a => a.day === todayDay)

  // Commission chart
  const maxCommission = Math.max(...monthlyCommissions.map(m => m.amount))
  const chartW = 600
  const chartH = 160
  const chartPadL = 10
  const chartPadR = 10
  const chartPadB = 30
  const chartPadT = 20
  const barW = 56
  const barGap = (chartW - chartPadL - chartPadR - barW * 6) / 7
  const midCommission = Math.round(maxCommission / 2)

  const funnelData = [
    { label: 'لید جدید', count: 24, pct: 100 },
    { label: 'پیگیری', count: 18, pct: 75 },
    { label: 'مذاکره', count: 12, pct: 50 },
    { label: 'معامله نهایی', count: 6, pct: 25 },
  ]

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', sans-serif" }}>

      {/* SIDEBAR */}
      <aside className="mjpro-nav" style={{ width: 240, flexShrink: 0, position: 'sticky' as const, top: 0, height: '100vh', overflow: 'auto', background: 'var(--bg2)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '18px 13px' }}>

        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: 'var(--text)', padding: '6px 8px 16px' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 13, height: 13, background: 'var(--bg2)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }}></span>
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.5px' }}>ملک‌جت</div>
            <div style={{ fontSize: 10.5, color: 'var(--gold)' }}>میز کار متخصصان</div>
          </div>
        </Link>

        <nav style={{ display: 'grid', gap: 3 }}>
          {navItems.map(m => (
            <button key={m.id} onClick={() => setView(m.id)} style={navStyle(view === m.id)}>
              <span style={{ width: 22, textAlign: 'center' as const, fontSize: 15 }}>{m.ic}</span>
              <span style={{ flex: 1, textAlign: 'right' as const }}>{m.l}</span>
            </button>
          ))}
          <Link href="/plan-ai" style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 10, color: 'var(--gold)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, marginTop: 4, border: '1px solid rgba(212,175,55,0.25)' }}>
            <span style={{ width: 22, textAlign: 'center', fontSize: 15 }}>◳</span>
            <span style={{ flex: 1, textAlign: 'right' }}>استودیو پلان و سه‌بعدی</span>
          </Link>
        </nav>

        <div style={{ flex: 1 }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 6px 4px', borderTop: '1px solid var(--line)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#caa86a,#8a6f3e)', flexShrink: 0 }}></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>امیر رضایی</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>مشاور ارشد</div>
          </div>
          <button
            onClick={() => { const n = theme === 'dark' ? 'light' : 'dark'; setTheme(n); document.documentElement.classList.toggle('light', n === 'light') }}
            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}
          >{theme === 'dark' ? '☀' : '☾'}</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* HEADER */}
        <header style={{ position: 'sticky' as const, top: 0, zIndex: 30, background: 'var(--navbg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--line)', padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.4px' }}>{viewTitles[view]}</div>
          <div style={{ flex: 1 }}></div>
          <Link href="/agency" style={{ display: 'flex', alignItems: 'center', height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>پنل آژانس</Link>
        </header>

        {/* CONTENT */}
        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>

          {/* ══════════════ CLIENTS VIEW ══════════════ */}
          {view === 'clients' && (
            <div style={{ display: 'grid', gap: 20 }}>

              {/* Summary chips */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'کل مشتریان', value: clients.length, color: 'var(--text)', bg: 'var(--surface)' },
                  { label: 'معاملات فعال', value: activeDeals, color: '#5b9bd5', bg: 'rgba(91,155,213,0.1)' },
                  { label: 'بسته می‌شوند این هفته', value: closingThisWeek, color: '#5fd98a', bg: 'rgba(95,217,138,0.1)' },
                ].map(chip => (
                  <div key={chip.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 12, background: chip.bg, border: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: chip.color }}>{chip.value}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{chip.label}</span>
                  </div>
                ))}
              </div>

              {/* Clients table */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th style={th}>مشتری</th>
                        <th style={th}>تلفن</th>
                        <th style={th}>بودجه</th>
                        <th style={th}>نوع</th>
                        <th style={th}>نوع ملک</th>
                        <th style={th}>منطقه</th>
                        <th style={th}>مرحله معامله</th>
                        <th style={th}>آخرین تماس</th>
                        <th style={th}>اولویت</th>
                        <th style={th}>عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(c => {
                        const priorityMap: Record<string, { color: string; bg: string }> = {
                          'بالا': { color: '#e05a5a', bg: 'rgba(224,90,90,0.12)' },
                          'متوسط': { color: 'var(--gold)', bg: 'var(--goldDim)' },
                          'پایین': { color: 'var(--muted)', bg: 'var(--bg2)' },
                        }
                        const pri = priorityMap[c.priority] || { color: 'var(--muted)', bg: 'var(--bg2)' }
                        return (
                          <tr key={c.id}>
                            <td style={td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#caa86a,#8a6f3e)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700 }}>
                                  {c.name.charAt(0)}
                                </div>
                                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</span>
                              </div>
                            </td>
                            <td style={{ ...td, fontSize: 12, color: 'var(--muted)', direction: 'ltr', textAlign: 'right' as const }}>{c.phone}</td>
                            <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.budget}</td>
                            <td style={{ ...td, fontSize: 12 }}>{c.type}</td>
                            <td style={{ ...td, fontSize: 12 }}>{c.propertyType}</td>
                            <td style={{ ...td, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{c.area}</td>
                            <td style={td}>
                              <span style={{ padding: '4px 10px', borderRadius: 20, background: c.stageColor + '26', color: c.stageColor, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', border: `1px solid ${c.stageColor}40` }}>
                                {c.stage}
                              </span>
                            </td>
                            <td style={{ ...td, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{c.lastContact}</td>
                            <td style={td}>
                              <span style={{ padding: '3px 9px', borderRadius: 20, background: pri.bg, color: pri.color, fontSize: 11.5, fontWeight: 700 }}>
                                {c.priority}
                              </span>
                            </td>
                            <td style={td}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button style={smallBtn}>تماس</button>
                                <button style={smallBtn}>پرونده</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <button style={goldBtn}>مشتری جدید +</button>
              </div>
            </div>
          )}

          {/* ══════════════ CALENDAR VIEW ══════════════ */}
          {view === 'calendar' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ ...cardStyle }}>
                {/* Month header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <button style={{ ...smallBtn, padding: '6px 12px', fontSize: 14 }}>‹</button>
                  <div style={{ flex: 1, textAlign: 'center' as const, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>خرداد ۱۴۰۳</div>
                  <button style={{ ...smallBtn, padding: '6px 12px', fontSize: 14 }}>›</button>
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
                  {dayHeaders.map(d => (
                    <div key={d} style={{ textAlign: 'center' as const, fontSize: 12, fontWeight: 700, color: 'var(--muted)', padding: '6px 0' }}>{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                  {calCells.map((dayNum, idx) => {
                    const appt = dayNum ? appointmentByDay.get(dayNum) : undefined
                    const isToday = dayNum === todayDay
                    return (
                      <div
                        key={idx}
                        style={{
                          minHeight: 68,
                          borderRadius: 9,
                          border: appt ? `1px solid ${appt.color}55` : isToday ? '1px solid var(--gold)' : '1px solid var(--line)',
                          background: isToday ? 'var(--goldDim)' : appt ? `${appt.color}0d` : 'var(--bg)',
                          padding: '7px 8px',
                          position: 'relative' as const,
                        }}
                      >
                        {dayNum !== null && (
                          <>
                            <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--gold)' : 'var(--text)', marginBottom: 4 }}>{dayNum}</div>
                            {appt && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: appt.color, flexShrink: 0, marginTop: 3 }}></span>
                                <div style={{ fontSize: 10, color: appt.color, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{appt.title}</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Today's appointments */}
              <div style={{ ...cardStyle }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }}></span>
                  جلسات امروز
                </div>
                {todayAppts.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>جلسه‌ای برای امروز ثبت نشده</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {todayAppts.map(a => (
                      <div key={a.day} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, background: `${a.color}12`, border: `1px solid ${a.color}33` }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: a.color, minWidth: 44 }}>{a.time}</span>
                        <span style={{ width: 1, height: 28, background: `${a.color}55` }}></span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{a.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ TASKS VIEW ══════════════ */}
          {view === 'tasks' && (
            <div style={{ display: 'grid', gap: 18 }}>

              {/* Add new task */}
              <div style={{ ...cardStyle }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>افزودن وظیفه جدید</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder="عنوان وظیفه..."
                    style={{ flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <select
                    value={newTaskPriority}
                    onChange={e => setNewTaskPriority(e.target.value as TaskPriority)}
                    style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    <option value="فوری">فوری</option>
                    <option value="عادی">عادی</option>
                    <option value="کم‌اهمیت">کم‌اهمیت</option>
                  </select>
                  <input
                    value={newTaskDue}
                    onChange={e => setNewTaskDue(e.target.value)}
                    placeholder="تاریخ سررسید"
                    style={{ width: 140, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <button onClick={addTask} style={goldBtn}>افزودن</button>
                </div>
              </div>

              {/* Filter + count */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['همه', 'فوری', 'عادی', 'کم‌اهمیت'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setTaskFilter(f)}
                      style={{
                        padding: '7px 16px', borderRadius: 20, border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                        background: taskFilter === f ? 'var(--goldDim)' : 'var(--surface)',
                        color: taskFilter === f ? 'var(--gold)' : 'var(--muted)',
                        fontWeight: taskFilter === f ? 700 : 500,
                      }}
                    >{f}</button>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{doneCount}</span> از <span style={{ fontWeight: 700 }}>{tasks.length}</span> وظیفه تکمیل شده
                </div>
              </div>

              {/* Task list */}
              <div style={{ display: 'grid', gap: 8 }}>
                {sortedTasks.map(task => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 13,
                      background: 'var(--surface)', border: `1px solid ${task.done ? 'var(--line)' : 'var(--line)'}`,
                      opacity: task.done ? 0.6 : 1,
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      onClick={() => toggleTask(task.id)}
                      style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                        border: task.done ? 'none' : '2px solid var(--line)',
                        background: task.done ? 'var(--gold)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {task.done && <span style={{ fontSize: 11, color: '#1a1506', fontWeight: 800 }}>✓</span>}
                    </div>

                    {/* Title */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: task.done ? 'var(--muted)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none' }}>
                        {task.title}
                      </div>
                      {task.client && (
                        <span style={{ fontSize: 11, background: 'var(--bg2)', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 8px', marginTop: 4, display: 'inline-block' }}>
                          {task.client}
                        </span>
                      )}
                    </div>

                    {/* Priority badge */}
                    <span style={{ padding: '3px 10px', borderRadius: 20, background: `${task.priorityColor}1a`, color: task.priorityColor, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {task.priority}
                    </span>

                    {/* Due date */}
                    <span style={{ fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>{task.due}</span>

                    {/* Delete */}
                    <button
                      onClick={() => deleteTask(task.id)}
                      style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════ PERFORMANCE VIEW ══════════════ */}
          {view === 'performance' && (
            <div style={{ display: 'grid', gap: 20 }}>

              {/* KPI Cards */}
              <div className="mjpro-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {performanceKPIs.map(k => (
                  <div key={k.l} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{k.l}</span>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: k.bg, color: k.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{k.ic}</span>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 12, letterSpacing: '-.5px' }}>{k.v}</div>
                    <div style={{ fontSize: 11.5, color: k.tc, marginTop: 4 }}>{k.t}</div>
                  </div>
                ))}
              </div>

              {/* Commission chart */}
              <div style={{ ...cardStyle }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>کمیسیون ماهانه</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>۶ ماه گذشته (م.ت)</div>
                <svg viewBox={`0 0 ${chartW} ${chartH + chartPadB + chartPadT}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold2)" />
                      <stop offset="100%" stopColor="var(--gold)" />
                    </linearGradient>
                  </defs>
                  {/* Gridlines */}
                  {[maxCommission, midCommission].map((val, gi) => {
                    const y = chartPadT + (1 - val / maxCommission) * chartH
                    return (
                      <g key={gi}>
                        <line x1={chartPadL} y1={y} x2={chartW - chartPadR} y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray="4 4" />
                        <text x={chartPadL} y={y - 4} fontSize="10" fill="var(--faint)" textAnchor="start">{val}</text>
                      </g>
                    )
                  })}
                  {/* Bars */}
                  {monthlyCommissions.map((m, i) => {
                    const barH = (m.amount / maxCommission) * chartH
                    const x = chartPadL + barGap + i * (barW + barGap)
                    const y = chartPadT + chartH - barH
                    return (
                      <g key={m.month}>
                        <rect x={x} y={y} width={barW} height={barH} rx={6} fill="url(#barGrad)" opacity="0.9" />
                        <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="var(--gold)" fontWeight="700">{m.amount}</text>
                        <text x={x + barW / 2} y={chartPadT + chartH + chartPadB - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{m.month}</text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Funnel and ranking side by side */}
              <div className="mjpro-2col" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18 }}>

                {/* Conversion funnel */}
                <div style={{ ...cardStyle }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>قیف تبدیل مشتریان</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>وضعیت پایپ‌لاین</div>
                  <div style={{ display: 'grid', gap: 14 }}>
                    {funnelData.map((f, i) => {
                      const colors = ['var(--gold)', '#5b9bd5', '#9b7ad0', '#5fd98a']
                      const c = colors[i]
                      return (
                        <div key={f.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{f.label}</span>
                            <span style={{ color: c, fontWeight: 700 }}>{f.count} نفر · {f.pct}٪</span>
                          </div>
                          <div style={{ height: 10, borderRadius: 6, background: 'var(--bg2)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${f.pct}%`, background: c, borderRadius: 6 }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Monthly ranking */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>رتبه‌بندی این ماه</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-.5px', marginBottom: 4 }}>رتبه ۲</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>از ۳۸ مشاور</div>
                  <div style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--goldDim)', border: '1px solid var(--gold2)' }}>
                    <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>✦ آفرین! عملکرد عالی</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>تنها ۷ م.ت تا رتبه اول فاصله دارید</div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  )
}
