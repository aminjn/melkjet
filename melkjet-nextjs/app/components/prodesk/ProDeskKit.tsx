'use client'
import { useState, useEffect, useCallback } from 'react'

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
// لینک‌های ابزارِ مشترک (همان چیزی که در پنل‌های دیگر هست) — داخلِ همان تب باز می‌شوند.
const CROSS = [
  { href: '/crm', icon: '◇', label: 'CRM و مشتریان' },
  { href: '/marketing', icon: '◈', label: 'مارکتینگ' },
  { href: '/website-builder', icon: '🌐', label: 'سایت‌ساز' },
  { href: '/workflow', icon: '⛭', label: 'اتوماسیون' },
]

export function Shell({ cfg, active, setActive, title, children }: { cfg: ShellCfg; active: string; setActive: (id: string) => void; title: string; children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
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
            const on = active === it.id
            return (
              <button key={it.id} onClick={() => { setActive(it.id); setNavOpen(false) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontWeight: on ? 700 : 500, fontSize: 14, textAlign: 'right', marginBottom: 2, fontFamily: FONT }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', opacity: on ? 1 : 0.7 }}>{it.icon}</span>
                <span style={{ flex: 1 }}>{it.label}</span>
                {!!it.badge && it.badge > 0 && <span style={{ background: on ? 'var(--gold)' : 'var(--line2)', color: on ? '#16140f' : 'var(--text)', borderRadius: 9, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{fa(it.badge)}</span>}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />
          {CROSS.map(c => (
            <a key={c.href} href={c.href} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 10, textDecoration: 'none', background: 'transparent', color: 'var(--muted)', fontWeight: 500, fontSize: 13.5, fontFamily: FONT, boxSizing: 'border-box' }}>
              <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{c.icon}</span><span style={{ flex: 1 }}>{c.label}</span>
            </a>
          ))}
        </nav>
        <a href="/" style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)', textDecoration: 'none' }}>← بازگشت به سایت</a>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 100 }}>
          <button className="mjpd-burger" onClick={() => setNavOpen(true)} style={{ display: 'none', width: 38, height: 38, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>☰</button>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, flex: 1 }}>{title}</h1>
        </header>
        <div style={{ padding: 22, flex: 1 }}>{children}</div>
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
