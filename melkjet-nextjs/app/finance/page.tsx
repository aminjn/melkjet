'use client'
import { useState } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'
import PlansPanel from '@/app/components/PlansPanel'
import SupportPanel from '@/app/components/SupportPanel'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'
import {
  Shell, useProDesk, Kpi, LoginGate, SectionCard, Modal, btnGold, ProAiTool, ProLoanCalc,
  money, fa, card, inputStyle, type ProRecord, type ProRequest, type ReqStatus, type ShellCfg,
} from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «بانک و بیمه» — نسخهٔ تخصصی: محصولات (تسهیلات/بیمه) + متقاضیان با محاسبهٔ قسط/حق‌بیمه + گردشِ تأیید.
const ROLE = '/finance'
const PRODUCT_TYPES = ['تسهیلات', 'بیمه‌نامه', 'سپرده', 'ضمانت‌نامه']
const APPLICANT_PRODUCTS = ['وامِ مسکن', 'وامِ ساخت', 'وامِ ودیعه', 'بیمهٔ آتش‌سوزی', 'بیمهٔ عمر', 'بیمهٔ مسئولیت']
const isLoan = (k?: string) => !!k && k.includes('وام')

// قسطِ ماهانهٔ وام (استهلاکی) یا حقِ بیمهٔ سالانه.
function calc(kind: string, principal: number, ratePct: number, months: number): { label: string; value: number } {
  if (isLoan(kind)) {
    const r = ratePct / 100 / 12, n = Math.max(1, months)
    const pay = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n))
    return { label: 'قسطِ ماهانه', value: Math.round(pay) }
  }
  return { label: 'حقِ بیمهٔ سالانه', value: Math.round(principal * ratePct / 100) }
}

const FIN_LABEL: Record<ReqStatus, string> = { new: 'در انتظار', in_progress: 'در حالِ بررسی', done: 'تأیید', canceled: 'رد' }
const FIN_COLOR: Record<ReqStatus, string> = { new: '#f59e0b', in_progress: '#60a5fa', done: '#34d399', canceled: '#ef4444' }
function FinPill({ st }: { st: ReqStatus }) {
  const c = FIN_COLOR[st]
  return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: `color-mix(in srgb, ${c} 16%, transparent)`, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>{FIN_LABEL[st]}</span>
}

// ── محصولات و طرح‌ها ─────────────────────────────────────────────────────────
function Products({ records, post }: { records: ProRecord[]; post: (p: any) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', kind: PRODUCT_TYPES[0], rate: '', cap: '', term: '' })
  const save = async () => {
    if (!f.title.trim()) { alert('نامِ طرح الزامی است'); return }
    const d = await post({ action: 'addRecord', title: f.title, kind: f.kind, amount: Number(f.cap) || undefined, subtitle: [f.rate && `نرخ ${f.rate}٪`, f.term && `${f.term} ماه`].filter(Boolean).join(' · '), meta: { rate: f.rate, term: f.term } })
    if (d) { setF({ title: '', kind: PRODUCT_TYPES[0], rate: '', cap: '', term: '' }); setOpen(false) }
  }
  return (
    <SectionCard title="محصولات و طرح‌ها" action={<button onClick={() => setOpen(true)} style={btnGold}>＋ طرحِ جدید</button>}>
      {records.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز طرحی تعریف نشده.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {records.map(r => (
            <div key={r.id} style={{ ...card, padding: 14, position: 'relative' }}>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRecord', id: r.id }) }} style={{ position: 'absolute', top: 10, left: 10, border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
              {r.kind && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6fae8f', marginBottom: 5 }}>{r.kind}</div>}
              <div style={{ fontWeight: 800, fontSize: 14 }}>{r.title}</div>
              {r.subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{r.subtitle}</div>}
              {!!r.amount && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginTop: 8 }}>سقف: {money(r.amount)}</div>}
            </div>
          ))}
        </div>
      )}
      {open && (
        <Modal title="طرحِ جدید" onClose={() => setOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="نامِ طرح" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
            <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{PRODUCT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <input placeholder="نرخ (٪)" value={f.rate} onChange={e => setF({ ...f, rate: e.target.value.replace(/[^\d.]/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="سقف / مبلغ (تومان)" value={f.cap} onChange={e => setF({ ...f, cap: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="مدت (ماه)" value={f.term} onChange={e => setF({ ...f, term: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
          </div>
          <button onClick={save} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>ثبتِ طرح</button>
        </Modal>
      )}
    </SectionCard>
  )
}

// ── متقاضیان (وام/بیمه) با محاسبه و گردشِ تأیید ────────────────────────────────
function Applicants({ requests, post }: { requests: ProRequest[]; post: (p: any) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ clientName: '', clientPhone: '', kind: APPLICANT_PRODUCTS[0], amount: '', rate: '', term: '' })
  const c = calc(f.kind, Number(f.amount) || 0, Number(f.rate) || 0, Number(f.term) || 0)
  const save = async () => {
    if (!f.clientName.trim()) { alert('نامِ متقاضی الزامی است'); return }
    const d = await post({ action: 'addRequest', clientName: f.clientName, clientPhone: f.clientPhone, kind: f.kind, amount: Number(f.amount) || undefined, meta: { rate: f.rate, term: f.term, calcLabel: c.label, calcValue: c.value } })
    if (d) { setF({ clientName: '', clientPhone: '', kind: APPLICANT_PRODUCTS[0], amount: '', rate: '', term: '' }); setOpen(false) }
  }
  const set = (r: ProRequest, status: ReqStatus) => post({ action: 'updateRequest', id: r.id, patch: { status } })
  return (
    <SectionCard title="متقاضیانِ وام و بیمه" action={<button onClick={() => setOpen(true)} style={btnGold}>＋ متقاضیِ جدید</button>}>
      {requests.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز متقاضی‌ای ثبت نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {requests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{r.clientName}{r.kind && <span style={{ color: '#6fae8f', fontWeight: 600, marginRight: 8, fontSize: 12 }}>· {r.kind}</span>}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  {!!r.amount && <span>مبلغ: {money(r.amount)}</span>}
                  {r.meta?.calcValue && <span> · {r.meta.calcLabel}: <b style={{ color: 'var(--gold)' }}>{money(Number(r.meta.calcValue))}</b></span>}
                  {r.clientPhone && <span style={{ direction: 'ltr', display: 'inline-block', marginRight: 8 }}>{r.clientPhone}</span>}
                </div>
              </div>
              <FinPill st={r.status} />
              {r.status !== 'done' && <button onClick={() => set(r, 'done')} title="تأیید" style={{ border: '1px solid #34d399', background: 'transparent', color: '#34d399', borderRadius: 8, padding: '4px 10px', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>✓ تأیید</button>}
              {r.status !== 'canceled' && <button onClick={() => set(r, 'canceled')} title="رد" style={{ border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', borderRadius: 8, padding: '4px 10px', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>✗ رد</button>}
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRequest', id: r.id }) }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {open && (
        <Modal title="متقاضیِ جدید" onClose={() => setOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="نامِ متقاضی" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} style={inputStyle} />
            <input placeholder="شمارهٔ تماس" value={f.clientPhone} onChange={e => setF({ ...f, clientPhone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }}>{APPLICANT_PRODUCTS.map(t => <option key={t}>{t}</option>)}</select>
            <input placeholder={isLoan(f.kind) ? 'مبلغِ وام (تومان)' : 'سرمایهٔ بیمه (تومان)'} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="نرخ (٪)" value={f.rate} onChange={e => setF({ ...f, rate: e.target.value.replace(/[^\d.]/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            {isLoan(f.kind) && <input placeholder="مدت (ماه)" value={f.term} onChange={e => setF({ ...f, term: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />}
          </div>
          <div style={{ marginTop: 12, padding: '11px 14px', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>{c.label}</span><span style={{ color: 'var(--gold)' }}>{c.value ? money(c.value) : '—'}</span>
          </div>
          <button onClick={save} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>ثبتِ متقاضی</button>
        </Modal>
      )}
    </SectionCard>
  )
}

export default function FinancePage() {
  const { data, authed, loading, post } = useProDesk(ROLE)
  const [view, setView] = useState('dashboard')
  if (!loading && !authed) return <LoginGate />

  const approved = data?.requests.filter(r => r.status === 'done').length || 0
  const nav = [
    { id: 'dashboard', label: 'داشبورد', icon: '▦', badge: data?.stats.open },
    { id: 'applicants', label: 'متقاضیان', icon: '📥', badge: data?.stats.open },
    { id: 'products', label: 'محصولات', icon: '💳' },
    { id: 'aitools', label: 'محاسبه‌گر و AI', icon: '✦' },
    { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
    { id: 'profile', label: 'پروفایل', icon: '🪪' },
    { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
    { id: 'support', label: 'پشتیبانی', icon: '🛟' },
  ]
  const shell: ShellCfg = { dash: ROLE, unit: 'بانک و بیمه', icon: '🏦', accent: '#6fae8f', nav }

  return (
    <Shell cfg={shell} active={view} setActive={setView} title={nav.find(n => n.id === view)?.label || 'داشبورد'}>
      {!data ? <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>در حال بارگذاری…</div> :
        view === 'dashboard' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
              <Kpi label="متقاضیانِ در انتظار" value={fa(data.stats.open)} accent="#6fae8f" />
              <Kpi label="تأییدشده" value={fa(approved)} accent="#34d399" />
              <Kpi label="محصولات و طرح‌ها" value={fa(data.stats.records)} />
              <Kpi label="ارزشِ تأییدشده" value={money(data.stats.revenue)} accent="var(--gold)" />
            </div>
            <Applicants requests={data.requests} post={post} />
            <Products records={data.records} post={post} />
          </>
        ) : view === 'applicants' ? <Applicants requests={data.requests} post={post} />
          : view === 'products' ? <Products records={data.records} post={post} />
            : view === 'aitools' ? <><ProLoanCalc /><ProAiTool accent="#6fae8f" tools={[{ id: 'loan_risk', label: 'تحلیلِ ریسکِ وام', placeholder: 'درآمد، شغل، سابقهٔ اعتباری و مبلغِ درخواستیِ متقاضی را بنویس…' }, { id: 'loan_advice', label: 'پیشنهادِ وام/بیمه', placeholder: 'نیازِ مشتری را بنویس تا مناسب‌ترین محصول را پیشنهاد دهد…' }]} /></>
            : view === 'assistant' ? <div style={{ height: 'calc(100vh - 150px)' }}><AssistantPanel panel="finance" title="دستیارِ هوشمندِ بانک و بیمه" subtitle="مشاورِ AI شخصیِ تو" suggestions={['شرایطِ وامِ مسکنِ اوراق را خلاصه کن', 'تفاوتِ بیمهٔ آتش‌سوزیِ ساده و جامع چیست؟', 'یک متنِ معرفیِ طرحِ تسهیلاتِ ساخت بنویس', 'مدارکِ لازم برای وامِ ساخت را فهرست کن']} /></div>
              : view === 'profile' ? (
                <>
                  <SectionCard title="پروفایلِ عمومی" action={<a href="/directory?category=بیمه" style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>دیدنِ من در دایرکتوری ↗</a>}>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>پروفایلت را کامل کن تا در دایرکتوریِ «بیمه» به متقاضیان نمایش داده شوی.</div>
                  </SectionCard>
                  <BusinessProfileForm />
                </>
              ) : view === 'plans' ? <PlansPanel dashboard={ROLE} /> : <SupportPanel panel="finance" />}
    </Shell>
  )
}
