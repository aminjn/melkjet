'use client'
import { useState } from 'react'
import ReosPanelSection from '@/app/components/ReosPanelSection'
import AssistantPanel from '@/app/components/AssistantPanel'
import PlansPanel from '@/app/components/PlansPanel'
import SupportPanel from '@/app/components/SupportPanel'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'
import {
  Shell, useProDesk, Kpi, StatusPill, LoginGate, SectionCard, Modal, btnGold,
  JalaliPicker, ProCalendar, FileField, FileLink, ProAiTool,
  money, fa, card, inputStyle, type ProRecord, type ProRequest, type ReqStatus, type ShellCfg, type JDate,
} from '@/app/components/prodesk/ProDeskKit'
import { jToday, jKey, jLabel } from '@/app/lib/jalali'
import ContractStudio from './ContractStudio'

// میزِ کارِ «دفترِ حقوقی» — نسخهٔ تخصصی: پرونده‌ها با مرحلهٔ رسیدگی + جلساتِ پیشِ‌رو + پذیرشِ موکل.
const ROLE = '/lawfirm'
const DISPUTE_TYPES = ['خلعِ ید', 'الزام به تنظیمِ سند', 'مطالبهٔ وجه', 'تخلیه', 'ابطالِ معامله', 'مشاورهٔ قرارداد']
const LEGAL_STAGES = ['بدوی', 'تجدیدنظر', 'دیوانِ عالی', 'اجرای احکام']
const NEXT: Record<ReqStatus, ReqStatus> = { new: 'in_progress', in_progress: 'done', done: 'new', canceled: 'new' }
const caseNo = () => 'پ-' + String(Date.now()).slice(-5)
const stageOf = (r: ProRecord) => Math.max(0, Math.min(LEGAL_STAGES.length - 1, Number(r.meta?.stage) || 0))

// آیتم‌های تقویم از جلساتِ پرونده‌ها.
const hearingCalItems = (records: ProRecord[]) => records.filter(r => r.meta?.jhearing && r.status !== 'archived').map(r => ({ id: r.id, dateKey: r.meta!.jhearing as string, label: r.title, color: '#c98fb0' }))

// ── پرونده‌ها ────────────────────────────────────────────────────────────────
function CaseForm({ initial, onSave, onClose, today }: { initial?: Partial<{ title: string; kind: string; court: string; amount: string }>; onSave: (f: any) => void; onClose: () => void; today: JDate }) {
  const [f, setF] = useState<{ title: string; kind: string; caseNo: string; court: string; amount: string; jy: number; jm: number; jd: number; file?: { url: string; name: string } }>({ title: initial?.title || '', kind: initial?.kind || DISPUTE_TYPES[0], caseNo: caseNo(), court: initial?.court || '', amount: initial?.amount || '', ...today, file: undefined })
  return (
    <Modal title="پروندهٔ جدید" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input placeholder="نامِ موکل" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={inputStyle} />
        <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{DISPUTE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
        <input placeholder="شمارهٔ پرونده" value={f.caseNo} onChange={e => setF({ ...f, caseNo: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
        <input placeholder="شعبه / دادگاه" value={f.court} onChange={e => setF({ ...f, court: e.target.value })} style={inputStyle} />
        <input placeholder="حق‌الوکاله (تومان)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right', gridColumn: '1 / -1' }} />
        <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'var(--muted)', marginBottom: -4 }}>تاریخِ جلسهٔ بعدی</div>
        <JalaliPicker jy={f.jy} jm={f.jm} jd={f.jd} baseYear={today.jy} onChange={v => setF({ ...f, ...v })} />
        <FileField value={f.file} onChange={v => setF({ ...f, file: v })} label="📎 پیوستِ پرونده / لایحه (تصویر یا PDF)" />
      </div>
      <button onClick={() => { if (!f.title.trim()) { alert('نامِ موکل الزامی است'); return } onSave({ ...f, hearing: jLabel(f.jy, f.jm, f.jd), jhearing: jKey(f.jy, f.jm, f.jd) }) }} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>تشکیلِ پرونده</button>
    </Modal>
  )
}

function Cases({ records, post, today }: { records: ProRecord[]; post: (p: any) => Promise<any>; today: JDate }) {
  const [open, setOpen] = useState(false)
  const save = async (f: any) => {
    const d = await post({ action: 'addRecord', title: f.title, kind: f.kind, subtitle: f.court, amount: Number(f.amount) || undefined, status: 'active', meta: { caseNo: f.caseNo, court: f.court, hearing: f.hearing, jhearing: f.jhearing, file: f.file, stage: 0 } })
    if (d) setOpen(false)
  }
  const advance = (r: ProRecord) => {
    const st = stageOf(r)
    if (st >= LEGAL_STAGES.length - 1) return post({ action: 'updateRecord', id: r.id, patch: { status: 'archived' } })
    return post({ action: 'updateRecord', id: r.id, patch: { meta: { ...(r.meta || {}), stage: st + 1 } } })
  }
  return (
    <SectionCard title="پرونده‌ها" action={<button onClick={() => setOpen(true)} style={btnGold}>＋ پروندهٔ جدید</button>}>
      {records.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز پرونده‌ای ثبت نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {records.map(r => {
            const st = stageOf(r), closed = r.status === 'archived'
            return (
              <div key={r.id} style={{ ...card, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--gold)', direction: 'ltr' }}>{r.meta?.caseNo}</span>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{r.title}{r.kind && <span style={{ color: 'var(--gold)', fontWeight: 600, marginRight: 8, fontSize: 12 }}>· {r.kind}</span>}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{[r.meta?.court, r.meta?.hearing && `جلسه: ${r.meta.hearing}`].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: closed ? '#34d399' : '#c98fb0', background: `color-mix(in srgb, ${closed ? '#34d399' : '#c98fb0'} 16%, transparent)`, padding: '3px 10px', borderRadius: 7 }}>{closed ? 'مختومه' : `مرحله: ${LEGAL_STAGES[st]}`}</span>
                  {!!r.amount && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>{money(r.amount)}</span>}
                  <FileLink file={r.meta?.file} />
                  <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRecord', id: r.id }) }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
                </div>
                {!closed && <button onClick={() => advance(r)} style={{ marginTop: 10, padding: '6px 13px', borderRadius: 8, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{st >= LEGAL_STAGES.length - 1 ? 'مختومه‌کردن ✓' : `ارجاع به ${LEGAL_STAGES[st + 1]} ›`}</button>}
              </div>
            )
          })}
        </div>
      )}
      {open && <CaseForm onSave={save} onClose={() => setOpen(false)} today={today} />}
    </SectionCard>
  )
}

// ── جلساتِ پیشِ‌رو ─────────────────────────────────────────────────────────────
function Hearings({ records }: { records: ProRecord[] }) {
  const up = records.filter(r => r.status !== 'archived' && r.meta?.hearing).sort((a, b) => String(a.meta?.hearing).localeCompare(String(b.meta?.hearing)))
  if (up.length === 0) return null
  return (
    <SectionCard title="جلساتِ پیشِ‌رو">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {up.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg2)', borderRadius: 11, border: '1px solid var(--line)' }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: 'color-mix(in srgb,#c98fb0 18%,transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title} <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 11.5 }}>· {r.kind}</span></div>
              <div style={{ fontSize: 11, color: 'var(--faint)', direction: 'ltr', textAlign: 'right' }}>{r.meta?.caseNo} · {r.meta?.court || '—'}</div>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#c98fb0' }}>{r.meta?.hearing}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ── پذیرشِ موکل (درخواست‌ها) ───────────────────────────────────────────────────
function Intake({ requests, post, onOpenCase }: { requests: ProRequest[]; post: (p: any) => Promise<any>; onOpenCase: (r: ProRequest) => void }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ clientName: '', clientPhone: '', kind: DISPUTE_TYPES[0], detail: '' })
  const save = async () => {
    if (!f.clientName.trim()) { alert('نامِ موکل الزامی است'); return }
    const d = await post({ action: 'addRequest', clientName: f.clientName, clientPhone: f.clientPhone, kind: f.kind, detail: f.detail })
    if (d) { setF({ clientName: '', clientPhone: '', kind: DISPUTE_TYPES[0], detail: '' }); setOpen(false) }
  }
  return (
    <SectionCard title="درخواست‌های مشاوره و موکلِ جدید" action={<button onClick={() => setOpen(o => !o)} style={btnGold}>{open ? 'بستن' : '＋ موکلِ جدید'}</button>}>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16, padding: 14, background: 'var(--bg2)', borderRadius: 12 }}>
          <input placeholder="نامِ موکل" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} style={inputStyle} />
          <input placeholder="شمارهٔ تماس" value={f.clientPhone} onChange={e => setF({ ...f, clientPhone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
          <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{DISPUTE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <input placeholder="موضوع" value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          <button onClick={save} style={{ ...btnGold, gridColumn: '1 / -1', padding: 9 }}>ثبت</button>
        </div>
      )}
      {requests.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>درخواستی ثبت نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--bg2)', borderRadius: 11, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.clientName}{r.kind && <span style={{ color: 'var(--gold)', fontWeight: 600, marginRight: 8, fontSize: 12 }}>· {r.kind}</span>}</div>
                {(r.detail || r.clientPhone) && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{r.clientPhone && <span style={{ direction: 'ltr', display: 'inline-block' }}>{r.clientPhone}</span>}{r.detail && <span> — {r.detail}</span>}</div>}
              </div>
              {r.status !== 'done' && <button onClick={() => onOpenCase(r)} style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>تشکیلِ پرونده</button>}
              <button onClick={() => post({ action: 'updateRequest', id: r.id, patch: { status: NEXT[r.status] } })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}><StatusPill st={r.status} /></button>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRequest', id: r.id }) }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

export default function LawfirmPage() {
  const { data, authed, loading, post } = useProDesk(ROLE)
  const [view, setView] = useState('dashboard')
  const [caseFrom, setCaseFrom] = useState<ProRequest | null>(null)
  const [today] = useState(() => jToday(new Date()))
  if (!loading && !authed) return <LoginGate />

  const openCases = data?.records.filter(r => r.status !== 'archived').length || 0
  const closed = data?.records.filter(r => r.status === 'archived').length || 0
  const nav = [
    { id: 'dashboard', label: 'داشبورد', icon: '▦', badge: data?.stats.open },
    { id: 'cases', label: 'پرونده‌ها', icon: '📁' },
    { id: 'contract', label: 'قراردادساز', icon: '📝' },
    { id: 'calendar', label: 'تقویمِ جلسات', icon: '📆' },
    { id: 'intake', label: 'موکلین', icon: '📥', badge: data?.stats.open },
    { id: 'aitools', label: 'ابزارِ هوشمند', icon: '✦' },
    { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
    { id: 'profile', label: 'پروفایل', icon: '🪪' },
    { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
    { id: 'support', label: 'پشتیبانی', icon: '🛟' },
  ]
  const shell: ShellCfg = { dash: ROLE, unit: 'دفترِ حقوقی', icon: '⚖', accent: '#c98fb0', nav }

  const makeCase = async (f: any) => {
    const d = await post({ action: 'addRecord', title: f.title, kind: f.kind, subtitle: f.court, amount: Number(f.amount) || undefined, status: 'active', meta: { caseNo: f.caseNo, court: f.court, hearing: f.hearing, jhearing: f.jhearing, file: f.file, stage: 0 } })
    if (d && caseFrom) await post({ action: 'updateRequest', id: caseFrom.id, patch: { status: 'done' } })
    setCaseFrom(null)
  }

  return (
    <Shell cfg={shell} active={view} setActive={setView} title={nav.find(n => n.id === view)?.label || 'داشبورد'}>
      {caseFrom && <CaseForm initial={{ title: caseFrom.clientName, kind: caseFrom.kind }} onSave={makeCase} onClose={() => setCaseFrom(null)} today={today} />}
      {!data ? <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>در حال بارگذاری…</div> :
        view === 'dashboard' ? (
          <>
            <div style={{ marginBottom: 18 }}><ReosPanelSection title="فایل‌های پیشنهادیِ REOS" subtitle="بر اساسِ تقاضای زندهٔ بازار" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
              <Kpi label="پرونده‌های باز" value={fa(openCases)} accent="#c98fb0" />
              <Kpi label="مختومه" value={fa(closed)} accent="#34d399" />
              <Kpi label="درخواست‌های باز" value={fa(data.stats.open)} />
              <Kpi label="درآمدِ حق‌الوکاله" value={money(data.records.reduce((a, r) => a + (Number(r.amount) || 0), 0))} accent="var(--gold)" />
            </div>
            <Hearings records={data.records} />
            <Intake requests={data.requests} post={post} onOpenCase={setCaseFrom} />
            <Cases records={data.records} post={post} today={today} />
          </>
        ) : view === 'contract' ? <ContractStudio post={post} />
          : view === 'cases' ? <Cases records={data.records} post={post} today={today} />
          : view === 'calendar' ? <ProCalendar items={hearingCalItems(data.records)} today={today} title="تقویمِ جلسات" />
            : view === 'intake' ? <Intake requests={data.requests} post={post} onOpenCase={setCaseFrom} />
            : view === 'aitools' ? <ProAiTool accent="#c98fb0" tools={[{ id: 'contract_review', label: 'تحلیلِ قرارداد', placeholder: 'متنِ قرارداد/مبایعه‌نامه را اینجا بچسبان تا ریسک‌ها و اصلاحات را بدهد…' }, { id: 'legal_risk', label: 'ریسکِ حقوقی', placeholder: 'شرحِ معامله یا موقعیتِ حقوقی را بنویس…' }]} />
            : view === 'assistant' ? <div style={{ height: 'calc(100vh - 150px)' }}><AssistantPanel panel="lawfirm" title="دستیارِ حقوقیِ دفتر" subtitle="مشاورِ AI شخصیِ تو" suggestions={['نکاتِ حقوقیِ یک مبایعه‌نامهٔ استاندارد را بگو', 'متنِ یک اظهارنامهٔ مطالبهٔ وجه بنویس', 'مراحلِ دعوای خلعِ ید چیست؟', 'چک‌لیستِ بررسیِ سندِ ملک قبل از معامله']} /></div>
              : view === 'profile' ? (
                <>
                  <SectionCard title="پروفایلِ عمومی" action={<a href="/directory?category=حقوقی" style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>دیدنِ من در دایرکتوری ↗</a>}>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>پروفایلت را کامل کن تا در دایرکتوریِ «حقوقی» به موکلان نمایش داده شوی.</div>
                  </SectionCard>
                  <BusinessProfileForm />
                </>
              ) : view === 'plans' ? <PlansPanel dashboard={ROLE} /> : <SupportPanel panel="lawfirm" />}
    </Shell>
  )
}
