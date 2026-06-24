'use client'
import { useState, useEffect, useCallback } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'
import CrmTool, { CRM_VIEWS, type CrmView } from '@/app/components/tools/CrmTool'
import MarketingTool, { MARKETING_VIEWS, type MarketingView } from '@/app/components/tools/MarketingTool'
import WorkflowTool, { WORKFLOW_VIEWS, type WorkflowView } from '@/app/components/tools/WorkflowTool'
import WebsiteBuilderTool, { WEBSITE_VIEWS, type WebsiteView } from '@/app/components/tools/WebsiteBuilderTool'

// ════════════════════════════════════════════════════════
//  Types (mirror app/lib/materials-store.ts API shape)
// ════════════════════════════════════════════════════════
type OrderStatus = 'pending' | 'preparing' | 'shipped' | 'delivered' | 'canceled'
type InquiryStatus = 'new' | 'answered'

interface Product {
  id: string; name: string; category: string; price: number; unit: string
  stock: number; threshold: number; sold: number; active: boolean; createdAt: number
}
interface Order { id: string; customer: string; items: number; amount: number; status: OrderStatus; createdAt: number }
interface Inquiry { id: string; customer: string; product: string; qty: string; note?: string; status: InquiryStatus; reply?: string; createdAt: number }
interface MonthSale { month: string; amount: number }
interface LowStock { id: string; name: string; stock: number; unit: string }
interface Category { label: string; pct: number }

interface Stats {
  profile: { name: string; rating: number }
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

type View = 'dashboard' | 'assistant' | 'catalog' | 'orders' | 'inquiries' | 'settings'

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
  catalog: 'کاتالوگ محصولات',
  orders: 'سفارش‌ها',
  inquiries: 'استعلام‌ها',
  settings: 'تنظیمات',
}

const NAV_ITEMS: { id: View; label: string; icon: string; badge?: 'orders' | 'inquiries' }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '▦' },
  { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
  { id: 'catalog', label: 'کاتالوگ', icon: '◫' },
  { id: 'orders', label: 'سفارش‌ها', icon: '◈', badge: 'orders' },
  { id: 'inquiries', label: 'استعلام‌ها', icon: '◎', badge: 'inquiries' },
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
  const clearTools = () => { setCrmView(null); setMktView(null); setWfView(null); setWbView(null) }
  const goView = (v: View) => { setView(v); clearTools() }
  const openCrm = (v: CrmView) => { clearTools(); setCrmView(v); setCrmOpen(true) }
  const openMkt = (v: MarketingView) => { clearTools(); setMktView(v); setMktOpen(true) }
  const openWf = (v: WorkflowView) => { clearTools(); setWfView(v); setWfOpen(true) }
  const openWb = (v: WebsiteView) => { clearTools(); setWbView(v); setWbOpen(true) }
  const [data, setData] = useState<MaterialsData | null>(null)
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
      const d = await r.json()
      setData(d); setUnauth(false)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

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

      {/* ════════════ SIDEBAR ════════════ */}
      <aside className="mjm-side" style={{
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
            امتیاز تأمین‌کننده: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{fa(stats.profile.rating)} ★</span>
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
            : mktView ? <MarketingTool embedded view={mktView} onView={v => setMktView(v)} />
            : wfView ? <div style={{ height: 'calc(100vh - 130px)' }}><WorkflowTool embedded view={wfView} onView={v => setWfView(v)} /></div>
            : wbView ? <div style={{ height: 'calc(100vh - 130px)' }}><WebsiteBuilderTool embedded view={wbView} onView={v => setWbView(v)} /></div>
            : <>
          {view === 'dashboard' && <DashboardView stats={stats} post={post} onAll={() => setView('orders')} />}
          {view === 'assistant' && (
            <div style={{ height: 'calc(100vh - 130px)' }}>
              <AssistantPanel panel="materials" title="دستیار هوشمند فروشنده مصالح" subtitle="مشاور AI شخصیِ تو" suggestions={["قیمت‌گذاری این محصول را پیشنهاد بده", "پاسخ حرفه‌ای به استعلام مشتری بنویس", "چطور فروش این محصول را بیشتر کنم؟", "توضیحات فروش برای محصول بنویس"]} />
            </div>
          )}
          {view === 'catalog' && <CatalogView products={products} post={post} busy={busy} search={search} showAdd={showAdd} setShowAdd={setShowAdd} />}
          {view === 'orders' && <OrdersView orders={orders} post={post} busy={busy} search={search} />}
          {view === 'inquiries' && <InquiriesView inquiries={inquiries} post={post} busy={busy} search={search} />}
          {view === 'settings' && <SettingsView profile={stats.profile} post={post} busy={busy} />}
            </>}
        </main>
      </div>

      <style>{`
        @media(max-width:820px){ .mjm-side{ width:62px!important } .mjm-sidelabel{ display:none!important } }
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

  const restockPrompt = async (item: LowStock) => {
    const raw = window.prompt(`مقدار تأمین برای «${item.name}» (${item.unit}):`, '')
    if (raw == null) return
    const qty = Number(raw)
    if (!qty || qty <= 0) { alert('عدد معتبر وارد کنید'); return }
    await post({ action: 'restock', id: item.id, qty })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
function CatalogView({ products, post, busy, search, showAdd, setShowAdd }: {
  products: Product[]; post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean
  search: string; showAdd: boolean; setShowAdd: (v: boolean) => void
}) {
  const [form, setForm] = useState({ name: '', category: CATEGORY_OPTIONS[0], price: '', unit: UNIT_OPTIONS[0], stock: '' })

  const q = search.trim()
  const filtered = q ? products.filter(p => p.name.includes(q) || p.category.includes(q)) : products

  const addProduct = async () => {
    if (!form.name.trim()) { alert('نام محصول را وارد کنید'); return }
    const ok = await post({
      action: 'addProduct', name: form.name.trim(), category: form.category,
      price: Number(form.price) || 0, unit: form.unit, stock: Number(form.stock) || 0,
    })
    if (ok) { setForm({ name: '', category: CATEGORY_OPTIONS[0], price: '', unit: UNIT_OPTIONS[0], stock: '' }); setShowAdd(false) }
  }

  const editProduct = async (p: Product) => {
    const priceRaw = window.prompt(`قیمت جدید «${p.name}» (تومان):`, String(p.price))
    if (priceRaw == null) return
    const stockRaw = window.prompt(`موجودی جدید (${p.unit}):`, String(p.stock))
    if (stockRaw == null) return
    const patch: Record<string, number> = {}
    if (priceRaw.trim() !== '') patch.price = Number(priceRaw) || 0
    if (stockRaw.trim() !== '') patch.stock = Number(stockRaw) || 0
    await post({ action: 'updateProduct', id: p.id, patch })
  }
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
      {/* Add product toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
          color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
        }}>{showAdd ? '× بستن' : '+ محصول جدید'}</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>＋ محصول جدید</div>
          <div className="mjm-form" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 1fr 0.9fr 0.9fr auto', gap: 10, alignItems: 'center' }}>
            <input placeholder="نام محصول" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="قیمت (تومان)" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={inputStyle} />
            <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input placeholder="موجودی" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} style={inputStyle} />
            <button onClick={addProduct} disabled={busy} style={{
              padding: '9px 18px', borderRadius: 9, background: 'var(--gold)', border: 'none', color: '#16140f',
              fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT, whiteSpace: 'nowrap',
            }}>افزودن</button>
          </div>
        </div>
      )}

      {/* Products table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="mjm-prow" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 1.3fr 0.9fr 0.7fr 0.7fr 1.4fr', padding: '12px 18px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          <div>نام</div><div>دسته</div><div>قیمت</div><div>موجودی</div><div>فروخته</div><div>فعال</div><div style={{ textAlign: 'left' }}>عملیات</div>
        </div>
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>محصولی یافت نشد</div>
          ) : filtered.map((p, i) => {
            const low = p.stock <= p.threshold
            return (
              <div key={p.id} className="mjm-prow" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 1.3fr 0.9fr 0.7fr 0.7fr 1.4fr', padding: '12px 18px', borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: 'var(--muted)' }}>{p.category}</div>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fa(p.price)} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>تومان/{p.unit}</span></div>
                <div style={{ fontWeight: 700, color: low ? '#f87171' : 'var(--text)' }}>{fa(p.stock)} {p.unit}</div>
                <div style={{ color: 'var(--muted)' }}>{fa(p.sold)}</div>
                <div>
                  <button onClick={() => post({ action: 'updateProduct', id: p.id, patch: { active: !p.active } })} disabled={busy} style={{
                    width: 40, height: 22, borderRadius: 99, border: 'none', cursor: busy ? 'default' : 'pointer', position: 'relative',
                    background: p.active ? 'var(--gold)' : 'var(--line2)', transition: 'background 0.2s', padding: 0,
                  }}>
                    <span style={{ position: 'absolute', top: 2, insetInlineStart: p.active ? 2 : 20, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start 0.2s' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => editProduct(p)} disabled={busy} style={actionBtn}>ویرایش</button>
                  <button onClick={() => restockProduct(p)} disabled={busy} style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'var(--gold)' }}>تأمین</button>
                  <button onClick={() => removeProduct(p)} disabled={busy} title="حذف" style={{ ...actionBtn, color: '#f87171', borderColor: 'var(--line)', width: 28, padding: 0 }}>×</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const actionBtn: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)',
  color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap',
}

// ════════════════════════════════════════════════════════
//  ORDERS
// ════════════════════════════════════════════════════════
function OrdersView({ orders, post, busy, search }: {
  orders: Order[]; post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean; search: string
}) {
  const q = search.trim()
  const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt)
  const filtered = q ? sorted.filter(o => o.customer.includes(q) || o.id.includes(q)) : sorted

  return (
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
  )
}

// ════════════════════════════════════════════════════════
//  INQUIRIES
// ════════════════════════════════════════════════════════
function InquiriesView({ inquiries, post, busy, search }: {
  inquiries: Inquiry[]; post: (b: Record<string, unknown>) => Promise<boolean>; busy: boolean; search: string
}) {
  const q = search.trim()
  const filtered = q ? inquiries.filter(x => x.customer.includes(q) || x.product.includes(q)) : inquiries

  const answer = async (x: Inquiry) => {
    const reply = window.prompt(`پاسخ به «${x.customer}» دربارهٔ ${x.product}:`, x.reply || '')
    if (reply == null || !reply.trim()) return
    await post({ action: 'answerInquiry', id: x.id, reply: reply.trim() })
  }

  if (filtered.length === 0) {
    return <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>استعلامی یافت نشد</div>
  }

  return (
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
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{fa(profile.rating)} ★</span>
      </div>
      <button onClick={save} disabled={busy} style={{
        padding: '10px 26px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
        color: '#16140f', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT,
      }}>ذخیره</button>
    </div>
  )
}
