'use client'
import { useState, useEffect, useCallback } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'
import CrmTool, { CRM_VIEWS, type CrmView } from '@/app/components/tools/CrmTool'
import MarketingTool, { MARKETING_VIEWS, type MarketingView } from '@/app/components/tools/MarketingTool'
import WorkflowTool, { WORKFLOW_VIEWS, type WorkflowView } from '@/app/components/tools/WorkflowTool'
import WebsiteBuilderTool, { WEBSITE_VIEWS, type WebsiteView } from '@/app/components/tools/WebsiteBuilderTool'
import ArticleEditor from '@/app/components/ArticleEditor'
import PlansPanel from '@/app/components/PlansPanel'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'

// ── Types (mirror app/lib/builder-store.ts API shape) ──
type UnitStatus = 'sold' | 'reserved' | 'available'
interface Unit { id: string; number: string; floor: number; area: number; price: number; status: UnitStatus; buyer?: string }
interface Investor { id: string; name: string; phone?: string; amount: number; units?: number }
type MilestoneStatus = 'done' | 'active' | 'pending'
interface Milestone { id: string; name: string; status: MilestoneStatus; date?: string }
interface ProjectSource {
  hashId?: string; photos?: string[]; address?: string; region?: string; phase?: string
  lat?: number; lng?: number; groundArea?: number; residentialArea?: number; floors?: number; totalUnits?: number
}
interface Project {
  id: string; name: string; location: string; phase: string; progress: number
  units: Unit[]; investors: Investor[]; milestones: Milestone[]
  monthlySales: { month: string; count: number }[]
  createdAt: number
  source?: ProjectSource
}
interface ProjectSummary { id: string; name: string; location: string }

type View = 'overview' | 'assistant' | 'articles' | 'units' | 'sales' | 'investors' | 'reports' | 'plans' | 'profile'

// ── Status visual maps ──
const STATUS_COLOR: Record<UnitStatus, string> = {
  sold: '#34d399',
  reserved: 'var(--gold)',
  available: '#7a8fae',
}
const STATUS_LABEL: Record<UnitStatus, string> = {
  sold: 'فروخته‌شده',
  reserved: 'رزرو',
  available: 'موجود',
}

// ── Formatting helpers ──
const fa = (n: number) => n.toLocaleString('fa-IR')

// Money in tomans → readable «م.ت» (میلیون تومان). 1,840 م.ت means ~1.84 میلیارد.
function money(tomans: number): string {
  if (tomans >= 1e9) return fa(Math.round(tomans / 1e9)) + ' م.ت' // میلیارد تومان rendered as «م.ت»
  if (tomans >= 1e6) return fa(Math.round(tomans / 1e6)) + ' م.ت'
  return fa(Math.round(tomans)) + ' ت'
}
// Always express in میلیارد تومان for big sums (revenue, investments).
function billions(tomans: number): string {
  return fa(Math.round(tomans / 1e9))
}

function stats(p: Project | null) {
  if (!p) return { total: 0, sold: 0, reserved: 0, available: 0, revenue: 0 }
  const sold = p.units.filter(u => u.status === 'sold')
  return {
    total: p.units.length,
    sold: sold.length,
    reserved: p.units.filter(u => u.status === 'reserved').length,
    available: p.units.filter(u => u.status === 'available').length,
    revenue: sold.reduce((a, u) => a + u.price, 0),
  }
}

const VIEW_TITLES: Record<View, string> = {
  overview: 'نمای کلی پروژه',
  assistant: 'دستیار هوشمند',
  articles: 'مقالات و وبلاگ',
  units: 'موجودی واحدها',
  sales: 'پیش‌فروش و فروش',
  investors: 'سرمایه‌گذاران',
  reports: 'گزارش‌ها',
  plans: 'پلن‌ها و اشتراک',
  profile: 'پروفایل',
}

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'overview', label: 'نمای کلی', icon: '▦' },
  { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
  { id: 'units', label: 'موجودی واحدها', icon: '▤' },
  { id: 'sales', label: 'پیش‌فروش و فروش', icon: '◔' },
  { id: 'investors', label: 'سرمایه‌گذاران', icon: '◍' },
  { id: 'reports', label: 'گزارش‌ها', icon: '◳' },
  { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
  { id: 'profile', label: 'پروفایل', icon: '🪪' },
]
const FONT = 'Vazirmatn, system-ui, sans-serif'
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }

export default function BuilderPage() {
  const [view, setView] = useState<View>('overview')
  // ابزارهای جاسازی‌شده: وقتی مقدار دارند، محتوای ابزار در همین پنل نمایش داده می‌شود
  const [crmView, setCrmView] = useState<CrmView | null>(null)
  const [crmOpen, setCrmOpen] = useState(false)
  const [mktView, setMktView] = useState<MarketingView | null>(null)
  const [mktOpen, setMktOpen] = useState(false)
  const [wfView, setWfView] = useState<WorkflowView | null>(null)
  const [wfOpen, setWfOpen] = useState(false)
  const [wbView, setWbView] = useState<WebsiteView | null>(null)
  const [wbOpen, setWbOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)   // کشوی منوی موبایل
  const clearTools = () => { setCrmView(null); setMktView(null); setWfView(null); setWbView(null) }
  const goView = (v: View) => { setView(v); clearTools(); setNavOpen(false) }
  const openCrm = (v: CrmView) => { clearTools(); setCrmView(v); setCrmOpen(true) }
  const openMkt = (v: MarketingView) => { clearTools(); setMktView(v); setMktOpen(true) }
  const openWf = (v: WorkflowView) => { clearTools(); setWfView(v); setWfOpen(true) }
  const openWb = (v: WebsiteView) => { clearTools(); setWbView(v); setWbOpen(true) }
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [pid, setPid] = useState<string | null>(null)
  const [myName, setMyName] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // ── Load full project by id ──
  const loadProject = useCallback(async (id: string) => {
    try {
      const r = await fetch('/api/builder?id=' + encodeURIComponent(id))
      const d = await r.json()
      if (d.project) setProject(d.project)
    } catch {}
  }, [])

  // ── On mount: list projects, pick first, load it ──
  useEffect(() => {
    fetch('/api/builder')
      .then(r => r.json())
      .then((d: { projects: Project[] }) => {
        const list = Array.isArray(d.projects) ? d.projects : []
        setProjects(list.map(p => ({ id: p.id, name: p.name, location: p.location })))
        if (list[0]) { setPid(list[0].id); setProject(list[0]) }
      })
      .catch(() => {})
  }, [])

  // ── Fetch display name for article authorship ──
  useEffect(() => {
    fetch('/api/auth/profile', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d?.account?.name) setMyName(d.account.name) }).catch(() => {})
  }, [])

  // ── Generic POST then refresh current project ──
  const post = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    try {
      const r = await fetch('/api/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'برای تغییر باید وارد شوید'); return false }
      if (pid) await loadProject(pid)
      return true
    } catch { return false } finally { setBusy(false) }
  }, [pid, loadProject])

  const toggleTheme = () => {
    const html = document.documentElement
    if (theme === 'dark') { html.classList.add('light'); setTheme('light') }
    else { html.classList.remove('light'); setTheme('dark') }
  }

  const selectProject = async (id: string) => {
    setSwitcherOpen(false)
    if (id === pid) return
    setPid(id)
    setProject(null)
    await loadProject(id)
  }

  const createProject = async () => {
    setSwitcherOpen(false)
    const name = window.prompt('نام پروژه:')?.trim()
    if (!name) return
    const location = window.prompt('موقعیت (مثلاً تهران، سعادت‌آباد):')?.trim() || ''
    setBusy(true)
    try {
      const r = await fetch('/api/builder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'project', name, location }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.project) { alert(d.error || 'برای ساخت پروژه باید وارد شوید'); return }
      const p: Project = d.project
      setProjects(prev => [{ id: p.id, name: p.name, location: p.location }, ...prev])
      setPid(p.id); setProject(p)
    } catch {} finally { setBusy(false) }
  }

  const s = stats(project)
  const current = projects.find(p => p.id === pid)

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>

      {/* OVERLAY موبایل (پشتِ کشو) */}
      <div className={`mjb-overlay${navOpen ? ' mjb-open' : ''}`} onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 125 }} />

      {/* ════════════ SIDEBAR ════════════ */}
      <aside className={`mjb-side${navOpen ? ' mjb-open' : ''}`} style={{
        width: 230, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--line)',
        position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Title + diamond logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 18px -6px var(--gold)', flexShrink: 0,
            }}>
              <div style={{ width: 13, height: 13, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 3 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px' }}>ملک‌جت</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>میز کار سازنده</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = view === item.id && !crmView && !mktView && !wfView && !wbView
            return (
              <button key={item.id} onClick={() => goView(item.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: active ? 'var(--goldDim)' : 'transparent',
                color: active ? 'var(--gold)' : 'var(--muted)',
                fontWeight: active ? 700 : 500, fontSize: 14, textAlign: 'right',
                marginBottom: 2, fontFamily: FONT, transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                <span className="mjb-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)' }} />}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />

          {/* CRM — جاسازی‌شده با منوی آبشاری (داخل همین پنل باز می‌شود) */}
          <button onClick={() => { setCrmOpen(o => !o); if (!crmView) openCrm('dashboard') }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: crmView ? 'var(--goldDim)' : 'transparent',
            color: crmView ? 'var(--gold)' : 'var(--muted)',
            fontWeight: crmView ? 700 : 500, fontSize: 14, textAlign: 'right',
            marginBottom: 2, fontFamily: FONT, transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: crmView ? 1 : 0.7 }}>◇</span>
            <span className="mjb-sidelabel" style={{ flex: 1 }}>CRM و مشتریان</span>
            <span className="mjb-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: crmOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {crmOpen && CRM_VIEWS.map(cv => {
            const on = crmView === cv.id
            return (
              <button key={cv.id} onClick={() => openCrm(cv.id)} className="mjb-sidelabel" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: on ? 'var(--goldDim)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--muted)',
                fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT,
              }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{cv.icon}</span>
                <span style={{ flex: 1 }}>{cv.label}</span>
              </button>
            )
          })}

          {/* مارکتینگ — جاسازی‌شده با منوی آبشاری (مثل CRM) */}
          <button onClick={() => { setMktOpen(o => !o); if (!mktView) openMkt('overview') }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: mktView ? 'var(--goldDim)' : 'transparent',
            color: mktView ? 'var(--gold)' : 'var(--muted)',
            fontWeight: mktView ? 700 : 500, fontSize: 14, textAlign: 'right',
            marginBottom: 2, fontFamily: FONT, transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: mktView ? 1 : 0.7 }}>◬</span>
            <span className="mjb-sidelabel" style={{ flex: 1 }}>مارکتینگ</span>
            <span className="mjb-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: mktOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {mktOpen && MARKETING_VIEWS.map(mv => {
            const on = mktView === mv.id
            return (
              <button key={mv.id} onClick={() => openMkt(mv.id)} className="mjb-sidelabel" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: on ? 'var(--goldDim)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--muted)',
                fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT,
              }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{mv.icon}</span>
                <span style={{ flex: 1 }}>{mv.label}</span>
              </button>
            )
          })}

          {/* اتوماسیون — منوی آبشاری، داخل همین پنل */}
          <button onClick={() => { setWfOpen(o => !o); if (!wfView) openWf(WORKFLOW_VIEWS[0].id) }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: wfView ? 'var(--goldDim)' : 'transparent',
            color: wfView ? 'var(--gold)' : 'var(--muted)',
            fontWeight: wfView ? 700 : 500, fontSize: 14, textAlign: 'right',
            marginBottom: 2, fontFamily: FONT, transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: wfView ? 1 : 0.7 }}>⛭</span>
            <span className="mjb-sidelabel" style={{ flex: 1 }}>اتوماسیون</span>
            <span className="mjb-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: wfOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {wfOpen && WORKFLOW_VIEWS.map(v => {
            const on = wfView === v.id
            return (
              <button key={v.id} onClick={() => openWf(v.id)} className="mjb-sidelabel" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: on ? 'var(--goldDim)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--muted)',
                fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT,
              }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{v.icon}</span>
                <span style={{ flex: 1 }}>{v.label}</span>
              </button>
            )
          })}

          {/* وب‌سایت‌ساز — منوی آبشاری، داخل همین پنل */}
          <button onClick={() => { setWbOpen(o => !o); if (!wbView) openWb(WEBSITE_VIEWS[0].id) }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: wbView ? 'var(--goldDim)' : 'transparent',
            color: wbView ? 'var(--gold)' : 'var(--muted)',
            fontWeight: wbView ? 700 : 500, fontSize: 14, textAlign: 'right',
            marginBottom: 2, fontFamily: FONT, transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: wbView ? 1 : 0.7 }}>◳</span>
            <span className="mjb-sidelabel" style={{ flex: 1 }}>وب‌سایت‌ساز</span>
            <span className="mjb-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: wbOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {wbOpen && WEBSITE_VIEWS.map(v => {
            const on = wbView === v.id
            return (
              <button key={v.id} onClick={() => openWb(v.id)} className="mjb-sidelabel" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: on ? 'var(--goldDim)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--muted)',
                fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT,
              }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{v.icon}</span>
                <span style={{ flex: 1 }}>{v.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Build progress card */}
        <div style={{ margin: '0 12px 10px', padding: 14, borderRadius: 14, background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,0.2)' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>پیشرفت ساخت</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>{fa(project?.progress ?? 0)}٪</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{project?.phase || '—'}</span>
          </div>
          <div style={{ height: 4, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${project?.progress ?? 0}%`, background: 'linear-gradient(90deg,var(--gold2),var(--gold))', borderRadius: 99, transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* Company chip + theme toggle */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#16140f', flexShrink: 0,
          }}>آ</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>گروه آرین</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>انبوه‌ساز</div>
          </div>
          <button onClick={toggleTheme} title="تغییر تم" style={{
            width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)',
            color: 'var(--text)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{theme === 'dark' ? '☀' : '☾'}</button>
          <button onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {} ; try { localStorage.removeItem('mj_token') } catch {} ; window.location.href = '/' }} title="خروج از حساب" style={{
            width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)',
            color: '#e7674a', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>⎋</button>
        </div>
      </aside>

      {/* ════════════ MAIN ════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40, background: 'var(--navbg)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--line)', padding: '0 24px', height: 64,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <button className="mjb-burger" aria-label="منو" onClick={() => setNavOpen(true)} style={{ width: 42, height: 42, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--gold)', fontSize: 20, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: FONT }}>☰</button>
          <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>{crmView ? `CRM · ${CRM_VIEWS.find(v => v.id === crmView)?.label || ''}` : mktView ? `مارکتینگ · ${MARKETING_VIEWS.find(v => v.id === mktView)?.label || ''}` : wfView ? `اتوماسیون · ${WORKFLOW_VIEWS.find(v => v.id === wfView)?.label || ''}` : wbView ? `وب‌سایت‌ساز · ${WEBSITE_VIEWS.find(v => v.id === wbView)?.label || ''}` : VIEW_TITLES[view]}</h2>

          {/* Project switcher */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setSwitcherOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10,
              background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, maxWidth: 320,
            }}>
              <span style={{ color: 'var(--gold)', fontSize: 9 }}>●</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {current ? `${current.name} · ${current.location}` : 'انتخاب پروژه'}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>▾</span>
            </button>
            {switcherOpen && (
              <>
                <div onClick={() => setSwitcherOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', insetInlineStart: 0, zIndex: 50, minWidth: 280,
                  ...card, padding: 6, boxShadow: 'var(--shadow)',
                }}>
                  {projects.map(p => (
                    <button key={p.id} onClick={() => selectProject(p.id)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                      borderRadius: 9, border: 'none', cursor: 'pointer', textAlign: 'right', fontFamily: FONT,
                      background: p.id === pid ? 'var(--goldDim)' : 'transparent',
                      color: p.id === pid ? 'var(--gold)' : 'var(--text)', fontSize: 13, marginBottom: 2,
                    }}>
                      <span style={{ fontSize: 9, color: p.id === pid ? 'var(--gold)' : 'var(--faint)' }}>●</span>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.location}</span>
                    </button>
                  ))}
                  <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                  <button onClick={createProject} style={{
                    width: '100%', padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    textAlign: 'right', fontFamily: FONT, background: 'transparent', color: 'var(--gold)', fontSize: 13, fontWeight: 700,
                  }}>＋ پروژهٔ جدید</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {crmView ? <CrmTool embedded view={crmView} onView={v => setCrmView(v)} />
            : mktView === 'articles' ? <ArticleEditor compact author={myName || undefined} />
            : mktView ? <MarketingTool embedded view={mktView} onView={v => setMktView(v)} />
            : wfView ? <div style={{ height: 'calc(100vh - 130px)' }}><WorkflowTool embedded view={wfView} onView={v => setWfView(v)} /></div>
            : wbView ? <div style={{ height: 'calc(100vh - 130px)' }}><WebsiteBuilderTool embedded view={wbView} onView={v => setWbView(v)} /></div>
            : view === 'articles' ? (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.7 }}>
                مقاله‌ای که با نام شما منتشر می‌شود، در صفحهٔ مقاله به آگهی‌هایتان لینک می‌شود و می‌توانید آن را در «وبلاگ» وب‌سایت خود نمایش دهید (سئو خودکار: slug و عنوان در صورت تکراری‌بودن خودکار اصلاح می‌شوند).
              </div>
              <ArticleEditor compact author={myName || undefined} />
            </div>
          ) : view === 'plans' ? (
            <PlansPanel dashboard="/builder" />
          ) : view === 'profile' ? (
            <BusinessProfileForm />
          ) : !project ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '80px 0', fontSize: 14 }}>در حال بارگذاری پروژه…</div>
          ) : (
            <>
              {view === 'overview' && <OverviewView project={project} s={s} onMilestone={(mid, status) => post({ action: 'milestone', pid, mid, status })} busy={busy} />}
              {view === 'assistant' && (
                <div style={{ height: 'calc(100vh - 130px)' }}>
                  <AssistantPanel panel="builder" title="دستیار هوشمند سازنده" subtitle="مشاور AI شخصیِ تو" suggestions={["استراتژی پیش‌فروش واحدها را بگو", "قیمت‌گذاری این پروژه را تحلیل کن", "متن بازاریابی برای پروژه بنویس", "چطور سرمایه‌گذار جذب کنم؟"]} />
                </div>
              )}
              {view === 'units' && <UnitsView project={project} post={post} pid={pid} busy={busy} />}
              {view === 'sales' && <SalesView project={project} s={s} />}
              {view === 'investors' && <InvestorsView project={project} post={post} pid={pid} busy={busy} />}
              {view === 'reports' && <ReportsView project={project} s={s} />}
            </>
          )}
        </main>
      </div>

      <style>{`
        @keyframes mjbpulse { 0%,100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.5); } 50% { box-shadow: 0 0 0 6px rgba(201,168,76,0); } }
        .mjb-burger{display:none}
        .mjb-overlay{display:none}
        @media(max-width:760px){
          /* کشوی موبایل: منوی کامل با برچسب از سمتِ راست بازشو */
          .mjb-side{position:fixed!important;right:0;top:0;height:100vh!important;width:82vw!important;max-width:300px;z-index:130;transform:translateX(105%);transition:transform .26s ease;box-shadow:-12px 0 40px -12px rgba(0,0,0,.6)}
          .mjb-side.mjb-open{transform:translateX(0)}
          .mjb-burger{display:inline-flex!important}
          .mjb-overlay.mjb-open{display:block}
        }
      `}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  OVERVIEW
// ════════════════════════════════════════════════════════
type Stats = ReturnType<typeof stats>

function Donut({ s }: { s: Stats }) {
  const total = s.total || 1
  const segs = [
    { v: s.sold, color: '#34d399' },
    { v: s.reserved, color: 'var(--gold)' },
    { v: s.available, color: '#7a8fae' },
  ]
  const R = 70, C = 2 * Math.PI * R
  let offset = 0
  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      <circle cx={90} cy={90} r={R} fill="none" stroke="var(--line)" strokeWidth={22} />
      {segs.map((seg, i) => {
        const frac = seg.v / total
        const dash = frac * C
        const el = (
          <circle key={i} cx={90} cy={90} r={R} fill="none" stroke={seg.color} strokeWidth={22}
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset}
            transform="rotate(-90 90 90)" strokeLinecap="butt" />
        )
        offset += dash
        return el
      })}
      <text x={90} y={84} textAnchor="middle" fontSize={26} fontWeight={800} fill="var(--text)">{fa(s.total)}</text>
      <text x={90} y={106} textAnchor="middle" fontSize={12} fill="var(--muted)">کل واحد</text>
    </svg>
  )
}

function OverviewView({ project, s, onMilestone, busy }: {
  project: Project; s: Stats; onMilestone: (mid: string, status: MilestoneStatus) => void; busy: boolean
}) {
  const maxSale = Math.max(1, ...project.monthlySales.map(m => m.count))
  const tallest = project.monthlySales.reduce((mi, m, i, arr) => m.count > arr[mi].count ? i : mi, 0)
  const soldPct = s.total ? Math.round((s.sold / s.total) * 100) : 0

  const kpis = [
    { label: 'درآمد فروش', value: billions(s.revenue), unit: 'م.ت', sub: s.sold ? `از ${fa(s.sold)} واحدِ فروخته‌شده` : 'هنوز فروشی ثبت نشده', dot: '#60a5fa' },
    { label: 'موجود', value: fa(s.available), unit: 'واحد', sub: 'آماده فروش', dot: 'var(--gold)' },
    { label: 'رزرو', value: fa(s.reserved), unit: 'واحد', sub: 'در انتظار تکمیل', dot: '#f59e0b' },
    { label: 'واحد فروخته‌شده', value: fa(s.sold), unit: '', sub: `از ${fa(s.total)} واحد`, dot: '#34d399' },
  ]

  // milestone cycle pending→active→done→pending
  const cycle = (m: Milestone) => {
    const next: Record<MilestoneStatus, MilestoneStatus> = { pending: 'active', active: 'done', done: 'pending' }
    onMilestone(m.id, next[m.status])
  }
  const activeIdx = project.milestones.findIndex(m => m.status === 'active')

  const src = project.source
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* مشخصاتِ واقعیِ پروژه (از بانکِ اطلاعاتِ ساختمان) — عکس + اطلاعات + کدِ راستی‌آزمایی */}
      {src && (
        <div style={{ ...card, padding: 0, overflow: 'hidden', display: 'flex', flexWrap: 'wrap' }}>
          {(src.photos && src.photos[0]) && (
            <img src={src.photos[0]} alt={src.address || ''} style={{ width: 320, maxWidth: '100%', height: 220, objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 260, padding: 20 }}>
            <div style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700 }}>مشخصاتِ پروژه</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 6, lineHeight: 1.7 }}>{src.address || project.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
              {src.region}{src.phase ? ` · مرحله: ${src.phase}` : ''}
              {src.hashId && <span style={{ marginInlineStart: 10, color: 'var(--faint)' }}>کد: <span style={{ direction: 'ltr', display: 'inline-block' }}>{src.hashId}</span></span>}
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14 }}>
              {[['متراژ زمین', `${fa(src.groundArea || 0)} م²`], ['زیربنا', `${fa(src.residentialArea || 0)} م²`], ['طبقات', fa(src.floors || 0)], ['واحدها', fa(src.totalUnits || 0)]].map(([l, v]) => (
                <div key={l}><div style={{ fontSize: 11, color: 'var(--muted)' }}>{l}</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{v}</div></div>
              ))}
            </div>
            {src.lat != null && src.lng != null && (
              <a href={`https://www.google.com/maps?q=${src.lat},${src.lng}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 14, fontSize: 12.5, color: 'var(--gold)', textDecoration: 'none' }}>📍 مشاهده روی نقشه</a>
            )}
          </div>
        </div>
      )}

      {/* گالریِ همهٔ تصاویرِ پروژه */}
      {src && (src.photos?.length || 0) > 1 && (
        <div style={{ ...card, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>تصاویرِ پروژه ({fa(src.photos!.length)})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {src.photos!.map((ph, i) => (
              <a key={i} href={ph} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                <img src={ph} alt={`عکس ${i + 1}`} style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 10 }} />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="mjb-grid4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: 18, position: 'relative' }}>
            <span style={{ position: 'absolute', top: 16, insetInlineStart: 16, width: 9, height: 9, borderRadius: '50%', background: k.dot }} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {k.value}{k.unit && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', marginInlineStart: 4 }}>{k.unit}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column: donut + sales */}
      <div className="mjb-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Inventory donut */}
        <div style={{ ...card, padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>وضعیت موجودی</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Donut s={s} />
            <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([
                ['فروخته‌شده', s.sold, '#34d399'],
                ['رزرو', s.reserved, 'var(--gold)'],
                ['موجود', s.available, '#7a8fae'],
              ] as [string, number, string][]).map(([label, v, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{fa(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sales summary + bars */}
        <div style={{ ...card, padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>فروش و پیش‌فروش</h3>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{fa(s.sold)} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--muted)' }}>واحد</span></div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginTop: 6, marginBottom: 18 }}>+{fa(soldPct)}٪ از کل پروژه</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
            {project.monthlySales.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{fa(m.count)}</span>
                <div style={{
                  width: '100%', minHeight: 6, height: `${(m.count / maxSale) * 100}%`,
                  background: i === tallest ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : 'linear-gradient(180deg,rgba(201,168,76,0.5),rgba(201,168,76,0.22))',
                  borderRadius: '5px 5px 0 0',
                }} />
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Milestones timeline */}
      <div style={{ ...card, padding: 22 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>مراحل ساخت</h3>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 24 }}>برای تغییر وضعیت روی هر مرحله کلیک کنید</div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {/* base line */}
          <div style={{ position: 'absolute', top: 18, insetInlineStart: 18, insetInlineEnd: 18, height: 2, background: 'var(--line)' }} />
          {/* progress line up to active node (RTL: starts from right) */}
          {activeIdx > 0 && (
            <div style={{
              position: 'absolute', top: 18, insetInlineEnd: 18, height: 2, background: '#34d399',
              width: `calc(${(activeIdx / Math.max(1, project.milestones.length - 1)) * 100}% - 36px)`,
            }} />
          )}
          {project.milestones.map((m, i) => {
            const done = m.status === 'done', active = m.status === 'active'
            const c = done ? '#34d399' : active ? 'var(--gold)' : 'var(--line2)'
            return (
              <div key={m.id} onClick={() => !busy && cycle(m)} style={{
                position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 8, cursor: busy ? 'default' : 'pointer', textAlign: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: done ? 'rgba(52,211,153,0.15)' : active ? 'var(--goldDim)' : 'var(--bg2)',
                  border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: done ? '#34d399' : active ? 'var(--gold)' : 'var(--muted)',
                  animation: active ? 'mjbpulse 2s infinite' : 'none',
                }}>{done ? '✓' : active ? '●' : fa(i + 1)}</div>
                <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--gold)' : done ? 'var(--text)' : 'var(--muted)' }}>{m.name}</div>
                {m.date && <div style={{ fontSize: 11, color: 'var(--faint)' }}>{m.date}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  UNITS
// ════════════════════════════════════════════════════════
function StatusBadge({ st }: { st: UnitStatus }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[st], background: `color-mix(in srgb, ${STATUS_COLOR[st]} 16%, transparent)`, padding: '3px 10px', borderRadius: 6 }}>
      {STATUS_LABEL[st]}
    </span>
  )
}

function UnitsView({ project, post, pid, busy }: {
  project: Project; post: (b: Record<string, unknown>) => Promise<boolean>; pid: string | null; busy: boolean
}) {
  const [filter, setFilter] = useState<'all' | UnitStatus>('all')
  const [limit, setLimit] = useState(120)
  const [form, setForm] = useState({ number: '', floor: '', area: '', price: '', status: 'available' as UnitStatus })

  const filtered = project.units.filter(u => filter === 'all' || u.status === filter)
  const shown = filtered.slice(0, limit)

  const addUnit = async () => {
    if (!form.number.trim()) { alert('شماره واحد را وارد کنید'); return }
    const ok = await post({
      action: 'addUnit', pid, number: form.number.trim(),
      floor: Number(form.floor) || 1, area: Number(form.area) || 0,
      price: (Number(form.price) || 0) * 1e9, status: form.status,
    })
    if (ok) setForm({ number: '', floor: '', area: '', price: '', status: 'available' })
  }

  const changeStatus = async (u: Unit, status: UnitStatus) => {
    const patch: Record<string, unknown> = { status }
    if (status === 'sold') {
      const buyer = window.prompt('نام خریدار:', u.buyer || '')?.trim()
      if (buyer) patch.buyer = buyer
    }
    await post({ action: 'updateUnit', pid, uid: u.id, patch })
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)',
    color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Add unit form */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>＋ واحد جدید</div>
        <div className="mjb-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
          <input placeholder="شماره" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} style={inputStyle} />
          <input placeholder="طبقه" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} style={inputStyle} />
          <input placeholder="متراژ" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} style={inputStyle} />
          <input placeholder="قیمت (میلیارد ت)" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inputStyle} />
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as UnitStatus })} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="available">موجود</option>
            <option value="reserved">رزرو</option>
            <option value="sold">فروخته‌شده</option>
          </select>
          <button onClick={addUnit} disabled={busy} style={{
            padding: '9px 18px', borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#16140f',
            fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT, whiteSpace: 'nowrap',
          }}>افزودن</button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {([['all', 'همه'], ['sold', 'فروخته'], ['reserved', 'رزرو'], ['available', 'موجود']] as [typeof filter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => { setFilter(f); setLimit(120) }} style={{
            padding: '7px 16px', borderRadius: 99, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
            border: '1px solid ' + (filter === f ? 'var(--gold)' : 'var(--line)'),
            background: filter === f ? 'var(--goldDim)' : 'transparent',
            color: filter === f ? 'var(--gold)' : 'var(--muted)', fontWeight: filter === f ? 700 : 500,
          }}>{label}</button>
        ))}
        <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--muted)' }}>{fa(filtered.length)} واحد</span>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 70px 90px 1fr 110px 1fr 150px', padding: '12px 18px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          <div>شماره</div><div>طبقه</div><div>متراژ</div><div>قیمت</div><div>وضعیت</div><div>خریدار</div><div style={{ textAlign: 'left' }}>عملیات</div>
        </div>
        <div style={{ maxHeight: 540, overflowY: 'auto' }}>
          {shown.map((u, i) => (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '90px 70px 90px 1fr 110px 1fr 150px', padding: '12px 18px', borderBottom: i < shown.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: 'var(--gold)' }}>{u.number}</div>
              <div style={{ color: 'var(--muted)' }}>طبقه {fa(u.floor)}</div>
              <div>{fa(u.area)} م²</div>
              <div style={{ fontWeight: 600 }}>{money(u.price)}</div>
              <div><StatusBadge st={u.status} /></div>
              <div style={{ color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.buyer || '—'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                <select value={u.status} onChange={e => changeStatus(u, e.target.value as UnitStatus)} disabled={busy} style={{
                  padding: '5px 8px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)',
                  color: 'var(--text)', fontSize: 11.5, outline: 'none', cursor: 'pointer', fontFamily: FONT,
                }}>
                  <option value="available">موجود</option>
                  <option value="reserved">رزرو</option>
                  <option value="sold">فروخته‌شده</option>
                </select>
                <button onClick={() => post({ action: 'deleteUnit', pid, uid: u.id })} disabled={busy} title="حذف" style={{
                  width: 26, height: 26, borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)',
                  color: 'var(--muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0, fontFamily: FONT,
                }}>×</button>
              </div>
            </div>
          ))}
          {shown.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>واحدی یافت نشد</div>}
        </div>
        {limit < filtered.length && (
          <button onClick={() => setLimit(l => l + 120)} style={{
            width: '100%', padding: '12px', background: 'var(--bg2)', border: 'none', borderTop: '1px solid var(--line)',
            color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          }}>بیشتر ({fa(filtered.length - limit)} واحد دیگر)</button>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  SALES
// ════════════════════════════════════════════════════════
function SalesView({ project, s }: { project: Project; s: Stats }) {
  const txns = project.units.filter(u => u.status === 'sold' || u.status === 'reserved')
  const maxSale = Math.max(1, ...project.monthlySales.map(m => m.count))
  const tallest = project.monthlySales.reduce((mi, m, i, arr) => m.count > arr[mi].count ? i : mi, 0)

  const summary = [
    { label: 'درآمد محقق‌شده', value: billions(s.revenue) + ' م.ت', color: 'var(--gold)' },
    { label: 'واحد فروخته‌شده', value: fa(s.sold), color: '#34d399' },
    { label: 'واحد رزرو', value: fa(s.reserved), color: '#f59e0b' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary KPIs */}
      <div className="mjb-grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {summary.map(k => (
          <div key={k.label} style={{ ...card, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{k.label}</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Monthly sales mini-chart */}
      <div style={{ ...card, padding: 22 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>فروش ماهانه</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 110 }}>
          {project.monthlySales.map((m, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{fa(m.count)}</span>
              <div style={{ width: '100%', minHeight: 6, height: `${(m.count / maxSale) * 100}%`, background: i === tallest ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : 'rgba(201,168,76,0.35)', borderRadius: '5px 5px 0 0' }} />
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions list */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', fontSize: 15, fontWeight: 700 }}>تراکنش‌ها ({fa(txns.length)})</div>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px 1fr 120px', padding: '12px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          <div>واحد</div><div>خریدار</div><div>متراژ</div><div>قیمت</div><div>وضعیت</div>
        </div>
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {txns.map((u, i) => (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px 1fr 120px', padding: '12px 20px', borderBottom: i < txns.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: 'var(--gold)' }}>{u.number}</div>
              <div style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.buyer || '—'}</div>
              <div style={{ color: 'var(--muted)' }}>{fa(u.area)} م²</div>
              <div style={{ fontWeight: 600 }}>{money(u.price)}</div>
              <div><StatusBadge st={u.status} /></div>
            </div>
          ))}
          {txns.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>تراکنشی ثبت نشده است</div>}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  INVESTORS
// ════════════════════════════════════════════════════════
function InvestorsView({ project, post, pid, busy }: {
  project: Project; post: (b: Record<string, unknown>) => Promise<boolean>; pid: string | null; busy: boolean
}) {
  const [form, setForm] = useState({ name: '', phone: '', amount: '', units: '' })
  const totalInvested = project.investors.reduce((a, v) => a + v.amount, 0)

  const addInvestor = async () => {
    if (!form.name.trim()) { alert('نام سرمایه‌گذار را وارد کنید'); return }
    const ok = await post({
      action: 'addInvestor', pid, name: form.name.trim(), phone: form.phone.trim() || undefined,
      amount: (Number(form.amount) || 0) * 1e9, units: Number(form.units) || 0,
    })
    if (ok) setForm({ name: '', phone: '', amount: '', units: '' })
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)',
    color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Total summary */}
      <div style={{ ...card, background: 'linear-gradient(135deg,rgba(201,168,76,0.1),rgba(201,168,76,0.03))', border: '1px solid rgba(201,168,76,0.25)', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>کل سرمایهٔ جذب‌شده</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--gold)' }}>{billions(totalInvested)} <span style={{ fontSize: 15, fontWeight: 500 }}>میلیارد تومان</span></div>
        </div>
        <div style={{ borderInlineStart: '1px solid var(--line)', paddingInlineStart: 32 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>تعداد سرمایه‌گذاران</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{fa(project.investors.length)}</div>
        </div>
      </div>

      {/* Add investor */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>＋ سرمایه‌گذار جدید</div>
        <div className="mjb-form" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.8fr auto', gap: 10 }}>
          <input placeholder="نام" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <input placeholder="تلفن" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
          <input placeholder="مبلغ (میلیارد ت)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} />
          <input placeholder="واحد" value={form.units} onChange={e => setForm({ ...form, units: e.target.value })} style={inputStyle} />
          <button onClick={addInvestor} disabled={busy} style={{
            padding: '9px 18px', borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#16140f',
            fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT, whiteSpace: 'nowrap',
          }}>افزودن</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 90px 60px', padding: '12px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          <div>نام</div><div>تلفن</div><div>سرمایه</div><div>واحد</div><div style={{ textAlign: 'left' }}>حذف</div>
        </div>
        {project.investors.map((v, i) => (
          <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 90px 60px', padding: '14px 20px', borderBottom: i < project.investors.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>{v.name}</div>
            <div style={{ color: 'var(--muted)' }}>{v.phone || '—'}</div>
            <div style={{ fontWeight: 700, color: 'var(--gold)' }}>{billions(v.amount)} م.ت</div>
            <div style={{ color: 'var(--muted)' }}>{fa(v.units || 0)}</div>
            <div style={{ textAlign: 'left' }}>
              <button onClick={() => post({ action: 'deleteInvestor', pid, vid: v.id })} disabled={busy} title="حذف" style={{
                width: 26, height: 26, borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)',
                color: 'var(--muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, fontFamily: FONT,
              }}>×</button>
            </div>
          </div>
        ))}
        {project.investors.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>سرمایه‌گذاری ثبت نشده است</div>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  REPORTS
// ════════════════════════════════════════════════════════
function ReportsView({ project, s }: { project: Project; s: Stats }) {
  const sellRate = s.total ? Math.round((s.sold / s.total) * 100) : 0
  const withArea = project.units.filter(u => u.area > 0)
  const avgPerMeter = withArea.length ? Math.round(withArea.reduce((a, u) => a + u.price / u.area, 0) / withArea.length) : 0
  const maxSale = Math.max(1, ...project.monthlySales.map(m => m.count))
  const tallest = project.monthlySales.reduce((mi, m, i, arr) => m.count > arr[mi].count ? i : mi, 0)

  const cards = [
    { label: 'نرخ فروش', value: fa(sellRate) + '٪', sub: `${fa(s.sold)} از ${fa(s.total)} واحد`, color: '#34d399' },
    { label: 'درآمد محقق‌شده', value: billions(s.revenue) + ' م.ت', sub: 'از واحدهای فروخته‌شده', color: 'var(--gold)' },
    { label: 'میانگین قیمت هر متر', value: money(avgPerMeter), sub: 'بر اساس کل واحدها', color: '#60a5fa' },
    { label: 'تعداد سرمایه‌گذاران', value: fa(project.investors.length), sub: `${billions(project.investors.reduce((a, v) => a + v.amount, 0))} م.ت سرمایه`, color: '#f59e0b' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="mjb-grid4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {cards.map(c => (
          <div key={c.label} style={{ ...card, padding: 20, position: 'relative' }}>
            <span style={{ position: 'absolute', top: 16, insetInlineStart: 16, width: 9, height: 9, borderRadius: '50%', background: c.color }} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Monthly sales chart */}
      <div style={{ ...card, padding: 22 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>نمودار فروش ماهانه</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 160 }}>
          {project.monthlySales.map((m, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>{fa(m.count)}</span>
              <div style={{ width: '100%', minHeight: 8, height: `${(m.count / maxSale) * 100}%`, background: i === tallest ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : 'linear-gradient(180deg,rgba(201,168,76,0.5),rgba(201,168,76,0.22))', borderRadius: '6px 6px 0 0' }} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{m.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
