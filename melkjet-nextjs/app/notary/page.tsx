'use client'
import { useState } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'
import PlansPanel from '@/app/components/PlansPanel'
import SupportPanel from '@/app/components/SupportPanel'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'
import {
  Shell, useProDesk, Kpi, LoginGate, SectionCard, Modal, btnGold,
  money, fa, card, inputStyle, type ProRecord, type ProRequest, type ReqStatus, type ShellCfg,
} from '@/app/components/prodesk/ProDeskKit'
import { J_MONTHS, J_DOW, jMonthLength, jDow, jToday, jKey, jLabel } from '@/app/lib/jalali'

const faY = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false })  // سال بدونِ جداکنندهٔ هزارگان

// میزِ کارِ «دفترخانه» — نوبت‌دهی با تقویمِ واقعیِ جلالی + چک‌لیستِ مدارک + دفترِ اسناد با پیوستِ فایل.
const ROLE = '/notary'
const SERVICES = ['تنظیمِ سند', 'وکالت‌نامه', 'تعهدنامه', 'اقرارنامه', 'استعلام']
const DOC_MAP: Record<string, string[]> = {
  'تنظیمِ سند': ['سندِ مالکیت', 'کارتِ ملیِ طرفین', 'پایان‌کار', 'مفاصاحسابِ شهرداری', 'گواهیِ مالیاتی'],
  'وکالت‌نامه': ['کارتِ ملیِ موکل', 'کارتِ ملیِ وکیل', 'موضوعِ وکالت'],
  'تعهدنامه': ['کارتِ ملی', 'متنِ تعهد'],
  'اقرارنامه': ['کارتِ ملیِ مُقِر', 'موضوعِ اقرار'],
  'استعلام': ['پلاکِ ثبتی', 'کارتِ ملی'],
}
const sanadNo = () => 'س-' + String(Date.now()).slice(-6)

const N_LABEL: Record<ReqStatus, string> = { new: 'رزرو', in_progress: 'در جریان', done: 'صادر شد', canceled: 'لغو' }
const N_COLOR: Record<ReqStatus, string> = { new: '#f59e0b', in_progress: '#60a5fa', done: '#34d399', canceled: '#7a8fae' }
const NEXT: Record<ReqStatus, ReqStatus> = { new: 'in_progress', in_progress: 'done', done: 'new', canceled: 'new' }
function NPill({ st }: { st: ReqStatus }) {
  const c = N_COLOR[st]
  return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: `color-mix(in srgb, ${c} 16%, transparent)`, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>{N_LABEL[st]}</span>
}

// ── انتخابگرِ تاریخِ جلالی (سه منوی سال/ماه/روز) ──────────────────────────────
function JalaliPicker({ jy, jm, jd, onChange, baseYear }: { jy: number; jm: number; jd: number; onChange: (v: { jy: number; jm: number; jd: number }) => void; baseYear: number }) {
  const days = jMonthLength(jy, jm)
  const set = (p: Partial<{ jy: number; jm: number; jd: number }>) => {
    const nY = p.jy ?? jy, nM = p.jm ?? jm
    const nJd = Math.min(p.jd ?? jd, jMonthLength(nY, nM))
    onChange({ jy: nY, jm: nM, jd: nJd })
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

// ── تقویمِ ماهانه ────────────────────────────────────────────────────────────
function Calendar({ requests, today }: { requests: ProRequest[]; today: { jy: number; jm: number; jd: number } }) {
  const [y, setY] = useState(today.jy)
  const [m, setM] = useState(today.jm)
  const byDay: Record<string, ProRequest[]> = {}
  for (const r of requests) { const k = r.meta?.jdate; if (k) (byDay[k] ||= []).push(r) }
  const lead = jDow(y, m, 1), len = jMonthLength(y, m)
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)]
  const prev = () => { if (m === 1) { setY(y - 1); setM(12) } else setM(m - 1) }
  const next = () => { if (m === 12) { setY(y + 1); setM(1) } else setM(m + 1) }
  return (
    <SectionCard title={`تقویمِ نوبت‌ها — ${J_MONTHS[m - 1]} ${faY(y)}`} action={
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={prev} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer' }}>›</button>
        <button onClick={() => { setY(today.jy); setM(today.jm) }} style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>امروز</button>
        <button onClick={next} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer' }}>‹</button>
      </div>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {J_DOW.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '4px 0' }}>{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />
          const key = jKey(y, m, d)
          const items = byDay[key] || []
          const isToday = y === today.jy && m === today.jm && d === today.jd
          return (
            <div key={key} style={{ minHeight: 78, borderRadius: 10, border: `1px solid ${isToday ? 'var(--gold)' : 'var(--line)'}`, background: isToday ? 'var(--goldDim)' : 'var(--bg2)', padding: 6, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? 'var(--gold)' : 'var(--faint)', textAlign: 'left' }}>{fa(d)}</div>
              {items.slice(0, 3).map(it => (
                <div key={it.id} title={`${it.clientName} · ${it.kind}`} style={{ fontSize: 9.5, background: `color-mix(in srgb, ${N_COLOR[it.status]} 20%, transparent)`, color: N_COLOR[it.status], borderRadius: 5, padding: '2px 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.meta?.time ? `${it.meta.time} ` : ''}{it.clientName}</div>
              ))}
              {items.length > 3 && <div style={{ fontSize: 9, color: 'var(--muted)' }}>+{fa(items.length - 3)}</div>}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ── نوبت‌ها + چک‌لیستِ مدارک ──────────────────────────────────────────────────
function Appointments({ requests, post, onIssue, today }: { requests: ProRequest[]; post: (p: any) => Promise<any>; onIssue: (r: ProRequest) => void; today: { jy: number; jm: number; jd: number } }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ clientName: '', clientPhone: '', kind: SERVICES[0], time: '', ...today })
  const save = async () => {
    if (!f.clientName.trim()) { alert('نامِ مراجع الزامی است'); return }
    const d = await post({ action: 'addRequest', clientName: f.clientName, clientPhone: f.clientPhone, kind: f.kind, meta: { jdate: jKey(f.jy, f.jm, f.jd), date: jLabel(f.jy, f.jm, f.jd), time: f.time, checked: [] } })
    if (d) { setF({ clientName: '', clientPhone: '', kind: SERVICES[0], time: '', ...today }); setOpen(false) }
  }
  const toggleDoc = (r: ProRequest, doc: string) => {
    const checked: string[] = Array.isArray(r.meta?.checked) ? r.meta!.checked : []
    const nx = checked.includes(doc) ? checked.filter(x => x !== doc) : [...checked, doc]
    post({ action: 'updateRequest', id: r.id, patch: { meta: { ...(r.meta || {}), checked: nx } } })
  }
  return (
    <SectionCard title="نوبت‌های خدمات" action={<button onClick={() => setOpen(true)} style={btnGold}>＋ نوبتِ جدید</button>}>
      {requests.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز نوبتی ثبت نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {requests.map(r => {
            const docs = DOC_MAP[r.kind || ''] || []
            const checked: string[] = Array.isArray(r.meta?.checked) ? r.meta!.checked : []
            return (
              <div key={r.id} style={{ ...card, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{r.clientName}{r.kind && <span style={{ color: 'var(--gold)', fontWeight: 600, marginRight: 8, fontSize: 12 }}>· {r.kind}</span>}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{[r.meta?.date, r.meta?.time && `ساعت ${r.meta.time}`, r.clientPhone].filter(Boolean).join(' · ')}</div>
                  </div>
                  <NPill st={r.status} />
                  {r.status !== 'done' && <button onClick={() => onIssue(r)} style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>ثبتِ سند</button>}
                  <button onClick={() => post({ action: 'updateRequest', id: r.id, patch: { status: NEXT[r.status] } })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }} title="تغییرِ وضعیت">↻</button>
                  <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRequest', id: r.id }) }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
                </div>
                {docs.length > 0 && (
                  <div style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 7 }}>مدارکِ لازم — {fa(checked.length)}/{fa(docs.length)}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {docs.map(doc => {
                        const on = checked.includes(doc)
                        return <button key={doc} onClick={() => toggleDoc(r, doc)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? '#34d399' : 'var(--line2)'}`, background: on ? 'color-mix(in srgb,#34d399 15%,transparent)' : 'var(--bg2)', color: on ? '#34d399' : 'var(--muted)', fontWeight: on ? 700 : 500 }}>{on ? '✓ ' : ''}{doc}</button>
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {open && (
        <Modal title="نوبتِ جدید" onClose={() => setOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="نامِ مراجع" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} style={inputStyle} />
            <input placeholder="شمارهٔ تماس" value={f.clientPhone} onChange={e => setF({ ...f, clientPhone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }}>{SERVICES.map(t => <option key={t}>{t}</option>)}</select>
            <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'var(--muted)', marginBottom: -4 }}>تاریخِ نوبت</div>
            <JalaliPicker jy={f.jy} jm={f.jm} jd={f.jd} baseYear={today.jy} onChange={v => setF({ ...f, ...v })} />
            <input placeholder="ساعت (مثلاً ۱۰:۳۰)" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right', gridColumn: '1 / -1' }} />
          </div>
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 10, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.9 }}>مدارکِ لازم: {(DOC_MAP[f.kind] || []).join('، ')}</div>
          <button onClick={save} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>ثبتِ نوبت</button>
        </Modal>
      )}
    </SectionCard>
  )
}

// ── آپلودِ فایل (تصویر/PDF) ───────────────────────────────────────────────────
function FileField({ value, onChange }: { value?: { url: string; name: string }; onChange: (v?: { url: string; name: string }) => void }) {
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
      {busy ? 'در حالِ آپلود…' : '📎 پیوستِ فایلِ سند (تصویر یا PDF)'}
    </label>
  )
}

// ── مودالِ ثبتِ سند ───────────────────────────────────────────────────────────
function IssueModal({ req, post, onClose, today }: { req: ProRequest; post: (p: any) => Promise<any>; onClose: () => void; today: { jy: number; jm: number; jd: number } }) {
  const [f, setF] = useState<{ sanadNo: string; kind: string; amount: string; note: string; file?: { url: string; name: string } }>({ sanadNo: sanadNo(), kind: req.kind || SERVICES[0], amount: '', note: '', file: undefined })
  const issue = async () => {
    await post({ action: 'addRecord', title: req.clientName, subtitle: f.note, kind: f.kind, amount: Number(f.amount) || undefined, status: 'archived', meta: { sanadNo: f.sanadNo, date: jLabel(today.jy, today.jm, today.jd), file: f.file } })
    await post({ action: 'updateRequest', id: req.id, patch: { status: 'done' } })
    onClose()
  }
  return (
    <Modal title={`ثبتِ سند — ${req.clientName}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input placeholder="شمارهٔ سند" value={f.sanadNo} onChange={e => setF({ ...f, sanadNo: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
        <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{SERVICES.map(t => <option key={t}>{t}</option>)}</select>
        <input placeholder="حق‌التحریر (تومان)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
        <input placeholder="تاریخِ ثبت" value={jLabel(today.jy, today.jm, today.jd)} readOnly style={{ ...inputStyle, color: 'var(--muted)' }} />
        <input placeholder="طرفین / موضوعِ سند" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
        <FileField value={f.file} onChange={v => setF({ ...f, file: v })} />
      </div>
      <button onClick={issue} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>ثبت در دفترِ اسناد</button>
    </Modal>
  )
}

// ── دفترِ اسناد ───────────────────────────────────────────────────────────────
function Register({ records, post }: { records: ProRecord[]; post: (p: any) => Promise<any> }) {
  return (
    <SectionCard title="دفترِ اسناد">
      {records.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز سندی ثبت نشده — از یک نوبت، «ثبتِ سند» بزن.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
          {records.map(r => (
            <div key={r.id} style={{ ...card, padding: 14, position: 'relative' }}>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRecord', id: r.id }) }} style={{ position: 'absolute', top: 10, left: 10, border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--gold)', direction: 'ltr' }}>{r.meta?.sanadNo || '—'}</span>
                {r.kind && <span style={{ fontSize: 10, padding: '1px 7px', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--muted)' }}>{r.kind}</span>}
              </div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{r.title}</div>
              {r.subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.7 }}>{r.subtitle}</div>}
              {r.meta?.file?.url && <a href={r.meta.file.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 11.5, color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>📎 مشاهدهٔ فایل</a>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                {r.meta?.date && <span style={{ fontSize: 11, color: 'var(--faint)' }}>{r.meta.date}</span>}
                {!!r.amount && <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)' }}>{money(r.amount)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

export default function NotaryPage() {
  const { data, authed, loading, post } = useProDesk(ROLE)
  const [view, setView] = useState('dashboard')
  const [issueReq, setIssueReq] = useState<ProRequest | null>(null)
  const [today] = useState(() => jToday(new Date()))
  if (!loading && !authed) return <LoginGate />

  const nav = [
    { id: 'dashboard', label: 'داشبورد', icon: '▦', badge: data?.stats.open },
    { id: 'calendar', label: 'تقویم', icon: '📆' },
    { id: 'appointments', label: 'نوبت‌ها', icon: '📅', badge: data?.stats.open },
    { id: 'register', label: 'دفترِ اسناد', icon: '🧾' },
    { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
    { id: 'profile', label: 'پروفایل', icon: '🪪' },
    { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
    { id: 'support', label: 'پشتیبانی', icon: '🛟' },
  ]
  const shell: ShellCfg = { dash: ROLE, unit: 'دفترخانه', icon: '◆', accent: '#b0a06f', nav }

  return (
    <Shell cfg={shell} active={view} setActive={setView} title={nav.find(n => n.id === view)?.label || 'داشبورد'}>
      {issueReq && <IssueModal req={issueReq} post={post} onClose={() => setIssueReq(null)} today={today} />}
      {!data ? <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>در حال بارگذاری…</div> :
        view === 'dashboard' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
              <Kpi label="نوبت‌های باز" value={fa(data.stats.open)} accent="#b0a06f" />
              <Kpi label="اسنادِ صادرشده" value={fa(data.stats.records)} accent="#34d399" />
              <Kpi label="انجام‌شده" value={fa(data.stats.done)} />
              <Kpi label="درآمدِ حق‌التحریر" value={money(data.records.reduce((a, r) => a + (Number(r.amount) || 0), 0))} accent="var(--gold)" />
            </div>
            <Calendar requests={data.requests} today={today} />
            <Appointments requests={data.requests} post={post} onIssue={setIssueReq} today={today} />
          </>
        ) : view === 'calendar' ? <Calendar requests={data.requests} today={today} />
          : view === 'appointments' ? <Appointments requests={data.requests} post={post} onIssue={setIssueReq} today={today} />
            : view === 'register' ? <Register records={data.records} post={post} />
              : view === 'assistant' ? <div style={{ height: 'calc(100vh - 150px)' }}><AssistantPanel panel="notary" title="دستیارِ هوشمندِ دفترخانه" subtitle="مشاورِ AI شخصیِ تو" suggestions={['مدارکِ لازم برای تنظیمِ سندِ رسمیِ ملک را بگو', 'تفاوتِ وکالتِ بلاعزل و عادی چیست؟', 'مراحلِ نقل‌وانتقالِ سند در دفترخانه', 'یک متنِ راهنمای مراجعان برای پروفایلم بنویس']} /></div>
                : view === 'profile' ? (
                  <>
                    <SectionCard title="پروفایلِ عمومی" action={<a href="/directory?category=دفترخانه" style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>دیدنِ من در دایرکتوری ↗</a>}>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>پروفایلت را کامل کن تا در دایرکتوریِ «دفترخانه» به مراجعان نمایش داده شوی.</div>
                    </SectionCard>
                    <BusinessProfileForm />
                  </>
                ) : view === 'plans' ? <PlansPanel dashboard={ROLE} /> : <SupportPanel panel="notary" />}
    </Shell>
  )
}
