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

interface Stats {
  profile: { name: string; budget?: number; prefType?: string; areas?: string }
  kpis: { savedCount: number; searchCount: number; upcomingViewings: number; unreadMessages: number; pendingOffers: number }
  recentSaved: Saved[]
  upcoming: Viewing[]
  recentMessages: Message[]
}
interface BuyerData { stats: Stats; saved: Saved[]; searches: Search[]; viewings: Viewing[]; offers: Offer[]; messages: Message[] }

type View = 'dashboard' | 'favorites' | 'searches' | 'viewings' | 'offers' | 'messages' | 'settings'

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
  dashboard: 'پنل خریدار', favorites: 'علاقه‌مندی‌ها', searches: 'جستجوهای ذخیره‌شده',
  viewings: 'بازدیدهای من', offers: 'پیشنهادهای من', messages: 'پیام‌ها', settings: 'تنظیمات',
}
const NAV_ITEMS: { id: View; label: string; icon: string; badge?: 'viewings' | 'offers' | 'messages' }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '▦' },
  { id: 'favorites', label: 'علاقه‌مندی‌ها', icon: '♥' },
  { id: 'searches', label: 'جستجوهای ذخیره‌شده', icon: '◍' },
  { id: 'viewings', label: 'بازدیدهای من', icon: '◉', badge: 'viewings' },
  { id: 'offers', label: 'پیشنهادهای من', icon: '◈', badge: 'offers' },
  { id: 'messages', label: 'پیام‌ها', icon: '✉', badge: 'messages' },
  { id: 'settings', label: 'تنظیمات', icon: '⛭' },
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
  const [prof, setProf] = useState({ name: '', budget: '', prefType: '', areas: '' })

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/buyer')
      if (r.status === 401) { setUnauth(true); setLoading(false); return }
      const d = await r.json()
      setData(d); setUnauth(false)
      setProf({ name: d.stats.profile.name || '', budget: String(d.stats.profile.budget || ''), prefType: d.stats.profile.prefType || '', areas: d.stats.profile.areas || '' })
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

  const { stats, saved, searches, viewings, offers, messages } = data
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
            const badge = item.badge === 'viewings' ? stats.kpis.upcomingViewings : item.badge === 'offers' ? stats.kpis.pendingOffers : item.badge === 'messages' ? stats.kpis.unreadMessages : 0
            return (
              <button key={item.id} onClick={() => setView(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontWeight: active ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                <span className="mjb-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badge > 0 && <span style={{ background: active ? 'var(--gold)' : 'var(--line2)', color: active ? '#16140f' : 'var(--text)', borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{fa(badge)}</span>}
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

          {/* ─── SETTINGS ─── */}
          {view === 'settings' && <div style={{ ...card, padding: 18, maxWidth: 480 }}>
            {sectionTitle('تنظیمات خریدار')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام</label><input value={prof.name} onChange={e => setProf({ ...prof, name: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>بودجه (تومان) {prof.budget && <span style={{ color: 'var(--gold)' }}>— {money(Number(prof.budget) || 0)}</span>}</label><input value={prof.budget} onChange={e => setProf({ ...prof, budget: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع ملک موردنظر</label><select value={prof.prefType} onChange={e => setProf({ ...prof, prefType: e.target.value })} style={inputStyle}><option value="">—</option>{PTYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>مناطق موردنظر</label><input value={prof.areas} onChange={e => setProf({ ...prof, areas: e.target.value })} style={inputStyle} /></div>
              <button disabled={busy} onClick={() => post({ action: 'updateProfile', patch: { name: prof.name, budget: Number(prof.budget) || 0, prefType: prof.prefType, areas: prof.areas } })} style={{ alignSelf: 'flex-start', padding: '9px 22px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }}>ذخیره</button>
            </div>
          </div>}
        </main>
      </div>
    </div>
  )
}
