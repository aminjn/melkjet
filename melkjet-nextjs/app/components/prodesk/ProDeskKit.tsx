'use client'
import { useState, useEffect, useCallback } from 'react'
import { J_MONTHS, J_DOW, jMonthLength, jDow, jKey } from '@/app/lib/jalali'
import CrmTool, { CRM_VIEWS, type CrmView } from '@/app/components/tools/CrmTool'
import MarketingTool, { MARKETING_VIEWS, type MarketingView } from '@/app/components/tools/MarketingTool'
import WorkflowTool, { WORKFLOW_VIEWS, type WorkflowView } from '@/app/components/tools/WorkflowTool'
import WebsiteBuilderTool, { WEBSITE_VIEWS, type WebsiteView } from '@/app/components/tools/WebsiteBuilderTool'
import ArticleEditor from '@/app/components/ArticleEditor'

// ابزارکِ مشترکِ میزِ کارِ متخصص — چرومِ سایدبار/هدر + هوکِ داده + اجزای درخواست‌ها و رکوردها.
// هر داشبوردِ شغلی (معمار/پیمانکار/…) این‌ها را با کانفیگِ اختصاصیِ خودش می‌چیند.
export const FONT = 'Vazirmatn, system-ui, sans-serif'
export const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
export const money = (n: number) => {
  const v = Number(n) || 0
  if (v >= 1_000_000) return fa(Math.round(v / 1_000_000)) + ' م.ت'
  return fa(v) + ' ت'
}
export const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
export const inputStyle: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%', boxSizing: 'border-box' }

export type ReqStatus = 'new' | 'in_progress' | 'done' | 'canceled'
export interface ProRequest { id: string; clientName: string; clientPhone?: string; kind?: string; detail?: string; status: ReqStatus; amount?: number; meta?: Record<string, any>; createdAt: number }
export interface ProRecord { id: string; title: string; subtitle?: string; kind?: string; status: 'active' | 'pending' | 'archived'; amount?: number; tags?: string[]; cover?: string; meta?: Record<string, any>; createdAt: number }
export interface ProStats { total: number; open: number; done: number; records: number; revenue: number; recent: ProRequest[] }
export interface ProData { stats: ProStats; requests: ProRequest[]; records: ProRecord[] }

const REQ_LABEL: Record<ReqStatus, string> = { new: 'تازه', in_progress: 'در حالِ انجام', done: 'انجام‌شده', canceled: 'لغو' }
const REQ_COLOR: Record<ReqStatus, string> = { new: '#f59e0b', in_progress: '#60a5fa', done: '#34d399', canceled: '#7a8fae' }
const NEXT: Record<ReqStatus, ReqStatus> = { new: 'in_progress', in_progress: 'done', done: 'new', canceled: 'new' }

export function StatusPill({ st }: { st: ReqStatus }) {
  const c = REQ_COLOR[st]
  return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: `color-mix(in srgb, ${c} 16%, transparent)`, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>{REQ_LABEL[st]}</span>
}

// ── هوکِ داده ────────────────────────────────────────────────────────────────
export function useProDesk(role: string) {
  const [data, setData] = useState<ProData | null>(null)
  const [authed, setAuthed] = useState(true)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    try {
      const r = await fetch(`/api/prodesk?role=${encodeURIComponent(role)}`, { cache: 'no-store' })
      if (r.status === 401) { setAuthed(false); setLoading(false); return }
      if (r.ok) { setData(await r.json()); setAuthed(true) }
    } catch {} finally { setLoading(false) }
  }, [role])
  useEffect(() => { reload() }, [reload])
  const post = useCallback(async (payload: any) => {
    try {
      const r = await fetch('/api/prodesk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, ...payload }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'خطا'); return null }
      await reload(); return d
    } catch { alert('اتصال برقرار نشد'); return null }
  }, [role, reload])
  return { data, authed, loading, reload, post }
}

// ── چرومِ پنل (سایدبار + هدر) ─────────────────────────────────────────────────
export interface NavItem { id: string; label: string; icon: string; badge?: number }
export interface ShellCfg { dash: string; unit: string; icon: string; accent: string; nav: NavItem[] }

// نگاشتِ داشبورد → پروفایلِ سایت‌سازِ صنفی (برای بازکردنِ قالبِ درست در سایت‌سازِ جاسازی‌شده).
const DASH_WB_PROFILE: Record<string, string> = {
  '/architect': 'معمار', '/contractor': 'پیمانکار', '/appraiser': 'کارشناس',
  '/lawfirm': 'دفتر حقوقی', '/finance': 'بانک و بیمه', '/notary': 'دفترخانه',
}

// یک گروهِ ابزارِ آبشاری در سایدبار (CRM/مارکتینگ/اتوماسیون/سایت‌ساز) — داخلِ همین پنل باز می‌شود.
function ToolGroup<T extends string>({ icon, label, views, activeView, open, setOpen, onPick }: { icon: string; label: string; views: { id: T; label: string; icon: string }[]; activeView: T | null; open: boolean; setOpen: (f: (o: boolean) => boolean) => void; onPick: (v: T) => void }) {
  const on = !!activeView
  return (
    <>
      <button onClick={() => { setOpen(o => !o); if (!activeView) onPick(views[0].id) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
        <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: on ? 1 : 0.7 }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{ fontSize: 11, transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none' }}>‹</span>
      </button>
      {open && views.map(v => {
        const sel = activeView === v.id
        return (
          <button key={v.id} onClick={() => onPick(v.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', paddingRight: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: sel ? 'var(--goldDim)' : 'transparent', color: sel ? 'var(--gold)' : 'var(--muted)', fontWeight: sel ? 700 : 500, fontSize: 13, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
            <span style={{ fontSize: 13, width: 16, textAlign: 'center', opacity: sel ? 1 : 0.6 }}>{v.icon}</span>
            <span style={{ flex: 1 }}>{v.label}</span>
          </button>
        )
      })}
    </>
  )
}

export function Shell({ cfg, active, setActive, title, children }: { cfg: ShellCfg; active: string; setActive: (id: string) => void; title: string; children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  // ابزارهای مشترک، جاسازی‌شده داخلِ همین پنل (مثلِ مشاور/آژانس/سازنده) — نه لینک به بیرون.
  const [crmView, setCrmView] = useState<CrmView | null>(null)
  const [mktView, setMktView] = useState<MarketingView | null>(null)
  const [wfView, setWfView] = useState<WorkflowView | null>(null)
  const [wbView, setWbView] = useState<WebsiteView | null>(null)
  const [crmOpen, setCrmOpen] = useState(false), [mktOpen, setMktOpen] = useState(false), [wfOpen, setWfOpen] = useState(false), [wbOpen, setWbOpen] = useState(false)
  const toolActive = !!(crmView || mktView || wfView || wbView)
  const clearTools = () => { setCrmView(null); setMktView(null); setWfView(null); setWbView(null) }
  const pickPanel = (id: string) => { clearTools(); setActive(id); setNavOpen(false) }
  const openCrm = (v: CrmView) => { clearTools(); setCrmView(v); setCrmOpen(true); setNavOpen(false) }
  const openMkt = (v: MarketingView) => { clearTools(); setMktView(v); setMktOpen(true); setNavOpen(false) }
  const openWf = (v: WorkflowView) => { clearTools(); setWfView(v); setWfOpen(true); setNavOpen(false) }
  const openWb = (v: WebsiteView) => { clearTools(); setWbView(v); setWbOpen(true); setNavOpen(false) }
  const wbProfile = DASH_WB_PROFILE[cfg.dash]
  const hdr = crmView ? `CRM · ${CRM_VIEWS.find(v => v.id === crmView)?.label || ''}`
    : mktView ? `مارکتینگ · ${MARKETING_VIEWS.find(v => v.id === mktView)?.label || ''}`
      : wfView ? `اتوماسیون · ${WORKFLOW_VIEWS.find(v => v.id === wfView)?.label || ''}`
        : wbView ? `وب‌سایت‌ساز · ${WEBSITE_VIEWS.find(v => v.id === wbView)?.label || ''}` : title

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <style>{`@media(max-width:900px){.mjpd-side{position:fixed!important;z-index:200;transform:translateX(100%);transition:transform .25s}.mjpd-side.open{transform:none}.mjpd-burger{display:inline-flex!important}}`}</style>
      {navOpen && <div onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 150 }} />}
      <aside className={`mjpd-side${navOpen ? ' open' : ''}`} style={{ width: 232, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--line)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(140deg, ${cfg.accent}, var(--gold))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cfg.icon}</div>
          <div><div style={{ fontWeight: 800, fontSize: 16 }}>ملک‌جت</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{cfg.unit}</div></div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {cfg.nav.map(it => {
            const on = active === it.id && !toolActive
            return (
              <button key={it.id} onClick={() => pickPanel(it.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: on ? 1 : 0.7 }}>{it.icon}</span>
                <span style={{ flex: 1 }}>{it.label}</span>
                {!!it.badge && it.badge > 0 && <span style={{ background: on ? 'var(--gold)' : 'var(--line2)', color: on ? '#16140f' : 'var(--text)', borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{fa(it.badge)}</span>}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />
          <ToolGroup icon="◇" label="CRM و مشتریان" views={CRM_VIEWS} activeView={crmView} open={crmOpen} setOpen={setCrmOpen} onPick={openCrm} />
          <ToolGroup icon="◈" label="مارکتینگ" views={MARKETING_VIEWS} activeView={mktView} open={mktOpen} setOpen={setMktOpen} onPick={openMkt} />
          <ToolGroup icon="⛭" label="اتوماسیون" views={WORKFLOW_VIEWS} activeView={wfView} open={wfOpen} setOpen={setWfOpen} onPick={openWf} />
          <ToolGroup icon="🌐" label="وب‌سایت‌ساز" views={WEBSITE_VIEWS} activeView={wbView} open={wbOpen} setOpen={setWbOpen} onPick={openWb} />
        </nav>
        <a href="/" style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)', textDecoration: 'none' }}>← بازگشت به سایت</a>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 100 }}>
          <button className="mjpd-burger" onClick={() => setNavOpen(true)} style={{ display: 'none', width: 38, height: 38, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>☰</button>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, flex: 1 }}>{hdr}</h1>
        </header>
        <div style={{ padding: toolActive ? 0 : 22, flex: 1, minWidth: 0 }}>
          {crmView ? <div style={{ padding: 22 }}><CrmTool embedded view={crmView} onView={v => setCrmView(v)} /></div>
            : mktView === 'articles' ? <div style={{ padding: 22 }}><ArticleEditor compact /></div>
              : mktView ? <div style={{ padding: 22 }}><MarketingTool embedded view={mktView} onView={v => setMktView(v)} /></div>
                : wfView ? <div style={{ height: 'calc(100vh - 66px)' }}><WorkflowTool embedded view={wfView} onView={v => setWfView(v)} /></div>
                  : wbView ? <div style={{ height: 'calc(100vh - 66px)' }}><WebsiteBuilderTool embedded profile={wbProfile} view={wbView} onView={v => setWbView(v)} /></div>
                    : children}
        </div>
      </main>
    </div>
  )
}

export function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 800, color: accent || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: 18, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── صندوقِ درخواست‌ها (استعلام/لیدِ ورودی) ───────────────────────────────────
export interface Terms { title: string; kindLabel: string; kinds: string[]; addCta: string; empty: string }
export function RequestsInbox({ requests, terms, post }: { requests: ProRequest[]; terms: Terms; post: (p: any) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ clientName: '', clientPhone: '', kind: terms.kinds[0] || '', amount: '', detail: '' })
  const submit = async () => {
    if (!f.clientName.trim()) { alert('نامِ متقاضی الزامی است'); return }
    const d = await post({ action: 'addRequest', clientName: f.clientName, clientPhone: f.clientPhone, kind: f.kind, amount: Number(f.amount) || undefined, detail: f.detail })
    if (d) { setF({ clientName: '', clientPhone: '', kind: terms.kinds[0] || '', amount: '', detail: '' }); setOpen(false) }
  }
  return (
    <SectionCard title={terms.title} action={<button onClick={() => setOpen(o => !o)} style={{ padding: '7px 14px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }}>{open ? 'بستن' : '＋ ' + terms.addCta}</button>}>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16, padding: 14, background: 'var(--bg2)', borderRadius: 12 }}>
          <input placeholder="نامِ متقاضی" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} style={inputStyle} />
          <input placeholder="شمارهٔ تماس" value={f.clientPhone} onChange={e => setF({ ...f, clientPhone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
          <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{terms.kinds.map(k => <option key={k} value={k}>{k}</option>)}</select>
          <input placeholder="مبلغِ برآورد (تومان)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
          <input placeholder="توضیح" value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          <button onClick={submit} style={{ gridColumn: '1 / -1', padding: '9px', borderRadius: 9, background: 'var(--gold)', color: '#16140f', fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: FONT }}>ثبت</button>
        </div>
      )}
      {requests.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '26px 0' }}>{terms.empty}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--bg2)', borderRadius: 11, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.clientName}{r.kind && <span style={{ color: 'var(--gold)', fontWeight: 600, marginRight: 8, fontSize: 12 }}>· {r.kind}</span>}</div>
                {(r.detail || r.clientPhone) && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{r.clientPhone && <span style={{ direction: 'ltr', display: 'inline-block' }}>{r.clientPhone}</span>}{r.detail && <span> — {r.detail}</span>}</div>}
              </div>
              {!!r.amount && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>{money(r.amount)}</span>}
              <button onClick={() => post({ action: 'updateRequest', id: r.id, patch: { status: NEXT[r.status] } })} title="تغییرِ وضعیت" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}><StatusPill st={r.status} /></button>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRequest', id: r.id }) }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// ── رکوردهای کاری (نمونه‌کار/پرونده/محصول/سند) ────────────────────────────────
export interface RecTerms { title: string; kinds: string[]; addCta: string; empty: string; titlePh: string; subtitlePh: string; withAmount?: boolean }
export function RecordsPanel({ records, terms, post }: { records: ProRecord[]; terms: RecTerms; post: (p: any) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', subtitle: '', kind: terms.kinds[0] || '', amount: '' })
  const submit = async () => {
    if (!f.title.trim()) { alert('عنوان الزامی است'); return }
    const d = await post({ action: 'addRecord', title: f.title, subtitle: f.subtitle, kind: f.kind, amount: Number(f.amount) || undefined })
    if (d) { setF({ title: '', subtitle: '', kind: terms.kinds[0] || '', amount: '' }); setOpen(false) }
  }
  return (
    <SectionCard title={terms.title} action={<button onClick={() => setOpen(o => !o)} style={{ padding: '7px 14px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }}>{open ? 'بستن' : '＋ ' + terms.addCta}</button>}>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16, padding: 14, background: 'var(--bg2)', borderRadius: 12 }}>
          <input placeholder={terms.titlePh} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={inputStyle} />
          <input placeholder={terms.subtitlePh} value={f.subtitle} onChange={e => setF({ ...f, subtitle: e.target.value })} style={inputStyle} />
          <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{terms.kinds.map(k => <option key={k} value={k}>{k}</option>)}</select>
          {terms.withAmount && <input placeholder="مبلغ (تومان)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />}
          <button onClick={submit} style={{ gridColumn: '1 / -1', padding: '9px', borderRadius: 9, background: 'var(--gold)', color: '#16140f', fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: FONT }}>ثبت</button>
        </div>
      )}
      {records.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '26px 0' }}>{terms.empty}</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {records.map(r => (
            <div key={r.id} style={{ ...card, padding: 14, position: 'relative' }}>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRecord', id: r.id }) }} style={{ position: 'absolute', top: 10, left: 10, border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
              {r.kind && <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', marginBottom: 5 }}>{r.kind}</div>}
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{r.title}</div>
              {r.subtitle && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{r.subtitle}</div>}
              {!!r.amount && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)', marginTop: 8 }}>{money(r.amount)}</div>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// مودالِ سادهٔ مشترک.
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 'min(560px,100%)', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
export const btnGold: React.CSSProperties = { padding: '8px 15px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }

const faY = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false })
export type JDate = { jy: number; jm: number; jd: number }

// انتخابگرِ تاریخِ جلالی (سه منوی روز/ماه/سال) — مشترکِ همهٔ پنل‌ها.
export function JalaliPicker({ jy, jm, jd, onChange, baseYear }: { jy: number; jm: number; jd: number; onChange: (v: JDate) => void; baseYear: number }) {
  const days = jMonthLength(jy, jm)
  const set = (p: Partial<JDate>) => {
    const nY = p.jy ?? jy, nM = p.jm ?? jm
    onChange({ jy: nY, jm: nM, jd: Math.min(p.jd ?? jd, jMonthLength(nY, nM)) })
  }
  const sel: React.CSSProperties = { ...inputStyle, padding: '9px 8px' }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 8, gridColumn: '1 / -1' }}>
      <select value={jd} onChange={e => set({ jd: Number(e.target.value) })} style={sel}>{Array.from({ length: days }, (_, i) => i + 1).map(d => <option key={d} value={d}>{fa(d)}</option>)}</select>
      <select value={jm} onChange={e => set({ jm: Number(e.target.value) })} style={sel}>{J_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
      <select value={jy} onChange={e => set({ jy: Number(e.target.value) })} style={sel}>{Array.from({ length: 3 }, (_, i) => baseYear - 1 + i).map(y => <option key={y} value={y}>{faY(y)}</option>)}</select>
    </div>
  )
}

// تقویمِ ماهانهٔ جلالیِ عمومی — آیتم‌ها با کلیدِ تاریخِ "YYYY/MM/DD".
export interface CalItem { id: string; dateKey: string; time?: string; label: string; color?: string }
export function ProCalendar({ items, today, title = 'تقویم' }: { items: CalItem[]; today: JDate; title?: string }) {
  const [y, setY] = useState(today.jy)
  const [m, setM] = useState(today.jm)
  const byDay: Record<string, CalItem[]> = {}
  for (const it of items) { if (it.dateKey) (byDay[it.dateKey] ||= []).push(it) }
  const lead = jDow(y, m, 1), len = jMonthLength(y, m)
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)]
  const prev = () => { if (m === 1) { setY(y - 1); setM(12) } else setM(m - 1) }
  const next = () => { if (m === 12) { setY(y + 1); setM(1) } else setM(m + 1) }
  return (
    <SectionCard title={`${title} — ${J_MONTHS[m - 1]} ${faY(y)}`} action={
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={prev} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer' }}>›</button>
        <button onClick={() => { setY(today.jy); setM(today.jm) }} style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', cursor: 'pointer', fontFamily: FONT, fontSize: 12 }}>امروز</button>
        <button onClick={next} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer' }}>‹</button>
      </div>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {J_DOW.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '4px 0' }}>{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />
          const key = jKey(y, m, d), list = byDay[key] || []
          const isToday = y === today.jy && m === today.jm && d === today.jd
          return (
            <div key={key} style={{ minHeight: 78, borderRadius: 10, border: `1px solid ${isToday ? 'var(--gold)' : 'var(--line)'}`, background: isToday ? 'var(--goldDim)' : 'var(--bg2)', padding: 6, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? 'var(--gold)' : 'var(--faint)', textAlign: 'left' }}>{fa(d)}</div>
              {list.slice(0, 3).map(it => {
                const c = it.color || 'var(--gold)'
                return <div key={it.id} title={it.label} style={{ fontSize: 9.5, background: `color-mix(in srgb, ${c} 20%, transparent)`, color: c, borderRadius: 5, padding: '2px 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.time ? `${it.time} ` : ''}{it.label}</div>
              })}
              {list.length > 3 && <div style={{ fontSize: 9, color: 'var(--muted)' }}>+{fa(list.length - 3)}</div>}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// آپلودِ فایل (تصویر/PDF) → /api/media؛ خروجی {url,name}. مشترکِ همهٔ پنل‌ها.
export function FileField({ value, onChange, label = '📎 پیوستِ فایل (تصویر یا PDF)' }: { value?: { url: string; name: string }; onChange: (v?: { url: string; name: string }) => void; label?: string }) {
  const [busy, setBusy] = useState(false)
  const up = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/media', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (d.ok && d.url) onChange({ url: d.url, name: file.name }); else alert(d.error || 'خطا در آپلود')
    } catch { alert('خطا در آپلود') } finally { setBusy(false) }
  }
  if (value) return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--bg2)', borderRadius: 9, border: '1px solid var(--line)' }}>
      <span style={{ fontSize: 14 }}>📎</span>
      <a href={value.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12.5, color: 'var(--gold)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.name}</a>
      <button onClick={() => onChange(undefined)} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
    </div>
  )
  return (
    <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 9, border: '1px dashed var(--line2)', background: 'var(--bg2)', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer' }}>
      <input type="file" accept="image/*,application/pdf" onChange={e => up(e.target.files?.[0] || null)} style={{ display: 'none' }} />
      {busy ? 'در حالِ آپلود…' : label}
    </label>
  )
}

// لینکِ «مشاهدهٔ فایل» برای کارت‌ها.
export function FileLink({ file }: { file?: { url: string; name: string } }) {
  if (!file?.url) return null
  return <a href={file.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 11.5, color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>📎 مشاهدهٔ فایل</a>
}

// حالتِ «وارد شوید» برای کاربرِ بدونِ نشست.
export function LoginGate() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT, textAlign: 'center', padding: 24 }}>
      <div>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>برای ورود به میزِ کار، وارد شوید</div>
        <a href="/auth" style={{ display: 'inline-block', marginTop: 12, padding: '11px 26px', borderRadius: 11, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, textDecoration: 'none' }}>ورود / ثبت‌نام</a>
      </div>
    </div>
  )
}
