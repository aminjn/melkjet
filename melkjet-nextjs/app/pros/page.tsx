'use client'
import { useState, useEffect, useCallback } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'

// ════════ Types (mirror app/lib/advisor-store.ts) ════════
type Stage = 'new' | 'contacted' | 'visit' | 'negotiation' | 'closed' | 'lost'
type ListingStatus = 'active' | 'sold' | 'rented'
type ApptType = 'visit' | 'meeting' | 'call'
type ApptStatus = 'scheduled' | 'done' | 'canceled'
type CommStatus = 'pending' | 'paid'

interface Lead { id: string; name: string; phone?: string; need?: string; budget?: string; stage: Stage; source?: string; note?: string; createdAt: number }
interface Listing { id: string; title: string; ptype: string; location: string; price: number; deal: 'sale' | 'rent'; status: ListingStatus; createdAt: number }
interface Appt { id: string; client: string; listingTitle?: string; date: string; type: ApptType; status: ApptStatus; createdAt: number }
interface Commission { id: string; dealTitle: string; amount: number; status: CommStatus; date: string; createdAt: number }
interface Stats {
  profile: { name: string; agency?: string }
  kpis: { activeLeads: number; hotLeads: number; activeListings: number; upcomingAppts: number; pendingCommission: number; paidCommission: number; dealsThisMonth: number }
  pipeline: { stage: Stage; count: number }[]
  monthlyDeals: { month: string; count: number }[]
  recentLeads: Lead[]
  upcoming: Appt[]
}
interface AdvisorData { stats: Stats; leads: Lead[]; listings: Listing[]; appts: Appt[]; commissions: Commission[] }

type View = 'dashboard' | 'assistant' | 'leads' | 'listings' | 'appts' | 'commissions' | 'settings'

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
const PTYPE_OPTIONS = ['آپارتمان', 'ویلا', 'زمین', 'مغازه', 'سایر']

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inputStyle: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%' }
const actionBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap' }
const goldBtn: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }

const VIEW_TITLES: Record<View, string> = { dashboard: 'داشبورد مشاور', assistant: 'دستیار هوشمند', leads: 'لیدها و پایپ‌لاین', listings: 'فایل‌های من', appts: 'قرارها و بازدیدها', commissions: 'کمیسیون', settings: 'تنظیمات' }
const NAV_ITEMS: { id: View; label: string; icon: string; badge?: 'leads' | 'appts' }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '▦' },
  { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
  { id: 'leads', label: 'لیدها', icon: '◎', badge: 'leads' },
  { id: 'listings', label: 'فایل‌های من', icon: '◫' },
  { id: 'appts', label: 'قرارها', icon: '◉', badge: 'appts' },
  { id: 'commissions', label: 'کمیسیون', icon: '﷼' },
  { id: 'settings', label: 'تنظیمات', icon: '⛭' },
]
const NAV_LINKS = [
  { href: '/crm', label: 'CRM و مشتریان', icon: '◇' },
  { href: '/marketing', label: 'مارکتینگ', icon: '◬' },
  { href: '/workflow', label: 'اتوماسیون', icon: '⛭' },
  { href: '/website-builder', label: 'وب‌سایت‌ساز', icon: '◳' },
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

export default function ProsPage() {
  const [view, setView] = useState<View>('dashboard')
  const [data, setData] = useState<AdvisorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauth, setUnauth] = useState(false)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [search, setSearch] = useState('')
  const [nl, setNl] = useState({ name: '', phone: '', need: '', budget: '', source: '' })
  const [nf, setNf] = useState({ title: '', ptype: '', location: '', price: '', deal: 'sale' })
  const [na, setNa] = useState({ client: '', listingTitle: '', date: '', type: 'visit' })
  const [prof, setProf] = useState({ name: '', agency: '' })

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/advisor')
      if (r.status === 401) { setUnauth(true); setLoading(false); return }
      const d = await r.json(); setData(d); setUnauth(false)
      setProf({ name: d.stats.profile.name || '', agency: d.stats.profile.agency || '' })
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
            const active = view === item.id
            const badge = item.badge === 'leads' ? stats.kpis.activeLeads : item.badge === 'appts' ? stats.kpis.upcomingAppts : 0
            return (
              <button key={item.id} onClick={() => setView(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontWeight: active ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                <span className="mjp-sidelabel" style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badge > 0 && <span style={{ background: active ? 'var(--gold)' : 'var(--line2)', color: active ? '#16140f' : 'var(--text)', borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{fa(badge)}</span>}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, color: 'var(--muted)', textDecoration: 'none', fontWeight: 500, fontSize: 14, marginBottom: 2, fontFamily: FONT }}>
              <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: 0.7 }}>{l.icon}</span>
              <span className="mjp-sidelabel" style={{ flex: 1 }}>{l.label}</span>
            </a>
          ))}
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
          <div style={{ fontWeight: 800, fontSize: 18 }}>{VIEW_TITLES[view]}</div>
          <div style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی لید، مشتری…" style={{ ...inputStyle, width: 220, maxWidth: '40vw' }} />
          <button onClick={() => setView('leads')} style={{ ...goldBtn, padding: '9px 16px' }}>+ لید جدید</button>
        </header>

        <main style={{ padding: 22, flex: 1, overflowY: 'auto' }}>
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
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{l.need} {l.budget ? `· ${l.budget}` : ''}</div>
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

          {/* LEADS */}
          {view === 'leads' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('افزودن لید')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام</label><input value={nl.name} onChange={e => setNl({ ...nl, name: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 130px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>تلفن</label><input value={nl.phone} onChange={e => setNl({ ...nl, phone: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '2 1 180px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نیاز</label><input value={nl.need} onChange={e => setNl({ ...nl, need: e.target.value })} placeholder="مثلاً آپارتمان ۲ خوابه" style={inputStyle} /></div>
                <div style={{ flex: '1 1 120px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>بودجه</label><input value={nl.budget} onChange={e => setNl({ ...nl, budget: e.target.value })} style={inputStyle} /></div>
                <button disabled={busy || !nl.name.trim()} onClick={async () => { if (await post({ action: 'addLead', name: nl.name.trim(), phone: nl.phone, need: nl.need, budget: nl.budget, source: nl.source })) setNl({ name: '', phone: '', need: '', budget: '', source: '' }) }} style={goldBtn}>افزودن</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle(`لیدها (${fa(leadsF.length)})`)}
              {leadsF.length ? leadsF.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{l.name}{l.phone ? <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}> · {l.phone}</span> : ''}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{l.need} {l.budget ? `· ${l.budget}` : ''} {l.source ? `· منبع: ${l.source}` : ''}</div>
                  </div>
                  <select value={l.stage} onChange={e => post({ action: 'setLeadStage', id: l.id, stage: e.target.value })} style={{ ...actionBtn, cursor: 'pointer', color: STAGE_COLOR[l.stage], borderColor: STAGE_COLOR[l.stage] }}>
                    {STAGES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{STAGE_LABEL[s]}</option>)}
                  </select>
                  <button onClick={() => post({ action: 'deleteLead', id: l.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                </div>
              )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>لیدی نداری.</div>}
            </div>
          </div>}

          {/* LISTINGS */}
          {view === 'listings' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('افزودن فایل')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 180px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>عنوان</label><input value={nf.title} onChange={e => setNf({ ...nf, title: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 120px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع</label><select value={nf.ptype} onChange={e => setNf({ ...nf, ptype: e.target.value })} style={inputStyle}><option value="">—</option>{PTYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div style={{ flex: '1 1 120px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>منطقه</label><input value={nf.location} onChange={e => setNf({ ...nf, location: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>قیمت (تومان)</label><input value={nf.price} onChange={e => setNf({ ...nf, price: e.target.value.replace(/\D/g, '') })} style={inputStyle} /></div>
                <div style={{ flex: '0 1 110px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>معامله</label><select value={nf.deal} onChange={e => setNf({ ...nf, deal: e.target.value })} style={inputStyle}><option value="sale">فروش</option><option value="rent">اجاره</option></select></div>
                <button disabled={busy || !nf.title.trim()} onClick={async () => { if (await post({ action: 'addListing', title: nf.title.trim(), ptype: nf.ptype || 'آپارتمان', location: nf.location, price: Number(nf.price) || 0, deal: nf.deal })) setNf({ title: '', ptype: '', location: '', price: '', deal: 'sale' }) }} style={goldBtn}>افزودن</button>
              </div>
            </div>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('فایل‌های من')}
              {listings.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
                  {listings.map(l => (
                    <div key={l.id} style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{l.title}</div>
                        <Pill label={DEAL_LABEL[l.deal]} color={l.deal === 'sale' ? '#60a5fa' : '#2dd4bf'} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.ptype} · {l.location}</div>
                      <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 14 }}>{money(l.price)}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select value={l.status} onChange={e => post({ action: 'setListingStatus', id: l.id, status: e.target.value })} style={{ ...actionBtn, cursor: 'pointer', color: LIST_COLOR[l.status], borderColor: LIST_COLOR[l.status] }}>
                          {LIST_STATUSES.map(s => <option key={s} value={s} style={{ color: 'var(--text)' }}>{LIST_LABEL[s]}</option>)}
                        </select>
                        <button onClick={() => post({ action: 'deleteListing', id: l.id })} style={{ ...actionBtn, color: '#ef4444' }}>حذف</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>فایلی نداری.</div>}
            </div>
          </div>}

          {/* APPOINTMENTS */}
          {view === 'appts' && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 18 }}>
              {sectionTitle('قرار جدید')}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>مشتری</label><input value={na.client} onChange={e => setNa({ ...na, client: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '2 1 180px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>ملک</label><input value={na.listingTitle} onChange={e => setNa({ ...na, listingTitle: e.target.value })} style={inputStyle} /></div>
                <div style={{ flex: '0 1 110px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>نوع</label><select value={na.type} onChange={e => setNa({ ...na, type: e.target.value })} style={inputStyle}><option value="visit">بازدید</option><option value="meeting">جلسه</option><option value="call">تماس</option></select></div>
                <div style={{ flex: '1 1 120px' }}><label style={{ fontSize: 12, color: 'var(--muted)' }}>تاریخ</label><input value={na.date} onChange={e => setNa({ ...na, date: e.target.value })} placeholder="۱۴۰۴/۰۴/۰۵" style={inputStyle} /></div>
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

          {/* COMMISSIONS */}
          {view === 'commissions' && <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>کمیسیون‌ها</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>در انتظار: <b style={{ color: 'var(--gold)' }}>{money(stats.kpis.pendingCommission)}</b> · پرداخت‌شده: <b style={{ color: '#34d399' }}>{money(stats.kpis.paidCommission)}</b></div>
            </div>
            {commissions.length ? commissions.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.dealTitle}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{c.date}</div>
                </div>
                <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 14 }}>{money(c.amount)}</div>
                {c.status === 'pending'
                  ? <button onClick={() => post({ action: 'setCommissionStatus', id: c.id, status: 'paid' })} style={{ ...actionBtn, color: '#34d399', borderColor: '#34d399' }}>علامت پرداخت</button>
                  : <Pill label="پرداخت‌شده" color="#34d399" />}
              </div>
            )) : <div style={{ color: 'var(--faint)', fontSize: 13 }}>کمیسیونی ثبت نشده.</div>}
          </div>}

          {/* SETTINGS */}
          {view === 'settings' && <div style={{ ...card, padding: 18, maxWidth: 480 }}>
            {sectionTitle('تنظیمات مشاور')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام</label><input value={prof.name} onChange={e => setProf({ ...prof, name: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>آژانس/دفتر</label><input value={prof.agency} onChange={e => setProf({ ...prof, agency: e.target.value })} style={inputStyle} /></div>
              <button disabled={busy} onClick={() => post({ action: 'updateProfile', patch: { name: prof.name, agency: prof.agency } })} style={{ ...goldBtn, alignSelf: 'flex-start', padding: '9px 22px' }}>ذخیره</button>
            </div>
          </div>}
        </main>
      </div>
    </div>
  )
}
