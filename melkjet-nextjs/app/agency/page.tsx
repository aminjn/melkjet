'use client'
import { useState, useEffect, useCallback } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'
import MessagesPanel from '@/app/components/MessagesPanel'
import NegotiationEngine from '@/app/components/NegotiationEngine'
import DivarImport from '@/app/components/DivarImport'
import JalaliDatePicker from '@/app/components/JalaliDatePicker'
import NumberInput from '@/app/components/NumberInput'
import CrmTool, { CRM_VIEWS, type CrmView } from '@/app/components/tools/CrmTool'
import MarketingTool, { MARKETING_VIEWS, type MarketingView } from '@/app/components/tools/MarketingTool'
import WorkflowTool, { WORKFLOW_VIEWS, type WorkflowView } from '@/app/components/tools/WorkflowTool'
import WebsiteBuilderTool, { WEBSITE_VIEWS, type WebsiteView } from '@/app/components/tools/WebsiteBuilderTool'
import ArticleEditor from '@/app/components/ArticleEditor'

// ════════ Types (mirror app/lib/agency-store.ts) ════════
type Stage = 'new' | 'assigned' | 'visit' | 'negotiation' | 'closed' | 'lost'
type ListingStatus = 'active' | 'sold' | 'rented'

interface Agent { id: string; name: string; phone?: string; deals: number; leads: number; commission: number; active: boolean; createdAt: number }
interface Listing { id: string; title: string; ptype: string; location: string; price: number; deal: 'sale' | 'rent'; status: ListingStatus; agent?: string; createdAt: number }
interface Lead { id: string; name: string; phone?: string; need?: string; budget?: string; stage: Stage; assignedTo?: string; createdAt: number }
interface Deal { id: string; title: string; amount: number; agent: string; date: string; createdAt: number }
interface Stats {
  profile: { name: string; branches?: string }
  kpis: { activeAgents: number; totalAgents: number; activeListings: number; openLeads: number; dealsThisMonth: number; monthSales: number; monthChange: number; totalCommission: number }
  monthlySales: { month: string; amount: number }[]
  topAgents: Agent[]
  recentLeads: Lead[]
  recentDeals: Deal[]
}
interface AgencyData { stats: Stats; agents: Agent[]; listings: Listing[]; leads: Lead[]; deals: Deal[] }

// عضویت واقعی مشاور↔آژانس (mirror app/lib/agency-link-store.ts)
interface LinkMember { advisorPhone: string; advisorName: string; agencyPhone: string; agencyName: string; since: number }
interface LinkRequest { id: string; advisorPhone: string; advisorName: string; agencyPhone: string; agencyName: string; initiator: 'advisor' | 'agency'; status: string; createdAt: number }

type View = 'dashboard' | 'assistant' | 'messages' | 'negotiation' | 'divar' | 'articles' | 'agents' | 'listings' | 'leads' | 'deals' | 'settings'

// ════════ Helpers ════════
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
function money(n: number): string {
  if (!n) return '—'
  if (n >= 1e9) return fa(Math.round((n / 1e9) * 10) / 10) + ' میلیارد'
  if (n >= 1e6) return fa(Math.round(n / 1e6)) + ' میلیون'
  return fa(n) + ' تومان'
}
const faDate = (ts: number) => { try { return new Date(ts).toLocaleDateString('fa-IR') } catch { return '' } }

const STAGES: Stage[] = ['new', 'assigned', 'visit', 'negotiation', 'closed', 'lost']
const STAGE_LABEL: Record<Stage, string> = { new: 'جدید', assigned: 'تخصیص‌یافته', visit: 'بازدید', negotiation: 'مذاکره', closed: 'قرارداد', lost: 'ازدست‌رفته' }
const STAGE_COLOR: Record<Stage, string> = { new: 'var(--gold)', assigned: '#60a5fa', visit: '#2dd4bf', negotiation: '#f59e0b', closed: '#34d399', lost: '#7a8fae' }
const LIST_LABEL: Record<ListingStatus, string> = { active: 'فعال', sold: 'فروخته‌شده', rented: 'اجاره‌رفته' }
const LIST_COLOR: Record<ListingStatus, string> = { active: '#34d399', sold: '#60a5fa', rented: '#2dd4bf' }
const LIST_STATUSES: ListingStatus[] = ['active', 'sold', 'rented']
const DEAL_LABEL = { sale: 'فروش', rent: 'اجاره' } as const
const PTYPE_OPTIONS = ['آپارتمان', 'ویلا', 'زمین', 'مغازه', 'سایر']

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inputStyle: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%' }
const actionBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap' }
const goldBtn: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }

const VIEW_TITLES: Record<View, string> = { dashboard: 'داشبورد آژانس', assistant: 'دستیار هوشمند', messages: 'پیام‌ها', negotiation: 'موتور مذاکره', divar: 'ایمپورت از دیوار', articles: 'مقالات و وبلاگ', agents: 'مشاوران', listings: 'فایل‌های آژانس', leads: 'لیدها', deals: 'معاملات', settings: 'تنظیمات' }
const NAV_ITEMS: { id: View; label: string; icon: string; badge?: 'agents' | 'leads' }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '▦' },
  { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
  { id: 'messages', label: 'پیام‌ها', icon: '💬' },
  { id: 'negotiation', label: 'موتور مذاکره', icon: '🤝' },
  { id: 'divar', label: 'ایمپورت از دیوار', icon: '📥' },
  { id: 'articles', label: 'مقالات', icon: '✎' },
  { id: 'agents', label: 'مشاوران', icon: '☷', badge: 'agents' },
  { id: 'listings', label: 'فایل‌ها', icon: '◫' },
  { id: 'leads', label: 'لیدها', icon: '◎', badge: 'leads' },
  { id: 'deals', label: 'معاملات', icon: '﷼' },
  { id: 'settings', label: 'تنظیمات', icon: '⛭' },
]
function Pill({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>{label}</span>
}
function Kpi({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div style={{ ...card, padding: '16px 18px', flex: '1 1 150px', minWidth: 150 }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: subColor || 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function AgencyPage() {
  const [view, setView] = useState<View>('dashboard')
  // ابزارهای جاسازی‌شده: وقتی مقدار دارند، محتوای ابزار در همین پنل نمایش داده می‌شود
  const [crmView, setCrmView] = useState<CrmView | null>(null)
  const [crmOpen, setCrmOpen] = useState(false)
  const [mktView, setMktView] = useState<MarketingView | null>(null)
  const [mktOpen, setMktOpen] = useState(false)
  const [wfView, setWfView] = useState<WorkflowView | null>(null)
  const [wfOpen, setWfOpen] = useState(false)
  const [wbView, setWbView] = useState<WebsiteView | null>(null)
  const [wbOpen, setWbOpen] = useState(false)
  const clearTools = () => { setCrmView(null); setMktView(null); setWfView(null); setWbView(null) }
  const goView = (v: View) => { setView(v); clearTools() }
  const openCrm = (v: CrmView) => { clearTools(); setCrmView(v); setCrmOpen(true) }
  const openMkt = (v: MarketingView) => { clearTools(); setMktView(v); setMktOpen(true) }
  const openWf = (v: WorkflowView) => { clearTools(); setWfView(v); setWfOpen(true) }
  const openWb = (v: WebsiteView) => { clearTools(); setWbView(v); setWbOpen(true) }
  const [data, setData] = useState<AgencyData | null>(null)
  const [myName, setMyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [unauth, setUnauth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [search, setSearch] = useState('')
  const [ng, setNg] = useState({ name: '', phone: '' })
  const [nf, setNf] = useState({ title: '', ptype: '', location: '', price: '', deal: 'sale', agent: '' })
  const [nl, setNl] = useState({ name: '', phone: '', need: '', budget: '' })
  const [nd, setNd] = useState({ title: '', amount: '', agent: '', date: '' })
  const [prof, setProf] = useState({ name: '', branches: '' })
  // عضویت واقعی مشاوران (advisor↔agency)
  const [members, setMembers] = useState<LinkMember[]>([])
  const [linkReqs, setLinkReqs] = useState<LinkRequest[]>([])
  const [invitePhone, setInvitePhone] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)

  const refreshLinks = useCallback(async () => {
    try {
      const r = await fetch('/api/agency-link')
      if (!r.ok) return
      const d = await r.json().catch(() => ({}))
      if (d.role === 'agency') {
        setMembers(Array.isArray(d.members) ? d.members : [])
        setLinkReqs(Array.isArray(d.requests) ? d.requests : [])
      }
    } catch {}
  }, [])

  const postLink = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setLinkBusy(true)
    try {
      const r = await fetch('/api/agency-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) { alert(d.error || 'خطا در انجام عملیات'); if (!r.ok) return false }
      await refreshLinks(); return !d.error
    } catch { return false } finally { setLinkBusy(false) }
  }, [refreshLinks])

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/agency')
      if (r.status === 401) { setUnauth(true); setLoading(false); return }
      const d = await r.json(); setData(d); setUnauth(false)
      setProf({ name: d.stats.profile.name || '', branches: d.stats.profile.branches || '' })
    } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { refreshLinks() }, [refreshLinks])
  useEffect(() => { fetch('/api/auth/profile', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d?.account?.name) setMyName(d.account.name) }).catch(() => {}) }, [])

  const [dupWarn, setDupWarn] = useState('')
  const post = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    try {
      const r = await fetch('/api/agency', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'برای انجام این عملیات وارد شوید'); return false }
      if (d.duplicate) setDupWarn(`⚠ این فایل احتمالاً تکراری است با «${d.duplicate.title}»${d.duplicate.ownerName ? ` (${d.duplicate.ownerName})` : ''}. بررسی کنید قبلاً ثبت نشده باشد.`)
      await refresh(); return true
    } catch { return false } finally { setBusy(false) }
  }, [refresh])

  const toggleTheme = () => { const html = document.documentElement; if (theme === 'dark') { html.classList.add('light'); setTheme('light') } else { html.classList.remove('light'); setTheme('dark') } }

  if (loading) return <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 15 }}>در حال بارگذاری پنل آژانس…</div>
  if (unauth || !data) return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ ...card, padding: '40px 44px', textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>برای دسترسی به پنل آژانس وارد شوید</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>این پنل فقط برای کاربران واردشده در دسترس است.</div>
        <a href="/auth" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>ورود به حساب</a>
      </div>
    </div>
  )

  const { stats, agents, listings, leads, deals } = data
  const q = search.trim()
  const listingsF = q ? listings.filter(l => (l.title + l.location + (l.agent || '')).includes(q)) : listings
  const activeAgentNames = agents.filter(a => a.active).map(a => a.name)
  const maxSales = Math.max(1, ...stats.monthlySales.map(m => m.amount))
  const sectionTitle = (t: string) => <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>{t}</div>
  const agentSelect = (val: string, on: (v: string) => void) => (
    <select value={val} onChange={e => on(e.target.value)} style={inputStyle}><option value="">— مشاور —</option>{activeAgentNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
  )

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <style>{`@media(max-width:760px){.mjg-side{width:60px!important}.mjg-sidelabel{display:none!important}.mjg-cols{flex-direction:column!important}}`}</style>

      {/* SIDEBAR */}
      <aside className="mjg-side" style={{ width: 232, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--line)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px var(--gold)', flexShrink: 0 }}>
              <div style={{ width: 13, height: 13, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 3 }} />
            </div>
            <div><div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px' }}>ملک‌جت</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>پنل آژانس</div></div>
          </div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = view === item.id && !crmView && !mktView && !wfView && !wbView
            const badge = item.badge === 'agents' ? stats.kpis.activeAgents : item.badge === 'leads' ? stats.kpis.openLeads : 0
            return (
              <button key={item.id} onClick={() => goView(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontWeight: active ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                <span className="mjg-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badge > 0 && <span style={{ background: active ? 'var(--gold)' : 'var(--line2)', color: active ? '#16140f' : 'var(--text)', borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{fa(badge)}</span>}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />

          {/* CRM — جاسازی‌شده با منوی آبشاری (داخل همین پنل باز می‌شود) */}
          <button onClick={() => { setCrmOpen(o => !o); if (!crmView) openCrm('dashboard') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: crmView ? 'var(--goldDim)' : 'transparent', color: crmView ? 'var(--gold)' : 'var(--muted)', fontWeight: crmView ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: crmView ? 1 : 0.7 }}>◇</span>
            <span className="mjg-sidelabel" style={{ flex: 1 }}>CRM و مشتریان</span>
            <span className="mjg-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: crmOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {crmOpen && CRM_VIEWS.map(cv => {
            const on = crmView === cv.id
            return (
              <button key={cv.id} onClick={() => openCrm(cv.id)} className="mjg-sidelabel" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px 8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{cv.icon}</span>
                <span style={{ flex: 1 }}>{cv.label}</span>
              </button>
            )
          })}

          {/* مارکتینگ — جاسازی‌شده با منوی آبشاری (مثل CRM) */}
          <button onClick={() => { setMktOpen(o => !o); if (!mktView) openMkt('overview') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: mktView ? 'var(--goldDim)' : 'transparent', color: mktView ? 'var(--gold)' : 'var(--muted)', fontWeight: mktView ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: mktView ? 1 : 0.7 }}>◬</span>
            <span className="mjg-sidelabel" style={{ flex: 1 }}>مارکتینگ</span>
            <span className="mjg-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: mktOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {mktOpen && MARKETING_VIEWS.map(mv => {
            const on = mktView === mv.id
            return (
              <button key={mv.id} onClick={() => openMkt(mv.id)} className="mjg-sidelabel" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{mv.icon}</span>
                <span style={{ flex: 1 }}>{mv.label}</span>
              </button>
            )
          })}

          {/* اتوماسیون — منوی آبشاری، داخل همین پنل */}
          <button onClick={() => { setWfOpen(o => !o); if (!wfView) openWf(WORKFLOW_VIEWS[0].id) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: wfView ? 'var(--goldDim)' : 'transparent', color: wfView ? 'var(--gold)' : 'var(--muted)', fontWeight: wfView ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: wfView ? 1 : 0.7 }}>⛭</span>
            <span className="mjg-sidelabel" style={{ flex: 1 }}>اتوماسیون</span>
            <span className="mjg-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: wfOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {wfOpen && WORKFLOW_VIEWS.map(v => {
            const on = wfView === v.id
            return (
              <button key={v.id} onClick={() => openWf(v.id)} className="mjg-sidelabel" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{v.icon}</span>
                <span style={{ flex: 1 }}>{v.label}</span>
              </button>
            )
          })}

          {/* وب‌سایت‌ساز — منوی آبشاری، داخل همین پنل */}
          <button onClick={() => { setWbOpen(o => !o); if (!wbView) openWb(WEBSITE_VIEWS[0].id) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: wbView ? 'var(--goldDim)' : 'transparent', color: wbView ? 'var(--gold)' : 'var(--muted)', fontWeight: wbView ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: wbView ? 1 : 0.7 }}>◳</span>
            <span className="mjg-sidelabel" style={{ flex: 1 }}>وب‌سایت‌ساز</span>
            <span className="mjg-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: wbOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {wbOpen && WEBSITE_VIEWS.map(v => {
            const on = wbView === v.id
            return (
              <button key={v.id} onClick={() => openWb(v.id)} className="mjg-sidelabel" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{v.icon}</span>
                <span style={{ flex: 1 }}>{v.label}</span>
              </button>
            )
          })}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#16140f', flexShrink: 0 }}>{stats.profile.name.trim().charAt(0) || 'آ'}</div>
          <div className="mjg-sidelabel" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.profile.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>آژانس املاک</div>
          </div>
          <button onClick={toggleTheme} title="تغییر تم" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{theme === 'dark' ? '☀' : '☾'}</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--navbg)', backdropFilter: 'blur(18px)', zIndex: 20, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{crmView ? `CRM · ${CRM_VIEWS.find(v => v.id === crmView)?.label || ''}` : mktView ? `مارکتینگ · ${MARKETING_VIEWS.find(v => v.id === mktView)?.label || ''}` : wfView ? `اتوماسیون · ${WORKFLOW_VIEWS.find(v => v.id === wfView)?.label || ''}` : wbView ? `وب‌سایت‌ساز · ${WEBSITE_VIEWS.find(v => v.id === wbView)?.label || ''}` : VIEW_TITLES[view]}</div>
          <div style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی فایل، مشاور…" style={{ ...inputStyle, width: 220, maxWidth: '40vw' }} />
          <button onClick={() => setView('agents')} style={{ ...goldBtn, padding: '9px 16px' }}>+ مشاور</button>
        </header>

        <main style={{ padding: 22, flex: 1, overflowY: 'auto' }}>
          {crmView ? <CrmTool embedded view={crmView} onView={v => setCrmView(v)} />
            : mktView ? <MarketingTool embedded view={mktView} onView={v => setMktView(v)} />
            : wfView ? <div style={{ height: 'calc(100vh - 130px)' }}><WorkflowTool embedded view={wfView} onView={v => setWfView(v)} /></div>
            : wbView ? <div style={{ height: 'calc(100vh - 130px)' }}><WebsiteBuilderTool embedded view={wbView} onView={v => setWbView(v)} /></div>
            : <>
          {/* DASHBOARD */}
          {view === 'dashboard' && <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Kpi label="مشاوران فعال" value={fa(stats.kpis.activeAgents)} sub={`${fa(stats.kpis.totalAgents)} کل`} />
              <Kpi label="فایل‌های فعال" value={fa(stats.kpis.activeListings)} />
              <Kpi label="لیدهای باز" value={fa(stats.kpis.openLeads)} />
              <Kpi label="معاملات این ماه" value={fa(stats.kpis.dealsThisMonth)} />
              <Kpi label="فروش این ماه" value={money(stats.kpis.monthSales)} subColor={stats.kpis.monthChange >= 0 ? '#34d399' : '#ef4444'} sub={`${stats.kpis.monthChange >= 0 ? '+' : ''}${fa(stats.kpis.monthChange)}٪`} />
            </div>
            <div className="mjg-cols" style={{ display: 'flex', gap: 16 }}>
              <div style={{ ...card, padding: 18, flex: 1, minWidth: 0 }}>
                {sectionTitle('برترین مشاوران')}
                {stats.topAgents.map((g, i) => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: i === 0 ? 'var(--gold)' : 'var(--line2)', color: i === 0 ? '#16140f' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{fa(i + 1)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{g.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{fa(g.deals)} معامله · {fa(g.leads)} لید</div></div>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>{money(g.commission)}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...card, padding: 18, flex: 1.4, minWidth: 0 }}>
                {sectionTitle('فروش ۶ ماهه')}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, padding: '8px 0' }}>
                  {stats.monthlySales.map((m, i) => {
                    const last = i === stats.monthlySales.length - 1
                    return (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 9, color: 'var(--muted)' }}>{fa(Math.round(m.amount / 1e9))}</div>
                        <div style={{ width: '70%', height: `${(m.amount / maxSales) * 110}px`, minHeight: 4, borderRadius: 6, background: last ? 'linear-gradient(180deg,var(--gold),var(--gold2))' : 'var(--line2)' }} />
                        <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{m.month}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center' }}>ارقام به میلیارد تومان</div>
              </div>
            </div>
            <div className="mjg-cols" style={{ display: 'flex', gap: 16 }}>
              <div style={{ ...card, padding: 18, flex: 1, minWidth: 0 }}>
                {sectionTitle('لیدهای اخیر')}
                {stats.recentLeads.length ? stats.recentLeads.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.need} {l.assignedTo ? `· ${l.assignedTo}` : '· تخصیص‌نیافته'}</div></div>
                    <Pill label={STAGE_LABEL[l.stage]} color={STAGE_COLOR[l.stage]} />
                  </div>
                )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>لیدی نداری.</div>}
              </div>
              <div style={{ ...card, padding: 18, flex: 1, minWidth: 0 }}>
                {sectionTitle('معاملات اخیر')}
                {stats.recentDeals.length ? stats.recentDeals.map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{d.title}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{d.agent} · {d.date}</div></div>
                    <div style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700 }}>{money(d.amount)}</div>
                  </div>
                )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>معامله‌ای نداری.</div>}
              </div>
            </div>
          </div>}

          {/* ASSISTANT */}
          {view === 'assistant' && (
            <div style={{ height: 'calc(100vh - 130px)' }}>
              <AssistantPanel panel="agency" title="دستیار هوشمند آژانس" subtitle="مشاور AI شخصیِ تو" suggestions={["استراتژی بازاریابی این ماه را پیشنهاد بده", "چطور عملکرد تیم مشاوران را بهبود بدم؟", "یک گزارش کوتاه از وضعیت فروش بنویس", "لیدها را چطور بین مشاوران تقسیم کنم؟"]} />
            </div>
          )}

          {/* MESSAGES — گفتگوی واقعی با خریدارانِ آگهی‌های آژانس */}
          {view === 'messages' && <MessagesPanel role="owner" />}

          {/* NEGOTIATION ENGINE — داخلِ همین پنل */}
          {view === 'negotiation' && <NegotiationEngine listings={listings.map(l => ({ id: l.id, title: l.title, price: l.price, deal: l.deal, location: l.location }))} />}

          {/* ایمپورت از دیوار — مخصوص آژانس (آگهی‌ها با صاحبِ آژانس منتشر می‌شوند) */}
          {view === 'divar' && <DivarImport onChange={refresh} entity="آژانس" />}

          {/* ARTICLES (CMS) */}
          {view === 'articles' && (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.7 }}>
                مقاله‌ای که با نام شما منتشر می‌شود، در صفحهٔ مقاله به آگهی‌هایتان لینک می‌شود و می‌توانید آن را در «وبلاگ» وب‌سایت خود نمایش دهید (سئو خودکار: slug و عنوان در صورت تکراری‌بودن خودکار اصلاح می‌شوند).
              </div>
              <ArticleEditor compact author={myName || undefined} />
            </div>
          )}

          {/* AGENTS */}
          {view === 'agents' && (() => {
            const joinReqs = linkReqs.filter(r => r.initiator === 'advisor')
            const outInvites = linkReqs.filter(r => r.initiator === 'agency')
            return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ١. درخواست‌های عضویت (مشاوران متقاضیِ پیوستن) */}
            {joinReqs.length > 0 && (
              <div style={{ ...card, padding: 18 }}>
                {sectionTitle(`درخواست‌های عضویت (${fa(joinReqs.length)})`)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {joinReqs.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.advisorName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{r.advisorPhone}</div>
                      </div>
                      <button disabled={linkBusy} onClick={() => postLink({ action: 'respond', id: r.id, accept: true })} style={{ ...goldBtn, padding: '7px 16px' }}>پذیرش</button>
                      <button disabled={linkBusy} onClick={() => postLink({ action: 'respond', id: r.id, accept: false })} style={{ ...actionBtn, color: '#ef4444' }}>رد</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ٢. افزودن/دعوت مشاور (بر اساس شماره) + دعوت‌های در انتظار */}
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('افزودن/دعوت مشاور')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>شماره موبایل مشاور</label>
                  <input value={invitePhone} onChange={e => setInvitePhone(e.target.value)} placeholder="09xxxxxxxxx" inputMode="numeric" style={inputStyle} />
                </div>
                <button disabled={linkBusy || !invitePhone.trim()} onClick={async () => { if (await postLink({ action: 'invite', advisorPhone: invitePhone.trim() })) setInvitePhone('') }} style={goldBtn}>دعوت</button>
              </div>
              {outInvites.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {outInvites.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Pill label="در انتظار" color="#f59e0b" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>در انتظار پاسخِ {r.advisorName}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.advisorPhone}</span>
                      </div>
                      <button disabled={linkBusy} onClick={() => postLink({ action: 'cancel', id: r.id })} style={{ ...actionBtn, color: '#ef4444' }}>لغو</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ٣. مشاوران آژانس (اعضای واقعی) */}
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle(`مشاوران آژانس (${fa(members.length)})`)}
              {members.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(m => (
                    <div key={m.advisorPhone} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{m.advisorName.charAt(0)}</div>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{m.advisorName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{m.advisorPhone} · عضو از {new Date(m.since).toLocaleDateString('fa-IR')}</div>
                      </div>
                      <button disabled={linkBusy} onClick={() => postLink({ action: 'remove', advisorPhone: m.advisorPhone })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>هنوز مشاوری به آژانس نپیوسته است.</div>}
            </div>

            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('افزودن مشاور')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 180px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام</label><input value={ng.name} onChange={e => setNg({ ...ng, name: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 150px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>تلفن</label><input value={ng.phone} onChange={e => setNg({ ...ng, phone: e.target.value })} style={inputStyle} /></div>
                <button disabled={busy || !ng.name.trim()} onClick={async () => { if (await post({ action: 'addAgent', name: ng.name.trim(), phone: ng.phone })) setNg({ name: '', phone: '' }) }} style={goldBtn}>افزودن</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('تیم مشاوران')}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
                {agents.map(g => (
                  <div key={g.id} style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, opacity: g.active ? 1 : 0.55 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{g.name.charAt(0)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{g.phone || '—'}</div></div>
                      <Pill label={g.active ? 'فعال' : 'غیرفعال'} color={g.active ? '#34d399' : '#7a8fae'} />
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)' }}><span>{fa(g.deals)} معامله</span><span>{fa(g.leads)} لید</span><span style={{ color: 'var(--gold)' }}>{money(g.commission)}</span></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => post({ action: 'toggleAgent', id: g.id })} style={actionBtn}>{g.active ? 'غیرفعال' : 'فعال'}</button>
                      <button onClick={() => post({ action: 'deleteAgent', id: g.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          })()}

          {/* LISTINGS */}
          {view === 'listings' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('افزودن فایل')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 170px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>عنوان</label><input value={nf.title} onChange={e => setNf({ ...nf, title: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 110px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع</label><select value={nf.ptype} onChange={e => setNf({ ...nf, ptype: e.target.value })} style={inputStyle}><option value="">—</option>{PTYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div style={{ flex: '1 1 110px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>منطقه</label><input value={nf.location} onChange={e => setNf({ ...nf, location: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 130px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>قیمت</label><input value={nf.price} onChange={e => setNf({ ...nf, price: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                <div style={{ flex: '0 1 100px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>معامله</label><select value={nf.deal} onChange={e => setNf({ ...nf, deal: e.target.value })} style={inputStyle}><option value="sale">فروش</option><option value="rent">اجاره</option></select></div>
                <div style={{ flex: '1 1 130px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مشاور</label>{agentSelect(nf.agent, v => setNf({ ...nf, agent: v }))}</div>
                <button disabled={busy || !nf.title.trim()} onClick={async () => { if (await post({ action: 'addListing', title: nf.title.trim(), ptype: nf.ptype || 'آپارتمان', location: nf.location, price: Number(nf.price) || 0, deal: nf.deal, agent: nf.agent })) setNf({ title: '', ptype: '', location: '', price: '', deal: 'sale', agent: '' }) }} style={goldBtn}>افزودن</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle(`فایل‌ها (${fa(listingsF.length)})`)}
              {listingsF.length ? listingsF.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{l.title} <Pill label={DEAL_LABEL[l.deal]} color={l.deal === 'sale' ? '#60a5fa' : '#2dd4bf'} /></div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{l.ptype} · {l.location} · {money(l.price)}</div>
                  </div>
                  <select value={l.agent || ''} onChange={e => post({ action: 'assignListing', id: l.id, agent: e.target.value })} style={{ ...actionBtn, cursor: 'pointer' }}><option value="">— مشاور —</option>{activeAgentNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
                  <select value={l.status} onChange={e => post({ action: 'setListingStatus', id: l.id, status: e.target.value })} style={{ ...actionBtn, cursor: 'pointer', color: LIST_COLOR[l.status], borderColor: LIST_COLOR[l.status] }}>{LIST_STATUSES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{LIST_LABEL[s]}</option>)}</select>
                  <button onClick={() => post({ action: 'deleteListing', id: l.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>فایلی نداری.</div>}
            </div>
          </div>}

          {/* LEADS */}
          {view === 'leads' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('افزودن لید')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام</label><input value={nl.name} onChange={e => setNl({ ...nl, name: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 130px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>تلفن</label><input value={nl.phone} onChange={e => setNl({ ...nl, phone: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '2 1 180px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نیاز</label><input value={nl.need} onChange={e => setNl({ ...nl, need: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 110px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>بودجه</label><input value={nl.budget} onChange={e => setNl({ ...nl, budget: e.target.value })} style={inputStyle} /></div>
                <button disabled={busy || !nl.name.trim()} onClick={async () => { if (await post({ action: 'addLead', name: nl.name.trim(), phone: nl.phone, need: nl.need, budget: nl.budget })) setNl({ name: '', phone: '', need: '', budget: '' }) }} style={goldBtn}>افزودن</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('لیدها')}
              {leads.length ? leads.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{l.name}{l.phone ? <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> · {l.phone}</span> : ''}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{l.need} {l.budget ? `· ${l.budget}` : ''}</div>
                  </div>
                  <select value={l.assignedTo || ''} onChange={e => post({ action: 'assignLead', id: l.id, agent: e.target.value })} style={{ ...actionBtn, cursor: 'pointer' }}><option value="">تخصیص به…</option>{activeAgentNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
                  <select value={l.stage} onChange={e => post({ action: 'setLeadStage', id: l.id, stage: e.target.value })} style={{ ...actionBtn, cursor: 'pointer', color: STAGE_COLOR[l.stage], borderColor: STAGE_COLOR[l.stage] }}>{STAGES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{STAGE_LABEL[s]}</option>)}</select>
                  <button onClick={() => post({ action: 'deleteLead', id: l.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>لیدی نداری.</div>}
            </div>
          </div>}

          {/* DEALS */}
          {view === 'deals' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('ثبت معامله')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 180px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>عنوان معامله</label><input value={nd.title} onChange={e => setNd({ ...nd, title: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 150px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مبلغ (تومان)</label><NumberInput value={nd.amount} onChange={v => setNd({ ...nd, amount: v })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 130px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مشاور</label>{agentSelect(nd.agent, v => setNd({ ...nd, agent: v }))}</div>
                <div style={{ flex: '1 1 150px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>تاریخ</label><JalaliDatePicker value={nd.date} onChange={d => setNd({ ...nd, date: d })} /></div>
                <button disabled={busy || !nd.title.trim() || !nd.agent} onClick={async () => { if (await post({ action: 'addDeal', title: nd.title.trim(), amount: Number(nd.amount) || 0, agent: nd.agent, date: nd.date })) setNd({ title: '', amount: '', agent: '', date: '' }) }} style={goldBtn}>ثبت</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('معاملات')}
              {deals.length ? deals.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{d.title}</div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{d.agent} · {d.date || faDate(d.createdAt)}</div></div>
                  <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 14 }}>{money(d.amount)}</div>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>معامله‌ای نداری.</div>}
            </div>
          </div>}

          {/* SETTINGS */}
          {view === 'settings' && <div style={{ ...card, padding: 18, maxWidth: 480 }}>
            {sectionTitle('تنظیمات آژانس')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام آژانس</label><input value={prof.name} onChange={e => setProf({ ...prof, name: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>شعب</label><input value={prof.branches} onChange={e => setProf({ ...prof, branches: e.target.value })} style={inputStyle} /></div>
              <button disabled={busy} onClick={() => post({ action: 'updateProfile', patch: { name: prof.name, branches: prof.branches } })} style={{ ...goldBtn, alignSelf: 'flex-start', padding: '9px 22px' }}>ذخیره</button>
            </div>
          </div>}
          </>}
        </main>
      </div>
      {dupWarn && (
        <div onClick={() => setDupWarn('')} style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 200, maxWidth: 540, background: 'linear-gradient(135deg,#3a2a12,#2a1f0e)', border: '1px solid #f59e0b', color: '#fde68a', padding: '13px 18px', borderRadius: 12, fontSize: 13, lineHeight: 1.9, cursor: 'pointer', boxShadow: '0 8px 30px rgba(0,0,0,.5)', fontFamily: FONT }}>
          {dupWarn} <span style={{ color: '#f59e0b', fontWeight: 700 }}>(بستن)</span>
        </div>
      )}
    </div>
  )
}
