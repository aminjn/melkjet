'use client'
import { useState, useEffect, useCallback } from 'react'
import EmpireCard from '@/app/components/EmpireCard'
import NumberInput from '@/app/components/NumberInput'
import ReosPanelSection from '@/app/components/ReosPanelSection'
import AssistantPanel from '@/app/components/AssistantPanel'
import CrmTool, { CRM_VIEWS, type CrmView } from '@/app/components/tools/CrmTool'
import MarketingTool, { MARKETING_VIEWS, type MarketingView } from '@/app/components/tools/MarketingTool'
import WorkflowTool, { WORKFLOW_VIEWS, type WorkflowView } from '@/app/components/tools/WorkflowTool'
import WebsiteBuilderTool, { WEBSITE_VIEWS, type WebsiteView } from '@/app/components/tools/WebsiteBuilderTool'
import ArticleEditor from '@/app/components/ArticleEditor'
import PlansPanel from '@/app/components/PlansPanel'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'
import SupportPanel from '@/app/components/SupportPanel'
import ImageUpload from '@/app/components/ImageUpload'

// ════════════════════════════════════════════════════════
//  Types (mirror app/lib/materials-store.ts API shape)
// ════════════════════════════════════════════════════════
type OrderStatus = 'pending' | 'preparing' | 'shipped' | 'delivered' | 'canceled'
type InquiryStatus = 'new' | 'answered'

interface ProductSpec { key: string; value: string }
interface Product {
  id: string; name: string; category: string; price: number; unit: string
  stock: number; threshold: number; sold: number; active: boolean; createdAt: number
  brand?: string; origin?: string; description?: string; images?: string[]; specs?: ProductSpec[]
  tags?: string[]; minOrder?: number; discountPct?: number; deliveryDays?: number; warranty?: string; featured?: boolean; catalogId?: string
}
interface Order { id: string; customer: string; items: number; amount: number; status: OrderStatus; createdAt: number }
interface Inquiry { id: string; customer: string; product: string; qty: string; note?: string; status: InquiryStatus; reply?: string; createdAt: number }
interface MonthSale { month: string; amount: number }
interface LowStock { id: string; name: string; stock: number; unit: string }
interface Category { label: string; pct: number }

interface Stats {
  profile: { name: string; rating: number }
  slug: string
  kpis: {
    activeProducts: number; lowStockCount: number; newInquiries: number
    activeOrders: number; awaitingShip: number; thisMonthSales: number; monthChange: number
  }
  categories: Category[]
  monthlySales: MonthSale[]
  sixMonthTotal: number
  lowStock: LowStock[]
  recentOrders: Order[]
}
interface MaterialsData { stats: Stats; products: Product[]; orders: Order[]; inquiries: Inquiry[] }

type View = 'dashboard' | 'assistant' | 'articles' | 'catalog' | 'orders' | 'inquiries' | 'plans' | 'profile' | 'settings' | 'support'

// ════════════════════════════════════════════════════════
//  Formatting & status helpers
// ════════════════════════════════════════════════════════
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
// مبلغ تومان → «م.ت» (میلیون تومان)
const mt = (tomans: number) => fa(Math.round(tomans / 1_000_000)) + ' م.ت'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'در انتظار پرداخت',
  preparing: 'در حال آماده‌سازی',
  shipped: 'ارسال شد',
  delivered: 'تحویل شد',
  canceled: 'لغو شد',
}
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  preparing: '#f87171',
  shipped: '#60a5fa',
  delivered: '#34d399',
  canceled: '#7a8fae',
}
const ORDER_STATUSES: OrderStatus[] = ['pending', 'preparing', 'shipped', 'delivered', 'canceled']

const CATEGORY_OPTIONS = ['آهن و میلگرد', 'سیمان و گچ', 'کاشی و سرامیک', 'شیرآلات', 'سایر']
const UNIT_OPTIONS = ['تن', 'کیسه', 'متر', 'عدد', 'شاخه']

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inputStyle: React.CSSProperties = {
  padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)',
  color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%',
}

const VIEW_TITLES: Record<View, string> = {
  dashboard: 'داشبورد فروش',
  assistant: 'دستیار هوشمند',
  articles: 'مقالات و وبلاگ',
  catalog: 'کاتالوگ محصولات',
  orders: 'سفارش‌ها',
  inquiries: 'استعلام‌ها',
  plans: 'پلن‌ها و اشتراک',
  profile: 'پروفایل',
  settings: 'تنظیمات',
  support: 'پشتیبانی',
}

const NAV_ITEMS: { id: View; label: string; icon: string; badge?: 'orders' | 'inquiries' }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '▦' },
  { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
  { id: 'catalog', label: 'کاتالوگ', icon: '◫' },
  { id: 'orders', label: 'سفارش‌ها', icon: '◈', badge: 'orders' },
  { id: 'inquiries', label: 'استعلام‌ها', icon: '◎', badge: 'inquiries' },
  { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
  { id: 'profile', label: 'پروفایل', icon: '🪪' },
  { id: 'support', label: 'پشتیبانی', icon: '🛟' },
]
function StatusPill({ st }: { st: OrderStatus }) {
  const c = STATUS_COLOR[st]
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: c, background: `color-mix(in srgb, ${c} 16%, transparent)`, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>
      {STATUS_LABEL[st]}
    </span>
  )
}

// ════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════
export default function MaterialsPage() {
  const [view, setView] = useState<View>('dashboard')
  // ابزارهای جاسازی‌شده: وقتی مقدار دارند، محتوای آن ابزار در همین پنل نمایش داده می‌شود
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
  const [data, setData] = useState<MaterialsData | null>(null)
  const [myName, setMyName] = useState('')
  const [hasCatalog, setHasCatalog] = useState(false)   // دسترسیِ کاتالوگ/اسکرپِ هایپرساز
  const [loading, setLoading] = useState(true)
  const [unauth, setUnauth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/materials')
      if (r.status === 401) { setUnauth(true); setLoading(false); return }
      const d = await r.json().catch(() => null)
      // فاز ۵۵: جوابِ غیرموفق (مثلاً 403ِ گیتِ پلن) داده نیست — PlanLock سراسری قفل را نشان می‌دهد؛ کرش نکن
      if (!r.ok || !d || d.error) { return }
      setData(d); setUnauth(false)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { fetch('/api/auth/profile', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d?.account?.name) setMyName(d.account.name); setHasCatalog(!!(d?.account?.caps || []).includes('catalog')) }).catch(() => {}) }, [])

  // POST mutation then refetch
  const post = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    try {
      const r = await fetch('/api/materials', {
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

  // ── Loading / 401 states ──
  if (loading) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 15 }}>
        در حال بارگذاری داشبورد فروش…
      </div>
    )
  }
  if (unauth || !data) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ ...card, padding: '40px 44px', textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>برای دسترسی به پنل وارد شوید</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>داشبورد بازار مصالح فقط برای کاربران واردشده در دسترس است.</div>
          <a href="/auth" style={{
            display: 'inline-block', padding: '10px 28px', borderRadius: 10,
            background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f',
            fontWeight: 700, fontSize: 14, textDecoration: 'none',
          }}>ورود به حساب</a>
        </div>
      </div>
    )
  }

  const { stats, products, orders, inquiries } = data

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>

      {/* OVERLAY موبایل (پشتِ کشو) */}
      <div className={`mjm-overlay${navOpen ? ' mjm-open' : ''}`} onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 125 }} />

      {/* ════════════ SIDEBAR ════════════ */}
      <aside className={`mjm-side${navOpen ? ' mjm-open' : ''}`} style={{
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
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>بازار مصالح</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = view === item.id && !crmView && !mktView && !wfView && !wbView
            const badge = item.badge === 'orders' ? stats.kpis.activeOrders
              : item.badge === 'inquiries' ? stats.kpis.newInquiries : 0
            return (
              <button key={item.id} onClick={() => goView(item.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                border: 'none', cursor: 'pointer', background: active ? 'var(--goldDim)' : 'transparent',
                color: active ? 'var(--gold)' : 'var(--muted)', fontWeight: active ? 700 : 500, fontSize: 14,
                textAlign: 'right', marginBottom: 2, fontFamily: FONT, transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                <span className="mjm-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badge > 0 && (
                  <span style={{ background: active ? 'var(--gold)' : 'var(--line2)', color: active ? '#16140f' : 'var(--text)', borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{fa(badge)}</span>
                )}
              </button>
            )
          })}
          {hasCatalog && (
            <a href="/catalog-admin" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
              textDecoration: 'none', background: 'transparent', color: 'var(--gold)', fontWeight: 600, fontSize: 14,
              fontFamily: FONT, boxSizing: 'border-box',
            }}>
              <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>🧱</span>
              <span className="mjm-sidelabel" style={{ flex: 1 }}>کاتالوگ و اسکرپِ مصالح</span>
              <span style={{ fontSize: 9, background: 'var(--gold)', color: '#16140f', borderRadius: 6, padding: '1px 6px', fontWeight: 800 }}>ویژه</span>
            </a>
          )}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />

          {/* CRM — جاسازی‌شده با منوی آبشاری (داخل همین پنل باز می‌شود) */}
          <button onClick={() => { setCrmOpen(o => !o); if (!crmView) openCrm('dashboard') }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
            border: 'none', cursor: 'pointer', background: crmView ? 'var(--goldDim)' : 'transparent',
            color: crmView ? 'var(--gold)' : 'var(--muted)', fontWeight: crmView ? 700 : 500, fontSize: 14,
            textAlign: 'right', marginBottom: 2, fontFamily: FONT,
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: crmView ? 1 : 0.7 }}>◇</span>
            <span className="mjm-sidelabel" style={{ flex: 1 }}>CRM و مشتریان</span>
            <span className="mjm-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: crmOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {crmOpen && CRM_VIEWS.map(cv => {
            const on = crmView === cv.id
            return (
              <button key={cv.id} onClick={() => openCrm(cv.id)} className="mjm-sidelabel" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10,
                border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13,
                textAlign: 'right', marginBottom: 2, fontFamily: FONT,
              }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{cv.icon}</span>
                <span style={{ flex: 1 }}>{cv.label}</span>
              </button>
            )
          })}

          {/* مارکتینگ — جاسازی‌شده با منوی آبشاری */}
          <button onClick={() => { setMktOpen(o => !o); if (!mktView) openMkt('overview') }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
            border: 'none', cursor: 'pointer', background: mktView ? 'var(--goldDim)' : 'transparent',
            color: mktView ? 'var(--gold)' : 'var(--muted)', fontWeight: mktView ? 700 : 500, fontSize: 14,
            textAlign: 'right', marginBottom: 2, fontFamily: FONT,
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: mktView ? 1 : 0.7 }}>◈</span>
            <span className="mjm-sidelabel" style={{ flex: 1 }}>مارکتینگ</span>
            <span className="mjm-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: mktOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {mktOpen && MARKETING_VIEWS.map(mv => {
            const on = mktView === mv.id
            return (
              <button key={mv.id} onClick={() => openMkt(mv.id)} className="mjm-sidelabel" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10,
                border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13,
                textAlign: 'right', marginBottom: 2, fontFamily: FONT,
              }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{mv.icon}</span>
                <span style={{ flex: 1 }}>{mv.label}</span>
              </button>
            )
          })}

          {/* اتوماسیون — منوی آبشاری، داخل همین پنل */}
          <button onClick={() => { setWfOpen(o => !o); if (!wfView) openWf(WORKFLOW_VIEWS[0].id) }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
            border: 'none', cursor: 'pointer', background: wfView ? 'var(--goldDim)' : 'transparent',
            color: wfView ? 'var(--gold)' : 'var(--muted)', fontWeight: wfView ? 700 : 500, fontSize: 14,
            textAlign: 'right', marginBottom: 2, fontFamily: FONT,
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: wfView ? 1 : 0.7 }}>⛭</span>
            <span className="mjm-sidelabel" style={{ flex: 1 }}>اتوماسیون</span>
            <span className="mjm-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: wfOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {wfOpen && WORKFLOW_VIEWS.map(v => {
            const on = wfView === v.id
            return (
              <button key={v.id} onClick={() => openWf(v.id)} className="mjm-sidelabel" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10,
                border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13,
                textAlign: 'right', marginBottom: 2, fontFamily: FONT,
              }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{v.icon}</span>
                <span style={{ flex: 1 }}>{v.label}</span>
              </button>
            )
          })}

          {/* وب‌سایت‌ساز — منوی آبشاری، داخل همین پنل */}
          <button onClick={() => { setWbOpen(o => !o); if (!wbView) openWb(WEBSITE_VIEWS[0].id) }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
            border: 'none', cursor: 'pointer', background: wbView ? 'var(--goldDim)' : 'transparent',
            color: wbView ? 'var(--gold)' : 'var(--muted)', fontWeight: wbView ? 700 : 500, fontSize: 14,
            textAlign: 'right', marginBottom: 2, fontFamily: FONT,
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: wbView ? 1 : 0.7 }}>◳</span>
            <span className="mjm-sidelabel" style={{ flex: 1 }}>وب‌سایت‌ساز</span>
            <span className="mjm-sidelabel" style={{ fontSize: 11, transition: 'transform .2s', transform: wbOpen ? 'rotate(90deg)' : 'none' }}>‹</span>
          </button>
          {wbOpen && WEBSITE_VIEWS.map(v => {
            const on = wbView === v.id
            return (
              <button key={v.id} onClick={() => openWb(v.id)} className="mjm-sidelabel" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10,
                border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent',
                color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 13,
                textAlign: 'right', marginBottom: 2, fontFamily: FONT,
              }}>
                <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: on ? 1 : 0.6 }}>{v.icon}</span>
                <span style={{ flex: 1 }}>{v.label}</span>
              </button>
            )
          })}

          <button onClick={() => goView('settings')} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
            border: 'none', cursor: 'pointer', background: view === 'settings' && !crmView && !mktView && !wfView && !wbView ? 'var(--goldDim)' : 'transparent',
            color: view === 'settings' && !crmView && !mktView && !wfView && !wbView ? 'var(--gold)' : 'var(--muted)', fontWeight: view === 'settings' && !crmView && !mktView && !wfView && !wbView ? 700 : 500,
            fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT,
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: 0.7 }}>⛭</span>
            <span className="mjm-sidelabel" style={{ flex: 1 }}>تنظیمات</span>
          </button>
        </nav>

        {/* Active shop card */}
        <div style={{ margin: '0 12px 10px', padding: 13, borderRadius: 14, background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,0.2)' }}>
          <div className="mjm-sidelabel" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>فروشگاه فعال</span>
          </div>
          <div className="mjm-sidelabel" style={{ fontSize: 12, color: 'var(--muted)' }}>
            امتیاز تأمین‌کننده: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{stats.profile.rating > 0 ? `${fa(stats.profile.rating)} ★` : 'بدون امتیاز'}</span>
          </div>
        </div>

        {/* Supplier identity */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#16140f', flexShrink: 0,
          }}>{stats.profile.name.trim().charAt(0) || 'ف'}</div>
          <div className="mjm-sidelabel" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.profile.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>تأمین‌کننده</div>
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
          <button className="mjm-burger" aria-label="منو" onClick={() => setNavOpen(true)} style={{ width: 42, height: 42, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--gold)', fontSize: 20, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: FONT }}>☰</button>
          <h2 style={{ fontSize: 17, fontWeight: 700, flexShrink: 0 }}>{crmView ? `CRM · ${CRM_VIEWS.find(v => v.id === crmView)?.label || ''}` : mktView ? `مارکتینگ · ${MARKETING_VIEWS.find(v => v.id === mktView)?.label || ''}` : wfView ? `اتوماسیون · ${WORKFLOW_VIEWS.find(v => v.id === wfView)?.label || ''}` : wbView ? `وب‌سایت‌ساز · ${WEBSITE_VIEWS.find(v => v.id === wbView)?.label || ''}` : VIEW_TITLES[view]}</h2>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="جستجوی محصول، سفارش..."
            className="mjm-search"
            style={{ ...inputStyle, flex: 1, minWidth: 160, maxWidth: 360, marginInlineStart: 'auto' }}
          />
          <button onClick={() => { setView('catalog'); setShowAdd(true) }} style={{
            padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
            color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap', flexShrink: 0,
          }}>+ محصول جدید</button>
        </div>

        {/* Content */}
        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {crmView ? <CrmTool embedded view={crmView} onView={v => setCrmView(v)} />
            : mktView === 'articles' ? <ArticleEditor compact author={myName || undefined} />
            : mktView ? <MarketingTool embedded view={mktView} onView={v => setMktView(v)} />
            : wfView ? <div style={{ height: 'calc(100vh - 130px)' }}><WorkflowTool embedded view={wfView} onView={v => setWfView(v)} /></div>
            : wbView ? <div style={{ height: 'calc(100vh - 130px)' }}><WebsiteBuilderTool embedded profile="فروشگاه" view={wbView} onView={v => setWbView(v)} /></div>
            : <>
          {view === 'dashboard' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><EmpireCard /><DashboardView stats={stats} post={post} onAll={() => setView('orders')} /><ReosPanelSection title="املاکِ پیشنهادیِ REOS" subtitle="فرصت‌های مرتبط با بازار" /></div>}
          {view === 'assistant' && (
            <div style={{ height: 'calc(100vh - 130px)' }}>
              <AssistantPanel panel="materials" title="دستیار هوشمند فروشنده مصالح" subtitle="مشاور AI شخصیِ تو" suggestions={["قیمت‌گذاری این محصول را پیشنهاد بده", "پاسخ حرفه‌ای به استعلام مشتری بنویس", "چطور فروش این محصول را بیشتر کنم؟", "توضیحات فروش برای محصول بنویس"]} />
            </div>
          )}
          {view === 'articles' && (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.7 }}>
                مقاله‌ای که با نام شما منتشر می‌شود، در صفحهٔ مقاله به آگهی‌هایتان لینک می‌شود و می‌توانید آن را در «وبلاگ» وب‌سایت خود نمایش دهید (سئو خودکار: slug و عنوان در صورت تکراری‌بودن خودکار اصلاح می‌شوند).
              </div>
              <ArticleEditor compact author={myName || undefined} />
            </div>
          )}
          {view === 'catalog' && <CatalogView products={products} post={post} busy={busy} search={search} showAdd={showAdd} setShowAdd={setShowAdd} storefrontUrl={stats.slug ? `/store/${stats.slug}` : ''} />}
          {view === 'orders' && <OrdersView orders={orders} products={products} post={post} busy={busy} search={search} />}
          {view === 'inquiries' && <InquiriesView inquiries={inquiries} products={products} post={post} busy={busy} search={search} />}
          {view === 'plans' && <PlansPanel dashboard="/materials" />}
          {view === 'profile' && <BusinessProfileForm />}
          {view === 'settings' && <SettingsView profile={stats.profile} post={post} busy={busy} />}
          {view === 'support' && <SupportPanel panel="materials" />}
            </>}
        </main>
      </div>

      <style>{`
        .mjm-burger{display:none}
        .mjm-overlay{display:none}
        @media(max-width:760px){
          /* کشوی موبایل: منوی کامل با برچسب از سمتِ راست بازشو */
          .mjm-side{position:fixed!important;right:0;top:0;height:100vh!important;width:82vw!important;max-width:300px;z-index:130;transform:translateX(105%);transition:transform .26s ease;box-shadow:-12px 0 40px -12px rgba(0,0,0,.6)}
          .mjm-side.mjm-open{transform:translateX(0)}
          .mjm-burger{display:inline-flex!important}
          .mjm-overlay.mjm-open{display:block}
        }
        @media(max-width:1000px){ .mjm-grid4{ grid-template-columns:repeat(2,1fr)!important } .mjm-grid2{ grid-template-columns:1fr!important } }
        @media(max-width:680px){ .mjm-grid4{ grid-template-columns:1fr!important } .mjm-form{ grid-template-columns:1fr!important } }
        @media(max-width:600px){ .mjm-search{ order:3; max-width:none!important; flex-basis:100%!important; margin:0 0 10px!important } }
      `}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════
// بنرِ ویترینِ عمومی — لینک + کپیِ آدرس برای اشتراک‌گذاری.
function StorefrontBanner({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const path = `/store/${slug}`
  const copy = () => {
    const url = (typeof window !== 'undefined' ? window.location.origin : '') + path
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }
  return (
    <div style={{ ...card, padding: 16, background: 'linear-gradient(120deg,var(--goldDim),transparent)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ fontSize: 26 }}>🏪</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>ویترینِ عمومیِ فروشگاهِ شما فعال است</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, direction: 'ltr', textAlign: 'right' }}>melkjet.com{path}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={path} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: '#16140f', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', textDecoration: 'none', borderRadius: 9, padding: '8px 16px', fontWeight: 700, fontFamily: FONT }}>مشاهدهٔ ویترین ↗</a>
        <button onClick={copy} style={{ fontSize: 12.5, color: 'var(--gold)', background: 'transparent', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 14px', cursor: 'pointer', fontFamily: FONT }}>{copied ? '✓ کپی شد' : '🔗 کپیِ لینک'}</button>
      </div>
    </div>
  )
}

function DashboardView({ stats, post, onAll }: {
  stats: Stats; post: (b: Record<string, unknown>) => Promise<boolean>; onAll: () => void
}) {
  const k = stats.kpis
  const kpis = [
    { label: 'محصولات فعال', value: fa(k.activeProducts), sub: `${fa(k.lowStockCount)} موجودی کم`, subColor: '#f59e0b' },
    { label: 'استعلام جدید', value: fa(k.newInquiries), sub: 'نیاز به پاسخ', subColor: 'var(--muted)' },
    { label: 'سفارش‌های فعال', value: fa(k.activeOrders), sub: `${fa(k.awaitingShip)} در انتظار ارسال`, subColor: 'var(--muted)' },
    { label: 'فروش این ماه', value: mt(k.thisMonthSales), sub: `${k.monthChange > 0 ? '+' : ''}${fa(k.monthChange)}٪`, subColor: k.monthChange >= 0 ? '#34d399' : '#f87171' },
  ]
  const maxSale = Math.max(1, ...stats.monthlySales.map(m => m.amount))
  const lastIdx = stats.monthlySales.length - 1

  // تحلیلِ هوشمند (پیش‌بینیِ تقاضا + پیشنهادِ قیمت)
  const [ai, setAi] = useState<any>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const runAi = async () => {
    setAiBusy(true)
    try { const r = await fetch('/api/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'aiInsights' }) }); const d = await r.json(); if (d.ok) setAi(d) } catch {} finally { setAiBusy(false) }
  }

  const restockPrompt = async (item: LowStock) => {
    const raw = window.prompt(`مقدار تأمین برای «${item.name}» (${item.unit}):`, '')
    if (raw == null) return
    const qty = Number(raw)
    if (!qty || qty <= 0) { alert('عدد معتبر وارد کنید'); return }
    await post({ action: 'restock', id: item.id, qty })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Storefront banner */}
      {stats.slug && <StorefrontBanner slug={stats.slug} />}
      {/* KPI cards */}
      <div className="mjm-grid4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {kpis.map(c => (
          <div key={c.label} style={{ ...card, padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: c.subColor, marginTop: 8, fontWeight: 600 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* تحلیلِ هوشمند — پیش‌بینیِ تقاضا + پیشنهادِ قیمت */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>✦ تحلیلِ هوشمندِ فروش</div>
          <button disabled={aiBusy} onClick={runAi} style={{ marginInlineStart: 'auto', padding: '8px 16px', borderRadius: 10, border: '1px solid var(--gold)', background: 'var(--goldDim)', color: 'var(--gold)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{aiBusy ? '…' : (ai ? 'به‌روزرسانی' : 'تحلیل کن')}</button>
        </div>
        {ai ? <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px', background: 'var(--bg2)', borderRadius: 12, padding: 14 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>پیش‌بینیِ فروشِ ماهِ آینده</div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)', marginTop: 4 }}>{mt(ai.forecast.nextMonth)}</div><div style={{ fontSize: 11, color: ai.forecast.trendPct >= 0 ? '#34d399' : '#f87171', marginTop: 3 }}>روند {ai.forecast.trendPct >= 0 ? '+' : ''}{fa(ai.forecast.trendPct)}٪</div></div>
            <div style={{ flex: '1 1 160px', background: 'var(--bg2)', borderRadius: 12, padding: 14 }}><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>نیازمندِ تأمین</div><div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{fa(ai.forecast.restock.length)} محصول</div><div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{ai.forecast.restock.slice(0, 2).map((r: any) => r.name).join('، ') || '—'}</div></div>
          </div>
          {ai.prices?.length > 0 && (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>پیشنهادِ قیمت (نسبت به میانگینِ دسته)</div>
              {ai.prices.slice(0, 5).map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ marginInlineStart: 'auto', color: 'var(--muted)' }}>{mt(p.price)}</span>
                  <span style={{ color: p.delta > 0 ? '#f87171' : '#34d399', fontWeight: 700, minWidth: 44, textAlign: 'left' }}>{p.delta > 0 ? '+' : ''}{fa(p.delta)}٪</span>
                </div>
              ))}
            </div>
          )}
          {ai.advice && <div style={{ background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 10, padding: 12, fontSize: 12.5, lineHeight: 2 }}>{ai.advice}</div>}
        </div> : <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>پیش‌بینیِ تقاضا، محصولاتِ نیازمندِ تأمین و پیشنهادِ قیمت — دکمهٔ «تحلیل کن» را بزن.</div>}
      </div>

      {/* Categories + 6-month chart */}
      <div className="mjm-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Top categories */}
        <div style={{ ...card, padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>دسته‌های پرفروش</h3>
          {stats.categories.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>داده‌ای نیست</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {stats.categories.map(c => (
                <div key={c.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>{c.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>{fa(c.pct)}٪</span>
                  </div>
                  <div style={{ height: 7, background: 'var(--line2)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.pct}%`, background: 'linear-gradient(90deg,var(--gold2),var(--gold))', borderRadius: 5, transition: 'width 0.6s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6-month sales */}
        <div style={{ ...card, padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>فروش ۶ ماهه</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{mt(stats.sixMonthTotal)}</span>
            <span style={{ fontSize: 13, color: k.monthChange >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
              {k.monthChange > 0 ? '+' : ''}{fa(k.monthChange)}٪ این ماه
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 120 }}>
            {stats.monthlySales.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{
                  width: '100%', minHeight: 6, height: `${(m.amount / maxSale) * 100}%`,
                  background: i === lastIdx ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : 'linear-gradient(180deg,rgba(201,168,76,0.45),rgba(201,168,76,0.2))',
                  borderRadius: '5px 5px 0 0',
                }} />
                <span style={{ fontSize: 10, color: i === lastIdx ? 'var(--gold)' : 'var(--muted)', fontWeight: i === lastIdx ? 700 : 500 }}>{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent orders + low stock */}
      <div className="mjm-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent orders */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>سفارش‌های اخیر</span>
            <button onClick={onAll} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>همه ←</button>
          </div>
          {stats.recentOrders.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>سفارشی ثبت نشده است</div>
          ) : stats.recentOrders.map((o, i) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: i < stats.recentOrders.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.customer}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>#{o.id} · {fa(o.items)} قلم</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{mt(o.amount)}</div>
              <StatusPill st={o.status} />
            </div>
          ))}
        </div>

        {/* Low stock alert */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', fontSize: 15, fontWeight: 700, color: '#f87171' }}>
            ⚠ هشدار موجودی کم
          </div>
          {stats.lowStock.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>موجودی همهٔ محصولات کافی است</div>
          ) : stats.lowStock.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: i < stats.lowStock.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>فقط {fa(item.stock)} {item.unit} باقی مانده</div>
              </div>
              <button onClick={() => restockPrompt(item)} style={{
                padding: '6px 16px', borderRadius: 8, border: '1px solid var(--gold)', background: 'var(--goldDim)',
                color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
              }}>تأمین</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  CATALOG
// ════════════════════════════════════════════════════════
function CatalogView({ products, post, busy, search, showAdd, setShowAdd, storefrontUrl }: {
  products: Product[]; post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean
  search: string; showAdd: boolean; setShowAdd: (v: boolean) => void; storefrontUrl: string
}) {
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  // دکمهٔ «+ محصول» در نوارِ بالای پنل هم editor را باز می‌کند.
  useEffect(() => { if (showAdd) { setEditing('new'); setShowAdd(false) } }, [showAdd, setShowAdd])

  const q = search.trim()
  const filtered = q ? products.filter(p => p.name.includes(q) || p.category.includes(q) || (p.brand || '').includes(q)) : products

  const restockProduct = async (p: Product) => {
    const raw = window.prompt(`مقدار تأمین برای «${p.name}» (${p.unit}):`, '')
    if (raw == null) return
    const qty = Number(raw)
    if (!qty || qty <= 0) { alert('عدد معتبر وارد کنید'); return }
    await post({ action: 'restock', id: p.id, qty })
  }
  const removeProduct = async (p: Product) => {
    if (!window.confirm(`حذف «${p.name}»؟`)) return
    await post({ action: 'deleteProduct', id: p.id })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {storefrontUrl
          ? <a href={storefrontUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 14px' }}>🏪 مشاهدهٔ ویترینِ عمومی ↗</a>
          : <span />}
        <button onClick={() => setEditing('new')} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>+ محصول جدید</button>
      </div>

      {/* Products table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="mjm-prow" style={{ display: 'grid', gridTemplateColumns: '2.3fr 1.1fr 1.3fr 0.9fr 0.7fr 0.7fr 1.4fr', padding: '12px 18px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          <div>محصول</div><div>دسته</div><div>قیمت</div><div>موجودی</div><div>فروخته</div><div>فعال</div><div style={{ textAlign: 'left' }}>عملیات</div>
        </div>
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>محصولی نیست — «+ محصول جدید» را بزنید.</div>
          ) : filtered.map((p, i) => {
            const low = p.stock <= p.threshold
            const disc = (p.discountPct || 0) > 0
            return (
              <div key={p.id} className="mjm-prow" style={{ display: 'grid', gridTemplateColumns: '2.3fr 1.1fr 1.3fr 0.9fr 0.7fr 0.7fr 1.4fr', padding: '12px 18px', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 8, flexShrink: 0, background: p.images?.[0] ? `center/cover no-repeat url(${p.images[0]})` : 'var(--bg2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{!p.images?.[0] && '🧱'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.featured && <span title="ویژه" style={{ color: 'var(--gold)' }}>★</span>}{p.name}
                    </div>
                    {p.brand && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.brand}</div>}
                  </div>
                </div>
                <div style={{ color: 'var(--muted)' }}>{p.category}</div>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fa(p.price)} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>ت/{p.unit}</span>{disc && <span style={{ color: '#e7674a', fontSize: 11, marginInlineStart: 4 }}>٪{fa(p.discountPct!)}</span>}</div>
                <div style={{ fontWeight: 700, color: low ? '#f87171' : 'var(--text)' }}>{fa(p.stock)} {p.unit}</div>
                <div style={{ color: 'var(--muted)' }}>{fa(p.sold)}</div>
                <div>
                  <button onClick={() => post({ action: 'updateProduct', id: p.id, patch: { active: !p.active } })} disabled={busy} style={{ width: 40, height: 22, borderRadius: 99, border: 'none', cursor: busy ? 'default' : 'pointer', position: 'relative', background: p.active ? 'var(--gold)' : 'var(--line2)', transition: 'background 0.2s', padding: 0 }}>
                    <span style={{ position: 'absolute', top: 2, insetInlineStart: p.active ? 2 : 20, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start 0.2s' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditing(p)} disabled={busy} style={actionBtn}>ویرایش</button>
                  <button onClick={() => restockProduct(p)} disabled={busy} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>تأمین</button>
                  <button onClick={() => removeProduct(p)} disabled={busy} title="حذف" style={{ ...actionBtn, color: '#f87171', borderColor: 'var(--line)', width: 28, padding: 0 }}>×</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editing && <ProductEditor product={editing === 'new' ? null : editing} post={post} onClose={() => setEditing(null)} />}
    </div>
  )
}

// ── ویرایشگرِ کاملِ محصول (با آپلودِ گالری، مشخصاتِ فنی، و دستیارِ هوش مصنوعی) ──
function ProductEditor({ product, post, onClose }: { product: Product | null; post: (b: Record<string, unknown>) => Promise<boolean>; onClose: () => void }) {
  const [f, setF] = useState({
    name: product?.name || '', category: product?.category || CATEGORY_OPTIONS[0], unit: product?.unit || UNIT_OPTIONS[0],
    price: product ? String(product.price) : '', stock: product ? String(product.stock) : '', threshold: product?.threshold != null ? String(product.threshold) : '',
    brand: product?.brand || '', origin: product?.origin || '', description: product?.description || '',
    minOrder: product?.minOrder != null ? String(product.minOrder) : '', discountPct: product?.discountPct != null ? String(product.discountPct) : '',
    deliveryDays: product?.deliveryDays != null ? String(product.deliveryDays) : '', warranty: product?.warranty || '',
    featured: !!product?.featured, active: product ? product.active : true,
  })
  const [images, setImages] = useState<string[]>(product?.images || [])
  const [specs, setSpecs] = useState<ProductSpec[]>(product?.specs && product.specs.length ? product.specs : [{ key: '', value: '' }])
  const [tags, setTags] = useState((product?.tags || []).join('، '))
  const [saving, setSaving] = useState(false)
  const [ai, setAi] = useState<{ what: string } | null>(null)
  const [aiErr, setAiErr] = useState('')
  const set = (k: string, v: any) => setF(s => ({ ...s, [k]: v }))

  // کاتالوگِ مرجع — مصالح‌فروش از این لیست انتخاب می‌کند (اگر کالایی موجود باشد).
  const [catalog, setCatalog] = useState<{ categories: { id: string; name: string; parentId?: string }[]; products: any[] } | null>(null)
  const [catalogId, setCatalogId] = useState(product?.catalogId || '')
  const [picking, setPicking] = useState(false)
  const [pickSearch, setPickSearch] = useState('')
  const [catStack, setCatStack] = useState<{ id: string; name: string }[]>([])   // مسیرِ دسته (درخت)
  const locked = !!catalogId
  useEffect(() => {
    if (product) return   // ویرایشِ محصولِ موجود: پیکر لازم نیست
    fetch('/api/catalog').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.ok) { setCatalog({ categories: d.categories || [], products: d.products || [] }); if ((d.products || []).length) setPicking(true) }
    }).catch(() => {})
  }, [product])
  const pickProduct = (cp: any) => {
    setCatalogId(cp.id)
    setF(s => ({ ...s, name: cp.name || '', category: (catalog?.categories.find(c => c.id === cp.categoryId)?.name) || s.category, unit: cp.unit || s.unit, brand: cp.brand || '', description: cp.description || '' }))
    if (cp.image) setImages(im => im.length ? im : [cp.image])
    if (Array.isArray(cp.specs) && cp.specs.length) setSpecs(cp.specs)
    if (Array.isArray(cp.tags) && cp.tags.length) setTags(cp.tags.join('، '))
    setPicking(false)
  }

  const aiCall = async (action: 'describe' | 'specs' | 'tags' | 'price') => {
    if (!f.name.trim()) { setAiErr('ابتدا نامِ محصول را وارد کنید'); return }
    setAi({ what: action }); setAiErr('')
    try {
      const r = await fetch('/api/materials/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, name: f.name, category: f.category, brand: f.brand, origin: f.origin, unit: f.unit, specs: specs.filter(s => s.key && s.value) }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) { setAiErr(d.error || 'خطا در دستیار'); return }
      if (action === 'describe' && d.description) set('description', d.description)
      if (action === 'specs' && Array.isArray(d.specs)) setSpecs(d.specs.length ? d.specs : specs)
      if (action === 'tags' && Array.isArray(d.tags)) setTags(d.tags.join('، '))
      if (action === 'price' && (d.min || d.max)) { set('price', String(Math.round((d.min + d.max) / 2 || d.max || d.min))); setAiErr(`پیشنهادِ بازار: ${d.min.toLocaleString('fa-IR')} تا ${d.max.toLocaleString('fa-IR')} تومان${d.note ? ` — ${d.note}` : ''}`) }
    } catch { setAiErr('خطا در ارتباط با دستیار') } finally { setAi(null) }
  }

  const save = async () => {
    if (!f.name.trim()) { alert('نامِ محصول الزامی است'); return }
    setSaving(true)
    const patch: Record<string, unknown> = {
      name: f.name.trim(), category: f.category, unit: f.unit,
      price: Number(f.price) || 0, stock: Number(f.stock) || 0,
      brand: f.brand.trim(), origin: f.origin.trim(), description: f.description.trim(),
      warranty: f.warranty.trim(), minOrder: Number(f.minOrder) || 0, discountPct: Number(f.discountPct) || 0,
      deliveryDays: Number(f.deliveryDays) || 0, featured: f.featured, active: f.active,
      images: images.filter(Boolean),
      specs: specs.filter(s => s.key.trim() && s.value.trim()),
      tags: tags.split(/[،,\n]+/).map(t => t.trim()).filter(Boolean),
    }
    if (f.threshold.trim() !== '') patch.threshold = Number(f.threshold) || 0
    if (catalogId) patch.catalogId = catalogId
    const ok = product
      ? await post({ action: 'updateProduct', id: product.id, patch })
      : await post({ action: 'addProduct', ...patch })
    setSaving(false)
    if (ok) onClose()
  }

  const aiBtn = (action: 'describe' | 'specs' | 'tags' | 'price', label: string) => (
    <button type="button" onClick={() => aiCall(action)} disabled={!!ai} style={{ fontSize: 11.5, color: 'var(--gold)', border: '1px solid var(--gold)', background: 'transparent', borderRadius: 8, padding: '4px 10px', cursor: ai ? 'default' : 'pointer', fontFamily: FONT, opacity: ai ? 0.6 : 1, whiteSpace: 'nowrap' }}>{ai?.what === action ? '⏳ …' : `✦ ${label}`}</button>
  )
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 5, display: 'block' }

  // ── ویزاردِ انتخاب از کاتالوگ: مرحله‌به‌مرحله مثلِ ثبتِ آگهی (اول دسته، بعد کالا) ──
  if (picking && catalog) {
    const cats = catalog.categories
    const q = pickSearch.trim()
    const parentId = catStack.length ? catStack[catStack.length - 1].id : ''
    const childCats = cats.filter(c => (c.parentId || '') === parentId)
    const catProdCount = (id: string) => { const ids = new Set([id]); let g = true; while (g) { g = false; for (const c of cats) if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); g = true } } return catalog.products.filter((p: any) => ids.has(p.categoryId)).length }
    // اگر جستجو فعال است → مستقیم محصولات؛ وگرنه اگر دستهٔ فعلی زیردسته دارد → انتخابِ دسته؛ وگرنه → محصولاتِ همان دسته
    const searching = !!q
    const showProducts = searching || (parentId && childCats.length === 0)
    const descIds = (() => { const ids = new Set([parentId].filter(Boolean)); let g = true; while (g) { g = false; for (const c of cats) if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); g = true } } return ids })()
    const prods = catalog.products.filter((p: any) => (searching ? true : (parentId ? descIds.has(p.categoryId) : false)) && (!q || (p.name || '').includes(q) || (p.brand || '').includes(q)))
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(3px)' }}>
        <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 760, width: '100%', margin: '20px 0', padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>افزودنِ محصول — {searching ? 'نتیجهٔ جستجو' : showProducts ? 'انتخابِ کالا' : 'انتخابِ دسته‌بندی'}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          {/* breadcrumb + back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, flexWrap: 'wrap' }}>
            <button onClick={() => { setCatStack([]); setPickSearch('') }} style={{ background: 'none', border: 'none', color: catStack.length ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, padding: 0 }}>دسته‌بندی‌ها</button>
            {catStack.map((c, i) => <span key={c.id} style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--faint)' }}>›</span><button onClick={() => setCatStack(catStack.slice(0, i + 1))} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, padding: 0 }}>{c.name}</button></span>)}
          </div>
          <input placeholder="🔍 جستجوی مستقیمِ کالا (در همهٔ دسته‌ها)…" value={pickSearch} onChange={e => setPickSearch(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

          {!showProducts ? (
            /* مرحلهٔ ۱: انتخابِ دسته (کارت‌های بزرگ، نه دیوارِ چیپ) */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
              {childCats.length === 0 ? <div style={{ gridColumn: '1/-1', padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>دسته‌ای نیست.</div> : childCats.map(c => {
                const hasKids = cats.some(x => x.parentId === c.id)
                return (
                  <button key={c.id} onClick={() => setCatStack([...catStack, { id: c.id, name: c.name }])} style={{ ...card, padding: '16px 14px', textAlign: 'right', cursor: 'pointer', fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 22 }}>{hasKids ? '📂' : '📦'}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{catProdCount(c.id).toLocaleString('fa-IR')} کالا{hasKids ? ' · زیردسته دارد' : ''}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            /* مرحلهٔ ۲: انتخابِ کالا از دستهٔ انتخاب‌شده */
            prods.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>کالایی در این دسته یافت نشد.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
                {prods.slice(0, 200).map((cp: any) => (
                  <button key={cp.id} onClick={() => pickProduct(cp)} style={{ ...card, padding: 0, overflow: 'hidden', textAlign: 'right', cursor: 'pointer', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
                    <div style={{ height: 110, background: cp.image ? `center/contain no-repeat url(${cp.image}) var(--bg2)` : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{!cp.image && '🧱'}</div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{cp.name}</div>
                      {cp.brand && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{cp.brand}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 780, width: '100%', margin: '20px 0', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{product ? 'ویرایشِ محصول' : 'محصولِ جدید'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {locked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>🧱</span>
            <div style={{ flex: 1, fontSize: 12.5 }}>کالا از کاتالوگِ مرجع انتخاب شده: <b>{f.name}</b>. نام و مشخصاتِ پایه قفل است؛ فقط قیمت/موجودی/تخفیف را تنظیم کنید.</div>
            {!product && catalog && catalog.products.length > 0 && <button onClick={() => setPicking(true)} style={{ fontSize: 11.5, color: 'var(--gold)', border: '1px solid var(--gold)', background: 'transparent', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}>تغییرِ کالا</button>}
          </div>
        )}

        {/* گالریِ تصاویر */}
        <label style={lab}>تصاویرِ محصول (تا ۶ عدد)</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10, marginBottom: 18 }}>
          {images.map((im, i) => (
            <ImageUpload key={i} value={im} height={92} onChange={v => setImages(imgs => v ? imgs.map((x, j) => j === i ? v : x) : imgs.filter((_, j) => j !== i))} />
          ))}
          {images.length < 6 && <ImageUpload value="" height={92} onChange={v => { if (v) setImages(imgs => [...imgs, v]) }} />}
        </div>

        {/* فیلدهای اصلی */}
        <div className="mjm-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}><label style={lab}>نامِ محصول *</label><input value={f.name} onChange={e => set('name', e.target.value)} readOnly={locked} placeholder="مثلاً میلگرد آجدار ۱۶ ذوب‌آهن" style={{ ...inputStyle, ...(locked ? lockedStyle : {}) }} /></div>
          <div><label style={lab}>دسته</label><input value={f.category} onChange={e => set('category', e.target.value)} readOnly={locked} list="mjm-cats" style={{ ...inputStyle, ...(locked ? lockedStyle : {}) }} /><datalist id="mjm-cats">{CATEGORY_OPTIONS.map(c => <option key={c} value={c} />)}</datalist></div>
          <div><label style={lab}>واحدِ فروش</label><select value={f.unit} onChange={e => set('unit', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>{UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
          <div><label style={lab}>برند / تولیدکننده</label><input value={f.brand} onChange={e => set('brand', e.target.value)} style={inputStyle} /></div>
          <div><label style={lab}>کشور/محلِ ساخت</label><input value={f.origin} onChange={e => set('origin', e.target.value)} style={inputStyle} /></div>
          <div><label style={{ ...lab, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>قیمت (تومان/{f.unit})</span>{aiBtn('price', 'پیشنهادِ قیمت')}</label><NumberInput value={f.price} onChange={v => set('price', v)} style={inputStyle} /></div>
          <div><label style={lab}>درصدِ تخفیف</label><NumberInput value={f.discountPct} onChange={v => set('discountPct', v)} placeholder="0" style={inputStyle} /></div>
          <div><label style={lab}>موجودی ({f.unit})</label><NumberInput value={f.stock} onChange={v => set('stock', v)} style={inputStyle} /></div>
          <div><label style={lab}>حداقلِ سفارش ({f.unit})</label><NumberInput value={f.minOrder} onChange={v => set('minOrder', v)} placeholder="0" style={inputStyle} /></div>
          <div><label style={lab}>آستانهٔ هشدارِ موجودی</label><NumberInput value={f.threshold} onChange={v => set('threshold', v)} placeholder="خودکار" style={inputStyle} /></div>
          <div><label style={lab}>زمانِ تحویل (روز)</label><NumberInput value={f.deliveryDays} onChange={v => set('deliveryDays', v)} placeholder="0" style={inputStyle} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lab}>گارانتی / ضمانت</label><input value={f.warranty} onChange={e => set('warranty', e.target.value)} placeholder="مثلاً ضمانتِ اصالت و کیفیت" style={inputStyle} /></div>
        </div>

        {/* توضیحات + AI */}
        <label style={{ ...lab, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>توضیحاتِ محصول</span>{!locked && aiBtn('describe', 'نوشتن با AI')}</label>
        <textarea value={f.description} onChange={e => set('description', e.target.value)} readOnly={locked} rows={4} placeholder="کاربرد، مزیت‌ها، کیفیت و مناسب برای چه پروژه‌هایی…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.9, marginBottom: 14, ...(locked ? lockedStyle : {}) }} />

        {/* مشخصاتِ فنی + AI */}
        <label style={{ ...lab, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>مشخصاتِ فنی</span>{!locked && aiBtn('specs', 'پیشنهادِ مشخصات')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {specs.map((sp, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 8 }}>
              <input value={sp.key} onChange={e => setSpecs(ss => ss.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="عنوان (مثلاً استاندارد)" style={inputStyle} />
              <input value={sp.value} onChange={e => setSpecs(ss => ss.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="مقدار (مثلاً A3 / استاندارد ملی)" style={inputStyle} />
              <button onClick={() => setSpecs(ss => ss.length > 1 ? ss.filter((_, j) => j !== i) : [{ key: '', value: '' }])} style={{ ...actionBtn, color: '#f87171', width: 34, padding: 0 }}>×</button>
            </div>
          ))}
          <button onClick={() => setSpecs(ss => [...ss, { key: '', value: '' }])} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)', alignSelf: 'flex-start' }}>+ مشخصهٔ دیگر</button>
        </div>

        {/* برچسب‌ها + AI */}
        <label style={{ ...lab, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>برچسب‌ها (با ویرگول جدا کنید)</span>{aiBtn('tags', 'پیشنهادِ برچسب')}</label>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="میلگرد، آجدار، ذوب‌آهن، A3" style={{ ...inputStyle, marginBottom: 14 }} />

        {/* سوییچ‌ها */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={f.featured} onChange={e => set('featured', e.target.checked)} /> محصولِ ویژه در ویترین</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} /> نمایش در فروشگاه (فعال)</label>
        </div>

        {aiErr && <div style={{ fontSize: 12, color: aiErr.includes('پیشنهاد') ? 'var(--gold)' : '#f87171', marginBottom: 10 }}>{aiErr}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontSize: 13.5, cursor: 'pointer', fontFamily: FONT }}>انصراف</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 26px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: FONT }}>{saving ? 'در حال ذخیره…' : (product ? 'ذخیرهٔ تغییرات' : 'ثبتِ محصول')}</button>
        </div>
      </div>
    </div>
  )
}

const actionBtn: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)',
  color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap',
}
function pickChip(active: boolean): React.CSSProperties {
  return { padding: '6px 13px', borderRadius: 999, border: `1px solid ${active ? 'var(--gold)' : 'var(--line2)'}`, background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: FONT }
}
const lockedStyle: React.CSSProperties = { opacity: 0.7, cursor: 'not-allowed', background: 'var(--bg2)' }

// ════════════════════════════════════════════════════════
//  ORDERS
// ════════════════════════════════════════════════════════
function OrdersView({ orders, products, post, busy, search }: {
  orders: Order[]; products: Product[]; post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean; search: string
}) {
  const q = search.trim()
  const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt)
  const filtered = q ? sorted.filter(o => o.customer.includes(q) || o.id.includes(q)) : sorted

  const [showAdd, setShowAdd] = useState(false)
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState<OrderStatus>('pending')
  const [lines, setLines] = useState<{ productId: string; qty: string }[]>([{ productId: '', qty: '' }])
  const activeProducts = products.filter(p => p.active)
  const estTotal = lines.reduce((sum, ln) => { const p = products.find(x => x.id === ln.productId); return sum + (p ? p.price * (Number(ln.qty) || 0) : 0) }, 0)

  const submit = async () => {
    if (!customer.trim()) { alert('نام مشتری را وارد کنید'); return }
    const validLines = lines.filter(l => l.productId && Number(l.qty) > 0).map(l => ({ productId: l.productId, qty: Number(l.qty) }))
    if (!validLines.length) { alert('حداقل یک محصول و تعداد را انتخاب کنید'); return }
    const ok = await post({ action: 'addOrder', customer: customer.trim(), status, lines: validLines })
    if (ok) { setCustomer(''); setStatus('pending'); setLines([{ productId: '', qty: '' }]); setShowAdd(false) }
  }
  const setLine = (i: number, patch: Partial<{ productId: string; qty: string }>) => setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>{showAdd ? '× بستن' : '+ ثبت سفارش'}</button>
      </div>
      {showAdd && (
        <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>＋ ثبت سفارشِ جدید</div>
          {activeProducts.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>ابتدا در «کاتالوگ محصولات» محصول اضافه کنید تا بتوانید سفارش ثبت کنید.</div>
            : <>
              <input placeholder="نام مشتری / پیمانکار" value={customer} onChange={e => setCustomer(e.target.value)} style={inputStyle} />
              {lines.map((ln, i) => {
                const p = products.find(x => x.id === ln.productId)
                return (
                  <div key={i} className="mjm-form" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 10, alignItems: 'center' }}>
                    <select value={ln.productId} onChange={e => setLine(i, { productId: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">— انتخاب محصول —</option>
                      {activeProducts.map(pr => <option key={pr.id} value={pr.id}>{pr.name} (موجودی {fa(pr.stock)} {pr.unit})</option>)}
                    </select>
                    <NumberInput placeholder={p ? `تعداد (${p.unit})` : 'تعداد'} value={ln.qty} onChange={v => setLine(i, { qty: v })} style={inputStyle} />
                    <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 70 }}>{p && Number(ln.qty) > 0 ? mt(p.price * Number(ln.qty)) : ''}</div>
                    <button onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls)} title="حذف قلم" style={{ ...actionBtn, color: '#f87171', width: 30, padding: 0 }}>×</button>
                  </div>
                )
              })}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setLines(ls => [...ls, { productId: '', qty: '' }])} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>+ قلم دیگر</button>
                <select value={status} onChange={e => setStatus(e.target.value as OrderStatus)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                  {ORDER_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <span style={{ marginInlineStart: 'auto', fontSize: 14, fontWeight: 700 }}>جمع: {mt(estTotal)}</span>
                <button onClick={submit} disabled={busy} style={{ padding: '9px 22px', borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#16140f', fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT }}>ثبت سفارش</button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>با ثبتِ سفارش، موجودیِ محصولات کم و آمارِ فروش/دسته‌ها به‌روز می‌شود.</div>
            </>}
        </div>
      )}
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', fontSize: 15, fontWeight: 700 }}>
        لیست سفارش‌ها ({fa(filtered.length)})
      </div>
      <div className="mjm-orow" style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr 0.9fr 1fr 1.6fr', padding: '12px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
        <div>مشتری</div><div>اقلام</div><div>مبلغ</div><div>تاریخ</div><div>وضعیت</div>
      </div>
      <div style={{ maxHeight: 600, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>سفارشی یافت نشد</div>
        ) : filtered.map((o, i) => (
          <div key={o.id} className="mjm-orow" style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr 0.9fr 1fr 1.6fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{o.customer}</div>
              <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>#{o.id}</div>
            </div>
            <div style={{ color: 'var(--muted)' }}>{fa(o.items)} قلم</div>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{mt(o.amount)}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(o.createdAt).toLocaleDateString('fa-IR')}</div>
            <div>
              <select value={o.status} onChange={e => post({ action: 'setOrderStatus', id: o.id, status: e.target.value })} disabled={busy} style={{
                padding: '6px 10px', borderRadius: 8, background: 'var(--bg)', border: `1px solid ${STATUS_COLOR[o.status]}55`,
                color: STATUS_COLOR[o.status], fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', fontFamily: FONT,
              }}>
                {ORDER_STATUSES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{STATUS_LABEL[s]}</option>)}
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
//  INQUIRIES
// ════════════════════════════════════════════════════════
function InquiriesView({ inquiries, products, post, busy, search }: {
  inquiries: Inquiry[]; products: Product[]; post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean; search: string
}) {
  const q = search.trim()
  const filtered = q ? inquiries.filter(x => x.customer.includes(q) || x.product.includes(q)) : inquiries

  const answer = async (x: Inquiry) => {
    const reply = window.prompt(`پاسخ به «${x.customer}» دربارهٔ ${x.product}:`, x.reply || '')
    if (reply == null || !reply.trim()) return
    await post({ action: 'answerInquiry', id: x.id, reply: reply.trim() })
  }

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ customer: '', product: '', qty: '', note: '' })
  const submit = async () => {
    if (!form.customer.trim() || !form.product.trim()) { alert('نام مشتری و محصول الزامی است'); return }
    const ok = await post({ action: 'addInquiry', customer: form.customer.trim(), product: form.product.trim(), qty: form.qty.trim(), note: form.note.trim() || undefined })
    if (ok) { setForm({ customer: '', product: '', qty: '', note: '' }); setShowAdd(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>{showAdd ? '× بستن' : '+ ثبت استعلام'}</button>
      </div>
      {showAdd && (
        <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>＋ ثبت استعلامِ مشتری</div>
          <div className="mjm-form" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: 10 }}>
            <input placeholder="نام مشتری" value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} style={inputStyle} />
            <input placeholder="محصولِ موردنظر" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} list="mjm-prodlist" style={inputStyle} />
            <input placeholder="مقدار (مثلاً ۵۰۰ تن)" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} style={inputStyle} />
          </div>
          <datalist id="mjm-prodlist">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
          <input placeholder="توضیح (اختیاری)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={inputStyle} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={submit} disabled={busy} style={{ padding: '9px 22px', borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#16140f', fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT }}>ثبت استعلام</button>
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>استعلامی ثبت نشده است</div>
      ) : (
    <div className="mjm-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {filtered.map(x => {
        const isNew = x.status === 'new'
        return (
          <div key={x.id} style={{ ...card, padding: 18, borderColor: isNew ? 'rgba(201,168,76,0.4)' : 'var(--line)', background: isNew ? 'var(--goldDim)' : 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{x.customer}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{x.product} · {x.qty}</div>
              </div>
              {isNew
                ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 7 }}>جدید</span>
                : <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', background: 'var(--bg2)', padding: '3px 10px', borderRadius: 7 }}>پاسخ داده شد</span>}
            </div>
            {x.note && <div style={{ fontSize: 13, color: 'var(--text)', background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>{x.note}</div>}
            {x.reply
              ? <div style={{ fontSize: 13, color: '#34d399', background: 'color-mix(in srgb,#34d399 12%,transparent)', borderRadius: 8, padding: '10px 12px' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>پاسخ شما:</span>{x.reply}
                </div>
              : <button onClick={() => answer(x)} disabled={busy} style={{
                  padding: '8px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
                  color: '#16140f', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT,
                }}>پاسخ</button>}
          </div>
        )
      })}
    </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════
function SettingsView({ profile, post, busy }: {
  profile: { name: string; rating: number }; post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean
}) {
  const [name, setName] = useState(profile.name)
  useEffect(() => { setName(profile.name) }, [profile.name])

  const save = async () => {
    if (!name.trim()) { alert('نام فروشگاه را وارد کنید'); return }
    await post({ action: 'updateProfile', patch: { name: name.trim() } })
  }

  return (
    <div style={{ ...card, padding: 24, maxWidth: 520 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>تنظیمات فروشگاه</h3>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نام فروشگاه</label>
      <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>امتیاز تأمین‌کننده:</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{profile.rating > 0 ? `${fa(profile.rating)} ★` : 'بدون امتیاز'}</span>
      </div>
      <button onClick={save} disabled={busy} style={{
        padding: '10px 26px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
        color: '#16140f', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT,
      }}>ذخیره</button>
    </div>
  )
}
