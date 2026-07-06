'use client'
import { useState } from 'react'
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
import ReportStudio from './ReportStudio'

// میزِ کارِ «کارشناسِ رسمی» — نسخهٔ تخصصی: پرونده‌های ارزیابی با محاسبهٔ ارزش + صدورِ گزارش.
const ROLE = '/appraiser'
const APPRAISAL_TYPES = ['ارزیابیِ ملک', 'ارزیابیِ خسارت', 'تفکیک و افراز', 'تعیینِ اجاره‌بها', 'ارزیابیِ سرقفلی']
const PROPERTY_TYPES = ['آپارتمان', 'ویلایی', 'زمین', 'تجاری', 'اداری', 'صنعتی']
const REPORT_TYPES = ['ملکی', 'خسارت', 'حقوقی', 'فنی', 'اجاره‌بها']
const NEXT: Record<ReqStatus, ReqStatus> = { new: 'in_progress', in_progress: 'done', done: 'new', canceled: 'new' }
const today = () => { try { return new Date().toLocaleDateString('fa-IR') } catch { return '' } }
const caseNo = () => 'MJ-' + String(Date.now()).slice(-6)

// آیتم‌های تقویم از بازدیدها.
const visitCalItems = (requests: ProRequest[]) => requests.filter(r => r.meta?.jvisit).map(r => ({ id: r.id, dateKey: r.meta!.jvisit as string, label: r.clientName, color: r.status === 'done' ? '#34d399' : '#8fbf7f' }))

// ── درخواست‌های ارزیابی ───────────────────────────────────────────────────────
function Requests({ requests, post, onReport, today }: { requests: ProRequest[]; post: (p: any) => Promise<any>; onReport: (r: ProRequest) => void; today: JDate }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ clientName: '', clientPhone: '', kind: APPRAISAL_TYPES[0], ptype: PROPERTY_TYPES[0], area: '', vpm: '', detail: '', ...today })
  const value = (Number(f.area) || 0) * (Number(f.vpm) || 0)
  const save = async () => {
    if (!f.clientName.trim()) { alert('نامِ متقاضی الزامی است'); return }
    const d = await post({ action: 'addRequest', clientName: f.clientName, clientPhone: f.clientPhone, kind: f.kind, amount: value || undefined, detail: f.detail, meta: { ptype: f.ptype, area: f.area, vpm: f.vpm, jvisit: jKey(f.jy, f.jm, f.jd), visit: jLabel(f.jy, f.jm, f.jd) } })
    if (d) { setF({ clientName: '', clientPhone: '', kind: APPRAISAL_TYPES[0], ptype: PROPERTY_TYPES[0], area: '', vpm: '', detail: '', ...today }); setOpen(false) }
  }
  return (
    <SectionCard title="درخواست‌های ارزیابی" action={<button onClick={() => setOpen(true)} style={btnGold}>＋ درخواستِ ارزیابی</button>}>
      {requests.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز درخواستی ثبت نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {requests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{r.clientName}{r.kind && <span style={{ color: 'var(--gold)', fontWeight: 600, marginRight: 8, fontSize: 12 }}>· {r.kind}</span>}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  {r.meta?.ptype && <span>{r.meta.ptype}</span>}
                  {r.meta?.area && <span> · {fa(Number(r.meta.area))} متر</span>}
                  {r.meta?.visit && <span> · بازدید: {r.meta.visit}</span>}
                  {r.clientPhone && <span style={{ direction: 'ltr', display: 'inline-block', marginRight: 8 }}>{r.clientPhone}</span>}
                </div>
              </div>
              {!!r.amount && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>{money(r.amount)}</span>}
              {r.status !== 'done' && <button onClick={() => onReport(r)} style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>صدورِ گزارش</button>}
              <button onClick={() => post({ action: 'updateRequest', id: r.id, patch: { status: NEXT[r.status] } })} title="تغییرِ وضعیت" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}><StatusPill st={r.status} /></button>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRequest', id: r.id }) }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {open && (
        <Modal title="درخواستِ ارزیابیِ جدید" onClose={() => setOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="نامِ متقاضی" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} style={inputStyle} />
            <input placeholder="شمارهٔ تماس" value={f.clientPhone} onChange={e => setF({ ...f, clientPhone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{APPRAISAL_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <select value={f.ptype} onChange={e => setF({ ...f, ptype: e.target.value })} style={inputStyle}>{PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <input placeholder="متراژ (متر)" value={f.area} onChange={e => setF({ ...f, area: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="ارزشِ هر متر (تومان)" value={f.vpm} onChange={e => setF({ ...f, vpm: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'var(--muted)', marginBottom: -4 }}>تاریخِ بازدید</div>
            <JalaliPicker jy={f.jy} jm={f.jm} jd={f.jd} baseYear={today.jy} onChange={v => setF({ ...f, ...v })} />
            <input placeholder="توضیح" value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          </div>
          <div style={{ marginTop: 12, padding: '11px 14px', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>ارزشِ برآوردی</span><span style={{ color: 'var(--gold)' }}>{value ? money(value) : '—'}</span>
          </div>
          <button onClick={save} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>ثبتِ درخواست</button>
        </Modal>
      )}
    </SectionCard>
  )
}

// ── مودالِ صدورِ گزارش (از یک درخواست) ────────────────────────────────────────
function ReportModal({ req, post, onClose }: { req: ProRequest; post: (p: any) => Promise<any>; onClose: () => void }) {
  const [f, setF] = useState<{ caseNo: string; date: string; kind: string; amount: string; note: string; file?: { url: string; name: string } }>({ caseNo: caseNo(), date: today(), kind: REPORT_TYPES[0], amount: String(req.amount || ''), note: '', file: undefined })
  const issue = async () => {
    await post({ action: 'addRecord', title: req.clientName, subtitle: f.note, kind: f.kind, amount: Number(f.amount) || undefined, status: 'archived', meta: { caseNo: f.caseNo, date: f.date, ptype: req.meta?.ptype, area: req.meta?.area, file: f.file } })
    await post({ action: 'updateRequest', id: req.id, patch: { status: 'done' } })
    onClose()
  }
  return (
    <Modal title={`صدورِ گزارشِ کارشناسی — ${req.clientName}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input placeholder="شمارهٔ پرونده" value={f.caseNo} onChange={e => setF({ ...f, caseNo: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
        <input placeholder="تاریخ" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} style={inputStyle} />
        <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{REPORT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
        <input placeholder="ارزشِ نهایی (تومان)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
        <textarea placeholder="خلاصهٔ نظرِ کارشناسی" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1', minHeight: 70, resize: 'vertical' }} />
        <FileField value={f.file} onChange={v => setF({ ...f, file: v })} label="📎 پیوستِ فایلِ گزارش (تصویر یا PDF)" />
      </div>
      <button onClick={issue} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>صدور و بایگانی</button>
    </Modal>
  )
}

// ── گزارش‌های صادرشده ────────────────────────────────────────────────────────
function Reports({ records, post }: { records: ProRecord[]; post: (p: any) => Promise<any> }) {
  return (
    <SectionCard title="گزارش‌های کارشناسی">
      {records.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز گزارشی صادر نشده — از یک درخواست، «صدورِ گزارش» بزن.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
          {records.map(r => (
            <div key={r.id} style={{ ...card, padding: 14, position: 'relative' }}>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRecord', id: r.id }) }} style={{ position: 'absolute', top: 10, left: 10, border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--gold)', direction: 'ltr' }}>{r.meta?.caseNo || '—'}</span>
                {r.kind && <span style={{ fontSize: 10, padding: '1px 7px', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--muted)' }}>{r.kind}</span>}
              </div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{r.title}</div>
              {r.subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.7 }}>{r.subtitle}</div>}
              <FileLink file={r.meta?.file} />
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

export default function AppraiserPage() {
  const { data, authed, loading, post } = useProDesk(ROLE)
  const [view, setView] = useState('dashboard')
  const [reportReq, setReportReq] = useState<ProRequest | null>(null)
  const [today] = useState(() => jToday(new Date()))
  if (!loading && !authed) return <LoginGate />

  const nav = [
    { id: 'dashboard', label: 'داشبورد', icon: '▦', badge: data?.stats.open },
    { id: 'requests', label: 'درخواست‌ها', icon: '📥', badge: data?.stats.open },
    { id: 'calendar', label: 'تقویمِ بازدید', icon: '📆' },
    { id: 'reports', label: 'گزارش‌ها', icon: '📄' },
    { id: 'reportgen', label: 'صدورِ گزارش', icon: '🧾' },
    { id: 'aitools', label: 'برآوردِ هوشمند', icon: '✦' },
    { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
    { id: 'profile', label: 'پروفایل', icon: '🪪' },
    { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
    { id: 'support', label: 'پشتیبانی', icon: '🛟' },
  ]
  const shell: ShellCfg = { dash: ROLE, unit: 'کارشناسِ رسمی', icon: '📋', accent: '#8fbf7f', nav }
  const s = data?.stats
  const totalValue = data?.records.reduce((a, r) => a + (Number(r.amount) || 0), 0) || 0

  return (
    <Shell cfg={shell} active={view} setActive={setView} title={nav.find(n => n.id === view)?.label || 'داشبورد'}>
      {reportReq && <ReportModal req={reportReq} post={post} onClose={() => setReportReq(null)} />}
      {!data ? <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>در حال بارگذاری…</div> :
        view === 'dashboard' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
              <Kpi label="درخواست‌های باز" value={fa(s!.open)} accent="#8fbf7f" />
              <Kpi label="گزارش‌های صادرشده" value={fa(s!.records)} />
              <Kpi label="ارزشِ ارزیابی‌شده" value={money(totalValue)} accent="var(--gold)" />
              <Kpi label="درآمدِ کارشناسی" value={money(s!.revenue)} accent="#34d399" />
            </div>
            <Requests requests={data.requests} post={post} onReport={setReportReq} today={today} />
            <Reports records={data.records} post={post} />
          </>
        ) : view === 'requests' ? <Requests requests={data.requests} post={post} onReport={setReportReq} today={today} />
          : view === 'calendar' ? <ProCalendar items={visitCalItems(data.requests)} today={today} title="تقویمِ بازدیدها" />
            : view === 'reports' ? <Reports records={data.records} post={post} />
            : view === 'reportgen' ? <ReportStudio post={post} />
            : view === 'aitools' ? <ProAiTool accent="#8fa9c9" tools={[{ id: 'price_estimate', label: 'برآوردِ قیمتِ ملک', placeholder: 'منطقه، متراژ، سنِ بنا، طبقه و امکاناتِ ملک را بنویس تا بازهٔ قیمتِ منصفانه را بدهد…' }]} />
            : view === 'assistant' ? <div style={{ height: 'calc(100vh - 150px)' }}><AssistantPanel panel="appraiser" title="دستیارِ هوشمندِ کارشناس" subtitle="مشاورِ AI شخصیِ تو" suggestions={['روشِ ارزیابیِ یک آپارتمانِ ۱۰ ساله را توضیح بده', 'ساختارِ یک گزارشِ کارشناسیِ رسمی را بنویس', 'فاکتورهای مؤثر بر ارزشِ ملک را فهرست کن', 'نحوهٔ محاسبهٔ افتِ قیمت به‌خاطرِ خسارت؟']} /></div>
              : view === 'profile' ? (
                <>
                  <SectionCard title="پروفایلِ عمومی" action={<a href="/directory?category=کارشناس" style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>دیدنِ من در دایرکتوری ↗</a>}>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>پروفایلت را کامل کن تا در دایرکتوریِ «کارشناس» به متقاضیان نمایش داده شوی.</div>
                  </SectionCard>
                  <BusinessProfileForm />
                </>
              ) : view === 'plans' ? <PlansPanel dashboard={ROLE} /> : <SupportPanel panel="appraiser" />}
    </Shell>
  )
}
