'use client'
import { useState, useEffect, useCallback } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'
import MessagesPanel from '@/app/components/MessagesPanel'
import NegotiationEngine from '@/app/components/NegotiationEngine'
import DivarImport from '@/app/components/DivarImport'
import JalaliDatePicker from '@/app/components/JalaliDatePicker'
import NumberInput from '@/app/components/NumberInput'
import ImageUpload from '@/app/components/ImageUpload'
import { PROVINCES, citiesOf, neighborhoodsOf } from '@/app/lib/taxonomy'
import CrmTool, { CRM_VIEWS, type CrmView } from '@/app/components/tools/CrmTool'
import MarketingTool, { MARKETING_VIEWS, type MarketingView } from '@/app/components/tools/MarketingTool'
import WorkflowTool, { WORKFLOW_VIEWS, type WorkflowView } from '@/app/components/tools/WorkflowTool'
import WebsiteBuilderTool, { WEBSITE_VIEWS, type WebsiteView } from '@/app/components/tools/WebsiteBuilderTool'
import ArticleEditor from '@/app/components/ArticleEditor'
import PlansPanel from '@/app/components/PlansPanel'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'
import SupportPanel from '@/app/components/SupportPanel'

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
type CommMode = 'percent' | 'amount'
interface MonthPoint { key: string; label: string; amount: number; deals: number }
interface AdvisorFileItem { id: string; title: string; location: string; price: number; deal: 'sale' | 'rent'; status: 'active' | 'sold' | 'rented'; ptype: string; createdAt: number }
interface AdvisorLeadInfo { total: number; open: number; recent: { name: string; need: string; stage: string }[] }
interface AdvisorLeadItem { name: string; need: string; budget: string; phone: string; stage: string; createdAt: number }
interface AdvisorCommItem { dealTitle: string; amount: number; status: string; date: string; createdAt: number }
interface AdvisorApptItem { client: string; listingTitle: string; date: string; type: string; status: string; createdAt: number }
interface AdvisorRow { advisorPhone: string; advisorName: string; photo: string; listings: AdvisorFileItem[]; counts: { total: number; active: number; sold: number; rented: number }; leads: AdvisorLeadInfo; leadsList: AdvisorLeadItem[]; commissions: AdvisorCommItem[]; appts: AdvisorApptItem[]; advisorCommission: number; paidCommission: number; pendingCommission: number; closedCount: number; dealCount: number; monthly: MonthPoint[]; rate: { mode: CommMode; value: number; isDefault: boolean }; agencyCut: number }
interface AdvisorFiles { rows: AdvisorRow[]; totals: { listings: number; active: number; sold: number; rented: number; leads: number; advisorCommission: number; agencyCut: number }; income: MonthPoint[] }
interface CommissionCfg { defaultMode: CommMode; defaultValue: number; perAgent: Record<string, { mode: CommMode; value: number }> }
interface AgencyData { stats: Stats; agents: Agent[]; listings: Listing[]; leads: Lead[]; deals: Deal[]; advisorFiles?: AdvisorFiles; commission?: CommissionCfg }

// عضویت واقعی مشاور↔آژانس (mirror app/lib/agency-link-store.ts)
interface LinkMember { advisorPhone: string; advisorName: string; agencyPhone: string; agencyName: string; since: number }
interface LinkRequest { id: string; advisorPhone: string; advisorName: string; agencyPhone: string; agencyName: string; initiator: 'advisor' | 'agency'; status: string; createdAt: number }

type View = 'dashboard' | 'assistant' | 'messages' | 'negotiation' | 'divar' | 'articles' | 'agents' | 'advisorfiles' | 'listings' | 'leads' | 'pipeline' | 'deals' | 'appts' | 'calendar' | 'plans' | 'profile' | 'settings' | 'support'

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
const PTYPE_OPTIONS = ['آپارتمان', 'ویلا', 'زمین', 'مغازه', 'دفتر کار', 'کلنگی', 'سایر']
const FACING_OPTIONS = ['شمالی', 'جنوبی', 'شرقی', 'غربی', 'دونبش', 'سه‌نبش']
const AMENITIES: { key: 'parking' | 'elevator' | 'storage' | 'balcony' | 'furnished'; label: string }[] = [
  { key: 'parking', label: 'پارکینگ' }, { key: 'elevator', label: 'آسانسور' }, { key: 'storage', label: 'انباری' }, { key: 'balcony', label: 'بالکن' }, { key: 'furnished', label: 'مبله' },
]
const emptyFileForm = { title: '', ptype: 'آپارتمان', deal: 'sale' as 'sale' | 'rent', province: '', city: '', district: '', neighborhood: '', address: '', price: '', rentMonthly: '', area: '', rooms: '', floor: '', totalFloors: '', yearBuilt: '', facing: '', docType: '', phone: '', description: '', parking: false, elevator: false, storage: false, balcony: false, furnished: false, images: [] as string[] }

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inputStyle: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%' }
const actionBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap' }
const goldBtn: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }

const VIEW_TITLES: Record<View, string> = { dashboard: 'داشبورد آژانس', assistant: 'دستیار هوشمند', messages: 'پیام‌ها', negotiation: 'موتور مذاکره', divar: 'ایمپورت از دیوار', articles: 'مقالات و وبلاگ', agents: 'مشاوران', advisorfiles: 'گزارشِ آژانس و مشاوران', listings: 'فایل‌ها (آژانس و مشاوران)', leads: 'لیدها (آژانس و مشاوران)', pipeline: 'پایپ‌لاینِ کلی', deals: 'معاملات (آژانس و مشاوران)', appts: 'وظایف و قرارها', calendar: 'تقویمِ همه', plans: 'پلن‌ها و اشتراک', profile: 'پروفایل', settings: 'تنظیمات', support: 'پشتیبانی' }
const NAV_ITEMS: { id: View; label: string; icon: string; badge?: 'agents' | 'leads' }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '▦' },
  { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
  { id: 'messages', label: 'پیام‌ها', icon: '💬' },
  { id: 'negotiation', label: 'موتور مذاکره', icon: '🤝' },
  { id: 'divar', label: 'ایمپورت از دیوار', icon: '📥' },
  { id: 'agents', label: 'مشاوران', icon: '☷', badge: 'agents' },
  { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
  { id: 'profile', label: 'پروفایل', icon: '🪪' },
  { id: 'settings', label: 'تنظیمات', icon: '⛭' },
  { id: 'support', label: 'پشتیبانی', icon: '🛟' },
]
// زیرمنوهای «CRM و مشتریان» — لید/فایل/معاملات/کمیسیون همگی این‌جا (نه بیرونِ CRM).
const AGENCY_CRM_VIEWS: { id: View; label: string; icon: string }[] = [
  { id: 'listings', label: 'فایل‌ها', icon: '◫' },
  { id: 'leads', label: 'لیدها', icon: '◎' },
  { id: 'pipeline', label: 'پایپ‌لاین', icon: '☰' },
  { id: 'deals', label: 'معاملات', icon: '﷼' },
  { id: 'appts', label: 'وظایف و قرارها', icon: '✓' },
  { id: 'calendar', label: 'تقویم', icon: '📅' },
  { id: 'advisorfiles', label: 'گزارش و کمیسیون', icon: '🗂' },
]
const AGENCY_CRM_IDS: View[] = ['listings', 'leads', 'pipeline', 'deals', 'appts', 'calendar', 'advisorfiles']
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
// نمودارِ میله‌ایِ درآمدِ ماهانه (سهمِ آژانس از کمیسیون)
function IncomeBars({ points, height = 96 }: { points: MonthPoint[]; height?: number }) {
  const max = Math.max(1, ...points.map(p => p.amount))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height }}>
      {points.map(p => {
        const h = Math.max(3, Math.round((p.amount / max) * (height - 34)))
        return (
          <div key={p.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 9.5, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 700 }}>{p.amount ? money(p.amount) : ''}</div>
            <div title={`${p.label}: ${money(p.amount)} · ${fa(p.deals)} معامله`} style={{ width: '100%', maxWidth: 38, height: h, background: p.amount ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : 'var(--line)', borderRadius: 6 }} />
            <div style={{ fontSize: 9.5, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{p.label}</div>
          </div>
        )
      })}
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
  const [navOpen, setNavOpen] = useState(false)   // کشوی منوی موبایل
  const clearTools = () => { setCrmView(null); setMktView(null); setWfView(null); setWbView(null) }
  const goView = (v: View) => { setView(v); clearTools(); if (AGENCY_CRM_IDS.includes(v)) setCrmOpen(true); setNavOpen(false) }
  const openCrm = (v: CrmView) => { clearTools(); setCrmView(v); setCrmOpen(true); setNavOpen(false) }
  const openMkt = (v: MarketingView) => { clearTools(); setMktView(v); setMktOpen(true); setNavOpen(false) }
  const openWf = (v: WorkflowView) => { clearTools(); setWfView(v); setWfOpen(true); setNavOpen(false) }
  const openWb = (v: WebsiteView) => { clearTools(); setWbView(v); setWbOpen(true); setNavOpen(false) }
  const [data, setData] = useState<AgencyData | null>(null)
  const [myName, setMyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [unauth, setUnauth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [search, setSearch] = useState('')
  const [ng, setNg] = useState({ name: '', phone: '' })
  // فرمِ کاملِ افزودنِ فایل (مثلِ پنل مشاور)
  const [fileModal, setFileModal] = useState(false)
  const [ff, setFf] = useState({ ...emptyFileForm })
  const [nl, setNl] = useState({ name: '', phone: '', need: '', budget: '' })
  const [nd, setNd] = useState({ title: '', amount: '', agent: '', date: '' })
  const [prof, setProf] = useState({ name: '', branches: '' })
  // ویرایشِ نرخِ کمیسیون (پیش‌فرض + per-advisor)
  const [defComm, setDefComm] = useState<{ mode: CommMode; value: string }>({ mode: 'percent', value: '30' })
  const [commEdit, setCommEdit] = useState<Record<string, { mode: CommMode; value: string }>>({})
  // فیلتر و مرتب‌سازیِ «فایل‌های مشاوران»
  const [afQuery, setAfQuery] = useState('')
  const [afSort, setAfSort] = useState<'cut' | 'name' | 'files' | 'leads' | 'commission'>('cut')
  // فیلتر و مرتب‌سازیِ «فایل‌ها/لیدها/معاملات» (یکجا، آژانس + مشاوران)
  const [lstStatus, setLstStatus] = useState<'all' | 'active' | 'sold' | 'rented'>('all')
  const [lstSort, setLstSort] = useState<'new' | 'priceDesc' | 'priceAsc'>('new')
  const [ownerF, setOwnerF] = useState<string>('all')   // 'all' | 'agency' | advisorPhone
  const [leadStageF, setLeadStageF] = useState<string>('all')
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
  // مقادیرِ نرخِ پیش‌فرض را با دادهٔ سرور هم‌گام کن
  useEffect(() => { const c = data?.commission; if (c) setDefComm({ mode: c.defaultMode, value: String(c.defaultValue) }) }, [data?.commission?.defaultMode, data?.commission?.defaultValue])
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

  const submitFile = async () => {
    if (busy || !ff.title.trim()) return
    const ok = await post({
      action: 'addListing', title: ff.title.trim(), ptype: ff.ptype, deal: ff.deal,
      province: ff.province, city: ff.city, district: ff.district, neighborhood: ff.neighborhood, address: ff.address,
      price: Number(ff.price) || 0, rentMonthly: ff.rentMonthly, area: ff.area, rooms: ff.rooms, floor: ff.floor, totalFloors: ff.totalFloors, yearBuilt: ff.yearBuilt,
      facing: ff.facing, docType: ff.docType, phone: ff.phone, description: ff.description,
      parking: ff.parking, elevator: ff.elevator, storage: ff.storage, balcony: ff.balcony, furnished: ff.furnished,
      images: ff.images.filter(Boolean),
    })
    if (ok) { setFileModal(false); setFf({ ...emptyFileForm }) }
  }

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
  const af = data.advisorFiles
  const agencyName = stats.profile.name || 'آژانس'
  const advisorOpts = (af?.rows || []).map(r => ({ phone: r.advisorPhone, name: r.advisorName }))
  const ownerOk = (key: string) => ownerF === 'all' || ownerF === key

  // ── فایل‌ها (یکجا): آگهیِ آژانس + همهٔ مشاوران، با ستونِ «منتسب» ──
  type UListing = { key: string; id: string; title: string; ptype: string; location: string; price: number; deal: 'sale' | 'rent'; status: 'active' | 'sold' | 'rented'; owner: string; ownerKey: string; agency: boolean; createdAt: number }
  const listingsUnified: UListing[] = [
    ...listings.map(l => ({ key: 'a_' + l.id, id: l.id, title: l.title, ptype: l.ptype, location: l.location, price: l.price, deal: l.deal, status: l.status, owner: agencyName, ownerKey: 'agency', agency: true, createdAt: l.createdAt })),
    ...(af?.rows || []).flatMap(r => r.listings.map(l => ({ key: 'm_' + r.advisorPhone + '_' + l.id, id: l.id, title: l.title, ptype: l.ptype, location: l.location, price: l.price, deal: l.deal, status: l.status, owner: r.advisorName, ownerKey: r.advisorPhone, agency: false, createdAt: l.createdAt }))),
  ]
  const listingsF = listingsUnified
    .filter(l => !q || (l.title + l.location + l.owner).includes(q))
    .filter(l => lstStatus === 'all' || l.status === lstStatus)
    .filter(l => ownerOk(l.ownerKey))
    .sort((a, b) => lstSort === 'priceDesc' ? b.price - a.price : lstSort === 'priceAsc' ? a.price - b.price : b.createdAt - a.createdAt)

  // ── لیدها (یکجا): لیدِ آژانس + همهٔ مشاوران ──
  type ULead = { key: string; id: string; name: string; need: string; budget: string; phone: string; stage: string; owner: string; ownerKey: string; agency: boolean; assignedTo?: string; createdAt: number }
  const leadsUnified: ULead[] = [
    ...leads.map(l => ({ key: 'a_' + l.id, id: l.id, name: l.name, need: l.need || '', budget: l.budget || '', phone: l.phone || '', stage: l.stage as string, owner: agencyName, ownerKey: 'agency', agency: true, assignedTo: l.assignedTo, createdAt: l.createdAt })),
    ...(af?.rows || []).flatMap(r => r.leadsList.map((l, i) => ({ key: 'm_' + r.advisorPhone + '_' + i, id: '', name: l.name, need: l.need, budget: l.budget, phone: l.phone, stage: l.stage, owner: r.advisorName, ownerKey: r.advisorPhone, agency: false, createdAt: l.createdAt }))),
  ]
  const leadsF = leadsUnified
    .filter(l => !q || (l.name + l.need + l.owner + (l.phone || '')).includes(q))
    .filter(l => leadStageF === 'all' || l.stage === leadStageF)
    .filter(l => ownerOk(l.ownerKey))
    .sort((a, b) => b.createdAt - a.createdAt)

  // ── معاملات (یکجا): معاملاتِ آژانس + کمیسیون‌های مشاوران (به‌عنوان معامله) ──
  type UDeal = { key: string; id: string; title: string; amount: number; who: string; date: string; status: string; owner: string; ownerKey: string; agency: boolean; createdAt: number }
  const dealsUnified: UDeal[] = [
    ...deals.map(d => ({ key: 'a_' + d.id, id: d.id, title: d.title, amount: d.amount, who: d.agent || '', date: d.date, status: '', owner: agencyName, ownerKey: 'agency', agency: true, createdAt: d.createdAt })),
    ...(af?.rows || []).flatMap(r => r.commissions.map((c, i) => ({ key: 'm_' + r.advisorPhone + '_' + i, id: '', title: c.dealTitle, amount: c.amount, who: r.advisorName, date: c.date, status: c.status, owner: r.advisorName, ownerKey: r.advisorPhone, agency: false, createdAt: c.createdAt }))),
  ]
  const dealsF = dealsUnified.filter(d => !q || (d.title + d.owner).includes(q)).filter(d => ownerOk(d.ownerKey)).sort((a, b) => b.createdAt - a.createdAt)

  // ── وظایف/قرارهای همهٔ مشاوران ──
  type UAppt = { key: string; client: string; listingTitle: string; date: string; type: string; status: string; owner: string; ownerKey: string; createdAt: number }
  const apptsUnified: UAppt[] = (af?.rows || []).flatMap(r => r.appts.map((x, i) => ({ key: 'ap_' + r.advisorPhone + '_' + i, client: x.client, listingTitle: x.listingTitle, date: x.date, type: x.type, status: x.status, owner: r.advisorName, ownerKey: r.advisorPhone, createdAt: x.createdAt })))
  const apptsF = apptsUnified.filter(a => !q || (a.client + a.owner + a.listingTitle).includes(q)).filter(a => ownerOk(a.ownerKey)).sort((a, b) => b.createdAt - a.createdAt)

  // نوارِ فیلترِ «منتسب» (مشترک بینِ بخش‌ها)
  const ownerFilterBar = (
    <select value={ownerF} onChange={e => setOwnerF(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}>
      <option value="all">منتسب: همه</option>
      <option value="agency">آژانس</option>
      {advisorOpts.map(a => <option key={a.phone} value={a.phone}>{a.name}</option>)}
    </select>
  )
  const ownerBadge = (agency: boolean, owner: string) => <span style={{ fontSize: 10.5, fontWeight: 700, color: agency ? 'var(--gold)' : '#60a5fa', background: agency ? 'var(--goldDim)' : 'rgba(96,165,250,.14)', border: `1px solid ${agency ? 'var(--gold)' : '#60a5fa55'}`, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>{agency ? '🏢 ' : '👤 '}{owner}</span>

  const activeAgentNames = agents.filter(a => a.active).map(a => a.name)
  const maxSales = Math.max(1, ...stats.monthlySales.map(m => m.amount))
  const sectionTitle = (t: string) => <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>{t}</div>
  const agentSelect = (val: string, on: (v: string) => void) => (
    <select value={val} onChange={e => on(e.target.value)} style={inputStyle}><option value="">— مشاور —</option>{activeAgentNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
  )

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <style>{`
        .mjg-burger{display:none}
        .mjg-overlay{display:none}
        @media(max-width:760px){
          .mjg-cols{flex-direction:column!important}
          .mjg-side{position:fixed!important;right:0;top:0;height:100vh!important;width:82vw!important;max-width:300px;z-index:130;transform:translateX(105%);transition:transform .26s ease;box-shadow:-12px 0 40px -12px rgba(0,0,0,.6)}
          .mjg-side.mjg-open{transform:translateX(0)}
          .mjg-burger{display:inline-flex!important}
          .mjg-overlay.mjg-open{display:block}
        }
      `}</style>

      {/* OVERLAY موبایل (پشتِ کشو) */}
      <div className={`mjg-overlay${navOpen ? ' mjg-open' : ''}`} onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 125 }} />

      {/* SIDEBAR */}
      <aside className={`mjg-side${navOpen ? ' mjg-open' : ''}`} style={{ width: 232, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--line)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

          {/* CRM و مشتریان — لید/فایل/معاملات/کمیسیون + ابزارِ CRM، همگی این‌جا */}
          {(() => {
            const crmGroupActive = !!crmView || AGENCY_CRM_IDS.includes(view)
            return <>
              <button onClick={() => setCrmOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: crmGroupActive ? 'var(--goldDim)' : 'transparent', color: crmGroupActive ? 'var(--gold)' : 'var(--muted)', fontWeight: crmGroupActive ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: crmGroupActive ? 1 : 0.7 }}>◇</span>
                <span className="mjg-sidelabel" style={{ flex: 1 }}>CRM و مشتریان</span>
                <span className="mjg-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: crmOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
              </button>
              {crmOpen && <>
                {/* داده‌های آژانس و مشاوران */}
                {AGENCY_CRM_VIEWS.map(cv => {
                  const on = view === cv.id && !crmView
                  return (
                    <button key={cv.id} onClick={() => goView(cv.id)} className="mjg-sidelabel" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                      <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{cv.icon}</span>
                      <span style={{ flex: 1 }}>{cv.label}</span>
                    </button>
                  )
                })}
              </>}
            </>
          })()}

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
          <button onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {} ; try { localStorage.removeItem('mj_token') } catch {} ; window.location.href = '/' }} title="خروج از حساب" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)', color: '#e7674a', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⎋</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--navbg)', backdropFilter: 'blur(18px)', zIndex: 20, flexWrap: 'wrap' }}>
          <button className="mjg-burger" aria-label="منو" onClick={() => setNavOpen(true)} style={{ width: 42, height: 42, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--gold)', fontSize: 20, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: FONT }}>☰</button>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{crmView ? `CRM · ${CRM_VIEWS.find(v => v.id === crmView)?.label || ''}` : mktView ? `مارکتینگ · ${MARKETING_VIEWS.find(v => v.id === mktView)?.label || ''}` : wfView ? `اتوماسیون · ${WORKFLOW_VIEWS.find(v => v.id === wfView)?.label || ''}` : wbView ? `وب‌سایت‌ساز · ${WEBSITE_VIEWS.find(v => v.id === wbView)?.label || ''}` : VIEW_TITLES[view]}</div>
          <div style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی فایل، مشاور…" style={{ ...inputStyle, width: 220, maxWidth: '40vw' }} />
          <button onClick={() => setView('agents')} style={{ ...goldBtn, padding: '9px 16px' }}>+ مشاور</button>
        </header>

        <main style={{ padding: 22, flex: 1, overflowY: 'auto' }}>
          {crmView ? <CrmTool embedded view={crmView} onView={v => setCrmView(v)} />
            : mktView === 'articles' ? <ArticleEditor compact author={myName || undefined} />
            : mktView ? <MarketingTool embedded view={mktView} onView={v => setMktView(v)} />
            : wfView ? <div style={{ height: 'calc(100vh - 130px)' }}><WorkflowTool embedded view={wfView} onView={v => setWfView(v)} /></div>
            : wbView ? <div style={{ height: 'calc(100vh - 130px)' }}><WebsiteBuilderTool embedded profile="آژانس" view={wbView} onView={v => setWbView(v)} /></div>
            : <>
          {/* DASHBOARD */}
          {view === 'dashboard' && <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Kpi label="مشاوران فعال" value={fa(stats.kpis.activeAgents)} sub={`${fa(stats.kpis.totalAgents)} کل`} />
              <Kpi label="فایل‌های فعال" value={fa(stats.kpis.activeListings)} />
              <Kpi label="لیدهای باز" value={fa(stats.kpis.openLeads)} />
              <Kpi label="معاملات این ماه" value={fa(stats.kpis.dealsThisMonth)} />
              <Kpi label="فروش این ماه" value={money(stats.kpis.monthSales)} subColor={stats.kpis.monthChange >= 0 ? '#34d399' : '#ef4444'} sub={`${stats.kpis.monthChange >= 0 ? '+' : ''}${fa(stats.kpis.monthChange)}٪`} />
              <Kpi label="درآمد از کمیسیونِ مشاوران" value={money(data.advisorFiles?.totals.agencyCut || 0)} sub="سهمِ تجمیعیِ آژانس" subColor="var(--gold)" />
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
            {/* درآمدِ آژانس از کمیسیونِ مشاوران — قابلِ رویت در داشبورد + لینکِ گزارشِ کامل */}
            {data.advisorFiles && data.advisorFiles.income.length > 0 && (
              <div style={{ ...card, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {sectionTitle('درآمدِ آژانس از کمیسیونِ مشاوران (۶ ماه)')}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{money(data.advisorFiles.income.reduce((s, p) => s + p.amount, 0))}</span>
                    <button onClick={() => goView('advisorfiles')} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>گزارشِ کامل ←</button>
                  </div>
                </div>
                <IncomeBars points={data.advisorFiles.income} height={130} />
              </div>
            )}
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
          {view === 'negotiation' && <NegotiationEngine listings={listingsUnified.map(l => ({ id: l.key, title: `${l.title}${l.agency ? '' : ' — ' + l.owner}`, price: l.price, deal: l.deal, location: l.location }))} />}

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

          {/* ADVISOR FILES — فایل‌ها و کمیسیونِ مشاوران (از پنلِ خودِ مشاوران) */}
          {view === 'advisorfiles' && (() => {
            const af = data.advisorFiles
            const allRows = af?.rows || []
            const aq = afQuery.trim()
            const rows = allRows
              .filter(r => !aq || r.advisorName.includes(aq) || r.advisorPhone.includes(aq))
              .sort((a, b) => afSort === 'name' ? a.advisorName.localeCompare(b.advisorName, 'fa')
                : afSort === 'files' ? b.counts.total - a.counts.total
                : afSort === 'leads' ? b.leads.total - a.leads.total
                : afSort === 'commission' ? b.advisorCommission - a.advisorCommission
                : b.agencyCut - a.agencyCut)
            const t = af?.totals
            const badge = (label: string, color?: string) => <span style={{ fontSize: 11, fontWeight: 700, color: color || 'var(--muted)', background: color ? color + '1f' : 'var(--bg)', border: `1px solid ${color ? color + '55' : 'var(--line)'}`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{label}</span>
            const exportCsv = () => {
              const head = ['مشاور', 'شماره', 'لیدها', 'لید باز', 'کل فایل', 'فعال', 'فروخته', 'اجاره‌رفته', 'کمیسیون محقق‌شده (تومان)', 'پرداختی', 'معوق', 'نرخ آژانس', 'سهم آژانس (تومان)']
              const q = (v: any) => `"${String(v).replace(/"/g, '""')}"`
              const lines = [head.map(q).join(',')]
              for (const r of allRows) {
                const rate = r.rate.mode === 'percent' ? `${r.rate.value}٪` : `${r.rate.value} هر معامله`
                lines.push([r.advisorName, r.advisorPhone, r.leads.total, r.leads.open, r.counts.total, r.counts.active, r.counts.sold, r.counts.rented, r.advisorCommission, r.paidCommission, r.pendingCommission, rate, r.agencyCut].map(q).join(','))
              }
              if (t) lines.push(['جمع', '', t.leads, '', t.listings, t.active, t.sold, t.rented, t.advisorCommission, '', '', '', t.agencyCut].map(q).join(','))
              const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `agency-commission-report.csv`; a.click(); URL.revokeObjectURL(url)
            }
            return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9, flex: 1, minWidth: 200 }}>این بخش فایل‌ها و کمیسیونِ مشاورانِ عضوِ آژانس را مستقیماً از پنلِ خودِ مشاوران نمایش می‌دهد و به‌روز است.</div>
                {allRows.length > 0 && <button onClick={exportCsv} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)', padding: '8px 14px' }}>⬇ خروجیِ گزارش (CSV)</button>}
              </div>
              {allRows.length > 0 && (
                <div style={{ ...card, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input value={afQuery} onChange={e => setAfQuery(e.target.value)} placeholder="جستجوی مشاور (نام یا شماره)…" style={{ ...inputStyle, flex: '1 1 200px', width: 'auto' }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>مرتب‌سازی:</span>
                  <select value={afSort} onChange={e => setAfSort(e.target.value as any)} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="cut">سهمِ آژانس</option>
                    <option value="commission">کمیسیونِ مشاور</option>
                    <option value="files">تعدادِ فایل</option>
                    <option value="leads">تعدادِ لید</option>
                    <option value="name">نام</option>
                  </select>
                  <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{fa(rows.length)} از {fa(allRows.length)} مشاور</span>
                </div>
              )}
              <div className="mjg-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                <Kpi label="کلِ فایل‌ها" value={fa(t?.listings || 0)} />
                <Kpi label="فعال" value={fa(t?.active || 0)} />
                <Kpi label="لیدهای مشاوران" value={fa(t?.leads || 0)} />
                <Kpi label="کمیسیونِ محقق‌شده" value={money(t?.advisorCommission || 0)} />
                <Kpi label="سهمِ آژانس" value={money(t?.agencyCut || 0)} />
              </div>

              <div style={{ ...card, padding: 18 }}>
                {sectionTitle('سهمِ پیش‌فرضِ آژانس از مشاوران')}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع</label><select value={defComm.mode} onChange={e => setDefComm({ ...defComm, mode: e.target.value as CommMode })} style={inputStyle}><option value="percent">درصدی از کمیسیونِ مشاور</option><option value="amount">مبلغِ ثابت به‌ازای هر معامله</option></select></div>
                  <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>{defComm.mode === 'percent' ? 'درصد (٪)' : 'مبلغ (تومان)'}</label><input value={defComm.value} onChange={e => setDefComm({ ...defComm, value: e.target.value.replace(/[^0-9]/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} /></div>
                  <button disabled={busy} onClick={() => post({ action: 'setDefaultCommission', mode: defComm.mode, value: Number(defComm.value) || 0 })} style={goldBtn}>ذخیره</button>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>این نرخ برای مشاورانی که نرخِ اختصاصی ندارند اعمال می‌شود.</div>
              </div>

              {/* نمودارِ درآمدِ آژانس از کمیسیونِ مشاوران (۶ ماهِ اخیر) */}
              {af?.income && af.income.length > 0 && (
                <div style={{ ...card, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
                    {sectionTitle('درآمدِ آژانس از کمیسیونِ مشاوران (۶ ماهِ اخیر)')}
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>{money(af.income.reduce((s, p) => s + p.amount, 0))}</span>
                  </div>
                  <IncomeBars points={af.income} />
                </div>
              )}

              {rows.length === 0 ? (
                <div style={{ ...card, padding: 24, color: 'var(--faint)', textAlign: 'center', fontSize: 13.5 }}>{allRows.length === 0 ? 'هنوز مشاوری به آژانس متصل نیست. از بخشِ «مشاوران» مشاور دعوت کنید.' : 'مشاوری با این فیلتر یافت نشد.'}</div>
              ) : rows.map(r => {
                const edit = commEdit[r.advisorPhone] || { mode: r.rate.mode, value: String(r.rate.value) }
                const setEdit = (e: { mode: CommMode; value: string }) => setCommEdit(prev => ({ ...prev, [r.advisorPhone]: e }))
                return (
                  <div key={r.advisorPhone} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    {/* هدرِ مشاور */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                      {r.photo
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={r.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{(r.advisorName || '?').trim().charAt(0)}</span>}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{r.advisorName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--gold)', direction: 'ltr', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace' }}>{r.advisorPhone}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
                        {badge(`${fa(r.leads.total)} لید`, '#60a5fa')}
                        {badge(`فایل ${fa(r.counts.total)}`)}
                        {badge(`فعال ${fa(r.counts.active)}`, LIST_COLOR.active)}
                        {badge(`فروخته ${fa(r.counts.sold)}`, LIST_COLOR.sold)}
                        {badge(`اجاره ${fa(r.counts.rented)}`, LIST_COLOR.rented)}
                      </div>
                    </div>

                    {/* کمیسیون */}
                    <div style={{ display: 'flex', gap: 18, padding: '12px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg)' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>کمیسیونِ مشاور</div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{money(r.advisorCommission)}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>پرداختی {money(r.paidCommission)} · معوق {money(r.pendingCommission)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>سهمِ آژانس {r.rate.isDefault ? '(پیش‌فرض)' : ''}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--gold)' }}>{money(r.agencyCut)}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{r.rate.mode === 'percent' ? `${fa(r.rate.value)}٪ از کمیسیون` : `${money(r.rate.value)} × ${fa(r.dealCount)} معامله`}</div>
                      </div>
                      <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div><label style={{ fontSize: 10.5, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>نرخِ این مشاور</label><select value={edit.mode} onChange={e => setEdit({ ...edit, mode: e.target.value as CommMode })} style={{ ...inputStyle, width: 'auto', padding: '6px 9px', fontSize: 12 }}><option value="percent">درصدی</option><option value="amount">مبلغی</option></select></div>
                        <input value={edit.value} onChange={e => setEdit({ ...edit, value: e.target.value.replace(/[^0-9]/g, '') })} style={{ ...inputStyle, width: 90, direction: 'ltr', textAlign: 'right', padding: '6px 9px', fontSize: 12 }} />
                        <button disabled={busy} onClick={() => post({ action: 'setAgentCommission', advisorPhone: r.advisorPhone, mode: edit.mode, value: Number(edit.value) || 0 })} style={{ ...goldBtn, padding: '7px 14px', fontSize: 12 }}>ذخیره</button>
                        {!r.rate.isDefault && <button disabled={busy} onClick={() => { setCommEdit(prev => { const n = { ...prev }; delete n[r.advisorPhone]; return n }); post({ action: 'clearAgentCommission', advisorPhone: r.advisorPhone }) }} style={actionBtn}>پیش‌فرض</button>}
                      </div>
                    </div>

                    {/* خلاصهٔ فایل/لید (جزئیات در بخشِ «فایل‌ها» و «لیدها») + نمودارِ درآمد */}
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: r.monthly.some(p => p.amount > 0) ? 10 : 0, lineHeight: 1.9 }}>{fa(r.counts.total)} فایل ({fa(r.counts.active)} فعال) · {fa(r.leads.total)} لید · جزئیاتِ کامل در بخش‌های «فایل‌ها» و «لیدها».</div>
                      {r.monthly.some(p => p.amount > 0) && (<>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>درآمدِ آژانس از این مشاور (۶ ماهِ اخیر)</div>
                        <IncomeBars points={r.monthly} height={84} />
                      </>)}
                    </div>
                  </div>
                )
              })}
            </div>
          })()}

          {/* LISTINGS */}
          {view === 'listings' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>افزودنِ فایلِ جدید</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>فرمِ کامل با مشخصات، موقعیت، امکانات و تصاویر — مثلِ پنل مشاور.</div>
              </div>
              <button onClick={() => { setFf({ ...emptyFileForm }); setFileModal(true) }} style={goldBtn}>＋ افزودن فایل</button>
            </div>
            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {sectionTitle(`فایل‌ها (${fa(listingsF.length)})`)}
                <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
                  {ownerFilterBar}
                  <select value={lstStatus} onChange={e => setLstStatus(e.target.value as any)} style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}><option value="all">همهٔ وضعیت‌ها</option><option value="active">فعال</option><option value="sold">فروخته‌شده</option><option value="rented">اجاره‌رفته</option></select>
                  <select value={lstSort} onChange={e => setLstSort(e.target.value as any)} style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}><option value="new">جدیدترین</option><option value="priceDesc">گران‌ترین</option><option value="priceAsc">ارزان‌ترین</option></select>
                </div>
              </div>
              {listingsF.length ? listingsF.map(l => (
                <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{l.title} <Pill label={DEAL_LABEL[l.deal]} color={l.deal === 'sale' ? '#60a5fa' : '#2dd4bf'} /> {ownerBadge(l.agency, l.owner)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{l.ptype} · {l.location} · {money(l.price)}</div>
                  </div>
                  {l.agency ? <>
                    <select value={l.status} onChange={e => post({ action: 'setListingStatus', id: l.id, status: e.target.value })} style={{ ...actionBtn, cursor: 'pointer', color: LIST_COLOR[l.status], borderColor: LIST_COLOR[l.status] }}>{LIST_STATUSES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{LIST_LABEL[s]}</option>)}</select>
                    <button onClick={() => post({ action: 'deleteListing', id: l.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                  </> : <Pill label={LIST_LABEL[l.status]} color={LIST_COLOR[l.status]} />}
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>فایلی با این فیلتر نیست.</div>}
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
                <div style={{ flex: '1 1 130px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>بودجه (تومان)</label><NumberInput value={nl.budget} onChange={v => setNl({ ...nl, budget: v })} style={inputStyle} /></div>
                <button disabled={busy || !nl.name.trim()} onClick={async () => { if (await post({ action: 'addLead', name: nl.name.trim(), phone: nl.phone, need: nl.need, budget: nl.budget })) setNl({ name: '', phone: '', need: '', budget: '' }) }} style={goldBtn}>افزودن</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {sectionTitle(`لیدها (${fa(leadsF.length)})`)}
                <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
                  {ownerFilterBar}
                  <select value={leadStageF} onChange={e => setLeadStageF(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}><option value="all">همهٔ مراحل</option>{STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
                </div>
              </div>
              {leadsF.length ? leadsF.map(l => (
                <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{l.name}{l.phone ? <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> · {l.phone}</span> : ''} {ownerBadge(l.agency, l.owner)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{l.need} {l.budget ? `· بودجه: ${money(Number((l.budget || '').replace(/[^0-9]/g, '')) || 0)}` : ''}</div>
                  </div>
                  {l.agency ? <>
                    <select value={l.assignedTo || ''} onChange={e => post({ action: 'assignLead', id: l.id, agent: e.target.value })} style={{ ...actionBtn, cursor: 'pointer' }}><option value="">تخصیص به…</option>{activeAgentNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
                    <select value={l.stage} onChange={e => post({ action: 'setLeadStage', id: l.id, stage: e.target.value })} style={{ ...actionBtn, cursor: 'pointer', color: STAGE_COLOR[l.stage as Stage], borderColor: STAGE_COLOR[l.stage as Stage] }}>{STAGES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{STAGE_LABEL[s]}</option>)}</select>
                    <button onClick={() => post({ action: 'deleteLead', id: l.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                  </> : <Pill label={STAGE_LABEL[l.stage as Stage] || l.stage} color={STAGE_COLOR[l.stage as Stage] || 'var(--muted)'} />}
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>لیدی با این فیلتر نیست.</div>}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {sectionTitle(`معاملات (${fa(dealsF.length)})`)}
                <div style={{ marginInlineStart: 'auto' }}>{ownerFilterBar}</div>
              </div>
              {dealsF.length ? dealsF.map(d => {
                const cl = d.status === 'paid' ? '#34d399' : d.status === 'canceled' ? '#ef4444' : d.status === 'pending' ? 'var(--gold)' : ''
                const cLabel = d.status === 'paid' ? 'محقق‌شده' : d.status === 'canceled' ? 'محقق نشد' : d.status === 'pending' ? 'در انتظار' : ''
                return (
                <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{d.title} {ownerBadge(d.agency, d.owner)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{d.who ? `${d.who} · ` : ''}{d.date || faDate(d.createdAt)}{cLabel ? ` · ${d.agency ? 'معاملهٔ آژانس' : 'کمیسیون'}` : ''}</div>
                  </div>
                  {cl && <Pill label={cLabel} color={cl} />}
                  <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 14 }}>{money(d.amount)}</div>
                </div>
                )
              }) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>معامله‌ای با این فیلتر نیست.</div>}
            </div>
          </div>}

          {/* PIPELINE — کلی (آژانس + همهٔ مشاوران) */}
          {view === 'pipeline' && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>پایپ‌لاینِ کلیِ لیدها — آژانس و همهٔ مشاوران یکجا.</div>
              <div style={{ marginInlineStart: 'auto' }}>{ownerFilterBar}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
              {STAGES.map(s => {
                const col = leadsUnified.filter(l => l.stage === s).filter(l => ownerOk(l.ownerKey))
                return (
                  <div key={s} style={{ flex: '0 0 230px', minWidth: 230, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingInlineStart: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: STAGE_COLOR[s] }}>{STAGE_LABEL[s]}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 999, padding: '2px 9px' }}>{fa(col.length)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
                      {col.length ? col.map(l => (
                        <div key={l.key} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 9, padding: '9px 11px' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{l.name}</div>
                          {l.need ? <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{l.need}</div> : null}
                          <div style={{ marginTop: 6 }}>{ownerBadge(l.agency, l.owner)}</div>
                        </div>
                      )) : <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', padding: '14px 0' }}>—</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>}

          {/* APPTS / TASKS — وظایف و قرارهای همهٔ مشاوران */}
          {view === 'appts' && <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {sectionTitle(`وظایف و قرارها (${fa(apptsF.length)})`)}
              <div style={{ marginInlineStart: 'auto' }}>{ownerFilterBar}</div>
            </div>
            {apptsF.length ? apptsF.map(a => {
              const tl = a.type === 'visit' ? 'بازدید' : a.type === 'meeting' ? 'جلسه' : a.type === 'call' ? 'تماس' : a.type
              const sc = a.status === 'done' ? '#34d399' : a.status === 'canceled' ? '#ef4444' : 'var(--gold)'
              const sl = a.status === 'done' ? 'انجام‌شده' : a.status === 'canceled' ? 'لغو' : 'برنامه‌ریزی‌شده'
              return (
                <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{a.client} {ownerBadge(false, a.owner)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{tl}{a.listingTitle ? ` · ${a.listingTitle}` : ''} · {a.date}</div>
                  </div>
                  <Pill label={sl} color={sc} />
                </div>
              )
            }) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>قرار/وظیفه‌ای برای مشاوران ثبت نشده است.</div>}
          </div>}

          {/* CALENDAR — تقویمِ همه (قرارها بر اساسِ تاریخ) */}
          {view === 'calendar' && <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {sectionTitle('تقویمِ همهٔ مشاوران')}
              <div style={{ marginInlineStart: 'auto' }}>{ownerFilterBar}</div>
            </div>
            {(() => {
              const groups: Record<string, UAppt[]> = {}
              for (const a of apptsF) { const k = a.date || '—'; (groups[k] = groups[k] || []).push(a) }
              const keys = Object.keys(groups)
              return keys.length ? keys.map(k => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)', marginBottom: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>📅 {k}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {groups[k].map(a => {
                      const tl = a.type === 'visit' ? 'بازدید' : a.type === 'meeting' ? 'جلسه' : a.type === 'call' ? 'تماس' : a.type
                      return <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', borderRadius: 9, padding: '8px 11px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.client}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{tl}{a.listingTitle ? ` · ${a.listingTitle}` : ''}</span>
                        <span style={{ marginInlineStart: 'auto' }}>{ownerBadge(false, a.owner)}</span>
                      </div>
                    })}
                  </div>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>قراری در تقویم نیست.</div>
            })()}
          </div>}

          {/* PLANS */}
          {view === 'plans' && <PlansPanel dashboard="/agency" />}

          {/* PROFILE */}
          {view === 'profile' && <BusinessProfileForm />}

          {/* SETTINGS */}
          {view === 'settings' && <div style={{ ...card, padding: 18, maxWidth: 480 }}>
            {sectionTitle('تنظیمات آژانس')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام آژانس</label><input value={prof.name} onChange={e => setProf({ ...prof, name: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>شعب</label><input value={prof.branches} onChange={e => setProf({ ...prof, branches: e.target.value })} style={inputStyle} /></div>
              <button disabled={busy} onClick={() => post({ action: 'updateProfile', patch: { name: prof.name, branches: prof.branches } })} style={{ ...goldBtn, alignSelf: 'flex-start', padding: '9px 22px' }}>ذخیره</button>
            </div>
          </div>}
          {view === 'support' && <SupportPanel panel="agency" />}
          </>}
        </main>
      </div>

      {/* مودالِ افزودنِ فایلِ کامل — مثلِ پنل مشاور */}
      {fileModal && (
        <div onClick={() => setFileModal(false)} dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 14px', overflowY: 'auto', fontFamily: FONT }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 2 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>افزودنِ فایلِ جدید</div>
              <button onClick={() => setFileModal(false)} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* نوع */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>نوعِ ملک و معامله</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>عنوان فایل *</label><input value={ff.title} onChange={e => setFf({ ...ff, title: e.target.value })} placeholder="مثلاً آپارتمان ۱۲۰ متری نوساز" style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع ملک</label><select value={ff.ptype} onChange={e => setFf({ ...ff, ptype: e.target.value })} style={inputStyle}>{PTYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>معامله</label><select value={ff.deal} onChange={e => setFf({ ...ff, deal: e.target.value as 'sale' | 'rent' })} style={inputStyle}><option value="sale">فروش</option><option value="rent">اجاره/رهن</option></select></div>
                </div>
              </div>
              {/* موقعیت */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>موقعیت</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>استان</label><select value={ff.province} onChange={e => setFf({ ...ff, province: e.target.value, city: '', neighborhood: '' })} style={inputStyle}><option value="">انتخاب…</option>{PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>شهر</label><select value={ff.city} onChange={e => setFf({ ...ff, city: e.target.value, neighborhood: '' })} disabled={!ff.province} style={inputStyle}><option value="">انتخاب…</option>{citiesOf(ff.province).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>محله</label><select value={ff.neighborhood} onChange={e => setFf({ ...ff, neighborhood: e.target.value })} disabled={!ff.city} style={inputStyle}><option value="">انتخاب…</option>{neighborhoodsOf(ff.city).map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                </div>
                <div style={{ marginTop: 10 }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>آدرسِ دقیق</label><input value={ff.address} onChange={e => setFf({ ...ff, address: e.target.value })} placeholder="خیابان، کوچه، پلاک…" style={inputStyle} /></div>
              </div>
              {/* مشخصات */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>مشخصات و قیمت</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>{ff.deal === 'rent' ? 'ودیعه (تومان)' : 'قیمت کل (تومان)'}</label><NumberInput value={ff.price} onChange={v => setFf({ ...ff, price: v })} style={inputStyle} /></div>
                  {ff.deal === 'rent' && <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>اجاره ماهانه</label><NumberInput value={ff.rentMonthly} onChange={v => setFf({ ...ff, rentMonthly: v })} style={inputStyle} /></div>}
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>متراژ</label><input value={ff.area} onChange={e => setFf({ ...ff, area: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>خواب</label><input value={ff.rooms} onChange={e => setFf({ ...ff, rooms: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>طبقه</label><input value={ff.floor} onChange={e => setFf({ ...ff, floor: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>کل طبقات</label><input value={ff.totalFloors} onChange={e => setFf({ ...ff, totalFloors: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>سال ساخت</label><input value={ff.yearBuilt} onChange={e => setFf({ ...ff, yearBuilt: e.target.value.replace(/\D/g, '') })} placeholder="۱۴۰۲" style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>جهت</label><select value={ff.facing} onChange={e => setFf({ ...ff, facing: e.target.value })} style={inputStyle}><option value="">—</option>{FACING_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع سند</label><input value={ff.docType} onChange={e => setFf({ ...ff, docType: e.target.value })} placeholder="تک‌برگ" style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>تلفن تماس</label><input value={ff.phone} onChange={e => setFf({ ...ff, phone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} /></div>
                </div>
              </div>
              {/* امکانات */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>امکانات</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {AMENITIES.map(a => (
                    <button key={a.key} onClick={() => setFf({ ...ff, [a.key]: !ff[a.key] } as typeof ff)} style={{ padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, border: `1px solid ${ff[a.key] ? 'var(--gold)' : 'var(--line2)'}`, background: ff[a.key] ? 'var(--goldDim)' : 'transparent', color: ff[a.key] ? 'var(--gold)' : 'var(--muted)' }}>{ff[a.key] ? '✓ ' : ''}{a.label}</button>
                  ))}
                </div>
              </div>
              {/* تصاویر */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>تصاویر</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
                  {ff.images.map((img, i) => <ImageUpload key={i} value={img} onChange={v => setFf(f => { const arr = [...f.images]; if (v) arr[i] = v; else arr.splice(i, 1); return { ...f, images: arr } })} height={90} />)}
                  <ImageUpload value="" onChange={v => { if (v) setFf(f => ({ ...f, images: [...f.images, v] })) }} height={90} label="افزودن تصویر" />
                </div>
              </div>
              {/* توضیحات */}
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>توضیحات</label><textarea value={ff.description} onChange={e => setFf({ ...ff, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--line)', position: 'sticky', bottom: 0, background: 'var(--bg2)' }}>
              <button onClick={() => setFileModal(false)} style={{ ...actionBtn, padding: '9px 18px' }}>انصراف</button>
              <button disabled={busy || !ff.title.trim()} onClick={submitFile} style={goldBtn}>{busy ? 'در حال ثبت…' : 'ثبتِ فایل'}</button>
            </div>
          </div>
        </div>
      )}
      {dupWarn && (
        <div onClick={() => setDupWarn('')} style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 200, maxWidth: 540, background: 'linear-gradient(135deg,#3a2a12,#2a1f0e)', border: '1px solid #f59e0b', color: '#fde68a', padding: '13px 18px', borderRadius: 12, fontSize: 13, lineHeight: 1.9, cursor: 'pointer', boxShadow: '0 8px 30px rgba(0,0,0,.5)', fontFamily: FONT }}>
          {dupWarn} <span style={{ color: '#f59e0b', fontWeight: 700 }}>(بستن)</span>
        </div>
      )}
    </div>
  )
}
