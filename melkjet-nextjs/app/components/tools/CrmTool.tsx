'use client'
import { useState, useEffect } from 'react'
import { fetchContent, type ContentItem } from '@/app/lib/content-display'
import PanelReturnBar from '@/app/components/PanelReturnBar'

export type CrmView = 'dashboard' | 'listings' | 'pipeline' | 'deals' | 'contacts' | 'tasks' | 'calendar' | 'reports'

// Sidebar nav entries (one per view). Persian labels match the standalone /crm sidebar.
// NOTE: labels here are the *generic* defaults; the active role config (ROLE_CRM) overrides
// per role via viewLabel() so the same view reads correctly for every dashboard type.
export const CRM_VIEWS: { id: CrmView; label: string; icon: string }[] = [
  { id: 'dashboard', icon: '◈', label: 'داشبورد' },
  { id: 'listings', icon: '◰', label: 'فایل‌ها' },
  { id: 'pipeline', icon: '◴', label: 'پایپ‌لاین CRM' },
  { id: 'deals', icon: '◈', label: 'قراردادها' },
  { id: 'contacts', icon: '☎', label: 'مخاطبین' },
  { id: 'tasks', icon: '✓', label: 'وظایف' },
  { id: 'calendar', icon: '◫', label: 'تقویم' },
  { id: 'reports', icon: '▤', label: 'گزارش‌ها' },
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

// Mirrors app/lib/leads-store.ts Lead (the API shape). سوپرمجموعهٔ شناسه‌ها (املاک ۷مرحله‌ای + کلاسیک ۵مرحله‌ای).
type Stage = 'new' | 'contacted' | 'sent' | 'visited' | 'negotiation' | 'review' | 'offered' | 'contract' | 'won' | 'lost'
type LeadStatus = 'new' | 'hot' | 'cold' | 'lost' | 'converted'
interface Activity { id: string; type: string; at: number; note?: string; meta?: Record<string, any> }
interface Lead {
  id: string
  name: string
  phone?: string
  need?: string
  budget?: string
  budgetText?: string
  region?: string
  area?: number
  dealType?: 'sale' | 'rent' | ''
  stage: Stage
  status?: LeadStatus
  score?: number
  tags?: string[]
  autoTags?: string[]
  listingIds?: string[]
  activities?: Activity[]
  note?: string
  lastActivityAt?: number
  createdAt: number
  updatedAt: number
}
const STATUS_META: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'جدید', color: '#7a8fae' }, hot: { label: 'داغ', color: '#e74c3c' },
  cold: { label: 'سرد', color: '#5a6b82' }, lost: { label: 'ازدست‌رفته', color: '#8a8a8a' },
  converted: { label: 'تبدیل‌شده', color: '#5fd98a' },
}
const ACT_ICON: Record<string, string> = { created: '✚', call: '☎', visit: '⚑', message: '✉', sms: '✉', email: '✉', whatsapp: '✆', click: '☞', note: '✎', stage: '⇄', match: '⌂' }
const ACT_LABEL: Record<string, string> = { created: 'ایجاد', call: 'تماس', visit: 'بازدید', message: 'پیام', sms: 'پیامک', email: 'ایمیل', whatsapp: 'واتساپ', click: 'کلیک', note: 'یادداشت', stage: 'تغییر مرحله', match: 'تطبیق' }

const navItems = CRM_VIEWS

const J_MON = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

// ─────────────────────────────────────────────────────────────────────────────
// Role-adaptive CRM configuration.
// The whole CRM (terminology + pipeline stage labels + per-view labels) adapts to
// the user's role, keyed by their dashboard path (from /api/auth/profile → dash).
// The 5 backend stage ids (new|review|offered|contract|lost) NEVER change — only
// their displayed labels do — so the leads backend is untouched.
// ─────────────────────────────────────────────────────────────────────────────
// ترتیبِ پیش‌فرض (نقش‌های غیرِ‌املاک): ۵ مرحلهٔ کلاسیک.
const STAGE_ORDER: Stage[] = ['new', 'review', 'offered', 'contract', 'lost']
// ترتیبِ املاک (بلوپرینتِ مشاور): ۷ مرحله + ازدست‌رفته.
const REALESTATE_ORDER: Stage[] = ['new', 'contacted', 'sent', 'visited', 'negotiation', 'contract', 'won', 'lost']
const STAGE_COLORS: Record<Stage, string> = {
  new: '#7a8fae', contacted: '#e7a14a', sent: '#d6b24a', visited: '#c9a84c', negotiation: '#b98fd6',
  review: '#e7a14a', offered: 'var(--gold)', contract: '#5ac88a', won: '#5fd98a', lost: '#e74c3c',
}
// برچسبِ پیش‌فرضِ هر شناسه (اگر نقش برچسبِ اختصاصی ندهد).
const STAGE_LABEL_DEFAULT: Record<Stage, string> = {
  new: 'لید جدید', contacted: 'تماس', sent: 'ارسال فایل', visited: 'بازدید', negotiation: 'مذاکره',
  review: 'در حال بررسی', offered: 'پیشنهاد', contract: 'قرارداد', won: 'فروش', lost: 'ازدست‌رفته',
}
// نگاشتِ لیدهای قدیمی (۵مرحله‌ای) به ستون‌های نقشِ املاک وقتی ستونِ همان شناسه وجود ندارد.
const STAGE_FALLBACK: Record<string, Stage[]> = {
  review: ['contacted', 'visited'], offered: ['sent', 'negotiation'], contract: ['contract', 'won'],
  contacted: ['review'], sent: ['offered'], visited: ['review'], negotiation: ['offered'], won: ['contract'],
}

interface RoleCrmCfg {
  leadWord: string
  leadsWord: string
  needLabel: string
  budgetLabel: string
  pipelineLabel: string
  dealWord: string
  dealsWord: string
  stageOrder?: Stage[]                       // ستون‌های این نقش (اگر نبود، STAGE_ORDER)
  stages?: Partial<Record<Stage, string>>    // برچسبِ اختصاصیِ مرحله‌ها
  viewLabels: Partial<Record<CrmView, string>>
}

// Default (generic) — pipelineِ ۷مرحله‌ایِ املاک.
const DEFAULT_CRM: RoleCrmCfg = {
  leadWord: 'لید', leadsWord: 'لیدها', needLabel: 'نیاز', budgetLabel: 'بودجه',
  pipelineLabel: 'پایپ‌لاین CRM', dealWord: 'قرارداد', dealsWord: 'قراردادها',
  stageOrder: REALESTATE_ORDER, viewLabels: { listings: 'فایل‌ها' },
}

const REALESTATE_CRM: RoleCrmCfg = {
  leadWord: 'مشتری', leadsWord: 'مشتریان', needLabel: 'نیاز', budgetLabel: 'بودجه',
  pipelineLabel: 'پایپ‌لاین CRM', dealWord: 'قرارداد', dealsWord: 'قراردادها',
  stageOrder: REALESTATE_ORDER, viewLabels: { listings: 'فایل‌ها' },
}

const LEGAL_CRM: RoleCrmCfg = {
  leadWord: 'موکل', leadsWord: 'موکلان', needLabel: 'موضوعِ پرونده', budgetLabel: 'حق‌الوکاله',
  pipelineLabel: 'روندِ پرونده', dealWord: 'پرونده', dealsWord: 'پرونده‌ها',
  stages: { new: 'تماسِ اولیه', review: 'بررسیِ پرونده', offered: 'تنظیمِ لایحه', contract: 'پروندهٔ فعال', lost: 'منتفی' },
  viewLabels: { listings: 'پرونده‌ها' },
}

const ROLE_CRM: Record<string, RoleCrmCfg> = {
  '/pros': REALESTATE_CRM,
  '/agency': REALESTATE_CRM,
  '/buyer': {
    leadWord: 'مخاطب', leadsWord: 'مخاطبان', needLabel: 'نیاز', budgetLabel: 'بودجه',
    pipelineLabel: 'پیگیری‌ها', dealWord: 'معامله', dealsWord: 'معاملات',
    stageOrder: REALESTATE_ORDER, viewLabels: { listings: 'ملک‌های موردنظر' },
  },
  '/builder': {
    leadWord: 'خریدار', leadsWord: 'خریداران', needLabel: 'واحدِ موردنیاز', budgetLabel: 'بودجه',
    pipelineLabel: 'قیفِ فروش', dealWord: 'فروش', dealsWord: 'فروش‌ها',
    stages: { new: 'سرنخ', review: 'بازدید', offered: 'پیش‌قرارداد', contract: 'فروش', lost: 'منتفی' },
    viewLabels: { listings: 'واحدها' },
  },
  '/materials': {
    leadWord: 'مشتری', leadsWord: 'مشتریان', needLabel: 'محصولِ موردنیاز', budgetLabel: 'مبلغِ سفارش',
    pipelineLabel: 'قیفِ فروش', dealWord: 'سفارش', dealsWord: 'سفارش‌ها',
    stages: { new: 'استعلامِ جدید', review: 'پیش‌فاکتور', offered: 'مذاکره', contract: 'سفارشِ قطعی', lost: 'لغوشده' },
    viewLabels: { listings: 'مشتریان', tasks: 'کارها و پیگیری' },
  },
  '/architect': {
    leadWord: 'کارفرما', leadsWord: 'کارفرمایان', needLabel: 'نوعِ پروژه', budgetLabel: 'برآوردِ هزینه',
    pipelineLabel: 'روندِ پروژه', dealWord: 'قرارداد', dealsWord: 'قراردادها',
    stages: { new: 'سرنخ', review: 'مشاوره', offered: 'پیشنهادِ قیمت', contract: 'قرارداد', lost: 'منتفی' },
    viewLabels: { listings: 'پروژه‌ها' },
  },
  '/contractor': {
    leadWord: 'کارفرما', leadsWord: 'کارفرمایان', needLabel: 'شرحِ کار', budgetLabel: 'مبلغِ برآورد',
    pipelineLabel: 'روندِ پروژه', dealWord: 'قرارداد', dealsWord: 'قراردادها',
    stages: { new: 'سرنخ', review: 'مشاوره', offered: 'پیشنهادِ قیمت', contract: 'قرارداد', lost: 'منتفی' },
    viewLabels: { listings: 'پروژه‌ها' },
  },
  '/appraiser': {
    leadWord: 'متقاضی', leadsWord: 'متقاضیان', needLabel: 'نوعِ ملک', budgetLabel: 'ارزشِ برآوردی',
    pipelineLabel: 'روندِ کارشناسی', dealWord: 'گزارش', dealsWord: 'گزارش‌ها',
    stages: { new: 'درخواستِ جدید', review: 'بازدید', offered: 'کارشناسی', contract: 'گزارش صادر', lost: 'منتفی' },
    viewLabels: { listings: 'درخواست‌ها' },
  },
  '/lawfirm': LEGAL_CRM,
  '/legal': LEGAL_CRM,
  '/finance': {
    leadWord: 'متقاضی', leadsWord: 'متقاضیان', needLabel: 'نوعِ خدمت', budgetLabel: 'مبلغِ تسهیلات',
    pipelineLabel: 'روندِ درخواست', dealWord: 'تسهیلات', dealsWord: 'تسهیلات',
    stages: { new: 'درخواستِ جدید', review: 'در حالِ بررسی', offered: 'پیش‌تأیید', contract: 'تأییدشده', lost: 'رد' },
    viewLabels: { listings: 'درخواست‌ها' },
  },
  '/notary': {
    leadWord: 'مراجع', leadsWord: 'مراجعان', needLabel: 'نوعِ خدمت', budgetLabel: 'مبلغِ سند',
    pipelineLabel: 'روندِ نوبت', dealWord: 'سند', dealsWord: 'اسناد',
    stages: { new: 'نوبتِ جدید', review: 'در انتظارِ مدارک', offered: 'آماده', contract: 'تنظیم‌شده', lost: 'لغو' },
    viewLabels: { listings: 'مراجعان' },
  },
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

export default function CrmTool({ embedded = false, view: viewProp, onView, ownListings, leads: leadRefs, onAddListing, onEditListing, onDeleteListing, onPromoteListing, onSetListingStatus, onBulkDelete, onBulkStatus, onLinkLeads }: {
  embedded?: boolean; view?: CrmView; onView?: (v: CrmView) => void
  // وقتی این‌ها داده شوند، نمای «فایل‌ها» فایل‌های واقعیِ خودِ کاربر را نشان می‌دهد (نه آگهی‌های سراسری).
  ownListings?: CrmOwnListing[]
  leads?: CrmLeadRef[]
  onAddListing?: () => void
  onEditListing?: (id: string) => void
  onDeleteListing?: (id: string) => void
  // پروموتِ آگهیِ منتشرشده از رویِ خودِ آگهی (فقط برای آگهی‌های دارای publicId).
  onPromoteListing?: (listing: CrmOwnListing) => void
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

  // ── سازگاریِ کاملِ CRM با نقشِ کاربر (ROLE_CRM) — بر اساسِ داشبوردِ پروفایل ──
  const [role, setRole] = useState<string>('')
  const [me, setMe] = useState<{ name: string; roleLabel: string }>({ name: '', roleLabel: '' })
  useEffect(() => { fetch('/api/auth/profile').then(r => r.ok ? r.json() : null).then(d => { setRole(d?.dash || ''); setMe({ name: d?.name || d?.account?.name || '', roleLabel: d?.account?.role || '' }) }).catch(() => {}) }, [])
  const cfg = ROLE_CRM[role] || DEFAULT_CRM
  const isMat = role === '/materials'
  const order: Stage[] = cfg.stageOrder || STAGE_ORDER
  const stages: { id: Stage; label: string; color: string }[] = order.map(id => ({ id, label: cfg.stages?.[id] ?? STAGE_LABEL_DEFAULT[id], color: STAGE_COLORS[id] }))
  // شناسهٔ ذخیره‌شدهٔ لید را به ستونی که در این نقش وجود دارد نگاشت می‌کند (سازگاریِ داده‌های قدیمی).
  const colOf = (s: Stage): Stage => {
    if (order.includes(s)) return s
    for (const alt of (STAGE_FALLBACK[s] || [])) if (order.includes(alt)) return alt
    return order[0]
  }
  const isWonStage = (s: Stage) => s === 'contract' || s === 'won'
  const wonLabel = (stages.find(s => s.id === 'won') || stages.find(s => s.id === 'contract'))?.label || cfg.dealWord
  const viewLabel = (v: CrmView): string => {
    if (v === 'pipeline') return cfg.pipelineLabel
    if (v === 'deals') return cfg.dealsWord
    return cfg.viewLabels[v] ?? (CRM_VIEWS.find(x => x.id === v)?.label || v)
  }
  const needLabel = cfg.needLabel
  const budgetLabel = cfg.budgetLabel
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
  const [salesStats, setSalesStats] = useState<{ conversionRate: number; revenue: number; avgScore: number; needFollowUp: number; activities7d: number } | null>(null)
  const [followUp, setFollowUp] = useState<{ id: string; name: string; phone?: string; stage: Stage; score?: number }[]>([])
  const [crmSettings, setCrmSettings] = useState<{ autoWelcomeSms: boolean; welcomeTemplate: string; followUpHours: number } | null>(null)
  const [nextCall, setNextCall] = useState<{ leads?: any[]; advice?: string } | null>(null)
  const [nextCallBusy, setNextCallBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Real neighbourhood growth for the dashboard insights card.
  const [growth, setGrowth] = useState<number | null>(null)

  // AI assistant modal state.
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiReply, setAiReply] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Contact book (مخاطبین) — real /api/contacts data.
  const [contacts, setContacts] = useState<{ id: string; name?: string; phone?: string; email?: string; groups?: string[] }[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [cForm, setCForm] = useState<{ name: string; phone: string; email: string }>({ name: '', phone: '', email: '' })

  // Load persisted tasks on mount.
  useEffect(() => {
    fetch('/api/crm/tasks')
      .then(r => r.ok ? r.json() : { tasks: [] })
      .then(d => setTasks(Array.isArray(d.tasks) ? d.tasks : []))
      .catch(() => {})
  }, [])

  // Load real CRM leads on mount.
  const loadLeadsStats = () => {
    fetch('/api/crm/leads?analytics=1')
      .then(r => r.ok ? r.json() : { leads: [] })
      .then(d => { setLeads(Array.isArray(d.leads) ? d.leads : []); if (d.analytics) setSalesStats(d.analytics); if (d.followUp) setFollowUp(d.followUp) })
      .catch(() => {})
  }
  useEffect(() => { loadLeadsStats() }, [])
  useEffect(() => { fetch('/api/crm/settings').then(r => r.ok ? r.json() : null).then(d => { if (d?.settings) setCrmSettings(d.settings) }).catch(() => {}) }, [])

  // Load the marketing contact book on mount.
  useEffect(() => {
    fetch('/api/contacts')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d.contacts)) setContacts(d.contacts) })
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

  // فرمِ افزودنِ مشتری/لید — مودالِ کامل (نه prompt)
  const [leadForm, setLeadForm] = useState<{ name: string; phone: string; need: string; budget: string; stage: Stage; note: string } | null>(null)
  const addLead = () => setLeadForm({ name: '', phone: '', need: '', budget: '', stage: 'new', note: '' })
  const submitLead = async () => {
    if (!leadForm || !leadForm.name.trim()) return
    const body = { name: leadForm.name.trim(), phone: leadForm.phone.trim() || undefined, need: leadForm.need.trim() || undefined, budget: leadForm.budget.trim() || undefined, stage: leadForm.stage, note: leadForm.note.trim() || undefined }
    try {
      const r = await fetch('/api/crm/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) { const { lead } = await r.json(); if (lead) setLeads(prev => [lead, ...prev]) }
    } catch {}
    setLeadForm(null)
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
    const idx = stages.findIndex(c => c.id === colOf(lead.stage))
    const next = stages[idx + dir]
    if (next) moveLead(lead.id, next.id)
  }

  // Drag & Drop pipeline + Lead detail drawer.
  const [dragLead, setDragLead] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Stage | null>(null)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const openLead = leads.find(l => l.id === openLeadId) || null
  // Replace a lead in local state (after drawer actions return the updated lead).
  const patchLeadLocal = (lead: Lead) => setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...lead } : l))

  // «با کدام لید تماس بگیرم؟» (AI)
  const loadNextCall = async () => {
    setNextCallBusy(true)
    try { const d = await fetch('/api/crm/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'next' }) }).then(r => r.json()); setNextCall({ leads: d.leads, advice: d.advice }) }
    catch {} finally { setNextCallBusy(false) }
  }
  const saveCrmSettings = async (patch: Record<string, any>) => {
    try { const d = await fetch('/api/crm/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(crmSettings || {}), ...patch }) }).then(r => r.json()); if (d.settings) setCrmSettings(d.settings) } catch {}
  }

  const deleteLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id))
    fetch('/api/crm/leads?id=' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {})
  }

  // ── مخاطبین (contact book) — /api/contacts action-based POST ──
  const submitContact = async () => {
    const name = cForm.name.trim(), phone = cForm.phone.trim(), email = cForm.email.trim()
    if (!name && !phone && !email) return
    setCForm({ name: '', phone: '', email: '' })
    try {
      const r = await fetch('/api/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name, phone, email }),
      })
      if (r.ok) { const d = await r.json(); const c = d?.contact; if (c) setContacts(prev => [c, ...prev.filter(x => x.id !== c.id)]) }
    } catch {}
  }
  const removeContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id))
    fetch('/api/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => {})
  }

  // Parse a free-text budget («۱۲۰ میلیون», «۲۰ میلیارد», «۳۵۰۰۰۰۰۰۰») into a number (تومان).
  const parseBudget = (s?: string): number => {
    if (!s) return 0
    const en = s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    const m = en.match(/[\d.]+/)
    if (!m) return 0
    let n = parseFloat(m[0])
    if (!isFinite(n)) return 0
    if (/میلیارد/.test(s)) n *= 1e9
    else if (/میلیون/.test(s)) n *= 1e6
    return n
  }
  const fmtMoney = (n: number): string => {
    if (n >= 1e9) return FA(Math.round(n / 1e8) / 10) + ' میلیارد'
    if (n >= 1e6) return FA(Math.round(n / 1e5) / 10) + ' میلیون'
    if (n > 0) return FA(Math.round(n))
    return '—'
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
    new: { status: 'سرد', color: '#7a8fae' }, contacted: { status: 'گرم', color: '#e7a14a' },
    sent: { status: 'گرم', color: '#e7a14a' }, visited: { status: 'داغ', color: '#e74c3c' },
    negotiation: { status: 'داغ', color: '#e74c3c' }, review: { status: 'گرم', color: '#e7a14a' },
    offered: { status: 'داغ', color: '#e74c3c' }, contract: { status: 'قرارداد', color: '#5fd98a' },
    won: { status: 'فروش', color: '#5fd98a' }, lost: { status: 'از دست‌رفته', color: '#8a8a8a' },
  }
  const sm = (s: Stage) => stageMeta[s] || stageMeta.new
  const recentLeadsLive = leads.slice(0, 5).map(l => ({
    name: l.name,
    need: l.need || '—',
    budget: l.budget || '—',
    status: sm(l.stage).status,
    statusColor: sm(l.stage).color,
    lastContact: (() => { try { return new Date(l.updatedAt).toLocaleDateString('fa-IR') } catch { return '—' } })(),
  }))


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
  const stageBreakdown = stages.map(c => ({ ...c, count: leads.filter(l => l.stage === c.id).length }))

  // ───── دادهٔ واقعیِ داشبورد (نه فیک): روند ۶ ماهِ لیدها + بینش‌های مبتنی بر دادهٔ واقعی ─────
  const curJ = jParts(new Date())
  const last6: { jy: number; jm: number }[] = []
  for (let i = 5; i >= 0; i--) { let m = curJ.jm - i, y = curJ.jy; while (m <= 0) { m += 12; y-- } last6.push({ jy: y, jm: m }) }
  const realSales = last6.map(p => {
    const inM = leads.filter(l => { const lp = jParts(new Date(l.createdAt)); return lp.jy === p.jy && lp.jm === p.jm })
    return { month: J_MON[p.jm - 1], value: inM.length, deals: inM.filter(l => isWonStage(l.stage)).length }
  })
  const maxSales = Math.max(1, ...realSales.map(d => d.value))
  const hasSales = realSales.some(d => d.value > 0)

  const realInsights: { icon: string; text: string }[] = []
  const staleNew = leads.filter(l => l.stage === 'new' && (now - l.createdAt) > 3 * 86400000)
  if (staleNew.length) realInsights.push({ icon: '✦', text: `${FA(staleNew.length)} ${cfg.leadWord}ِ جدید بیش از ۳ روز بدون پیگیری مانده — تماس بگیرید.` })
  if (overdueCount) realInsights.push({ icon: '◰', text: `${FA(overdueCount)} وظیفهٔ معوق دارید؛ هرچه زودتر رسیدگی کنید.` })
  const contractCount = leads.filter(l => isWonStage(l.stage)).length
  if (contractCount) realInsights.push({ icon: '✓', text: `${FA(contractCount)} ${cfg.leadWord} به ${wonLabel} رسیده است. آفرین!` })
  if (growth !== null) realInsights.push({ icon: '◈', text: `رشد قیمتِ سعادت‌آبادِ تهران: ${growth >= 0 ? '+' : ''}${FA(growth)}٪ (دادهٔ واقعیِ بازار). به ${cfg.leadsWord} اطلاع دهید.` })

  // ───── Deals (won leads) — «معاملات/قراردادها/…» ─────
  const wonLeads = leads.filter(l => isWonStage(l.stage))
  const dealsTotalValue = wonLeads.reduce((sum, l) => sum + parseBudget(l.budget), 0)
  const dealsThisMonth = wonLeads.filter(l => { const p = jParts(new Date(l.updatedAt)); return p.jy === curJ.jy && p.jm === curJ.jm }).length

  // ───── Reports — conversion funnel + score breakdown ─────
  const funnel = stages.map(s => {
    const count = leads.filter(l => l.stage === s.id).length
    return { ...s, count, pct: leads.length ? Math.round((count / leads.length) * 100) : 0 }
  })
  const scored = leads.filter(l => typeof l.score === 'number')
  const scoreBuckets = [
    { label: 'داغ (۸۰+)', color: '#e74c3c', count: scored.filter(l => (l.score || 0) >= 80).length },
    { label: 'گرم (۵۰–۷۹)', color: '#e7a14a', count: scored.filter(l => (l.score || 0) >= 50 && (l.score || 0) < 80).length },
    { label: 'سرد (زیر ۵۰)', color: '#7a8fae', count: scored.filter(l => (l.score || 0) < 50).length },
  ]
  const notedCount = leads.filter(l => l.note && l.note.trim()).length
  const maxTrend = Math.max(1, ...realSales.map(d => d.value))

  // Contact-book filtered list (search across name/phone/email).
  const cq = contactSearch.trim().toLowerCase()
  const filteredContacts = cq
    ? contacts.filter(c => [c.name, c.phone, c.email, ...(c.groups || [])].some(v => (v || '').toLowerCase().includes(cq)))
    : contacts

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

          {/* ── Sales OS: تحلیل‌ها + پیگیریِ لازم + دستیارِ تماس ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>سیستمِ فروش</div>
            <button onClick={() => setSettingsOpen(true)} style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>⚙ اتوماسیون{crmSettings?.autoWelcomeSms ? ' • روشن' : ''}</button>
          </div>
          <div className="mjc-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'نرخِ تبدیل', value: `٪${FA(salesStats?.conversionRate ?? 0)}`, sub: 'قرارداد ÷ بسته‌شده', color: '#5fd98a' },
              { label: 'درآمدِ فروش', value: fmtMoney(salesStats?.revenue ?? 0), sub: `${cfg.dealWord}های بسته‌شده`, color: 'var(--gold)' },
              { label: 'میانگینِ امتیاز', value: FA(salesStats?.avgScore ?? 0), sub: 'کیفیتِ لیدها', color: '#7a8fae' },
              { label: 'پیگیریِ لازم', value: FA(salesStats?.needFollowUp ?? followUp.length), sub: `>${FA(crmSettings?.followUpHours ?? 24)} ساعت بی‌فعالیت`, color: (salesStats?.needFollowUp ?? followUp.length) > 0 ? '#e7a14a' : '#5fd98a' },
            ].map((k, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="mjc-sos">
            {/* پیگیریِ لازم */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>⏰ پیگیریِ لازم</div>
              {followUp.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '12px 0' }}>همه‌چیز به‌روز است 👌</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {followUp.slice(0, 6).map(l => (
                    <div key={l.id} onClick={() => setOpenLeadId(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--bg2)', cursor: 'pointer' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: getGradient(l.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, color: '#16140f' }}>{getInitials(l.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{l.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.phone || '—'}</div></div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)' }}>✦{FA(l.score ?? 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* دستیارِ تماس */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>✦ با کی تماس بگیرم؟</div>
                <button onClick={loadNextCall} disabled={nextCallBusy} style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid var(--gold)', background: 'var(--goldDim)', color: 'var(--gold)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>{nextCallBusy ? '…' : 'پیشنهاد بده'}</button>
              </div>
              {!nextCall ? <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '12px 0' }}>دکمهٔ «پیشنهاد بده» را بزن تا دستیار بهترین لیدها را برای تماس رتبه‌بندی کند.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(nextCall.leads || []).slice(0, 4).map((l: any) => (
                    <div key={l.id} onClick={() => setOpenLeadId(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, background: 'var(--bg2)', cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{l.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.reason}</div></div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)' }}>✦{FA(l.score)}</span>
                    </div>
                  ))}
                  {nextCall.advice && <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.9, marginTop: 6, background: 'var(--bg2)', borderRadius: 10, padding: 10 }}>{nextCall.advice}</div>}
                </div>
              )}
            </div>
          </div>

          {/* KPI Cards — real numbers from live data */}
          <div className="mjc-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'وظایف باز', value: openCount, sub: `${FA(todayCount)} امروز`, subColor: 'var(--gold)', icon: '✓' },
              { label: 'معوق', value: overdueCount, sub: overdueCount > 0 ? 'نیاز به پیگیری' : 'بدون معوقه', subColor: overdueCount > 0 ? '#e74c3c' : '#5fd98a', icon: '◴' },
              { label: `کل ${cfg.leadsWord}`, value: leads.length, sub: `${FA(contractCount)} ${cfg.dealWord}`, subColor: '#5fd98a', icon: '◈' },
              { label: 'فایل‌های ملکی', value: ownListings ? ownListings.length : listings.length, sub: growth !== null ? `رشد سعادت‌آباد ${growth >= 0 ? '+' : ''}${FA(growth)}٪` : 'فایل فعال', subColor: 'var(--gold)', icon: '◰' },
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
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{cfg.pipelineLabel}</h3>
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
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>روندِ {cfg.leadsWord}</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>۶ ماه گذشته</span>
              </div>
              {!hasSales ? (
                <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 13, textAlign: 'center', lineHeight: 1.9 }}>هنوز لیدی ثبت نشده — با افزودنِ لید، روندِ ماهانه اینجا نمایش داده می‌شود.</div>
              ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 168, paddingTop: 32 }}>
                {realSales.map((d, i) => {
                  const pct = (d.value / maxSales) * 100
                  const isLast = i === realSales.length - 1
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
                      }}>{FA(d.deals)}</span>
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
                          }}>{FA(d.value)} {cfg.leadWord}</div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{d.month}</span>
                    </div>
                  )
                })}
              </div>
              )}
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
                {realInsights.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.9, padding: '6px 2px' }}>فعلاً بینشی نیست. با افزودنِ لید و وظیفه، تحلیل‌های واقعی اینجا نمایش داده می‌شود.</div>
                )}
                {realInsights.map((ins, i) => (
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
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>آخرین {cfg.leadsWord}</h3>
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
      {/* ── مشتریانِ مصالح‌فروش (جدولِ کامل به‌جای «فایل‌های ملکی») ── */}
      {activeView === 'listings' && isMat && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{leads.length.toLocaleString('fa-IR')} مشتری — پیمانکار، سازنده، مغازه‌دار یا مصرف‌کننده.</div>
            <button onClick={addLead} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>＋ مشتریِ جدید</button>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr 1fr 40px', gap: 8, padding: '11px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              <div>نام</div><div>تلفن</div><div>محصولِ موردنیاز</div><div>مبلغ</div><div>مرحله</div><div></div>
            </div>
            <div style={{ maxHeight: 560, overflowY: 'auto' }}>
              {leads.length === 0 ? <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>هنوز مشتری‌ای ثبت نشده — «مشتریِ جدید».</div> : leads.map((l, i) => (
                <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr 1fr 40px', gap: 8, padding: '11px 16px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>{l.name}{l.note ? <div style={{ fontSize: 11, color: 'var(--faint)' }}>{l.note}</div> : null}</div>
                  <div dir="ltr" style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'right' }}>{l.phone || '—'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{l.need || '—'}</div>
                  <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>{l.budget || '—'}</div>
                  <div>
                    <select value={l.stage} onChange={e => moveLead(l.id, e.target.value as Stage)} style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, padding: '4px 8px', color: 'var(--text)', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer' }}>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <button onClick={() => deleteLead(l.id)} title="حذف" style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 8, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {activeView === 'listings' && !isMat && (ownListings
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
                      {onPromoteListing && l.published && l.publicId && <button onClick={() => onPromoteListing(l)} title="پروموتِ این آگهی" style={{ padding: '5px 9px', borderRadius: 7, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', border: 'none', color: '#16140f', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>🚀 پروموت</button>}
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
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{leads.length.toLocaleString('fa-IR')} {cfg.leadWord} در {cfg.pipelineLabel}</span>
            <button
              onClick={addLead}
              style={{
                padding: '8px 16px', borderRadius: 10,
                background: 'var(--gold)', border: 'none',
                color: '#16140f', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Vazirmatn, system-ui, sans-serif',
              }}
            >＋ {cfg.leadWord}ِ جدید</button>
          </div>

          <div className="mjc-kanban" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
            {stages.map((col, colIdx) => {
              const colLeads = leads.filter(l => colOf(l.stage) === col.id)
              return (
              <div key={col.id} style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column' }}
                onDragOver={e => { e.preventDefault(); if (dragOverCol !== col.id) setDragOverCol(col.id) }}
                onDragLeave={() => setDragOverCol(prev => prev === col.id ? null : prev)}
                onDrop={e => { e.preventDefault(); if (dragLead) moveLead(dragLead, col.id); setDragLead(null); setDragOverCol(null) }}>

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 40, borderRadius: 12, outline: dragOverCol === col.id ? '2px dashed var(--gold)' : 'none', outlineOffset: 4 }}>
                  {colLeads.length === 0 && (
                    <div style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', padding: '12px 0' }}>—</div>
                  )}
                  {colLeads.map(card => (
                    <div key={card.id}
                      draggable
                      onDragStart={() => setDragLead(card.id)}
                      onDragEnd={() => { setDragLead(null); setDragOverCol(null) }}
                      style={{
                        background: 'var(--surface)',
                        borderRadius: 12,
                        padding: 14,
                        border: '1px solid var(--line)',
                        opacity: dragLead === card.id ? 0.4 : 1,
                        cursor: 'grab',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div onClick={() => setOpenLeadId(card.id)} style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: getGradient(card.name),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#16140f',
                          flexShrink: 0, cursor: 'pointer',
                        }}>{getInitials(card.name)}</div>
                        <div onClick={() => setOpenLeadId(card.id)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {card.name}
                            {card.status && card.status !== 'new' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_META[card.status].color, flexShrink: 0 }} title={STATUS_META[card.status].label} />}
                          </div>
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
                          {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <button
                          onClick={() => shiftLead(card, 1)}
                          disabled={colIdx === stages.length - 1}
                          title="مرحله بعد"
                          style={{
                            width: 26, height: 26, borderRadius: 7,
                            background: 'var(--bg)', border: '1px solid var(--line)',
                            color: 'var(--text)', cursor: colIdx === stages.length - 1 ? 'default' : 'pointer',
                            opacity: colIdx === stages.length - 1 ? 0.4 : 1, fontSize: 13, lineHeight: 1,
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

      {/* ==================== CONTACTS (دفترچهٔ مخاطبین) ==================== */}
      {activeView === 'contacts' && (
        <div style={{ maxWidth: 900 }}>
          {/* Add form */}
          <div style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && submitContact()} placeholder="نام" style={{ flex: '1 1 160px', padding: '8px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT }} />
              <input value={cForm.phone} onChange={e => setCForm({ ...cForm, phone: e.target.value })} onKeyDown={e => e.key === 'Enter' && submitContact()} placeholder="تلفن" dir="ltr" style={{ flex: '1 1 140px', padding: '8px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, textAlign: 'right' }} />
              <input value={cForm.email} onChange={e => setCForm({ ...cForm, email: e.target.value })} onKeyDown={e => e.key === 'Enter' && submitContact()} placeholder="ایمیل" dir="ltr" style={{ flex: '1 1 160px', padding: '8px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, textAlign: 'right' }} />
              <button onClick={submitContact} disabled={!cForm.name.trim() && !cForm.phone.trim() && !cForm.email.trim()} style={{ padding: '8px 20px', borderRadius: 10, background: 'var(--gold)', border: 'none', color: '#16140f', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, opacity: (cForm.name.trim() || cForm.phone.trim() || cForm.email.trim()) ? 1 : 0.5 }}>＋ افزودن</button>
            </div>
          </div>

          {/* Search */}
          <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="جستجوی مخاطب…" style={{ width: '100%', maxWidth: 320, padding: '8px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, marginBottom: 14 }} />

          {/* List */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.4fr 1fr 40px', gap: 8, padding: '11px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              <div>نام</div><div>تلفن</div><div>ایمیل</div><div>گروه‌ها</div><div></div>
            </div>
            <div style={{ maxHeight: 560, overflowY: 'auto' }}>
              {filteredContacts.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{contacts.length === 0 ? 'هنوز مخاطبی ثبت نشده — از فرمِ بالا اضافه کنید.' : 'مخاطبی با این جستجو یافت نشد.'}</div>
              ) : filteredContacts.map((c, i) => (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.4fr 1fr 40px', gap: 8, padding: '11px 16px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</div>
                  <div dir="ltr" style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'right' }}>{c.phone || '—'}</div>
                  <div dir="ltr" style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || '—'}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(c.groups || []).length === 0 ? <span style={{ color: 'var(--faint)', fontSize: 12 }}>—</span> : (c.groups || []).map(g => (
                      <span key={g} style={{ fontSize: 10.5, color: 'var(--gold)', background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 6, padding: '2px 6px' }}>{g}</span>
                    ))}
                  </div>
                  <button onClick={() => removeContact(c.id)} title="حذف" style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 8, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>×</button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--faint)' }}>{FA(contacts.length)} مخاطب در دفترچه. مخاطبین در کمپین‌های پیامک و ایمیل هم استفاده می‌شوند.</div>
        </div>
      )}

      {/* ==================== DEALS (معاملات — role-adapted) ==================== */}
      {activeView === 'deals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI tiles */}
          <div className="mjc-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: `تعدادِ ${cfg.dealsWord}`, value: FA(wonLeads.length), icon: '◈' },
              { label: 'ارزشِ کل', value: fmtMoney(dealsTotalValue), icon: '❋' },
              { label: 'این ماه', value: FA(dealsThisMonth), icon: '↑' },
            ].map((kpi, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 10, left: 14, fontSize: 48, opacity: 0.05, color: 'var(--gold)', fontWeight: 900, userSelect: 'none', lineHeight: 1 }}>{kpi.icon}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{kpi.label}</span>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--goldDim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--gold)' }}>{kpi.icon}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Won-leads list */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>{cfg.dealsWord} ({FA(wonLeads.length)})</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr 1fr', gap: 8, padding: '11px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              <div>{cfg.leadWord}</div><div>{needLabel}</div><div>{budgetLabel}</div><div>تاریخ</div>
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {wonLeads.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>هنوز {cfg.dealWord}ی به مرحلهٔ «{wonLabel}» نرسیده است.</div>
              ) : wonLeads.map((l, i) => (
                <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr 1fr', gap: 8, padding: '12px 20px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: getGradient(l.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#16140f', flexShrink: 0 }}>{getInitials(l.name)}</div>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{l.need || '—'}</div>
                  <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12.5 }}>{l.budget || '—'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{(() => { try { return new Date(l.updatedAt).toLocaleDateString('fa-IR') } catch { return '—' } })()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== REPORTS (گزارش‌ها) ==================== */}
      {activeView === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Conversion funnel */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>قیفِ تبدیل</h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{FA(leads.length)} {cfg.leadWord} در مجموع</span>
            </div>
            {leads.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>هنوز داده‌ای برای گزارش نیست — با افزودنِ {cfg.leadWord}، تحلیل‌ها اینجا نمایش داده می‌شوند.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {funnel.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 96, flexShrink: 0, fontSize: 12, color: s.color, fontWeight: 700, textAlign: 'left' }}>{s.label}</div>
                    <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', height: 26, position: 'relative' }}>
                      <div style={{ height: '100%', width: `${s.pct}%`, minWidth: s.count ? 6 : 0, background: s.color, opacity: 0.85, borderRadius: 8, transition: 'width .3s' }} />
                    </div>
                    <div style={{ width: 78, flexShrink: 0, fontSize: 12, color: 'var(--muted)', textAlign: 'left' }}>{FA(s.count)} <span style={{ color: 'var(--faint)' }}>({FA(s.pct)}٪)</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Score breakdown (only if any lead is scored) */}
          {scored.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>دسته‌بندیِ امتیاز</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{FA(scored.length)} {cfg.leadWord}ِ امتیازدهی‌شده — {FA(notedCount)} دارای یادداشت.</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {scoreBuckets.map(b => (
                  <div key={b.label} style={{ flex: '1 1 140px', minWidth: 140, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', borderTop: `3px solid ${b.color}` }}>
                    <div style={{ fontSize: 11.5, color: b.color, fontWeight: 700 }}>{b.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{FA(b.count)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly leads trend */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>روندِ ماهانهٔ {cfg.leadsWord}</h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>۶ ماه گذشته</span>
            </div>
            {!hasSales ? (
              <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 13, textAlign: 'center' }}>هنوز داده‌ای برای نمودار نیست.</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 150, paddingTop: 24 }}>
                {realSales.map((d, i) => {
                  const pct = (d.value / maxTrend) * 100
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>{FA(d.value)}</span>
                      <div style={{ width: '100%', height: `${pct}%`, background: 'linear-gradient(180deg,rgba(201,168,76,0.55),rgba(201,168,76,0.28))', borderRadius: '6px 6px 0 0', minHeight: 8 }} />
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{d.month}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
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

  const F = 'Vazirmatn, system-ui, sans-serif'
  const mInp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: F, outline: 'none', boxSizing: 'border-box' }
  const mLab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  const leadModal = leadForm && (
    <div onClick={() => setLeadForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: F }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, maxWidth: 440, width: '100%', margin: '30px 0', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{cfg.leadWord}ِ جدید</div>
          <button onClick={() => setLeadForm(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}><label style={mLab}>نام *</label><input style={mInp} value={leadForm.name} autoFocus onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} placeholder={isMat ? 'مثلاً پیمانکاری آریا' : 'نامِ لید'} /></div>
          <div><label style={mLab}>تلفن</label><input style={{ ...mInp, direction: 'ltr', textAlign: 'left' }} value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} /></div>
          <div><label style={mLab}>مرحله</label><select style={{ ...mInp, cursor: 'pointer' }} value={leadForm.stage} onChange={e => setLeadForm({ ...leadForm, stage: e.target.value as Stage })}>{stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div><label style={mLab}>{needLabel}</label><input style={mInp} value={leadForm.need} onChange={e => setLeadForm({ ...leadForm, need: e.target.value })} placeholder={isMat ? 'مثلاً میلگرد ۱۶، ۵ تن' : 'خرید · سعادت‌آباد'} /></div>
          <div><label style={mLab}>{budgetLabel}</label><input style={mInp} value={leadForm.budget} onChange={e => setLeadForm({ ...leadForm, budget: e.target.value })} placeholder={isMat ? 'مثلاً ۱۲۰ میلیون' : '۲۰ میلیارد'} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={mLab}>یادداشت</label><textarea style={{ ...mInp, resize: 'vertical', minHeight: 60 }} value={leadForm.note} onChange={e => setLeadForm({ ...leadForm, note: e.target.value })} placeholder={isMat ? 'نوعِ مشتری (پیمانکار/سازنده/…)، شرایطِ پرداخت، …' : 'یادداشت'} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={() => setLeadForm(null)} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: F }}>انصراف</button>
          <button onClick={submitLead} disabled={!leadForm.name.trim()} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: F, opacity: leadForm.name.trim() ? 1 : 0.5 }}>ذخیره</button>
        </div>
      </div>
    </div>
  )

  const settingsModal = settingsOpen && (
    <div onClick={() => setSettingsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: F }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, maxWidth: 480, width: '100%', margin: '30px 0', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>⚙ اتوماسیونِ فروش</div>
          <button onClick={() => setSettingsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.9, margin: '0 0 16px' }}>وقتی {cfg.leadWord}ِ جدید با شماره ثبت شود، به‌صورتِ خودکار پیامکِ خوش‌آمد برایش ارسال شود (پیامک از خطِ سرویس، ممکن است هزینه داشته باشد).</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!crmSettings?.autoWelcomeSms} onChange={e => saveCrmSettings({ autoWelcomeSms: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--gold)' }} />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>ارسالِ خودکارِ پیامکِ خوش‌آمد به {cfg.leadWord}ِ جدید</span>
        </label>
        <div style={{ marginBottom: 16 }}>
          <label style={mLab}>متنِ پیامکِ خوش‌آمد <span style={{ color: 'var(--faint)' }}>({'{name}'} = نامِ {cfg.leadWord})</span></label>
          <textarea defaultValue={crmSettings?.welcomeTemplate || ''} onBlur={e => saveCrmSettings({ welcomeTemplate: e.target.value })} style={{ ...mInp, resize: 'vertical', minHeight: 70 }} />
        </div>
        <div>
          <label style={mLab}>آستانهٔ «پیگیریِ لازم» (ساعت)</label>
          <input type="number" min={1} max={720} defaultValue={crmSettings?.followUpHours ?? 24} onBlur={e => saveCrmSettings({ followUpHours: Number(e.target.value) })} style={{ ...mInp, direction: 'ltr', textAlign: 'left', width: 120 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={() => { setSettingsOpen(false); loadLeadsStats() }} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: F }}>ذخیره و بستن</button>
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
        {leadModal}
        {openLead && <LeadDrawer lead={openLead} stages={stages} leadWord={cfg.leadWord} onClose={() => setOpenLeadId(null)} onChanged={patchLeadLocal} />}
        {settingsModal}
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
                <span className="mjc-sidelabel" style={{ flex: 1 }}>{viewLabel(item.id)}</span>
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
          {/* هویتِ واقعیِ کاربرِ واردشده — نه نامِ ساختگی */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#16140f',
            flexShrink: 0,
          }}>{(me.name || 'کاربر').trim().charAt(0)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{me.name || 'کاربرِ ملک‌جت'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{me.roleLabel || 'CRM'}</div>
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
          <h2 style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>{viewLabel(activeView)}</h2>
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
      {leadModal}
      {openLead && <LeadDrawer lead={openLead} stages={stages} leadWord={cfg.leadWord} onClose={() => setOpenLeadId(null)} onChanged={patchLeadLocal} />}
      {settingsModal}
    </div>
  )
}

// ── کشوی جزئیاتِ لید (Sales OS) — تایم‌لاین، تگ، ارتباط، تطبیق، AI ──
function LeadDrawer({ lead, stages, leadWord, onClose, onChanged }: {
  lead: Lead
  stages: { id: Stage; label: string; color: string }[]
  leadWord: string
  onClose: () => void
  onChanged: (l: Lead) => void
}) {
  const F = 'Vazirmatn, system-ui, sans-serif'
  const [tab, setTab] = useState<'timeline' | 'match' | 'ai'>('timeline')
  const [busy, setBusy] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [smsText, setSmsText] = useState('')
  const [matches, setMatches] = useState<any[] | null>(null)
  const [ai, setAi] = useState<{ prob?: number; advice?: string; listings?: any[] } | null>(null)
  const acts = (lead.activities || []).slice().sort((a, b) => b.at - a.at)
  const st = lead.status || 'new'

  const patchLead = async (patch: Record<string, any>) => {
    setBusy('save')
    try { const r = await fetch('/api/crm/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, ...patch }) }); const d = await r.json(); if (d.lead) onChanged(d.lead) } catch {} finally { setBusy('') }
  }
  const act = async (type: string, note?: string) => {
    setBusy(type)
    try { const r = await fetch('/api/crm/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, type, note }) }); const d = await r.json(); if (d.lead) onChanged(d.lead) } catch {} finally { setBusy('') }
  }
  const comm = async (channel: string, extra?: Record<string, any>) => {
    setBusy(channel)
    try {
      const r = await fetch('/api/crm/comm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, channel, ...extra }) })
      const d = await r.json()
      if (channel === 'whatsapp' && d.link) window.open(d.link, '_blank')
      // refresh lead activities
      const lr = await fetch('/api/crm/activity?leadId=' + lead.id).then(x => x.json()).catch(() => null)
      if (lr?.activities) onChanged({ ...lead, activities: lr.activities })
      if (channel === 'sms') { setSmsText(''); if (!d.ok) alert(d.error || 'ارسالِ پیامک ناموفق بود') }
    } catch {} finally { setBusy('') }
  }
  const loadMatches = async () => { setBusy('match'); try { const d = await fetch('/api/crm/matching?leadId=' + lead.id).then(x => x.json()); setMatches(d.matches || []) } catch { setMatches([]) } finally { setBusy('') } }
  const linkListing = async (listingId: string) => { try { const r = await fetch('/api/crm/matching', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, listingId }) }); const d = await r.json(); if (d.lead) onChanged(d.lead) } catch {} }
  const runAi = async (action: string) => {
    setBusy('ai-' + action)
    try { const d = await fetch('/api/crm/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, leadId: lead.id }) }).then(x => x.json())
      if (action === 'convert') setAi({ prob: d.probability, advice: d.advice })
      else if (action === 'best') setAi({ advice: d.advice, listings: d.listings })
    } catch {} finally { setBusy('') }
  }
  const addTag = () => { const t = tagInput.trim(); if (!t) return; patchLead({ tags: [...(lead.tags || []), t] }); setTagInput('') }
  const rmTag = (t: string) => patchLead({ tags: (lead.tags || []).filter(x => x !== t) })
  // یادآوری = تسکِ CRM لینک‌شده به لید (پیش‌فرض فردا).
  const reminder = async () => {
    setBusy('reminder')
    try {
      const dueTs = Date.now() + 24 * 36e5
      await fetch('/api/crm/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `پیگیریِ ${lead.name}${lead.phone ? ' — ' + lead.phone : ''}`, priority: 'high', dueTs, due: new Date(dueTs).toLocaleDateString('fa-IR') }) })
      await act('note', 'یادآوریِ پیگیری برای فردا ثبت شد')
    } catch {} finally { setBusy('') }
  }

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${active ? 'var(--gold)' : 'var(--line2)'}`, background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: F }}>{label}</button>
  )
  const actBtn = (icon: string, label: string, onClick: () => void, key: string) => (
    <button onClick={onClick} disabled={!!busy} style={{ flex: 1, minWidth: 72, padding: '8px 6px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: F, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 15 }}>{busy === key ? '…' : icon}</span>{label}
    </button>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 500, display: 'flex', justifyContent: 'flex-start', fontFamily: F }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: 'var(--bg)', borderInlineEnd: '1px solid var(--line)', width: 'min(460px,100%)', height: '100%', overflowY: 'auto', boxShadow: '-20px 0 60px -20px rgba(0,0,0,.6)' }}>
        {/* هدر */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: getGradient(lead.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#16140f' }}>{getInitials(lead.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{lead.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', direction: 'ltr', textAlign: 'right' }}>{lead.phone || '—'}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 24, cursor: 'pointer' }}>×</button>
          </div>
          {/* امتیاز + وضعیت */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}><span>امتیازِ لید</span><span style={{ color: 'var(--gold)', fontWeight: 800 }}>{lead.score ?? 0}</span></div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--bg2)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${lead.score ?? 0}%`, background: 'linear-gradient(90deg,var(--gold2),var(--gold))' }} /></div>
            </div>
          </div>
          {/* وضعیتِ سلامت */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {(['new', 'hot', 'cold', 'converted', 'lost'] as LeadStatus[]).map(s => (
              <button key={s} onClick={() => patchLead({ status: s })} style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${st === s ? STATUS_META[s].color : 'var(--line2)'}`, background: st === s ? STATUS_META[s].color + '22' : 'transparent', color: st === s ? STATUS_META[s].color : 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: F }}>{STATUS_META[s].label}</button>
            ))}
          </div>
          {/* مرحله */}
          <div style={{ marginTop: 12 }}>
            <select value={lead.stage} onChange={e => patchLead({ stage: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 12.5, fontFamily: F, cursor: 'pointer' }}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          {/* تگ‌ها (هوشمند + دستی) */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {(lead.autoTags || []).map(t => <span key={'a' + t} style={{ fontSize: 11, background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,.35)', color: 'var(--gold)', borderRadius: 999, padding: '3px 9px', fontWeight: 700 }}>◆ {t}</span>)}
            {(lead.tags || []).map(t => <span key={t} style={{ fontSize: 11, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 9px', display: 'flex', gap: 5, alignItems: 'center' }}>{t}<span onClick={() => rmTag(t)} style={{ cursor: 'pointer', color: 'var(--muted)' }}>×</span></span>)}
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTag() }} placeholder="+ تگ" style={{ width: 70, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 10px', color: 'var(--text)', fontSize: 11, fontFamily: F, outline: 'none' }} />
          </div>
          {/* اقداماتِ سریع (Communication Hub) */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            {actBtn('☎', 'ثبتِ تماس', () => act('call', 'تماسِ تلفنی'), 'call')}
            {actBtn('⚑', 'ثبتِ بازدید', () => act('visit', 'بازدیدِ حضوری'), 'visit')}
            {actBtn('✆', 'واتساپ', () => comm('whatsapp', { text: `سلام ${lead.name} عزیز،` }), 'whatsapp')}
            {actBtn('⏰', 'یادآوری', () => reminder(), 'reminder')}
          </div>
        </div>

        {/* تب‌ها */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px 0' }}>
          {chip('تایم‌لاین', tab === 'timeline', () => setTab('timeline'))}
          {chip('فایل‌های پیشنهادی', tab === 'match', () => { setTab('match'); if (matches === null) loadMatches() })}
          {chip('دستیارِ AI', tab === 'ai', () => setTab('ai'))}
        </div>

        <div style={{ padding: 20 }}>
          {tab === 'timeline' && (
            <div>
              {/* ارسالِ پیامک */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                <input value={smsText} onChange={e => setSmsText(e.target.value)} placeholder="متنِ پیامک به لید…" style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 11px', color: 'var(--text)', fontSize: 12.5, fontFamily: F, outline: 'none' }} />
                <button onClick={() => smsText.trim() && comm('sms', { text: smsText.trim() })} disabled={!smsText.trim() || busy === 'sms'} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--gold)', color: '#16140f', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: F, opacity: smsText.trim() ? 1 : 0.5 }}>{busy === 'sms' ? '…' : 'ارسال'}</button>
              </div>
              {acts.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', padding: 20 }}>هنوز فعالیتی ثبت نشده.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {acts.map((a, i) => (
                    <div key={a.id} style={{ display: 'flex', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg2)', border: '1px solid var(--line2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{ACT_ICON[a.type] || '•'}</div>
                        {i < acts.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--line)', minHeight: 14 }} />}
                      </div>
                      <div style={{ paddingBottom: 16, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{ACT_LABEL[a.type] || a.type}</div>
                        {a.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.7 }}>{a.note}</div>}
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3, direction: 'ltr', textAlign: 'right' }}>{new Date(a.at).toLocaleString('fa-IR')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'match' && (
            <div>
              {matches === null ? <div style={{ color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', padding: 20 }}>در حالِ یافتنِ فایل…</div>
                : matches.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', padding: 20 }}>فایلِ متناسبی یافت نشد (بودجه/منطقهٔ لید را کامل کن).</div>
                : matches.map((m: any) => (
                  <div key={m.listing.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: m.listing.image ? `center/cover url(${m.listing.image})` : 'var(--bg2)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.listing.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.listing.price || '—'} · {m.reasons?.[0] || ''}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)' }}>٪{m.score}</div>
                    <button onClick={() => linkListing(m.listing.id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--gold)', background: (lead.listingIds || []).includes(m.listing.id) ? 'var(--goldDim)' : 'transparent', color: 'var(--gold)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: F }}>{(lead.listingIds || []).includes(m.listing.id) ? '✓' : 'اتصال'}</button>
                  </div>
                ))}
            </div>
          )}

          {tab === 'ai' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button onClick={() => runAi('convert')} disabled={!!busy} style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid var(--gold)', background: 'var(--goldDim)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: F }}>{busy === 'ai-convert' ? '…' : 'احتمالِ تبدیل'}</button>
                <button onClick={() => runAi('best')} disabled={!!busy} style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: F }}>{busy === 'ai-best' ? '…' : 'بهترین فایل'}</button>
              </div>
              {ai?.prob !== undefined && (
                <div style={{ textAlign: 'center', margin: '10px 0 16px' }}>
                  <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--gold)' }}>٪{ai.prob}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>احتمالِ تبدیل به {leadWord === 'لید' ? 'مشتری' : 'قرارداد'}</div>
                </div>
              )}
              {ai?.listings && ai.listings.map((l: any) => <div key={l.id} style={{ fontSize: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>◦ {l.title} <span style={{ color: 'var(--gold)' }}>٪{l.score}</span></div>)}
              {ai?.advice && <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: 12, fontSize: 12.5, lineHeight: 2, color: 'var(--text)' }}>{ai.advice}</div>}
              {!ai && <div style={{ color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', padding: 20 }}>یکی از دکمه‌های بالا را بزن تا دستیار تحلیل کند.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
