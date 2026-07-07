'use client'
import { useState } from 'react'
import ReosPanelSection from '@/app/components/ReosPanelSection'
import AssistantPanel from '@/app/components/AssistantPanel'
import PlansPanel from '@/app/components/PlansPanel'
import SupportPanel from '@/app/components/SupportPanel'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'
import {
  Shell, useProDesk, Kpi, StatusPill, LoginGate, SectionCard, Modal, btnGold, ProAiTool,
  money, fa, card, inputStyle, type ProRecord, type ProRequest, type ReqStatus, type ShellCfg,
} from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «پیمانکار» — نسخهٔ تخصصی: پروژه‌های اجرایی با پیشرفتِ مرحله‌ای + برآورد/مناقصه.
const ROLE = '/contractor'
const STAGES = ['تجهیزِ کارگاه', 'فونداسیون', 'اسکلت', 'سفت‌کاری', 'تأسیسات', 'نازک‌کاری', 'تحویل']
const WORK_TYPES = ['ساخت از صفر', 'بازسازی', 'اسکلت', 'نازک‌کاری', 'تأسیسات', 'محوطه‌سازی']
const NEXT: Record<ReqStatus, ReqStatus> = { new: 'in_progress', in_progress: 'done', done: 'new', canceled: 'new' }
const stageOf = (r: ProRecord) => Math.max(0, Math.min(STAGES.length - 1, Number(r.meta?.stage) || 0))

// ── پروژه‌های اجرایی با پیشرفتِ مرحله‌ای ──────────────────────────────────────
function Projects({ records, post }: { records: ProRecord[]; post: (p: any) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', kind: WORK_TYPES[0], location: '', area: '', amount: '' })
  const save = async () => {
    if (!f.title.trim()) { alert('نامِ پروژه الزامی است'); return }
    const d = await post({ action: 'addRecord', title: f.title, kind: f.kind, subtitle: f.location, amount: Number(f.amount) || undefined, status: 'active', meta: { stage: 0, area: f.area } })
    if (d) { setF({ title: '', kind: WORK_TYPES[0], location: '', area: '', amount: '' }); setOpen(false) }
  }
  const advance = (r: ProRecord) => {
    const st = stageOf(r)
    if (st >= STAGES.length - 1) return post({ action: 'updateRecord', id: r.id, patch: { status: 'archived' } })
    return post({ action: 'updateRecord', id: r.id, patch: { meta: { ...(r.meta || {}), stage: st + 1 } } })
  }
  return (
    <SectionCard title="پروژه‌های اجرایی" action={<button onClick={() => setOpen(true)} style={btnGold}>＋ پروژهٔ جدید</button>}>
      {records.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز پروژه‌ای ثبت نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {records.map(r => {
            const st = stageOf(r), done = r.status === 'archived', pct = done ? 100 : Math.round((st / (STAGES.length - 1)) * 100)
            return (
              <div key={r.id} style={{ ...card, padding: 15 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{r.title}{r.kind && <span style={{ color: 'var(--gold)', fontWeight: 600, marginRight: 8, fontSize: 12 }}>· {r.kind}</span>}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{[r.subtitle, r.meta?.area && `${fa(Number(r.meta.area))} متر`].filter(Boolean).join(' · ')}</div>
                  </div>
                  {!!r.amount && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>{money(r.amount)}</span>}
                  <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRecord', id: r.id }) }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
                </div>
                {/* نوارِ پیشرفتِ مرحله‌ای */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: done ? '#34d399' : 'var(--gold)' }}>{done ? '✓ تحویل شد' : `مرحله: ${STAGES[st]}`}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{fa(pct)}٪</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 5, background: 'var(--bg2)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: done ? '#34d399' : 'linear-gradient(90deg,var(--gold2),var(--gold))', transition: 'width .3s' }} />
                  </div>
                  {!done && <button onClick={() => advance(r)} style={{ marginTop: 10, padding: '6px 13px', borderRadius: 8, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{st >= STAGES.length - 1 ? 'ثبتِ تحویل ✓' : `مرحلهٔ بعد › ${STAGES[st + 1]}`}</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {open && (
        <Modal title="پروژهٔ اجراییِ جدید" onClose={() => setOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="نامِ پروژه" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
            <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={inputStyle}>{WORK_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <input placeholder="موقعیت / محله" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} style={inputStyle} />
            <input placeholder="متراژِ زیربنا (متر)" value={f.area} onChange={e => setF({ ...f, area: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="ارزشِ قرارداد (تومان)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
          </div>
          <button onClick={save} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>ثبتِ پروژه</button>
        </Modal>
      )}
    </SectionCard>
  )
}

// ── برآورد و مناقصه (با محاسبهٔ خودکارِ قیمتِ هر متر) ──────────────────────────
function Tenders({ requests, post }: { requests: ProRequest[]; post: (p: any) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ clientName: '', clientPhone: '', kind: WORK_TYPES[0], area: '', ppm: '', detail: '' })
  const estimate = (Number(f.area) || 0) * (Number(f.ppm) || 0)
  const save = async () => {
    if (!f.clientName.trim()) { alert('نامِ کارفرما الزامی است'); return }
    const d = await post({ action: 'addRequest', clientName: f.clientName, clientPhone: f.clientPhone, kind: f.kind, amount: estimate || undefined, detail: f.detail, meta: { area: f.area, ppm: f.ppm } })
    if (d) { setF({ clientName: '', clientPhone: '', kind: WORK_TYPES[0], area: '', ppm: '', detail: '' }); setOpen(false) }
  }
  return (
    <SectionCard title="برآوردها و مناقصه‌ها" action={<button onClick={() => setOpen(true)} style={btnGold}>＋ برآوردِ جدید</button>}>
      {requests.length === 0 ? <div style={{ color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>هنوز برآوردی ثبت نشده.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {requests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{r.clientName}{r.kind && <span style={{ color: 'var(--gold)', fontWeight: 600, marginRight: 8, fontSize: 12 }}>· {r.kind}</span>}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  {r.meta?.area && <span>{fa(Number(r.meta.area))} متر</span>}
                  {r.meta?.ppm && <span> × {money(Number(r.meta.ppm))}/متر</span>}
                  {r.clientPhone && <span style={{ direction: 'ltr', display: 'inline-block', marginRight: 8 }}>{r.clientPhone}</span>}
                </div>
                {r.detail && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{r.detail}</div>}
              </div>
              {!!r.amount && <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>{money(r.amount)}</span>}
              <button onClick={() => post({ action: 'updateRequest', id: r.id, patch: { status: NEXT[r.status] } })} title="تغییرِ وضعیت" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}><StatusPill st={r.status} /></button>
              <button onClick={() => { if (confirm('حذف شود؟')) post({ action: 'deleteRequest', id: r.id }) }} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {open && (
        <Modal title="برآوردِ جدید" onClose={() => setOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="نامِ کارفرما" value={f.clientName} onChange={e => setF({ ...f, clientName: e.target.value })} style={inputStyle} />
            <input placeholder="شمارهٔ تماس" value={f.clientPhone} onChange={e => setF({ ...f, clientPhone: e.target.value })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }}>{WORK_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <input placeholder="متراژ (متر)" value={f.area} onChange={e => setF({ ...f, area: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="قیمتِ هر متر (تومان)" value={f.ppm} onChange={e => setF({ ...f, ppm: e.target.value.replace(/\D/g, '') })} style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
            <input placeholder="توضیح" value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          </div>
          <div style={{ marginTop: 12, padding: '11px 14px', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>برآوردِ کل</span>
            <span style={{ color: 'var(--gold)' }}>{estimate ? money(estimate) : '—'}</span>
          </div>
          <button onClick={save} style={{ ...btnGold, width: '100%', marginTop: 14, padding: 11 }}>ثبتِ برآورد</button>
        </Modal>
      )}
    </SectionCard>
  )
}

export default function ContractorPage() {
  const { data, authed, loading, post } = useProDesk(ROLE)
  const [view, setView] = useState('dashboard')
  if (!loading && !authed) return <LoginGate />

  const active = data?.records.filter(r => r.status === 'active').length || 0
  const completed = data?.records.filter(r => r.status === 'archived').length || 0
  const nav = [
    { id: 'dashboard', label: 'داشبورد', icon: '▦', badge: data?.stats.open },
    { id: 'projects', label: 'پروژه‌ها', icon: '🏗' },
    { id: 'tenders', label: 'برآورد و مناقصه', icon: '📐', badge: data?.stats.open },
    { id: 'aitools', label: 'برآوردِ هوشمند', icon: '✦' },
    { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
    { id: 'profile', label: 'پروفایل', icon: '🪪' },
    { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
    { id: 'support', label: 'پشتیبانی', icon: '🛟' },
  ]
  const shell: ShellCfg = { dash: ROLE, unit: 'پیمانکار', icon: '🛠', accent: '#d69a5c', nav }
  const s = data?.stats

  return (
    <Shell cfg={shell} active={view} setActive={setView} title={nav.find(n => n.id === view)?.label || 'داشبورد'}>
      {!data ? <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>در حال بارگذاری…</div> :
        view === 'dashboard' ? (
          <>
            <div style={{ marginBottom: 18 }}><ReosPanelSection title="فایل‌های پیشنهادیِ REOS" subtitle="بر اساسِ تقاضای زندهٔ بازار" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
              <Kpi label="برآوردِ باز" value={fa(s!.open)} accent="#d69a5c" />
              <Kpi label="پروژه‌های فعال" value={fa(active)} />
              <Kpi label="تکمیل‌شده" value={fa(completed)} accent="#34d399" />
              <Kpi label="ارزشِ قراردادها" value={money(s!.revenue + data.records.reduce((a, r) => a + (Number(r.amount) || 0), 0))} accent="var(--gold)" />
            </div>
            <Projects records={data.records} post={post} />
            <Tenders requests={data.requests} post={post} />
          </>
        ) : view === 'projects' ? <Projects records={data.records} post={post} />
          : view === 'tenders' ? <Tenders requests={data.requests} post={post} />
            : view === 'aitools' ? <ProAiTool accent="#d69a5c" tools={[{ id: 'cost_estimate', label: 'تخمینِ هزینهٔ ساخت', placeholder: 'متراژ، تعداد طبقات، نوعِ سازه و کیفیتِ موردنظر را بنویس…' }, { id: 'design_idea', label: 'راهکارِ اجرا', placeholder: 'شرحِ کارِ اجرایی را بنویس تا راهکار و نکاتِ فنی بدهد…' }]} />
            : view === 'assistant' ? <div style={{ height: 'calc(100vh - 150px)' }}><AssistantPanel panel="contractor" title="دستیارِ هوشمندِ پیمانکار" subtitle="مشاورِ AI شخصیِ تو" suggestions={['یک برآوردِ اولیهٔ هزینهٔ ساختِ بنای ۲۰۰ متری بده', 'چک‌لیستِ کنترلِ کیفیتِ سفت‌کاری را بنویس', 'متنِ پیشنهادِ قیمت برای یک مناقصه بنویس', 'چطور تیمِ اجراییِ منظم بسازم؟']} /></div>
              : view === 'profile' ? (
                <>
                  <SectionCard title="پروفایلِ عمومی" action={<a href="/directory?category=پیمانکار" style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>دیدنِ من در دایرکتوری ↗</a>}>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>پروفایلت را کامل کن تا در دایرکتوریِ «پیمانکار» به کارفرمایان نمایش داده شوی.</div>
                  </SectionCard>
                  <BusinessProfileForm />
                </>
              ) : view === 'plans' ? <PlansPanel dashboard={ROLE} /> : <SupportPanel panel="contractor" />}
    </Shell>
  )
}
