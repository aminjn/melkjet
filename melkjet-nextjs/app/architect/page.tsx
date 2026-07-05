'use client'
import { useState } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'
import PlansPanel from '@/app/components/PlansPanel'
import SupportPanel from '@/app/components/SupportPanel'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'
import ImageUpload from '@/app/components/ImageUpload'
import {
  Shell, useProDesk, Kpi, StatusPill, LoginGate, SectionCard, FileField, FileLink,
  money, fa, card, inputStyle, FONT, type ProRecord, type ProRequest, type ReqStatus, type ShellCfg,
} from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «معمار و طراح داخلی» — نسخهٔ تخصصی: نمونه‌کارِ تصویری + قیفِ استعلامِ طراحی.
const ROLE = '/architect'
const PROJECT_TYPES = ['مسکونی', 'اداری', 'تجاری', 'ویلایی', 'رستوران', 'فروشگاه']
const STYLES = ['مدرن', 'کلاسیک', 'مینیمال', 'نئوکلاسیک', 'صنعتی', 'اسکاندیناوی']
const SPACE_TYPES = ['کلِ واحد', 'پذیرایی', 'آشپزخانه', 'اتاق‌خواب', 'نما', 'محوطه']
const NEXT: Record<ReqStatus, ReqStatus> = { new: 'in_progress', in_progress: 'done', done: 'new', canceled: 'new' }

const btnGold: React.CSSProperties = { padding: '8px 15px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }
const chip = (t: string) => <span key={t} style={{ fontSize: 10.5, padding: '2px 8px', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--muted)' }}>{t}</span>

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

// ── گالریِ نمونه‌کار ──────────────────────────────────────────────────────────
function Portfolio({ records, post }: { records: ProRecord[]; post: (p: any) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<{ title: string; kind: string; style: string; area: string; amount: string; cover: string; file?: { url: string; name: string } }>({ title: '', kind: PROJECT_TYPES[0], style: STYLES[0], area: '', amount: '', cover: '', file: undefined })
  const save = async () => {
    if (!f.title.trim()) { alert('نامِ پروژه الزامی است'); return }
    const d = await post({ action: 'addRecord', title: f.title, kind: f.kind, cover: f.cover, amount: Number(f.amount) || undefined, meta: { style: f.style, area: f.area, file: f.file }, subtitle: [f.style, f.area && `${f.area} متر`].filter(Boolean).join(' · ') })
    if (d) { setF({ title: '', kind: PROJECT_TYPES[0], style: STYLES[0], area: '', amount: '', cover: '', file: undefined }); setOpen(false) }
  }
  return (
    <SectionCard title="نمونه‌کارها و پروژه‌ها" action={<button onClick={() => setOpen(true)} style={btnGold}>＋ نمونه‌کار جدید</button>}>
      {records.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز نمونه‌کاری اضافه نکرده‌ای — با تصویر، پروفایلت حرفه‌ای‌تر دیده می‌شود.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14 }}>
          {records.map(r => (
            <div key={r.id} style={{ ...card, overflow: 'hidden', position: 'relative' }}>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRecord', id: r.id }) }} style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', cursor: 'pointer', fontSize: 15 }}>×</button>
              <div style={{ height: 130, background: r.cover ? `center/cover no-repeat url(${r.cover})` : 'linear-gradient(135deg,var(--bg2),var(--surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 30 }}>{!r.cover && '🖼'}</div>
              <div style={{ padding: 12 }}>
                {r.kind && <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>{r.kind}</div>}
                <div style={{ fontWeight: 800, fontSize: 14 }}>{r.title}</div>
                {r.subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{r.subtitle}</div>}
                <FileLink file={r.meta?.file} />
                {!!r.amount && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginTop: 7 }}>{money(r.amount)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <Modal title="نمونه‌کارِ جدید" onClose={() => setOpen(false)}>
          <ImageUpload value={f.cover} height={150} label="تصویرِ شاخصِ پروژه" onChange={v => setF({ ...f, cover: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <input placeholder="نامِ پروژه" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
            <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <select value={f.style} onChange={e => setF({ ...f, style: e.target.value })} style={inputStyle}>{STYLES.map(t => <option key={t}>{t}</option>)}</select>
            <input placeholder="متراژ (متر)" value={f.area} onChange={e => setF({ ...f, area: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="مبلغِ قرارداد (تومان)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <FileField value={f.file} onChange={v => setF({ ...f, file: v })} label="📎 نقشه / فایلِ پروژه (تصویر یا PDF)" />
          </div>
          <button onClick={save} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>افزودن به نمونه‌کارها</button>
        </Modal>
      )}
    </SectionCard>
  )
}

// ── قیفِ استعلامِ طراحی ───────────────────────────────────────────────────────
function Inquiries({ requests, post }: { requests: ProRequest[]; post: (p: any) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ clientName: '', clientPhone: '', kind: SPACE_TYPES[0], area: '', style: STYLES[0], amount: '', detail: '' })
  const save = async () => {
    if (!f.clientName.trim()) { alert('نامِ متقاضی الزامی است'); return }
    const d = await post({ action: 'addRequest', clientName: f.clientName, clientPhone: f.clientPhone, kind: f.kind, amount: Number(f.amount) || undefined, detail: f.detail, meta: { style: f.style, area: f.area } })
    if (d) { setF({ clientName: '', clientPhone: '', kind: SPACE_TYPES[0], area: '', style: STYLES[0], amount: '', detail: '' }); setOpen(false) }
  }
  return (
    <SectionCard title="استعلام‌های طراحی" action={<button onClick={() => setOpen(true)} style={btnGold}>＋ استعلامِ جدید</button>}>
      {requests.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز استعلامی ثبت نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {requests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{r.clientName}{r.kind && <span style={{ color: 'var(--gold)', fontWeight: 600, marginRight: 8, fontSize: 12 }}>· {r.kind}</span>}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {r.meta?.style && chip(r.meta.style)}
                  {r.meta?.area && chip(`${fa(Number(r.meta.area))} متر`)}
                  {r.clientPhone && <span style={{ fontSize: 11, color: 'var(--muted)', direction: 'ltr' }}>{r.clientPhone}</span>}
                </div>
                {r.detail && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>{r.detail}</div>}
              </div>
              {!!r.amount && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>{money(r.amount)}</span>}
              <button onClick={() => post({ action: 'updateRequest', id: r.id, patch: { status: NEXT[r.status] } })} title="تغییرِ مرحله" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}><StatusPill st={r.status} /></button>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRequest', id: r.id }) }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {open && (
        <Modal title="استعلامِ طراحیِ جدید" onClose={() => setOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="نامِ متقاضی" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} style={inputStyle} />
            <input placeholder="شمارهٔ تماس" value={f.clientPhone} onChange={e => setF({ ...f, clientPhone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{SPACE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <select value={f.style} onChange={e => setF({ ...f, style: e.target.value })} style={inputStyle}>{STYLES.map(t => <option key={t}>{t}</option>)}</select>
            <input placeholder="متراژ (متر)" value={f.area} onChange={e => setF({ ...f, area: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="بودجه (تومان)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="توضیحِ خواسته" value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          </div>
          <button onClick={save} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>ثبتِ استعلام</button>
        </Modal>
      )}
    </SectionCard>
  )
}

export default function ArchitectPage() {
  const { data, authed, loading, post } = useProDesk(ROLE)
  const [view, setView] = useState('dashboard')
  if (!loading && !authed) return <LoginGate />

  const nav = [
    { id: 'dashboard', label: 'داشبورد', icon: '▦', badge: data?.stats.open },
    { id: 'portfolio', label: 'نمونه‌کارها', icon: '🖼' },
    { id: 'inquiries', label: 'استعلام‌ها', icon: '✉', badge: data?.stats.open },
    { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
    { id: 'profile', label: 'پروفایل', icon: '🪪' },
    { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
    { id: 'support', label: 'پشتیبانی', icon: '🛟' },
  ]
  const shell: ShellCfg = { dash: ROLE, unit: 'معمار و طراح', icon: '📐', accent: '#7bb0d6', nav }
  const s = data?.stats
  const inProgress = data?.records.filter(r => r.status === 'active').length || 0

  return (
    <Shell cfg={shell} active={view} setActive={setView} title={nav.find(n => n.id === view)?.label || 'داشبورد'}>
      {!data ? <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>در حال بارگذاری…</div> :
        view === 'dashboard' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
              <Kpi label="استعلام‌های باز" value={fa(s!.open)} accent="#7bb0d6" />
              <Kpi label="پروژه‌های در جریان" value={fa(inProgress)} />
              <Kpi label="نمونه‌کارها" value={fa(s!.records)} />
              <Kpi label="درآمدِ طراحی" value={money(s!.revenue)} accent="var(--gold)" />
            </div>
            <Inquiries requests={data.requests} post={post} />
            <Portfolio records={data.records} post={post} />
          </>
        ) : view === 'portfolio' ? <Portfolio records={data.records} post={post} />
          : view === 'inquiries' ? <Inquiries requests={data.requests} post={post} />
            : view === 'assistant' ? <div style={{ height: 'calc(100vh - 150px)' }}><AssistantPanel panel="architect" title="دستیارِ هوشمندِ معمار" subtitle="مشاورِ AI شخصیِ تو" suggestions={['ایده‌های طراحیِ داخلیِ یک واحدِ ۸۵ متری بده', 'یک متنِ معرفیِ حرفه‌ای برای پروفایلم بنویس', 'برآوردِ هزینهٔ بازسازیِ آشپزخانه را توضیح بده', 'ترندهای طراحیِ داخلیِ امسال چیست؟']} /></div>
              : view === 'profile' ? (
                <>
                  <SectionCard title="پروفایلِ عمومی" action={<a href="/directory?category=معمار" style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>دیدنِ من در دایرکتوری ↗</a>}>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>پروفایلت را کامل کن تا در دایرکتوریِ «معمار» به متقاضیان نمایش داده شوی.</div>
                  </SectionCard>
                  <BusinessProfileForm />
                </>
              ) : view === 'plans' ? <PlansPanel dashboard={ROLE} /> : <SupportPanel panel="architect" />}
    </Shell>
  )
}
