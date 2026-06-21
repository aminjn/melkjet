'use client'
import { useState, useEffect, useCallback } from 'react'

// ════════════════════════════════════════════════════════
//  Types (mirror app/lib/buyer-store.ts API shape)
// ════════════════════════════════════════════════════════
type Deal = 'sale' | 'rent'
type ViewingStatus = 'scheduled' | 'done' | 'canceled'
type OfferStatus = 'pending' | 'accepted' | 'rejected'

interface Saved { id: string; title: string; ptype: string; location: string; area: number; rooms: number; price: number; deal: Deal; addedAt: number }
interface Search { id: string; query: string; ptype?: string; area?: string; priceMax?: number; alerts: boolean; createdAt: number }
interface Viewing { id: string; propertyTitle: string; advisor?: string; date: string; status: ViewingStatus; createdAt: number }
interface Offer { id: string; propertyTitle: string; amount: number; status: OfferStatus; createdAt: number }
interface Message { id: string; from: string; propertyTitle?: string; text: string; unread: boolean; createdAt: number }
interface ChatMsg { id: string; from: 'buyer' | 'owner'; text: string; ai?: boolean; createdAt: number }
interface Conversation { id: string; ownerName: string; propertyTitle: string; messages: ChatMsg[]; createdAt: number; updatedAt: number }
interface AiMsg { id: string; role: 'user' | 'assistant'; text: string; createdAt: number }
type VerifyStatus = 'none' | 'pending' | 'verified'
interface Profile {
  name: string; email?: string; bio?: string
  budget?: number; prefType?: string; dealType?: Deal
  rooms?: number; areaMin?: number; areaMax?: number; areas?: string
  verifyStatus?: VerifyStatus
}
interface Settings {
  notifyEmail: boolean; notifySms: boolean; notifyPush: boolean
  alertNewMatch: boolean; alertPriceDrop: boolean; alertMessages: boolean; alertViewingReminder: boolean
  showProfileToAdvisors: boolean; allowContact: boolean; weeklyDigest: boolean
  language: 'fa' | 'en'
}

interface Stats {
  profile: { name: string; budget?: number; prefType?: string; areas?: string }
  kpis: { savedCount: number; searchCount: number; upcomingViewings: number; unreadMessages: number; pendingOffers: number }
  recentSaved: Saved[]
  upcoming: Viewing[]
  recentMessages: Message[]
}
interface BuyerData { stats: Stats; profile: Profile; settings: Settings; phone: string; saved: Saved[]; searches: Search[]; viewings: Viewing[]; offers: Offer[]; messages: Message[]; conversations: Conversation[]; aiMessages: AiMsg[] }

type View = 'dashboard' | 'ai' | 'chat' | 'favorites' | 'searches' | 'viewings' | 'offers' | 'messages' | 'profile' | 'settings'

// ════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
function money(n: number): string {
  if (!n) return '—'
  if (n >= 1e9) return fa(Math.round((n / 1e9) * 10) / 10) + ' میلیارد'
  if (n >= 1e6) return fa(Math.round(n / 1e6)) + ' میلیون'
  return fa(n) + ' تومان'
}
const faDate = (ts: number) => { try { return new Date(ts).toLocaleDateString('fa-IR') } catch { return '' } }

const DEAL_LABEL: Record<Deal, string> = { sale: 'فروش', rent: 'اجاره' }
const VIEW_LABEL: Record<ViewingStatus, string> = { scheduled: 'رزرو‌شده', done: 'انجام‌شده', canceled: 'لغو' }
const VIEW_COLOR: Record<ViewingStatus, string> = { scheduled: 'var(--gold)', done: '#34d399', canceled: '#7a8fae' }
const VIEW_STATUSES: ViewingStatus[] = ['scheduled', 'done', 'canceled']
const OFFER_LABEL: Record<OfferStatus, string> = { pending: 'در انتظار', accepted: 'پذیرفته', rejected: 'رد' }
const OFFER_COLOR: Record<OfferStatus, string> = { pending: '#f59e0b', accepted: '#34d399', rejected: '#ef4444' }
const PTYPE_OPTIONS = ['آپارتمان', 'ویلا', 'زمین', 'مغازه', 'سایر']

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inputStyle: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%' }
const actionBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap' }

const VIEW_TITLES: Record<View, string> = {
  dashboard: 'پنل خریدار', ai: 'دستیار هوشمند خرید', chat: 'چت با صاحب آگهی',
  favorites: 'علاقه‌مندی‌ها', searches: 'جستجوهای ذخیره‌شده',
  viewings: 'بازدیدهای من', offers: 'پیشنهادهای من', messages: 'پیام‌ها', profile: 'پروفایل من', settings: 'تنظیمات',
}
const NAV_ITEMS: { id: View; label: string; icon: string; badge?: 'viewings' | 'offers' | 'messages'; ai?: boolean }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '▦' },
  { id: 'ai', label: 'دستیار هوشمند', icon: '✨', ai: true },
  { id: 'chat', label: 'چت با صاحب آگهی', icon: '💬' },
  { id: 'favorites', label: 'علاقه‌مندی‌ها', icon: '♥' },
  { id: 'searches', label: 'جستجوهای ذخیره‌شده', icon: '◍' },
  { id: 'viewings', label: 'بازدیدهای من', icon: '◉', badge: 'viewings' },
  { id: 'offers', label: 'پیشنهادهای من', icon: '◈', badge: 'offers' },
  { id: 'messages', label: 'پیام‌ها', icon: '✉', badge: 'messages' },
  { id: 'profile', label: 'پروفایل من', icon: '◐' },
  { id: 'settings', label: 'تنظیمات', icon: '⛭' },
]
const VERIFY_LABEL: Record<VerifyStatus, string> = { none: 'تأیید نشده', pending: 'در حال بررسی', verified: 'تأییدشده ✓' }
const VERIFY_COLOR: Record<VerifyStatus, string> = { none: '#7a8fae', pending: '#f59e0b', verified: '#34d399' }
// چیپ‌های پیشنهادیِ دستیار هوشمند
const AI_SUGGESTIONS = [
  'قیمت منصفانهٔ آپارتمان ۹۰ متری سعادت‌آباد چقدره؟',
  'با بودجه‌ام چه محله‌هایی پیشنهاد می‌دی؟',
  'برای مذاکرهٔ قیمت چه نکاتی رو رعایت کنم؟',
  'قبل از خرید چه مدارکی رو باید چک کنم؟',
  'خرید بهتره یا اجاره با شرایط من؟',
]

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
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{ width: 44, height: 25, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? 'var(--gold)' : 'var(--line2)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, width: 19, height: 19, borderRadius: '50%', background: '#fff', right: on ? 3 : 22, transition: 'right .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </button>
  )
}
function SettingRow({ title, desc, on, onChange }: { title: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
        {desc && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.6 }}>{desc}</div>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}
function PropCard({ p, onRemove }: { p: Saved; onRemove: () => void }) {
  return (
    <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
        <Pill label={DEAL_LABEL[p.deal]} color={p.deal === 'sale' ? '#60a5fa' : '#2dd4bf'} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.ptype} · {p.location}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fa(p.area)} متر{p.rooms ? ` · ${fa(p.rooms)} خواب` : ''}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 14 }}>{p.deal === 'rent' ? 'ودیعه ' : ''}{money(p.price)}</div>
        <button onClick={onRemove} style={{ ...actionBtn, color: '#ef4444', borderColor: 'color-mix(in srgb,#ef4444 30%,transparent)' }}>حذف</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════
export default function BuyerPage() {
  const [view, setView] = useState<View>('dashboard')
  const [data, setData] = useState<BuyerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauth, setUnauth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [search, setSearch] = useState('')

  const [newSearch, setNewSearch] = useState({ query: '', ptype: '', area: '', priceMax: '', alerts: true })
  const [newViewing, setNewViewing] = useState({ propertyTitle: '', advisor: '', date: '' })
  const [newOffer, setNewOffer] = useState({ propertyTitle: '', amount: '' })
  const [prof, setProf] = useState({ name: '', email: '', bio: '', budget: '', prefType: '', dealType: 'sale' as Deal, rooms: '', areaMin: '', areaMax: '', areas: '' })

  // دستیار هوشمند
  const [aiInput, setAiInput] = useState('')
  const [aiSending, setAiSending] = useState(false)
  // چت با صاحب آگهی
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [drafting, setDrafting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/buyer')
      if (r.status === 401) { setUnauth(true); setLoading(false); return }
      const d = await r.json()
      setData(d); setUnauth(false)
      const p = d.profile || d.stats.profile || {}
      setProf({ name: p.name || '', email: p.email || '', bio: p.bio || '', budget: String(p.budget || ''), prefType: p.prefType || '', dealType: p.dealType === 'rent' ? 'rent' : 'sale', rooms: String(p.rooms || ''), areaMin: String(p.areaMin || ''), areaMax: String(p.areaMax || ''), areas: p.areas || '' })
    } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const post = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    try {
      const r = await fetch('/api/buyer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'برای انجام این عملیات وارد شوید'); return false }
      await refresh(); return true
    } catch { return false } finally { setBusy(false) }
  }, [refresh])

  const toggleTheme = () => {
    const html = document.documentElement
    if (theme === 'dark') { html.classList.add('light'); setTheme('light') } else { html.classList.remove('light'); setTheme('dark') }
  }

  // ── دستیار هوشمند ──
  const askAi = async (text: string) => {
    const t = text.trim(); if (!t || aiSending) return
    setAiInput(''); setAiSending(true)
    try {
      const r = await fetch('/api/buyer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'aiAsk', text: t }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'خطا'); return }
      await refresh()
    } catch { alert('اتصال برقرار نشد') } finally { setAiSending(false) }
  }
  const clearAi = async () => { if (!confirm('گفتگوی دستیار پاک شود؟')) return; await post({ action: 'aiClear' }) }

  // ── تنظیمات ──
  const setSetting = async (key: string, value: boolean | string) => {
    setData(d => d ? { ...d, settings: { ...d.settings, [key]: value } as Settings } : d) // optimistic
    await fetch('/api/buyer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateSettings', patch: { [key]: value } }) }).catch(() => {})
  }
  const requestVerify = async () => { await post({ action: 'requestVerification' }) }
  const logout = async () => {
    if (!confirm('از حساب خارج می‌شوید؟')) return
    try { localStorage.removeItem('mj_token') } catch {}
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/'
  }

  // ── چت با صاحب آگهی ──
  const sendChat = async () => {
    const t = chatInput.trim(); if (!t || !activeConv || chatSending) return
    setChatInput(''); setChatSending(true)
    try {
      const r = await fetch('/api/buyer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendChat', id: activeConv, text: t }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'خطا'); return }
      await refresh()
    } catch { alert('اتصال برقرار نشد') } finally { setChatSending(false) }
  }
  const draftReply = async () => {
    if (drafting) return
    setDrafting(true)
    try {
      const title = data?.conversations.find(c => c.id === activeConv)?.propertyTitle || 'این ملک'
      const r = await fetch('/api/buyer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'aiDraft', propertyTitle: title }) })
      const d = await r.json().catch(() => ({}))
      if (d.draft) setChatInput(d.draft)
    } catch {} finally { setDrafting(false) }
  }

  if (loading) return <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 15 }}>در حال بارگذاری پنل خریدار…</div>
  if (unauth || !data) return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ ...card, padding: '40px 44px', textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>برای دسترسی به پنل خریدار وارد شوید</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>این پنل فقط برای کاربران واردشده در دسترس است.</div>
        <a href="/auth" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>ورود به حساب</a>
      </div>
    </div>
  )

  const { stats, saved, searches, viewings, offers, messages, conversations, aiMessages } = data
  const currentConv = conversations.find(c => c.id === activeConv) || null
  const q = search.trim()
  const savedFiltered = q ? saved.filter(s => (s.title + s.location + s.ptype).includes(q)) : saved
  const sectionTitle = (t: string) => <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>{t}</div>

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <style>{`@media(max-width:760px){.mjb-side{width:60px!important}.mjb-sidelabel{display:none!important}.mjb-cols{flex-direction:column!important}}`}</style>

      {/* SIDEBAR */}
      <aside className="mjb-side" style={{ width: 232, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--line)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px var(--gold)', flexShrink: 0 }}>
              <div style={{ width: 13, height: 13, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 3 }} />
            </div>
            <div><div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px' }}>ملک‌جت</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>پنل خریدار</div></div>
          </div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = view === item.id
            const badge = item.badge === 'viewings' ? stats.kpis.upcomingViewings : item.badge === 'offers' ? stats.kpis.pendingOffers : item.badge === 'messages' ? stats.kpis.unreadMessages : item.id === 'chat' ? conversations.length : 0
            // آیتمِ هوش مصنوعی همیشه پررنگ (گرادیان طلایی)
            if (item.ai) {
              return (
                <button key={item.id} onClick={() => setView(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: active ? '1px solid var(--gold)' : '1px solid transparent', cursor: 'pointer', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, textAlign: 'right', marginBottom: 6, fontFamily: FONT, boxShadow: '0 6px 18px -8px var(--gold)' }}>
                  <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{item.icon}</span>
                  <span className="mjb-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                  <span className="mjb-sidelabel" style={{ fontSize: 9.5, fontWeight: 800, background: 'rgba(0,0,0,.18)', borderRadius: 6, padding: '2px 6px' }}>AI</span>
                </button>
              )
            }
            return (
              <button key={item.id} onClick={() => { setView(item.id); if (item.id === 'chat') setActiveConv(null) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontWeight: active ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                <span className="mjb-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && (item.badge || item.id === 'chat') && <span style={{ background: active ? 'var(--gold)' : 'var(--line2)', color: active ? '#16140f' : 'var(--text)', borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{fa(badge)}</span>}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />
          <a href="/search" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600, fontSize: 14, fontFamily: FONT, border: '1px solid color-mix(in srgb,var(--gold) 25%,transparent)' }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>🔍</span>
            <span className="mjb-sidelabel" style={{ flex: 1 }}>جستجوی ملک</span>
          </a>
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#16140f', flexShrink: 0 }}>{stats.profile.name.trim().charAt(0) || 'خ'}</div>
          <div className="mjb-sidelabel" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.profile.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>خریدار</div>
          </div>
          <button onClick={toggleTheme} title="تغییر تم" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{theme === 'dark' ? '☀' : '☾'}</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--navbg)', backdropFilter: 'blur(18px)', zIndex: 20, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{VIEW_TITLES[view]}</div>
          <div style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو در علاقه‌مندی‌ها…" style={{ ...inputStyle, width: 220, maxWidth: '40vw' }} />
          <a href="/search" style={{ padding: '9px 16px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>🔍 جستجوی ملک جدید</a>
        </header>

        <main style={{ padding: 22, flex: 1, overflowY: 'auto' }}>
          {/* ─── DASHBOARD ─── */}
          {view === 'dashboard' && <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* AI HERO */}
            <div style={{ borderRadius: 18, padding: '22px 24px', background: 'linear-gradient(135deg, color-mix(in srgb,var(--gold) 22%,var(--surface)), var(--surface) 70%)', border: '1px solid color-mix(in srgb,var(--gold) 40%,transparent)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb,var(--gold) 35%,transparent), transparent 70%)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>✨</span>
                  <div style={{ fontWeight: 900, fontSize: 19 }}>دستیار هوشمند خرید ملک</div>
                  <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--gold)', color: '#16140f', borderRadius: 6, padding: '2px 8px' }}>AI</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.8, maxWidth: 560 }}>
                  قیمت منصفانه، بهترین محله با بودجه‌ات، نکات مذاکره و چک‌لیست خرید — هر سؤالی داری از مشاور هوشمندِ ملک‌جت بپرس.
                </div>
                <form onSubmit={e => { e.preventDefault(); setView('ai'); askAi(aiInput) }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="مثلاً: با ۸ میلیارد کجا آپارتمان بخرم؟" style={{ ...inputStyle, flex: '1 1 260px', background: 'var(--bg)' }} />
                  <button type="submit" style={{ padding: '9px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}>بپرس از AI ✨</button>
                </form>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
                  {AI_SUGGESTIONS.slice(0, 3).map(s => (
                    <button key={s} onClick={() => { setView('ai'); askAi(s) }} style={{ ...actionBtn, background: 'var(--bg)', borderColor: 'color-mix(in srgb,var(--gold) 30%,transparent)', color: 'var(--text)' }}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Kpi label="علاقه‌مندی‌ها" value={fa(stats.kpis.savedCount)} />
              <Kpi label="جستجوهای ذخیره‌شده" value={fa(stats.kpis.searchCount)} />
              <Kpi label="بازدیدهای پیش‌رو" value={fa(stats.kpis.upcomingViewings)} />
              <Kpi label="پیام خوانده‌نشده" value={fa(stats.kpis.unreadMessages)} subColor="var(--gold)" sub={stats.kpis.unreadMessages ? 'نیاز به بررسی' : undefined} />
              <Kpi label="پیشنهاد در انتظار" value={fa(stats.kpis.pendingOffers)} />
            </div>
            <div className="mjb-cols" style={{ display: 'flex', gap: 16 }}>
              <div style={{ ...card, padding: 18, flex: 2, minWidth: 0 }}>
                {sectionTitle('علاقه‌مندی‌های اخیر')}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 12 }}>
                  {stats.recentSaved.length ? stats.recentSaved.map(p => <PropCard key={p.id} p={p} onRemove={() => post({ action: 'removeSaved', id: p.id })} />)
                    : <div style={{ color: 'var(--faint)', fontSize: 13 }}>هنوز ملکی ذخیره نکرده‌ای.</div>}
                </div>
              </div>
              <div style={{ ...card, padding: 18, flex: 1, minWidth: 0 }}>
                {sectionTitle('بازدیدهای پیش‌رو')}
                {stats.upcoming.length ? stats.upcoming.map(v => (
                  <div key={v.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{v.propertyTitle}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{v.advisor || '—'} · {v.date}</div>
                  </div>
                )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>بازدیدی برنامه‌ریزی نشده.</div>}
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('پیام‌های اخیر')}
              {stats.recentMessages.length ? stats.recentMessages.map(m => (
                <div key={m.id} onClick={() => m.unread && post({ action: 'markMessageRead', id: m.id })} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)', cursor: m.unread ? 'pointer' : 'default' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.unread ? 'var(--gold)' : 'transparent', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: m.unread ? 800 : 600 }}>{m.from}{m.propertyTitle ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {m.propertyTitle}</span> : ''}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.text}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>{faDate(m.createdAt)}</div>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>پیامی نداری.</div>}
            </div>
          </div>}

          {/* ─── AI ASSISTANT ─── */}
          {view === 'ai' && <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', maxWidth: 860, margin: '0 auto', width: '100%' }}>
            <div style={{ ...card, padding: 18, display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg, color-mix(in srgb,var(--gold) 16%,var(--surface)), var(--surface) 75%)', border: '1px solid color-mix(in srgb,var(--gold) 35%,transparent)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✨</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>دستیار هوشمند خرید ملک</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>مشاور AI شخصیِ تو — بر اساس بودجه و سلیقه‌ات پاسخ می‌دهد</div>
              </div>
              {aiMessages.length > 0 && <button onClick={clearAi} style={actionBtn}>پاک کردن گفتگو</button>}
            </div>

            <div style={{ ...card, padding: 18, flex: 1, minHeight: 320, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
              {aiMessages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 460 }}>
                  <div style={{ fontSize: 38, marginBottom: 10 }}>🏡✨</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>چطور می‌تونم کمکت کنم؟</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.8 }}>یکی از پیشنهادهای زیر را بزن یا سؤالت را تایپ کن.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {AI_SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => askAi(s)} disabled={aiSending} style={{ ...actionBtn, textAlign: 'right', padding: '11px 14px', background: 'var(--bg)', color: 'var(--text)', borderColor: 'color-mix(in srgb,var(--gold) 25%,transparent)' }}>{s}</button>
                    ))}
                  </div>
                </div>
              ) : aiMessages.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '82%', padding: '11px 14px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.85, whiteSpace: 'pre-wrap', ...(m.role === 'user'
                    ? { background: 'var(--bg2)', border: '1px solid var(--line)', borderTopRightRadius: 4 }
                    : { background: 'linear-gradient(135deg, color-mix(in srgb,var(--gold) 18%,var(--surface)), var(--surface))', border: '1px solid color-mix(in srgb,var(--gold) 30%,transparent)', borderTopLeftRadius: 4 }) }}>
                    {m.role === 'assistant' && <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)', marginBottom: 5 }}>✨ دستیار هوشمند</div>}
                    {m.text}
                  </div>
                </div>
              ))}
              {aiSending && <div style={{ alignSelf: 'flex-end', fontSize: 12.5, color: 'var(--gold)', padding: '6px 4px' }}>✨ در حال فکر کردن…</div>}
            </div>

            <form onSubmit={e => { e.preventDefault(); askAi(aiInput) }} style={{ display: 'flex', gap: 8 }}>
              <input value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="سؤالت را بنویس…" style={{ ...inputStyle, flex: 1 }} />
              <button type="submit" disabled={aiSending || !aiInput.trim()} style={{ padding: '9px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, border: 'none', cursor: aiSending ? 'default' : 'pointer', fontFamily: FONT, opacity: aiSending || !aiInput.trim() ? .6 : 1 }}>ارسال</button>
            </form>
          </div>}

          {/* ─── CHAT WITH OWNER ─── */}
          {view === 'chat' && <div className="mjb-cols" style={{ display: 'flex', gap: 16, height: '100%' }}>
            {/* conversation list */}
            <div style={{ ...card, padding: 14, flex: '0 0 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 14, padding: '2px 4px' }}>گفتگوها</div>
              <a href="/search" style={{ ...card, padding: '12px 14px', background: 'var(--bg2)', borderColor: 'color-mix(in srgb,var(--gold) 30%,transparent)', textDecoration: 'none', color: 'var(--text)', display: 'block' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>💬 شروع گفتگوی جدید</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.7 }}>برای چت با صاحب یک ملک، وارد صفحهٔ آگهی شو و روی «چت با صاحب آگهی» بزن — گفتگو همین‌جا ذخیره می‌شود.</div>
              </a>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {conversations.map(c => (
                  <button key={c.id} onClick={() => setActiveConv(c.id)} style={{ textAlign: 'right', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: activeConv === c.id ? 'var(--goldDim)' : 'var(--bg)', cursor: 'pointer', fontFamily: FONT }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: activeConv === c.id ? 'var(--gold)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.propertyTitle}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.ownerName} · {c.messages[c.messages.length - 1]?.text || ''}</div>
                  </button>
                ))}
                {conversations.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 12.5, textAlign: 'center', padding: '20px 0' }}>هنوز گفتگویی نداری — از صفحهٔ یک آگهی شروع کن.</div>}
              </div>
            </div>

            {/* thread */}
            <div style={{ ...card, padding: 0, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {!currentConv ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                  <div style={{ fontSize: 38, marginBottom: 10 }}>💬</div>
                  <div style={{ fontSize: 14 }}>یک گفتگو را انتخاب کن یا گفتگوی جدید بساز.</div>
                </div>
              ) : <>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🏠</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentConv.propertyTitle}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{currentConv.ownerName}</div>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 280 }}>
                  {currentConv.messages.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: m.from === 'buyer' ? 'flex-start' : 'flex-end' }}>
                      <div style={{ maxWidth: '78%', padding: '10px 13px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', ...(m.from === 'buyer'
                        ? { background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', borderTopRightRadius: 4 }
                        : { background: 'var(--bg2)', border: '1px solid var(--line)', borderTopLeftRadius: 4 }) }}>
                        {m.text}
                        {m.from === 'owner' && m.ai && <span style={{ display: 'block', fontSize: 10, color: 'var(--faint)', marginTop: 4 }}>✨ پاسخ خودکار</span>}
                      </div>
                    </div>
                  ))}
                  {chatSending && <div style={{ alignSelf: 'flex-end', fontSize: 12, color: 'var(--muted)', padding: '4px' }}>در حال پاسخ…</div>}
                </div>
                <form onSubmit={e => { e.preventDefault(); sendChat() }} style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
                  <button type="button" onClick={draftReply} disabled={drafting} title="پیشنهاد متن با هوش مصنوعی" style={{ ...actionBtn, color: 'var(--gold)', borderColor: 'color-mix(in srgb,var(--gold) 35%,transparent)', flexShrink: 0 }}>{drafting ? '…' : '✨'}</button>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="پیامت را بنویس…" style={{ ...inputStyle, flex: 1 }} />
                  <button type="submit" disabled={chatSending || !chatInput.trim()} style={{ padding: '9px 20px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: FONT, opacity: chatSending || !chatInput.trim() ? .6 : 1 }}>ارسال</button>
                </form>
              </>}
            </div>
          </div>}

          {/* ─── FAVORITES ─── */}
          {view === 'favorites' && <div style={{ ...card, padding: 18 }}>
            {sectionTitle(`علاقه‌مندی‌ها (${fa(savedFiltered.length)})`)}
            {savedFiltered.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
                {savedFiltered.map(p => <PropCard key={p.id} p={p} onRemove={() => post({ action: 'removeSaved', id: p.id })} />)}
              </div>
            ) : <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز ملکی ذخیره نکرده‌ای — از <a href="/search" style={{ color: 'var(--gold)' }}>جستجو</a> ملک‌ها را ذخیره کن.</div>}
          </div>}

          {/* ─── SEARCHES ─── */}
          {view === 'searches' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('ذخیرهٔ جستجوی جدید')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 200px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>عبارت جستجو</label><input value={newSearch.query} onChange={e => setNewSearch({ ...newSearch, query: e.target.value })} placeholder="مثلاً آپارتمان ۲ خوابه شمال تهران" style={inputStyle} /></div>
                <div style={{ flex: '1 1 120px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>منطقه</label><input value={newSearch.area} onChange={e => setNewSearch({ ...newSearch, area: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 130px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>حداکثر قیمت (تومان)</label><input value={newSearch.priceMax} onChange={e => setNewSearch({ ...newSearch, priceMax: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 0' }}><input type="checkbox" checked={newSearch.alerts} onChange={e => setNewSearch({ ...newSearch, alerts: e.target.checked })} /> هشدار</label>
                <button disabled={busy || !newSearch.query.trim()} onClick={async () => { if (await post({ action: 'addSearch', query: newSearch.query.trim(), area: newSearch.area, priceMax: Number(newSearch.priceMax) || undefined, alerts: newSearch.alerts })) setNewSearch({ query: '', ptype: '', area: '', priceMax: '', alerts: true }) }} style={{ padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }}>ذخیره</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('جستجوهای ذخیره‌شده')}
              {searches.length ? searches.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{s.query}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {s.area && <span>📍 {s.area}</span>}{s.priceMax ? <span>تا {money(s.priceMax)}</span> : null}
                    </div>
                  </div>
                  <button onClick={() => post({ action: 'toggleSearchAlerts', id: s.id })} style={{ ...actionBtn, color: s.alerts ? 'var(--gold)' : 'var(--muted)', borderColor: s.alerts ? 'var(--gold)' : 'var(--line)' }}>{s.alerts ? '🔔 هشدار فعال' : '🔕 هشدار خاموش'}</button>
                  <button onClick={() => post({ action: 'deleteSearch', id: s.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>جستجوی ذخیره‌شده‌ای نداری.</div>}
            </div>
          </div>}

          {/* ─── VIEWINGS ─── */}
          {view === 'viewings' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('رزرو بازدید')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 200px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>عنوان ملک</label><input value={newViewing.propertyTitle} onChange={e => setNewViewing({ ...newViewing, propertyTitle: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مشاور/آژانس</label><input value={newViewing.advisor} onChange={e => setNewViewing({ ...newViewing, advisor: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 120px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>تاریخ</label><input value={newViewing.date} onChange={e => setNewViewing({ ...newViewing, date: e.target.value })} placeholder="۱۴۰۴/۰۴/۰۵" style={inputStyle} /></div>
                <button disabled={busy || !newViewing.propertyTitle.trim() || !newViewing.date.trim()} onClick={async () => { if (await post({ action: 'addViewing', propertyTitle: newViewing.propertyTitle.trim(), advisor: newViewing.advisor, date: newViewing.date.trim() })) setNewViewing({ propertyTitle: '', advisor: '', date: '' }) }} style={{ padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }}>رزرو</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('بازدیدهای من')}
              {viewings.length ? viewings.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{v.propertyTitle}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{v.advisor || '—'} · {v.date}</div>
                  </div>
                  <Pill label={VIEW_LABEL[v.status]} color={VIEW_COLOR[v.status]} />
                  <select value={v.status} onChange={e => post({ action: 'setViewingStatus', id: v.id, status: e.target.value })} style={{ ...actionBtn, cursor: 'pointer' }}>
                    {VIEW_STATUSES.map(s => <option key={s} value={s}>{VIEW_LABEL[s]}</option>)}
                  </select>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>بازدیدی نداری.</div>}
            </div>
          </div>}

          {/* ─── OFFERS ─── */}
          {view === 'offers' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('ثبت پیشنهاد')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 200px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>عنوان ملک</label><input value={newOffer.propertyTitle} onChange={e => setNewOffer({ ...newOffer, propertyTitle: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 160px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مبلغ پیشنهادی (تومان)</label><input value={newOffer.amount} onChange={e => setNewOffer({ ...newOffer, amount: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                <button disabled={busy || !newOffer.propertyTitle.trim()} onClick={async () => { if (await post({ action: 'addOffer', propertyTitle: newOffer.propertyTitle.trim(), amount: Number(newOffer.amount) || 0 })) setNewOffer({ propertyTitle: '', amount: '' }) }} style={{ padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }}>ثبت</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('پیشنهادهای من')}
              {offers.length ? offers.map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{o.propertyTitle}</div>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, marginTop: 2 }}>{money(o.amount)}</div>
                  </div>
                  <Pill label={OFFER_LABEL[o.status]} color={OFFER_COLOR[o.status]} />
                  {o.status === 'pending' && <button onClick={() => post({ action: 'withdrawOffer', id: o.id })} style={{ ...actionBtn, color: '#ef4444' }}>انصراف</button>}
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>پیشنهادی ثبت نکرده‌ای.</div>}
            </div>
          </div>}

          {/* ─── MESSAGES ─── */}
          {view === 'messages' && <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>پیام‌ها</div>
              <button onClick={() => post({ action: 'markAllRead' })} style={actionBtn}>همه را خوانده‌شده کن</button>
            </div>
            {messages.length ? messages.map(m => (
              <div key={m.id} onClick={() => m.unread && post({ action: 'markMessageRead', id: m.id })} style={{ display: 'flex', gap: 10, padding: '12px 10px', borderRadius: 10, marginBottom: 6, background: m.unread ? 'var(--goldDim)' : 'transparent', cursor: m.unread ? 'pointer' : 'default' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.unread ? 'var(--gold)' : 'var(--line2)', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: m.unread ? 800 : 600 }}>{m.from}{m.propertyTitle ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {m.propertyTitle}</span> : ''}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.7 }}>{m.text}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>{faDate(m.createdAt)}</div>
              </div>
            )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>پیامی نداری.</div>}
          </div>}

          {/* ─── PROFILE ─── */}
          {view === 'profile' && (() => {
            const vs: VerifyStatus = data.profile.verifyStatus || 'none'
            const fields = [prof.name, prof.email, prof.bio, prof.budget, prof.prefType, prof.areas]
            const filled = fields.filter(Boolean).length
            const completeness = Math.round((filled / fields.length) * 100)
            return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
              {/* header card */}
              <div style={{ ...card, padding: 22, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#16140f', flexShrink: 0 }}>{(prof.name.trim()[0]) || 'خ'}</div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800, fontSize: 19 }}>{prof.name || 'خریدار'}</div>
                    <Pill label={VERIFY_LABEL[vs]} color={VERIFY_COLOR[vs]} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, direction: 'ltr', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{data.phone}</div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted)', marginBottom: 4 }}><span>تکمیل پروفایل</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{fa(completeness)}٪</span></div>
                    <div style={{ height: 7, borderRadius: 999, background: 'var(--line2)', overflow: 'hidden' }}><div style={{ width: `${completeness}%`, height: '100%', background: 'linear-gradient(90deg,var(--gold2),var(--gold))' }} /></div>
                  </div>
                </div>
                {vs !== 'verified' && <button disabled={busy || vs === 'pending'} onClick={requestVerify} style={{ padding: '10px 18px', borderRadius: 10, background: vs === 'pending' ? 'var(--bg2)' : 'linear-gradient(135deg,var(--gold2),var(--gold))', color: vs === 'pending' ? 'var(--muted)' : '#16140f', fontWeight: 700, fontSize: 13, border: vs === 'pending' ? '1px solid var(--line)' : 'none', cursor: vs === 'pending' ? 'default' : 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}>{vs === 'pending' ? 'در حال بررسی…' : '✓ تأیید هویت'}</button>}
              </div>

              {/* personal info */}
              <div style={{ ...card, padding: 18 }}>
                {sectionTitle('اطلاعات شخصی')}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام و نام خانوادگی</label><input value={prof.name} onChange={e => setProf({ ...prof, name: e.target.value })} style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>ایمیل</label><input value={prof.email} onChange={e => setProf({ ...prof, email: e.target.value })} placeholder="example@mail.com" style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>شماره موبایل</label><input value={data.phone} disabled style={{ ...inputStyle, direction: 'ltr', textAlign: 'right', opacity: .6, cursor: 'not-allowed' }} /></div>
                </div>
                <div style={{ marginTop: 12 }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>دربارهٔ من</label><textarea value={prof.bio} onChange={e => setProf({ ...prof, bio: e.target.value })} rows={3} placeholder="مثلاً: به‌دنبال آپارتمان برای سکونت خانواده در شمال تهران هستم…" style={{ ...inputStyle, resize: 'vertical' }} /></div>
              </div>

              {/* search preferences */}
              <div style={{ ...card, padding: 18 }}>
                {sectionTitle('ترجیحات خرید')}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع معامله</label><select value={prof.dealType} onChange={e => setProf({ ...prof, dealType: e.target.value as Deal })} style={inputStyle}><option value="sale">خرید</option><option value="rent">اجاره/رهن</option></select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع ملک</label><select value={prof.prefType} onChange={e => setProf({ ...prof, prefType: e.target.value })} style={inputStyle}><option value="">—</option>{PTYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>تعداد خواب</label><input value={prof.rooms} onChange={e => setProf({ ...prof, rooms: e.target.value.replace(/\D/g, '') })} placeholder="۲" style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>متراژ از</label><input value={prof.areaMin} onChange={e => setProf({ ...prof, areaMin: e.target.value.replace(/\D/g, '') })} placeholder="۷۰" style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>متراژ تا</label><input value={prof.areaMax} onChange={e => setProf({ ...prof, areaMax: e.target.value.replace(/\D/g, '') })} placeholder="۱۳۰" style={inputStyle} /></div>
                  <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>بودجه (تومان) {prof.budget && <span style={{ color: 'var(--gold)' }}>— {money(Number(prof.budget) || 0)}</span>}</label><input value={prof.budget} onChange={e => setProf({ ...prof, budget: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مناطق موردنظر</label><input value={prof.areas} onChange={e => setProf({ ...prof, areas: e.target.value })} placeholder="مثلاً: زعفرانیه، سعادت‌آباد، ونک" style={inputStyle} /></div>
                </div>
              </div>

              <button disabled={busy} onClick={() => post({ action: 'updateProfile', patch: { name: prof.name, email: prof.email, bio: prof.bio, budget: Number(prof.budget) || 0, prefType: prof.prefType, dealType: prof.dealType, rooms: Number(prof.rooms) || undefined, areaMin: Number(prof.areaMin) || undefined, areaMax: Number(prof.areaMax) || undefined, areas: prof.areas } })} style={{ alignSelf: 'flex-start', padding: '11px 30px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: FONT }}>{busy ? 'در حال ذخیره…' : 'ذخیرهٔ پروفایل'}</button>
            </div>
          })()}

          {/* ─── SETTINGS ─── */}
          {view === 'settings' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('🔔 اعلان‌ها')}
              <SettingRow title="اعلان ایمیلی" desc="دریافت خبرها و هشدارها از طریق ایمیل" on={data.settings.notifyEmail} onChange={v => setSetting('notifyEmail', v)} />
              <SettingRow title="اعلان پیامکی" desc="دریافت هشدارهای مهم با پیامک" on={data.settings.notifySms} onChange={v => setSetting('notifySms', v)} />
              <SettingRow title="اعلان درون‌برنامه‌ای (Push)" desc="نمایش اعلان روی موبایل و مرورگر" on={data.settings.notifyPush} onChange={v => setSetting('notifyPush', v)} />
              <div style={{ borderBottom: 'none' }}><SettingRow title="خلاصهٔ هفتگی" desc="ایمیل خلاصهٔ بازار و ملک‌های جدید هر هفته" on={data.settings.weeklyDigest} onChange={v => setSetting('weeklyDigest', v)} /></div>
            </div>

            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('⚡ هشدارهای هوشمند')}
              <SettingRow title="ملک جدید مطابق جستجوهای من" desc="وقتی ملکی مطابق سرچ ذخیره‌شده‌ات ثبت شود" on={data.settings.alertNewMatch} onChange={v => setSetting('alertNewMatch', v)} />
              <SettingRow title="کاهش قیمت" desc="هنگام افت قیمت ملک‌های موردعلاقه‌ات" on={data.settings.alertPriceDrop} onChange={v => setSetting('alertPriceDrop', v)} />
              <SettingRow title="پیام جدید" desc="پیام تازه از صاحب آگهی یا مشاور" on={data.settings.alertMessages} onChange={v => setSetting('alertMessages', v)} />
              <SettingRow title="یادآوری بازدید" desc="یادآوری قبل از زمان بازدیدها" on={data.settings.alertViewingReminder} onChange={v => setSetting('alertViewingReminder', v)} />
            </div>

            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('🔒 حریم خصوصی')}
              <SettingRow title="نمایش پروفایل به مشاوران" desc="مشاوران بتوانند پروفایل و ترجیحاتت را ببینند" on={data.settings.showProfileToAdvisors} onChange={v => setSetting('showProfileToAdvisors', v)} />
              <SettingRow title="اجازهٔ تماس مستقیم" desc="مشاوران و فروشندگان بتوانند با تو تماس بگیرند" on={data.settings.allowContact} onChange={v => setSetting('allowContact', v)} />
            </div>

            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('⚙ عمومی')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>زبان</div></div>
                <select value={data.settings.language} onChange={e => setSetting('language', e.target.value)} style={{ ...inputStyle, width: 140 }}><option value="fa">فارسی</option><option value="en">English</option></select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>حالت نمایش</div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>روشن / تاریک</div></div>
                <button onClick={toggleTheme} style={{ ...actionBtn, padding: '8px 16px' }}>{theme === 'dark' ? '☀ روشن' : '☾ تاریک'}</button>
              </div>
            </div>

            <div style={{ ...card, padding: 18, border: '1px solid color-mix(in srgb,#ef4444 35%,transparent)' }}>
              {sectionTitle('🚪 حساب')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={logout} style={{ ...actionBtn, color: '#ef4444', borderColor: 'color-mix(in srgb,#ef4444 35%,transparent)', padding: '9px 20px' }}>خروج از حساب</button>
                <a href="/buyer" onClick={() => setView('profile')} style={{ ...actionBtn, textDecoration: 'none', color: 'var(--gold)', borderColor: 'color-mix(in srgb,var(--gold) 35%,transparent)', padding: '9px 20px' }}>ویرایش پروفایل</a>
              </div>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12, lineHeight: 1.8 }}>برای حذف کامل حساب با پشتیبانی تماس بگیر. تغییرات تنظیمات به‌صورت خودکار ذخیره می‌شوند.</div>
            </div>
          </div>}
        </main>
      </div>
    </div>
  )
}
