'use client'
import { useState, useEffect, useCallback } from 'react'
import JalaliDatePicker from '@/app/components/JalaliDatePicker'
import NumberInput from '@/app/components/NumberInput'
import PlansPanel from '@/app/components/PlansPanel'
import ListingReports from '@/app/components/ListingReports'
import ReosPanelSection from '@/app/components/ReosPanelSection'
import ReosInvestorTool from '@/app/components/ReosInvestorTool'
import ReosWallet from '@/app/components/ReosWallet'
import ReosReferralCard from '@/app/components/ReosReferralCard'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'
import SupportPanel from '@/app/components/SupportPanel'

// ════════════════════════════════════════════════════════
//  Types (mirror app/lib/owner-store.ts API shape)
// ════════════════════════════════════════════════════════
type Deal = 'sale' | 'rent'
type PropStatus = 'active' | 'sold' | 'rented' | 'draft'
type InquiryStatus = 'new' | 'contacted' | 'closed'
type ViewingStatus = 'scheduled' | 'done' | 'canceled'
type OfferStatus = 'pending' | 'accepted' | 'rejected'

interface Property {
  id: string; title: string; ptype: string; location: string; area: number; rooms: number
  price: number; deal: Deal; status: PropStatus; views: number; createdAt: number
}
interface Inquiry { id: string; propertyId: string; name: string; phone?: string; message?: string; status: InquiryStatus; createdAt: number }
interface Viewing { id: string; propertyId: string; visitor: string; phone?: string; date: string; status: ViewingStatus; createdAt: number }
interface Offer { id: string; propertyId: string; buyer: string; phone?: string; amount: number; status: OfferStatus; createdAt: number }

interface RecentInquiry { id: string; propertyId: string; name: string; phone?: string; message?: string; status: InquiryStatus; createdAt: number }
interface Upcoming { id: string; propertyId: string; visitor: string; phone?: string; date: string; status: ViewingStatus; createdAt: number }

interface Stats {
  profile: { name: string }
  kpis: {
    activeCount: number; totalProps: number; newInquiries: number; upcomingViewings: number
    pendingOffers: number; monthViews: number; monthChange: number; totalViews: number; portfolio: number
  }
  monthlyViews: { month: string; count: number }[]
  recentInquiries: RecentInquiry[]
  upcoming: Upcoming[]
}
interface OwnerData { stats: Stats; properties: Property[]; inquiries: Inquiry[]; viewings: Viewing[]; offers: Offer[] }

type View = 'dashboard' | 'properties' | 'inquiries' | 'viewings' | 'offers' | 'plans' | 'profile' | 'settings' | 'support'

// ════════════════════════════════════════════════════════
//  Formatting & status helpers
// ════════════════════════════════════════════════════════
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')

// مبلغ تومان به‌صورت فشرده
function money(n: number): string {
  if (n >= 1e9) return fa(Math.round((n / 1e9) * 10) / 10) + ' میلیارد'
  if (n >= 1e6) return fa(Math.round(n / 1e6)) + ' میلیون'
  return fa(n) + ' تومان'
}

const PROP_LABEL: Record<PropStatus, string> = { active: 'فعال', sold: 'فروخته‌شده', rented: 'اجاره‌رفته', draft: 'پیش‌نویس' }
const PROP_COLOR: Record<PropStatus, string> = { active: '#34d399', sold: '#60a5fa', rented: '#2dd4bf', draft: '#7a8fae' }
const PROP_STATUSES: PropStatus[] = ['active', 'sold', 'rented', 'draft']

const INQ_LABEL: Record<InquiryStatus, string> = { new: 'جدید', contacted: 'پیگیری‌شده', closed: 'بسته' }
const INQ_COLOR: Record<InquiryStatus, string> = { new: 'var(--gold)', contacted: '#60a5fa', closed: '#7a8fae' }
const INQ_STATUSES: InquiryStatus[] = ['new', 'contacted', 'closed']

const VIEW_LABEL: Record<ViewingStatus, string> = { scheduled: 'برنامه‌ریزی‌شده', done: 'انجام‌شده', canceled: 'لغو' }
const VIEW_COLOR: Record<ViewingStatus, string> = { scheduled: 'var(--gold)', done: '#34d399', canceled: '#7a8fae' }
const VIEW_STATUSES: ViewingStatus[] = ['scheduled', 'done', 'canceled']

const OFFER_LABEL: Record<OfferStatus, string> = { pending: 'در انتظار', accepted: 'پذیرفته', rejected: 'رد' }
const OFFER_COLOR: Record<OfferStatus, string> = { pending: '#f59e0b', accepted: '#34d399', rejected: '#ef4444' }

const DEAL_LABEL: Record<Deal, string> = { sale: 'فروش', rent: 'اجاره' }

const PTYPE_OPTIONS = ['آپارتمان', 'ویلا', 'زمین', 'مغازه', 'سایر']

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inputStyle: React.CSSProperties = {
  padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)',
  color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%',
}
const actionBtn: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)',
  color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap',
}

const VIEW_TITLES: Record<View, string> = {
  dashboard: 'داشبورد مالک',
  properties: 'ملک‌های من',
  inquiries: 'استعلام‌ها',
  viewings: 'بازدیدها',
  offers: 'پیشنهادها',
  plans: 'پلن‌ها',
  profile: 'پروفایل',
  settings: 'تنظیمات',
  support: 'پشتیبانی',
}

const NAV_ITEMS: { id: View; label: string; icon: string; badge?: 'inquiries' | 'viewings' | 'offers' }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '▦' },
  { id: 'properties', label: 'ملک‌های من', icon: '◫' },
  { id: 'inquiries', label: 'استعلام‌ها', icon: '◎', badge: 'inquiries' },
  { id: 'viewings', label: 'بازدیدها', icon: '◉', badge: 'viewings' },
  { id: 'offers', label: 'پیشنهادها', icon: '◈', badge: 'offers' },
  { id: 'plans', label: 'پلن‌ها', icon: '👑' },
  { id: 'profile', label: 'پروفایل', icon: '🪪' },
  { id: 'settings', label: 'تنظیمات', icon: '⛭' },
  { id: 'support', label: 'پشتیبانی', icon: '🛟' },
]
const NAV_LINKS: { href: string; label: string; icon: string }[] = [
  { href: '/crm', label: 'CRM و مشتریان', icon: '◇' },
  { href: '/marketing', label: 'مارکتینگ', icon: '◬' },
  { href: '/workflow', label: 'اتوماسیون', icon: '⛭' },
  { href: '/website-builder', label: 'وب‌سایت‌ساز', icon: '◳' },
]

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

// ════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════
export default function OwnerPage() {
  const [view, setView] = useState<View>('dashboard')
  const [data, setData] = useState<OwnerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauth, setUnauth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [navOpen, setNavOpen] = useState(false)   // کشوی منوی موبایل
  const goView = (v: View) => { setView(v); setNavOpen(false) }

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/owner')
      if (r.status === 401) { setUnauth(true); setLoading(false); return }
      const d = await r.json()
      setData(d); setUnauth(false)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const post = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    try {
      const r = await fetch('/api/owner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'برای انجام این عملیات وارد شوید'); return false }
      await refresh()
      return true
    } catch { return false } finally { setBusy(false) }
  }, [refresh])

  const toggleTheme = () => {
    const html = document.documentElement
    if (theme === 'dark') { html.classList.add('light'); setTheme('light') }
    else { html.classList.remove('light'); setTheme('dark') }
  }

  if (loading) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 15 }}>
        در حال بارگذاری پنل مالک…
      </div>
    )
  }
  if (unauth || !data) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ ...card, padding: '40px 44px', textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>برای دسترسی به پنل مالک وارد شوید</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>پنل مالک فقط برای کاربران واردشده در دسترس است.</div>
          <a href="/auth" style={{
            display: 'inline-block', padding: '10px 28px', borderRadius: 10,
            background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f',
            fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>ورود به حساب</a>
        </div>
      </div>
    )
  }

  const { stats, properties, inquiries, viewings, offers } = data
  const propMap = new Map(properties.map(p => [p.id, p.title]))
  const titleOf = (id: string) => propMap.get(id) || '—'

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>

      {/* OVERLAY موبایل (پشتِ کشو) */}
      <div className={`mjo-overlay${navOpen ? ' mjo-open' : ''}`} onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 125 }} />

      {/* ════════════ SIDEBAR ════════════ */}
      <aside className={`mjo-side${navOpen ? ' mjo-open' : ''}`} style={{
        width: 232, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--line)',
        position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px var(--gold)', flexShrink: 0,
            }}>
              <div style={{ width: 13, height: 13, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 3 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px' }}>ملک‌جت</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>پنل مالک</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = view === item.id
            const badge = item.badge === 'inquiries' ? stats.kpis.newInquiries
              : item.badge === 'viewings' ? stats.kpis.upcomingViewings
                : item.badge === 'offers' ? stats.kpis.pendingOffers : 0
            return (
              <button key={item.id} onClick={() => goView(item.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                border: 'none', cursor: 'pointer', background: active ? 'var(--goldDim)' : 'transparent',
                color: active ? 'var(--gold)' : 'var(--muted)', fontWeight: active ? 700 : 500, fontSize: 14,
                textAlign: 'right', marginBottom: 2, fontFamily: FONT, transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                <span className="mjo-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badge > 0 && (
                  <span style={{ background: active ? 'var(--gold)' : 'var(--line2)', color: active ? '#16140f' : 'var(--text)', borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{fa(badge)}</span>
                )}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setNavOpen(false)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
              color: 'var(--muted)', textDecoration: 'none', fontWeight: 500, fontSize: 14, marginBottom: 2, fontFamily: FONT,
            }}>
              <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: 0.7 }}>{l.icon}</span>
              <span className="mjo-sidelabel" style={{ flex: 1 }}>{l.label}</span>
            </a>
          ))}
        </nav>

        {/* Owner identity */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#16140f', flexShrink: 0,
          }}>{stats.profile.name.trim().charAt(0) || 'م'}</div>
          <div className="mjo-sidelabel" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.profile.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>مالک · فروشنده</div>
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
          borderBottom: '1px solid var(--line)', padding: '0 24px', minHeight: 64,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <button className="mjo-burger" aria-label="منو" onClick={() => setNavOpen(true)} style={{ width: 42, height: 42, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--gold)', fontSize: 20, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: FONT }}>☰</button>
          <h2 style={{ fontSize: 17, fontWeight: 700, flexShrink: 0 }}>{VIEW_TITLES[view]}</h2>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="جستجوی ملک، استعلام..."
            className="mjo-search"
            style={{ ...inputStyle, flex: 1, minWidth: 160, maxWidth: 360, marginInlineStart: 'auto' }}
          />
          <button onClick={() => { setView('properties'); setShowAdd(true) }} style={{
            padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
            color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap', flexShrink: 0,
          }}>+ ثبت ملک</button>
        </div>

        {/* Content */}
        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {view === 'dashboard' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><DashboardView stats={stats} titleOf={titleOf} post={post} onViewings={() => goView('viewings')} onInquiries={() => goView('inquiries')} /><ReosInvestorTool defaultMode="investment" /><ReosWallet /><ReosReferralCard /><ReosPanelSection title="املاکِ پیشنهادیِ REOS" subtitle="مرتبط با بازار و رفتارِ خریداران" /></div>}
          {view === 'properties' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><ListingReports /><PropertiesView properties={properties} post={post} busy={busy} search={search} showAdd={showAdd} setShowAdd={setShowAdd} /></div>}
          {view === 'inquiries' && <InquiriesView inquiries={inquiries} properties={properties} titleOf={titleOf} post={post} busy={busy} search={search} />}
          {view === 'viewings' && <ViewingsView viewings={viewings} properties={properties} titleOf={titleOf} post={post} busy={busy} search={search} />}
          {view === 'offers' && <OffersView offers={offers} titleOf={titleOf} post={post} busy={busy} search={search} />}
          {view === 'plans' && <PlansPanel dashboard="/owner" channels={['token']} />}
          {view === 'profile' && <BusinessProfileForm />}
          {view === 'settings' && <SettingsView profile={stats.profile} post={post} busy={busy} />}
          {view === 'support' && <SupportPanel panel="owner" />}
        </main>
      </div>

      <style>{`
        .mjo-burger{display:none}
        .mjo-overlay{display:none}
        @media(max-width:760px){
          .mjo-cols{flex-direction:column!important}
          .mjo-side{position:fixed!important;right:0;top:0;height:100vh!important;width:82vw!important;max-width:300px;z-index:130;transform:translateX(105%);transition:transform .26s ease;box-shadow:-12px 0 40px -12px rgba(0,0,0,.6)}
          .mjo-side.mjo-open{transform:translateX(0)}
          .mjo-burger{display:inline-flex!important}
          .mjo-overlay.mjo-open{display:block}
        }
        @media(max-width:1000px){ .mjo-grid4{ grid-template-columns:repeat(2,1fr)!important } .mjo-grid2{ grid-template-columns:1fr!important } }
        @media(max-width:680px){ .mjo-grid4{ grid-template-columns:1fr!important } .mjo-form{ grid-template-columns:1fr!important } }
        @media(max-width:600px){ .mjo-search{ order:3; max-width:none!important; flex-basis:100%!important; margin:0 0 10px!important } }
      `}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════
function DashboardView({ stats, titleOf, post, onViewings, onInquiries }: {
  stats: Stats; titleOf: (id: string) => string
  post: (b: Record<string, unknown>) => Promise<boolean>
  onViewings: () => void; onInquiries: () => void
}) {
  const k = stats.kpis
  const kpis = [
    { label: 'ملک‌های فعال', value: fa(k.activeCount), sub: `${fa(k.totalProps)} کل`, subColor: 'var(--muted)' },
    { label: 'استعلام جدید', value: fa(k.newInquiries), sub: 'نیاز به پاسخ', subColor: 'var(--muted)' },
    { label: 'بازدیدهای پیش‌رو', value: fa(k.upcomingViewings), sub: 'برنامه‌ریزی‌شده', subColor: 'var(--muted)' },
    { label: 'بازدید این ماه', value: fa(k.monthViews), sub: `${k.monthChange > 0 ? '+' : ''}${fa(k.monthChange)}٪`, subColor: k.monthChange >= 0 ? '#34d399' : '#f87171' },
  ]
  const maxView = Math.max(1, ...stats.monthlyViews.map(m => m.count))
  const lastIdx = stats.monthlyViews.length - 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI cards */}
      <div className="mjo-grid4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {kpis.map(c => (
          <div key={c.label} style={{ ...card, padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: c.subColor, marginTop: 8, fontWeight: 600 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Portfolio highlight */}
      <div style={{
        ...card, background: 'linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.03))',
        border: '1px solid rgba(201,168,76,0.28)', padding: '22px 24px',
        display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>ارزش پورتفوی</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--gold)' }}>{money(k.portfolio)}</div>
        </div>
        <div style={{ borderInlineStart: '1px solid var(--line)', paddingInlineStart: 32 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>بازدید کل</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{fa(k.totalViews)}</div>
        </div>
      </div>

      {/* Two columns: chart + recent inquiries */}
      <div className="mjo-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* 6-month views */}
        <div style={{ ...card, padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>بازدید ۶ ماهه</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
            {stats.monthlyViews.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 10, color: i === lastIdx ? 'var(--gold)' : 'var(--muted)', fontWeight: 600 }}>{fa(m.count)}</span>
                <div style={{
                  width: '100%', minHeight: 6, height: `${(m.count / maxView) * 100}%`,
                  background: i === lastIdx ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : 'linear-gradient(180deg,rgba(201,168,76,0.45),rgba(201,168,76,0.2))',
                  borderRadius: '5px 5px 0 0',
                }} />
                <span style={{ fontSize: 10, color: i === lastIdx ? 'var(--gold)' : 'var(--muted)', fontWeight: i === lastIdx ? 700 : 500 }}>{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent inquiries */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>استعلام‌های اخیر</span>
            <button onClick={onInquiries} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>همه ←</button>
          </div>
          {stats.recentInquiries.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>استعلامی ثبت نشده است</div>
          ) : stats.recentInquiries.map((q, i) => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: i < stats.recentInquiries.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleOf(q.propertyId)}</div>
                {q.message && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.message}</div>}
              </div>
              <Pill label={INQ_LABEL[q.status]} color={INQ_COLOR[q.status]} />
              {q.status === 'new' && (
                <button onClick={() => post({ action: 'setInquiryStatus', id: q.id, status: 'contacted' })} style={{
                  ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)',
                }}>پاسخ</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming viewings */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>بازدیدهای پیش‌رو</span>
          <button onClick={onViewings} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>همه ←</button>
        </div>
        {stats.upcoming.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>بازدیدی برنامه‌ریزی نشده است</div>
        ) : stats.upcoming.map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: i < stats.upcoming.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.visitor}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleOf(u.propertyId)}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{u.date}</div>
            <Pill label={VIEW_LABEL[u.status]} color={VIEW_COLOR[u.status]} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  PROPERTIES
// ════════════════════════════════════════════════════════
function PropertiesView({ properties, post, busy, search, showAdd, setShowAdd }: {
  properties: Property[]; post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean
  search: string; showAdd: boolean; setShowAdd: (v: boolean) => void
}) {
  const [form, setForm] = useState({ title: '', ptype: PTYPE_OPTIONS[0], location: '', area: '', rooms: '', price: '', deal: 'sale' as Deal })

  const q = search.trim()
  const filtered = q ? properties.filter(p => p.title.includes(q) || p.location.includes(q) || p.ptype.includes(q)) : properties

  const addProperty = async () => {
    if (!form.title.trim()) { alert('عنوان ملک را وارد کنید'); return }
    const ok = await post({
      action: 'addProperty', title: form.title.trim(), ptype: form.ptype, location: form.location.trim(),
      area: Number(form.area) || 0, rooms: Number(form.rooms) || 0, price: Number(form.price) || 0, deal: form.deal,
    })
    if (ok) { setForm({ title: '', ptype: PTYPE_OPTIONS[0], location: '', area: '', rooms: '', price: '', deal: 'sale' }); setShowAdd(false) }
  }

  const editPrice = async (p: Property) => {
    const raw = window.prompt(`${p.deal === 'rent' ? 'ودیعهٔ' : 'قیمت'} جدید «${p.title}» (تومان):`, String(p.price))
    if (raw == null) return
    const price = Number(raw)
    if (!price || price < 0) { alert('عدد معتبر وارد کنید'); return }
    await post({ action: 'updateProperty', id: p.id, patch: { price } })
  }
  const removeProperty = async (p: Property) => {
    if (!window.confirm(`حذف «${p.title}»؟`)) return
    await post({ action: 'deleteProperty', id: p.id })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Add toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
          color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
        }}>{showAdd ? '× بستن' : '+ ثبت ملک'}</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>＋ ثبت ملک جدید</div>
          <div className="mjo-form" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.4fr 0.8fr 0.8fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
            <input placeholder="عنوان" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
            <select value={form.ptype} onChange={e => setForm({ ...form, ptype: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
              {PTYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="موقعیت" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={inputStyle} />
            <input placeholder="متراژ" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} style={inputStyle} />
            <input placeholder="خواب" value={form.rooms} onChange={e => setForm({ ...form, rooms: e.target.value })} style={inputStyle} />
            <NumberInput placeholder="قیمت (تومان)" value={form.price} onChange={v => setForm({ ...form, price: v })} style={inputStyle} />
            <select value={form.deal} onChange={e => setForm({ ...form, deal: e.target.value as Deal })} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="sale">فروش</option>
              <option value="rent">اجاره</option>
            </select>
            <button onClick={addProperty} disabled={busy} style={{
              padding: '9px 18px', borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#16140f',
              fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT, whiteSpace: 'nowrap',
            }}>افزودن</button>
          </div>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ملکی یافت نشد</div>
      ) : (
        <div className="mjo-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ ...card, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{p.ptype} · {p.location}</div>
                </div>
                <Pill label={PROP_LABEL[p.status]} color={PROP_COLOR[p.status]} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{fa(p.area)} متر · {fa(p.rooms)} خواب</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'var(--goldDim)', padding: '2px 9px', borderRadius: 6 }}>{DEAL_LABEL[p.deal]}</span>
                <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--faint)' }}>{fa(p.views)} بازدید</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>
                {money(p.price)} {p.deal === 'rent' && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>ودیعه</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select value={p.status} onChange={e => post({ action: 'updateProperty', id: p.id, patch: { status: e.target.value } })} disabled={busy} style={{
                  padding: '6px 10px', borderRadius: 8, background: 'var(--bg)', border: `1px solid ${PROP_COLOR[p.status]}55`,
                  color: PROP_COLOR[p.status], fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', fontFamily: FONT,
                }}>
                  {PROP_STATUSES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{PROP_LABEL[s]}</option>)}
                </select>
                <button onClick={() => editPrice(p)} disabled={busy} style={actionBtn}>ویرایش قیمت</button>
                <button onClick={() => removeProperty(p)} disabled={busy} title="حذف" style={{ ...actionBtn, color: '#f87171' }}>حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  INQUIRIES
// ════════════════════════════════════════════════════════
function InquiriesView({ inquiries, properties, titleOf, post, busy, search }: {
  inquiries: Inquiry[]; properties: Property[]; titleOf: (id: string) => string
  post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean; search: string
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ propertyId: '', name: '', phone: '', message: '' })

  const q = search.trim()
  const sorted = [...inquiries].sort((a, b) => b.createdAt - a.createdAt)
  const filtered = q ? sorted.filter(x => x.name.includes(q) || titleOf(x.propertyId).includes(q) || (x.message || '').includes(q)) : sorted

  const addInquiry = async () => {
    if (!form.propertyId) { alert('ملک را انتخاب کنید'); return }
    if (!form.name.trim()) { alert('نام را وارد کنید'); return }
    const ok = await post({ action: 'addInquiry', propertyId: form.propertyId, name: form.name.trim(), phone: form.phone.trim() || undefined, message: form.message.trim() || undefined })
    if (ok) { setForm({ propertyId: '', name: '', phone: '', message: '' }); setShowAdd(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
          color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
        }}>{showAdd ? '× بستن' : '+ افزودن استعلام'}</button>
      </div>

      {showAdd && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>＋ استعلام جدید</div>
          <div className="mjo-form" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr 1.6fr auto', gap: 10, alignItems: 'center' }}>
            <select value={form.propertyId} onChange={e => setForm({ ...form, propertyId: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">انتخاب ملک…</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <input placeholder="نام" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            <input placeholder="تلفن" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
            <input placeholder="پیام" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} style={inputStyle} />
            <button onClick={addInquiry} disabled={busy} style={{
              padding: '9px 18px', borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#16140f',
              fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT, whiteSpace: 'nowrap',
            }}>افزودن</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>استعلامی یافت نشد</div>
      ) : (
        <div className="mjo-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {filtered.map(x => {
            const isNew = x.status === 'new'
            return (
              <div key={x.id} style={{ ...card, padding: 18, borderColor: isNew ? 'rgba(201,168,76,0.4)' : 'var(--line)', background: isNew ? 'var(--goldDim)' : 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{x.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {titleOf(x.propertyId)}{x.phone ? ` · ${x.phone}` : ''}
                    </div>
                  </div>
                  <Pill label={INQ_LABEL[x.status]} color={INQ_COLOR[x.status]} />
                </div>
                {x.message && <div style={{ fontSize: 13, color: 'var(--text)', background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>{x.message}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--faint)' }}>{new Date(x.createdAt).toLocaleDateString('fa-IR')}</span>
                  <select value={x.status} onChange={e => post({ action: 'setInquiryStatus', id: x.id, status: e.target.value })} disabled={busy} style={{
                    marginInlineStart: 'auto', padding: '6px 10px', borderRadius: 8, background: 'var(--bg)', border: `1px solid ${INQ_COLOR[x.status]}55`,
                    color: INQ_COLOR[x.status], fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', fontFamily: FONT,
                  }}>
                    {INQ_STATUSES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{INQ_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  VIEWINGS
// ════════════════════════════════════════════════════════
function ViewingsView({ viewings, properties, titleOf, post, busy, search }: {
  viewings: Viewing[]; properties: Property[]; titleOf: (id: string) => string
  post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean; search: string
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ propertyId: '', visitor: '', phone: '', date: '' })

  const q = search.trim()
  const sorted = [...viewings].sort((a, b) => b.createdAt - a.createdAt)
  const filtered = q ? sorted.filter(v => v.visitor.includes(q) || titleOf(v.propertyId).includes(q)) : sorted

  const addViewing = async () => {
    if (!form.propertyId) { alert('ملک را انتخاب کنید'); return }
    if (!form.visitor.trim()) { alert('نام بازدیدکننده را وارد کنید'); return }
    if (!form.date.trim()) { alert('تاریخ را وارد کنید'); return }
    const ok = await post({ action: 'addViewing', propertyId: form.propertyId, visitor: form.visitor.trim(), phone: form.phone.trim() || undefined, date: form.date.trim() })
    if (ok) { setForm({ propertyId: '', visitor: '', phone: '', date: '' }); setShowAdd(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
          color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
        }}>{showAdd ? '× بستن' : '+ زمان‌بندی بازدید'}</button>
      </div>

      {showAdd && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>＋ زمان‌بندی بازدید</div>
          <div className="mjo-form" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr 1.2fr auto', gap: 10, alignItems: 'center' }}>
            <select value={form.propertyId} onChange={e => setForm({ ...form, propertyId: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">انتخاب ملک…</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <input placeholder="بازدیدکننده" value={form.visitor} onChange={e => setForm({ ...form, visitor: e.target.value })} style={inputStyle} />
            <input placeholder="تلفن" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
            <JalaliDatePicker value={form.date} onChange={d => setForm({ ...form, date: d })} placeholder="انتخاب تاریخ بازدید" />
            <button onClick={addViewing} disabled={busy} style={{
              padding: '9px 18px', borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#16140f',
              fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT, whiteSpace: 'nowrap',
            }}>افزودن</button>
          </div>
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', fontSize: 15, fontWeight: 700 }}>
          لیست بازدیدها ({fa(filtered.length)})
        </div>
        <div className="mjo-vrow" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr 1fr 1.4fr', padding: '12px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          <div>بازدیدکننده</div><div>ملک</div><div>تاریخ</div><div>وضعیت</div>
        </div>
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>بازدیدی یافت نشد</div>
          ) : filtered.map((v, i) => (
            <div key={v.id} className="mjo-vrow" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr 1fr 1.4fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{v.visitor}{v.phone && <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>{v.phone}</div>}</div>
              <div style={{ color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleOf(v.propertyId)}</div>
              <div style={{ color: 'var(--muted)' }}>{v.date}</div>
              <div>
                <select value={v.status} onChange={e => post({ action: 'setViewingStatus', id: v.id, status: e.target.value })} disabled={busy} style={{
                  padding: '6px 10px', borderRadius: 8, background: 'var(--bg)', border: `1px solid ${VIEW_COLOR[v.status]}55`,
                  color: VIEW_COLOR[v.status], fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', fontFamily: FONT,
                }}>
                  {VIEW_STATUSES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{VIEW_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  OFFERS
// ════════════════════════════════════════════════════════
function OffersView({ offers, titleOf, post, busy, search }: {
  offers: Offer[]; titleOf: (id: string) => string
  post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean; search: string
}) {
  const q = search.trim()
  const sorted = [...offers].sort((a, b) => b.createdAt - a.createdAt)
  const filtered = q ? sorted.filter(o => o.buyer.includes(q) || titleOf(o.propertyId).includes(q)) : sorted

  if (filtered.length === 0) {
    return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>پیشنهادی یافت نشد</div>
  }

  return (
    <div className="mjo-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {filtered.map(o => {
        const pending = o.status === 'pending'
        return (
          <div key={o.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{o.buyer}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {titleOf(o.propertyId)}{o.phone ? ` · ${o.phone}` : ''}
                </div>
              </div>
              <Pill label={OFFER_LABEL[o.status]} color={OFFER_COLOR[o.status]} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', marginBottom: 14 }}>{money(o.amount)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>{new Date(o.createdAt).toLocaleDateString('fa-IR')}</span>
              <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
                {pending ? (
                  <>
                    <button onClick={() => post({ action: 'setOfferStatus', id: o.id, status: 'accepted' })} disabled={busy} style={{
                      ...actionBtn, color: '#34d399', borderColor: '#34d39955', fontWeight: 700,
                    }}>پذیرفتن</button>
                    <button onClick={() => post({ action: 'setOfferStatus', id: o.id, status: 'rejected' })} disabled={busy} style={{
                      ...actionBtn, color: '#ef4444', borderColor: '#ef444455', fontWeight: 700,
                    }}>رد</button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: OFFER_COLOR[o.status], background: `color-mix(in srgb, ${OFFER_COLOR[o.status]} 16%, transparent)`, padding: '5px 14px', borderRadius: 7 }}>
                    {OFFER_LABEL[o.status]}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════
function SettingsView({ profile, post, busy }: {
  profile: { name: string }; post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean
}) {
  const [name, setName] = useState(profile.name)
  useEffect(() => { setName(profile.name) }, [profile.name])

  const save = async () => {
    if (!name.trim()) { alert('نام را وارد کنید'); return }
    await post({ action: 'updateProfile', patch: { name: name.trim() } })
  }

  return (
    <div style={{ ...card, padding: 24, maxWidth: 520 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>تنظیمات مالک</h3>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نام نمایشی</label>
      <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }} />
      <button onClick={save} disabled={busy} style={{
        padding: '10px 26px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
        color: '#16140f', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT,
      }}>ذخیره</button>
    </div>
  )
}
