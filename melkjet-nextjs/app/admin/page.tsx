'use client'
import { useState, useEffect, useRef } from 'react'
import { DEAL_TYPES, PROPERTY_KINDS, PROVINCES, citiesOf, neighborhoodsOf } from '@/app/lib/taxonomy'
import { DIVAR_CATEGORIES, DIVAR_CITIES } from '@/app/lib/divar-meta'
import { AGENTS, categorizeModel, CATEGORY_LABEL, FALLBACK_MODELS, DEFAULT_GAP_BASE, type ModelCategory } from '@/app/lib/ai-agents'
import { buildIdentityRows } from '@/app/lib/identity-labels'
import PlanStudio from '@/app/components/PlanStudio'
import ImageUpload from '@/app/components/ImageUpload'
import ArticleEditor from '@/app/components/ArticleEditor'
import AdminSupportView from './AdminSupportView'
import CatalogAdminView from './CatalogAdminView'

/* ─── Types ─────────────────────────────────────────────────── */
type View =
  | 'overview' | 'scraper' | 'persiansaze' | 'listings' | 'products' | 'catalog' | 'geo' | 'moderation' | 'content' | 'studio' | 'articles' | 'categories' | 'crm' | 'api'
  | 'reports' | 'plans' | 'promos' | 'discounts' | 'ads' | 'users' | 'profiles' | 'roles' | 'connections'
  | 'tracker' | 'sms' | 'settings' | 'health' | 'servers' | 'queue' | 'audit' | 'flags' | 'support' | 'payment' | 'aicost' | 'smscost'

interface NavItem { id: View; icon: string; label: string; badge?: string; badgeColor?: string }
interface NavSection { title: string; items: NavItem[] }

/* ─── Sidebar nav data ───────────────────────────────────────── */
const sections: NavSection[] = [
  {
    title: 'محتوا',
    items: [
      { id: 'articles',    icon: '✎',  label: 'مقالات' },
      { id: 'categories',  icon: '☰',  label: 'دسته‌بندی‌ها' },
    ],
  },
  {
    title: 'آگهی و فروشگاه',
    items: [
      { id: 'listings',    icon: '▤',  label: 'مدیریت آگهی‌ها' },
      { id: 'products',    icon: '◰',  label: 'مدیریت محصولات' },
      { id: 'catalog',     icon: '🧱', label: 'کاتالوگِ مصالح',   badge: 'NEW', badgeColor: '#c9a84c' },
      { id: 'moderation',  icon: '✓',  label: 'تأیید آگهی AI',     badge: '32',    badgeColor: '#e7674a' },
      { id: 'scraper',     icon: '⛏',  label: 'موتور اسکرپی',     badge: 'زنده',  badgeColor: '#5fd98a' },
      { id: 'persiansaze', icon: '🏗', label: 'سازنده‌ها (پرشین سازه)', badge: 'NEW', badgeColor: '#c9a84c' },
      { id: 'studio',      icon: '◳',  label: 'استودیو پلان و ۳بعدی', badge: 'AI', badgeColor: '#c9a84c' },
    ],
  },
  {
    title: 'کاربران و دسترسی',
    items: [
      { id: 'users', icon: '◍', label: 'کاربران' },
      { id: 'profiles', icon: '👁', label: 'همه پروفایل‌ها' },
      { id: 'roles', icon: '🛡', label: 'نقش‌ها و دسترسی' },
      { id: 'crm',   icon: '◈', label: 'CRM کاربران' },
      { id: 'support', icon: '🛟', label: 'پشتیبانی' },
    ],
  },
  {
    title: 'درآمد و رشد',
    items: [
      { id: 'plans',  icon: '◔', label: 'پلن‌ها' },
      { id: 'payment', icon: '💳', label: 'درگاه‌های پرداخت', badge: 'NEW', badgeColor: '#c9a84c' },
      { id: 'aicost', icon: '🧮', label: 'هزینه و قیمتِ AI', badge: 'NEW', badgeColor: '#c9a84c' },
      { id: 'smscost', icon: '✉', label: 'تعرفهٔ پیامک', badge: 'NEW', badgeColor: '#c9a84c' },
      { id: 'promos', icon: '★', label: 'پروموت و ویژه‌سازی' },
      { id: 'discounts', icon: '٪', label: 'کدهای تخفیف' },
      { id: 'ads',    icon: '▤', label: 'تبلیغات بنری' },
      { id: 'tracker', icon: '🎯', label: 'ترکر و پیامک هدفمند' },
      { id: 'sms', icon: '✉', label: 'پیامک و الگوها', badge: 'SMS', badgeColor: '#5fd98a' },
    ],
  },
  {
    title: 'داده و گزارش',
    items: [
      { id: 'overview', icon: '▦', label: 'نمای کلی' },
      { id: 'reports',  icon: '◔', label: 'گزارش‌ها و Big Data' },
      { id: 'api',      icon: '◈', label: 'API و مدل‌های AI' },
    ],
  },
  {
    title: 'پیکربندی',
    items: [
      { id: 'connections', icon: '⚯', label: 'اتصال‌ها و سرویس‌ها' },
      { id: 'geo',         icon: '🗺', label: 'مناطق و محله‌ها' },
      { id: 'settings',    icon: '⚙', label: 'تنظیمات کامل' },
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
  support:    'پشتیبانی — تیکت‌ها',
  overview:   'نمای کلی سیستم',
  scraper:    'موتور اسکرپی هوشمند',
  catalog:    'کاتالوگِ مرجعِ مصالح',
  persiansaze: 'سازنده‌ها (پرشین سازه)',
  listings:   'مدیریت آگهی‌ها و محتوا',
  products:   'مدیریت محصولات فروشگاه',
  categories: 'دسته‌بندی‌ها',
  crm:        'CRM و مدیریت لیدهای کاربران',
  profiles:   'همه پروفایل‌ها',
  connections: 'اتصال‌ها و سرویس‌ها',
  geo:        'مدیریت مناطق و محله‌ها',
  moderation: 'تأیید آگهی با هوش مصنوعی',
  content:    'استودیو محتوا و سئو',
  studio:     'استودیو پلان و مدل سه‌بعدی',
  articles:   'مدیریت مقالات و وبلاگ',
  api:        'API و مدل‌های هوش مصنوعی',
  reports:    'گزارش‌ها و تحلیل داده',
  plans:      'پلن‌ها و اشتراک‌ها',
  payment:    'درگاه‌های پرداخت',
  aicost:     'هزینه و قیمت‌گذاریِ AI',
  smscost:    'تعرفه و قیمتِ پیامک',
  promos:     'پروموت و ویژه‌سازی',
  discounts:  'کدهای تخفیف',
  ads:        'تبلیغات بنری',
  users:      'کاربران',
  roles:      'نقش‌ها و دسترسی',
  tracker:    'ترکر و پیامک هدفمند',
  sms:        'پیامک و الگوها',
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

function GoldButton({ children, onClick, style, disabled }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
      color: '#16140f', border: 'none', borderRadius: 11, padding: '10px 20px',
      fontWeight: 700, fontSize: 13.5, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      boxShadow: '0 8px 22px -10px var(--gold)', opacity: disabled ? .6 : 1, ...style
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
  const [p, setP] = useState<any>(null)
  useEffect(() => { fetch('/api/admin/market').then(r => r.ok ? r.json() : null).then(d => setP(d?.platform)) }, [])
  const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
  const actions = [
    { icon: '⛏', label: 'اجرای اسکرپر', color: '#5b9bd5' },
    { icon: '✦', label: 'تولید محتوا', color: '#5fd98a' },
    { icon: '◈', label: 'تست مدل AI', color: 'var(--gold)' },
    { icon: '◉', label: 'وضعیت سیستم', color: '#e7a14a' },
  ]
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <KPI label="کل آگهی" value={fa(p?.listings.total)} trend={p ? `فروش ${fa(p.listings.sale)} · اجاره ${fa(p.listings.rent)}` : '—'} icon="🏠" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" />
        <KPI label="پروفایل/دفتر" value={fa(p?.directory.total)} trend={p ? `${fa(p.directory.byCategory.length)} دسته` : '—'} icon="◍" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" />
        <KPI label="آگهی‌دهنده" value={fa(p?.owners)} trend="کاربران واکشی‌شده" icon="👤" iconBg="var(--goldDim)" iconColor="var(--gold)" />
        <KPI label="دیتاست دانش" value={fa(p?.dataset)} trend="دادهٔ بازار" icon="🧠" iconBg="rgba(231,103,74,.15)" iconColor="#e7674a" />
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
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>ترکیب دیتای پلتفرم</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'آگهی فروش', value: p?.listings.sale, color: '#5fd98a' },
              { label: 'آگهی اجاره', value: p?.listings.rent, color: '#5b9bd5' },
              { label: 'پروفایل و دفاتر', value: p?.directory.total, color: '#a77fd4' },
              { label: 'محصول فروشگاه', value: p?.products, color: '#4ec4e8' },
              { label: 'مقاله', value: p?.articles, color: 'var(--gold)' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} /><span style={{ fontSize: 13 }}>{r.label}</span></div>
                <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{fa(r.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

interface ScrSource {
  id: string; name: string; url: string; type: 'listing' | 'article' | 'price'
  method: 'auto' | 'jsonld' | 'og' | 'rss'; enabled: boolean; schedule: string
  lastRun: number | null; lastCount: number; status: 'idle' | 'ok' | 'error'; lastError?: string
}
interface ScrItem {
  id: string; sourceName: string; type: string; title: string; price?: string
  location?: string; image?: string; url?: string; excerpt?: string; scrapedAt: number; status: string
}

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  listing:   { label: 'آگهی‌ها', icon: '⌂', color: '#5fd98a' },
  directory: { label: 'پروفایل/دفاتر', icon: '◍', color: '#a77fd4' },
  product:   { label: 'فروشگاه', icon: '▣', color: '#4ec4e8' },
  article:   { label: 'مقالات', icon: '✦', color: '#5b9bd5' },
  price:     { label: 'قیمت‌ها', icon: '◷', color: '#e7a14a' },
}
const SCHEDULE_LABEL: Record<string, string> = { manual: 'دستی', hourly: 'ساعتی', '6h': 'هر ۶ ساعت', daily: 'روزانه' }
const METHOD_LABEL: Record<string, string> = { auto: 'خودکار', jsonld: 'JSON-LD', og: 'OpenGraph', rss: 'RSS/خبر', css: 'CSS سفارشی', divar: 'دیوار API' }
const ITEM_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'منتظر بررسی', color: '#5b9bd5' },
  approved: { label: 'تأیید شد', color: '#5fd98a' },
  duplicate: { label: 'تکراری', color: '#e7a14a' },
  rejected: { label: 'رد شد', color: '#e7674a' },
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'هرگز'
  const d = Date.now() - ts
  const m = Math.floor(d / 60000)
  if (m < 1) return 'همین لحظه'
  if (m < 60) return `${m} دقیقه پیش`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ساعت پیش`
  return `${Math.floor(h / 24)} روز پیش`
}

// ─── مدیریت آگهی‌ها و محتوای واکشی‌شده ─────────────────────────────────────
interface MItem {
  id: string; type: string; category?: string; title: string; price?: string
  location?: string; image?: string; url?: string; excerpt?: string; phone?: string; owner?: string
  sourceName: string; status: string; featured?: boolean; edited?: boolean; scrapedAt: number
  aiReason?: string; aiScore?: number; moderatedAt?: number
}
const M_TYPES: { k: string; label: string }[] = [
  { k: '', label: 'همه' }, { k: 'listing', label: 'آگهی' }, { k: 'directory', label: 'پروفایل/دفتر' },
  { k: 'product', label: 'فروشگاه' }, { k: 'article', label: 'مقاله' }, { k: 'price', label: 'قیمت' },
]
const M_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'منتظر', color: '#5b9bd5' }, approved: { label: 'تأیید', color: '#5fd98a' },
  duplicate: { label: 'تکراری', color: '#e7a14a' }, rejected: { label: 'رد', color: '#e7674a' },
}

// ── صفحه‌بندیِ سبک برای فهرست‌های سنگین (کاربران/آگهی/اسکرپ/…) ──
function usePaged<T>(items: T[]) {
  const [page, setPage] = useState(1)
  const [size, setSizeState] = useState<number>(() => { try { return Number(localStorage.getItem('mj_admin_page_size')) || 20 } catch { return 20 } })
  useEffect(() => { setPage(1) }, [items.length, size])
  const total = items.length
  const pageCount = size <= 0 ? 1 : Math.max(1, Math.ceil(total / size))
  const p = Math.min(page, pageCount)
  const paged = size <= 0 ? items : items.slice((p - 1) * size, p * size)
  const setSize = (s: number) => { setSizeState(s); setPage(1); try { localStorage.setItem('mj_admin_page_size', String(s)) } catch {} }
  return { paged, page: p, setPage, size, setSize, total, pageCount }
}
function Pager({ page, pageCount, size, setSize, setPage, total }: { page: number; pageCount: number; size: number; setSize: (s: number) => void; setPage: (f: (p: number) => number) => void; total: number }) {
  const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  const sel: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, padding: '5px 10px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }
  const btn = (dis: boolean): React.CSSProperties => ({ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--line2)', background: dis ? 'transparent' : 'var(--bg2)', color: dis ? 'var(--faint)' : 'var(--text)', fontSize: 12.5, cursor: dis ? 'default' : 'pointer', fontFamily: 'inherit' })
  if (total === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--muted)' }}>
        <span>تعدادِ نمایش:</span>
        <select value={size} onChange={e => setSize(Number(e.target.value))} style={sel}>
          {[10, 20, 50, 100, 0].map(s => <option key={s} value={s}>{s === 0 ? 'همه' : fa(s)}</option>)}
        </select>
        <span>از {fa(total)} مورد</span>
      </div>
      {pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btn(page <= 1)}>‹ قبلی</button>
          <span style={{ color: 'var(--muted)' }}>صفحهٔ {fa(page)} از {fa(pageCount)}</span>
          <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page >= pageCount} style={btn(page >= pageCount)}>بعدی ›</button>
        </div>
      )}
    </div>
  )
}

function ListingsView() {
  const [items, setItems] = useState<MItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [loc, setLoc] = useState('')                       // فیلترِ محله/شهر
  const [hoods, setHoods] = useState<{ h: string; c: number }[]>([])
  const [ml, setMl] = useState<any>(null)                  // وضعیتِ مدلِ یادگیرندهٔ ممیزی
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<MItem | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (type) sp.set('type', type)
    if (status) sp.set('status', status)
    if (loc) sp.set('loc', loc)
    if (q.trim()) sp.set('q', q.trim())
    const r = await fetch(`/api/admin/scraper/items?${sp}`)
    if (r.ok) { const d = await r.json(); setItems(d.items); setTotal(d.total); setHoods(d.hoods || []) }
    setLoading(false); setSel(new Set())
  }
  useEffect(() => { load() }, [type, status, loc])
  const loadMl = () => fetch('/api/admin/scraper/moderate').then(r => r.ok ? r.json() : null).then(d => setMl(d?.ml || null)).catch(() => {})
  useEffect(() => { loadMl() }, [])

  const patch = async (id: string, body: any) => {
    await fetch('/api/admin/scraper/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
  }
  const setStatusOf = async (id: string, s: string) => { setItems(items.map(i => i.id === id ? { ...i, status: s } : i)); await patch(id, { status: s }) }
  const toggleFeatured = async (it: MItem) => { setItems(items.map(i => i.id === it.id ? { ...i, featured: !it.featured } : i)); await patch(it.id, { patch: { featured: !it.featured } }) }
  const del = async (id: string) => { if (!confirm('این آیتم حذف شود؟')) return; setItems(items.filter(i => i.id !== id)); await fetch(`/api/admin/scraper/items?id=${id}`, { method: 'DELETE' }) }
  const delSelected = async () => {
    if (!sel.size || !confirm(`${sel.size} آیتم حذف شود؟`)) return
    const ids = [...sel]; setItems(items.filter(i => !sel.has(i.id))); setSel(new Set())
    await fetch('/api/admin/scraper/items', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
  }
  const saveEdit = async (patchData: any) => {
    if (!edit) return
    setItems(items.map(i => i.id === edit.id ? { ...i, ...patchData } : i))
    await patch(edit.id, { patch: patchData }); setEdit(null)
  }
  // ساخت آیتم جدید (آگهی/پروفایل/محصول/قیمت) و بازخوانی لیست
  const createItem = async (data: { type: string; title: string; price?: string; location?: string; image?: string; url?: string; excerpt?: string }) => {
    const r = await fetch('/api/admin/scraper/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (r.ok) { setCreateOpen(false); await load() }
    else { const d = await r.json().catch(() => ({})); alert(d.error || 'خطا در ساخت آیتم') }
  }
  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSel(sel.size === items.length ? new Set() : new Set(items.map(i => i.id)))
  const bulkStatus = async (status: string) => {
    if (!sel.size) return
    const ids = [...sel]; setItems(items.map(i => sel.has(i.id) ? { ...i, status } : i)); setSel(new Set())
    await Promise.all(ids.map(id => fetch('/api/admin/scraper/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })))
  }
  const bulkFeature = async (featured: boolean) => {
    if (!sel.size) return
    const ids = [...sel]; setItems(items.map(i => sel.has(i.id) ? { ...i, featured } : i)); setSel(new Set())
    await Promise.all(ids.map(id => fetch('/api/admin/scraper/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, patch: { featured } }) })))
  }
  // ویرایش دسته‌ای: فقط فیلدهایی که پر شده‌اند روی همهٔ انتخاب‌شده‌ها اعمال می‌شود
  const bulkEditSave = async (patchData: Record<string, string>) => {
    const fields = Object.fromEntries(Object.entries(patchData).filter(([, v]) => v !== '' && v != null))
    if (!sel.size || !Object.keys(fields).length) { setBulkOpen(false); return }
    const ids = [...sel]
    setItems(items.map(i => sel.has(i.id) ? { ...i, ...fields, edited: true } : i)); setSel(new Set()); setBulkOpen(false)
    await Promise.all(ids.map(id => fetch('/api/admin/scraper/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, patch: fields }) })))
  }
  // تأیید/رد دسته‌ای با هوش مصنوعی روی موارد انتخاب‌شده
  const bulkAi = async () => {
    if (!sel.size || aiBusy) return
    setAiBusy(true)
    try {
      const ids = [...sel]
      for (const id of ids) {
        try { await fetch('/api/admin/scraper/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }) } catch {}
      }
      await load(); loadMl()
    } finally { setAiBusy(false) }
  }

  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  const pg = usePaged(items)
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      {/* filters */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {M_TYPES.map(t => (
            <button key={t.k} onClick={() => setType(t.k)} style={{
              padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
              border: `1px solid ${type === t.k ? 'var(--gold)' : 'var(--line2)'}`,
              background: type === t.k ? 'var(--goldDim)' : 'transparent', color: type === t.k ? 'var(--gold)' : 'var(--muted)', fontWeight: type === t.k ? 700 : 500,
            }}>{t.label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <select style={inp} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            <option value="pending">منتظر</option>
            <option value="approved">تأیید‌شده</option>
            <option value="rejected">رد‌شده</option>
          </select>
          <select style={{ ...inp, ...(loc ? { borderColor: 'var(--gold)', color: 'var(--gold)', fontWeight: 700 } : {}) }} value={loc} onChange={e => setLoc(e.target.value)} title="فیلترِ محله/شهر">
            <option value="">همهٔ محله‌ها</option>
            {hoods.map(o => <option key={o.h} value={o.h}>{o.h} ({o.c})</option>)}
          </select>
          <input style={inp} placeholder="جستجو…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }} />
          <OutlineButton onClick={load}>جستجو</OutlineButton>
          <OutlineButton onClick={async () => {
            if (!confirm('آگهی‌های تکراری شناسایی و از نمایشِ عمومی خارج شوند؟ (قدیمی‌ترینِ هر گروه می‌ماند)')) return
            const r = await fetch('/api/admin/scraper/dedupe', { method: 'POST' })
            const d = await r.json().catch(() => ({}))
            alert(r.ok ? `${d.removed || 0} آگهیِ تکراری حذف شد (${d.kept || 0} آگهی ماند).` : (d.error || 'خطا'))
            if (r.ok) load()
          }}>🧹 پاک‌سازیِ تکراری‌ها</OutlineButton>
          <GoldButton onClick={() => setCreateOpen(true)}>＋ آگهی جدید</GoldButton>
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>{loading ? 'در حال بارگذاری…' : `${total} مورد`}</span>
          {ml && (
            <span title="مدلِ یادگیرندهٔ ممیزی: از هر تصمیمِ تأیید/رد یاد می‌گیرد و پس از دیدنِ نمونهٔ کافی خودش تصمیم می‌گیرد."
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '4px 10px', borderRadius: 999, border: `1px solid ${ml.ready ? '#5fd98a' : 'var(--line2)'}`, color: ml.ready ? '#5fd98a' : 'var(--faint)' }}>
              🧠 مدلِ یادگیرنده: {ml.ready ? 'آماده — خودکار تصمیم می‌گیرد' : 'در حالِ یادگیری'}
              <span style={{ color: 'var(--faint)' }}>· ✓{ml.approvedSamples} ✕{ml.rejectedSamples} از {ml.minPerClass}</span>
              {ml.autoDecided > 0 && <span style={{ color: 'var(--gold)' }}>· {ml.autoDecided} تصمیمِ خودکار</span>}
            </span>
          )}
          <button onClick={selectAll} style={{ background: 'transparent', border: '1px solid var(--line2)', color: 'var(--muted)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>{sel.size === items.length && items.length ? 'لغو انتخاب همه' : 'انتخاب همه'}</button>
          {sel.size > 0 && <>
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{sel.size} انتخاب‌شده:</span>
            <button onClick={() => bulkStatus('approved')} style={{ background: 'transparent', border: '1px solid #5fd98a', color: '#5fd98a', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>✓ تأیید</button>
            <button onClick={() => bulkStatus('rejected')} style={{ background: 'transparent', border: '1px solid #e7a14a', color: '#e7a14a', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>↧ رد</button>
            <button onClick={() => bulkFeature(true)} style={{ background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>★ ویژه</button>
            <button onClick={() => setBulkOpen(true)} style={{ background: 'transparent', border: '1px solid #8a7bd8', color: '#a99bf0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>✎ ویرایش دسته‌ای</button>
            <button onClick={bulkAi} disabled={aiBusy} style={{ background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 8, padding: '5px 12px', cursor: aiBusy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12.5, opacity: aiBusy ? .6 : 1 }}>{aiBusy ? '⏳ در حال بررسی…' : '🤖 بررسی با AI'}</button>
            <button onClick={delSelected} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.4)', color: '#e7674a', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>🗑 حذف</button>
          </>}
        </div>
      </Card>

      {/* list */}
      <Card>
        {items.length === 0 && !loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>موردی نیست. یک منبع اجرا کنید یا فیلترها را تغییر دهید.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pg.paged.map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', borderRadius: 12, padding: '10px 12px', flexWrap: 'wrap' }}>
                <input type="checkbox" checked={sel.has(it.id)} onChange={() => toggleSel(it.id)} style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }} />
                {it.image
                  ? <img src={it.image} alt="" style={{ width: 48, height: 48, borderRadius: 9, objectFit: 'cover', flexShrink: 0, background: 'var(--surface)' }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                  : <span style={{ width: 48, height: 48, borderRadius: 9, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--gold)' }}>▤</span>}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <a href={it.url || '#'} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', display: 'block', lineHeight: 1.5 }}>{it.featured && '★ '}{it.title}{it.edited && <span style={{ color: 'var(--faint)', fontSize: 10, marginRight: 4 }}>(ویرایش‌شده)</span>}</a>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{[it.location, it.sourceName, it.category].filter(Boolean).join(' · ')}</div>
                  {it.aiReason && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: 'var(--gold)' }}>🤖</span><span>{it.aiReason}</span>{typeof it.aiScore === 'number' && <span style={{ color: it.aiScore >= 70 ? '#5fd98a' : it.aiScore >= 45 ? '#e7a14a' : '#e7674a', fontWeight: 700 }}>({it.aiScore})</span>}</div>}
                </div>
                {it.price && <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 13, whiteSpace: 'nowrap' }}>{it.price}</span>}
                <Badge label={M_STATUS[it.status]?.label || it.status} color={M_STATUS[it.status]?.color || 'var(--faint)'} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button title="ویژه" onClick={() => toggleFeatured(it)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: it.featured ? 'var(--gold)' : 'var(--faint)' }}>★</button>
                  {it.status !== 'approved' && <button title="تأیید" onClick={() => setStatusOf(it.id, 'approved')} style={{ background: 'transparent', border: '1px solid #5fd98a', color: '#5fd98a', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5 }}>✓</button>}
                  {it.status !== 'rejected' && <button title="رد" onClick={() => setStatusOf(it.id, 'rejected')} style={{ background: 'transparent', border: '1px solid #e7a14a', color: '#e7a14a', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5 }}>↧</button>}
                  <OutlineButton onClick={() => setEdit(it)} style={{ fontSize: 11.5, padding: '4px 11px' }}>ویرایش</OutlineButton>
                  <button title="حذف" onClick={() => del(it.id)} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pager {...pg} />
      </Card>

      {edit && <EditItemModal item={edit} onClose={() => setEdit(null)} onSave={saveEdit} />}
      {bulkOpen && <BulkEditModal count={sel.size} onClose={() => setBulkOpen(false)} onSave={bulkEditSave} />}
      {createOpen && <CreateItemModal onClose={() => setCreateOpen(false)} onSave={createItem} />}
    </div>
  )
}

// ساخت آیتم جدید — فرم فشرده با انتخاب نوع (آگهی/پروفایل/محصول/قیمت)
function CreateItemModal({ onClose, onSave }: { onClose: () => void; onSave: (d: { type: string; title: string; price?: string; location?: string; image?: string; url?: string; excerpt?: string }) => void }) {
  const [f, setF] = useState({ type: 'listing', title: '', price: '', location: '', image: '', url: '', excerpt: '' })
  const [busy, setBusy] = useState(false)
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  const submit = async () => {
    if (!f.title.trim() || busy) return
    setBusy(true)
    try { await onSave({ type: f.type, title: f.title.trim(), price: f.price || undefined, location: f.location || undefined, image: f.image || undefined, url: f.url || undefined, excerpt: f.excerpt || undefined }) }
    finally { setBusy(false) }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 520, margin: 'auto', animation: 'rise .25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>آگهی / آیتم جدید</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lab}>نوع</label>
              <select style={inp} value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
                <option value="listing">آگهی</option>
                <option value="directory">پروفایل/دفتر</option>
                <option value="product">محصول</option>
                <option value="price">قیمت</option>
              </select>
            </div>
            <div><label style={lab}>قیمت</label><input style={inp} value={f.price} onChange={e => setF({ ...f, price: e.target.value })} /></div>
          </div>
          <div><label style={lab}>عنوان *</label><input style={inp} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
          <div><label style={lab}>موقعیت</label><input style={inp} value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><ImageUpload label="تصویر" value={f.image} onChange={url => setF({ ...f, image: url })} /></div>
            <div><label style={lab}>لینک</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={f.url} onChange={e => setF({ ...f, url: e.target.value })} /></div>
          </div>
          <div><label style={lab}>توضیح</label><textarea style={{ ...inp, height: 70, resize: 'none' }} value={f.excerpt} onChange={e => setF({ ...f, excerpt: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <GoldButton onClick={submit} disabled={busy || !f.title.trim()} style={{ flex: 1 }}>{busy ? 'در حال ساخت…' : 'ساخت آیتم'}</GoldButton>
            <OutlineButton onClick={onClose}>انصراف</OutlineButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// ویرایش دسته‌ای: مقادیر پر‌شده روی همهٔ آیتم‌های انتخاب‌شده اعمال می‌شوند، فیلدهای خالی دست‌نخورده می‌مانند
function BulkEditModal({ count, onClose, onSave }: { count: number; onClose: () => void; onSave: (p: Record<string, string>) => void }) {
  const [f, setF] = useState({ category: '', location: '', price: '', status: '' })
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 460, margin: 'auto', animation: 'rise .25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>ویرایش دسته‌ای</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>روی {count.toLocaleString('fa-IR')} مورد انتخاب‌شده اعمال می‌شود. فیلدهای خالی تغییری نمی‌کنند.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={lab}>دسته‌بندی</label><input style={inp} placeholder="بدون تغییر" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /></div>
          <div><label style={lab}>موقعیت (شهر/محله)</label><input style={inp} placeholder="بدون تغییر" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></div>
          <div><label style={lab}>قیمت</label><input style={inp} placeholder="بدون تغییر" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} /></div>
          <div><label style={lab}>وضعیت</label>
            <select style={inp} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
              <option value="">بدون تغییر</option>
              <option value="approved">تأیید‌شده</option>
              <option value="pending">منتظر</option>
              <option value="rejected">رد‌شده</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <GoldButton onClick={() => onSave(f)} style={{ flex: 1 }}>اعمال روی {count.toLocaleString('fa-IR')} مورد</GoldButton>
            <OutlineButton onClick={onClose}>انصراف</OutlineButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditItemModal({ item, onClose, onSave }: { item: MItem; onClose: () => void; onSave: (p: any) => void }) {
  const [f, setF] = useState({ title: item.title || '', price: item.price || '', location: item.location || '', excerpt: item.excerpt || '', phone: item.phone || '', image: item.image || '', url: item.url || '' })
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 520, margin: 'auto', animation: 'rise .25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>ویرایش آیتم</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={lab}>عنوان</label><input style={inp} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lab}>قیمت</label><input style={inp} value={f.price} onChange={e => setF({ ...f, price: e.target.value })} /></div>
            <div><label style={lab}>موقعیت</label><input style={inp} value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lab}>تلفن</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
            <div><label style={lab}>لینک</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} value={f.url} onChange={e => setF({ ...f, url: e.target.value })} /></div>
          </div>
          <div><ImageUpload label="تصویر" value={f.image} onChange={url => setF({ ...f, image: url })} /></div>
          <div><label style={lab}>توضیح</label><textarea style={{ ...inp, height: 70, resize: 'none' }} value={f.excerpt} onChange={e => setF({ ...f, excerpt: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <GoldButton onClick={() => onSave(f)} style={{ flex: 1 }}>ذخیره تغییرات</GoldButton>
            <OutlineButton onClick={onClose}>انصراف</OutlineButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── GEO: مدیریت استان/شهر/منطقه/محله ─────────────────────────────────────
interface GeoDistrict { id: string; name: string; neighborhoods: string[] }
interface GeoCity { id: string; name: string; districts: GeoDistrict[] }
interface GeoProvince { id: string; name: string; cities: GeoCity[] }

function GeoCol({ title, items, selId, onSelect, onAdd, onRename, onDelete, addPlaceholder }: {
  title: string
  items: { id: string; name: string }[]
  selId: string | null
  onSelect: (id: string) => void
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  addPlaceholder: string
}) {
  const [val, setVal] = useState('')
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{title} <span style={{ color: 'var(--faint)', fontWeight: 400 }}>({items.length})</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto', marginBottom: 10 }}>
        {items.map(it => (
          <div key={it.id} onClick={() => onSelect(it.id)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
            padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
            background: selId === it.id ? 'var(--goldDim)' : 'transparent',
            border: `1px solid ${selId === it.id ? 'var(--gold)' : 'transparent'}`,
          }}>
            <span style={{ fontSize: 12.5, color: selId === it.id ? 'var(--gold)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
            <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={e => { e.stopPropagation(); const n = prompt('نام جدید:', it.name); if (n) onRename(it.id, n) }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>✎</button>
              <button onClick={e => { e.stopPropagation(); if (confirm(`حذف «${it.name}»؟`)) onDelete(it.id) }} style={{ background: 'transparent', border: 'none', color: '#e7674a', cursor: 'pointer', fontSize: 13 }}>×</button>
            </span>
          </div>
        ))}
        {items.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)', padding: '8px 4px' }}>موردی نیست</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal('') } }}
          placeholder={addPlaceholder} style={{ flex: 1, minWidth: 0, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 10px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal('') } }} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: 'var(--gold)', color: '#16140f', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
      </div>
    </div>
  )
}

function NeshanConfig() {
  const [masked, setMasked] = useState('')
  const [mapMasked, setMapMasked] = useState('')
  const [key, setKey] = useState('')
  const [mapKey, setMapKey] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/admin/neshan-config').then(r => r.ok ? r.json() : null).then(d => { if (d) { setMasked(d.masked); setMapMasked(d.mapMasked) } }) }, [])
  const save = async () => {
    setMsg('')
    const body: any = {}
    if (key.trim()) body.serviceKey = key.trim()
    if (mapKey.trim()) body.mapKey = mapKey.trim()
    if (!Object.keys(body).length) { setMsg('چیزی برای ذخیره نیست'); return }
    const r = await fetch('/api/admin/neshan-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) {
      setMsg('✓ ذخیره شد')
      if (key.trim()) { setMasked('***' + key.trim().slice(-4)); setKey('') }
      if (mapKey.trim()) { setMapMasked('***' + mapKey.trim().slice(-4)); setMapKey('') }
    } else setMsg('خطا در ذخیره')
  }
  const inp: React.CSSProperties = { flex: 1, minWidth: 220, direction: 'ltr', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>کلیدهای نشان (Neshan)</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.8 }}>
        نشان دو نوع کلید دارد و هرکدام جداست:
        <br />• <b>کلید سرویس</b> (<span style={{ direction: 'ltr', display: 'inline-block' }}>service.…</span>) برای جستجو، تشخیص محله و دسترسی‌های اطراف (زمان/فاصلهٔ واقعی).
        <br />• <b>کلید نقشه</b> (<span style={{ direction: 'ltr', display: 'inline-block' }}>web.…</span>) برای نمایش نقشه روی صفحهٔ آگهی. نقشه با کلید سرویس کار نمی‌کند.
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>کلید سرویس (Web-Service) {masked && <span style={{ color: '#5fd98a', fontWeight: 400 }}>— تنظیم‌شده ({masked})</span>}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={key} onChange={e => setKey(e.target.value)} placeholder="service.xxxxxxxx" style={inp} />
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>کلید نقشه (Map) {mapMasked && <span style={{ color: '#5fd98a', fontWeight: 400 }}>— تنظیم‌شده ({mapMasked})</span>}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={mapKey} onChange={e => setMapKey(e.target.value)} placeholder="web.xxxxxxxx" style={inp} />
        <GoldButton onClick={save}>ذخیره کلیدها</GoldButton>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</div>}
    </Card>
  )
}

function GeoView() {
  const [provinces, setProvinces] = useState<GeoProvince[]>([])
  const [pid, setPid] = useState<string | null>(null)
  const [cid, setCid] = useState<string | null>(null)
  const [did, setDid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const r = await fetch('/api/admin/geo')
    if (r.ok) setProvinces((await r.json()).provinces)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const act = async (body: any) => {
    const r = await fetch('/api/admin/geo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) setProvinces((await r.json()).provinces)
  }

  const prov = provinces.find(p => p.id === pid)
  const city = prov?.cities.find(c => c.id === cid)
  const dist = city?.districts.find(d => d.id === did)

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <NeshanConfig />
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
        ستون‌ها را از راست به چپ انتخاب کن: استان ← شهر ← منطقه ← محله. افزودن/ویرایش/حذف در هر ستون.
      </div>
      {loading ? <div style={{ color: 'var(--muted)' }}>در حال بارگذاری…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="mjsa-2col">
          <GeoCol title="استان" addPlaceholder="استان جدید"
            items={provinces.map(p => ({ id: p.id, name: p.name }))} selId={pid}
            onSelect={id => { setPid(id); setCid(null); setDid(null) }}
            onAdd={name => act({ action: 'addProvince', name })}
            onRename={(id, name) => act({ action: 'rename', level: 'province', pid: id, name })}
            onDelete={id => act({ action: 'delete', level: 'province', pid: id })} />

          <GeoCol title="شهر" addPlaceholder={pid ? 'شهر جدید' : 'اول استان'}
            items={(prov?.cities || []).map(c => ({ id: c.id, name: c.name }))} selId={cid}
            onSelect={id => { setCid(id); setDid(null) }}
            onAdd={name => pid && act({ action: 'addCity', pid, name })}
            onRename={(id, name) => act({ action: 'rename', level: 'city', pid, cid: id, name })}
            onDelete={id => act({ action: 'delete', level: 'city', pid, cid: id })} />

          <GeoCol title="منطقه" addPlaceholder={cid ? 'منطقه جدید' : 'اول شهر'}
            items={(city?.districts || []).map(d => ({ id: d.id, name: d.name }))} selId={did}
            onSelect={id => setDid(id)}
            onAdd={name => cid && act({ action: 'addDistrict', pid, cid, name })}
            onRename={(id, name) => act({ action: 'rename', level: 'district', pid, cid, did: id, name })}
            onDelete={id => act({ action: 'delete', level: 'district', pid, cid, did: id })} />

          <GeoCol title="محله" addPlaceholder={did ? 'محله جدید' : 'اول منطقه'}
            items={(dist?.neighborhoods || []).map(n => ({ id: n, name: n }))} selId={null}
            onSelect={() => {}}
            onAdd={name => did && act({ action: 'addNeighborhood', pid, cid, did, name })}
            onRename={(id, name) => act({ action: 'addNeighborhood', pid, cid, did, name }).then(() => act({ action: 'delete', level: 'neighborhood', pid, cid, did, name: id }))}
            onDelete={id => act({ action: 'delete', level: 'neighborhood', pid, cid, did, name: id })} />
        </div>
      )}
    </div>
  )
}

interface FieldRow { key: string; selector: string; attr: string }
type ScrTab = 'listing' | 'directory' | 'product' | 'article' | 'price'

function emptyForm(type: ScrTab) {
  return {
    name: '', url: '', type: type as string, category: 'مشاور',
    // آگهی‌ها از API دیوار، بقیهٔ بخش‌ها وب‌اسکرپ خودکار از هر سایتی
    method: type === 'listing' ? 'divar' : 'auto', schedule: 'manual',
    container: '', fields: [] as FieldRow[], meta: {} as Record<string, string>,
    pages: '1', useProxy: false,
  }
}

const FIELD_OPTIONS: { k: string; label: string }[] = [
  { k: 'title', label: 'عنوان' }, { k: 'price', label: 'قیمت' }, { k: 'location', label: 'موقعیت' },
  { k: 'image', label: 'تصویر' }, { k: 'url', label: 'لینک' }, { k: 'phone', label: 'تلفن' }, { k: 'excerpt', label: 'توضیح' },
]

// فیلدهای پیشنهادی (پیش‌فرض) برای هر بخش هنگام وب‌اسکرپ سفارشی (CSS)
const SECTION_FIELDS: Record<ScrTab, FieldRow[]> = {
  listing: [
    { key: 'title', selector: '', attr: 'text' }, { key: 'price', selector: '', attr: 'text' },
    { key: 'location', selector: '', attr: 'text' }, { key: 'image', selector: 'img', attr: 'src' }, { key: 'url', selector: 'a', attr: 'href' },
  ],
  directory: [
    { key: 'title', selector: '', attr: 'text' }, { key: 'phone', selector: '', attr: 'text' },
    { key: 'location', selector: '', attr: 'text' }, { key: 'image', selector: 'img', attr: 'src' }, { key: 'url', selector: 'a', attr: 'href' },
  ],
  product: [
    { key: 'title', selector: '', attr: 'text' }, { key: 'price', selector: '', attr: 'text' },
    { key: 'image', selector: 'img', attr: 'src' }, { key: 'url', selector: 'a', attr: 'href' },
  ],
  article: [
    { key: 'title', selector: '', attr: 'text' }, { key: 'excerpt', selector: '', attr: 'text' },
    { key: 'image', selector: 'img', attr: 'src' }, { key: 'url', selector: 'a', attr: 'href' },
  ],
  price: [
    { key: 'title', selector: '', attr: 'text' }, { key: 'price', selector: '', attr: 'text' }, { key: 'location', selector: '', attr: 'text' },
  ],
}
// راهنمای کوتاه هر بخش
const SECTION_HINT: Record<ScrTab, string> = {
  listing: 'آگهی‌های ملک — معمولاً از API دیوار. برای سایت‌های دیگر، روش «خودکار» یا «CSS سفارشی» را انتخاب کنید.',
  directory: 'پروفایل/دفتر (مشاور، حقوقی، وکیل، بیمه…) از هر سایتی: صفحهٔ لیست را بدهید، فیلدها را نگاشت کنید (نام، تلفن، آدرس).',
  product: 'محصولات فروشگاهی از هر فروشگاه آنلاین: روش «خودکار» اغلب قیمت/عکس را از JSON-LD می‌گیرد؛ در غیر این صورت CSS سفارشی.',
  article: 'مقاله/خبر از هر خبرگزاری یا وبلاگ: اگر سایت RSS دارد روش «RSS» سریع‌ترین است، وگرنه «خودکار».',
  price: 'قیمت/آمار بازار از هر منبع: صفحهٔ جدول قیمت را بدهید و فیلدها را نگاشت کنید (عنوان، قیمت، منطقه).',
}

function ZarinpalConfig() {
  const [merchantId, setMerchantId] = useState('')
  const [masked, setMasked] = useState('')
  const [sandbox, setSandbox] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    fetch('/api/admin/zarinpal-config').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setMasked(d.merchantId || ''); setSandbox(!!d.sandbox); setConfigured(!!d.configured) }
    })
  }, [])
  const save = async () => {
    setMsg('')
    const r = await fetch('/api/admin/zarinpal-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchantId: merchantId || masked, sandbox }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { setMsg('✓ ذخیره شد'); setConfigured(true) } else setMsg(d.error || 'خطا')
  }
  const inp = { flex: 1, minWidth: 220, direction: 'ltr' as const, textAlign: 'left' as const, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>درگاه پرداخت زرین‌پال {configured ? <span style={{ color: '#5fd98a', fontSize: 12 }}>● تنظیم‌شده</span> : <span style={{ color: '#e7a14a', fontSize: 12 }}>● تنظیم نشده</span>}</div>
        <span style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.8 }}>برای خرید/ارتقای پلن، مرچنت‌کدِ زرین‌پال را اینجا بگذار (از پنل زرین‌پال). برای تست، «سندباکس» را روشن کن.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={merchantId} onChange={e => setMerchantId(e.target.value)} placeholder={masked || 'Merchant ID (xxxxxxxx-xxxx-…)'} style={inp} />
            <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={sandbox} onChange={e => setSandbox(e.target.checked)} /> سندباکس</label>
            <GoldButton onClick={save}>ذخیره</GoldButton>
          </div>
          {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</div>}
        </div>
      )}
    </Card>
  )
}

function ImgbbConfig() {
  const [key, setKey] = useState('')
  const [masked, setMasked] = useState('')
  const [configured, setConfigured] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    fetch('/api/admin/imgbb-config').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setMasked(d.apiKey || ''); setConfigured(!!d.configured) }
    })
  }, [])
  const save = async () => {
    setMsg('')
    const r = await fetch('/api/admin/imgbb-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key || masked }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok) { setMsg('✓ ذخیره شد'); setConfigured(true) } else setMsg(d.error || 'خطا')
  }
  const inp = { flex: 1, minWidth: 200, direction: 'ltr' as const, textAlign: 'left' as const, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>imgbb (میزبانی عکس برای «ساخت پلان از روی عکس») {configured ? <span style={{ color: '#5fd98a', fontSize: 12 }}>● تنظیم‌شده</span> : <span style={{ color: '#e7a14a', fontSize: 12 }}>● تنظیم نشده</span>}</div>
        <span style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.8 }}>برای تحلیل عکس در سایت‌ساز، عکس‌ها روی imgbb آپلود می‌شوند تا سرویس بینایی بتواند بخواندشان. در <b style={{ direction: 'ltr', display: 'inline-block' }}>imgbb.com</b> ثبت‌نام کن → <b style={{ direction: 'ltr', display: 'inline-block' }}>About → API</b> → یک API key رایگان بساز و اینجا بگذار.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={key} onChange={e => setKey(e.target.value)} placeholder={masked || 'imgbb API key'} style={inp} />
            <GoldButton onClick={save}>ذخیره</GoldButton>
          </div>
          {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</div>}
        </div>
      )}
    </Card>
  )
}

function DivarProxyConfig() {
  const [url, setUrl] = useState('')
  const [saved, setSaved] = useState('')
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => { fetch('/api/admin/divar-config').then(r => r.ok ? r.json() : null).then(d => d && setSaved(d.proxyUrl || '')) }, [])
  const save = async () => {
    setMsg('')
    const r = await fetch('/api/admin/divar-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proxyUrl: url }) })
    if (r.ok) { setMsg('✓ ذخیره شد'); setSaved(url) } else setMsg('خطا')
  }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>پروکسی دیوار {saved ? <span style={{ color: '#5fd98a', fontSize: 12 }}>● تنظیم‌شده</span> : <span style={{ color: '#e7a14a', fontSize: 12 }}>● تنظیم نشده</span>}</div>
        <span style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>چون دیوار فقط از طریق پروکسی در دسترس است، آدرس پروکسی سرور را اینجا بگذار (مثلاً <span style={{ direction: 'ltr', display: 'inline-block' }}>http://127.0.0.1:8889</span>). برای پیداکردنش روی سرور بزن: <span style={{ direction: 'ltr', display: 'inline-block' }}>proxy-on; env | grep -i proxy</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder={saved || 'http://host:port'} style={{ flex: 1, minWidth: 220, direction: 'ltr', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <GoldButton onClick={save}>ذخیره</GoldButton>
          </div>
          {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</div>}
        </div>
      )}
    </Card>
  )
}

function ScraperView() {
  const [tab, setTab] = useState<ScrTab>('listing')
  const [sources, setSources] = useState<ScrSource[]>([])
  const [items, setItems] = useState<ScrItem[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | 'all' | null>(null)
  const [log, setLog] = useState<{ source: string; ok: boolean; added: number; dup: number; error?: string }[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(() => emptyForm('listing'))
  const [formErr, setFormErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ loading: boolean; count?: number; items?: any[]; error?: string } | null>(null)
  const [cats, setCats] = useState<string[]>([])
  const [newCat, setNewCat] = useState('')
  const [divarCities, setDivarCities] = useState<{ id: number; name: string }[]>([])
  const [divarDistricts, setDivarDistricts] = useState<{ id: number; name: string; lat?: number; lng?: number }[]>([])
  const [placesSummary, setPlacesSummary] = useState<{ cities: number; citiesWithDistricts: number } | null>(null)
  const [importing, setImporting] = useState('')

  const loadPlaces = async () => {
    const r = await fetch('/api/admin/divar-places')
    if (r.ok) { const d = await r.json(); setDivarCities(d.cities || []); setPlacesSummary(d.summary) }
  }
  const loadDistrictsFor = async (cityId: string) => {
    if (!cityId) { setDivarDistricts([]); return }
    let r = await fetch(`/api/admin/divar-places?cityId=${cityId}`)
    let d = r.ok ? await r.json() : { districts: [] }
    if (!d.districts?.length) {  // not cached yet → fetch from Divar
      await fetch('/api/admin/divar-places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'districts', cityId }) })
      r = await fetch(`/api/admin/divar-places?cityId=${cityId}`); d = r.ok ? await r.json() : { districts: [] }
    }
    setDivarDistricts(d.districts || [])
  }
  const importAllPlaces = async () => {
    setImporting('در حال دریافت شهرها…')
    const cr = await fetch('/api/admin/divar-places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cities' }) })
    const cd = await cr.json()
    if (!cd.ok) { setImporting(`خطا: ${cd.error || ''}`); return }
    await loadPlaces()
    const r2 = await fetch('/api/admin/divar-places'); const all = await r2.json()
    const cities = all.cities || []
    for (let i = 0; i < cities.length; i++) {
      setImporting(`دریافت محله‌ها… ${i + 1}/${cities.length} (${cities[i].name})`)
      await fetch('/api/admin/divar-places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'districts', cityId: cities[i].id }) }).catch(() => {})
    }
    await loadPlaces()
    setImporting('✓ کامل شد')
  }

  const loadCats = async () => {
    const r = await fetch('/api/admin/scraper/categories')
    if (r.ok) setCats((await r.json()).categories)
  }
  useEffect(() => { loadCats(); loadPlaces() }, [])

  const addNewCategory = async () => {
    const n = newCat.trim()
    if (!n) return
    const r = await fetch('/api/admin/scraper/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }),
    })
    if (r.ok) { setCats((await r.json()).categories); setForm(f => ({ ...f, category: n })); setNewCat('') }
  }

  const loadSources = async () => {
    const r = await fetch('/api/admin/scraper/sources')
    if (r.ok) setSources((await r.json()).sources)
  }
  const loadItems = async (t: string) => {
    const r = await fetch(`/api/admin/scraper/items?type=${t}`)
    if (r.ok) setItems((await r.json()).items)
  }

  useEffect(() => { (async () => { setLoading(true); await loadSources(); await loadItems(tab); setLoading(false) })() }, [])
  useEffect(() => { loadItems(tab) }, [tab])

  const run = async (id?: string) => {
    setRunning(id || 'all'); setLog([])
    try {
      const r = await fetch('/api/admin/scraper/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {}),
      })
      const d = await r.json()
      if (!r.ok) { setLog([{ source: '—', ok: false, added: 0, dup: 0, error: d.error }]); return }
      setLog(d.results || [])
      if (d.sources) setSources(d.sources)
      await loadItems(tab)
      // آگهی‌های تازه‌واکشی‌شده روی سرور بلافاصله توسط AI تأیید/رد شده‌اند
      if (d.moderated > 0) {
        setLog(l => [...l, { source: `🤖 ${d.moderated} آگهی بلافاصله توسط AI بررسی (تأیید/رد) شد`, ok: true, added: 0, dup: 0 }])
        await loadItems(tab)
      }
    } catch {
      setLog([{ source: '—', ok: false, added: 0, dup: 0, error: 'خطای ارتباط با سرور' }])
    } finally { setRunning(null) }
  }

  const formPayload = () => ({
    name: form.name, url: form.url, type: form.type, category: form.category,
    method: form.method, schedule: form.schedule,
    container: form.container,
    fields: form.fields.filter(f => f.key && f.selector.trim()),
    meta: Object.fromEntries(Object.entries(form.meta).filter(([, v]) => v && v.trim())),
    pages: form.pages, useProxy: form.useProxy,
  })

  const addSource = async () => {
    setFormErr('')
    if (!form.name.trim() || !form.url.trim()) { setFormErr('نام و آدرس الزامی است'); return }
    if (form.method === 'css' && !form.container.trim()) { setFormErr('برای روش CSS، انتخابگر کانتینر الزامی است'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/scraper/sources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formPayload()),
      })
      const d = await r.json()
      if (!r.ok) { setFormErr(d.error || 'خطا در ذخیره'); return }
      setModal(false); setForm(emptyForm(tab)); setPreview(null)
      await loadSources()
    } finally { setSaving(false) }
  }

  const testSource = async () => {
    setPreview({ loading: true })
    try {
      const r = await fetch('/api/admin/scraper/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formPayload()),
      })
      const d = await r.json()
      if (d.ok) setPreview({ loading: false, count: d.count, items: d.items })
      else setPreview({ loading: false, error: d.error || 'خطا' })
    } catch {
      setPreview({ loading: false, error: 'خطای ارتباط' })
    }
  }

  const wipe = async (scope: 'all' | 'tab') => {
    const msg = scope === 'all' ? 'همهٔ دیتاهای واکشی‌شده (و دموها) پاک شوند؟' : `همهٔ آیتم‌های «${TYPE_META[tab].label}» پاک شوند؟`
    if (!confirm(msg)) return
    await fetch('/api/admin/scraper/clear', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scope === 'tab' ? { type: tab } : {}),
    })
    await loadItems(tab); await loadSources()
  }

  // field/meta row helpers
  const addField = () => setForm({ ...form, fields: [...form.fields, { key: 'title', selector: '', attr: 'text' }] })
  const setField = (i: number, patch: Partial<FieldRow>) =>
    setForm({ ...form, fields: form.fields.map((f, idx) => idx === i ? { ...f, ...patch } : f) })
  const delField = (i: number) => setForm({ ...form, fields: form.fields.filter((_, idx) => idx !== i) })
  const setMeta = (k: string, v: string) => setForm({ ...form, meta: { ...form.meta, [k]: v } })

  const removeSource = async (id: string) => {
    await fetch(`/api/admin/scraper/sources?id=${id}`, { method: 'DELETE' })
    await loadSources()
  }
  const toggleSource = async (s: ScrSource) => {
    await fetch('/api/admin/scraper/sources', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, patch: { enabled: !s.enabled } }),
    })
    await loadSources()
  }
  const editSource = async (s: ScrSource) => {
    const name = prompt('نام منبع:', s.name)
    if (name === null) return
    const schedule = prompt('زمان‌بندی (manual / hourly / 6h / daily):', s.schedule) || s.schedule
    await fetch('/api/admin/scraper/sources', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, patch: { name, schedule } }),
    })
    await loadSources()
  }
  const setItemStatus = async (id: string, status: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status } : i))
    await fetch('/api/admin/scraper/items', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }),
    })
  }

  const tabSources = sources.filter(s => s.type === tab)
  const inputCss: React.CSSProperties = {
    width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10,
    padding: '10px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }
  const labelCss: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 6, display: 'block', fontWeight: 600 }
  const pg = usePaged(items)
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <DivarProxyConfig />
      {/* KPI */}
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <KPI label="کل منابع" value={sources.length.toString()} trend={`${sources.filter(s => s.enabled).length} فعال`} icon="◈" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" trendUp />
        <KPI label="آگهی‌ها" value={sources.filter(s => s.type === 'listing').reduce((a, s) => a + s.lastCount, 0).toString()} trend="آخرین واکشی" icon="⌂" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" />
        <KPI label="مقالات" value={sources.filter(s => s.type === 'article').reduce((a, s) => a + s.lastCount, 0).toString()} trend="آخرین واکشی" icon="✦" iconBg="var(--goldDim)" iconColor="var(--gold)" />
        <KPI label="منابع دارای خطا" value={sources.filter(s => s.status === 'error').length.toString()} trend="نیاز به بررسی" icon="⚠" iconBg="rgba(231,103,74,.15)" iconColor="#e7674a" />
      </div>

      {/* Toolbar */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>موتور اسکرپ هوشمند</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>وب‌اسکرپ از هر سایتی — آگهی، پروفایل، فروشگاه، مقاله و قیمت (دیوار API · CSS سفارشی · JSON-LD · OpenGraph · RSS · چندصفحه‌ای)</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={importAllPlaces} style={{ background: 'transparent', color: '#5b9bd5', border: '1px solid rgba(91,155,213,.4)', borderRadius: 11, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {importing ? importing : `📥 دریافت شهر/محله‌های ایران${placesSummary ? ` (${placesSummary.citiesWithDistricts}/${placesSummary.cities})` : ''}`}
            </button>
            <button onClick={() => wipe('all')} style={{ background: 'transparent', color: '#e7674a', border: '1px solid rgba(231,103,74,.35)', borderRadius: 11, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              🗑 حذف همه دیتاها
            </button>
            <OutlineButton onClick={() => run()} style={{ opacity: running ? .6 : 1, pointerEvents: running ? 'none' : 'auto' }}>
              {running === 'all' ? '⏳ در حال اجرا…' : '▶ اجرای همه فعال‌ها'}
            </OutlineButton>
            <GoldButton onClick={() => { setForm(emptyForm(tab)); setFormErr(''); setPreview(null); setModal(true) }}>
              + افزودن منبع
            </GoldButton>
          </div>
        </div>

        {/* run log */}
        {log.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {log.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, background: 'var(--bg2)', borderRadius: 9, padding: '8px 12px' }}>
                <span style={{ color: l.ok ? '#5fd98a' : '#e7674a' }}>{l.ok ? '✓' : '✕'}</span>
                <span style={{ fontWeight: 600 }}>{l.source}</span>
                {l.ok
                  ? <span style={{ color: 'var(--muted)' }}>{l.added} مورد جدید · {l.dup} تکراری</span>
                  : <span style={{ color: '#e7674a' }}>{l.error}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tabs */}
      <div className="mjsa-roles" style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto' }}>
        {(['listing', 'directory', 'product', 'article', 'price'] as const).map(t => {
          const m = TYPE_META[t]; const active = tab === t
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 11,
              border: `1px solid ${active ? m.color : 'var(--line2)'}`, whiteSpace: 'nowrap',
              background: active ? `${m.color}1a` : 'transparent', color: active ? m.color : 'var(--muted)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span>{m.icon}</span>{m.label}
              <span style={{ fontSize: 11, opacity: .8 }}>({sources.filter(s => s.type === t).length})</span>
            </button>
          )
        })}
      </div>

      {/* Sources for active tab */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>منابع {TYPE_META[tab].label}</div>
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>در حال بارگذاری…</div>
        ) : tabSources.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            هنوز منبعی برای این بخش اضافه نشده. روی «+ افزودن منبع» بزنید.
          </div>
        ) : (
          <div className="mjsa-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['منبع', 'روش', 'زمان‌بندی', 'آخرین اجرا', 'نتیجه', 'فعال', ''].map(h => (
                    <th key={h} style={{ textAlign: 'right', padding: '8px 8px', fontSize: 12, color: 'var(--faint)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabSources.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                      <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--faint)', textDecoration: 'none', direction: 'ltr', display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</a>
                      {s.status === 'error' && s.lastError && <div style={{ fontSize: 10.5, color: '#e7674a', marginTop: 3 }}>⚠ {s.lastError}</div>}
                    </td>
                    <td style={{ padding: '12px 8px' }}><Badge label={METHOD_LABEL[s.method]} color="#5b9bd5" /></td>
                    <td style={{ padding: '12px 8px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{SCHEDULE_LABEL[s.schedule]}</td>
                    <td style={{ padding: '12px 8px', fontSize: 12, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{timeAgo(s.lastRun)}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <Badge label={s.status === 'error' ? 'خطا' : s.status === 'ok' ? `${s.lastCount} مورد` : 'آماده'} color={s.status === 'error' ? '#e7674a' : s.status === 'ok' ? '#5fd98a' : 'var(--faint)'} />
                    </td>
                    <td style={{ padding: '12px 8px' }}><Toggle on={s.enabled} onChange={() => toggleSource(s)} /></td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <OutlineButton onClick={() => run(s.id)} style={{ fontSize: 11.5, padding: '5px 11px', opacity: running ? .6 : 1, pointerEvents: running ? 'none' : 'auto' }}>
                          {running === s.id ? '⏳' : 'اجرا'}
                        </OutlineButton>
                        <button onClick={() => editSource(s)} style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 9, border: '1px solid var(--line2)', color: 'var(--muted)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>ویرایش</button>
                        <button onClick={() => removeSource(s.id)} style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 9, border: '1px solid rgba(231,103,74,.3)', color: '#e7674a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Scraped items for active tab */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{TYPE_META[tab].label} واکشی‌شده ({items.length})</div>
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>به‌ترتیب جدیدترین</span>
        </div>
        {items.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            هنوز موردی واکشی نشده. یک منبع اجرا کنید تا نتایج اینجا نمایش داده شود.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pg.paged.map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
                {it.image
                  ? <img src={it.image} alt="" style={{ width: 46, height: 46, borderRadius: 9, objectFit: 'cover', flexShrink: 0, background: 'var(--line)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : <span style={{ width: 46, height: 46, borderRadius: 9, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: TYPE_META[tab].color, fontSize: 18 }}>{TYPE_META[tab].icon}</span>}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <a href={it.url || '#'} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', display: 'block', lineHeight: 1.5 }}>{it.title}</a>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {it.location && <span>📍 {it.location} · </span>}{it.sourceName} · {timeAgo(it.scrapedAt)}
                  </div>
                </div>
                {it.price && <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 13, whiteSpace: 'nowrap' }}>{it.price}</span>}
                <Badge label={ITEM_STATUS[it.status]?.label || it.status} color={ITEM_STATUS[it.status]?.color || 'var(--faint)'} />
                {it.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setItemStatus(it.id, 'approved')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #5fd98a', color: '#5fd98a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>تأیید</button>
                    <button onClick={() => setItemStatus(it.id, 'rejected')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #e7674a', color: '#e7674a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>رد</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Pager {...pg} />
      </Card>

      {/* Add-source modal — detailed configurator */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 560, margin: 'auto', animation: 'rise .25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>افزودن منبع — پیکربندی دقیق</div>
              <button onClick={() => setModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelCss}>نام منبع</label>
                  <input style={inputCss} placeholder="مثلاً: دیوار - وکلای تهران" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label style={labelCss}>نوع محتوا</label>
                  <select style={inputCss} value={form.type} onChange={e => setForm({ ...form, type: e.target.value, meta: {} })}>
                    <option value="listing">آگهی ملک</option>
                    <option value="directory">پروفایل / دفتر (مشاور، حقوقی، وکیل…)</option>
                    <option value="product">محصول فروشگاه</option>
                    <option value="article">مقاله / خبر</option>
                    <option value="price">قیمت / آمار</option>
                  </select>
                </div>
              </div>

              {/* راهنمای بخش انتخاب‌شده */}
              <div style={{ background: 'var(--goldDim)', border: '1px solid rgba(212,175,55,.25)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{TYPE_META[form.type as ScrTab]?.icon} {TYPE_META[form.type as ScrTab]?.label}: </span>
                {SECTION_HINT[form.type as ScrTab]}
              </div>

              {form.method !== 'divar' && (
                <div>
                  <label style={labelCss}>آدرس دقیق صفحه (URL)</label>
                  <input style={{ ...inputCss, direction: 'ltr', textAlign: 'left' }} placeholder="https://example.com/list?page={page}" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>آدرس صفحهٔ لیست هر سایتی را بگذارید. برای واکشی چندصفحه‌ای می‌توانید <span style={{ direction: 'ltr', display: 'inline-block' }}>{'{page}'}</span> را در آدرس بگذارید (مثلاً <span style={{ direction: 'ltr', display: 'inline-block' }}>?page={'{page}'}</span>)؛ اگر نگذارید، خودکار <span style={{ direction: 'ltr', display: 'inline-block' }}>?page=N</span> اضافه می‌شود.</div>
                </div>
              )}

              {/* ── کانکتور دیوار: شهر + دسته + محله (از دیتابیس دیوار) ── */}
              {form.method === 'divar' && (
                <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14 }}>
                  <label style={labelCss}>تنظیمات دیوار — انتخاب از دیتابیس شهر/محلهٔ دیوار</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <select style={inputCss} value={form.meta['city_id'] || ''} onChange={e => {
                      const c = divarCities.find(x => String(x.id) === e.target.value)
                      setForm({ ...form, meta: { ...form.meta, city_id: e.target.value, 'شهر': c?.name || '', district_id: '', 'محله': '' } })
                      loadDistrictsFor(e.target.value)
                    }}>
                      <option value="">انتخاب شهر…</option>
                      {(divarCities.length ? divarCities : DIVAR_CITIES.map(c => ({ id: Number(c.id), name: c.name }))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select style={inputCss} value={form.meta['category'] || 'apartment-rent'} onChange={e => setMeta('category', e.target.value)}>
                      {DIVAR_CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                    </select>
                  </div>
                  <select style={{ ...inputCss, marginTop: 10 }} value={form.meta['district_id'] || ''} disabled={!form.meta['city_id']} onChange={e => {
                    const d = divarDistricts.find(x => String(x.id) === e.target.value)
                    setForm({ ...form, meta: { ...form.meta, district_id: e.target.value, 'محله': d?.name || '', lat: d?.lat ? String(d.lat) : '', lng: d?.lng ? String(d.lng) : '' } })
                  }}>
                    <option value="">{form.meta['city_id'] ? (divarDistricts.length ? 'انتخاب محله (همه محله‌ها)…' : 'در حال بارگذاری محله‌ها…') : 'اول شهر را انتخاب کن'}</option>
                    {divarDistricts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>محله را از لیست انتخاب کن — کد دقیق دیوار خودکار اعمال می‌شود. (یا آدرس نقشهٔ دیوار را در فیلد URL بالا بگذار.)</div>
                </div>
              )}

              {/* ── دسته‌بندی برای دایرکتوری (مشاور/حقوقی/وکیل/بیمه…) با امکان افزودن ── */}
              {form.type === 'directory' && (
                <div>
                  <label style={labelCss}>دسته‌بندی (می‌توانید دستهٔ جدید بسازید)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
                    {cats.map(c => (
                      <button key={c} onClick={() => setForm({ ...form, category: c })} style={{
                        padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
                        border: `1px solid ${form.category === c ? 'var(--gold)' : 'var(--line2)'}`,
                        background: form.category === c ? 'var(--goldDim)' : 'transparent',
                        color: form.category === c ? 'var(--gold)' : 'var(--muted)', fontWeight: form.category === c ? 700 : 500,
                      }}>{c}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={inputCss} placeholder="دستهٔ جدید (مثلاً: وکیل، بیمه، کارشناس رسمی)" value={newCat}
                      onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addNewCategory() }} />
                    <OutlineButton onClick={addNewCategory}>+ افزودن دسته</OutlineButton>
                  </div>
                </div>
              )}

              {/* ── جزئیات آگهی: نوع معامله / نوع ملک / استان / شهر / محله (کشویی) ── */}
              {form.type === 'listing' && (
                <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14 }}>
                  <label style={labelCss}>جزئیات آگهی — این مقادیر روی همهٔ آگهی‌های این منبع نشانده می‌شود</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <select style={inputCss} value={form.meta['نوع معامله'] || ''} onChange={e => setMeta('نوع معامله', e.target.value)}>
                      <option value="">نوع معامله…</option>
                      {DEAL_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select style={inputCss} value={form.meta['نوع ملک'] || ''} onChange={e => setMeta('نوع ملک', e.target.value)}>
                      <option value="">نوع ملک…</option>
                      {PROPERTY_KINDS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select style={inputCss} value={form.meta['استان'] || ''}
                      onChange={e => setForm({ ...form, meta: { ...form.meta, 'استان': e.target.value, 'شهر': '', 'محله': '' } })}>
                      <option value="">استان…</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select style={inputCss} value={form.meta['شهر'] || ''} disabled={!form.meta['استان']}
                      onChange={e => setForm({ ...form, meta: { ...form.meta, 'شهر': e.target.value, 'محله': '' } })}>
                      <option value="">{form.meta['استان'] ? 'شهر…' : 'اول استان را انتخاب کنید'}</option>
                      {citiesOf(form.meta['استان'] || '').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select style={{ ...inputCss, gridColumn: '1 / -1' }} value={form.meta['محله'] || ''} disabled={!form.meta['شهر']}
                      onChange={e => setMeta('محله', e.target.value)}>
                      <option value="">{form.meta['شهر'] ? 'محله / منطقه…' : 'اول شهر را انتخاب کنید'}</option>
                      {neighborhoodsOf(form.meta['شهر'] || '').map(n => <option key={n} value={n}>{n}</option>)}
                      {form.meta['شهر'] && <option value="__custom__">+ محلهٔ دیگر (دستی)…</option>}
                    </select>
                    {form.meta['محله'] === '__custom__' && (
                      <input style={{ ...inputCss, gridColumn: '1 / -1' }} placeholder="نام محله را تایپ کنید" autoFocus
                        onChange={e => setMeta('محله', e.target.value)} />
                    )}
                  </div>
                </div>
              )}

              {/* ── شهر برای دایرکتوری/مقاله/قیمت (اختیاری) ── */}
              {form.type !== 'listing' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select style={inputCss} value={form.meta['استان'] || ''}
                    onChange={e => setForm({ ...form, meta: { ...form.meta, 'استان': e.target.value, 'شهر': '' } })}>
                    <option value="">استان (اختیاری)…</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select style={inputCss} value={form.meta['شهر'] || ''} disabled={!form.meta['استان']}
                    onChange={e => setMeta('شهر', e.target.value)}>
                    <option value="">شهر (اختیاری)…</option>
                    {citiesOf(form.meta['استان'] || '').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelCss}>روش استخراج</label>
                  <select style={inputCss} value={form.method} onChange={e => { setForm({ ...form, method: e.target.value }); setPreview(null) }}>
                    <option value="auto">خودکار (تشخیص داده)</option>
                    <option value="divar">دیوار (API رسمی)</option>
                    <option value="css">CSS سفارشی (دقیق، با انتخابگر)</option>
                    <option value="jsonld">JSON-LD</option>
                    <option value="og">OpenGraph</option>
                    <option value="rss">RSS / خبرخوان</option>
                  </select>
                </div>
                <div>
                  <label style={labelCss}>زمان‌بندی اجرا</label>
                  <select style={inputCss} value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })}>
                    <option value="manual">فقط دستی</option>
                    <option value="hourly">هر ساعت</option>
                    <option value="6h">هر ۶ ساعت</option>
                    <option value="daily">روزانه</option>
                  </select>
                </div>
              </div>

              {/* واکشی چندصفحه‌ای + پروکسی — برای وب‌اسکرپ هر سایتی */}
              {form.method !== 'divar' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={labelCss}>تعداد صفحات (واکشی چندصفحه‌ای)</label>
                    <input type="number" min={1} max={20} style={{ ...inputCss, direction: 'ltr', textAlign: 'left' }} value={form.pages} onChange={e => setForm({ ...form, pages: e.target.value })} />
                    <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>۱ یعنی فقط همان صفحه. بیشتر = پیمایش خودکار صفحات بعدی تا پایان نتایج.</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}>
                    <Toggle on={form.useProxy} onChange={v => setForm({ ...form, useProxy: v })} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>واکشی از طریق پروکسی</div>
                      <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>برای سایت‌های فیلتر/غیرقابل‌دسترس مستقیم (از پروکسی دیوار استفاده می‌شود).</div>
                    </div>
                  </div>
                </div>
              )}

              {/* CSS detailed config */}
              {form.method === 'css' && (
                <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelCss}>انتخابگر کانتینر هر آیتم</label>
                    <input style={{ ...inputCss, direction: 'ltr', textAlign: 'left' }} placeholder=".post-card  یا  article.listing" value={form.container} onChange={e => setForm({ ...form, container: e.target.value })} />
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>هر کارت/ردیف در صفحه (مثلاً <span style={{ direction: 'ltr', display: 'inline-block' }}>.kt-post-card</span>).</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 6, flexWrap: 'wrap' }}>
                      <label style={{ ...labelCss, marginBottom: 0 }}>نگاشت فیلدها (انتخابگر داخل کانتینر)</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setForm({ ...form, fields: SECTION_FIELDS[form.type as ScrTab].map(f => ({ ...f })) })} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--line2)', color: 'var(--muted)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>↻ فیلدهای پیش‌فرض این بخش</button>
                        <button onClick={addField} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--gold)', color: 'var(--gold)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>+ فیلد</button>
                      </div>
                    </div>
                    {form.fields.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>حداقل فیلد «عنوان» را اضافه کنید.</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {form.fields.map((f, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 78px 28px', gap: 6, alignItems: 'center' }}>
                          <select style={{ ...inputCss, padding: '8px 8px' }} value={f.key} onChange={e => setField(i, { key: e.target.value })}>
                            {FIELD_OPTIONS.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
                          </select>
                          <input style={{ ...inputCss, padding: '8px 10px', direction: 'ltr', textAlign: 'left' }} placeholder=".title a" value={f.selector} onChange={e => setField(i, { selector: e.target.value })} />
                          <input style={{ ...inputCss, padding: '8px 8px', direction: 'ltr', textAlign: 'left' }} placeholder="text" value={f.attr} onChange={e => setField(i, { attr: e.target.value })} />
                          <button onClick={() => delField(i)} style={{ background: 'transparent', border: 'none', color: '#e7674a', fontSize: 16, cursor: 'pointer' }}>×</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6, lineHeight: 1.7 }}>
                      ستون سوم = منبع مقدار: <b>text</b> برای متن، <b>href</b> برای لینک، <b>src</b> برای تصویر، یا نام هر صفت دیگر.
                    </div>
                  </div>
                </div>
              )}

              {/* Test / preview */}
              <div>
                <OutlineButton onClick={testSource} style={{ width: '100%', opacity: preview?.loading ? .6 : 1, pointerEvents: preview?.loading ? 'none' : 'auto' }}>
                  {preview?.loading ? '⏳ در حال تست…' : '🔍 تست و پیش‌نمایش نتیجه'}
                </OutlineButton>
                {preview && !preview.loading && (
                  <div style={{ marginTop: 10, background: 'var(--bg2)', borderRadius: 10, padding: 12, maxHeight: 220, overflowY: 'auto' }}>
                    {preview.error
                      ? <div style={{ color: '#e7674a', fontSize: 12.5 }}>⚠ {preview.error}</div>
                      : preview.count === 0
                        ? <div style={{ color: '#e7a14a', fontSize: 12.5 }}>هیچ موردی استخراج نشد — انتخابگرها را بررسی کنید.</div>
                        : <>
                            <div style={{ fontSize: 12, color: '#5fd98a', marginBottom: 8 }}>✓ {preview.count} مورد یافت شد — نمونه:</div>
                            {preview.items?.map((it, i) => (
                              <div key={i} style={{ borderBottom: '1px solid var(--line)', padding: '6px 0', fontSize: 12 }}>
                                <div style={{ fontWeight: 600 }}>{it.title}</div>
                                <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                                  {[it.price, it.location, it.phone].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                            ))}
                          </>}
                  </div>
                )}
              </div>

              {formErr && <div style={{ color: '#e7674a', fontSize: 12.5 }}>⚠ {formErr}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <GoldButton onClick={addSource} style={{ flex: 1, opacity: saving ? .6 : 1, pointerEvents: saving ? 'none' : 'auto' }}>{saving ? 'در حال ذخیره…' : 'افزودن و ذخیره'}</GoldButton>
                <OutlineButton onClick={() => setModal(false)}>انصراف</OutlineButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── پرشین سازه (سازنده‌ها) — builder profiles scraped from external site ────
interface PSProject {
  hashId: string; address?: string; receptor?: string; cityId?: number; regionId?: number; subRegionId?: number; phaseId?: number; usageTypeId?: number; structureTypeId?: number; groundArea?: number; residentialArea?: number; floors?: number; subFloors?: number; units?: number; latitude?: number; longitude?: number; lastUpdateDate?: string; photo?: { imageUrl?: string; imageThumbnailUrl?: string }; hasAvailableConstructor?: boolean; regionLabel?: string; phaseLabel?: string
}
interface PSProfile { id: string; name: string; phone?: string; phoneRevealedAt?: string; projectCount: number; regions: number[]; projects: PSProject[] }
interface PSConfig { user: string; pass: string; hasPass: boolean; enabled: boolean; channel: string; limit: number; weeklyQuota: number; lastScrapeAt?: string }
interface PSState {
  config: PSConfig
  running: boolean
  revealing: boolean
  data: { lastSync?: string; totalProjects: number; totalBuilders: number }
  profiles: { builders: number; withPhone: number; projects: number; revealedProjects?: number; pendingProjects?: number; quotaAvailable?: number | null; lastRevealAt?: string; accounts?: number }
  log: string
  revealLog: string
}

function PersianSazeView() {
  const [st, setSt] = useState<PSState | null>(null)
  const [pass, setPass] = useState('')
  const [user, setUser] = useState('')
  const [limit, setLimit] = useState('20')
  const [quota, setQuota] = useState('500')
  const [enabled, setEnabled] = useState(false)
  const inited = useRef(false)
  const [cfgMsg, setCfgMsg] = useState('')
  const [scrapeMsg, setScrapeMsg] = useState('')
  const [rebuildMsg, setRebuildMsg] = useState('')
  const [revealMsg, setRevealMsg] = useState('')
  const [acctMsg, setAcctMsg] = useState('')

  // profiles list
  const [rows, setRows] = useState<PSProfile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState('')
  const [onlyPhone, setOnlyPhone] = useState(false)
  const [detail, setDetail] = useState<PSProfile | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
  const regionLabel = (r: number) => (r > 100 && r < 123) ? ('منطقه ' + (r - 100)) : ('م' + r)

  const loadStatus = () => fetch('/api/admin/persiansaze').then(r => r.ok ? r.json() : null).then((d: PSState | null) => {
    if (d) {
      setSt(d)
      // مقادیرِ فرم را فقط یک‌بار از کانفیگِ ذخیره‌شده پر کن (تا ویرایشِ کاربر پاک نشود)
      if (!inited.current) {
        inited.current = true
        setUser(d.config.user || '')
        setLimit(String(d.config.limit || 20))
        setQuota(String(d.config.weeklyQuota || 500))
        setEnabled(!!d.config.enabled)
      }
    }
  }).catch(() => {})

  const loadProfiles = (pg = page, query = q, phone = onlyPhone) => {
    const qs = `view=profiles&q=${encodeURIComponent(query)}&withPhone=${phone ? '1' : '0'}&page=${pg}`
    fetch(`/api/admin/persiansaze?${qs}`).then(r => r.ok ? r.json() : null).then((d: { total: number; page: number; pageSize: number; rows: PSProfile[] } | null) => {
      if (d) { setRows(d.rows || []); setTotal(d.total || 0); setPage(d.page || 1); setPageSize(d.pageSize || 20) }
    }).catch(() => {})
  }

  useEffect(() => { loadStatus(); loadProfiles(1) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // poll while running (scrape) or revealing (phone)
  useEffect(() => {
    if (!st?.running && !st?.revealing) return
    const t = setInterval(() => loadStatus(), 4000)
    return () => clearInterval(t)
  }, [st?.running, st?.revealing])  // eslint-disable-line react-hooks/exhaustive-deps

  const saveConfig = async () => {
    setCfgMsg('')
    const payload: any = { action: 'save-config', user, channel: 'chrome', limit: Number(limit) || 20, weeklyQuota: Number(quota) || 500, enabled }
    if (pass && pass !== '********') payload.pass = pass
    const r = await fetch('/api/admin/persiansaze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const d = await r.json().catch(() => ({}))
    setCfgMsg(r.ok ? '✓ ذخیره شد' : `⚠ ${d.error || 'خطا'}`)
    if (r.ok) { setPass(''); loadStatus() }
  }

  const startScrape = async () => {
    setScrapeMsg('در حال شروع…')
    const r = await fetch('/api/admin/persiansaze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scrape' }) })
    const d = await r.json().catch(() => ({}))
    setScrapeMsg(r.ok ? '✓ اسکرپ شروع شد' : `⚠ ${d.error || 'خطا'}`)
    loadStatus()
  }

  const rebuild = async () => {
    setRebuildMsg('در حال بازسازی…')
    const r = await fetch('/api/admin/persiansaze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rebuild-profiles' }) })
    const d = await r.json().catch(() => ({}))
    setRebuildMsg(d.ok ? `✓ ${fa(d.created)} ساخته · ${fa(d.updated)} به‌روز · ${fa(d.total)} کل` : `⚠ ${d.error || 'خطا'}`)
    loadStatus(); loadProfiles()
  }

  const startReveal = async () => {
    setRevealMsg('در حال شروع…')
    const r = await fetch('/api/admin/persiansaze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reveal' }) })
    const d = await r.json().catch(() => ({}))
    setRevealMsg(r.ok ? '✓ گرفتنِ شماره‌ها شروع شد' : `⚠ ${d.error || 'خطا'}`)
    loadStatus()
  }

  const createAccounts = async () => {
    setAcctMsg('در حال ساخت…')
    const r = await fetch('/api/admin/persiansaze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create-accounts' }) })
    const d = await r.json().catch(() => ({}))
    setAcctMsg(d.ok ? `✓ ${fa(d.created)} حساب ساخته شد · ${fa(d.skipped)} تکراری · ${fa(d.noPhone)} بی‌شماره` : `⚠ ${d.error || 'خطا'}`)
    loadStatus()
  }

  const openDetail = async (name: string) => {
    setDetail(null); setDetailLoading(true)
    const r = await fetch(`/api/admin/persiansaze?view=profile&id=${encodeURIComponent(name)}`)
    const d = r.ok ? await r.json() : null
    setDetail(d); setDetailLoading(false)
  }

  const running = !!st?.running
  const pages = Math.max(1, Math.ceil(total / (pageSize || 20)))

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14, background: 'linear-gradient(120deg, rgba(212,175,55,.1), transparent 60%), var(--surface)', borderColor: 'rgba(201,168,76,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🏗</span>
          <div><div style={{ fontWeight: 900, fontSize: 17 }}>سازنده‌ها (پرشین سازه)</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.8 }}>پروفایلِ سازنده‌ها از پرشین سازه — پروژه‌ها، شماره‌ها و منطقه‌ها به‌صورتِ خودکار اسکرپ و یکپارچه می‌شوند.</div></div>
        </div>
      </Card>

      {/* Card 1 — config */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>پیکربندی</div>
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.9 }}>یوزر/پسوردِ حسابِ پرشین سازه‌ات را وارد کن. اسکرپر با مرورگرِ پنهان خودش لاگین می‌کند و دیتا را می‌کشد — کاملاً خودکار.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
          <div><label style={lab}>شماره موبایلِ پرشین سازه</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} placeholder="09xxxxxxxxx" value={user} onChange={e => setUser(e.target.value)} /></div>
          <div><label style={lab}>رمز عبور {st?.config.hasPass && <span style={{ color: 'var(--faint)' }}>(برای تغییر، مقدار جدید بزن)</span>}</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} type="password" placeholder={st?.config.hasPass ? '********' : 'رمز عبور'} value={pass} onChange={e => setPass(e.target.value)} /></div>
          <div><label style={lab}>اندازهٔ هر صفحه</label><input style={inp} type="number" placeholder="100" value={limit} onChange={e => setLimit(e.target.value)} /></div>
          <div><label style={lab}>سقفِ شمارهٔ هفتگی</label><input style={inp} type="number" placeholder="500" value={quota} onChange={e => setQuota(e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ width: 16, height: 16 }} /> فعال</label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <GoldButton onClick={saveConfig}>ذخیره</GoldButton>
          {cfgMsg && <span style={{ fontSize: 12.5, color: cfgMsg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{cfgMsg}</span>}
        </div>
      </Card>

      {/* Card 2 — status & run */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>وضعیت و اجرا</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>پروژه‌ها</div><div style={{ fontSize: 22, fontWeight: 900 }}>{st ? fa(st.data.totalProjects) : '—'}</div></div>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>سازنده‌های یکتا</div><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)' }}>{st ? fa(st.data.totalBuilders) : '—'}</div></div>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>شماره‌دار</div><div style={{ fontSize: 22, fontWeight: 900, color: '#5fd98a' }}>{st ? fa(st.profiles.withPhone) : '—'}</div></div>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>سهمیهٔ باقی‌مانده</div><div style={{ fontSize: 22, fontWeight: 900, color: '#5fd98a' }}>{st?.profiles.quotaAvailable != null ? fa(st.profiles.quotaAvailable) : '—'}<span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}> / ۵۰۰</span></div></div>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>در انتظارِ شماره</div><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)' }}>{st?.profiles.pendingProjects != null ? fa(st.profiles.pendingProjects) : '—'}</div></div>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>حسابِ سازنده</div><div style={{ fontSize: 22, fontWeight: 900, color: '#5fd98a' }}>{st?.profiles.accounts != null ? fa(st.profiles.accounts) : '—'}</div></div>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 140 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>آخرین اسکرپ</div><div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 6 }}>{st ? fmtDate(st.data.lastSync) : '—'}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <GoldButton onClick={startScrape} disabled={running}>{running ? 'در حال اجرا…' : '🔄 شروع اسکرپ'}</GoldButton>
          <GoldButton onClick={startReveal} disabled={!!st?.revealing}>{st?.revealing ? 'در حال گرفتنِ شماره…' : '📞 گرفتنِ شماره‌ها (تا سقفِ هفتگی)'}</GoldButton>
          <OutlineButton onClick={rebuild}>بازسازی پروفایل‌ها</OutlineButton>
          <OutlineButton onClick={createAccounts}>👤 ساختِ حسابِ سازنده</OutlineButton>
          {scrapeMsg && <span style={{ fontSize: 12.5, color: scrapeMsg.startsWith('✓') ? '#5fd98a' : 'var(--muted)' }}>{scrapeMsg}</span>}
          {revealMsg && <span style={{ fontSize: 12.5, color: revealMsg.startsWith('✓') ? '#5fd98a' : 'var(--muted)' }}>{revealMsg}</span>}
          {rebuildMsg && <span style={{ fontSize: 12.5, color: rebuildMsg.startsWith('✓') ? '#5fd98a' : 'var(--muted)' }}>{rebuildMsg}</span>}
          {acctMsg && <span style={{ fontSize: 12.5, color: acctMsg.startsWith('✓') ? '#5fd98a' : 'var(--muted)' }}>{acctMsg}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 10, lineHeight: 1.8 }}>«گرفتنِ شماره‌ها» هر بار تا سقفِ هفتگی (۵۰۰) شمارهٔ سازنده‌های جدید را می‌گیرد و به پروفایل‌ها وصل می‌کند. سهمیه که تمام شد، هفتهٔ بعد ادامه می‌دهد (با کرونِ خودکار). شماره‌گرفتنِ تکراری از سهمیه کم نمی‌کند.</div>
        {st?.log && <pre style={{ dir: 'ltr', direction: 'ltr', fontSize: 11, maxHeight: 160, overflow: 'auto', background: 'var(--bg2)', whiteSpace: 'pre-wrap', borderRadius: 10, padding: 12, margin: '0 0 10px', color: 'var(--muted)', border: '1px solid var(--line2)' } as React.CSSProperties}>{st.log}</pre>}
        {st?.revealLog && <pre style={{ dir: 'ltr', direction: 'ltr', fontSize: 11, maxHeight: 160, overflow: 'auto', background: 'var(--bg2)', whiteSpace: 'pre-wrap', borderRadius: 10, padding: 12, margin: 0, color: 'var(--muted)', border: '1px solid var(--line2)' } as React.CSSProperties}>{st.revealLog}</pre>}
      </Card>

      {/* Card 3 — profiles list */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>پروفایلِ سازنده‌ها</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <input style={{ ...inp, width: 240 }} placeholder="جستجوی نامِ سازنده…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') loadProfiles(1, q, onlyPhone) }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={onlyPhone} onChange={e => { setOnlyPhone(e.target.checked); loadProfiles(1, q, e.target.checked) }} /> فقط شماره‌دار</label>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fa(total)} سازنده</span>
        </div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--faint)', padding: '18px 0', textAlign: 'center' }}>سازنده‌ای یافت نشد.</div>
        ) : (
          <div className="mjc-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 600 }}>
              <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>نام سازنده</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>تعداد پروژه</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>شماره موبایل</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>منطقه‌ها</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}></th>
              </tr></thead>
              <tbody>
                {rows.map(b => (
                  <tr key={b.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 700 }}>{b.name}</td>
                    <td style={{ padding: '8px 6px' }}>{fa(b.projectCount)}</td>
                    <td style={{ padding: '8px 6px', direction: 'ltr', textAlign: 'right' }}>{b.phone ? <span style={{ color: '#5fd98a', direction: 'ltr', display: 'inline-block' }}>{b.phone}</span> : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                    <td style={{ padding: '8px 6px', color: 'var(--muted)' }}>{(b.regions || []).slice(0, 4).map(r => regionLabel(r)).join('، ') || '—'}</td>
                    <td style={{ padding: '8px 6px' }}><button onClick={() => openDetail(b.name)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>مشاهده</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
            <button onClick={() => { if (page > 1) loadProfiles(page - 1) }} disabled={page <= 1} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--line2)', background: 'transparent', color: page <= 1 ? 'var(--faint)' : 'var(--text)', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>قبلی</button>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>صفحهٔ {fa(page)} از {fa(pages)}</span>
            <button onClick={() => { if (page < pages) loadProfiles(page + 1) }} disabled={page >= pages} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--line2)', background: 'transparent', color: page >= pages ? 'var(--faint)' : 'var(--text)', cursor: page >= pages ? 'default' : 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>بعدی</button>
          </div>
        )}
      </Card>

      {/* detail overlay */}
      {(detail || detailLoading) && (
        <div onClick={() => { setDetail(null); setDetailLoading(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto', zIndex: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 22, maxWidth: 920, width: '100%', marginTop: 20 }}>
            {detailLoading && !detail ? (
              <div style={{ fontSize: 13, color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>در حال بارگذاری…</div>
            ) : detail ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{detail.name}</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>{detail.phone ? <span style={{ color: '#5fd98a', direction: 'ltr', display: 'inline-block' }}>{detail.phone}</span> : <span style={{ color: 'var(--faint)' }}>بدون شماره</span>} · {fa(detail.projectCount)} پروژه</div>
                    <a href={`/sazande/${encodeURIComponent(detail.id)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>🔗 مشاهدهٔ صفحهٔ عمومیِ سازنده</a>
                  </div>
                  <button onClick={() => { setDetail(null); setDetailLoading(false) }} style={{ fontSize: 18, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--line2)', color: 'var(--muted)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
                  {(detail.projects || []).map(p => (
                    <div key={p.hashId} style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 12, padding: 12, width: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {p.photo?.imageThumbnailUrl ? <img src={p.photo.imageThumbnailUrl} alt="" style={{ width: 90, height: 68, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} /> : <div style={{ width: 90, height: 68, borderRadius: 8, background: 'var(--line)', flexShrink: 0 }} />}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.6 }}>{p.address || '—'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{p.regionLabel || (p.regionId != null ? regionLabel(p.regionId) : '')}{p.phaseLabel ? ` · ${p.phaseLabel}` : ''}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.9 }}>
                        متراژ {fa(p.groundArea || 0)} / زیربنا {fa(p.residentialArea || 0)}<br />
                        {fa(p.floors || 0)} طبقه / {fa(p.units || 0)} واحد
                      </div>
                      {p.latitude != null && p.longitude != null && (
                        <a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--gold)' }}>📍 نقشه</a>
                      )}
                    </div>
                  ))}
                  {(!detail.projects || detail.projects.length === 0) && <div style={{ fontSize: 12.5, color: 'var(--faint)', padding: '12px 0' }}>پروژه‌ای ثبت نشده.</div>}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

async function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res()
    const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('load')); document.body.appendChild(s)
  })
}
async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
    const lib = (window as any).pdfjsLib
    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) { const p = await pdf.getPage(i); const c = await p.getTextContent(); text += c.items.map((it: any) => it.str).join(' ') + '\n' }
    return text
  }
  if (name.endsWith('.docx')) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js')
    const r = await (window as any).mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return r.value
  }
  return await file.text()
}

function KnowledgeBase() {
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [points, setPoints] = useState<any[]>([])
  const [stats, setStats] = useState<{ total: number; sources: number } | null>(null)
  const [man, setMan] = useState({ metric: '', value: '', city: '', district: '', period: '', unit: '' })

  const load = () => fetch('/api/admin/market/data').then(r => r.ok ? r.json() : null).then(d => { if (d) { setPoints(d.points); setStats(d.stats) } })
  useEffect(() => { load() }, [])

  const onFile = async (f: File | null) => {
    if (!f) return
    setBusy('در حال خواندن سند…'); setMsg('')
    try { const t = await extractFileText(f); setText(t.slice(0, 20000)); setSource(f.name); setBusy('') ; setMsg(`✓ ${t.length} کاراکتر استخراج شد — دکمهٔ «استخراج با AI» را بزنید`) }
    catch { setBusy(''); setMsg('⚠ خواندن سند ناموفق بود (PDF/Word). متن را دستی پیست کنید.') }
  }
  const ingest = async () => {
    if (text.trim().length < 30) { setMsg('متن کافی نیست'); return }
    setBusy('در حال استخراج با هوش مصنوعی…'); setMsg('')
    const r = await fetch('/api/admin/market/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, source: source || 'سند' }) })
    const d = await r.json(); setBusy('')
    if (d.ok) { setMsg(`✓ ${d.added} داده استخراج و ذخیره شد`); setText(''); load() } else setMsg(`⚠ ${d.error || 'خطا'}`)
  }
  const addManual = async () => {
    if (!man.metric || !man.value) return
    await fetch('/api/admin/market/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(man) })
    setMan({ metric: '', value: '', city: '', district: '', period: '', unit: '' }); load()
  }
  const del = async (id: string) => { setPoints(points.filter(p => p.id !== id)); await fetch(`/api/admin/market/data?id=${id}`, { method: 'DELETE' }) }
  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  const [model, setModel] = useState<any>(null)
  const [report, setReport] = useState('')
  const [working, setWorking] = useState('')
  const trainModel = async () => { setWorking('train'); const r = await fetch('/api/admin/market/model'); setModel(r.ok ? await r.json() : null); setWorking('') }
  const genReport = async () => { setWorking('report'); setReport(''); const r = await fetch('/api/admin/market/report', { method: 'POST' }); const d = await r.json(); setReport(d.ok ? d.text : `⚠ ${d.error || 'خطا'}`); setWorking('') }
  const exportCsv = () => {
    const head = 'metric,value,unit,city,district,period,source\n'
    const body = points.map(p => [p.metric, p.value, p.unit || '', p.city || '', p.district || '', p.period || '', p.source].map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + head + body], { type: 'text/csv' }); const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'melkjet-dataset.csv'; a.click()
  }
  const clearAll = async () => { if (!confirm('کل دیتاست پاک شود؟')) return; await fetch('/api/admin/market/data', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearAll: true }) }); load(); setModel(null) }

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>پایگاه دانش بازار (تغذیهٔ مدل)</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>سند PDF/Word (گزارش سالانه، آمار معاملات و...) آپلود کن یا متن را پیست کن؛ هوش مصنوعی داده‌های عددی را استخراج و در دیتاست ذخیره می‌کند. {stats && <span style={{ color: '#5fd98a' }}>· {stats.total.toLocaleString('fa-IR')} داده از {stats.sources} منبع</span>}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ ...inp, cursor: 'pointer', border: '1px dashed var(--gold)', color: 'var(--gold)' }}>
            📎 آپلود PDF / Word
            <input type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0] || null)} />
          </label>
          <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="نام منبع (اختیاری)" value={source} onChange={e => setSource(e.target.value)} />
        </div>
        <textarea style={{ ...inp, width: '100%', height: 110, resize: 'vertical' }} placeholder="یا متن گزارش را اینجا پیست کنید…" value={text} onChange={e => setText(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <GoldButton onClick={ingest} style={{ opacity: busy ? .6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>{busy || '✦ استخراج با هوش مصنوعی'}</GoldButton>
          {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>افزودن دستی داده</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
          <input style={inp} placeholder="متریک*" value={man.metric} onChange={e => setMan({ ...man, metric: e.target.value })} />
          <input style={inp} placeholder="مقدار*" value={man.value} onChange={e => setMan({ ...man, value: e.target.value })} />
          <input style={inp} placeholder="شهر" value={man.city} onChange={e => setMan({ ...man, city: e.target.value })} />
          <input style={inp} placeholder="محله" value={man.district} onChange={e => setMan({ ...man, district: e.target.value })} />
          <input style={inp} placeholder="دوره (۱۴۰۳)" value={man.period} onChange={e => setMan({ ...man, period: e.target.value })} />
          <input style={inp} placeholder="واحد" value={man.unit} onChange={e => setMan({ ...man, unit: e.target.value })} />
        </div>
        <OutlineButton onClick={addManual} style={{ marginTop: 10 }}>+ افزودن</OutlineButton>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>دیتاست ({points.length.toLocaleString('fa-IR')})</div>
        {points.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>هنوز داده‌ای نیست. یک سند آپلود کنید.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead><tr style={{ borderBottom: '1px solid var(--line)' }}>{['متریک', 'مقدار', 'محله', 'شهر', 'دوره', 'منبع', ''].map(h => <th key={h} style={{ textAlign: 'right', padding: '7px', fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {points.slice(0, 100).map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 7px', fontSize: 12.5, fontWeight: 600 }}>{p.metric}</td>
                    <td style={{ padding: '8px 7px', fontSize: 12.5, color: 'var(--gold)' }}>{Number(p.value).toLocaleString('fa-IR')} {p.unit || ''}</td>
                    <td style={{ padding: '8px 7px', fontSize: 12 }}>{p.district || '—'}</td>
                    <td style={{ padding: '8px 7px', fontSize: 12 }}>{p.city || '—'}</td>
                    <td style={{ padding: '8px 7px', fontSize: 12 }}>{p.period || '—'}</td>
                    <td style={{ padding: '8px 7px', fontSize: 11.5, color: 'var(--muted)' }}>{p.source}</td>
                    <td style={{ padding: '8px 7px' }}><button onClick={() => del(p.id)} style={{ background: 'transparent', border: 'none', color: '#e7674a', cursor: 'pointer', fontSize: 14 }}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* model + controls */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>مدل قیمت + ابزارها</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <GoldButton onClick={trainModel} style={{ fontSize: 12.5, padding: '7px 13px', opacity: working ? .6 : 1 }}>{working === 'train' ? 'در حال ساخت…' : '🧠 ساخت/به‌روزرسانی مدل'}</GoldButton>
            <OutlineButton onClick={genReport} style={{ fontSize: 12.5, padding: '7px 13px', opacity: working ? .6 : 1 }}>{working === 'report' ? 'در حال نوشتن…' : '📄 گزارش بازار (AI)'}</OutlineButton>
            <OutlineButton onClick={exportCsv} style={{ fontSize: 12.5, padding: '7px 13px' }}>⬇ خروجی CSV</OutlineButton>
            <button onClick={clearAll} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 11, padding: '7px 13px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>🗑 پاک‌کردن دیتاست</button>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.8 }}>
          «ساخت مدل» روی همهٔ داده‌های قیمتِ دیتاست یک شاخص قیمت برای هر محله می‌سازد (آخرین قیمت، نرخ رشد، پیش‌بینی دورهٔ بعد). این مدل به تحلیل آگهی‌ها و امتیاز «ارزش خرید» وصل است و هرچه دیتای بیشتری وارد کنی دقیق‌تر می‌شود.
        </div>
        {model && (
          <>
            <div style={{ fontSize: 12.5, color: '#5fd98a', marginBottom: 10 }}>✓ مدل روی {model.trainedOn.toLocaleString('fa-IR')} نقطه‌دادهٔ قیمت ساخته شد — {model.indices.length} محله</div>
            {model.indices.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--line)' }}>{['محله', 'شهر', 'داده', 'آخرین قیمت', 'رشد', 'پیش‌بینی دورهٔ بعد'].map(h => <th key={h} style={{ textAlign: 'right', padding: '7px', fontSize: 11.5, color: 'var(--faint)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {model.indices.slice(0, 40).map((r: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 7px', fontWeight: 600, fontSize: 12.5 }}>{r.district}</td>
                        <td style={{ padding: '8px 7px', fontSize: 12, color: 'var(--muted)' }}>{r.city}</td>
                        <td style={{ padding: '8px 7px', fontSize: 12 }}>{r.points.toLocaleString('fa-IR')}</td>
                        <td style={{ padding: '8px 7px', fontSize: 12.5, color: 'var(--gold)', fontWeight: 600 }}>{r.latest.toLocaleString('fa-IR')}</td>
                        <td style={{ padding: '8px 7px', fontSize: 12, color: r.growth >= 0 ? '#5fd98a' : '#e7674a' }}>{r.growth >= 0 ? '↑' : '↓'} {Math.abs(r.growth).toLocaleString('fa-IR')}٪</td>
                        <td style={{ padding: '8px 7px', fontSize: 12.5, fontWeight: 600 }}>{r.forecast.toLocaleString('fa-IR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {report && <div style={{ marginTop: 14, background: 'var(--bg2)', borderRadius: 12, padding: 16, fontSize: 13.5, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{report}</div>}
      </Card>
    </>
  )
}

function ReportsView() {
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/admin/market').then(r => r.ok ? r.json() : null).then(x => { setD(x); setLoading(false) }) }, [])
  const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
  const mt = (n: number) => n ? `${fa(Math.round(n / 1e6))} م.ت` : '—'
  const p = d?.platform
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <KnowledgeBase />

      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>نمای کامل دیتای واقعی پلتفرم (آگهی‌ها، پروفایل‌ها، محصولات، مقالات، آگهی‌دهنده‌ها، دیتاست). همین داده پایهٔ مدل یادگیری ماشین است.</div>

      {/* full platform KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 18 }} className="mjsa-kpi">
        <KPI label="کل آگهی" value={fa(p?.listings.total)} trend={p ? `فروش ${fa(p.listings.sale)} · اجاره ${fa(p.listings.rent)}` : ''} icon="⌂" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" />
        <KPI label="پروفایل/دفتر" value={fa(p?.directory.total)} trend={p ? `${fa(p.directory.byCategory.length)} دسته` : ''} icon="◍" iconBg="rgba(167,127,212,.15)" iconColor="#a77fd4" />
        <KPI label="آگهی‌دهنده" value={fa(p?.owners)} icon="👤" iconBg="var(--goldDim)" iconColor="var(--gold)" />
        <KPI label="محصول فروشگاه" value={fa(p?.products)} icon="▣" iconBg="rgba(78,196,232,.15)" iconColor="#4ec4e8" />
        <KPI label="مقاله" value={fa(p?.articles)} icon="✦" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" />
        <KPI label="دیتاست دانش" value={fa(p?.dataset)} icon="🧠" iconBg="rgba(231,161,74,.15)" iconColor="#e7a14a" />
      </div>

      <div className="mjsa-2col" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* listings by district */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>آگهی‌ها به‌تفکیک محله</div>
          {loading ? <div style={{ color: 'var(--muted)' }}>در حال محاسبه…</div> : !p?.listings.byDistrict.length ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>هنوز آگهی‌ای واکشی نشده. منبع دیوار اجرا کنید.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--line)' }}>{['محله', 'شهر', 'کل', 'فروش', 'اجاره', 'میانگین فروش/متر', 'میانگین ودیعه'].map(h => <th key={h} style={{ textAlign: 'right', padding: '7px', fontSize: 11.5, color: 'var(--faint)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {p.listings.byDistrict.map((r: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '8px 7px', fontWeight: 600, fontSize: 12.5 }}>{r.district}</td>
                      <td style={{ padding: '8px 7px', fontSize: 12, color: 'var(--muted)' }}>{r.city}</td>
                      <td style={{ padding: '8px 7px', fontSize: 12 }}>{fa(r.count)}</td>
                      <td style={{ padding: '8px 7px', fontSize: 12, color: '#5fd98a' }}>{fa(r.sale)}</td>
                      <td style={{ padding: '8px 7px', fontSize: 12, color: '#5b9bd5' }}>{fa(r.rent)}</td>
                      <td style={{ padding: '8px 7px', fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>{mt(r.avgSalePpm)}</td>
                      <td style={{ padding: '8px 7px', fontSize: 12, color: 'var(--muted)' }}>{r.avgDeposit ? mt(r.avgDeposit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* directory by category + cities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>پروفایل‌ها به‌تفکیک دسته</div>
            {!p?.directory.byCategory.length ? <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>هنوز پروفایلی واکشی نشده.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {p.directory.byCategory.map((c: any) => (
                  <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <span>{c.category}</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{fa(c.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>آگهی‌ها به‌تفکیک شهر</div>
            {!p?.listings.byCity.length ? <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>—</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {p.listings.byCity.slice(0, 10).map((c: any) => (
                  <div key={c.city} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <span>{c.city}</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{fa(c.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function ModerationView() {
  const [items, setItems] = useState<MItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/admin/scraper/items?type=listing')
    if (r.ok) { const d = await r.json(); setItems(d.items as MItem[]) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // اجرای تأیید خودکار AI روی صف منتظر، دسته‌دسته تا تمام شدن
  const runAuto = async () => {
    if (busy) return
    setBusy(true); setProgress('در حال بررسی…')
    try {
      let total = 0
      for (let i = 0; i < 12; i++) {
        const r = await fetch('/api/admin/scraper/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        const d = await r.json()
        if (d.error) { setProgress('⚠ ' + d.error); break }
        if (!d.moderated) break
        total += d.moderated
        setProgress(`${total.toLocaleString('fa-IR')} آگهی بررسی شد…`)
      }
      setProgress(total ? `✓ ${total.toLocaleString('fa-IR')} آگهی توسط AI بررسی شد` : 'موردی برای بررسی نبود')
      await load()
    } finally { setBusy(false) }
  }

  const setStatusOf = async (id: string, s: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status: s } : i))
    await fetch('/api/admin/scraper/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: s }) })
  }

  const pending = items.filter(i => i.status === 'pending')
  const awaiting = pending.filter(i => !i.moderatedAt)
  const moderated = items.filter(i => i.moderatedAt).sort((a, b) => (b.moderatedAt || 0) - (a.moderatedAt || 0))
  const approved = items.filter(i => i.status === 'approved' && i.moderatedAt)
  const rejected = items.filter(i => i.status === 'rejected' && i.moderatedAt)
  const review = pending.filter(i => i.moderatedAt)
  const fa = (n: number) => n.toLocaleString('fa-IR')
  const verdictOf = (it: MItem) => it.status === 'approved' ? { label: 'تأیید', color: '#5fd98a' } : it.status === 'rejected' ? { label: 'رد', color: '#e7674a' } : { label: 'بازبینی', color: '#e7a14a' }

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <KPI label="در انتظار بررسی AI" value={fa(awaiting.length)} trend={awaiting.length ? 'آماده بررسی خودکار' : 'صف خالی است'} icon="⏳" iconBg="rgba(231,103,74,.15)" iconColor="#e7674a" />
        <KPI label="تأییدشده توسط AI" value={fa(approved.length)} trend="آگهی معتبر" icon="✓" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" trendUp />
        <KPI label="رد‌شده توسط AI" value={fa(rejected.length)} trend="مشکوک/ناقص" icon="✗" iconBg="rgba(231,103,74,.1)" iconColor="#e7674a" />
        <KPI label="نیازمند بازبینی دستی" value={fa(review.length)} trend="حکم: بازبینی" icon="👁" iconBg="rgba(231,161,74,.15)" iconColor="#e7a14a" />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>تأیید خودکار هوش مصنوعی</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, maxWidth: 460, lineHeight: 1.6 }}>هوش مصنوعی هر آگهی منتظر را بررسی می‌کند و آن را تأیید، رد یا برای بازبینی دستی علامت می‌زند و علت تصمیم را ثبت می‌کند. این کار پس از هر واکشی به‌صورت خودکار هم اجرا می‌شود.</div>
            {progress && <div style={{ fontSize: 12.5, color: 'var(--gold)', marginTop: 8, fontWeight: 600 }}>{progress}</div>}
          </div>
          <GoldButton onClick={runAuto} disabled={busy}>{busy ? '⏳ در حال بررسی…' : `🤖 بررسی ${fa(awaiting.length)} آگهی منتظر`}</GoldButton>
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>آخرین تصمیم‌های هوش مصنوعی</div>
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>در حال بارگذاری…</div>
        ) : moderated.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>هنوز آگهی‌ای بررسی نشده. دکمهٔ «بررسی با AI» را بزنید.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                {['عنوان', 'امتیاز', 'حکم AI', 'دلیل', ''].map(h => (
                  <th key={h} style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moderated.slice(0, 50).map(it => {
                const v = verdictOf(it); const score = it.aiScore ?? 0
                return (
                  <tr key={it.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '11px 0', fontWeight: 600, fontSize: 13, maxWidth: 220 }}>{it.title}<div style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 400 }}>{[it.location, it.price].filter(Boolean).join(' · ')}</div></td>
                    <td style={{ padding: '11px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 36, height: 6, borderRadius: 999, background: 'var(--line2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${score}%`, background: v.color, borderRadius: 999 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: v.color }}>{score}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 0' }}><Badge label={v.label} color={v.color} /></td>
                    <td style={{ padding: '11px 0', fontSize: 12, color: 'var(--muted)', maxWidth: 220, lineHeight: 1.5 }}>{it.aiReason || '—'}</td>
                    <td style={{ padding: '11px 0' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {it.status !== 'approved' && <button onClick={() => setStatusOf(it.id, 'approved')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #5fd98a', color: '#5fd98a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>تأیید</button>}
                        {it.status !== 'rejected' && <button onClick={() => setStatusOf(it.id, 'rejected')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #e7674a', color: '#e7674a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>رد</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

function StudioView() {
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>استودیو پلان و مدل سه‌بعدی</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>عکس‌های فضا را بده و پارامترها را تنظیم کن؛ هوش مصنوعی نقشهٔ کف دوبعدی و رندر سه‌بعدی می‌سازد. مدل این بخش از «API و مدل‌های AI → StudioAgent» تنظیم می‌شود (یک مدل متن + یک مدل تصویر).</div>
      </Card>
      <PlanStudio />
    </div>
  )
}

function ArticlesView() {
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <ArticleEditor />
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

  const generate = async () => {
    if (!topic || generating) return
    setGenerating(true); setOutput('')
    try {
      const r = await fetch('/api/ai/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'content', input: `یک «${type}» کامل و سئو-محور دربارهٔ موضوع زیر بنویس:\n${topic}` }),
      })
      const d = await r.json()
      setOutput(d.ok ? d.text : `⚠ ${d.error || 'خطا در تولید محتوا'}`)
    } catch {
      setOutput('⚠ خطا در ارتباط با سرور')
    } finally { setGenerating(false) }
  }

  return (
    <div style={{ animation: 'fade .35s ease', display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14 }} className="mjsa-2col">
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

function ModelSelect({ models, value, onChange, only }: { models: string[]; value: string; onChange: (v: string) => void; only?: ModelCategory }) {
  // ensure a previously-saved model still shows even if it's not in the live list
  const all = value && !models.includes(value) ? [value, ...models] : models
  const groups: Record<string, string[]> = {}
  for (const m of all) {
    const cat = categorizeModel(m)
    if (only && cat !== only) continue
    ;(groups[cat] = groups[cat] || []).push(m)
  }
  const order: ModelCategory[] = ['text', 'image', 'embedding', 'audio']
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      width: '100%', background: 'var(--bg)', border: '1px solid var(--line2)', borderRadius: 9,
      padding: '8px 10px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
    }}>
      <option value="">— انتخاب مدل —</option>
      {order.filter(c => groups[c]?.length).map(c => (
        <optgroup key={c} label={CATEGORY_LABEL[c]}>
          {groups[c].map(m => <option key={m} value={m}>{m}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

// ─── IPPanel SMS config ───────────────────────────────────────────────────
function IPPanelConfig() {
  const [f, setF] = useState({ apiKey: '', sender: '', pattern: '', patternVar: 'code', automationPattern: '', automationVar: 'name', outreachPattern: '', outreachVar: 'name', linkVar: '' })
  const [masked, setMasked] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/admin/ippanel-config').then(r => r.ok ? r.json() : null).then(d => { if (d) { setMasked(d.apiKey || ''); setF(p => ({ ...p, sender: d.sender || '', pattern: d.pattern || '', patternVar: d.patternVar || 'code', automationPattern: d.automationPattern || '', automationVar: d.automationVar || 'name', outreachPattern: d.outreachPattern || '', outreachVar: d.outreachVar || 'name', linkVar: d.linkVar || '' })) } }) }, [])
  const save = async () => {
    setMsg('')
    const payload: any = { sender: f.sender, pattern: f.pattern, patternVar: f.patternVar, automationPattern: f.automationPattern, automationVar: f.automationVar, outreachPattern: f.outreachPattern, outreachVar: f.outreachVar, linkVar: f.linkVar }
    if (f.apiKey.trim()) payload.apiKey = f.apiKey.trim()
    const r = await fetch('/api/admin/ippanel-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const d = await r.json()
    setMsg(r.ok ? '✓ ذخیره شد' : `⚠ ${d.error || 'خطا'}`)
    if (r.ok && f.apiKey.trim()) { setMasked('***' + f.apiKey.trim().slice(-4)); setF(p => ({ ...p, apiKey: '' })) }
  }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', direction: 'ltr', textAlign: 'left' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>سرویس پیامک (IPPanel) {masked && <span style={{ color: '#5fd98a', fontSize: 12 }}>● تنظیم‌شده ({masked})</span>}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.9 }}>
        کلید API و خط ارسال را از پنل IPPanel بگیر. برای **کد ورود (OTP)** باید در پنل IPPanel یک «پترن» بسازی (مثل «کد ورود ملک‌جت: %code%») و **کد پترن** آن (یک عدد) را اینجا بگذاری. «نام متغیر پترن» باید دقیقاً با نام متغیری که در پترن تعریف کردی یکی باشد (پیش‌فرض <span style={{ direction: 'ltr', display: 'inline-block' }}>code</span>).
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
        <div style={{ gridColumn: '1 / -1' }}><label style={lab}>کلید API {masked && <span style={{ color: 'var(--faint)' }}>(برای تغییر، مقدار جدید بزن)</span>}</label><input style={inp} placeholder={masked || 'کلید IPPanel'} value={f.apiKey} onChange={e => setF({ ...f, apiKey: e.target.value })} /></div>
        <div><label style={lab}>خط ارسال (Sender)</label><input style={inp} placeholder="3000xxxx یا +98..." value={f.sender} onChange={e => setF({ ...f, sender: e.target.value })} /></div>
        <div><label style={lab}>کد پترن (برای OTP)</label><input style={inp} placeholder="مثلاً 123456" value={f.pattern} onChange={e => setF({ ...f, pattern: e.target.value })} /></div>
        <div><label style={lab}>نام متغیر پترن</label><input style={inp} placeholder="code" value={f.patternVar} onChange={e => setF({ ...f, patternVar: e.target.value })} /></div>
        <div><label style={lab}>کد پترنِ اتوماسیون (خطِ خدماتی)</label><input style={inp} placeholder="کدِ پترنِ پیامکِ اتوماسیون" value={f.automationPattern} onChange={e => setF({ ...f, automationPattern: e.target.value })} /></div>
        <div><label style={lab}>نام متغیرِ پترنِ اتوماسیون</label><input style={inp} placeholder="name" value={f.automationVar} onChange={e => setF({ ...f, automationVar: e.target.value })} /></div>
        <div><label style={lab}>کد پترنِ دعوت (مالکانِ آگهی)</label><input style={inp} placeholder="کدِ پترنِ دعوت/ثبت‌نام" value={f.outreachPattern} onChange={e => setF({ ...f, outreachPattern: e.target.value })} /></div>
        <div><label style={lab}>نام متغیرِ پترنِ دعوت</label><input style={inp} placeholder="name" value={f.outreachVar} onChange={e => setF({ ...f, outreachVar: e.target.value })} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lab}>نام متغیرِ لینک در پترن‌ها (مثلاً link) — برای کوتاه‌کنندهٔ لینک</label><input style={inp} placeholder="link" value={f.linkVar} onChange={e => setF({ ...f, linkVar: e.target.value })} /></div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: -4, marginBottom: 10, lineHeight: 1.8 }}>پترنِ اتوماسیون و دعوت برای خطِ خدماتی‌اند (متنِ ثابت + متغیرِ کوتاهِ نام). اگر خالی بمانند و خطِ تبلیغاتی داشته باشی، متنِ آزاد فرستاده می‌شود.</div>
      <div style={{ fontSize: 11.5, color: 'var(--text)', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '10px 13px', marginBottom: 12, lineHeight: 2 }}>
        <b>🔗 کوتاه‌کنندهٔ لینک داخلِ پترن‌ها:</b> چون خطِ خدماتی متنِ ثابت می‌خواهد، لینک باید یک <b>متغیرِ جدا</b> در پترن باشد. کافی است:
        <br />۱) در پنل IPPanel هر پترنی که می‌خواهی لینک داشته باشد را با یک متغیرِ <span style={{ direction: 'ltr', display: 'inline-block' }}>%link%</span> دوباره بساز/ویرایش کن.
        <br />۲) همان نام (<span style={{ direction: 'ltr', display: 'inline-block' }}>link</span>) را در کادرِ «نام متغیرِ لینک» بالا بگذار.
        <br />از این به بعد ملک‌جت لینکِ واقعی را با nxal کوتاه می‌کند و در متغیرِ <span style={{ direction: 'ltr', display: 'inline-block' }}>%link%</span> می‌فرستد و کلیکِ هر گیرنده را در «ترکر» می‌بینی.
        <br /><span style={{ color: 'var(--faint)' }}>نمونهٔ بدنهٔ پترن:</span> «%name% عزیز، آگهیِ شما در ملک‌جت: %link%»
        <br /><span style={{ color: 'var(--gold)' }}>توجه:</span> اگر «نام متغیرِ لینک» را پر کنی، هر پترنِ لینک‌دار (اتوماسیون، دعوت، مذاکره، هشدار، تکمیل پروفایل، ترکر) <b>باید</b> %link% داشته باشد؛ پترنِ OTP نیازی به آن ندارد.
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <GoldButton onClick={save}>ذخیره</GoldButton>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
      </div>
    </Card>
  )
}

// ─── دعوتِ صاحبانِ آگهی (مارکتینگ): پیامک به حساب‌هایی که سوپرادمین ساخته ──────────
function OutreachCampaign() {
  const [d, setD] = useState<{ totalOwners: number; invited: number; pending: number; sample: { name: string; phone: string }[] } | null>(null)
  const [onlyNew, setOnlyNew] = useState(true)
  const [limit, setLimit] = useState('50')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const load = (on = onlyNew) => fetch(`/api/admin/outreach?onlyNew=${on ? '1' : '0'}`).then(r => r.ok ? r.json() : null).then(x => { if (x) setD(x) }).catch(() => {})
  useEffect(() => { load() }, [onlyNew])  // eslint-disable-line react-hooks/exhaustive-deps
  const send = async () => {
    if (busy) return
    const n = Math.min(Number(limit) || 50, d?.pending || 0)
    if (!n) { setMsg('موردی برای ارسال نیست'); return }
    if (!confirm(`به ${n.toLocaleString('fa-IR')} نفر پیامکِ دعوت ارسال شود؟`)) return
    setBusy(true); setMsg('در حال ارسال…')
    try {
      const r = await fetch('/api/admin/outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: Number(limit) || 50, onlyNew }) })
      const x = await r.json()
      setMsg(x.ok ? `✓ ${(x.sent || 0).toLocaleString('fa-IR')} پیامک ارسال شد${x.failed ? ` · ${x.failed} ناموفق` : ''}` : (x.error || 'خطا'))
      load()
    } catch { setMsg('خطا در ارتباط با سرور') } finally { setBusy(false) }
  }
  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 90 }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>دعوتِ صاحبانِ آگهی (مارکتینگ)</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.9 }}>
        به مشاوران/املاک‌هایی که برایشان پنل ساخته‌ای و شمارهٔ موبایلِ معتبر دارند، پیامکِ دعوت/معرفی می‌فرستد («آگهی‌هایت خودکار در ملک‌جت می‌آید — بیا ثبت‌نام کن»). هر شماره فقط <b>یک‌بار</b> دعوت می‌شود.
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>کل حساب‌های هدف</div><div style={{ fontSize: 22, fontWeight: 900 }}>{d ? d.totalOwners.toLocaleString('fa-IR') : '—'}</div></div>
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>دعوت‌شده تاکنون</div><div style={{ fontSize: 22, fontWeight: 900, color: '#5fd98a' }}>{d ? d.invited.toLocaleString('fa-IR') : '—'}</div></div>
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>در انتظارِ دعوت</div><div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)' }}>{d ? d.pending.toLocaleString('fa-IR') : '—'}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={onlyNew} onChange={e => setOnlyNew(e.target.checked)} /> فقط حساب‌هایی که هنوز وارد نشده‌اند</label>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>تعداد در این ارسال:</span>
        <input value={limit} onChange={e => setLimit(e.target.value.replace(/\D/g, ''))} style={inp} />
        <GoldButton onClick={send} disabled={busy}>{busy ? 'در حال ارسال…' : '📣 ارسالِ دعوت'}</GoldButton>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : 'var(--muted)' }}>{msg}</span>}
      </div>
      {d?.sample?.length ? <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.9 }}>نمونه: {d.sample.map(s => `${s.name} (${s.phone})`).join('، ')}</div> : null}
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 10, lineHeight: 1.8 }}>متنِ پترنِ دعوت (در «سرویس پیامک» بالا کدش را بگذار، متغیر <span style={{ direction: 'ltr', display: 'inline-block' }}>name</span>):<br />«%name% گرامی، آگهی‌های شما رایگان و خودکار در ملک‌جت منتشر می‌شود! پنل اختصاصی، وب‌سایت‌ساز، CRM و دستیار هوش مصنوعی — همگی رایگان. همین حالا ثبت‌نام کنید: melkjet.com»</div>
    </Card>
  )
}

// ─── بخشِ یکپارچهٔ «پیامک و الگوها» ─────────────────────────────────────────
function SmsView() {
  const rec: { ch: string; v: string; text: string }[] = [
    { ch: 'کد ورود (OTP)', v: 'code', text: 'کاربر گرامی، کد ورود شما به ملک‌جت %code% می‌باشد.' },
    { ch: 'هشدار آگهی جدید', v: 'message', text: 'ملک‌جت\nآگهی جدید مطابق جستجوی شما در %message% اضافه شد. در پنل ببینید.' },
    { ch: 'تکمیل پروفایل', v: 'message', text: 'کاربر گرامی ملک‌جت، وضعیت پروفایل کسب‌وکار شما: %message%. برای رفع، وارد پنل شوید.' },
    { ch: 'اتوماسیون گردش‌کار', v: 'name', text: 'سلام %name%، کارشناسِ ملک‌جت به‌زودی با شما تماس می‌گیرد. با تشکر.' },
    { ch: 'دعوت مالکانِ آگهی', v: 'name', text: '%name% گرامی، آگهی‌های شما رایگان و خودکار در ملک‌جت منتشر می‌شود! پنل اختصاصی، وب‌سایت‌ساز، CRM و دستیار هوش مصنوعی — همگی رایگان. همین حالا ثبت‌نام کنید: melkjet.com' },
  ]
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>پیامک و الگوها</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>تنظیماتِ پیامک یکجا: اتصالِ IPPanel و کدهای پترن، هشدارِ آگهی، تکمیل پروفایل، موتورِ مذاکره، و کمپینِ دعوتِ مالکانِ آگهی. (ترکر و پیامک هدفمند منوی جداگانهٔ خودش را دارد.)</div>
      </Card>
      <IPPanelConfig />
      <AlertsConfig />
      <ProfileGateConfig />
      <NegotiationConfig />
      <OutreachCampaign />
      <Card>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>متنِ پیشنهادیِ الگوها (برای ثبت در IPPanel)</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.9 }}>روی خطِ خدماتی، هر الگو باید «متنِ ثابت + متغیرِ کوتاه» باشد. این متن‌ها قابلِ‌تأیید‌اند. کدِ هر پترن را در فیلدِ مربوطه‌اش (بالا یا در بخشِ هشدارها/تکمیل پروفایل) بگذار.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rec.map(r => (
            <div key={r.ch} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>{r.ch}</span>
                <span style={{ fontSize: 11, color: 'var(--gold)', background: 'var(--goldDim)', borderRadius: 6, padding: '1px 8px', direction: 'ltr' }}>متغیر: {r.v}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{r.text}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Negotiation engine (موتور مذاکره) — rules + fast SMS pattern ───────────
function NegotiationConfig() {
  const [f, setF] = useState({ rules: '', pattern: '', patternVar: 'message' })
  const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/admin/negotiation-config').then(r => r.ok ? r.json() : null).then(d => { if (d) setF({ rules: d.rules || '', pattern: d.pattern || '', patternVar: d.patternVar || 'message' }) }) }, [])
  const save = async () => {
    setMsg('')
    const r = await fetch('/api/admin/negotiation-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    const d = await r.json()
    setMsg(r.ok ? '✓ ذخیره شد' : `⚠ ${d.error || 'خطا'}`)
  }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>موتور مذاکره (پیامک و قواعدِ هوش مصنوعی)</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.9 }}>
        «قواعد» همان دستورالعملی است که هوش مصنوعی هنگامِ نوشتنِ پیامِ مذاکره رعایت می‌کند (لحن، طول، نکاتِ الزامی). برای ارسالِ <b>سریعِ</b> پیامک، در پنل IPPanel یک پترنِ تک‌متغیره بساز (مثلاً بدنهٔ پترن فقط <span style={{ direction: 'ltr', display: 'inline-block' }}>%message%</span> باشد) و کدِ آن را اینجا بگذار؛ اگر خالی بماند، پیامک از مسیرِ ارسالِ معمولی می‌رود.
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lab}>قواعدِ تولیدِ پیامِ مذاکره (برای هوش مصنوعی)</label>
        <textarea value={f.rules} onChange={e => setF({ ...f, rules: e.target.value })} rows={5} placeholder={'مثلاً:\n- همیشه مؤدبانه و حرفه‌ای بنویس\n- حداکثر ۴ جمله\n- نامِ آژانس را ذکر کن\n- شمارهٔ تماس را در پایان نگذار'} style={{ ...inp, resize: 'vertical', lineHeight: 1.9 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
        <div><label style={lab}>کدِ پترن IPPanel (اختیاری — ارسالِ سریع)</label><input style={inp} placeholder="مثلاً 123456" value={f.pattern} onChange={e => setF({ ...f, pattern: e.target.value })} /></div>
        <div><label style={lab}>نامِ متغیرِ پترن</label><input style={inp} placeholder="message" value={f.patternVar} onChange={e => setF({ ...f, patternVar: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <GoldButton onClick={save}>ذخیره</GoldButton>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
      </div>
    </Card>
  )
}

// ─── Tracker + targeted retargeting SMS ────────────────────────────────────
function TrackerConfig() {
  const [f, setF] = useState({ enabled: false, template: '', pattern: '', patternVar: 'message', delayMin: 2, throttleHours: 6, paths: '', shortenerKey: '', siteBase: '', shortenerDomain: '' })
  const [st, setSt] = useState<any>(null)
  const [shMasked, setShMasked] = useState('')
  const [links, setLinks] = useState<any[]>([])
  const [linkSt, setLinkSt] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const load = (refresh = false) => { if (refresh) setRefreshing(true); return fetch('/api/admin/tracker-config' + (refresh ? '?refresh=1' : '')).then(r => r.ok ? r.json() : null).then(d => { if (d) { setF(p => ({ ...p, enabled: !!d.enabled, template: d.template || '', pattern: d.pattern || '', patternVar: d.patternVar || 'message', delayMin: d.delayMin ?? 2, throttleHours: d.throttleHours ?? 6, paths: d.paths || '', shortenerKey: '', siteBase: d.shortener?.siteBase || 'https://melkjet.com', shortenerDomain: d.shortener?.domain || '' })); setSt(d.stats); setShMasked(d.shortener?.masked || ''); setLinks(d.links || []); setLinkSt(d.linkStats) } }).finally(() => setRefreshing(false)) }
  useEffect(() => { load() }, [])
  const save = async () => { setMsg(''); const r = await fetch('/api/admin/tracker-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); const d = await r.json(); setMsg(r.ok ? '✓ ذخیره شد' : `⚠ ${d.error || 'خطا'}`); if (r.ok) load() }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14, background: 'linear-gradient(120deg, rgba(212,175,55,.1), transparent 60%), var(--surface)', borderColor: 'rgba(201,168,76,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🎯</span>
          <div><div style={{ fontWeight: 900, fontSize: 17 }}>ترکر و پیامک هدفمند</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.8 }}>هر بازدیدکننده با کوکیِ دائمی دنبال می‌شود؛ پس از لاگین، شماره‌اش به آن وصل می‌شود. وقتی صفحه‌ای (آگهی، پروفایل، …) را ببیند، پیامکِ هدفمند با متنِ همان موضوع برایش ارسال می‌شود — سریع، از طریقِ پترن.</div></div>
        </div>
      </Card>

      {st && (
        <div className="mjsa-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
          {[['بازدیدکننده‌ها', st.total], ['شناخته‌شده (شماره‌دار)', st.identified], ['در صفِ ارسال', st.pending], ['پیامکِ ارسال‌شده', st.sent]].map(([l, v]: any) => (
            <Card key={l}><div style={{ fontSize: 12, color: 'var(--muted)' }}>{l}</div><div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold)', marginTop: 6 }}>{fa(v)}</div></Card>
          ))}
        </div>
      )}

      <Card style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.enabled} onChange={e => setF({ ...f, enabled: e.target.checked })} style={{ width: 18, height: 18 }} />
          ارسالِ پیامکِ هدفمند فعال باشد
        </label>
        <div style={{ marginBottom: 12 }}>
          <label style={lab}>قالبِ پیام — متغیرها: <span style={{ direction: 'ltr', display: 'inline-block' }}>%title%</span> (عنوانِ صفحه/آگهی) و <span style={{ direction: 'ltr', display: 'inline-block' }}>%url%</span></label>
          <textarea value={f.template} onChange={e => setF({ ...f, template: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical', lineHeight: 1.9 }} placeholder="سلام👋 «%title%» را در ملک‌جت دیدید و مشتاقانه منتظرِ شما هستیم." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
          <div><label style={lab}>کدِ پترن IPPanel (اختیاری — ارسالِ سریع)</label><input style={inp} placeholder="مثلاً 123456" value={f.pattern} onChange={e => setF({ ...f, pattern: e.target.value })} /></div>
          <div><label style={lab}>نامِ متغیرِ پترن</label><input style={inp} placeholder="message" value={f.patternVar} onChange={e => setF({ ...f, patternVar: e.target.value })} /></div>
          <div><label style={lab}>تأخیر تا ارسال (دقیقه)</label><input style={inp} type="number" value={f.delayMin} onChange={e => setF({ ...f, delayMin: Number(e.target.value) || 0 })} /></div>
          <div><label style={lab}>حداقل فاصلهٔ دو پیامک برای یک کاربر (ساعت)</label><input style={inp} type="number" value={f.throttleHours} onChange={e => setF({ ...f, throttleHours: Number(e.target.value) || 0 })} /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lab}>مسیرهای فعال‌کننده (هر خط یک پیشوند — خالی = همهٔ صفحاتِ عمومی)</label>
          <textarea value={f.paths} onChange={e => setF({ ...f, paths: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical', direction: 'ltr', textAlign: 'left' }} placeholder={'/property\n/project\n/profile\n/neighborhood'} />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <GoldButton onClick={save}>ذخیره</GoldButton>
          {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
        </div>
      </Card>

      {/* کوتاه‌کنندهٔ لینک (nxal) — برای ارسالِ لینکِ آگهی و شمارشِ کلیک */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>کوتاه‌کنندهٔ لینک (nxal) {shMasked && <span style={{ color: '#5fd98a', fontSize: 12 }}>● تنظیم‌شده ({shMasked})</span>}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.9 }}>برای اینکه لینکِ آگهی در پیامک کوتاه شود و کلیک‌ها شمرده شوند، کلیدِ API نوال (nxal.ir) را بگذار. لینکِ ارسالی به ریدایرکتِ شمارندهٔ ما اشاره می‌کند، پس آمارِ کلیک کاملاً اینجا دیده می‌شود.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="mjsa-2col">
          <div style={{ gridColumn: '1 / -1' }}><label style={lab}>کلیدِ API نوال {shMasked && <span style={{ color: 'var(--faint)' }}>(برای تغییر، مقدار جدید بزن)</span>}</label><input style={inp} placeholder={shMasked || 'nxal_xxxxxxxx'} value={f.shortenerKey} onChange={e => setF({ ...f, shortenerKey: e.target.value })} /></div>
          <div><label style={lab}>آدرسِ پایهٔ سایتِ ما (برای لینکِ شمارنده)</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} placeholder="https://melkjet.com" value={f.siteBase} onChange={e => setF({ ...f, siteBase: e.target.value })} /></div>
          <div><label style={lab}>دامنهٔ کوتاه (اختیاری)</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} placeholder="nx.al" value={f.shortenerDomain} onChange={e => setF({ ...f, shortenerDomain: e.target.value })} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <GoldButton onClick={save}>ذخیره</GoldButton>
          {linkSt && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fa(linkSt.total)} لینک · {fa(linkSt.clicked)} کلیک‌خورده · مجموع {fa(linkSt.clicks)} کلیک</span>}
        </div>
      </Card>

      {/* گزارشِ کلیکِ لینک‌ها */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>گزارشِ کلیکِ لینک‌ها ({fa(links.length)})</div>
          <button onClick={() => load(true)} disabled={refreshing} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: refreshing ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit' }}>{refreshing ? '⏳ در حال دریافت آمار…' : '↻ به‌روزرسانیِ آمار از nxal'}</button>
        </div>
        {links.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--faint)', padding: '18px 0', textAlign: 'center' }}>هنوز لینکی ارسال نشده است.</div>
        ) : (
          <div className="mjc-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 560 }}>
              <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>عنوان</th><th style={{ padding: '8px 6px', fontWeight: 600 }}>کانال</th><th style={{ padding: '8px 6px', fontWeight: 600 }}>گیرنده</th><th style={{ padding: '8px 6px', fontWeight: 600 }}>لینکِ کوتاه</th><th style={{ padding: '8px 6px', fontWeight: 600 }}>کلیک</th><th style={{ padding: '8px 6px', fontWeight: 600 }}>آخرین کلیک</th><th style={{ padding: '8px 6px', fontWeight: 600 }}>وضعیت</th>
              </tr></thead>
              <tbody>
                {links.map((l: any) => {
                  const chLabel: Record<string, string> = { tracker: 'ترکر', automation: 'اتوماسیون', outreach: 'دعوت', alert: 'هشدار', campaign: 'کمپین', negotiation: 'مذاکره' }
                  return (
                  <tr key={l.code} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 6px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title || l.dest}</td>
                    <td style={{ padding: '8px 6px' }}><span style={{ fontSize: 11, color: 'var(--gold)', background: 'var(--goldDim)', borderRadius: 6, padding: '1px 7px' }}>{chLabel[l.channel] || l.channel || '—'}</span></td>
                    <td style={{ padding: '8px 6px', direction: 'ltr' }}>{l.phone || '—'}</td>
                    <td style={{ padding: '8px 6px', direction: 'ltr' }}>{l.shortUrl ? <a href={l.shortUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>{l.shortUrl.replace(/^https?:\/\//, '')}</a> : `…/go/${l.code}`}</td>
                    <td style={{ padding: '8px 6px', fontWeight: 800, color: l.clicks > 0 ? '#5fd98a' : 'var(--faint)' }}>{fa(l.clicks)}</td>
                    <td style={{ padding: '8px 6px', color: 'var(--muted)' }}>{l.lastClickAt ? new Date(l.lastClickAt).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                    <td style={{ padding: '8px 6px' }}>{l.clicks > 0 ? <span style={{ color: '#5fd98a' }}>کلیک‌شده</span> : <span style={{ color: 'var(--faint)' }}>کلیک‌نشده</span>}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {st?.recent?.length > 0 && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>آخرین بازدیدکننده‌ها</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {st.recent.map((v: any) => (
              <div key={v.vid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--bg2)', borderRadius: 9, padding: '8px 11px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12.5, minWidth: 0, flex: 1 }}>
                  <span style={{ color: v.phone ? '#5fd98a' : 'var(--faint)', fontWeight: 700, direction: 'ltr', display: 'inline-block' }}>{v.phone || `ناشناس‌${v.vid}`}</span>
                  <span style={{ color: 'var(--muted)', marginInlineStart: 8 }}>· {v.lastTitle || '—'}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--faint)' }}>{fa(v.events)} بازدید{v.sentCount ? ` · ${fa(v.sentCount)} پیامک` : ''}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Communication packages (شارژِ پیامک/ایمیل) + orders ────────────────────
type CPkg = { id: string; channel: 'sms' | 'email' | 'token'; name: string; credits: number; price: number; active: boolean }
type COrder = { id: string; owner: string; kind?: string; name: string; channel?: string; credits?: number; planId?: string; price: number; status: string; createdAt: number; gateway?: string; receipt?: string }
function CommPackagesConfig() {
  const [pkgs, setPkgs] = useState<CPkg[]>([])
  const [orders, setOrders] = useState<COrder[]>([])
  const [msg, setMsg] = useState('')
  const load = () => fetch('/api/comm?admin=1').then(r => r.ok ? r.json() : null).then(d => { if (d) { setPkgs(d.packages || []); setOrders(d.orders || []) } })
  useEffect(() => { load() }, [])
  const addRow = () => setPkgs(p => [...p, { id: 'new_' + Math.round(p.length + 1), channel: 'sms', name: '', credits: 0, price: 0, active: true }])
  const upd = (i: number, patch: Partial<CPkg>) => setPkgs(p => p.map((x, j) => j === i ? { ...x, ...patch } : x))
  const del = (i: number) => setPkgs(p => p.filter((_, j) => j !== i))
  const save = async () => {
    setMsg('')
    const r = await fetch('/api/comm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'savePackages', packages: pkgs }) })
    const d = await r.json()
    if (d.ok) { setPkgs(d.packages || pkgs); setMsg('✓ ذخیره شد') } else setMsg(`⚠ ${d.error || 'خطا'}`)
  }
  const orderAct = async (id: string, action: 'approveOrder' | 'rejectOrder') => {
    const r = await fetch('/api/comm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }) })
    const d = await r.json(); if (d.orders) setOrders(d.orders)
  }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  const pending = orders.filter(o => o.status === 'pending')
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>بسته‌های شارژِ توکنِ AI / پیامک / ایمیل</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.9 }}>
        بسته‌هایی که اینجا فعال کنی، در بخشِ «پلن‌ها و اشتراک»ِ همهٔ پروفایل‌ها (توکنِ هوشِ مصنوعی، پیامک، ایمیل) نمایش داده می‌شوند و قابلِ تهیه‌اند.
      </div>
      {pkgs.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0', marginBottom: 12 }}>پکیجی تعریف نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 12 }}>
          {([['token', '🪙 توکنِ هوش مصنوعی', 'توکن'], ['sms', '✆ پیامک', 'پیامک'], ['email', '✉ ایمیل', 'ایمیل']] as const).map(([ch, title, unit]) => {
            const rows = pkgs.map((p, i) => ({ p, i })).filter(x => x.p.channel === ch).sort((a, b) => a.p.price - b.p.price)
            if (!rows.length) return null
            return (
              <div key={ch}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', marginBottom: 8 }}>{title} <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 400 }}>({fa(rows.length)} بسته)</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 150px 64px 34px', gap: 8, padding: '0 8px', fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
                    <div>نامِ بسته</div><div>تعدادِ {unit}</div><div>قیمت (تومان)</div><div>فعال</div><div></div>
                  </div>
                  {rows.map(({ p, i }) => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 150px 64px 34px', gap: 8, alignItems: 'center', background: 'var(--bg2)', borderRadius: 10, padding: 8 }} className="mjsa-pkg">
                      <input style={inp} placeholder={`نامِ بسته (مثلاً ۵۰٬۰۰۰ ${unit})`} value={p.name} onChange={e => upd(i, { name: e.target.value })} />
                      <input style={inp} type="number" placeholder="تعداد" value={p.credits || ''} onChange={e => upd(i, { credits: Number(e.target.value) || 0 })} />
                      <input style={inp} type="number" placeholder="قیمت" value={p.price || ''} onChange={e => upd(i, { price: Number(e.target.value) || 0 })} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}><input type="checkbox" checked={p.active} onChange={e => upd(i, { active: e.target.checked })} />فعال</label>
                      <button onClick={() => del(i)} title="حذف" style={{ fontSize: 14, padding: '4px', borderRadius: 8, border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setPkgs(pp => [...pp, { id: 'new_' + Date.now(), channel: ch, name: '', credits: 0, price: 0, active: true }])} style={{ alignSelf: 'flex-start', fontSize: 11.5, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 8px' }}>＋ افزودنِ بستهٔ {unit}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
        <OutlineButton onClick={addRow}>＋ پکیج</OutlineButton>
        <GoldButton onClick={save}>ذخیرهٔ پکیج‌ها</GoldButton>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>سفارش‌های شارژ {pending.length > 0 && <span style={{ color: '#e7674a', fontSize: 12 }}>({fa(pending.length)} در انتظار)</span>}</div>
      {orders.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>سفارشی ثبت نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {orders.slice(0, 20).map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--bg2)', borderRadius: 10, padding: '9px 12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12.5 }}>
                <span style={{ fontWeight: 700 }}>{o.name}</span>
                <span style={{ color: 'var(--muted)', marginInlineStart: 8, direction: 'ltr', display: 'inline-block' }}>{o.owner}</span>
                <span style={{ color: 'var(--muted)', marginInlineStart: 8 }}>· {o.kind === 'plan' ? 'اشتراک' : (o.channel === 'sms' ? 'پیامک' : o.channel === 'token' ? 'توکن' : 'ایمیل')}{o.kind !== 'plan' ? ` · ${fa(o.credits || 0)} عدد` : ''} · {fa(o.price)} تومان</span>
                {o.receipt && <span style={{ color: 'var(--gold)', marginInlineStart: 8, fontSize: 11.5 }}>💳 کارت‌به‌کارت · کدِ رهگیری: {o.receipt}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {o.status === 'pending' ? <>
                  <button onClick={() => orderAct(o.id, 'approveOrder')} style={{ fontSize: 11.5, padding: '4px 11px', borderRadius: 8, border: '1px solid #5fd98a', color: '#5fd98a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>تأیید و شارژ</button>
                  <button onClick={() => orderAct(o.id, 'rejectOrder')} style={{ fontSize: 11.5, padding: '4px 11px', borderRadius: 8, border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>رد</button>
                </> : <span style={{ fontSize: 11.5, fontWeight: 700, color: o.status === 'paid' ? '#5fd98a' : 'var(--faint)' }}>{o.status === 'paid' ? '✓ پرداخت‌شده' : 'رد‌شده'}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── New-listing alerts («آگهی جدید اومد خبرم کن») ──────────────────────────
function AlertsConfig() {
  const [f, setF] = useState({ enabled: false, pattern: '', patternVar: 'message' })
  const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/admin/alerts-config').then(r => r.ok ? r.json() : null).then(d => { if (d) setF({ enabled: !!d.enabled, pattern: d.pattern || '', patternVar: d.patternVar || 'message' }) }) }, [])
  const save = async () => { setMsg(''); const r = await fetch('/api/admin/alerts-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); const d = await r.json(); setMsg(r.ok ? '✓ ذخیره شد' : `⚠ ${d.error || 'خطا'}`) }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>هشدارِ آگهیِ جدید («خبرم کن»)</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.9 }}>
        وقتی کاربر روی «آگهی جدید اومد خبرم کن» می‌زند، جستجویش ذخیره می‌شود و با آمدنِ آگهیِ جدیدِ منطبق، یک پیام در «گفتگوها» از طرفِ ملک‌جت می‌گیرد. اگر اینجا فعال کنی، یک پیامک هم (با پترنِ سریع) برایش می‌رود.
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 700, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.enabled} onChange={e => setF({ ...f, enabled: e.target.checked })} style={{ width: 18, height: 18 }} /> ارسالِ پیامکِ هشدار فعال باشد
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
        <div><label style={lab}>کدِ پترن IPPanel (اختیاری)</label><input style={inp} placeholder="مثلاً 123456" value={f.pattern} onChange={e => setF({ ...f, pattern: e.target.value })} /></div>
        <div><label style={lab}>نامِ متغیرِ پترن</label><input style={inp} placeholder="message" value={f.patternVar} onChange={e => setF({ ...f, patternVar: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <GoldButton onClick={save}>ذخیره</GoldButton>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
      </div>
    </Card>
  )
}

// ─── Profile-completion gate (auto warn + suspend) ─────────────────────────
function ProfileGateConfig() {
  const [f, setF] = useState({ enabled: false, minPercent: 70, graceDays: 3, pattern: '', patternVar: 'message' })
  const [msg, setMsg] = useState('')
  const [run, setRun] = useState('')
  useEffect(() => { fetch('/api/admin/profile-gate-config').then(r => r.ok ? r.json() : null).then(d => { if (d) setF({ enabled: !!d.enabled, minPercent: d.minPercent ?? 70, graceDays: d.graceDays ?? 3, pattern: d.pattern || '', patternVar: d.patternVar || 'message' }) }) }, [])
  const save = async () => { setMsg(''); const r = await fetch('/api/admin/profile-gate-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); const d = await r.json(); setMsg(r.ok ? '✓ ذخیره شد' : `⚠ ${d.error || 'خطا'}`) }
  const runNow = async () => { setRun('در حال اجرا…'); try { const r = await fetch('/api/admin/profile-gate-config?run=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, run: true }) }); const d = await r.json(); setRun(r.ok && d.result ? `✓ بررسی‌شده: ${(d.result.checked || 0).toLocaleString('fa-IR')} · هشدار: ${(d.result.warned || 0).toLocaleString('fa-IR')} · معلق: ${(d.result.suspended || 0).toLocaleString('fa-IR')}` : `⚠ ${d.error || 'خطا'}`) } catch { setRun('⚠ خطا در اجرا') } }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>سامانهٔ تکمیلِ پروفایل (هشدار و تعلیقِ خودکار) {f.enabled && <span style={{ color: '#5fd98a', fontSize: 12 }}>● فعال</span>}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.9 }}>
        به‌صورتِ خودکار (هر ۵ دقیقه) پروفایل‌های ناقصِ کسب‌وکار را پیدا می‌کند: ابتدا پیامکِ هشدار می‌فرستد که «اگر ظرفِ {f.graceDays.toLocaleString('fa-IR')} روز تکمیل نکنی پنل معلق می‌شود»، و اگر بعدِ مهلت همچنان زیرِ {f.minPercent.toLocaleString('fa-IR')}٪ بود، پنل را معلق می‌کند. با تکمیلِ پروفایل، تعلیق خودکار رفع می‌شود. (کاربرانِ عادی/خریدار مشمول نیستند.)
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 700, marginBottom: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.enabled} onChange={e => setF({ ...f, enabled: e.target.checked })} style={{ width: 18, height: 18 }} /> سامانهٔ هشدار و تعلیقِ خودکار فعال باشد
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
        <div><label style={lab}>حداقلِ تکمیلِ لازم (٪)</label><input style={inp} type="number" min={0} max={100} value={f.minPercent} onChange={e => setF({ ...f, minPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></div>
        <div><label style={lab}>مهلتِ تکمیل پس از هشدار (روز)</label><input style={inp} type="number" min={0} value={f.graceDays} onChange={e => setF({ ...f, graceDays: Math.max(0, Number(e.target.value) || 0) })} /></div>
        <div><label style={lab}>کدِ پترن IPPanel (اختیاری)</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} placeholder="مثلاً 123456" value={f.pattern} onChange={e => setF({ ...f, pattern: e.target.value })} /></div>
        <div><label style={lab}>نامِ متغیرِ پترن</label><input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} placeholder="message" value={f.patternVar} onChange={e => setF({ ...f, patternVar: e.target.value })} /></div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 12, lineHeight: 1.8 }}>اگر کدِ پترن خالی بماند، متنِ هشدار با پیامکِ معمولیِ IPPanel ارسال می‌شود. متغیرِ پترن باید همان نامِ متغیرِ متنِ پیام در پترنِ شما باشد.</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <GoldButton onClick={save}>ذخیره</GoldButton>
        <OutlineButton onClick={runNow}>اجرای فوریِ بررسی</OutlineButton>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
        {run && <span style={{ fontSize: 12.5, color: run.startsWith('✓') ? '#5fd98a' : 'var(--muted)' }}>{run}</span>}
      </div>
    </Card>
  )
}

// ─── Shahkar identity (Pod.ir) ──────────────────────────────────────────────
function PodiumConfig() {
  const [f, setF] = useState({ token: '', idKey: '', matchKey: '', idProduct: '46659320', matchProduct: '46645324', enabled: false })
  const [masked, setMasked] = useState({ token: '', idKey: '', matchKey: '' })
  const [st, setSt] = useState<{ configured: boolean; missing: string[] } | null>(null)
  const [msg, setMsg] = useState('')
  const load = () => fetch('/api/admin/podium-config').then(r => r.ok ? r.json() : null).then(d => { if (d) { setMasked({ token: d.token, idKey: d.idKey, matchKey: d.matchKey }); setF(p => ({ ...p, idProduct: d.idProduct, matchProduct: d.matchProduct, enabled: d.enabled })); setSt({ configured: d.configured, missing: d.missing }) } })
  useEffect(() => { load() }, [])
  const save = async () => {
    setMsg('')
    const payload: any = { idProduct: f.idProduct, matchProduct: f.matchProduct, enabled: f.enabled }
    if (f.token.trim()) payload.token = f.token.trim()
    if (f.idKey.trim()) payload.idKey = f.idKey.trim()
    if (f.matchKey.trim()) payload.matchKey = f.matchKey.trim()
    const r = await fetch('/api/admin/podium-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const d = await r.json(); setMsg(r.ok ? '✓ ذخیره شد' : `⚠ ${d.error || 'خطا'}`); setF(p => ({ ...p, token: '', idKey: '', matchKey: '' })); load()
  }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>احرازِ هویتِ شاهکار (Pod.ir) {st?.configured && <span style={{ color: '#5fd98a', fontSize: 12 }}>● پیکربندی‌شده</span>}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.9 }}>
        با روشن‌بودن، ثبت‌نامِ کاربرِ جدید نیازمندِ تأییدِ هویت است: استعلامِ ثبت‌احوال (کد ملی + تاریخ تولدِ شمسی) و تطبیقِ شاهکار (موبایل ↔ کد ملی). کلیدها را از پنل Pod.ir بگیر و اینجا بگذار (یا در env سرور). پیامکِ کد همچنان از IPPanel می‌رود.
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 700, marginBottom: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.enabled} onChange={e => setF({ ...f, enabled: e.target.checked })} style={{ width: 18, height: 18 }} /> احرازِ هویتِ شاهکار برای ثبت‌نام فعال باشد
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
        <div style={{ gridColumn: '1 / -1' }}><label style={lab}>PODIUM_TOKEN {masked.token && <span style={{ color: 'var(--faint)' }}>({masked.token})</span>}</label><input style={inp} placeholder={masked.token || 'توکنِ پادیوم'} value={f.token} onChange={e => setF({ ...f, token: e.target.value })} /></div>
        <div><label style={lab}>GET_IDENTITY_INFO_API_KEY {masked.idKey && <span style={{ color: 'var(--faint)' }}>({masked.idKey})</span>}</label><input style={inp} placeholder={masked.idKey || 'کلیدِ استعلامِ هویت'} value={f.idKey} onChange={e => setF({ ...f, idKey: e.target.value })} /></div>
        <div><label style={lab}>MATCH…_API_KEY {masked.matchKey && <span style={{ color: 'var(--faint)' }}>({masked.matchKey})</span>}</label><input style={inp} placeholder={masked.matchKey || 'کلیدِ تطبیقِ شاهکار'} value={f.matchKey} onChange={e => setF({ ...f, matchKey: e.target.value })} /></div>
        <div><label style={lab}>POD_IDENTITY_PRODUCT_ID</label><input style={inp} value={f.idProduct} onChange={e => setF({ ...f, idProduct: e.target.value })} /></div>
        <div><label style={lab}>POD_MATCH_PRODUCT_ID</label><input style={inp} value={f.matchProduct} onChange={e => setF({ ...f, matchProduct: e.target.value })} /></div>
      </div>
      {st && !st.configured && st.missing.length > 0 && <div style={{ fontSize: 12, color: '#e7674a', marginBottom: 10 }}>کلیدهای نیامده: {st.missing.join('، ')}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <GoldButton onClick={save}>ذخیره</GoldButton>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
      </div>
    </Card>
  )
}

// ─── Connections / integrations hub ────────────────────────────────────────
function ConnectionsView() {
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>اتصال‌ها و سرویس‌ها</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>سرویس‌های بیرونی: نقشه (نشان)، ایمیل (SMTP)، پرداخت و پروکسی دیوار. تنظیماتِ <b>پیامک و الگوها</b> (IPPanel، هشدار، تکمیل پروفایل، مذاکره، دعوت) در منوی «پیامک و الگوها» و <b>ترکر</b> در منوی خودش است. کلید هوش مصنوعی در «API و مدل‌های AI».</div>
      </Card>
      <PodiumConfig />
      <NeshanConfig />
      <SmtpConfig />
      <ZarinpalConfig />
      <ImgbbConfig />
      <DivarProxyConfig />
    </div>
  )
}

// ─── Categories CRUD (WordPress-like) ──────────────────────────────────────
function CategoriesView() {
  const TYPES: [string, string][] = [['article', 'مقالات'], ['listing', 'آگهی‌ها'], ['product', 'محصولات'], ['directory', 'پروفایل/دفاتر']]
  const [type, setType] = useState('article')
  const [cats, setCats] = useState<{ id: string; name: string; slug: string }[]>([])
  const [name, setName] = useState('')
  const load = (t: string) => fetch(`/api/admin/categories?type=${t}`).then(r => r.ok ? r.json() : { categories: [] }).then(d => setCats(d.categories || []))
  useEffect(() => { load(type) }, [type])
  const add = async () => { if (!name.trim()) return; const r = await fetch('/api/admin/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, name: name.trim() }) }); const d = await r.json(); setCats(d.categories || cats); setName('') }
  const rename = async (id: string, cur: string) => { const n = prompt('نام جدید:', cur); if (!n) return; const r = await fetch('/api/admin/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id, name: n }) }); setCats((await r.json()).categories || cats) }
  const del = async (id: string) => { if (!confirm('این دسته حذف شود؟')) return; const r = await fetch(`/api/admin/categories?type=${type}&id=${id}`, { method: 'DELETE' }); setCats((await r.json()).categories || cats) }
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>دسته‌بندی‌ها</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TYPES.map(([k, l]) => <button key={k} onClick={() => setType(k)} style={{ padding: '7px 15px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, border: `1px solid ${type === k ? 'var(--gold)' : 'var(--line2)'}`, background: type === k ? 'var(--goldDim)' : 'transparent', color: type === k ? 'var(--gold)' : 'var(--muted)', fontWeight: type === k ? 700 : 500 }}>{l}</button>)}
        </div>
      </Card>
      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="نام دستهٔ جدید…" style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          <GoldButton onClick={add}>＋ افزودن</GoldButton>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cats.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>دسته‌ای نیست.</div> : cats.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}>
              <div><span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</span><span style={{ fontSize: 11, color: 'var(--faint)', marginInlineStart: 8, direction: 'ltr' }}>/{c.slug}</span></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => rename(c.id, c.name)} style={{ fontSize: 11.5, padding: '4px 11px', borderRadius: 8, border: '1px solid var(--gold)', color: 'var(--gold)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>ویرایش</button>
                <button onClick={() => del(c.id)} style={{ fontSize: 12.5, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Products management (create / edit / delete) ──────────────────────────
function ProductsView() {
  const [items, setItems] = useState<MItem[]>([])
  const [edit, setEdit] = useState<MItem | null>(null)
  const [show, setShow] = useState(false)
  const [cats, setCats] = useState<string[]>([])
  const [f, setF] = useState({ title: '', price: '', location: '', image: '', excerpt: '', category: '' })
  const load = () => fetch('/api/admin/scraper/items?type=product').then(r => r.ok ? r.json() : { items: [] }).then(d => setItems(d.items || []))
  useEffect(() => { load(); fetch('/api/categories?type=product').then(r => r.json()).then(d => setCats(d.categories || [])) }, [])
  const create = async () => {
    if (!f.title.trim()) return
    await fetch('/api/admin/scraper/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'product', ...f }) })
    setF({ title: '', price: '', location: '', image: '', excerpt: '', category: '' }); setShow(false); load()
  }
  const del = async (id: string) => { if (!confirm('این محصول حذف شود؟')) return; setItems(items.filter(i => i.id !== id)); await fetch(`/api/admin/scraper/items?id=${id}`, { method: 'DELETE' }) }
  const saveEdit = async (patch: any) => { if (!edit) return; setItems(items.map(i => i.id === edit.id ? { ...i, ...patch } : i)); await fetch('/api/admin/scraper/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: edit.id, patch }) }); setEdit(null) }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const pg = usePaged(items)
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div><div style={{ fontWeight: 800, fontSize: 16 }}>مدیریت محصولات فروشگاه</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{items.length.toLocaleString('fa-IR')} محصول — ایجاد، ویرایش و حذف</div></div>
          <GoldButton onClick={() => setShow(s => !s)}>{show ? 'بستن' : '＋ محصول جدید'}</GoldButton>
        </div>
        {show && (
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="mjsa-2col">
            <input style={inp} placeholder="نام محصول *" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
            <input style={inp} placeholder="قیمت" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} />
            <select style={inp} value={f.category} onChange={e => setF({ ...f, category: e.target.value })}><option value="">دسته…</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <input style={inp} placeholder="تأمین‌کننده/موقعیت" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} />
            <div style={{ gridColumn: '1 / -1' }}><ImageUpload label="تصویر محصول" value={f.image} onChange={url => setF({ ...f, image: url })} /></div>
            <textarea style={{ ...inp, gridColumn: '1 / -1', height: 60, resize: 'none' }} placeholder="توضیح" value={f.excerpt} onChange={e => setF({ ...f, excerpt: e.target.value })} />
            <div style={{ gridColumn: '1 / -1' }}><GoldButton onClick={create}>ثبت محصول</GoldButton></div>
          </div>
        )}
      </Card>
      <Card>
        {items.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>محصولی نیست. «محصول جدید» را بزن یا از موتور اسکرپ محصول واکشی کن.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pg.paged.map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', borderRadius: 12, padding: '10px 12px', flexWrap: 'wrap' }}>
                {it.image ? <img src={it.image} alt="" style={{ width: 46, height: 46, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} /> : <span style={{ width: 46, height: 46, borderRadius: 9, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>◰</span>}
                <div style={{ flex: 1, minWidth: 160 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.title}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{[it.location, it.category].filter(Boolean).join(' · ')}</div></div>
                {it.price && <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 13 }}>{it.price}</span>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <OutlineButton onClick={() => setEdit(it)} style={{ fontSize: 11.5, padding: '4px 11px' }}>ویرایش</OutlineButton>
                  <button onClick={() => del(it.id)} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pager {...pg} />
      </Card>
      {edit && <EditItemModal item={edit} onClose={() => setEdit(null)} onSave={saveEdit} />}
    </div>
  )
}

// ─── Super-admin CRM control center ────────────────────────────────────────
function CrmAdminView() {
  const [data, setData] = useState<any>(null)
  const load = () => fetch('/api/admin/crm').then(r => r.ok ? r.json() : null).then(setData)
  useEffect(() => { load() }, [])
  const del = async (kind: string, id: string) => { if (!confirm('حذف شود؟')) return; await fetch(`/api/admin/crm?kind=${kind}&id=${id}`, { method: 'DELETE' }); load() }
  const STAGE: Record<string, { l: string; c: string }> = { new: { l: 'لید جدید', c: '#7a8fae' }, review: { l: 'بررسی', c: '#e7a14a' }, offered: { l: 'پیشنهاد', c: 'var(--gold)' }, contract: { l: 'قرارداد', c: '#5fd98a' }, lost: { l: 'ازدست‌رفته', c: '#e7674a' } }
  const setStage = async (id: string, stage: string) => { await fetch('/api/admin/crm', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'lead', id, stage }) }); load() }
  if (!data) return <Card>در حال بارگذاری…</Card>
  const s = data.stats || {}
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <KPI label="کل لیدها" value={(s.totalLeads || 0).toLocaleString('fa-IR')} icon="◈" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" trend={`${(s.byStage?.contract || 0).toLocaleString('fa-IR')} قرارداد`} />
        <KPI label="وظایف باز" value={(s.openTasks || 0).toLocaleString('fa-IR')} icon="✓" iconBg="var(--goldDim)" iconColor="var(--gold)" trend={`${(s.totalTasks || 0).toLocaleString('fa-IR')} کل`} />
        <KPI label="مشتریان" value={(s.totalClients || 0).toLocaleString('fa-IR')} icon="♛" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" trend="ثبت‌شده" />
        <KPI label="در مذاکره" value={((s.byStage?.offered || 0) + (s.byStage?.review || 0)).toLocaleString('fa-IR')} icon="◴" iconBg="rgba(231,161,74,.15)" iconColor="#e7a14a" trend="بررسی+پیشنهاد" />
      </div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>لیدها ({(data.leads || []).length.toLocaleString('fa-IR')})</div>
        {(data.leads || []).length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>هنوز لیدی ثبت نشده. لیدها از پنل CRM مشاوران ثبت می‌شوند.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data.leads || []).map((l: any) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 150 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.name}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{[l.need, l.budget, l.phone].filter(Boolean).join(' · ')}</div></div>
                <select value={l.stage} onChange={e => setStage(l.id, e.target.value)} style={{ background: 'var(--surface)', border: `1px solid ${STAGE[l.stage]?.c || 'var(--line2)'}`, color: STAGE[l.stage]?.c || 'var(--text)', borderRadius: 8, padding: '5px 9px', fontFamily: 'inherit', fontSize: 12 }}>{Object.entries(STAGE).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select>
                <button onClick={() => del('lead', l.id)} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="mjsa-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>وظایف ({(data.tasks || []).length.toLocaleString('fa-IR')})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(data.tasks || []).slice(0, 30).map((t: any) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ color: t.done ? '#5fd98a' : 'var(--faint)' }}>{t.done ? '✓' : '○'}</span>
                <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--muted)' : 'var(--text)' }}>{t.title}</span>
                <button onClick={() => del('task', t.id)} style={{ background: 'transparent', border: 'none', color: '#e7674a', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
            {(data.tasks || []).length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>وظیفه‌ای نیست.</div>}
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>مشتریان ({(data.clients || []).length.toLocaleString('fa-IR')})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(data.clients || []).slice(0, 30).map((c: any) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ flex: 1 }}>{c.name}{c.phone && <span style={{ color: 'var(--faint)', marginInlineStart: 6, direction: 'ltr' }}>{c.phone}</span>}</span>
                <button onClick={() => del('client', c.id)} style={{ background: 'transparent', border: 'none', color: '#e7674a', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
            {(data.clients || []).length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>مشتری‌ای نیست.</div>}
          </div>
        </Card>
      </div>
    </div>
  )
}

function SmtpConfig() {
  const [f, setF] = useState({ host: '', port: '465', user: '', pass: '', from: '' })
  const [configured, setConfigured] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    fetch('/api/admin/smtp-config').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setConfigured(d.configured); setF(p => ({ ...p, host: d.host || '', port: String(d.port || 465), user: d.user || '', from: d.from || '', pass: d.pass || '' })) }
    })
  }, [])
  const save = async () => {
    setMsg('')
    const r = await fetch('/api/admin/smtp-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    const d = await r.json()
    setMsg(r.ok ? '✓ ذخیره شد' : `⚠ ${d.error || 'خطا'}`)
    if (r.ok) setConfigured(true)
  }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', direction: 'ltr', textAlign: 'left' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>سرویس ایمیل (SMTP) — برای کمپین ایمیل {configured && <span style={{ color: '#5fd98a', fontSize: 12 }}>● تنظیم‌شده</span>}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>اطلاعات SMTP سرویس ایمیلت را بگذار (پورت ۴۶۵ برای TLS مستقیم، ۵۸۷ برای STARTTLS).</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
        <div><label style={lab}>هاست SMTP</label><input style={inp} placeholder="smtp.example.com" value={f.host} onChange={e => setF({ ...f, host: e.target.value })} /></div>
        <div><label style={lab}>پورت</label><input style={inp} placeholder="465" value={f.port} onChange={e => setF({ ...f, port: e.target.value })} /></div>
        <div><label style={lab}>نام کاربری</label><input style={inp} placeholder="user@example.com" value={f.user} onChange={e => setF({ ...f, user: e.target.value })} /></div>
        <div><label style={lab}>رمز عبور</label><input style={inp} type="password" placeholder="••••••" value={f.pass} onChange={e => setF({ ...f, pass: e.target.value })} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lab}>آدرس فرستنده (From)</label><input style={inp} placeholder="info@melkjet.com" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <GoldButton onClick={save}>ذخیره</GoldButton>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
      </div>
    </Card>
  )
}

function APIView() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_GAP_BASE)
  const [apiKey, setApiKey] = useState('')
  const [masked, setMasked] = useState('')
  const [models, setModels] = useState<string[]>(FALLBACK_MODELS)
  const [modelsSource, setModelsSource] = useState('')
  const [assign, setAssign] = useState<Record<string, { text?: string; image?: string; textProvider?: string; imageProvider?: string }>>({})
  const [msg, setMsg] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  // ارائه‌دهنده‌های اضافی (مثلِ aval) + مدل‌هایشان
  const [providers, setProviders] = useState<Record<string, { label?: string; baseUrl: string; configured: boolean; masked: string }>>({})
  const [provModels, setProvModels] = useState<Record<string, string[]>>({})
  const [pId, setPId] = useState('aval')
  const [pBase, setPBase] = useState('https://api.avalai.ir/v1')
  const [pKey, setPKey] = useState('')
  const [pMsg, setPMsg] = useState('')

  const loadProviderModels = async (id: string) => {
    try { const r = await fetch(`/api/admin/ai/models?provider=${encodeURIComponent(id)}`); if (r.ok) { const d = await r.json(); setProvModels(m => ({ ...m, [id]: d.models || [] })) } } catch {}
  }
  const loadConfig = async () => {
    const r = await fetch('/api/admin/ai/config')
    if (r.ok) {
      const d = await r.json(); setBaseUrl(d.baseUrl); setMasked(d.masked)
      const provs = d.providers || {}; setProviders(provs)
      for (const id of Object.keys(provs)) if (provs[id].configured) loadProviderModels(id)
    }
  }
  const loadAgents = async () => {
    const r = await fetch('/api/admin/ai/agents')
    if (r.ok) setAssign((await r.json()).agentModels || {})
  }
  const loadModels = async () => {
    setLoadingModels(true)
    const r = await fetch('/api/admin/ai/models')
    if (r.ok) { const d = await r.json(); setModels(d.models || FALLBACK_MODELS); setModelsSource(d.source) }
    setLoadingModels(false)
  }
  useEffect(() => { loadConfig(); loadAgents(); loadModels() }, [])

  const saveConfig = async () => {
    setMsg('')
    const r = await fetch('/api/admin/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl, apiKey }) })
    if (r.ok) { setMsg('✓ ذخیره شد'); setApiKey(''); await loadConfig(); await loadModels() } else setMsg('خطا در ذخیره')
  }
  const saveProvider = async () => {
    const id = pId.trim(); if (!id) { setPMsg('شناسهٔ ارائه‌دهنده الزامی است'); return }
    setPMsg('در حال ذخیره…')
    const r = await fetch('/api/admin/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId: id, label: id, baseUrl: pBase, apiKey: pKey }) })
    if (r.ok) { setPMsg('✓ ذخیره شد'); setPKey(''); await loadConfig(); await loadProviderModels(id) } else setPMsg('خطا در ذخیره')
  }
  // مدل‌های دردسترس برای یک اسلات، بر اساسِ provider انتخاب‌شده
  const modelsFor = (providerId?: string) => (providerId && provModels[providerId]?.length ? provModels[providerId] : models)
  const setAgentProvider = async (agentId: string, slot: 'text' | 'image', providerId: string) => {
    const key = slot === 'image' ? 'imageProvider' : 'textProvider'
    setAssign(a => ({ ...a, [agentId]: { ...a[agentId], [key]: providerId } }))
    await fetch('/api/admin/ai/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId, [key]: providerId }) })
  }
  const provOptions = ['', ...Object.keys(providers)]
  const provLabel = (id?: string) => !id ? 'گپ (پیش‌فرض)' : (providers[id]?.label || id)

  const [testMsg, setTestMsg] = useState('')
  const testConn = async () => {
    setTestMsg('در حال تست…')
    try {
      const r = await fetch('/api/admin/ai/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini' }) })
      const d = await r.json()
      setTestMsg(d.ok ? `✓ اتصال موفق — پاسخ: «${d.text}»` : `✕ خطا: ${d.error}`)
    } catch { setTestMsg('✕ خطا در ارتباط') }
  }
  // تستِ واقعیِ تولید تصویر با مدلِ StudioAgent (یا gpt-image-1) — برای راستی‌آزماییِ پلان/۳بعدی
  const [imgTestMsg, setImgTestMsg] = useState('')
  const [imgTestUrl, setImgTestUrl] = useState('')
  const [imgTesting, setImgTesting] = useState(false)
  const testImage = async () => {
    const m = assign['studio']?.image || assign['content']?.image || 'gpt-image-1'
    setImgTesting(true); setImgTestMsg(`در حال ساختِ تصویرِ تست با «${m}»… (تا ۶۰ ثانیه)`); setImgTestUrl('')
    try {
      const r = await fetch('/api/admin/ai/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'image', model: m, provider: assign['studio']?.imageProvider || assign['content']?.imageProvider || '' }) })
      const d = await r.json()
      if (d.ok && d.image) { setImgTestMsg(`✓ تولید تصویر موفق با «${d.model}»`); setImgTestUrl(d.image) }
      else setImgTestMsg(`✕ خطا با «${d.model || m}»: ${d.error || 'خروجی خالی'}`)
    } catch { setImgTestMsg('✕ خطا در ارتباط با سرور') } finally { setImgTesting(false) }
  }
  // تستِ تولید ویدئو (async) — برای راستی‌آزماییِ مدلِ ویدئوی avalai پیش از وصل به استودیو
  const [vidTestMsg, setVidTestMsg] = useState('')
  const [vidTestUrl, setVidTestUrl] = useState('')
  const [vidTesting, setVidTesting] = useState(false)
  const [vidModel, setVidModel] = useState('')
  const testVideo = async () => {
    setVidTesting(true); setVidTestMsg(`در حال ساختِ ویدئوی تست${vidModel ? ` با «${vidModel}»` : ' (مدل خودکار)'}… ممکن است تا چند دقیقه طول بکشد.`); setVidTestUrl('')
    try {
      const r = await fetch('/api/admin/ai/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'video', model: vidModel.trim() || undefined, provider: assign['studio']?.imageProvider || '' }) })
      const d = await r.json()
      if (d.ok && d.video) { setVidTestMsg(`✓ تولید ویدئو موفق با «${d.model}»`); setVidTestUrl(d.video) }
      else setVidTestMsg(`✕ خطا با «${d.model || vidModel || 'auto'}»: ${d.error || 'خروجی خالی'}`)
    } catch { setVidTestMsg('✕ خطا در ارتباط با سرور') } finally { setVidTesting(false) }
  }

  const setAgentModel = async (agentId: string, slot: 'text' | 'image', model: string) => {
    setAssign(a => ({ ...a, [agentId]: { ...a[agentId], [slot]: model } }))
    await fetch('/api/admin/ai/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId, [slot]: model }) })
  }

  const autoAssign = async () => {
    const has = (re: RegExp) => models.find(m => re.test(m.toLowerCase()))
    const textPick = has(/gpt-4o(?!-mini)/) || has(/gpt-4\.1(?!-mini)/) || has(/gemini-2\.5-pro/) || has(/claude.*sonnet/) || models.find(m => categorizeModel(m) === 'text') || ''
    const fastText = has(/gpt-4o-mini/) || has(/gemini.*flash/) || has(/4\.1-mini/) || textPick
    const visionPick = has(/gpt-4o(?!-mini)/) || has(/gemini-2\.5/) || has(/claude.*sonnet/) || textPick
    const imagePick = has(/gpt-image/) || has(/dall-e-3/) || has(/flux/) || models.find(m => categorizeModel(m) === 'image') || ''
    for (const ag of AGENTS) {
      const isVision = ag.id === 'image' || ag.id === 'fraud'
      const isFast = ag.id === 'chat' || ag.id === 'alert' || ag.id === 'translation'
      const text = isVision ? visionPick : (isFast ? fastText : textPick)
      const image = ag.needs === 'both' ? imagePick : undefined
      if (text || image) {
        setAssign(a => ({ ...a, [ag.id]: { text: text || a[ag.id]?.text, image: image || a[ag.id]?.image } }))
        await fetch('/api/admin/ai/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: ag.id, text, image }) })
      }
    }
  }

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <SmtpConfig />
      {/* API config */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>اتصال به API گپ‌جی‌پی‌تی</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          سازگار با OpenAI. کلید را از پنل توسعه‌دهندگان گپ بگیر. {masked && <span style={{ color: '#5fd98a' }}>وضعیت: تنظیم‌شده ({masked})</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }}>Base URL</label>
            <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} style={{ width: '100%', direction: 'ltr', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }}>API Key {masked && '(برای تغییر وارد کن)'}</label>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder={masked || 'sk-...'} style={{ width: '100%', direction: 'ltr', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <GoldButton onClick={saveConfig}>ذخیره و اتصال</GoldButton>
          <OutlineButton onClick={loadModels}>{loadingModels ? 'در حال دریافت…' : '↻ دریافت لیست مدل‌ها'}</OutlineButton>
          <OutlineButton onClick={testConn}>⚡ تست اتصال (متن)</OutlineButton>
          <OutlineButton onClick={testImage}>{imgTesting ? '⏳ در حال ساخت…' : '🖼 تست تولید تصویر'}</OutlineButton>
          {testMsg && <span style={{ fontSize: 12.5, color: testMsg.startsWith('✓') ? '#5fd98a' : testMsg.startsWith('✕') ? '#e7674a' : 'var(--muted)' }}>{testMsg}</span>}
          {modelsSource && <span style={{ fontSize: 12, color: modelsSource === 'live' ? '#5fd98a' : 'var(--muted)' }}>{modelsSource === 'live' ? `✓ ${models.length} مدل زنده` : `لیست پیش‌فرض (${models.length} مدل) — کلید را ذخیره کن تا لیست زنده بیاید`}</span>}
          {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
        </div>
        {imgTestMsg && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: imgTestMsg.startsWith('✓') ? '#5fd98a' : imgTestMsg.startsWith('✕') ? '#e7674a' : 'var(--muted)' }}>{imgTestMsg}</span>
            {imgTestUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgTestUrl} alt="تصویر تست" style={{ width: 220, height: 220, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line2)' }} />
            )}
          </div>
        )}
        {/* تستِ ویدئو (Sora/Veo/Runway) — برای راستی‌آزماییِ مدلِ ویدئو پیش از وصل به استودیو */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>تستِ تولیدِ ویدئو (برای قابلیتِ واک‌ترِ استودیو). نامِ مدلِ ویدئو را از لیستت بگذار (مثلاً <span style={{ direction: 'ltr', display: 'inline-block' }}>sora-2</span>) یا خالی بگذار تا خودکار امتحان شود.</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={vidModel} onChange={e => setVidModel(e.target.value)} placeholder="مدلِ ویدئو (اختیاری)" style={{ direction: 'ltr', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 220 }} />
            <OutlineButton onClick={testVideo}>{vidTesting ? '⏳ در حال ساخت…' : '🎬 تست تولید ویدئو'}</OutlineButton>
            {vidTestMsg && <span style={{ fontSize: 12.5, color: vidTestMsg.startsWith('✓') ? '#5fd98a' : vidTestMsg.startsWith('✕') ? '#e7674a' : 'var(--muted)' }}>{vidTestMsg}</span>}
          </div>
          {vidTestUrl && (
            <video src={vidTestUrl} controls autoPlay loop muted style={{ marginTop: 12, width: 320, maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line2)' }} />
          )}
        </div>
      </Card>

      {/* ارائه‌دهنده‌های اضافی (مثل aval) */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>ارائه‌دهنده‌های اضافی (چند-API)</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.8 }}>پیش‌فرضِ همهٔ ایجنت‌ها «گپ» (بالا) است. اینجا می‌توانی ارائه‌دهندهٔ دیگری (مثلِ <b>aval</b>) اضافه کنی و در جدولِ پایین، هر ایجنت را به آن وصل کنی. هر دو سازگار با OpenAI‌اند.</div>
        {Object.keys(providers).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {Object.entries(providers).map(([id, p]) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px' }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--gold)' }}>{p.label || id}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', direction: 'ltr' }}>{p.baseUrl}</span>
                <span style={{ fontSize: 11, color: p.configured ? '#5fd98a' : '#e7674a' }}>{p.configured ? `کلید ✓ ${p.masked}` : 'بدون کلید'}</span>
                {provModels[id]?.length ? <span style={{ fontSize: 11, color: '#5fd98a' }}>{provModels[id].length} مدل</span> : null}
                <button onClick={() => loadProviderModels(id)} style={{ ...(undefined as any), padding: '4px 10px', borderRadius: 7, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit' }}>↻ مدل‌ها</button>
                <button onClick={async () => { if (confirm(`ارائه‌دهندهٔ «${id}» حذف شود؟`)) { await fetch('/api/admin/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removeProvider: id }) }); loadConfig() } }} style={{ marginInlineStart: 'auto', padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(231,103,74,.4)', background: 'transparent', color: '#e7674a', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit' }}>حذف</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 10 }} className="mjsa-2col">
          <div><label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>شناسه (مثلاً aval)</label><input value={pId} onChange={e => setPId(e.target.value)} style={{ width: '100%', direction: 'ltr', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} /></div>
          <div><label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Base URL</label><input value={pBase} onChange={e => setPBase(e.target.value)} style={{ width: '100%', direction: 'ltr', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} /></div>
          <div><label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>API Key</label><input value={pKey} onChange={e => setPKey(e.target.value)} type="password" placeholder="sk-…" style={{ width: '100%', direction: 'ltr', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <GoldButton onClick={saveProvider}>ذخیرهٔ ارائه‌دهنده</GoldButton>
          {pMsg && <span style={{ fontSize: 12.5, color: pMsg.startsWith('✓') ? '#5fd98a' : 'var(--muted)' }}>{pMsg}</span>}
        </div>
      </Card>

      {/* Agents → models */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>تخصیص مدل به ایجنت‌ها ({AGENTS.length})</div>
          <GoldButton onClick={autoAssign} style={{ fontSize: 12.5, padding: '7px 14px' }}>🎯 تخصیص خودکار مدل پیشنهادی</GoldButton>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>برای هر ایجنت، ارائه‌دهنده (گپ یا aval) و مدل را انتخاب کن. ایجنت‌های متن+تصویر (مثل استودیو) دو مدل می‌گیرند.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {AGENTS.map(ag => (
            <div key={ag.id} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 12, alignItems: 'center' }} className="mjsa-agentrow">
              <div>
                <div style={{ fontWeight: 700, fontSize: 12.5, fontFamily: '"JetBrains Mono", monospace' }}>{ag.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{ag.task}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 3 }}>{(ag.id === 'image' || ag.id === 'fraud') ? 'مدل بینایی (چندوجهی)' : 'مدل متن/چت'}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {provOptions.length > 1 && (
                    <select value={assign[ag.id]?.textProvider || ''} onChange={e => setAgentProvider(ag.id, 'text', e.target.value)} style={{ flex: '0 0 auto', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, padding: '7px 8px', color: 'var(--text)', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', maxWidth: 90 }}>
                      {provOptions.map(p => <option key={p || 'gap'} value={p}>{provLabel(p)}</option>)}
                    </select>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}><ModelSelect models={modelsFor(assign[ag.id]?.textProvider)} value={assign[ag.id]?.text || ''} onChange={v => setAgentModel(ag.id, 'text', v)} /></div>
                </div>
              </div>
              <div>
                {ag.needs === 'both' ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 3 }}>مدل تصویر</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {provOptions.length > 1 && (
                        <select value={assign[ag.id]?.imageProvider || ''} onChange={e => setAgentProvider(ag.id, 'image', e.target.value)} style={{ flex: '0 0 auto', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, padding: '7px 8px', color: 'var(--text)', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', maxWidth: 90 }}>
                          {provOptions.map(p => <option key={p || 'gap'} value={p}>{provLabel(p)}</option>)}
                        </select>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}><ModelSelect models={modelsFor(assign[ag.id]?.imageProvider)} value={assign[ag.id]?.image || ''} onChange={v => setAgentModel(ag.id, 'image', v)} only="image" /></div>
                    </div>
                  </>
                ) : <div style={{ fontSize: 11, color: 'var(--faint)' }}>—</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ─── کاربران: مدیریت کامل حساب‌ها ───────────────────────────── */
interface Account { phone: string; name?: string; role?: string; plan?: string; onboarded: boolean; createdAt: number; lastLogin?: number }
interface IdName { id: string; name: string }

const RMETA: Record<string, { c: string; ic: string }> = {
  '/buyer': { c: '#5b9bd5', ic: '🔑' }, '/owner': { c: '#5fd98a', ic: '🏠' }, '/pros': { c: '#c9a84c', ic: '🤝' },
  '/agency': { c: '#a99bf0', ic: '🏢' }, '/builder': { c: '#e7894a', ic: '🏗' }, '/materials': { c: '#4ec4e8', ic: '🧱' }, '/legal': { c: '#e0719a', ic: '⚖' }, '': { c: '#8a8a8a', ic: '○' },
}
function uInitials(name?: string, phone?: string) { const n = (name || '').trim(); if (n) { const p = n.split(/\s+/); return (p[0]?.[0] || '') + (p[1]?.[0] || '') } return (phone || '').slice(-2) }
function UAvatar({ name, phone, dash, size = 40 }: { name?: string; phone?: string; dash?: string; size?: number }) {
  const m = RMETA[dash || ''] || RMETA['']
  return <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg,${m.c},${m.c}88)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.36, flexShrink: 0, boxShadow: `0 4px 12px -4px ${m.c}99` }}>{uInitials(name, phone)}</div>
}
function UChip({ label, color, icon }: { label: string; color: string; icon?: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color, background: color + '22', border: `1px solid ${color}55`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{icon && <span style={{ fontSize: 11 }}>{icon}</span>}{label}</span>
}

// کشوی جزئیاتِ کاملِ یک کاربر — KPIها، فعالیتِ نقش، اعتبار/مصرف، ویرایشِ سریع
// دکمهٔ بازخوانیِ هویت از شاهکار (پُرکردنِ همهٔ فیلدها برای کاربرِ احرازشده)
function RefetchIdentityBtn({ phone, onDone }: { phone: string; onDone: (acc: any) => void }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/shahkar-refetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const d = await r.json()
      if (r.ok && d.account) onDone(d.account)
      else alert(d.error || 'بازخوانی ناموفق بود')
    } catch { alert('خطا در ارتباط') } finally { setBusy(false) }
  }
  return <button onClick={run} disabled={busy} title="بازخوانیِ همهٔ فیلدها از سامانهٔ شاهکار" style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 999, padding: '3px 11px', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>{busy ? '… بازخوانی' : '↻ بازخوانی از شاهکار'}</button>
}

function UserDrawer({ user, roles, plans, onClose, onPatch, onDelete, onSuspend, onAccountUpdate }: { user: any; roles: IdName[]; plans: IdName[]; onClose: () => void; onPatch: (phone: string, patch: any) => void; onDelete: (phone: string) => void; onSuspend: (phone: string, suspend: boolean) => void; onAccountUpdate: (acc: any) => void }) {
  const [detail, setDetail] = useState<any>(null)
  const [edit, setEdit] = useState({ name: user.name || '', role: user.role || '', plan: user.plan || '' })
  const [saved, setSaved] = useState(false)
  useEffect(() => { fetch(`/api/admin/profiles?phone=${encodeURIComponent(user.phone)}`).then(r => r.ok ? r.json() : null).then(setDetail).catch(() => {}) }, [user.phone])
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [onClose])
  const m = RMETA[user.dashboard || ''] || RMETA['']
  const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  const save = () => { onPatch(user.phone, edit); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  return (
    <div dir="rtl" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-start', animation: 'fade .2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 540, maxWidth: '94vw', height: '100%', overflowY: 'auto', background: 'var(--bg)', borderInlineEnd: '1px solid var(--line2)', boxShadow: '0 0 60px -10px rgba(0,0,0,.6)', animation: 'slideIn .28s cubic-bezier(.2,.8,.2,1)' }}>
        <style>{`@keyframes slideIn{from{transform:translateX(-30px);opacity:.6}to{transform:none;opacity:1}}`}</style>
        {/* header */}
        <div style={{ position: 'relative', padding: '24px 22px', background: `linear-gradient(135deg,${m.c}22,transparent 70%), var(--surface)`, borderBottom: '1px solid var(--line)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, insetInlineStart: 16, width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer', fontSize: 16 }}>×</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <UAvatar name={user.name} phone={user.phone} dash={user.dashboard} size={58} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{user.name || 'بدون نام'}</div>
              <div style={{ fontSize: 13, color: 'var(--gold)', direction: 'ltr', fontFamily: '"JetBrains Mono", monospace' }}>{user.phone}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <UChip label={user.roleName || 'بدون نقش'} color={m.c} icon={m.ic} />
                <UChip label={user.planName || 'بدون پلن'} color="#a99bf0" icon="👑" />
                {user.suspended && <UChip label="معلق" color="#e7674a" icon="⛔" />}
                {user.dashboard && <a href={user.dashboard} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'none', border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 10px' }}>پنل ↗</a>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 11.5, color: 'var(--muted)' }}>
            <span>عضویت: {timeAgo(user.createdAt || null)}</span><span>·</span><span>آخرین ورود: {timeAgo(user.lastLogin || null)}</span><span>·</span><span>{user.onboarded ? 'تکمیل‌شده' : 'جدید'}</span>
          </div>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* KPI cards from profile detail */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[['آگهی', user.listings], ['لید', user.leads], ['وظیفه', user.tasks], ['مصرف توکن', user.tokenUsed], ['اعتبار پیامک', user.credit?.sms], ['اعتبار توکن', user.credit?.token]].map(([l, v]: any) => (
              <div key={l} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 13 }}><div style={{ fontSize: 11, color: 'var(--muted)' }}>{l}</div><div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', marginTop: 4 }}>{fa(v || 0)}</div></div>
            ))}
          </div>

          {/* هویتِ شاهکار — همهٔ فیلدهای برگشتی از سامانه */}
          {(() => {
            const idRows = buildIdentityRows(user)
            return (
              <div style={{ background: 'var(--surface)', border: `1px solid ${user.identityVerifiedAt ? 'rgba(95,217,138,.35)' : 'var(--line)'}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>هویتِ سامانهٔ شاهکار {idRows.length > 0 && <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 600 }}>({idRows.length.toLocaleString('fa-IR')} فیلد)</span>}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {user.identityVerifiedAt
                      ? <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5fd98a', background: 'rgba(95,217,138,.12)', border: '1px solid rgba(95,217,138,.4)', borderRadius: 999, padding: '3px 11px' }}>✓ احراز شده</span>
                      : <span style={{ fontSize: 11.5, fontWeight: 700, color: '#e7894a', background: 'rgba(231,137,74,.12)', border: '1px solid rgba(231,137,74,.4)', borderRadius: 999, padding: '3px 11px' }}>⏳ احراز نشده</span>}
                    {user.nationalId && <RefetchIdentityBtn phone={user.phone} onDone={onAccountUpdate} />}
                  </div>
                </div>
                {idRows.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }} className="mjsa-idgrid">
                    {idRows.map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, background: 'var(--bg2)', borderRadius: 8, padding: '7px 10px' }}><span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.label}</span><span style={{ fontWeight: 700, direction: r.ltr ? 'ltr' : 'rtl', textAlign: r.ltr ? 'left' : 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.value}</span></div>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>این کاربر هنوز هویتش را با شاهکار تأیید نکرده است. وقتی خودش وارد شود و احراز کند (با احرازِ فعالِ شاهکار)، همهٔ فیلدهای هویتی این‌جا خودکار پر می‌شود.</div>}
              </div>
            )
          })()}

          {/* پروفایلِ کاملِ کسب‌وکار */}
          {detail?.profile && (() => {
            const pr = detail.profile
            const filled = (...keys: string[]) => keys.map(k => [k, pr[k]]).filter(([, v]) => v && (Array.isArray(v) ? v.length : true))
            const LBL: Record<string, string> = { kind: 'نوع', businessName: 'نامِ کسب‌وکار', displayName: 'نامِ نمایشی', businessType: 'نوعِ فعالیت', licenseNumber: 'پروانه/جواز', legalNationalId: 'شناسهٔ ملی', economicCode: 'کدِ اقتصادی', establishedYear: 'سالِ تأسیس', employees: 'پرسنل', contactPhone: 'تماسِ نمایشی', landline: 'تلفنِ ثابت', email: 'ایمیل', website: 'وب‌سایت', province: 'استان', city: 'شهر', neighborhood: 'محله', postalCode: 'کدِ پستی', workHours: 'ساعاتِ کاری' }
            const rows = filled('kind', 'businessName', 'displayName', 'businessType', 'licenseNumber', 'legalNationalId', 'economicCode', 'establishedYear', 'employees', 'contactPhone', 'landline', 'email', 'website', 'province', 'city', 'neighborhood', 'postalCode', 'workHours')
            const social = pr.social || {}
            const hasSocial = social.instagram || social.telegram || social.whatsapp || social.eitaa || social.linkedin
            const empty = rows.length === 0 && !pr.about && !pr.tagline && !pr.specialties?.length
            return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>پروفایلِ کسب‌وکار</div>
                  <span style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700 }}>تکمیل: {fa(detail.completeness || 0)}٪</span>
                </div>
                {empty ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>کاربر هنوز پروفایلش را کامل نکرده است.</div> : (
                  <>
                    {(pr.logo || pr.businessName || pr.tagline) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        {pr.logo && <img src={pr.logo} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--line2)' }} />}
                        <div><div style={{ fontSize: 14, fontWeight: 800 }}>{pr.businessName || pr.displayName || '—'}</div>{pr.tagline && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{pr.tagline}</div>}</div>
                      </div>
                    )}
                    {rows.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5, marginBottom: pr.about || pr.specialties?.length ? 12 : 0 }}>
                        {rows.map(([k, v]: any) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, background: 'var(--bg2)', borderRadius: 8, padding: '7px 10px' }}><span style={{ color: 'var(--muted)' }}>{LBL[k] || k}</span><span style={{ fontWeight: 700, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{k === 'kind' ? (v === 'business' ? 'کسب‌وکار' : 'شخصی') : String(v)}</span></div>)}
                      </div>
                    )}
                    {pr.about && <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.9, background: 'var(--bg2)', borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>{pr.about}</div>}
                    {[['تخصص‌ها', pr.specialties], ['خدمات', pr.services], ['مناطق', pr.areas]].filter(([, a]: any) => a?.length).map(([t, a]: any) => (
                      <div key={t} style={{ marginBottom: 8 }}><span style={{ fontSize: 11.5, color: 'var(--muted)', marginInlineEnd: 6 }}>{t}:</span>{a.map((x: string) => <span key={x} style={{ display: 'inline-block', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, padding: '2px 9px', fontSize: 11.5, margin: '0 3px 4px' }}>{x}</span>)}</div>
                    ))}
                    {hasSocial && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 11.5, color: 'var(--muted)', direction: 'ltr' }}>{social.instagram && <span>📷 {social.instagram}</span>}{social.telegram && <span>✈ {social.telegram}</span>}{social.whatsapp && <span>💬 {social.whatsapp}</span>}{social.eitaa && <span>📨 {social.eitaa}</span>}</div>}
                  </>
                )}
              </div>
            )
          })()}

          {/* role-specific KPIs */}
          {detail?.kpis?.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>عملکردِ نقش ({detail.account?.roleLabel})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {detail.kpis.map((k: any, i: number) => <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{k.label}</span><span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{k.money ? pfMoney(k.value) : fa(k.value)}</span></div>)}
              </div>
            </div>
          )}

          {/* activity sections */}
          {detail?.sections?.map((s: any, i: number) => s.items?.length > 0 && (
            <div key={i}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{s.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.items.slice(0, 6).map((it: any, j: number) => <div key={j} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 9, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.primary}</span>{it.secondary && <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{it.secondary}</span>}</div>)}
              </div>
            </div>
          ))}

          {/* quick edit */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>ویرایشِ سریع</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={lab}>نام</label><input style={inp} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><label style={lab}>نقش</label><select style={inp} value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })}><option value="">— بدون نقش</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div><label style={lab}>پلن</label><select style={inp} value={edit.plan} onChange={e => setEdit({ ...edit, plan: e.target.value })}><option value="">بدون پلن</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <GoldButton onClick={save}>ذخیرهٔ تغییرات</GoldButton>
              <button onClick={async () => { const r = await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: user.phone }) }); const d = await r.json(); if (d.ok) window.location.href = d.dashboard || '/buyer'; else alert(d.error || 'خطا') }} style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>↪ ورود به محیطِ کاربر</button>
              {user.suspended
                ? <button onClick={() => onSuspend(user.phone, false)} style={{ background: 'rgba(95,217,138,.12)', border: '1px solid rgba(95,217,138,.45)', color: '#5fd98a', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>✓ رفعِ تعلیق</button>
                : <button onClick={() => { if (confirm(`پنلِ ${user.name || user.phone} معلق شود؟`)) onSuspend(user.phone, true) }} style={{ background: 'transparent', border: '1px solid rgba(231,137,74,.45)', color: '#e7894a', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>⛔ تعلیقِ پنل</button>}
              {(() => { const has = Array.isArray(user.caps) && user.caps.includes('catalog'); return (
                <button onClick={async () => { const on = !has; await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: user.phone, cap: 'catalog', on }) }); onAccountUpdate({ phone: user.phone, caps: on ? [...(user.caps || []), 'catalog'] : (user.caps || []).filter((c: string) => c !== 'catalog') }) }}
                  style={{ background: has ? 'rgba(95,217,138,.12)' : 'transparent', border: `1px solid ${has ? 'rgba(95,217,138,.45)' : 'var(--gold)'}`, color: has ? '#5fd98a' : 'var(--gold)', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: has ? 700 : 400 }}>
                  🧱 {has ? 'دسترسیِ کاتالوگ: فعال — لغو' : 'دادنِ دسترسیِ کاتالوگ/اسکرپ'}
                </button>
              ) })()}
              <button onClick={() => { onDelete(user.phone); onClose() }} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.4)', color: '#e7674a', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>حذفِ کاربر</button>
              {saved && <span style={{ fontSize: 12.5, color: '#5fd98a' }}>✓ ذخیره شد</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// پاپ‌آپِ سادهٔ ساختِ کاربر — فقط شماره (و نقش/پلنِ اختیاری). بقیه در اولین ورودِ خودِ کاربر با شاهکار خودکار پر می‌شود.
function CreateUserPopup({ roles, plans, onClose, onCreated }: { roles: IdName[]; plans: IdName[]; onClose: () => void; onCreated: () => void }) {
  const [phone, setPhone] = useState(''); const [role, setRole] = useState(''); const [plan, setPlan] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '11px 13px', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 6, display: 'block', fontWeight: 600 }
  const submit = async () => {
    setError(''); if (!/^09\d{9}$/.test(phone)) { setError('شمارهٔ موبایلِ معتبر وارد کنید (۰۹...)'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, role, plan }) })
      const d = await r.json()
      if (!r.ok || d.error) { setError(d.error || 'خطا در ثبت'); return }
      onCreated(); onClose()
    } catch { setError('خطا در ارتباط') } finally { setBusy(false) }
  }
  return (
    <div dir="rtl" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1600, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fade .2s ease', fontFamily: 'inherit' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: '95vw', background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--line2)', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>ساختِ کاربرِ جدید</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9, background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}>فقط شمارهٔ موبایل را وارد کنید. <b>اطلاعاتِ هویتی و پروفایلِ کاربر، در اولین ورودِ خودش با احرازِ شاهکار به‌صورتِ خودکار کامل می‌شود.</b></div>
          <div><label style={lab}>شماره موبایل *</label><input style={{ ...inp, direction: 'ltr', textAlign: 'right' }} placeholder="۰۹۱۲۳۴۵۶۷۸۹" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} autoFocus /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lab}>نقش (اختیاری)</label><select style={inp} value={role} onChange={e => setRole(e.target.value)}><option value="">— بدون نقش</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            <div><label style={lab}>پلن (اختیاری)</label><select style={inp} value={plan} onChange={e => setPlan(e.target.value)}><option value="">بدون پلن</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>
          {error && <div style={{ fontSize: 12.5, color: '#e7674a' }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 22px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }} />
          <OutlineButton onClick={onClose}>انصراف</OutlineButton>
          <GoldButton onClick={submit}>{busy ? 'در حال ثبت…' : 'ثبتِ کاربر'}</GoldButton>
        </div>
      </div>
    </div>
  )
}

function UsersView() {
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<IdName[]>([])
  const [plans, setPlans] = useState<IdName[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [viewUser, setViewUser] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/admin/users')
    if (r.ok) { const d = await r.json(); setUsers(d.users || []); setRoles(d.roles || []); setPlans(d.plans || []) }
    setLoading(false); setSel(new Set())
  }
  useEffect(() => { load() }, [])

  const patchOne = async (phone: string, patch: { name?: string; role?: string; plan?: string }) => {
    setUsers(us => us.map(u => u.phone === phone ? { ...u, ...patch, onboarded: patch.role !== undefined ? true : u.onboarded } : u))
    if (viewUser?.phone === phone) setViewUser((v: any) => ({ ...v, ...patch }))
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, patch }) })
    load()
  }
  const delOne = async (phone: string) => {
    if (!confirm(`کاربر ${phone} حذف شود؟`)) return
    setUsers(us => us.filter(u => u.phone !== phone)); setSel(s => { const n = new Set(s); n.delete(phone); return n })
    await fetch(`/api/admin/users?phone=${encodeURIComponent(phone)}`, { method: 'DELETE' })
  }
  const suspendOne = async (phone: string, suspend: boolean) => {
    setUsers(us => us.map(u => u.phone === phone ? { ...u, suspended: suspend } : u))
    if (viewUser?.phone === phone) setViewUser((v: any) => ({ ...v, suspended: suspend }))
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, suspend }) })
    load()
  }

  const filtered = users.filter(u => {
    if (q.trim()) { const t = q.trim(); if (!(u.phone.includes(t) || (u.name || '').includes(t))) return false }
    if (roleFilter && u.role !== roleFilter) return false
    if (planFilter === '__none') { if (u.plan) return false }
    else if (planFilter && u.plan !== planFilter) return false
    return true
  })

  const toggleSel = (phone: string) => setSel(s => { const n = new Set(s); n.has(phone) ? n.delete(phone) : n.add(phone); return n })
  const allVisibleSelected = filtered.length > 0 && filtered.every(u => sel.has(u.phone))
  const selectAll = () => setSel(allVisibleSelected ? new Set() : new Set(filtered.map(u => u.phone)))
  const pg = usePaged(filtered)

  const bulkAssign = async (patch: { role?: string } | { plan?: string }) => {
    if (!sel.size) return
    const phones = [...sel]
    setUsers(us => us.map(u => sel.has(u.phone) ? { ...u, ...patch } : u))
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phones, patch }) })
    load()
  }
  const bulkDel = async () => {
    if (!sel.size || !confirm(`${sel.size} کاربر حذف شود؟`)) return
    const phones = [...sel]
    setUsers(us => us.filter(u => !sel.has(u.phone))); setSel(new Set())
    await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phones }) })
  }

  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  const cellSel: React.CSSProperties = { background: 'transparent', border: '1px solid var(--line2)', borderRadius: 999, padding: '4px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', maxWidth: 150 }
  const th: React.CSSProperties = { textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--faint)', padding: '0 12px 11px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '11px 12px', fontSize: 13, color: 'var(--text)', borderTop: '1px solid var(--line)', verticalAlign: 'middle' }

  const total = users.length
  const onboardedCount = users.filter(u => u.onboarded).length
  const withRole = users.filter(u => u.role).length
  const withPlan = users.filter(u => u.plan).length

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <KPI label="کل کاربران" value={total.toLocaleString('fa-IR')} trend="حساب‌های ثبت‌شده" icon="◍" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" />
        <KPI label="تکمیل‌شده" value={onboardedCount.toLocaleString('fa-IR')} trend="پروفایل کامل" icon="✓" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" />
        <KPI label="نقش‌دار" value={withRole.toLocaleString('fa-IR')} trend="نقش تخصیص‌یافته" icon="🛡" iconBg="var(--goldDim)" iconColor="var(--gold)" />
        <KPI label="مشترکِ پلن" value={withPlan.toLocaleString('fa-IR')} trend="دارای اشتراکِ فعال" icon="👑" iconBg="rgba(169,155,240,.15)" iconColor="#a99bf0" />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="جستجو با شماره یا نام…" value={q} onChange={e => setQ(e.target.value)} />
          <select style={inp} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}><option value="">همه نقش‌ها</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <select style={inp} value={planFilter} onChange={e => setPlanFilter(e.target.value)}><option value="">همه پلن‌ها</option><option value="__none">بدون پلن</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <OutlineButton onClick={load}>بازخوانی</OutlineButton>
          <GoldButton onClick={() => setCreating(true)}>＋ کاربر جدید</GoldButton>
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{loading ? 'در حال بارگذاری…' : `${filtered.length.toLocaleString('fa-IR')} از ${total.toLocaleString('fa-IR')} کاربر`}</span>
          {sel.size > 0 && <>
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{sel.size.toLocaleString('fa-IR')} انتخاب‌شده:</span>
            <select style={{ ...inp, padding: '5px 10px', fontSize: 12 }} value="" onChange={e => { if (e.target.value !== '') bulkAssign({ role: e.target.value === '__none' ? '' : e.target.value }) }}><option value="">تخصیصِ نقش…</option><option value="__none">— بدون نقش</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            <select style={{ ...inp, padding: '5px 10px', fontSize: 12 }} value="" onChange={e => { if (e.target.value !== '') bulkAssign({ plan: e.target.value === '__none' ? '' : e.target.value }) }}><option value="">تخصیصِ پلن…</option><option value="__none">— بدون پلن</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <button onClick={bulkDel} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.4)', color: '#e7674a', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>حذف</button>
          </>}
        </div>
      </Card>

      <Card>
        {filtered.length === 0 && !loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>کاربری یافت نشد. فیلترها را تغییر دهید.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 30 }}><input type="checkbox" checked={allVisibleSelected} onChange={selectAll} style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }} /></th>
                  <th style={th}>مخاطب</th>
                  <th style={th}>نقش</th>
                  <th style={th}>پلن</th>
                  <th style={{ ...th, textAlign: 'center' }}>احراز هویت</th>
                  <th style={{ ...th, textAlign: 'center' }}>تکمیلِ پروفایل</th>
                  <th style={{ ...th, textAlign: 'center' }}>فعالیت (آگهی/لید/وظیفه)</th>
                  <th style={{ ...th, textAlign: 'center' }}>مصرفِ توکن</th>
                  <th style={th}>اعتبار (پ/ا/ت)</th>
                  <th style={th}>آخرین ورود</th>
                  <th style={{ ...th, textAlign: 'center' }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {pg.paged.map(u => {
                  const m = RMETA[u.dashboard || ''] || RMETA['']
                  return (
                    <tr key={u.phone} style={{ background: sel.has(u.phone) ? 'var(--goldDim)' : 'transparent', transition: 'background .15s' }}>
                      <td style={td}><input type="checkbox" checked={sel.has(u.phone)} onChange={() => toggleSel(u.phone)} style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }} /></td>
                      <td style={td}>
                        <div onClick={() => setViewUser(u)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                          <UAvatar name={u.name} phone={u.phone} dash={u.dashboard} size={38} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 5 }}>{u.name || 'بدون نام'}{u.identityVerifiedAt ? <span title="احراز هویت‌شده با شاهکار" style={{ color: '#5fd98a', fontSize: 11 }}>✓</span> : <span title="احراز هویت نشده" style={{ color: 'var(--faint)', fontSize: 10 }}>⏳</span>}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--gold)', direction: 'ltr', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace' }}>{u.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td style={td}><select style={{ ...cellSel, color: m.c, borderColor: m.c + '66' }} value={u.role || ''} onChange={e => patchOne(u.phone, { role: e.target.value })}><option value="">— بدون نقش</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                      <td style={td}><select style={{ ...cellSel, color: u.plan ? '#a99bf0' : 'var(--muted)' }} value={u.plan || ''} onChange={e => patchOne(u.phone, { plan: e.target.value })}><option value="">بدون پلن</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                      <td style={{ ...td, textAlign: 'center' }}>{u.identityVerifiedAt
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#5fd98a', background: 'rgba(95,217,138,.12)', border: '1px solid rgba(95,217,138,.4)', borderRadius: 999, padding: '3px 10px' }}>✓ احراز شده</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#e7894a', background: 'rgba(231,137,74,.12)', border: '1px solid rgba(231,137,74,.4)', borderRadius: 999, padding: '3px 10px' }}>⏳ احراز نشده</span>}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{(() => { const pc = Math.round(u.profileCompletion || 0); const col = u.suspended ? '#e7674a' : pc >= 70 ? '#5fd98a' : pc >= 40 ? 'var(--gold)' : '#e7894a'; return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 92 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--bg2)', overflow: 'hidden' }}><div style={{ width: `${pc}%`, height: '100%', background: col, borderRadius: 999, transition: 'width .3s' }} /></div>
                            <span style={{ fontSize: 11.5, fontWeight: 800, color: col, minWidth: 30 }}>{pc.toLocaleString('fa-IR')}٪</span>
                          </div>
                          {u.suspended && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e7674a', background: 'rgba(231,103,74,.12)', border: '1px solid rgba(231,103,74,.4)', borderRadius: 999, padding: '1px 8px' }}>⛔ معلق</span>}
                        </div>
                      ) })()}</td>
                      <td style={{ ...td, textAlign: 'center', fontSize: 12.5, fontWeight: 700 }}><span style={{ color: u.listings ? 'var(--gold)' : 'var(--faint)' }}>{(u.listings || 0).toLocaleString('fa-IR')}</span><span style={{ color: 'var(--faint)' }}> / </span><span style={{ color: u.leads ? '#5fd98a' : 'var(--faint)' }}>{(u.leads || 0).toLocaleString('fa-IR')}</span><span style={{ color: 'var(--faint)' }}> / </span><span style={{ color: u.tasks ? '#5b9bd5' : 'var(--faint)' }}>{(u.tasks || 0).toLocaleString('fa-IR')}</span></td>
                      <td style={{ ...td, textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: u.tokenUsed ? '#a99bf0' : 'var(--faint)' }}>{(u.tokenUsed || 0).toLocaleString('fa-IR')}</td>
                      <td style={{ ...td, fontSize: 11.5, color: 'var(--muted)', direction: 'ltr', textAlign: 'right' }}>{(u.credit?.sms || 0).toLocaleString('fa-IR')}/{(u.credit?.email || 0).toLocaleString('fa-IR')}/{(u.credit?.token || 0).toLocaleString('fa-IR')}</td>
                      <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{timeAgo(u.lastLogin || null)}</td>
                      <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button title="مشاهدهٔ کامل" onClick={() => setViewUser(u)} style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 8, padding: '4px 11px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, marginInlineEnd: 6 }}>مشاهده</button>
                        <button title="حذف" onClick={() => delOne(u.phone)} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager {...pg} />
        <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.8 }}>
          روی «مشاهده» یا آواتارِ هر کاربر بزن تا پروفایلِ کاملش (فعالیت، اعتبار، مصرفِ توکن) باز شود. نقش و پلن را مستقیم از جدول یا کشوی جزئیات تغییر بده.
        </div>
      </Card>

      {viewUser && <UserDrawer user={viewUser} roles={roles} plans={plans} onClose={() => setViewUser(null)} onPatch={patchOne} onDelete={delOne} onSuspend={suspendOne} onAccountUpdate={(acc) => { setViewUser((v: any) => ({ ...v, ...acc })); setUsers(us => us.map(u => u.phone === acc.phone ? { ...u, ...acc } : u)) }} />}
      {creating && <CreateUserPopup roles={roles} plans={plans} onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  )
}

/* ─── همه پروفایل‌ها (مشاهدهٔ کاملِ سوپرادمین) ─────────────────── */
interface ProfileRow {
  phone: string; name: string; role: string; roleLabel: string; plan: string; planLabel: string
  dashboard: string; onboarded: boolean; createdAt: number; lastLogin: number | null
  activity: { tasks: number; leads: number; workflows: number; favorites: number }
}
interface ProfileDetail {
  account: { phone: string; name: string; roleLabel: string; planLabel: string; onboarded: boolean; createdAt: number; lastLogin: number | null; dashboard: string }
  kpis: { label: string; value: number; money?: boolean }[]
  sections: { title: string; items: { primary: string; secondary?: string }[] }[]
  activity: { tasks: number; leads: number; workflows: number; favorites: number }
}

function pfMoney(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} میلیارد`
  if (n >= 1e6) return `${Math.round(n / 1e6).toLocaleString('fa-IR')} میلیون`
  return n.toLocaleString('fa-IR')
}

function ProfilesView() {
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [roles, setRoles] = useState<IdName[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [detail, setDetail] = useState<ProfileDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/admin/profiles')
    if (r.ok) { const d = await r.json(); setRows(d.profiles || []); setRoles(d.roles || []) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const open = async (phone: string) => {
    setDetailLoading(true); setDetail(null)
    const r = await fetch(`/api/admin/profiles?phone=${encodeURIComponent(phone)}`)
    if (r.ok) setDetail(await r.json())
    setDetailLoading(false)
  }

  // «ورود به پنل کاربر» (impersonation): از این پس همهٔ داشبوردها دادهٔ این کاربر را نشان می‌دهند.
  const [entering, setEntering] = useState(false)
  const enterPanel = async (phone: string, dashboard: string) => {
    setEntering(true)
    const r = await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok && d.ok) { window.location.href = d.dashboard || dashboard || '/' }
    else { alert(d.error || 'ورود به پنل ناموفق بود'); setEntering(false) }
  }

  const filtered = rows.filter(u => {
    if (q.trim()) { const t = q.trim(); if (!(u.phone.includes(t) || (u.name || '').includes(t))) return false }
    if (roleFilter && u.role !== roleFilter) return false
    return true
  })

  const pg = usePaged(filtered)
  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  const total = rows.length
  const withPlan = rows.filter(u => u.plan).length
  const active30 = rows.filter(u => u.lastLogin && Date.now() - u.lastLogin < 30 * 86400000).length

  const initial = (u: { name: string; phone: string }) => (u.name?.trim()?.[0]) || u.phone.slice(-2, -1) || '◍'
  const avatarBg = (s: string) => {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
    return `linear-gradient(135deg, hsl(${h} 45% 42%), hsl(${(h + 40) % 360} 45% 30%))`
  }

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <KPI label="کل پروفایل‌ها" value={total.toLocaleString('fa-IR')} trend="همهٔ حساب‌ها" icon="👁" iconBg="var(--goldDim)" iconColor="var(--gold)" />
        <KPI label="دارای پلن" value={withPlan.toLocaleString('fa-IR')} trend="اشتراک فعال" icon="◔" iconBg="rgba(138,123,216,.15)" iconColor="#a99bf0" />
        <KPI label="فعال (۳۰ روز)" value={active30.toLocaleString('fa-IR')} trend="ورود اخیر" icon="✓" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" />
        <KPI label="نقش‌دار" value={rows.filter(u => u.role).length.toLocaleString('fa-IR')} trend="نقش تخصیص‌یافته" icon="🛡" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="جستجو با شماره یا نام…" value={q} onChange={e => setQ(e.target.value)} />
          <select style={inp} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">همه نقش‌ها</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <OutlineButton onClick={load}>بازخوانی</OutlineButton>
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
          {loading ? 'در حال بارگذاری…' : `${filtered.length.toLocaleString('fa-IR')} از ${total.toLocaleString('fa-IR')} پروفایل — روی هر کارت بزنید تا دادهٔ کاملش را ببینید.`}
        </div>
      </Card>

      {filtered.length === 0 && !loading ? (
        <Card><div style={{ color: 'var(--muted)', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>پروفایلی یافت نشد.</div></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {pg.paged.map(u => (
            <button key={u.phone} onClick={() => open(u.phone)} style={{
              textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
              padding: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 12,
              transition: 'border-color .15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: avatarBg(u.phone), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{initial(u)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || 'بدون نام'}</div>
                  <div style={{ fontSize: 12, color: 'var(--gold)', direction: 'ltr', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace' }}>{u.phone}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <Badge label={u.roleLabel} color="#5b9bd5" />
                <Badge label={u.planLabel} color={u.plan ? '#a99bf0' : 'var(--faint)'} />
                {u.onboarded ? <Badge label="تکمیل‌شده" color="#5fd98a" /> : <Badge label="جدید" color="#e7a44a" />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 11.5, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <span>وظایف <b style={{ color: 'var(--text)' }}>{u.activity.tasks.toLocaleString('fa-IR')}</b></span>
                <span>لیدها <b style={{ color: 'var(--text)' }}>{u.activity.leads.toLocaleString('fa-IR')}</b></span>
                <span>اتوماسیون <b style={{ color: 'var(--text)' }}>{u.activity.workflows.toLocaleString('fa-IR')}</b></span>
                <span>علاقه <b style={{ color: 'var(--text)' }}>{u.activity.favorites.toLocaleString('fa-IR')}</b></span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--faint)' }}>آخرین ورود: {timeAgo(u.lastLogin)}</div>
            </button>
          ))}
        </div>
      )}
      <Pager {...pg} />

      {(detail || detailLoading) && (
        <div onClick={() => { setDetail(null); setDetailLoading(false) }} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200,
          display: 'flex', justifyContent: 'flex-start', animation: 'fade .2s ease',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 'min(540px, 94vw)', height: '100%', background: 'var(--bg)', borderLeft: '1px solid var(--line2)',
            overflowY: 'auto', padding: '22px 22px 60px', boxShadow: '-10px 0 40px rgba(0,0,0,.4)',
          }}>
            {detailLoading || !detail ? (
              <div style={{ color: 'var(--muted)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>در حال بارگذاری…</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 13, background: avatarBg(detail.account.phone), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, fontWeight: 800, color: '#fff' }}>{initial(detail.account)}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{detail.account.name || 'بدون نام'}</div>
                      <div style={{ fontSize: 13, color: 'var(--gold)', direction: 'ltr', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace' }}>{detail.account.phone}</div>
                    </div>
                  </div>
                  <button onClick={() => setDetail(null)} style={{ background: 'transparent', border: '1px solid var(--line2)', color: 'var(--muted)', borderRadius: 9, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
                  <Badge label={detail.account.roleLabel} color="#5b9bd5" />
                  <Badge label={detail.account.planLabel} color={detail.account.planLabel === 'بدون پلن' ? 'var(--faint)' : '#a99bf0'} />
                  {detail.account.onboarded ? <Badge label="تکمیل‌شده" color="#5fd98a" /> : <Badge label="جدید" color="#e7a44a" />}
                  <Badge label={`داشبورد: ${detail.account.dashboard}`} color="var(--gold)" />
                </div>

                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 18, marginBottom: 16 }}>
                  <span>عضویت: {new Date(detail.account.createdAt).toLocaleDateString('fa-IR')}</span>
                  <span>آخرین ورود: {timeAgo(detail.account.lastLogin)}</span>
                </div>

                <button onClick={() => enterPanel(detail.account.phone, detail.account.dashboard)} disabled={entering} style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, fontWeight: 800, fontSize: 14.5,
                  cursor: entering ? 'default' : 'pointer', border: 'none', marginBottom: 22,
                  background: 'linear-gradient(135deg, var(--gold2), var(--gold))', color: '#1a1200',
                  boxShadow: '0 6px 20px -8px var(--gold)', opacity: entering ? .6 : 1,
                }}>
                  {entering ? 'در حال ورود…' : `👁 ورود به پنل این کاربر (${detail.account.dashboard})`}
                </button>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: -14, marginBottom: 20, lineHeight: 1.7 }}>
                  با این گزینه دقیقاً همان چیزی را می‌بینید که این کاربر در پنل خود می‌بیند (برای دیباگ). یک نوار «خروج» پایین صفحه ظاهر می‌شود تا به ادمین برگردید.
                </div>

                {detail.kpis.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--faint)', marginBottom: 10 }}>آمارِ نقشِ «{detail.account.roleLabel}»</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 22 }}>
                      {detail.kpis.map((k, i) => (
                        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 11, padding: '12px 14px' }}>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>{k.label}</div>
                          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--gold)' }}>{k.money ? pfMoney(k.value) : k.value.toLocaleString('fa-IR')}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--faint)', marginBottom: 10 }}>فعالیتِ ابزارها</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 22 }}>
                  {[['وظایف CRM', detail.activity.tasks], ['لیدها', detail.activity.leads], ['اتوماسیون', detail.activity.workflows], ['علاقه‌مندی', detail.activity.favorites]].map(([l, v], i) => (
                    <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{(v as number).toLocaleString('fa-IR')}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {detail.sections.map((sec, si) => (
                  <div key={si} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--faint)', marginBottom: 10 }}>{sec.title}</div>
                    {sec.items.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>موردی نیست.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {sec.items.map((it, ii) => (
                          <div key={ii} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{it.primary}</span>
                            {it.secondary && <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{it.secondary}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── نقش‌ها و دسترسی ─────────────────────────────────────────── */
interface Role { id: string; name: string; dashboard: string; planId?: string; permissions: string[]; builtin?: boolean; active: boolean; createdAt: number }
interface PermDef { id: string; label: string }

const DASHBOARD_OPTIONS: { value: string; label: string }[] = [
  { value: '/buyer', label: 'کاربر عادی' },
  { value: '/owner', label: 'مالک' },
  { value: '/pros', label: 'مشاور' },
  { value: '/agency', label: 'آژانس' },
  { value: '/builder', label: 'سازنده' },
  { value: '/materials', label: 'مصالح' },
  { value: '/legal', label: 'حقوقی' },
  { value: '/crm', label: 'CRM' },
  { value: '/marketing', label: 'مارکتینگ' },
]
const dashLabel = (v: string) => DASHBOARD_OPTIONS.find(d => d.value === v)?.label || v

function RolesView() {
  const [roles, setRoles] = useState<Role[]>([])
  const [perms, setPerms] = useState<PermDef[]>([])
  const [plans, setPlans] = useState<IdName[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<{ name: string; dashboard: string; planId: string; permissions: string[] }>({ name: '', dashboard: '/buyer', planId: '', permissions: [] })

  // «مشاهدهٔ پنلِ نقش» (پیش‌نمایش با دادهٔ نمونه) — برای دیباگ بدون نیاز به کاربرِ واقعی.
  const [previewing, setPreviewing] = useState<string | null>(null)
  const previewRole = async (roleId: string) => {
    setPreviewing(roleId)
    const r = await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: roleId }) })
    const d = await r.json().catch(() => ({}))
    if (r.ok && d.ok) { window.location.href = d.dashboard || '/' }
    else { alert(d.error || 'ورود به پنل ناموفق بود'); setPreviewing(null) }
  }

  const load = async () => {
    setLoading(true)
    const [rr, pr] = await Promise.all([
      fetch('/api/admin/roles').then(r => r.ok ? r.json() : null),
      fetch('/api/admin/plans').then(r => r.ok ? r.json() : null),
    ])
    if (rr) { setRoles(rr.roles || []); setPerms(rr.permissions || []) }
    if (pr) setPlans((pr.plans || []).map((p: any) => ({ id: p.id, name: p.name })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const planName = (id?: string) => id ? (plans.find(p => p.id === id)?.name || id) : 'رایگان / پیش‌فرض'

  const togglePermInForm = (pid: string) => setForm(f => ({ ...f, permissions: f.permissions.includes(pid) ? f.permissions.filter(x => x !== pid) : [...f.permissions, pid] }))

  const create = async () => {
    if (!form.name.trim()) return
    const r = await fetch('/api/admin/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name.trim(), dashboard: form.dashboard, planId: form.planId || undefined, permissions: form.permissions }) })
    if (r.ok) { setForm({ name: '', dashboard: '/buyer', planId: '', permissions: [] }); setShowNew(false); load() }
    else { const d = await r.json().catch(() => ({})); alert(d.error || 'خطا در ساخت نقش') }
  }
  const patch = async (id: string, p: any) => {
    const r = await fetch('/api/admin/roles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, patch: p }) })
    if (r.ok) { const d = await r.json(); setRoles(rs => rs.map(x => x.id === id ? d.role : x)) }
  }
  const del = async (role: Role) => {
    if (role.builtin) { alert('نقش پایه قابل حذف نیست'); return }
    if (!confirm(`نقش «${role.name}» حذف شود؟`)) return
    const r = await fetch(`/api/admin/roles?id=${role.id}`, { method: 'DELETE' })
    if (r.ok) setRoles(rs => rs.filter(x => x.id !== role.id))
    else { const d = await r.json().catch(() => ({})); alert(d.error || 'خطا در حذف') }
  }

  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }

  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>نقش‌ها و دسترسی</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.9, maxWidth: 720 }}>
              هر نقش یک <b>داشبورد پیش‌فرض</b> دارد (مسیری که کاربر بعد از ورود می‌بیند). اگر به یک نقش <b>پلن</b> بدهید، یعنی آن نقش/دسترسی با خرید آن پلن باز (آنلاک) می‌شود؛ نقش بدون پلن، رایگان/پیش‌فرض است. سوپرادمین می‌تواند نقش و پلن را به‌صورت دستی هم در بخش «کاربران» به هر کاربر بدهد.
            </div>
          </div>
          <GoldButton onClick={() => setShowNew(s => !s)}>{showNew ? 'بستن' : '＋ نقش جدید'}</GoldButton>
        </div>

        {showNew && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={lab}>نام نقش *</label><input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثلاً مشاور ویژه" /></div>
              <div><label style={lab}>داشبورد (مسیر)</label>
                <select style={inp} value={form.dashboard} onChange={e => setForm({ ...form, dashboard: e.target.value })}>
                  {DASHBOARD_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label} ({d.value})</option>)}
                </select>
              </div>
              <div><label style={lab}>پلن آنلاک‌کننده</label>
                <select style={inp} value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}>
                  <option value="">رایگان (بدون پلن)</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <label style={lab}>دسترسی‌ها</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginBottom: 14 }}>
              {perms.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', fontSize: 12.5 }}>
                  <input type="checkbox" checked={form.permissions.includes(p.id)} onChange={() => togglePermInForm(p.id)} style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }} />
                  {p.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <GoldButton onClick={create} disabled={!form.name.trim()}>ساخت نقش</GoldButton>
              <OutlineButton onClick={() => setShowNew(false)}>انصراف</OutlineButton>
            </div>
          </div>
        )}
      </Card>

      <Card>
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>در حال بارگذاری…</div>
        ) : roles.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>نقشی تعریف نشده است.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {roles.map(role => (
              <div key={role.id} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '14px 16px', border: editing === role.id ? '1px solid var(--gold)' : '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{role.name}</span>
                      {role.builtin && <Badge label="پایه" color="var(--gold)" />}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>مسیر: <b style={{ color: 'var(--text)' }}>{dashLabel(role.dashboard)}</b> <span style={{ direction: 'ltr', display: 'inline-block', color: 'var(--faint)' }}>({role.dashboard})</span></span>
                      <span>پلن: <b style={{ color: role.planId ? 'var(--gold)' : 'var(--text)' }}>{planName(role.planId)}</b></span>
                    </div>
                    {role.permissions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {role.permissions.map(pid => (
                          <span key={pid} style={{ fontSize: 11, background: 'var(--goldDim)', color: 'var(--gold)', borderRadius: 7, padding: '3px 9px' }}>{perms.find(p => p.id === pid)?.label || pid}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{role.active ? 'فعال' : 'غیرفعال'}</span>
                      <Toggle on={role.active} onChange={v => patch(role.id, { active: v })} />
                    </div>
                    <button title="ورود به پنل این نقش با دادهٔ نمونه (دیباگ)" onClick={() => previewRole(role.id)} disabled={previewing === role.id} style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 8, padding: '5px 12px', cursor: previewing === role.id ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', opacity: previewing === role.id ? .6 : 1 }}>{previewing === role.id ? 'در حال ورود…' : '👁 مشاهدهٔ پنل'}</button>
                    <OutlineButton onClick={() => setEditing(editing === role.id ? null : role.id)} style={{ fontSize: 11.5, padding: '5px 12px' }}>{editing === role.id ? 'بستن' : 'ویرایش'}</OutlineButton>
                    <button title={role.builtin ? 'نقش پایه قابل حذف نیست' : 'حذف'} onClick={() => del(role)} disabled={role.builtin} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: role.builtin ? 'var(--faint)' : '#e7674a', borderRadius: 8, padding: '5px 9px', cursor: role.builtin ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: role.builtin ? .5 : 1 }}>{role.builtin ? '🔒' : '×'}</button>
                  </div>
                </div>

                {editing === role.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div><label style={lab}>نام نقش</label><input style={inp} defaultValue={role.name} onBlur={e => { const v = e.target.value.trim(); if (v && v !== role.name) patch(role.id, { name: v }) }} /></div>
                      <div><label style={lab}>داشبورد (مسیر)</label>
                        <select style={inp} value={role.dashboard} onChange={e => patch(role.id, { dashboard: e.target.value })}>
                          {DASHBOARD_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label} ({d.value})</option>)}
                        </select>
                      </div>
                      <div><label style={lab}>پلن آنلاک‌کننده</label>
                        <select style={inp} value={role.planId || ''} onChange={e => patch(role.id, { planId: e.target.value || undefined })}>
                          <option value="">رایگان (بدون پلن)</option>
                          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <label style={lab}>دسترسی‌ها</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                      {perms.map(p => {
                        const on = role.permissions.includes(p.id)
                        return (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', fontSize: 12.5 }}>
                            <input type="checkbox" checked={on} onChange={() => patch(role.id, { permissions: on ? role.permissions.filter(x => x !== p.id) : [...role.permissions, p.id] })} style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }} />
                            {p.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// فرمِ ساخت/ویرایشِ پلن — کامل و آسان (نه prompt). انتخابِ نقش ⇒ ماژول‌های همان نقش می‌آیند.
function PlanForm({ initial, roles, perms, onSave, onClose }: { initial: any; roles: any[]; perms: { id: string; label: string }[]; onSave: (payload: any) => void; onClose: () => void }) {
  const [f, setF] = useState<any>(() => ({ name: '', priceMonthly: '', price3m: '', price6m: '', priceYearly: '', roleId: '', dashboard: '', badge: '', cta: '', highlighted: false, active: true, permissions: [], quotas: {}, aiCredits: '', extra: '', ...initial }))
  const QKEYS: [string, string][] = [['listings', 'آگهی'], ['files', 'فایل'], ['properties', 'ملک'], ['projects', 'پروژه'], ['units', 'واحد'], ['investors', 'سرمایه‌گذار'], ['leads', 'لید'], ['crmCustomers', 'مشتری CRM'], ['contacts', 'مخاطب'], ['agents', 'مشاور'], ['products', 'محصول'], ['aiRequests', 'درخواست AI'], ['contentGen', 'تولید محتوا'], ['aiImages', 'تصویر AI'], ['savedSearches', 'جستجوی ذخیره'], ['chats', 'چت'], ['divarImports', 'ایمپورت دیوار'], ['sites', 'سایت'], ['sitePages', 'صفحهٔ سایت'], ['sms', 'پیامک'], ['email', 'ایمیل'], ['campaigns', 'کمپین'], ['automations', 'اتوماسیون'], ['contactReveals', 'تماس آشکار']]
  const DASHES: [string, string][] = [['', '— بدون داشبورد —'], ['/buyer', 'کاربر عادی'], ['/owner', 'مالک'], ['/pros', 'مشاور'], ['/agency', 'آژانس'], ['/builder', 'سازنده'], ['/materials', 'مصالح'], ['/legal', 'حقوقی']]
  const setQ = (k: string, v: string) => setF((s: any) => ({ ...s, quotas: { ...s.quotas, [k]: v } }))
  const [sellPerToken, setSellPerToken] = useState(0)
  useEffect(() => { fetch('/api/admin/ai-cost').then(r => r.ok ? r.json() : null).then(d => { if (d?.tokenSellPrice) setSellPerToken(d.tokenSellPrice) }).catch(() => {}) }, [])
  const aiValue = (Number(f.aiCredits) || 0) * sellPerToken   // ارزشِ تومانیِ اعتبارِ AIِ این پلن
  const suggest = () => { const m = Math.max(1000, Math.round(aiValue / 1000) * 1000); if (!m) return; setF((s: any) => ({ ...s, priceMonthly: String(m), price3m: String(m * 3), price6m: String(m * 6), priceYearly: String(m * 10) })) }
  const role = roles.find(r => r.id === f.roleId)
  const availPerms = f.roleId ? perms.filter(p => (role?.permissions || []).includes(p.id)) : perms
  const permLabel = (id: string) => perms.find(p => p.id === id)?.label || id
  const togglePerm = (id: string) => setF((s: any) => ({ ...s, permissions: s.permissions.includes(id) ? s.permissions.filter((x: string) => x !== id) : [...s.permissions, id] }))
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  const save = () => {
    if (!f.name.trim()) return
    const moduleLabels = f.permissions.map(permLabel)
    const extraLines = String(f.extra || '').split('\n').map((x: string) => x.trim()).filter(Boolean)
    onSave({ name: f.name.trim(), priceMonthly: Number(f.priceMonthly) || 0, price3m: Number(f.price3m) || 0, price6m: Number(f.price6m) || 0, priceYearly: Number(f.priceYearly) || 0, roleId: f.roleId || '', dashboard: f.dashboard || '', badge: f.badge || '', cta: f.cta || '', highlighted: !!f.highlighted, active: f.active !== false, permissions: f.permissions, quotas: f.quotas || {}, aiCredits: Number(f.aiCredits) || 0, features: [...moduleLabels, ...extraLines] })
  }
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--gold)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }} className="mjsa-2col">
        <div><label style={lab}>نام پلن *</label><input style={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="مثلاً پرو" /></div>
        <div><label style={lab}>عنوان دکمه</label><input style={inp} value={f.cta} onChange={e => setF({ ...f, cta: e.target.value })} placeholder="تهیهٔ اشتراک" /></div>
        <div><label style={lab}>قیمت ماهانه (تومان)</label><input style={inp} type="number" value={f.priceMonthly} onChange={e => setF({ ...f, priceMonthly: e.target.value })} /></div>
        <div><label style={lab}>قیمت ۳ماهه (تومان)</label><input style={inp} type="number" value={f.price3m} onChange={e => setF({ ...f, price3m: e.target.value })} /></div>
        <div><label style={lab}>قیمت ۶ماهه (تومان)</label><input style={inp} type="number" value={f.price6m} onChange={e => setF({ ...f, price6m: e.target.value })} /></div>
        <div><label style={lab}>قیمت سالانه (تومان)</label><input style={inp} type="number" value={f.priceYearly} onChange={e => setF({ ...f, priceYearly: e.target.value })} /></div>
        <div><label style={lab}>برای نقش</label>
          <select style={inp} value={f.roleId} onChange={e => setF({ ...f, roleId: e.target.value, permissions: [] })}>
            <option value="">عمومی (برای همه)</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div><label style={lab}>برچسب (اختیاری)</label><input style={inp} value={f.badge} onChange={e => setF({ ...f, badge: e.target.value })} placeholder="مثلاً محبوب" /></div>
        <div><label style={lab}>داشبوردِ هدف</label>
          <select style={inp} value={f.dashboard} onChange={e => setF({ ...f, dashboard: e.target.value })}>
            {DASHES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div><label style={lab}>اعتبارِ AIِ ماهانه (توکن)</label><input style={inp} type="number" value={f.aiCredits} onChange={e => setF({ ...f, aiCredits: e.target.value })} placeholder="مثلاً ۲۰۰۰۰" /></div>
      </div>
      {sellPerToken > 0 && Number(f.aiCredits) > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', marginBottom: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>ارزشِ اعتبارِ AIِ این پلن ≈ <b style={{ color: 'var(--gold)' }}>{Math.round(aiValue).toLocaleString('fa-IR')} تومان</b> (هزینهٔ توکن). قیمتِ ماهانه را بالاتر بگذار تا سود بماند.</span>
          <OutlineButton onClick={suggest} style={{ fontSize: 11.5, padding: '5px 12px' }}>قیمتِ پیشنهادی از اعتبار</OutlineButton>
        </div>
      )}
      <label style={lab}>سقفِ مصرف (Quotas) — خالی = بدونِ محدودیت، <b>−۱ = نامحدود</b></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, marginBottom: 12 }}>
        {QKEYS.map(([k, l]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>{l}</span>
            <input style={{ ...inp, width: 62, padding: '6px 7px', textAlign: 'center' }} type="number" value={f.quotas?.[k] ?? ''} onChange={e => setQ(k, e.target.value)} placeholder="—" />
          </div>
        ))}
      </div>
      <label style={lab}>ماژول‌ها و امکاناتِ این پلن {f.roleId ? '(از ماژول‌های همین نقش)' : '(همهٔ ماژول‌ها)'}</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 8, marginBottom: 12 }}>
        {availPerms.length === 0 ? <div style={{ fontSize: 12, color: 'var(--faint)' }}>این نقش ماژولی ندارد.</div> : availPerms.map(p => {
          const on = f.permissions.includes(p.id)
          return <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: on ? 'var(--goldDim)' : 'var(--surface)', border: `1px solid ${on ? 'var(--gold)' : 'var(--line2)'}`, borderRadius: 9, padding: '8px 10px', cursor: 'pointer', fontSize: 12.5, color: on ? 'var(--gold)' : 'var(--text)' }}><input type="checkbox" checked={on} onChange={() => togglePerm(p.id)} style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }} />{p.label}</label>
        })}
      </div>
      <label style={lab}>ویژگی‌های متنیِ اضافه (هر خط یک مورد — کنارِ ماژول‌ها در متنِ پلن نمایش داده می‌شود)</label>
      <textarea style={{ ...inp, height: 70, resize: 'vertical', marginBottom: 12 }} value={f.extra} onChange={e => setF({ ...f, extra: e.target.value })} placeholder={'پشتیبانی تلفنی اولویت‌دار\nآگهی ویژه در نتایج'} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={f.highlighted} onChange={e => setF({ ...f, highlighted: e.target.checked })} /> پلن ویژه (محبوب)</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> فعال</label>
        <span style={{ flex: 1 }} />
        <OutlineButton onClick={onClose} style={{ fontSize: 12.5, padding: '7px 14px' }}>انصراف</OutlineButton>
        <GoldButton onClick={save}>ذخیره</GoldButton>
      </div>
    </div>
  )
}

function PlansView() {
  const [plans, setPlans] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [perms, setPerms] = useState<{ id: string; label: string }[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState('')
  const load = () => fetch('/api/admin/plans').then(r => r.ok ? r.json() : { plans: [] }).then(d => setPlans(d.plans || []))
  useEffect(() => {
    load()
    fetch('/api/admin/roles').then(r => r.ok ? r.json() : null).then(d => { if (d?.roles) setRoles(d.roles); if (d?.permissions) setPerms(d.permissions) })
    fetch('/api/admin/users').then(r => r.ok ? r.json() : null).then(d => { if (d?.users) setAccounts(d.users) }).catch(() => {})
  }, [])
  const DASH_LABEL: Record<string, string> = { '/buyer': 'کاربر عادی', '/owner': 'مالک', '/pros': 'مشاور املاک', '/agency': 'آژانس املاک', '/builder': 'سازنده', '/materials': 'مصالح‌فروش', '/legal': 'حقوقی' }
  const groupLabel = (p: any) => (p.roleId && roles.find(r => r.id === p.roleId)?.name) || DASH_LABEL[p.dashboard || ''] || 'عمومی'
  const roleName = (rid?: string) => rid ? (roles.find(r => r.id === rid)?.name || '—') : 'عمومی (همه)'
  const subCount = (pid: string) => accounts.filter(a => a.plan === pid).length
  const create = async (payload: any) => { await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setCreating(false); load() }
  const patch = async (id: string, p: any) => { await fetch('/api/admin/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...p }) }); setEditingId(null); load() }
  const del = async (id: string) => { if (!confirm('این پلن حذف شود؟')) return; await fetch(`/api/admin/plans?id=${id}`, { method: 'DELETE' }); load() }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  const editInitial = (p: any) => {
    const moduleLabels = new Set((p.permissions || []).map((id: string) => perms.find(x => x.id === id)?.label || id))
    return { name: p.name, priceMonthly: String(p.priceMonthly || ''), price3m: String(p.price3m || ''), price6m: String(p.price6m || ''), priceYearly: String(p.priceYearly || ''), roleId: p.roleId || '', dashboard: p.dashboard || '', badge: p.badge || '', cta: p.cta || '', highlighted: !!p.highlighted, active: p.active !== false, permissions: p.permissions || [], quotas: p.quotas || {}, aiCredits: String(p.aiCredits || ''), extra: (p.features || []).filter((x: string) => !moduleLabels.has(x)).join('\n') }
  }
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14, background: 'linear-gradient(120deg, rgba(212,175,55,.1), transparent 60%), var(--surface)', borderColor: 'rgba(201,168,76,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>👑</span>
            <div><div style={{ fontWeight: 900, fontSize: 18 }}>پلن‌ها و اشتراک</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>پلن بساز و به نقش نسبت بده؛ با انتخابِ نقش، ماژول‌های همان نقش می‌آید تا انتخاب کنی. وقتی کاربری بخرد، پلن به حسابش وصل می‌شود و در «مشترکین» شمرده می‌شود.</div></div>
          </div>
          <GoldButton onClick={() => { setEditingId(null); setCreating(true) }}>＋ پلن جدید</GoldButton>
        </div>
      </Card>

      {/* فیلترِ نقش — برای مدیریتِ آسان */}
      {(() => {
        const order = ['کاربر عادی', 'مالک', 'مشاور املاک', 'آژانس املاک', 'سازنده', 'مصالح‌فروش', 'حقوقی', 'عمومی']
        const counts = new Map<string, number>()
        for (const p of plans) { const g = groupLabel(p); counts.set(g, (counts.get(g) || 0) + 1) }
        const present = order.filter(o => counts.has(o))
        return (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setRoleFilter('')} style={tabBtn(roleFilter === '')}>همه ({fa(plans.length)})</button>
            {present.map(g => <button key={g} onClick={() => setRoleFilter(g)} style={tabBtn(roleFilter === g)}>{g} ({fa(counts.get(g) || 0)})</button>)}
          </div>
        )
      })()}

      {(() => {
        const order = ['کاربر عادی', 'مالک', 'مشاور املاک', 'آژانس املاک', 'سازنده', 'مصالح‌فروش', 'حقوقی', 'عمومی']
        const groups = new Map<string, any[]>()
        for (const p of plans) { const g = groupLabel(p); if (roleFilter && g !== roleFilter) continue; if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(p) }
        const keys = [...groups.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
        return keys.map(gk => (
          <div key={gk} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', margin: '4px 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>👤 {gk} <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 400 }}>({(groups.get(gk)!.length).toLocaleString('fa-IR')} پلن)</span></div>
            <div className="mjsa-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {groups.get(gk)!.map(p => (
          <Card key={p.id} style={{ position: 'relative', borderColor: editingId === p.id ? 'var(--gold)' : (p.highlighted ? 'var(--gold)' : 'var(--line2)'), boxShadow: p.highlighted ? '0 10px 30px -14px rgba(212,175,55,.5)' : 'none', background: p.highlighted ? 'linear-gradient(160deg, rgba(212,175,55,.08), var(--surface) 60%)' : 'var(--surface)', opacity: p.active ? 1 : .55 }}>
            {(p.badge || p.highlighted) && <span style={{ position: 'absolute', top: 14, insetInlineStart: 14, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '3px 11px' }}>{p.badge || 'محبوب'}</span>}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 16.5, fontWeight: 900 }}>{p.name}</span>
              <div style={{ textAlign: 'left' }}><span style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)' }}>{fa(p.priceMonthly)}</span><span style={{ fontSize: 11, color: 'var(--faint)' }}> ت/ماه</span><div style={{ fontSize: 11, color: 'var(--faint)' }}>{fa(p.priceYearly)} ت/سال</div></div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, color: 'var(--gold)' }}>● {groupLabel(p)}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 10px' }}>{fa(subCount(p.id))} مشترک</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {(p.features || []).map((x: string) => <div key={x} style={{ fontSize: 12.5, color: 'var(--muted)' }}>✓ {x}</div>)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <GoldButton onClick={() => { setEditingId(p.id); setCreating(false) }} style={{ fontSize: 12, padding: '6px 14px' }}>ویرایش</GoldButton>
              <OutlineButton onClick={() => patch(p.id, { active: !p.active })} style={{ fontSize: 12, padding: '6px 12px' }}>{p.active ? 'غیرفعال' : 'فعال'}</OutlineButton>
              <button onClick={() => del(p.id)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 9, border: '1px solid rgba(231,103,74,.3)', color: '#e7674a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>حذف</button>
            </div>
          </Card>
              ))}
            </div>
          </div>
        ))
      })()}
      {plans.length === 0 && <Card><div style={{ color: 'var(--muted)', fontSize: 13 }}>پلنی نیست.</div></Card>}

      {/* مودالِ ساخت/ویرایش (به‌جای فرمِ درون‌خطی — سبک‌تر و بدونِ هنگ) */}
      {(creating || editingId) && (() => {
        const p = editingId ? plans.find(x => x.id === editingId) : null
        if (editingId && !p) return null
        return (
          <div onClick={() => { setCreating(false); setEditingId(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: 720, width: '100%', margin: '24px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--gold)', marginBottom: 8 }}>{editingId ? `ویرایشِ «${p!.name}»` : 'پلنِ جدید'}</div>
              <PlanForm key={editingId || 'new'} initial={editingId ? editInitial(p) : {}} roles={roles} perms={perms} onSave={pl => editingId ? patch(editingId, pl) : create(pl)} onClose={() => { setCreating(false); setEditingId(null) }} />
            </div>
          </div>
        )
      })()}

      <CommPackagesConfig />
    </div>
  )
}
function tabBtn(active: boolean): React.CSSProperties {
  return { padding: '7px 14px', borderRadius: 999, border: `1px solid ${active ? 'var(--gold)' : 'var(--line2)'}`, background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontSize: 12.5, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }
}

// ─── درگاه‌های پرداخت + حالتِ قیمت‌گذاری ─────────────────────────────────────
function PaymentView() {
  const [cfg, setCfg] = useState<any>({ pricingMode: 'startup', gateways: [] })
  const [saved, setSaved] = useState('')
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  const load = () => fetch('/api/admin/payment').then(r => r.ok ? r.json() : null).then(d => { if (d) setCfg({ pricingMode: d.pricingMode || 'startup', gateways: d.gateways || [] }) }).catch(() => {})
  useEffect(() => { load() }, [])
  const save = async () => { await fetch('/api/admin/payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) }); setSaved('ذخیره شد ✓'); setTimeout(() => setSaved(''), 2000); load() }
  const setGw = (i: number, patch: any) => setCfg((c: any) => ({ ...c, gateways: c.gateways.map((g: any, j: number) => j === i ? { ...g, ...patch } : g) }))
  const MODES: [string, string][] = [['startup', 'استارتاپ (رشدِ کاربر)'], ['growth', 'رشد'], ['scale', 'درآمد (Scale)'], ['enterprise', 'سازمانی']]
  const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14, background: 'linear-gradient(120deg, rgba(212,175,55,.1), transparent 60%), var(--surface)', borderColor: 'rgba(201,168,76,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>💳</span>
            <div><div style={{ fontWeight: 900, fontSize: 18 }}>درگاه‌های پرداخت</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>روش‌های پرداخت را روشن/خاموش کن. «کارت‌به‌کارت» اطلاعاتِ کارت/حساب/شبا را به کاربر نشان می‌دهد و پس از واریز، سفارش را تأیید می‌کنی.</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{saved && <span style={{ fontSize: 12, color: '#5fd98a' }}>{saved}</span>}<GoldButton onClick={save}>ذخیره</GoldButton></div>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>حالتِ قیمت‌گذاری</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>استراتژیِ کلی: استارتاپ = تمرکز بر رشد و رایگان؛ Scale = تمرکز بر درآمد. (اعمالِ کاملِ محدودیت‌ها در فازِ بعدی)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MODES.map(([v, l]) => <button key={v} onClick={() => setCfg({ ...cfg, pricingMode: v })} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${cfg.pricingMode === v ? 'var(--gold)' : 'var(--line2)'}`, background: cfg.pricingMode === v ? 'var(--goldDim)' : 'transparent', color: cfg.pricingMode === v ? 'var(--gold)' : 'var(--muted)', fontSize: 13, fontWeight: cfg.pricingMode === v ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(cfg.gateways || []).map((g: any, i: number) => (
          <Card key={g.id || i} style={{ borderColor: g.enabled ? 'var(--gold)' : 'var(--line2)', opacity: g.enabled ? 1 : .7 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: g.type === 'card2card' ? 14 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{g.type === 'card2card' ? '🏧' : g.type === 'zarinpal' ? '🔷' : g.type === 'wallet' ? '👛' : '💠'}</span>
                <input value={g.label} onChange={e => setGw(i, { label: e.target.value })} style={{ ...inp, width: 220, fontWeight: 700 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={g.enabled !== false} onChange={e => setGw(i, { enabled: e.target.checked })} /> {g.enabled !== false ? 'روشن' : 'خاموش'}</label>
            </div>
            {g.type === 'card2card' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="mjsa-2col">
                <div><label style={lab}>شمارهٔ کارت</label><input value={g.cardNumber || ''} onChange={e => setGw(i, { cardNumber: e.target.value })} dir="ltr" style={inp} placeholder="6037-XXXX-XXXX-XXXX" /></div>
                <div><label style={lab}>شمارهٔ شبا (IBAN)</label><input value={g.iban || ''} onChange={e => setGw(i, { iban: e.target.value })} dir="ltr" style={inp} placeholder="IR..." /></div>
                <div><label style={lab}>شمارهٔ حساب</label><input value={g.accountNumber || ''} onChange={e => setGw(i, { accountNumber: e.target.value })} dir="ltr" style={inp} /></div>
                <div><label style={lab}>نامِ صاحبِ حساب</label><input value={g.holderName || ''} onChange={e => setGw(i, { holderName: e.target.value })} style={inp} /></div>
                <div><label style={lab}>بانک</label><input value={g.bank || ''} onChange={e => setGw(i, { bank: e.target.value })} style={inp} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={lab}>توضیح به کاربر</label><input value={g.note || ''} onChange={e => setGw(i, { note: e.target.value })} style={inp} /></div>
              </div>
            )}
            {g.type === 'zarinpal' && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>کلیدِ درگاه در «اتصال‌ها و سرویس‌ها» تنظیم می‌شود. (اتصالِ کاملِ پرداختِ آنلاین در فازِ بعدی)</div>}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── هزینهٔ واقعیِ AI + نرخِ تبدیل → قیمتِ فروشِ توکن ─────────────────────────
function AiCostView() {
  const [c, setC] = useState<any>(null)
  const [saved, setSaved] = useState('')
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  const load = () => fetch('/api/admin/ai-cost').then(r => r.ok ? r.json() : null).then(d => { if (d) setC(d) }).catch(() => {})
  useEffect(() => { load() }, [])
  const save = async (applyTokenPricing = false) => { const r = await fetch('/api/admin/ai-cost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...c, applyTokenPricing }) }); const d = await r.json().catch(() => ({})); if (d?.ok) setC(d); setSaved(applyTokenPricing ? `✓ قیمتِ ${(d?.repriced || 0).toLocaleString('fa-IR')} بستهٔ توکن به‌روز شد` : 'ذخیره شد ✓'); setTimeout(() => setSaved(''), 3500) }
  const fa = (n: number) => Math.round(Number(n) || 0).toLocaleString('fa-IR')
  if (!c) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>در حال بارگذاری…</div>
  const setModel = (i: number, patch: any) => setC({ ...c, models: c.models.map((m: any, j: number) => j === i ? { ...m, ...patch } : m) })
  const setUnit = (k: string, v: string) => setC({ ...c, unitTokens: { ...c.unitTokens, [k]: Number(v) || 0 } })
  const ref = c.models.find((m: any) => m.id === c.referenceModelId) || c.models[0]
  const basisUsd = (m: any) => { const inU = Number(m.inUsd) || 0, outU = Number(m.outUsd) || 0; return c.costBasis === 'sum' ? inU + outU : c.costBasis === 'avg' ? (inU + outU) / 2 : (outU || inU) }
  // قیمتِ فروشِ هر توکن (تومان) = هزینهٔ مدلِ مرجع (طبقِ مبنا) ÷ 1e6 × نرخِ دلار × (۱ + سود٪)
  const sellPerToken = ref ? (basisUsd(ref) / 1e6) * c.usdToman * (1 + (Number(c.profitPercent) || 0) / 100) : 0
  const costTomanPerM = (m: any) => basisUsd(m) * c.usdToman   // هزینهٔ هر ۱M توکن طبقِ مبنای انتخابی (تومان)
  const UNIT_LABEL: Record<string, string> = { image: 'هر تصویرِ AI', render3d: 'هر رندرِ سه‌بعدی', divarImport: 'هر ایمپورتِ دیوار', contactReveal: 'هر تماسِ آشکارشده', sms: 'هر پیامک', email: 'هر ایمیل' }
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14, background: 'linear-gradient(120deg, rgba(212,175,55,.1), transparent 60%), var(--surface)', borderColor: 'rgba(201,168,76,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>🧮</span>
            <div><div style={{ fontWeight: 900, fontSize: 18 }}>هزینه و قیمت‌گذاریِ AI</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>هزینهٔ واقعیِ مدل‌ها (از تأمین‌کننده) + نرخِ دلار و درصدِ سود → قیمتِ فروشِ توکن خودکار حساب می‌شود.</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{saved && <span style={{ fontSize: 12, color: '#5fd98a' }}>{saved}</span>}<GoldButton onClick={() => save(false)}>ذخیره</GoldButton></div>
        </div>
      </Card>

      <div className="mjsa-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <Card>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>نرخِ تبدیل</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lab}>نرخِ دلار (تومان)</label><input style={inp} type="number" value={c.usdToman} onChange={e => setC({ ...c, usdToman: Number(e.target.value) || 0 })} /></div>
            <div><label style={lab}>درصدِ سود (٪)</label><input style={inp} type="number" value={c.profitPercent} onChange={e => setC({ ...c, profitPercent: Number(e.target.value) || 0 })} placeholder="مثلاً ۱۰۰" /></div>
            <div><label style={lab}>گِردکردنِ قیمت (تومان)</label><input style={inp} type="number" value={c.roundTo} onChange={e => setC({ ...c, roundTo: Number(e.target.value) || 1000 })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lab}>مبنای هزینه (ورودی + خروجی)</label>
              <select style={inp} value={c.costBasis} onChange={e => setC({ ...c, costBasis: e.target.value })}>
                <option value="sum">مجموعِ ورودی + خروجی (امن‌ترین)</option>
                <option value="avg">میانگینِ ورودی و خروجی (واقع‌بینانه)</option>
                <option value="output">فقط خروجی</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lab}>مدلِ مرجع (قیمتِ توکن از رویش حساب می‌شود)</label>
              <select style={inp} value={c.referenceModelId} onChange={e => setC({ ...c, referenceModelId: e.target.value })}>
                {c.models.filter((m: any) => m.type === 'text').map((m: any) => <option key={m.id} value={m.id}>{m.label} ({m.provider})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12, background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 2 }}>
            قیمتِ فروشِ هر توکن: <b style={{ color: 'var(--gold)' }}>{sellPerToken.toLocaleString('fa-IR', { maximumFractionDigits: 3 })} تومان</b><br />
            هزینهٔ خامِ هر ۱٬۰۰۰ توکنِ مدلِ مرجع (طبقِ مبنا): <b>{fa((costTomanPerM(ref) / 1000))} تومان</b><br />
            پیشنهادِ قیمتِ بستهٔ ۱۰۰٬۰۰۰ توکن: <b style={{ color: 'var(--gold)' }}>{fa(sellPerToken * 100000)} تومان</b>
          </div>
          <button onClick={() => save(true)} style={{ marginTop: 12, width: '100%', padding: '11px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>💾 ذخیره و اعمالِ خودکارِ قیمت روی بسته‌های توکن</button>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.7 }}>قیمتِ هر بستهٔ توکن = تعدادِ توکن × قیمتِ فروشِ هر توکن، گِردشده. (بسته‌ها در «پلن‌ها» قابلِ مشاهده‌اند.)</div>
          <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={c.autoSync !== false} onChange={e => setC({ ...c, autoSync: e.target.checked })} /> دریافتِ <b>هفتگیِ خودکار</b>ِ قیمتِ مدل‌ها از API (بدونِ کارِ دستی)</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={c.autoReprice !== false} onChange={e => setC({ ...c, autoReprice: e.target.checked })} /> پس از هر سینک، قیمتِ بسته‌های توکن هم خودکار به‌روز شود</label>
            <div style={{ fontSize: 11, color: 'var(--faint)' }}>{c.lastSyncAt ? `آخرین سینکِ خودکار: ${new Date(c.lastSyncAt).toLocaleDateString('fa-IR')}` : 'هنوز سینکِ خودکاری انجام نشده'}</div>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>مصرفِ توکنِ عملیاتِ غیرمتنی</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>هر عملیات چند توکن از اعتبارِ کاربر کم کند (در حالتِ Scale). هزینهٔ تومانیِ هرکدام کنارش نمایش داده می‌شود.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.keys(c.unitTokens).map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, flex: 1 }}>{UNIT_LABEL[k] || k}</span>
                <input style={{ ...inp, width: 90 }} type="number" value={c.unitTokens[k]} onChange={e => setUnit(k, e.target.value)} />
                <span style={{ fontSize: 11.5, color: 'var(--gold)', width: 90, textAlign: 'left' }}>{fa(c.unitTokens[k] * sellPerToken)} ت</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>هزینهٔ مدل‌ها ($ به‌ازای هر ۱میلیون توکن — تصویری: به‌ازای هر تصویر/۱M)</div>
          <OutlineButton onClick={async () => { setSaved('در حال دریافت از API…'); const r = await fetch('/api/admin/ai-cost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'syncModels' }) }); const d = await r.json().catch(() => ({})); if (d?.ok) { setC(d); setSaved(`✓ ${fa(d.updated || 0)} مدل به‌روز و ${fa(d.added || 0)} مدلِ جدید از API گرفته شد`) } else setSaved(d?.error || 'خطا در دریافت'); setTimeout(() => setSaved(''), 5000) }} style={{ fontSize: 12.5, padding: '7px 14px' }}>🔄 دریافتِ خودکارِ قیمت‌ها از API</OutlineButton>
        </div>
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 1fr', gap: 8, padding: '6px 8px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
            <div>مدل</div><div>تأمین‌کننده</div><div>ورودی $</div><div>خروجی $</div><div>هزینهٔ ۱M (تومان)</div>
          </div>
          {c.models.map((m: any, i: number) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 1fr', gap: 8, padding: '5px 8px', alignItems: 'center', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}{m.type === 'image' ? ' 🖼' : ''}</span>
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>{m.provider}</span>
              <input style={{ ...inp, padding: '5px 6px' }} type="number" step="0.01" value={m.inUsd} onChange={e => setModel(i, { inUsd: Number(e.target.value) || 0 })} />
              <input style={{ ...inp, padding: '5px 6px' }} type="number" step="0.01" value={m.outUsd} onChange={e => setModel(i, { outUsd: Number(e.target.value) || 0 })} />
              <span style={{ color: 'var(--gold)', fontSize: 11.5 }}>{fa(costTomanPerM(m))}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── تعرفهٔ واقعیِ پیامک + قیمتِ فروش ─────────────────────────────────────────
function SmsCostView() {
  const [c, setC] = useState<any>(null)
  const [saved, setSaved] = useState('')
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
  const load = () => fetch('/api/admin/sms-cost').then(r => r.ok ? r.json() : null).then(d => { if (d) setC(d) }).catch(() => {})
  useEffect(() => { load() }, [])
  const save = async (applySmsPricing = false) => { const r = await fetch('/api/admin/sms-cost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...c, applySmsPricing }) }); const d = await r.json().catch(() => ({})); if (d?.ok) setC(d); setSaved(applySmsPricing ? `✓ قیمتِ ${(d?.repriced || 0).toLocaleString('fa-IR')} بستهٔ پیامک به‌روز شد` : 'ذخیره شد ✓'); setTimeout(() => setSaved(''), 3500) }
  const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  if (!c) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>در حال بارگذاری…</div>
  const setT = (i: number, patch: any) => setC({ ...c, tariffs: c.tariffs.map((t: any, j: number) => j === i ? { ...t, ...patch } : t) })
  const refT = c.tariffs.find((t: any) => t.lineType === c.refLine) || c.tariffs[0]
  const costRial = refT ? (c.refOperator === 'other' ? (c.refLang === 'lat' ? refT.otherLat : refT.otherFa) : (c.refLang === 'lat' ? refT.mciLat : refT.mciFa)) : 0
  const sellPerSms = (costRial / 10) * (1 + (Number(c.profitPercent) || 0) / 100)
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14, background: 'linear-gradient(120deg, rgba(212,175,55,.1), transparent 60%), var(--surface)', borderColor: 'rgba(201,168,76,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>✉</span>
            <div><div style={{ fontWeight: 900, fontSize: 18 }}>تعرفه و قیمتِ پیامک</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>تعرفهٔ واقعیِ اپراتور (ریال) + درصدِ سود → قیمتِ فروشِ پیامک و بسته‌ها.</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{saved && <span style={{ fontSize: 12, color: '#5fd98a' }}>{saved}</span>}<GoldButton onClick={() => save(false)}>ذخیره</GoldButton></div>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>نرخِ تبدیل و مرجع</div>
        <div className="mjsa-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><label style={lab}>درصدِ سود (٪)</label><input style={inp} type="number" value={c.profitPercent} onChange={e => setC({ ...c, profitPercent: Number(e.target.value) || 0 })} /></div>
          <div><label style={lab}>گِردکردنِ قیمت (تومان)</label><input style={inp} type="number" value={c.roundTo} onChange={e => setC({ ...c, roundTo: Number(e.target.value) || 1000 })} /></div>
          <div><label style={lab}>خطِ مرجع</label><select style={{ ...inp, cursor: 'pointer' }} value={c.refLine} onChange={e => setC({ ...c, refLine: e.target.value })}>{c.tariffs.map((t: any) => <option key={t.lineType} value={t.lineType}>{t.lineType}</option>)}</select></div>
          <div><label style={lab}>اپراتورِ مرجع</label><select style={{ ...inp, cursor: 'pointer' }} value={c.refOperator} onChange={e => setC({ ...c, refOperator: e.target.value })}><option value="mci">همراه اول</option><option value="other">ایرانسل و سایر</option></select></div>
          <div><label style={lab}>زبانِ مرجع</label><select style={{ ...inp, cursor: 'pointer' }} value={c.refLang} onChange={e => setC({ ...c, refLang: e.target.value })}><option value="fa">فارسی</option><option value="lat">لاتین</option></select></div>
        </div>
        <div style={{ marginTop: 12, background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 2 }}>
          هزینهٔ خامِ هر پیامکِ مرجع: <b>{fa(costRial)} ریال ({fa(costRial / 10)} تومان)</b><br />
          قیمتِ فروشِ هر پیامک: <b style={{ color: 'var(--gold)' }}>{Math.round(sellPerSms).toLocaleString('fa-IR')} تومان</b> · پیشنهادِ بستهٔ ۱۰۰۰ پیامک: <b style={{ color: 'var(--gold)' }}>{fa(sellPerSms * 1000)} تومان</b>
        </div>
        <button onClick={() => save(true)} style={{ marginTop: 12, width: '100%', padding: '11px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>💾 ذخیره و اعمالِ خودکارِ قیمت روی بسته‌های پیامک</button>
      </Card>

      <Card>
        <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>تعرفهٔ اپراتور (ریال به‌ازای هر پیامک)</div>
        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 8, padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
            <div>خطِ ارسال</div><div>همراه‌اول فارسی</div><div>همراه‌اول لاتین</div><div>سایر فارسی</div><div>سایر لاتین</div>
          </div>
          {c.tariffs.map((t: any, i: number) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 8, padding: '5px 8px', alignItems: 'center', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <input style={{ ...inp, padding: '5px 7px' }} value={t.lineType} onChange={e => setT(i, { lineType: e.target.value })} />
              <input style={{ ...inp, padding: '5px 7px' }} type="number" value={t.mciFa} onChange={e => setT(i, { mciFa: Number(e.target.value) || 0 })} />
              <input style={{ ...inp, padding: '5px 7px' }} type="number" value={t.mciLat} onChange={e => setT(i, { mciLat: Number(e.target.value) || 0 })} />
              <input style={{ ...inp, padding: '5px 7px' }} type="number" value={t.otherFa} onChange={e => setT(i, { otherFa: Number(e.target.value) || 0 })} />
              <input style={{ ...inp, padding: '5px 7px' }} type="number" value={t.otherLat} onChange={e => setT(i, { otherLat: Number(e.target.value) || 0 })} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Promotions / featuring across the site ────────────────────────────────
function SlotPromoter({ slot, promos, onChange }: { slot: any; promos: any[]; onChange: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const search = async () => {
    const r = await fetch(`/api/admin/scraper/items?type=${slot.target}&q=${encodeURIComponent(q)}`)
    if (r.ok) setResults((await r.json()).items.slice(0, 8))
  }
  const promote = async (id: string) => {
    await fetch('/api/admin/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot: slot.id, targetId: id }) })
    setQ(''); setResults([]); setOpen(false); onChange()
  }
  const toggle = async (id: string, active: boolean) => { await fetch('/api/admin/promotions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active }) }); onChange() }
  const del = async (id: string) => { await fetch(`/api/admin/promotions?id=${id}`, { method: 'DELETE' }); onChange() }
  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><div style={{ fontWeight: 700, fontSize: 14 }}>{slot.label} <span style={{ fontSize: 11, color: 'var(--faint)' }}>({promos.length.toLocaleString('fa-IR')} پروموت)</span></div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{slot.where}</div></div>
        <OutlineButton onClick={() => setOpen(o => !o)} style={{ fontSize: 12, padding: '6px 13px' }}>{open ? 'بستن' : '＋ پروموت آیتم'}</OutlineButton>
      </div>
      {open && (
        <div style={{ marginTop: 12, background: 'var(--bg2)', borderRadius: 10, padding: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inp, flex: 1 }} placeholder={`جستجوی ${slot.target === 'directory' ? 'مشاور/پروفایل' : slot.target === 'product' ? 'محصول' : 'آگهی'} برای پروموت…`} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search() }} />
            <OutlineButton onClick={search}>جستجو</OutlineButton>
          </div>
          {results.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {results.map(it => (
                <div key={it.id} onClick={() => promote(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, cursor: 'pointer', background: 'var(--surface)', fontSize: 12.5 }}>
                  {it.image && <img src={it.image} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }} />}
                  <span style={{ flex: 1 }}>{it.title}</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>＋ پروموت</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {promos.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {promos.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', borderRadius: 9, padding: '8px 10px', opacity: p.active ? 1 : .5 }}>
              {p.image ? <img src={p.image} alt="" style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} /> : <span style={{ width: 34, height: 34, borderRadius: 7, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>★</span>}
              <div style={{ flex: 1, minWidth: 100 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div><div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{[p.location, p.price].filter(Boolean).join(' · ')}</div></div>
              <button onClick={() => toggle(p.id, !p.active)} style={{ ...inp, padding: '4px 10px', cursor: 'pointer', fontSize: 11.5, color: p.active ? '#5fd98a' : 'var(--faint)' }}>{p.active ? 'فعال' : 'غیرفعال'}</button>
              <button onClick={() => del(p.id)} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function PromotionsView() {
  const [slots, setSlots] = useState<any[]>([])
  const [promotions, setPromotions] = useState<any[]>([])
  const load = () => fetch('/api/admin/promotions').then(r => r.ok ? r.json() : { slots: [], promotions: [] }).then(d => { setSlots(d.slots || []); setPromotions(d.promotions || []) })
  useEffect(() => { load() }, [])
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>پروموت و ویژه‌سازی</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>هر جای سایت که می‌توان آگهی/مشاور/محصول را «ویژه» کرد در فهرست زیر آمده. برای هر جایگاه، آیتم‌ها را جستجو و پروموت کن؛ روی صفحات عمومی در همان جایگاه و در صدر نمایش داده می‌شوند.</div>
      </Card>
      {slots.map(s => <SlotPromoter key={s.id} slot={s} promos={promotions.filter(p => p.slot === s.id)} onChange={load} />)}
    </div>
  )
}

// ─── Promos (discount codes) ───────────────────────────────────────────────
function PromosView() {
  const [promos, setPromos] = useState<any[]>([])
  const [f, setF] = useState({ code: '', type: 'percent', value: '', description: '', maxUses: '' })
  const load = () => fetch('/api/admin/promos').then(r => r.ok ? r.json() : { promos: [] }).then(d => setPromos(d.promos || []))
  useEffect(() => { load() }, [])
  const add = async () => {
    if (!f.code.trim() || !f.value) { return }
    const r = await fetch('/api/admin/promos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: f.code, type: f.type, value: Number(f.value), description: f.description, maxUses: f.maxUses ? Number(f.maxUses) : undefined }) })
    const d = await r.json(); if (d.error) { alert(d.error); return }
    setF({ code: '', type: 'percent', value: '', description: '', maxUses: '' }); load()
  }
  const patch = async (id: string, p: any) => { await fetch('/api/admin/promos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...p }) }); load() }
  const del = async (id: string) => { if (!confirm('این کد حذف شود؟')) return; await fetch(`/api/admin/promos?id=${id}`, { method: 'DELETE' }); load() }
  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>کدهای تخفیف</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...inp, direction: 'ltr', textAlign: 'left', width: 130 }} placeholder="CODE" value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <select style={inp} value={f.type} onChange={e => setF({ ...f, type: e.target.value })}><option value="percent">درصدی</option><option value="amount">مبلغی (تومان)</option></select>
          <input style={{ ...inp, width: 110 }} placeholder={f.type === 'percent' ? 'درصد' : 'مبلغ'} value={f.value} onChange={e => setF({ ...f, value: e.target.value })} />
          <input style={{ ...inp, width: 110 }} placeholder="سقف استفاده" value={f.maxUses} onChange={e => setF({ ...f, maxUses: e.target.value })} />
          <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="توضیح" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <GoldButton onClick={add}>＋ افزودن</GoldButton>
        </div>
      </Card>
      <Card>
        {promos.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>کدی نیست.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {promos.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px', flexWrap: 'wrap', opacity: p.active ? 1 : .5 }}>
                <span style={{ fontWeight: 800, fontSize: 14, direction: 'ltr', color: 'var(--gold)' }}>{p.code}</span>
                <span style={{ fontSize: 13 }}>{p.type === 'percent' ? `${p.value}٪` : `${(p.value || 0).toLocaleString('fa-IR')} ت`}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1, minWidth: 100 }}>{p.description}</span>
                <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{(p.used || 0).toLocaleString('fa-IR')}{p.maxUses ? `/${p.maxUses.toLocaleString('fa-IR')}` : ''} استفاده</span>
                <button onClick={() => patch(p.id, { active: !p.active })} style={{ ...inp, padding: '4px 10px', cursor: 'pointer', fontSize: 11.5, color: p.active ? '#5fd98a' : 'var(--faint)' }}>{p.active ? 'فعال' : 'غیرفعال'}</button>
                <button onClick={() => del(p.id)} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Banner ads ────────────────────────────────────────────────────────────
function AdsView() {
  const [banners, setBanners] = useState<any[]>([])
  const [f, setF] = useState({ title: '', image: '', link: '', placement: 'home' })
  const load = () => fetch('/api/admin/banners').then(r => r.ok ? r.json() : { banners: [] }).then(d => setBanners(d.banners || []))
  useEffect(() => { load() }, [])
  const add = async () => { if (!f.title.trim() || !f.image.trim()) return; await fetch('/api/admin/banners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); setF({ title: '', image: '', link: '', placement: 'home' }); load() }
  const patch = async (id: string, p: any) => { await fetch('/api/admin/banners', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...p }) }); load() }
  const del = async (id: string) => { if (!confirm('این بنر حذف شود؟')) return; await fetch(`/api/admin/banners?id=${id}`, { method: 'DELETE' }); load() }
  const PL: Record<string, string> = { home: 'صفحهٔ خانه', search: 'جستجو', sidebar: 'ساید‌بار', article: 'مقالات' }
  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>تبلیغات بنری</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="mjsa-2col">
          <input style={inp} placeholder="عنوان *" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <select style={inp} value={f.placement} onChange={e => setF({ ...f, placement: e.target.value })}>{Object.entries(PL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <div><ImageUpload label="تصویر بنر" value={f.image} onChange={url => setF({ ...f, image: url })} height={90} /></div>
          <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} placeholder="لینک مقصد" value={f.link} onChange={e => setF({ ...f, link: e.target.value })} />
          <div style={{ gridColumn: '1 / -1' }}><GoldButton onClick={add}>＋ افزودن بنر</GoldButton></div>
        </div>
      </Card>
      <Card>
        {banners.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>بنری نیست.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {banners.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', borderRadius: 10, padding: 10, flexWrap: 'wrap', opacity: b.active ? 1 : .5 }}>
                <img src={b.image} alt="" style={{ width: 120, height: 50, borderRadius: 8, objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                <div style={{ flex: 1, minWidth: 120 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.title}</div><div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{PL[b.placement] || b.placement} · {(b.clicks || 0).toLocaleString('fa-IR')} کلیک</div></div>
                <button onClick={() => patch(b.id, { active: !b.active })} style={{ ...inp, padding: '4px 10px', cursor: 'pointer', fontSize: 11.5, color: b.active ? '#5fd98a' : 'var(--faint)' }}>{b.active ? 'فعال' : 'غیرفعال'}</button>
                <button onClick={() => del(b.id)} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function useSystem() {
  const [d, setD] = useState<any>(null)
  useEffect(() => { const f = () => fetch('/api/admin/system').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); f(); const t = setInterval(f, 8000); return () => clearInterval(t) }, [])
  return d
}
function fmtUptime(sec: number) { const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60); return [d && `${d.toLocaleString('fa-IR')} روز`, h && `${h.toLocaleString('fa-IR')} ساعت`, `${m.toLocaleString('fa-IR')} دقیقه`].filter(Boolean).join(' ') }

function HealthView() {
  const d = useSystem()
  if (!d) return <Card>در حال خواندن آمار سیستم…</Card>
  const p = d.process
  const memPct = Math.round((1 - p.freeMemMB / p.totalMemMB) * 100)
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <KPI label="آپتایم پراسس" value={fmtUptime(p.uptimeSec)} trend={`Node ${p.node}`} icon="◉" iconBg="rgba(95,217,138,.15)" iconColor="#5fd98a" trendUp />
        <KPI label="حافظهٔ پراسس (RSS)" value={`${p.rssMB.toLocaleString('fa-IR')}MB`} trend={`Heap ${p.heapUsedMB.toLocaleString('fa-IR')}/${p.heapTotalMB.toLocaleString('fa-IR')}MB`} icon="▦" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" />
        <KPI label="رکوردهای داده" value={(d.totalRecords || 0).toLocaleString('fa-IR')} trend={`${d.stores.length.toLocaleString('fa-IR')} مخزن`} icon="⛁" iconBg="var(--goldDim)" iconColor="var(--gold)" />
        <KPI label="حافظهٔ سرور" value={`${memPct.toLocaleString('fa-IR')}٪`} trend={`${p.cpus.toLocaleString('fa-IR')} هسته · بار ${p.loadAvg[0]}`} icon="⚡" iconBg="rgba(231,161,74,.1)" iconColor="#e7a14a" />
      </div>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>مخازن داده (واقعی)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--line)' }}>{['مخزن', 'رکورد', 'حجم', 'آخرین تغییر'].map(h => <th key={h} style={{ textAlign: 'right', padding: '8px 6px', fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>
            {d.stores.map((s: any) => (
              <tr key={s.name} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '10px 6px', fontSize: 13, fontWeight: 600 }}>{s.label}<span style={{ fontSize: 10.5, color: 'var(--faint)', marginInlineStart: 6, direction: 'ltr' }}>{s.name}</span></td>
                <td style={{ padding: '10px 6px', fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{s.records.toLocaleString('fa-IR')}</td>
                <td style={{ padding: '10px 6px', fontSize: 12.5, color: 'var(--muted)' }}>{s.sizeKB.toLocaleString('fa-IR')} KB</td>
                <td style={{ padding: '10px 6px', fontSize: 12, color: 'var(--faint)' }}>{timeAgo(s.updated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {d.postgres && (
        <Card style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>پایگاه‌دادهٔ PostgreSQL</div>
            {d.postgres.enabled === false
              ? <span style={{ fontSize: 11.5, color: 'var(--faint)', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 9px' }}>غیرفعال (روی فایل)</span>
              : d.postgres.connected
                ? <span style={{ fontSize: 11.5, color: '#5fd98a', border: '1px solid rgba(95,217,138,.4)', borderRadius: 999, padding: '2px 9px' }}>● متصل</span>
                : <span style={{ fontSize: 11.5, color: '#e7674a', border: '1px solid rgba(231,103,74,.4)', borderRadius: 999, padding: '2px 9px' }}>✕ قطع</span>}
          </div>
          {d.postgres.enabled === false
            ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>DATABASE_URL ست نشده — همه‌چیز روی فایل‌های JSON بالا کار می‌کند.</div>
            : d.postgres.connected ? (
              <>
                <div style={{ display: 'flex', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 11, color: 'var(--faint)' }}>کلیدها (kv)</div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>{d.postgres.kvRows.toLocaleString('fa-IR')}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--faint)' }}>حجمِ کلِ دیتابیس</div><div style={{ fontSize: 18, fontWeight: 800 }}>{d.postgres.dbSizeMB.toLocaleString('fa-IR')} MB</div></div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 6 }}>بزرگ‌ترین استورها:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {d.postgres.topKeys.map((k: any) => (
                    <span key={k.key} style={{ fontSize: 11.5, background: 'var(--line2)', borderRadius: 8, padding: '3px 9px', direction: 'ltr' }}>{k.key} · {k.kb.toLocaleString('fa-IR')} KB</span>
                  ))}
                </div>
              </>
            ) : <div style={{ fontSize: 12.5, color: '#e7674a' }}>اتصال به PostgreSQL برقرار نشد — لاگِ pm2 و رمزِ DATABASE_URL را بررسی کنید.</div>}
        </Card>
      )}
    </div>
  )
}

function ServersView() {
  const d = useSystem()
  if (!d) return <Card>در حال خواندن…</Card>
  const p = d.process
  const bar = (label: string, used: number, total: number) => {
    const pct = Math.round(used / total * 100)
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}><span style={{ color: 'var(--muted)' }}>{label}</span><span>{used.toLocaleString('fa-IR')} / {total.toLocaleString('fa-IR')} MB ({pct.toLocaleString('fa-IR')}٪)</span></div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--line2)' }}><div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: pct > 85 ? '#e7674a' : pct > 65 ? 'var(--gold)' : '#5fd98a' }} /></div>
      </div>
    )
  }
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>سرور برنامه (زنده)</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>پلتفرم {p.platform} · Node {p.node} · PID {p.pid.toLocaleString('fa-IR')} · {p.cpus.toLocaleString('fa-IR')} هسته · آپتایم {fmtUptime(p.uptimeSec)}</div>
        {bar('حافظهٔ سرور', p.totalMemMB - p.freeMemMB, p.totalMemMB)}
        {bar('حافظهٔ پراسس (RSS)', p.rssMB, p.totalMemMB)}
        {bar('Heap نود', p.heapUsedMB, p.heapTotalMB)}
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>بار سیستم (۱/۵/۱۵ دقیقه): {p.loadAvg.map((n: number) => n.toLocaleString('fa-IR')).join(' · ')}</div>
      </Card>
    </div>
  )
}

function QueueView() {
  const [pending, setPending] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const load = () => {
    fetch('/api/admin/scraper/items?status=pending').then(r => r.ok ? r.json() : { items: [] }).then(d => setPending(d.items || []))
    fetch('/api/admin/scraper/sources').then(r => r.ok ? r.json() : { sources: [] }).then(d => setSources(d.sources || []))
  }
  useEffect(() => { load() }, [])
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <div className="mjsa-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
        <KPI label="در صف تأیید" value={pending.length.toLocaleString('fa-IR')} trend="منتظر بررسی AI" icon="⏳" iconBg="rgba(231,103,74,.15)" iconColor="#e7674a" />
        <KPI label="منابع اسکرپ" value={sources.length.toLocaleString('fa-IR')} trend={`${sources.filter((s: any) => s.enabled).length.toLocaleString('fa-IR')} فعال`} icon="⛏" iconBg="rgba(91,155,213,.15)" iconColor="#5b9bd5" />
        <KPI label="منابع دارای خطا" value={sources.filter((s: any) => s.status === 'error').length.toLocaleString('fa-IR')} trend="نیاز به بررسی" icon="⚠" iconBg="var(--goldDim)" iconColor="var(--gold)" />
      </div>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>آیتم‌های در صف تأیید ({pending.length.toLocaleString('fa-IR')})</div>
        {pending.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>صف خالی است — همه‌چیز بررسی شده.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.slice(0, 30).map(it => <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}><span style={{ flex: 1 }}>{it.title}</span><span style={{ color: 'var(--faint)', fontSize: 11 }}>{timeAgo(it.scrapedAt)}</span></div>)}
          </div>
        )}
      </Card>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>وضعیت منابع اسکرپ</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sources.map((s: any) => <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: s.status === 'error' ? '#e7674a' : s.status === 'ok' ? '#5fd98a' : 'var(--faint)' }} /><span style={{ flex: 1 }}>{s.name}</span><span style={{ color: 'var(--faint)', fontSize: 11 }}>{s.lastCount ? `${s.lastCount.toLocaleString('fa-IR')} مورد` : '—'} · {timeAgo(s.lastRun)}</span></div>)}
          {sources.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>منبعی نیست.</div>}
        </div>
      </Card>
    </div>
  )
}

function AuditView() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { fetch('/api/admin/audit').then(r => r.ok ? r.json() : { entries: [] }).then(d => setRows(d.entries || [])) }, [])
  return (
    <div style={{ animation: 'fade .35s ease' }}>
      <Card>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>لاگ ممیزی</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>اقدامات ثبت‌شدهٔ مدیران (ساخت/ویرایش/حذف/تغییر وضعیت).</div>
        {rows.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '14px 0', textAlign: 'center' }}>هنوز رویدادی ثبت نشده.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{r.actor}</span>
                <span style={{ flex: 1 }}>{r.action}{r.target && <span style={{ color: 'var(--muted)' }}> — {r.target}</span>}</span>
                <span style={{ color: 'var(--faint)', fontSize: 11 }}>{timeAgo(r.at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
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
  const [navOpen, setNavOpen] = useState(false)   // کشوی منوی موبایل
  const [now, setNow] = useState('')
  const [supportUnread, setSupportUnread] = useState(0)   // نوتیفِ تیکت‌های پاسخ‌نداده

  useEffect(() => {
    const poll = () => fetch('/api/admin/support?count=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d?.ok) setSupportUnread(d.unread || 0) }).catch(() => {})
    poll(); const id = setInterval(poll, 30000); return () => clearInterval(id)
  }, [active])

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
      case 'persiansaze': return <PersianSazeView />
      case 'support':    return <AdminSupportView />
      case 'listings':   return <ListingsView />
      case 'products':   return <ProductsView />
      case 'catalog':    return <CatalogAdminView />
      case 'categories': return <CategoriesView />
      case 'crm':        return <CrmAdminView />
      case 'connections': return <ConnectionsView />
      case 'geo':        return <GeoView />
      case 'moderation': return <ModerationView />
      case 'content':    return <ContentView />
      case 'studio':     return <StudioView />
      case 'articles':   return <ArticlesView />
      case 'api':        return <APIView />
      case 'users':      return <UsersView />
      case 'profiles':   return <ProfilesView />
      case 'roles':      return <RolesView />
      case 'plans':      return <PlansView />
      case 'payment':    return <PaymentView />
      case 'aicost':     return <AiCostView />
      case 'smscost':    return <SmsCostView />
      case 'tracker':    return <TrackerConfig />
      case 'sms':        return <SmsView />
      case 'promos':     return <PromotionsView />
      case 'discounts':  return <PromosView />
      case 'ads':        return <AdsView />
      case 'settings':   return <SettingsView />
      case 'flags':      return <FlagsView />
      case 'health':     return <HealthView />
      case 'servers':    return <ServersView />
      case 'queue':      return <QueueView />
      case 'audit':      return <AuditView />
      case 'reports':    return <ReportsView />
      default:           return <SimpleView title={viewTitles[active]} />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden', direction: 'rtl' }}>

      {/* OVERLAY موبایل (پشتِ کشو) */}
      <div className={`mjsa-overlay${navOpen ? ' mjsa-open' : ''}`} onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 125 }} />

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`mjsa-side${navOpen ? ' mjsa-open' : ''}`} style={{
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
                  onClick={() => { setActive(item.id); setNavOpen(false) }}
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
                  {item.id === 'support' && supportUnread > 0
                    ? <Badge label={supportUnread.toLocaleString('fa-IR')} color="#e7674a" />
                    : item.badge && <Badge label={item.badge} color={item.badgeColor ?? '#5fd98a'} />}
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
          backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12
        }}>
          <button className="mjsa-burger" aria-label="منو" onClick={() => setNavOpen(true)} style={{ width: 42, height: 42, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--gold)', fontSize: 20, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}>☰</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{viewTitles[active]}</h1>
          </div>

          {/* Live clock */}
          <div className="mjsa-tb-hide" style={{ fontSize: 13, color: 'var(--muted)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '.5px' }}>{now}</div>

          {/* System status badge */}
          <div className="mjsa-tb-hide" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(95,217,138,.12)', borderRadius: 999, padding: '6px 12px', border: '1px solid rgba(95,217,138,.25)' }}>
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
        /* کشوی منوی موبایلِ ادمین */
        .mjsa-burger{display:none}
        .mjsa-overlay{display:none}
        @media(max-width:760px){.mjsa-tb-hide{display:none!important}}
        @media(max-width:860px){
          .mjsa-side{position:fixed!important;right:0;top:0;height:100vh!important;width:84vw!important;max-width:310px;z-index:130;transform:translateX(105%);transition:transform .26s ease;box-shadow:-12px 0 40px -12px rgba(0,0,0,.6)}
          .mjsa-side.mjsa-open{transform:translateX(0)}
          .mjsa-burger{display:inline-flex!important}
          .mjsa-overlay.mjsa-open{display:block}
        }
      `}</style>
    </div>
  )
}
