'use client'
import { useState, useEffect, useCallback } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'
import MessagesPanel from '@/app/components/MessagesPanel'
import NegotiationEngine from '@/app/components/NegotiationEngine'
import DivarImport from '@/app/components/DivarImport'
import CrmTool, { CRM_VIEWS, type CrmView } from '@/app/components/tools/CrmTool'
import MarketingTool, { MARKETING_VIEWS, type MarketingView } from '@/app/components/tools/MarketingTool'
import WorkflowTool, { WORKFLOW_VIEWS, type WorkflowView } from '@/app/components/tools/WorkflowTool'
import WebsiteBuilderTool, { WEBSITE_VIEWS, type WebsiteView } from '@/app/components/tools/WebsiteBuilderTool'
import ArticleEditor from '@/app/components/ArticleEditor'
import PlansPanel from '@/app/components/PlansPanel'
import LocationPicker from '@/app/components/LocationPicker'
import JalaliDatePicker from '@/app/components/JalaliDatePicker'
import NumberInput from '@/app/components/NumberInput'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'

// درختِ جغرافیاییِ سایت (استان → شهر → منطقه → محله)
interface GeoDistrict { id: string; name: string; neighborhoods: string[] }
interface GeoCity { id: string; name: string; districts: GeoDistrict[] }
interface GeoProvince { id: string; name: string; cities: GeoCity[] }

// ════════ Types (mirror app/lib/advisor-store.ts) ════════
type Stage = 'new' | 'contacted' | 'visit' | 'negotiation' | 'closed' | 'lost'
type ListingStatus = 'active' | 'sold' | 'rented'
type ApptType = 'visit' | 'meeting' | 'call'
type ApptStatus = 'scheduled' | 'done' | 'canceled'
type CommStatus = 'pending' | 'paid'

interface Lead { id: string; name: string; phone?: string; need?: string; budget?: string; stage: Stage; source?: string; note?: string; createdAt: number }
interface Listing {
  id: string; title: string; ptype: string; location: string; price: number; deal: 'sale' | 'rent'; status: ListingStatus; createdAt: number
  city?: string; neighborhood?: string; facing?: string; province?: string; district?: string; lat?: number; lng?: number
  rentMonthly?: number; area?: number; rooms?: number; floor?: number; totalFloors?: number; yearBuilt?: number
  parking?: boolean; elevator?: boolean; storage?: boolean; balcony?: boolean; furnished?: boolean
  amenities?: string[]
  docType?: string; address?: string; phone?: string; description?: string; images?: string[]
  published?: boolean; publicId?: string
  sellerLeadId?: string; buyerLeadIds?: string[]
}
interface Appt { id: string; client: string; listingTitle?: string; date: string; type: ApptType; status: ApptStatus; createdAt: number }
interface Commission { id: string; dealTitle: string; amount: number; status: CommStatus; date: string; createdAt: number; percent?: number; dealAmount?: number }
interface Stats {
  profile: { name: string; agency?: string; title?: string; bio?: string; phone?: string; areas?: string; experience?: string; photo?: string; specialties?: string[] }
  kpis: { activeLeads: number; hotLeads: number; activeListings: number; upcomingAppts: number; pendingCommission: number; paidCommission: number; dealsThisMonth: number }
  pipeline: { stage: Stage; count: number }[]
  monthlyDeals: { month: string; count: number }[]
  recentLeads: Lead[]
  upcoming: Appt[]
}
interface AdvisorData { stats: Stats; leads: Lead[]; listings: Listing[]; appts: Appt[]; commissions: Commission[] }

type View = 'dashboard' | 'assistant' | 'messages' | 'leads' | 'listings' | 'divar' | 'negotiation' | 'articles' | 'appts' | 'calendar' | 'commissions' | 'agency' | 'plans' | 'profile' | 'settings'

interface DivarImport { token: string; listingId: string; title: string; url: string; at: number; published: boolean }
interface DivarConfig {
  divarName: string; searchUrl: string; schedule: 'off' | 'hourly' | '6h' | 'daily'
  autoPublish: boolean; autoNeighborhood: boolean
  lastRun?: number; lastCount?: number; lastError?: string
  imports: DivarImport[]
}

// ════════ Agency-link types (mirror /api/agency-link) ════════
interface AgencyMembership { advisorPhone: string; advisorName: string; agencyPhone: string; agencyName: string; since: number }
interface AgencyRequest { id: string; advisorPhone: string; advisorName: string; agencyPhone: string; agencyName: string; initiator: 'advisor' | 'agency'; status: string; createdAt: number }
interface AgencyOption { phone: string; name: string; branches?: string }
interface AgencyLinkData { role: string; membership: AgencyMembership | null; requests: AgencyRequest[]; agencies: AgencyOption[] }

// ════════ Helpers ════════
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
// بودجه: اگر عدد بود با جداکننده + «تومان»، وگرنه همان متن
const fmtBudget = (b?: string) => {
  const s = String(b || '').trim(); if (!s) return ''
  if (!/^[\d۰-۹,٬\s]+$/.test(s)) return s
  const n = Number(s.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))
  return n ? `${n.toLocaleString('fa-IR')} تومان` : s
}
function money(n: number): string {
  if (!n) return '—'
  if (n >= 1e9) return fa(Math.round((n / 1e9) * 10) / 10) + ' میلیارد'
  if (n >= 1e6) return fa(Math.round(n / 1e6)) + ' میلیون'
  return fa(n) + ' تومان'
}
const faDate = (ts: number) => { try { return new Date(ts).toLocaleDateString('fa-IR') } catch { return '' } }

const STAGES: Stage[] = ['new', 'contacted', 'visit', 'negotiation', 'closed', 'lost']
const STAGE_LABEL: Record<Stage, string> = { new: 'لید جدید', contacted: 'تماس‌گرفته', visit: 'بازدید', negotiation: 'مذاکره', closed: 'قرارداد', lost: 'ازدست‌رفته' }
const STAGE_COLOR: Record<Stage, string> = { new: 'var(--gold)', contacted: '#60a5fa', visit: '#2dd4bf', negotiation: '#f59e0b', closed: '#34d399', lost: '#7a8fae' }
const LIST_LABEL: Record<ListingStatus, string> = { active: 'فعال', sold: 'فروخته‌شده', rented: 'اجاره‌رفته' }
const LIST_COLOR: Record<ListingStatus, string> = { active: '#34d399', sold: '#60a5fa', rented: '#2dd4bf' }
const LIST_STATUSES: ListingStatus[] = ['active', 'sold', 'rented']
const APPT_LABEL: Record<ApptType, string> = { visit: 'بازدید', meeting: 'جلسه', call: 'تماس' }
const APPTST_LABEL: Record<ApptStatus, string> = { scheduled: 'برنامه‌ریزی‌شده', done: 'انجام‌شده', canceled: 'لغو' }
const APPTST_COLOR: Record<ApptStatus, string> = { scheduled: 'var(--gold)', done: '#34d399', canceled: '#7a8fae' }
const APPT_STATUSES: ApptStatus[] = ['scheduled', 'done', 'canceled']
const DEAL_LABEL = { sale: 'فروش', rent: 'اجاره' } as const
const PTYPE_OPTIONS = ['آپارتمان', 'ویلا', 'خانه/کلنگی', 'زمین', 'مغازه', 'دفتر/اداری', 'سوله/انبار', 'باغ', 'سایر']
const FACING_OPTIONS = ['شمالی', 'جنوبی', 'شرقی', 'غربی', 'دوبر', 'سه‌بر']
// همهٔ امکاناتِ یک آگهی (مثل دیوار)
const AMENITIES = ['پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'تراس', 'روف‌گاردن', 'مبله', 'آنتن مرکزی', 'آیفون تصویری', 'درب ریموت‌کنترل', 'کولر آبی', 'اسپلیت', 'پکیج', 'شوفاژ', 'گرمایش از کف', 'آبگرمکن', 'استخر', 'سونا', 'جکوزی', 'سالن اجتماعات', 'لابی', 'نگهبان/سرایدار', 'دوربین مداربسته', 'لاندری', 'اتاق مستر', 'کمد دیواری', 'کابینت MDF', 'آشپزخانه اپن', 'سرویس فرنگی', 'بازسازی‌شده']

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inputStyle: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%' }
const actionBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap' }
const goldBtn: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }

const VIEW_TITLES: Record<View, string> = { dashboard: 'داشبورد مشاور', assistant: 'دستیار هوشمند', messages: 'پیام‌ها', leads: 'لیدها و پایپ‌لاین', listings: 'فایل‌های من', divar: 'ایمپورت از دیوار', negotiation: 'موتور مذاکره', articles: 'مقالات و وبلاگ', appts: 'قرارها و بازدیدها', calendar: 'تقویم', commissions: 'کمیسیون', agency: 'آژانس من', plans: 'پلن‌ها و اشتراک', profile: 'پروفایل', settings: 'تنظیمات' }
const NAV_ITEMS: { id: View; label: string; icon: string; badge?: 'leads' | 'appts' }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '▦' },
  { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
  { id: 'messages', label: 'پیام‌ها', icon: '💬' },
  { id: 'leads', label: 'لیدها', icon: '◎', badge: 'leads' },
  { id: 'listings', label: 'فایل‌های من', icon: '◫' },
  { id: 'divar', label: 'ایمپورت از دیوار', icon: '📥' },
  { id: 'negotiation', label: 'موتور مذاکره', icon: '🤝' },
  { id: 'appts', label: 'قرارها', icon: '◉', badge: 'appts' },
  { id: 'calendar', label: 'تقویم', icon: '🗓' },
  { id: 'commissions', label: 'کمیسیون', icon: '💰' },
  { id: 'agency', label: 'آژانس من', icon: '🏢' },
  { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
  { id: 'profile', label: 'پروفایل', icon: '🪪' },
  { id: 'settings', label: 'تنظیمات', icon: '⛭' },
]

// ── تقویم جلالی (بدون وابستگی) ──
const J_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const J_WEEK = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
const JF = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric' })
function jParts(d: Date): { jy: number; jm: number; jd: number } {
  const p = JF.formatToParts(d); const g = (t: string) => Number(p.find(x => x.type === t)?.value || 0)
  return { jy: g('year'), jm: g('month'), jd: g('day') }
}
function firstOfJMonth(offset: number): Date {
  let d = new Date(); const t = jParts(d)
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (t.jd - 1))
  let o = offset
  while (o > 0) { const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 32); const p = jParts(n); d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - (p.jd - 1)); o-- }
  while (o < 0) { const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); const p = jParts(n); d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - (p.jd - 1)); o++ }
  return d
}
function normJDate(s: string): string {
  const latin = (s || '').replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
  const m = latin.match(/(\d{3,4})\D+(\d{1,2})\D+(\d{1,2})/)
  return m ? `${Number(m[1])}-${Number(m[2])}-${Number(m[3])}` : ''
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>{label}</span>
}
function Kpi({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div style={{ ...card, padding: '16px 18px', flex: '1 1 150px', minWidth: 150 }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: subColor || 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function ProsPage() {
  const [view, setView] = useState<View>('dashboard')
  // CRM جاسازی‌شده: وقتی مقدار دارد، محتوای CRM در همین پنل نمایش داده می‌شود
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
  const [data, setData] = useState<AdvisorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauth, setUnauth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [search, setSearch] = useState('')
  const [nl, setNl] = useState({ name: '', phone: '', need: '', budget: '', source: '' })
  const [editLeadId, setEditLeadId] = useState<string | null>(null)
  const startEditLead = (l: Lead) => { setEditLeadId(l.id); setNl({ name: l.name, phone: l.phone || '', need: l.need || '', budget: l.budget || '', source: l.source || '' }) }
  const cancelEditLead = () => { setEditLeadId(null); setNl({ name: '', phone: '', need: '', budget: '', source: '' }) }
  const [na, setNa] = useState({ client: '', listingTitle: '', date: '', type: 'visit' })
  // فرمِ کاملِ فایل (پاپ‌آپ)
  const emptyForm = { title: '', ptype: 'آپارتمان', deal: 'sale' as 'sale' | 'rent', province: '', city: '', district: '', neighborhood: '', location: '', address: '', lat: null as number | null, lng: null as number | null, facing: '', price: '', rentMonthly: '', area: '', rooms: '', floor: '', totalFloors: '', yearBuilt: '', docType: '', phone: '', description: '', amenities: [] as string[], images: [] as string[], publish: false }
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [step, setStep] = useState(0)
  const [calOffset, setCalOffset] = useState(0)
  const [geo, setGeo] = useState<GeoProvince[]>([])
  const [areaSel, setAreaSel] = useState({ province: '', city: '', district: '', neighborhood: '' })
  useEffect(() => { fetch('/api/geo', { cache: 'no-store' }).then(r => r.ok ? r.json() : { provinces: [] }).then(d => setGeo(d.provinces || [])).catch(() => {}) }, [])
  // ── ایمپورت از دیوار ──
  const [divarCfg, setDivarCfg] = useState<DivarConfig | null>(null)
  const [divarUrl, setDivarUrl] = useState('')
  const [divarBusy, setDivarBusy] = useState(false)
  const [divarMsg, setDivarMsg] = useState('')
  const refreshDivar = useCallback(async () => {
    try { const r = await fetch('/api/advisor/divar', { cache: 'no-store' }); if (r.ok) { const d = await r.json(); setDivarCfg(d.config) } } catch {}
  }, [])
  useEffect(() => { refreshDivar() }, [refreshDivar])
  const divarPost = useCallback(async (body: Record<string, unknown>): Promise<any> => {
    setDivarBusy(true); setDivarMsg('')
    try {
      const r = await fetch('/api/advisor/divar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setDivarMsg(d.error || 'عملیات ناموفق بود'); return null }
      if (d.config) setDivarCfg(d.config)
      return d
    } catch { setDivarMsg('اتصال به سرور برقرار نشد'); return null } finally { setDivarBusy(false) }
  }, [])

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setStep(0); setShowForm(true) }
  const openEdit = (l: Listing) => {
    setForm({ title: l.title, ptype: l.ptype, deal: l.deal, province: l.province || '', city: l.city || '', district: l.district || '', neighborhood: l.neighborhood || '', location: l.location, address: l.address || '', lat: l.lat ?? null, lng: l.lng ?? null, facing: l.facing || '', price: String(l.price || ''), rentMonthly: String(l.rentMonthly || ''), area: String(l.area || ''), rooms: String(l.rooms ?? ''), floor: String(l.floor || ''), totalFloors: String(l.totalFloors || ''), yearBuilt: String(l.yearBuilt || ''), docType: l.docType || '', phone: l.phone || '', description: l.description || '', amenities: l.amenities || [], images: l.images || [], publish: !!l.published })
    setEditingId(l.id); setStep(0); setShowForm(true)
  }
  const toggleAmenity = (a: string) => setForm(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }))
  const uploadImages = async (files: FileList | null) => {
    if (!files || !files.length) return
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file)
      try { const r = await fetch('/api/media', { method: 'POST', body: fd }); const d = await r.json(); if (d.url) urls.push(d.url) } catch {}
    }
    setForm(f => ({ ...f, images: [...f.images, ...urls].slice(0, 12) }))
    setUploading(false)
  }
  // انتخابِ دسته‌ایِ فایل‌ها در «فایل‌های من»
  const [selFiles, setSelFiles] = useState<Set<string>>(new Set())
  const toggleFile = (id: string) => setSelFiles(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const bulkFiles = async (action: 'delete' | 'status', status?: string) => {
    const ids = [...selFiles]
    for (const id of ids) await post(action === 'delete' ? { action: 'deleteListing', id } : { action: 'setListingStatus', id, status })
    setSelFiles(new Set())
  }
  const saveListing = async () => {
    if (!form.title.trim()) { alert('عنوان فایل الزامی است'); return }
    const patch = {
      title: form.title.trim(), ptype: form.ptype, deal: form.deal,
      province: form.province, city: form.city, district: form.district, neighborhood: form.neighborhood, location: form.location, address: form.address, facing: form.facing,
      lat: form.lat ?? undefined, lng: form.lng ?? undefined,
      price: Number(form.price) || 0, rentMonthly: Number(form.rentMonthly) || 0,
      area: Number(form.area) || 0, rooms: Number(form.rooms) || 0, floor: Number(form.floor) || 0,
      totalFloors: Number(form.totalFloors) || 0, yearBuilt: Number(form.yearBuilt) || 0,
      docType: form.docType, phone: form.phone, description: form.description,
      amenities: form.amenities, images: form.images,
    }
    setBusy(true)
    try {
      const H = { 'Content-Type': 'application/json' }
      const r = await fetch('/api/advisor', { method: 'POST', headers: H, body: JSON.stringify(editingId ? { action: 'updateListing', id: editingId, patch } : { action: 'addListing', ...patch }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'خطا در ذخیره'); return }
      const listingId: string | undefined = editingId || d.listing?.id
      const wasPublished = editingId ? !!data?.listings.find(l => l.id === editingId)?.published : false
      if (listingId) {
        if (form.publish) await fetch('/api/advisor', { method: 'POST', headers: H, body: JSON.stringify({ action: 'publishListing', id: listingId }) })
        else if (wasPublished) await fetch('/api/advisor', { method: 'POST', headers: H, body: JSON.stringify({ action: 'unpublishListing', id: listingId }) })
      }
      await refresh()
      setShowForm(false); setForm(emptyForm); setEditingId(null)
      if (d.duplicate) setDupWarn(`⚠ این فایل احتمالاً تکراری است با «${d.duplicate.title}»${d.duplicate.ownerName ? ` (ثبت‌شده توسط ${d.duplicate.ownerName})` : ''}. بررسی کنید قبلاً ثبت نشده باشد.`)
    } catch { alert('اتصال به سرور برقرار نشد') } finally { setBusy(false) }
  }
  const [dupWarn, setDupWarn] = useState('')
  const [nc, setNc] = useState({ dealTitle: '', mode: 'amount' as 'amount' | 'percent', amount: '', percent: '', dealAmount: '' })
  const [prof, setProf] = useState({ name: '', agency: '', title: '', bio: '', phone: '', areas: '', experience: '', photo: '', specialties: [] as string[] })
  const [specInput, setSpecInput] = useState('')
  const [myPhone, setMyPhone] = useState('')
  const [profUploading, setProfUploading] = useState(false)
  // ── آژانس من ──
  const [agencyData, setAgencyData] = useState<AgencyLinkData | null>(null)
  const [agencySearch, setAgencySearch] = useState('')

  const refreshAgency = useCallback(async () => {
    try {
      const r = await fetch('/api/agency-link', { cache: 'no-store' })
      if (!r.ok) { setAgencyData(null); return }
      const d = await r.json(); setAgencyData(d)
    } catch { setAgencyData(null) }
  }, [])
  useEffect(() => { refreshAgency() }, [refreshAgency])
  useEffect(() => {
    fetch('/api/auth/profile', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d?.phone) setMyPhone(d.phone) }).catch(() => {})
  }, [])

  const agencyPost = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const r = await fetch('/api/agency-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'انجام عملیات ناموفق بود'); return false }
      await refreshAgency(); return true
    } catch { return false } finally { setBusy(false) }
  }, [refreshAgency])

  const uploadProfilePhoto = async (files: FileList | null) => {
    if (!files || !files.length) return
    setProfUploading(true)
    const fd = new FormData(); fd.append('file', files[0])
    try { const r = await fetch('/api/media', { method: 'POST', body: fd }); const d = await r.json(); if (d.url) setProf(p => ({ ...p, photo: d.url })) } catch {}
    setProfUploading(false)
  }
  const addSpecialty = (raw: string) => {
    const v = raw.trim()
    if (!v) return
    setProf(p => p.specialties.includes(v) ? p : { ...p, specialties: [...p.specialties, v] })
    setSpecInput('')
  }

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/advisor')
      if (r.status === 401) { setUnauth(true); setLoading(false); return }
      const d = await r.json(); setData(d); setUnauth(false)
      const p = d.stats.profile || {}
      setProf({ name: p.name || '', agency: p.agency || '', title: p.title || '', bio: p.bio || '', phone: p.phone || '', areas: p.areas || '', experience: p.experience || '', photo: p.photo || '', specialties: Array.isArray(p.specialties) ? p.specialties : [] })
    } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const post = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    try {
      const r = await fetch('/api/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'برای انجام این عملیات وارد شوید'); return false }
      await refresh(); return true
    } catch { return false } finally { setBusy(false) }
  }, [refresh])

  const toggleTheme = () => { const html = document.documentElement; if (theme === 'dark') { html.classList.add('light'); setTheme('light') } else { html.classList.remove('light'); setTheme('dark') } }

  if (loading) return <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 15 }}>در حال بارگذاری پنل مشاور…</div>
  if (unauth || !data) return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ ...card, padding: '40px 44px', textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>برای دسترسی به پنل مشاور وارد شوید</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>این پنل فقط برای کاربران واردشده در دسترس است.</div>
        <a href="/auth" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>ورود به حساب</a>
      </div>
    </div>
  )

  const { stats, leads, listings, appts, commissions } = data
  const q = search.trim()
  const leadsF = q ? leads.filter(l => (l.name + (l.need || '') + (l.phone || '')).includes(q)) : leads
  const maxDeals = Math.max(1, ...stats.monthlyDeals.map(m => m.count))
  const sectionTitle = (t: string) => <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>{t}</div>
  // درختِ جغرافیایی برای فرمِ افزودن فایل
  const gProvince = geo.find(p => p.name === form.province)
  const gCity = gProvince?.cities.find(c => c.name === form.city)
  // درختِ جغرافیایی برای «مناطق فعالیتِ» پروفایل (جدا از فرم فایل)
  const aProv = geo.find(p => p.name === areaSel.province)
  const aCity = aProv?.cities.find(c => c.name === areaSel.city)
  const aDist = aCity?.districts.find(d => d.name === areaSel.district)
  const areaList = prof.areas ? prof.areas.split('،').map(s => s.trim()).filter(Boolean) : []
  const addArea = (name: string) => { const n = name.trim(); if (n && !areaList.includes(n)) setProf({ ...prof, areas: [...areaList, n].join('، ') }) }
  const removeArea = (name: string) => setProf({ ...prof, areas: areaList.filter(x => x !== name).join('، ') })
  const gDistrict = gCity?.districts.find(d => d.name === form.district)
  const STEPS = ['نوع ملک', 'موقعیت و نقشه', 'مشخصات', 'امکانات و عکس']

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <style>{`@media(max-width:760px){.mjp-side{width:60px!important}.mjp-sidelabel{display:none!important}.mjp-cols{flex-direction:column!important}}`}</style>

      {/* SIDEBAR */}
      <aside className="mjp-side" style={{ width: 232, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--line)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px var(--gold)', flexShrink: 0 }}>
              <div style={{ width: 13, height: 13, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 3 }} />
            </div>
            <div><div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px' }}>ملک‌جت</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>پنل مشاور</div></div>
          </div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = view === item.id && !crmView && !mktView && !wfView && !wbView
            const badge = item.badge === 'leads' ? stats.kpis.activeLeads : item.badge === 'appts' ? stats.kpis.upcomingAppts : 0
            return (
              <button key={item.id} onClick={() => goView(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontWeight: active ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                <span className="mjp-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badge > 0 && <span style={{ background: active ? 'var(--gold)' : 'var(--line2)', color: active ? '#16140f' : 'var(--text)', borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{fa(badge)}</span>}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />

          {/* CRM — جاسازی‌شده با منوی آبشاری (داخل همین پنل باز می‌شود) */}
          <button onClick={() => { setCrmOpen(o => !o); if (!crmView) openCrm('dashboard') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: crmView ? 'var(--goldDim)' : 'transparent', color: crmView ? 'var(--gold)' : 'var(--muted)', fontWeight: crmView ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: crmView ? 1 : 0.7 }}>◇</span>
            <span className="mjp-sidelabel" style={{ flex: 1 }}>CRM و مشتریان</span>
            <span className="mjp-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: crmOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {crmOpen && CRM_VIEWS.map(cv => {
            const on = crmView === cv.id
            return (
              <button key={cv.id} onClick={() => openCrm(cv.id)} className="mjp-sidelabel" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px 8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{cv.icon}</span>
                <span style={{ flex: 1 }}>{cv.label}</span>
              </button>
            )
          })}

          {/* مارکتینگ — جاسازی‌شده با منوی آبشاری (مثل CRM) */}
          <button onClick={() => { setMktOpen(o => !o); if (!mktView) openMkt('overview') }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: mktView ? 'var(--goldDim)' : 'transparent', color: mktView ? 'var(--gold)' : 'var(--muted)', fontWeight: mktView ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: mktView ? 1 : 0.7 }}>◬</span>
            <span className="mjp-sidelabel" style={{ flex: 1 }}>مارکتینگ</span>
            <span className="mjp-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: mktOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {mktOpen && MARKETING_VIEWS.map(mv => {
            const on = mktView === mv.id
            return (
              <button key={mv.id} onClick={() => openMkt(mv.id)} className="mjp-sidelabel" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{mv.icon}</span>
                <span style={{ flex: 1 }}>{mv.label}</span>
              </button>
            )
          })}

          {/* اتوماسیون — منوی آبشاری، داخل همین پنل */}
          <button onClick={() => { setWfOpen(o => !o); if (!wfView) openWf(WORKFLOW_VIEWS[0].id) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: wfView ? 'var(--goldDim)' : 'transparent', color: wfView ? 'var(--gold)' : 'var(--muted)', fontWeight: wfView ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: wfView ? 1 : 0.7 }}>⛭</span>
            <span className="mjp-sidelabel" style={{ flex: 1 }}>اتوماسیون</span>
            <span className="mjp-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: wfOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {wfOpen && WORKFLOW_VIEWS.map(v => {
            const on = wfView === v.id
            return (
              <button key={v.id} onClick={() => openWf(v.id)} className="mjp-sidelabel" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{v.icon}</span>
                <span style={{ flex: 1 }}>{v.label}</span>
              </button>
            )
          })}

          {/* وب‌سایت‌ساز — منوی آبشاری، داخل همین پنل */}
          <button onClick={() => { setWbOpen(o => !o); if (!wbView) openWb(WEBSITE_VIEWS[0].id) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: wbView ? 'var(--goldDim)' : 'transparent', color: wbView ? 'var(--gold)' : 'var(--muted)', fontWeight: wbView ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: wbView ? 1 : 0.7 }}>◳</span>
            <span className="mjp-sidelabel" style={{ flex: 1 }}>وب‌سایت‌ساز</span>
            <span className="mjp-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: wbOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {wbOpen && WEBSITE_VIEWS.map(v => {
            const on = wbView === v.id
            return (
              <button key={v.id} onClick={() => openWb(v.id)} className="mjp-sidelabel" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{v.icon}</span>
                <span style={{ flex: 1 }}>{v.label}</span>
              </button>
            )
          })}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#16140f', flexShrink: 0 }}>{stats.profile.name.trim().charAt(0) || 'م'}</div>
          <div className="mjp-sidelabel" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.profile.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{stats.profile.agency || 'مشاور املاک'}</div>
          </div>
          <button onClick={toggleTheme} title="تغییر تم" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{theme === 'dark' ? '☀' : '☾'}</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--navbg)', backdropFilter: 'blur(18px)', zIndex: 20, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{crmView ? `CRM · ${CRM_VIEWS.find(v => v.id === crmView)?.label || ''}` : mktView ? `مارکتینگ · ${MARKETING_VIEWS.find(v => v.id === mktView)?.label || ''}` : wfView ? `اتوماسیون · ${WORKFLOW_VIEWS.find(v => v.id === wfView)?.label || ''}` : wbView ? `وب‌سایت‌ساز · ${WEBSITE_VIEWS.find(v => v.id === wbView)?.label || ''}` : VIEW_TITLES[view]}</div>
          <div style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی لید، مشتری…" style={{ ...inputStyle, width: 220, maxWidth: '40vw' }} />
          <button onClick={() => goView('leads')} style={{ ...goldBtn, padding: '9px 16px' }}>+ لید جدید</button>
        </header>

        <main style={{ padding: 22, flex: 1, overflowY: 'auto' }}>
          {crmView ? <CrmTool embedded view={crmView} onView={v => setCrmView(v)}
              ownListings={listings.map(l => ({ id: l.id, title: l.title, priceText: l.deal === 'rent' ? `ودیعه ${money(l.price)}${l.rentMonthly ? ` · اجاره ${money(l.rentMonthly)}` : ''}` : money(l.price), status: l.status, location: [l.city, l.neighborhood].filter(Boolean).join('، ') || l.location, published: l.published, publicId: l.publicId, sellerLeadId: l.sellerLeadId, buyerLeadIds: l.buyerLeadIds }))}
              leads={leads.map(ld => ({ id: ld.id, name: `${ld.name}${ld.need ? ' — ' + ld.need : ''}` }))}
              onAddListing={openAdd}
              onEditListing={id => { const l = listings.find(x => x.id === id); if (l) openEdit(l) }}
              onDeleteListing={id => post({ action: 'deleteListing', id })}
              onSetListingStatus={(id, status) => post({ action: 'setListingStatus', id, status })}
              onLinkLeads={(id, sellerLeadId, buyerLeadIds) => post({ action: 'updateListing', id, patch: { sellerLeadId, buyerLeadIds } })}
              onBulkDelete={async ids => { for (const id of ids) await post({ action: 'deleteListing', id }) }}
              onBulkStatus={async (ids, status) => { for (const id of ids) await post({ action: 'setListingStatus', id, status }) }}
            />
            : mktView === 'articles' ? <ArticleEditor compact author={stats.profile.name || undefined} />
            : mktView ? <MarketingTool embedded view={mktView} onView={v => setMktView(v)} />
            : wfView ? <div style={{ height: 'calc(100vh - 130px)' }}><WorkflowTool embedded view={wfView} onView={v => setWfView(v)} /></div>
            : wbView ? <div style={{ height: 'calc(100vh - 130px)' }}><WebsiteBuilderTool embedded view={wbView} onView={v => setWbView(v)} /></div>
            : <>
          {/* DASHBOARD */}
          {view === 'dashboard' && <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Kpi label="لیدهای فعال" value={fa(stats.kpis.activeLeads)} subColor="var(--gold)" sub={`${fa(stats.kpis.hotLeads)} داغ`} />
              <Kpi label="فایل‌های فعال" value={fa(stats.kpis.activeListings)} />
              <Kpi label="قرارهای پیش‌رو" value={fa(stats.kpis.upcomingAppts)} />
              <Kpi label="معاملات این ماه" value={fa(stats.kpis.dealsThisMonth)} />
              <Kpi label="کمیسیون در انتظار" value={money(stats.kpis.pendingCommission)} subColor="#34d399" sub={`${money(stats.kpis.paidCommission)} پرداخت‌شده`} />
            </div>
            {/* pipeline */}
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('پایپ‌لاین فروش')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {stats.pipeline.map(p => (
                  <div key={p.stage} style={{ flex: '1 1 110px', minWidth: 110, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11.5, color: STAGE_COLOR[p.stage], fontWeight: 700 }}>{STAGE_LABEL[p.stage]}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{fa(p.count)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mjp-cols" style={{ display: 'flex', gap: 16 }}>
              <div style={{ ...card, padding: 18, flex: 2, minWidth: 0 }}>
                {sectionTitle('لیدهای اخیر')}
                {stats.recentLeads.length ? stats.recentLeads.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{l.name}{l.phone ? <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> · {l.phone}</span> : ''}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{l.need} {l.budget ? `· ${fmtBudget(l.budget)}` : ''}</div>
                    </div>
                    <Pill label={STAGE_LABEL[l.stage]} color={STAGE_COLOR[l.stage]} />
                  </div>
                )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>لیدی نداری.</div>}
              </div>
              <div style={{ ...card, padding: 18, flex: 1, minWidth: 0 }}>
                {sectionTitle('معاملات ۶ ماهه')}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, padding: '8px 0' }}>
                  {stats.monthlyDeals.map((m, i) => {
                    const last = i === stats.monthlyDeals.length - 1
                    return (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fa(m.count)}</div>
                        <div style={{ width: '70%', height: `${(m.count / maxDeals) * 90}px`, minHeight: 4, borderRadius: 6, background: last ? 'linear-gradient(180deg,var(--gold),var(--gold2))' : 'var(--line2)' }} />
                        <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{m.month}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('قرارهای پیش‌رو')}
              {stats.upcoming.length ? stats.upcoming.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{a.client} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>· {APPT_LABEL[a.type]}</span></div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{a.listingTitle || '—'} · {a.date}</div>
                  </div>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>قراری نداری.</div>}
            </div>
          </div>}

          {/* ASSISTANT */}
          {view === 'assistant' && (
            <div style={{ height: 'calc(100vh - 130px)' }}>
              <AssistantPanel panel="pros" title="دستیار هوشمند مشاور" subtitle="مشاور AI شخصیِ تو" suggestions={["یک پیام پیگیری حرفه‌ای برای لید بنویس", "قیمت منطقهٔ … را تحلیل کن", "اسکریپت مذاکره برای فروش بده", "چطور این لید را به معامله برسانم؟"]} />
            </div>
          )}

          {/* MESSAGES — گفتگوی واقعی با خریدارانِ آگهی‌های شما */}
          {view === 'messages' && <MessagesPanel role="owner" />}

          {/* NEGOTIATION ENGINE — داخلِ همین پنل */}
          {view === 'negotiation' && <NegotiationEngine listings={listings.map(l => ({ id: l.id, title: l.title, price: l.price, deal: l.deal, location: [l.city, l.neighborhood].filter(Boolean).join('، ') || l.location }))} />}

          {/* LEADS */}
          {view === 'leads' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle(editLeadId ? 'ویرایش لید' : 'افزودن لید')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام</label><input value={nl.name} onChange={e => setNl({ ...nl, name: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 130px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>تلفن</label><input value={nl.phone} onChange={e => setNl({ ...nl, phone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} /></div>
                <div style={{ flex: '2 1 180px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نیاز</label><input value={nl.need} onChange={e => setNl({ ...nl, need: e.target.value })} placeholder="مثلاً آپارتمان ۲ خوابه" style={inputStyle} /></div>
                <div style={{ flex: '1 1 130px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>بودجه (تومان)</label><NumberInput value={nl.budget} onChange={v => setNl({ ...nl, budget: v })} style={inputStyle} /></div>
                <button disabled={busy || !nl.name.trim()} onClick={async () => {
                  const ok = editLeadId
                    ? await post({ action: 'updateLead', id: editLeadId, patch: { name: nl.name.trim(), phone: nl.phone, need: nl.need, budget: nl.budget, source: nl.source } })
                    : await post({ action: 'addLead', name: nl.name.trim(), phone: nl.phone, need: nl.need, budget: nl.budget, source: nl.source })
                  if (ok) cancelEditLead()
                }} style={goldBtn}>{editLeadId ? 'ذخیره' : 'افزودن'}</button>
                {editLeadId && <button onClick={cancelEditLead} style={actionBtn}>لغو</button>}
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle(`لیدها (${fa(leadsF.length)})`)}
              {leadsF.length ? leadsF.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{l.name}{l.phone ? <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> · {l.phone}</span> : ''}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{l.need} {l.budget ? `· بودجه: ${fmtBudget(l.budget)}` : ''} {l.source ? `· منبع: ${l.source}` : ''}</div>
                  </div>
                  <select value={l.stage} onChange={e => post({ action: 'setLeadStage', id: l.id, stage: e.target.value })} style={{ ...actionBtn, cursor: 'pointer', color: STAGE_COLOR[l.stage], borderColor: STAGE_COLOR[l.stage] }}>
                    {STAGES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{STAGE_LABEL[s]}</option>)}
                  </select>
                  <button onClick={() => startEditLead(l)} style={actionBtn}>ویرایش</button>
                  <button onClick={() => post({ action: 'deleteLead', id: l.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>لیدی نداری.</div>}
            </div>
          </div>}

          {/* LISTINGS */}
          {view === 'listings' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>فایل‌های من ({fa(listings.length)})</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {listings.length > 0 && <button onClick={() => setSelFiles(selFiles.size === listings.length ? new Set() : new Set(listings.map(l => l.id)))} style={actionBtn}>{selFiles.size === listings.length ? 'لغو انتخاب' : 'انتخاب همه'}</button>}
                  <button onClick={openAdd} style={goldBtn}>＋ افزودن فایل</button>
                </div>
              </div>
              {selFiles.size > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <b style={{ color: 'var(--gold)', fontSize: 12.5 }}>{fa(selFiles.size)} انتخاب‌شده</b>
                  <span style={{ flex: 1 }} />
                  <select onChange={e => { if (e.target.value) { bulkFiles('status', e.target.value); e.target.value = '' } }} defaultValue="" style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}>
                    <option value="">تغییر وضعیت…</option><option value="active">فعال</option><option value="sold">فروخته‌شده</option><option value="rented">اجاره‌رفته</option>
                  </select>
                  <button onClick={() => { if (confirm(`${fa(selFiles.size)} فایل حذف شود؟`)) bulkFiles('delete') }} style={{ ...actionBtn, color: '#ef4444', borderColor: '#ef4444' }}>حذف انتخاب‌شده‌ها</button>
                </div>
              )}
            </div>
            {listings.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
                {listings.map(l => (
                  <div key={l.id} style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column', outline: selFiles.has(l.id) ? '2px solid var(--gold)' : 'none' }}>
                    <div style={{ position: 'relative', height: 150, background: 'var(--bg2)' }}>
                      <label style={{ position: 'absolute', top: 8, left: 8, zIndex: 3, width: 26, height: 26, borderRadius: 7, background: 'rgba(20,18,14,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selFiles.has(l.id)} onChange={() => toggleFile(l.id)} style={{ cursor: 'pointer' }} />
                      </label>
                      {(l.status === 'sold' || l.status === 'rented') && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(10,9,7,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(1px)' }}>
                          <div style={{ transform: 'rotate(-9deg)', padding: '7px 22px', borderRadius: 10, background: l.status === 'sold' ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : 'linear-gradient(135deg,#0ea5e9,#0369a1)', color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: '.5px', boxShadow: '0 6px 22px rgba(0,0,0,.5)', border: '2px solid rgba(255,255,255,.85)' }}>
                            {l.status === 'sold' ? '✓ فروش رفت' : '✓ اجاره رفت'}
                          </div>
                        </div>
                      )}
                      {l.images && l.images.length ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.images[0]} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 30 }}>🏠</div>}
                      <span style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                        <Pill label={DEAL_LABEL[l.deal]} color={l.deal === 'sale' ? '#60a5fa' : '#2dd4bf'} />
                        {l.published && <Pill label="🌐 عمومی" color="#34d399" />}
                      </span>
                      {l.images && l.images.length > 1 && <span style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, borderRadius: 7, padding: '2px 8px' }}>📷 {fa(l.images.length)}</span>}
                    </div>
                    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{l.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.ptype} · {[l.city, l.neighborhood].filter(Boolean).join('، ') || l.location || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {l.area ? <span>{fa(l.area)}م</span> : null}{l.rooms ? <span>{fa(l.rooms)} خواب</span> : null}{l.floor ? <span>طبقه {fa(l.floor)}</span> : null}{l.yearBuilt ? <span>ساخت {fa(l.yearBuilt)}</span> : null}{l.deal !== 'rent' && l.price && l.area ? <span>هر متر {money(Math.round(l.price / l.area))}</span> : null}{l.amenities && l.amenities.length ? <span>✓ {fa(l.amenities.length)} امکانات</span> : null}
                      </div>
                      <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 14 }}>{l.deal === 'rent' ? `ودیعه ${money(l.price)}${l.rentMonthly ? ` · اجاره ${money(l.rentMonthly)}` : ''}` : money(l.price)}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 'auto' }}>
                        <select value={l.status} onChange={e => post({ action: 'setListingStatus', id: l.id, status: e.target.value })} style={{ ...actionBtn, cursor: 'pointer', flex: 1, color: LIST_COLOR[l.status], borderColor: LIST_COLOR[l.status] }}>
                          {LIST_STATUSES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{LIST_LABEL[s]}</option>)}
                        </select>
                        <button onClick={() => openEdit(l)} style={actionBtn}>ویرایش</button>
                        <button onClick={() => { if (confirm('این فایل حذف شود؟')) post({ action: 'deleteListing', id: l.id }) }} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                      </div>
                      {l.published && l.publicId && <a href={`/property/${l.publicId}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--gold)', textDecoration: 'none', textAlign: 'center' }}>🌐 مشاهده در سایت ↗</a>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>هنوز فایلی ثبت نکرده‌ای — روی «افزودن فایل» بزن.</div>}
          </div>}

          {/* ARTICLES (CMS) */}
          {view === 'articles' && (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.7 }}>
                مقاله‌ای که با نام شما («{stats.profile.name || 'مشاور'}») منتشر می‌شود، در صفحهٔ مقاله به‌صورت خودکار به آگهی‌های شما لینک می‌شود (سئو).
              </div>
              <ArticleEditor compact author={stats.profile.name || undefined} />
            </div>
          )}

          {/* APPOINTMENTS */}
          {view === 'appts' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('قرار جدید')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مشتری</label><input value={na.client} onChange={e => setNa({ ...na, client: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '2 1 180px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>ملک</label><input value={na.listingTitle} onChange={e => setNa({ ...na, listingTitle: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '0 1 110px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع</label><select value={na.type} onChange={e => setNa({ ...na, type: e.target.value })} style={inputStyle}><option value="visit">بازدید</option><option value="meeting">جلسه</option><option value="call">تماس</option></select></div>
                <div style={{ flex: '1 1 150px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>تاریخ و ساعت</label><JalaliDatePicker value={na.date} onChange={d => setNa({ ...na, date: d })} withTime /></div>
                <button disabled={busy || !na.client.trim() || !na.date.trim()} onClick={async () => { if (await post({ action: 'addAppt', client: na.client.trim(), listingTitle: na.listingTitle, date: na.date.trim(), type: na.type })) setNa({ client: '', listingTitle: '', date: '', type: 'visit' }) }} style={goldBtn}>افزودن</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('قرارها و بازدیدها')}
              {appts.length ? appts.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.client} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>· {APPT_LABEL[a.type]}</span></div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{a.listingTitle || '—'} · {a.date}</div>
                  </div>
                  <Pill label={APPTST_LABEL[a.status]} color={APPTST_COLOR[a.status]} />
                  <select value={a.status} onChange={e => post({ action: 'setApptStatus', id: a.id, status: e.target.value })} style={{ ...actionBtn, cursor: 'pointer' }}>
                    {APPT_STATUSES.map(s => <option key={s} value={s}>{APPTST_LABEL[s]}</option>)}
                  </select>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>قراری نداری.</div>}
            </div>
          </div>}

          {/* CALENDAR */}
          {view === 'calendar' && (() => {
            const first = firstOfJMonth(calOffset)
            const { jy, jm } = jParts(first)
            const lead = (first.getDay() + 1) % 7 // ستونِ شنبه‌محور
            const todayKey = (() => { const t = jParts(new Date()); return `${t.jy}-${t.jm}-${t.jd}` })()
            // نگاشتِ تاریخ → قرارها
            const byDate: Record<string, Appt[]> = {}
            for (const a of appts) { const k = normJDate(a.date); if (k) (byDate[k] = byDate[k] || []).push(a) }
            // سلول‌های ماه
            const cells: ({ d: Date; jd: number } | null)[] = []
            for (let i = 0; i < lead; i++) cells.push(null)
            for (let dd = new Date(first); jParts(dd).jm === jm; dd = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() + 1)) cells.push({ d: new Date(dd), jd: jParts(dd).jd })
            while (cells.length % 7 !== 0) cells.push(null)
            return <div style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{J_MONTHS[jm - 1]} {fa(jy)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setCalOffset(o => o - 1)} style={actionBtn}>→ ماه قبل</button>
                  <button onClick={() => setCalOffset(0)} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>امروز</button>
                  <button onClick={() => setCalOffset(o => o + 1)} style={actionBtn}>ماه بعد ←</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                {J_WEEK.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, padding: '4px 0' }}>{w}</div>)}
                {cells.map((c, i) => {
                  if (!c) return <div key={i} />
                  const key = `${jy}-${jm}-${c.jd}`
                  const dayAppts = byDate[key] || []
                  const isToday = key === todayKey
                  return (
                    <div key={i} style={{ minHeight: 78, borderRadius: 10, border: `1px solid ${isToday ? 'var(--gold)' : 'var(--line)'}`, background: isToday ? 'var(--goldDim)' : 'var(--bg)', padding: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? 'var(--gold)' : 'var(--text)', textAlign: 'left' }}>{fa(c.jd)}</div>
                      {dayAppts.slice(0, 3).map(a => (
                        <div key={a.id} title={`${a.client} · ${APPT_LABEL[a.type]}`} style={{ fontSize: 9.5, lineHeight: 1.5, padding: '1px 5px', borderRadius: 5, background: 'color-mix(in srgb,var(--gold) 18%,transparent)', color: 'var(--gold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.client}</div>
                      ))}
                      {dayAppts.length > 3 && <div style={{ fontSize: 9, color: 'var(--muted)' }}>+{fa(dayAppts.length - 3)}</div>}
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--faint)' }}>قرارهای ثبت‌شده در بخش «قرارها» روی همین تقویم نمایش داده می‌شوند.</div>
            </div>
          })()}

          {/* COMMISSIONS */}
          {view === 'commissions' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('ثبت کمیسیون')}
              {leads.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)', padding: '6px 0' }}>برای ثبت کمیسیون ابتدا باید یک لید/معامله در بخش «لیدها» اضافه کنید.</div>
              ) : (() => {
                const computed = nc.mode === 'percent' ? Math.round((Number(nc.dealAmount) || 0) * (Number(nc.percent) || 0) / 100) : (Number(nc.amount) || 0)
                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '2 1 220px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>معامله (از لیدها)</label>
                      <select value={nc.dealTitle} onChange={e => setNc({ ...nc, dealTitle: e.target.value })} style={inputStyle}>
                        <option value="">— انتخاب لید/معامله —</option>
                        {leads.map(l => { const label = `${l.name}${l.need ? ' — ' + l.need : ''}`; return <option key={l.id} value={label}>{label}</option> })}
                      </select>
                    </div>
                    {/* toggle: درصد / مبلغ ثابت */}
                    <div style={{ display: 'inline-flex', borderRadius: 9, border: '1px solid var(--line2)', overflow: 'hidden' }}>
                      {(['amount', 'percent'] as const).map(m => (
                        <button key={m} onClick={() => setNc({ ...nc, mode: m })} style={{ padding: '9px 16px', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: nc.mode === m ? 700 : 500, background: nc.mode === m ? 'var(--gold)' : 'transparent', color: nc.mode === m ? '#16140f' : 'var(--muted)' }}>{m === 'amount' ? 'مبلغ ثابت' : 'درصدی'}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {nc.mode === 'amount' ? (
                      <div style={{ flex: '1 1 200px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مبلغ کمیسیون (تومان)</label><NumberInput value={nc.amount} onChange={v => setNc({ ...nc, amount: v })} style={inputStyle} /></div>
                    ) : <>
                      <div style={{ flex: '1 1 160px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مبلغ معامله (تومان)</label><NumberInput value={nc.dealAmount} onChange={v => setNc({ ...nc, dealAmount: v })} style={inputStyle} /></div>
                      <div style={{ flex: '0 1 110px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>درصد کمیسیون</label><input value={nc.percent} onChange={e => setNc({ ...nc, percent: e.target.value.replace(/[^\d.]/g, '') })} placeholder="مثلاً ۲" style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} /></div>
                      <div style={{ flex: '1 1 150px', fontSize: 12, color: 'var(--muted)', paddingBottom: 9 }}>کمیسیون: <b style={{ color: 'var(--gold)' }}>{money(computed)}</b></div>
                    </>}
                    <button disabled={busy || !nc.dealTitle.trim() || computed <= 0} onClick={async () => {
                      const ok = await post({ action: 'addCommission', dealTitle: nc.dealTitle.trim(), amount: nc.mode === 'amount' ? (Number(nc.amount) || 0) : 0, percent: nc.mode === 'percent' ? (Number(nc.percent) || 0) : undefined, dealAmount: nc.mode === 'percent' ? (Number(nc.dealAmount) || 0) : undefined })
                      if (ok) setNc({ dealTitle: '', mode: nc.mode, amount: '', percent: '', dealAmount: '' })
                    }} style={goldBtn}>افزودن</button>
                  </div>
                </div>
                )
              })()}
            </div>
            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>کمیسیون‌ها</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>در انتظار: <b style={{ color: 'var(--gold)' }}>{money(stats.kpis.pendingCommission)}</b> · پرداخت‌شده: <b style={{ color: '#34d399' }}>{money(stats.kpis.paidCommission)}</b></div>
              </div>
              {commissions.length ? commissions.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.dealTitle}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{c.date}{c.percent ? ` · ${fa(c.percent)}٪ از ${money(c.dealAmount || 0)}` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 14 }}>{money(c.amount)}</div>
                  {c.status === 'pending'
                    ? <button onClick={() => post({ action: 'setCommissionStatus', id: c.id, status: 'paid' })} style={{ ...actionBtn, color: '#34d399', borderColor: '#34d399' }}>علامت پرداخت</button>
                    : <Pill label="پرداخت‌شده" color="#34d399" />}
                  <button onClick={() => post({ action: 'deleteCommission', id: c.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>کمیسیونی ثبت نشده.</div>}
            </div>
          </div>}

          {/* AGENCY — آژانس من */}
          {view === 'agency' && (() => {
            const md = agencyData
            const membership = md?.membership || null
            const requests = md?.requests || []
            const agencies = md?.agencies || []
            const invites = requests.filter(r => r.initiator === 'agency' && r.status === 'pending')
            const outgoing = requests.filter(r => r.initiator === 'advisor' && r.status === 'pending')
            const pendingPhones = new Set(outgoing.map(r => r.agencyPhone))
            const aq = agencySearch.trim()
            const agenciesF = aq ? agencies.filter(a => (a.name + ' ' + (a.branches || '')).includes(aq)) : agencies
            return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
                با عضویت در یک آژانس، نام آژانس روی پروفایل عمومی شما نمایش داده می‌شود و فایل‌های شما به آژانس متصل می‌شوند.
              </div>

              {/* عضویت فعلی */}
              {membership ? (
                <div style={{ ...card, padding: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 28 }}>🏢</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>آژانس شما</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{membership.agencyName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>عضو از {faDate(membership.since)}</div>
                  </div>
                  <button disabled={busy} onClick={() => { if (confirm('از این آژانس خارج می‌شوید؟')) agencyPost({ action: 'leave' }) }} style={{ ...actionBtn, color: '#ef4444', borderColor: '#ef4444', padding: '8px 16px' }}>خروج از آژانس</button>
                </div>
              ) : (
                <div style={{ ...card, padding: '16px 18px', fontSize: 13, color: 'var(--muted)' }}>هنوز عضو هیچ آژانسی نیستید. از فهرست زیر یک آژانس انتخاب و درخواست عضویت ارسال کنید.</div>
              )}

              {/* دعوت‌های دریافتی */}
              {invites.length > 0 && (
                <div style={{ ...card, padding: 18 }}>
                  {sectionTitle('دعوت‌های دریافتی')}
                  {invites.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.agencyName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>شما را به عضویت دعوت کرده است · {faDate(r.createdAt)}</div>
                      </div>
                      <button disabled={busy} onClick={() => agencyPost({ action: 'respond', id: r.id, accept: true })} style={{ ...actionBtn, color: '#34d399', borderColor: '#34d399' }}>پذیرش</button>
                      <button disabled={busy} onClick={() => agencyPost({ action: 'respond', id: r.id, accept: false })} style={{ ...actionBtn, color: '#ef4444' }}>رد</button>
                    </div>
                  ))}
                </div>
              )}

              {/* درخواست‌های ارسالی */}
              {outgoing.length > 0 && (
                <div style={{ ...card, padding: 18 }}>
                  {sectionTitle('درخواست‌های ارسالی')}
                  {outgoing.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>در انتظار تأیید آژانس {r.agencyName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{faDate(r.createdAt)}</div>
                      </div>
                      <Pill label="در انتظار" color="var(--gold)" />
                      <button disabled={busy} onClick={() => agencyPost({ action: 'cancel', id: r.id })} style={{ ...actionBtn, color: '#ef4444' }}>لغو</button>
                    </div>
                  ))}
                </div>
              )}

              {/* فهرست آژانس‌ها */}
              {!membership && (
                <div style={{ ...card, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>آژانس‌ها ({fa(agencies.length)})</div>
                    <input value={agencySearch} onChange={e => setAgencySearch(e.target.value)} placeholder="جستجوی آژانس…" style={{ ...inputStyle, width: 220, maxWidth: '50vw' }} />
                  </div>
                  {agenciesF.length ? agenciesF.map(a => {
                    const pending = pendingPhones.has(a.phone)
                    return (
                      <div key={a.phone} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.name}</div>
                          {a.branches && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{a.branches}</div>}
                        </div>
                        <button disabled={busy || pending} onClick={() => agencyPost({ action: 'requestJoin', agencyPhone: a.phone })} style={{ ...goldBtn, padding: '7px 16px', opacity: pending ? 0.5 : 1, cursor: pending ? 'default' : 'pointer' }}>{pending ? 'ارسال‌شده' : 'درخواست عضویت'}</button>
                      </div>
                    )
                  }) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>{aq ? 'آژانسی با این نام پیدا نشد.' : 'فعلاً آژانسی برای نمایش وجود ندارد.'}</div>}
                </div>
              )}
            </div>
          })()}

          {/* PLANS */}
          {view === 'plans' && <PlansPanel dashboard="/pros" />}

          {/* PROFILE */}
          {view === 'profile' && <BusinessProfileForm />}

          {/* SETTINGS */}
          {view === 'settings' && <div style={{ ...card, padding: 18, maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>پروفایل عمومی مشاور</div>
              {myPhone && <a href={`/profile/${myPhone}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--gold)', textDecoration: 'none' }}>مشاهدهٔ پروفایل عمومی ↗</a>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.7 }}>این اطلاعات روی صفحهٔ عمومی شما نمایش داده می‌شود.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* عکس پروفایل */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {prof.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={prof.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 26, color: 'var(--faint)' }}>👤</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ ...actionBtn, cursor: 'pointer', display: 'inline-block' }}>
                    <input type="file" accept="image/*" onChange={e => uploadProfilePhoto(e.target.files)} style={{ display: 'none' }} />
                    {profUploading ? 'در حال آپلود…' : 'انتخاب عکس'}
                  </label>
                  {prof.photo && <button onClick={() => setProf({ ...prof, photo: '' })} style={{ ...actionBtn, color: '#ef4444' }}>حذف عکس</button>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام و نام خانوادگی</label><input value={prof.name} onChange={e => setProf({ ...prof, name: e.target.value })} placeholder="مثلاً امین نائینی" style={inputStyle} /></div>
                <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>عنوان شغلی</label><input value={prof.title} onChange={e => setProf({ ...prof, title: e.target.value })} placeholder="مثلاً مشاور ارشد املاک" style={inputStyle} /></div>
              </div>
              {/* آژانس — خودکار از عضویت (اگر عضو آژانسی باشید) */}
              {agencyData?.membership && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 9, background: 'var(--goldDim)', border: '1px solid var(--gold)', fontSize: 12.5 }}>
                  <span>🏢</span><span style={{ color: 'var(--muted)' }}>آژانس شما:</span><b style={{ color: 'var(--gold)' }}>{agencyData.membership.agencyName}</b>
                  <span style={{ flex: 1 }} /><span style={{ fontSize: 11, color: 'var(--faint)' }}>از «آژانس من» قابل تغییر است</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>تلفن تماس</label><input value={prof.phone} onChange={e => setProf({ ...prof, phone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} /></div>
                <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>سابقه</label><input value={prof.experience} onChange={e => setProf({ ...prof, experience: e.target.value })} placeholder="مثلاً ۸ سال" style={inputStyle} /></div>
              </div>
              {/* مناطق فعالیت — از لیست استان/شهر/محلهٔ سایت (برای نمایش مشاور در همان محله‌ها) */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>مناطق فعالیت (محله‌ها)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 6 }}>
                  <select value={areaSel.province} onChange={e => setAreaSel({ province: e.target.value, city: '', district: '', neighborhood: '' })} style={inputStyle}><option value="">استان…</option>{geo.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select>
                  <select value={areaSel.city} onChange={e => setAreaSel({ ...areaSel, city: e.target.value, district: '', neighborhood: '' })} disabled={!areaSel.province} style={inputStyle}><option value="">شهر…</option>{(aProv?.cities || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                  <select value={areaSel.district} onChange={e => setAreaSel({ ...areaSel, district: e.target.value, neighborhood: '' })} disabled={!areaSel.city} style={inputStyle}><option value="">منطقه…</option>{(aCity?.districts || []).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={areaSel.neighborhood} onChange={e => setAreaSel({ ...areaSel, neighborhood: e.target.value })} disabled={!areaSel.district} style={{ ...inputStyle, flex: 1 }}><option value="">محله…</option>{(aDist?.neighborhoods || []).map(n => <option key={n} value={n}>{n}</option>)}</select>
                    <button onClick={() => { if (areaSel.neighborhood) { addArea(areaSel.neighborhood); setAreaSel({ ...areaSel, neighborhood: '' }) } }} disabled={!areaSel.neighborhood} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)', flexShrink: 0 }}>افزودن</button>
                  </div>
                </div>
                {areaList.length > 0 && <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
                  {areaList.map(a => <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, fontSize: 12.5, background: 'var(--goldDim)', color: 'var(--gold)', fontWeight: 600 }}>📍 {a}<button onClick={() => removeArea(a)} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13, padding: 0 }}>✕</button></span>)}
                </div>}
              </div>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>دربارهٔ من</label><textarea value={prof.bio} onChange={e => setProf({ ...prof, bio: e.target.value })} rows={4} placeholder="معرفی کوتاه از خودتان…" style={{ ...inputStyle, resize: 'vertical' }} /></div>
              {/* تخصص‌ها — chips */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>تخصص‌ها</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                  {prof.specialties.map(s => (
                    <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, fontSize: 12.5, background: 'var(--goldDim)', color: 'var(--gold)', fontWeight: 600 }}>
                      {s}
                      <button onClick={() => setProf(p => ({ ...p, specialties: p.specialties.filter(x => x !== s) }))} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
                    </span>
                  ))}
                  <input
                    value={specInput}
                    onChange={e => setSpecInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSpecialty(specInput.replace(/,$/, '')) } }}
                    onBlur={() => addSpecialty(specInput)}
                    placeholder="افزودن… (Enter یا ،)"
                    style={{ ...inputStyle, width: 180, flex: '0 1 180px' }}
                  />
                </div>
              </div>
              <button disabled={busy} onClick={() => post({ action: 'updateProfile', patch: { name: prof.name, title: prof.title, bio: prof.bio, phone: prof.phone, areas: prof.areas, experience: prof.experience, photo: prof.photo, specialties: prof.specialties } })} style={{ ...goldBtn, alignSelf: 'flex-start', padding: '9px 22px' }}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
            </div>
          </div>}

          {/* ───── DIVAR IMPORT ───── */}
          {view === 'divar' && <DivarImport onChange={refresh} />}
          </>}
        </main>
      </div>

      {/* اخطارِ آگهیِ تکراری (تشخیصِ هوش مصنوعی) */}
      {dupWarn && (
        <div onClick={() => setDupWarn('')} style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 200, maxWidth: 540, background: 'linear-gradient(135deg,#3a2a12,#2a1f0e)', border: '1px solid #f59e0b', color: '#fde68a', padding: '13px 18px', borderRadius: 12, fontSize: 13, lineHeight: 1.9, cursor: 'pointer', boxShadow: '0 8px 30px rgba(0,0,0,.5)', fontFamily: FONT }}>
          {dupWarn} <span style={{ color: '#f59e0b', fontWeight: 700 }}>(بستن)</span>
        </div>
      )}

      {/* ───── ADD/EDIT LISTING MODAL ───── */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: 'min(720px, 100%)', padding: 0, margin: 'auto' }}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--surface)', borderRadius: '16px 16px 0 0', zIndex: 2 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{editingId ? 'ویرایش فایل' : 'افزودن فایل جدید'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: '1px solid var(--line2)', color: 'var(--muted)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15 }}>✕</button>
            </div>

            {/* step indicator */}
            <div style={{ display: 'flex', gap: 6, padding: '12px 20px', borderBottom: '1px solid var(--line)', overflowX: 'auto' }}>
              {STEPS.map((s, i) => (
                <button key={s} onClick={() => { if (i < step || form.title.trim()) setStep(i) }} style={{ flex: 1, minWidth: 80, display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 9, border: 'none', cursor: 'pointer', background: i === step ? 'var(--goldDim)' : 'transparent', fontFamily: FONT }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: i <= step ? 'linear-gradient(135deg,var(--gold2),var(--gold))' : 'var(--line2)', color: i <= step ? '#16140f' : 'var(--muted)' }}>{i < step ? '✓' : fa(i + 1)}</span>
                  <span style={{ fontSize: 11.5, fontWeight: i === step ? 700 : 500, color: i === step ? 'var(--gold)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{s}</span>
                </button>
              ))}
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 240 }}>
              {/* STEP 0 — type */}
              {step === 0 && <>
                <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>عنوان فایل *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="مثلاً آپارتمان ۱۲۰ متری نوساز زعفرانیه" style={inputStyle} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع ملک</label><select value={form.ptype} onChange={e => setForm({ ...form, ptype: e.target.value })} style={inputStyle}>{PTYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع معامله</label><select value={form.deal} onChange={e => setForm({ ...form, deal: e.target.value as 'sale' | 'rent' })} style={inputStyle}><option value="sale">فروش</option><option value="rent">اجاره/رهن</option></select></div>
                </div>
              </>}

              {/* STEP 1 — location + map */}
              {step === 1 && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>استان</label><select value={form.province} onChange={e => setForm({ ...form, province: e.target.value, city: '', district: '', neighborhood: '' })} style={inputStyle}><option value="">انتخاب…</option>{geo.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>شهر</label><select value={form.city} onChange={e => setForm({ ...form, city: e.target.value, district: '', neighborhood: '' })} disabled={!form.province} style={inputStyle}><option value="">انتخاب…</option>{(gProvince?.cities || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>منطقه</label><select value={form.district} onChange={e => setForm({ ...form, district: e.target.value, neighborhood: '' })} disabled={!form.city} style={inputStyle}><option value="">انتخاب…</option>{(gCity?.districts || []).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>محله</label><select value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} disabled={!form.district} style={inputStyle}><option value="">انتخاب…</option>{(gDistrict?.neighborhoods || []).map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                </div>
                <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>آدرس دقیق</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="خیابان، کوچه، پلاک…" style={inputStyle} /></div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>موقعیت روی نقشه — روی محل ملک بزنید (محله خودکار تشخیص داده می‌شود)</label>
                  <LocationPicker lat={form.lat} lng={form.lng} onPick={r => setForm(f => ({ ...f, lat: r.lat, lng: r.lng, neighborhood: r.neighbourhood || f.neighborhood, city: r.city && !f.city ? r.city : f.city, address: r.address || f.address }))} />
                </div>
              </>}

              {/* STEP 2 — specs */}
              {step === 2 && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>{form.deal === 'rent' ? 'ودیعه/رهن (تومان)' : 'قیمت کل (تومان)'}</label><NumberInput value={form.price} onChange={v => setForm({ ...form, price: v })} style={inputStyle} /></div>
                  {form.deal === 'rent' ? <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>اجاره ماهانه (تومان)</label><NumberInput value={form.rentMonthly} onChange={v => setForm({ ...form, rentMonthly: v })} style={inputStyle} /></div> : <div />}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 12 }}>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>متراژ</label><input value={form.area} onChange={e => setForm({ ...form, area: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>تعداد خواب</label><input value={form.rooms} onChange={e => setForm({ ...form, rooms: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>طبقه</label><input value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>کل طبقات</label><input value={form.totalFloors} onChange={e => setForm({ ...form, totalFloors: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>سال ساخت</label><input value={form.yearBuilt} onChange={e => setForm({ ...form, yearBuilt: e.target.value.replace(/\D/g, '') })} placeholder="۱۴۰۲" style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>جهت</label><select value={form.facing} onChange={e => setForm({ ...form, facing: e.target.value })} style={inputStyle}><option value="">—</option>{FACING_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع سند</label><input value={form.docType} onChange={e => setForm({ ...form, docType: e.target.value })} placeholder="تک‌برگ" style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>تلفن تماس</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} /></div>
                </div>
              </>}

              {/* STEP 3 — amenities + images + publish */}
              {step === 3 && <>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>عکس‌های ملک (حداکثر ۱۲)</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {form.images.map((img, i) => (
                      <div key={i} style={{ position: 'relative', width: 84, height: 84, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))} style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(0,0,0,.65)', color: '#fff', border: 'none', borderRadius: 6, width: 20, height: 20, cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>✕</button>
                        {i === 0 && <span style={{ position: 'absolute', bottom: 0, right: 0, left: 0, background: 'var(--gold)', color: '#16140f', fontSize: 9, fontWeight: 800, textAlign: 'center', padding: '1px 0' }}>کاور</span>}
                      </div>
                    ))}
                    {form.images.length < 12 && (
                      <label style={{ width: 84, height: 84, borderRadius: 10, border: '1px dashed var(--line2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: 'var(--muted)', fontSize: 11 }}>
                        <input type="file" accept="image/*" multiple onChange={e => uploadImages(e.target.files)} style={{ display: 'none' }} />
                        <span style={{ fontSize: 22 }}>{uploading ? '⏳' : '＋'}</span>
                        {uploading ? 'آپلود…' : 'عکس'}
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>امکانات ({fa(form.amenities.length)} انتخاب‌شده)</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {AMENITIES.map(a => {
                      const on = form.amenities.includes(a)
                      return <button key={a} type="button" onClick={() => toggleAmenity(a)} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT, border: `1px solid ${on ? 'var(--gold)' : 'var(--line2)'}`, background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500 }}>{on ? '✓ ' : ''}{a}</button>
                    })}
                  </div>
                </div>
                <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>توضیحات</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="توضیحات کامل ملک…" style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, cursor: 'pointer', background: form.publish ? 'var(--goldDim)' : 'var(--bg2)', border: `1px solid ${form.publish ? 'var(--gold)' : 'var(--line)'}` }}>
                  <input type="checkbox" checked={form.publish} onChange={e => setForm({ ...form, publish: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--gold)', cursor: 'pointer' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: form.publish ? 'var(--gold)' : 'var(--text)' }}>🌐 انتشار عمومی روی سایت ملک‌جت</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.6 }}>به‌صورت آگهی عمومی در جستجوی سایت دیده می‌شود. هر زمان می‌توانی خاموشش کنی.</div>
                  </div>
                </label>
              </>}
            </div>

            {/* footer */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--line)', position: 'sticky', bottom: 0, background: 'var(--surface)', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => step === 0 ? setShowForm(false) : setStep(step - 1)} style={{ ...actionBtn, padding: '10px 22px' }}>{step === 0 ? 'انصراف' : '→ قبلی'}</button>
              {step < STEPS.length - 1
                ? <button onClick={() => { if (step === 0 && !form.title.trim()) { alert('عنوان فایل الزامی است'); return } setStep(step + 1) }} style={{ ...goldBtn, padding: '10px 26px' }}>بعدی ←</button>
                : <button disabled={busy || uploading || !form.title.trim()} onClick={saveListing} style={{ ...goldBtn, padding: '10px 26px', opacity: busy || uploading || !form.title.trim() ? .6 : 1 }}>{busy ? 'در حال ذخیره…' : editingId ? 'ذخیرهٔ تغییرات' : 'ثبت فایل'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
