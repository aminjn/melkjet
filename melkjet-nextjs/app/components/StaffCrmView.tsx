'use client'
// 📞 فاز ۱۱۶ — CRM مرکزیِ پرسنل: همهٔ مشتریانِ واقعیِ سایت + ثبت/پیگیریِ تماس‌ها توسطِ پرسنل.
import { useCallback, useEffect, useState } from 'react'
// فاز ۱۳۹ (فیدبک: «خیلی جاها مثل CRM تاریخ میلادی است»): اینپوتِ خامِ datetime-local مرورگر
// همیشه میلادی نشان می‌دهد — به‌جایش تقویمِ شمسیِ خودمان.
import JalaliDatePicker from './JalaliDatePicker'

// برچسب‌های وضعیت (کپیِ کلاینتیِ staff-crm-store — آن استور سروری است و fs دارد)
const STAFF_CRM_STATUS_FA: Record<string, string> = { new: 'جدید', follow: 'در حالِ پیگیری', customer: 'مشتری شد', lost: 'از دست رفت' }

const FONT = "'Vazirmatn', system-ui, sans-serif"
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
const faDate = (t?: number) => t ? new Date(t).toLocaleDateString('fa-IR') : '—'
const faDT = (t?: number) => t ? new Date(t).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }
const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 11px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }
const btn: React.CSSProperties = { background: 'linear-gradient(140deg,var(--gold2,#e9cd7a),var(--gold))', color: '#16140f', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 10, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
const ST_COLOR: Record<string, string> = { new: 'var(--muted)', follow: '#e7a14a', customer: '#5fd98a', lost: '#e88' }
const KIND_FA: Record<string, string> = { call: '📞 تماس', follow: '⏰ پیگیری', note: '📝 یادداشت', sms: '✉️ پیامک' }

export default function StaffCrmView() {
  const [rows, setRows] = useState<any[]>([])
  const [dueToday, setDueToday] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [sel, setSel] = useState<any>(null)          // مشتریِ باز در کشو
  const [entry, setEntry] = useState<any>(null)
  const [actKind, setActKind] = useState('call')
  const [actText, setActText] = useState('')
  const [actDue, setActDue] = useState('')
  const [actDueTs, setActDueTs] = useState(0)   // فاز ۱۳۹: تایم‌استمپِ انتخابِ تقویمِ شمسی
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [mine, setMine] = useState(false)          // «فقط کارهای من»
  const [stats, setStats] = useState<any>(null)
  const [prof, setProf] = useState<any>(null)      // پروندهٔ ۳۶۰ (تیکت/سفارش/امپراتوری/علاقه‌مندی)
  const [smsTxt, setSmsTxt] = useState('')
  const [tab, setTab] = useState<'customers' | 'tasks' | 'follow' | 'report'>('customers')   // فاز ۱۲۲/۱۲۳: زیرمنو
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [doneRecent, setDoneRecent] = useState<any[]>([])
  const [report, setReport] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])          // فاز ۱۲۳: وظایفِ تیمی
  const [meName, setMeName] = useState('')
  const [tTitle, setTTitle] = useState('')
  const [tAssign, setTAssign] = useState('')
  const [tPhone, setTPhone] = useState('')
  const [tDue, setTDue] = useState('')
  const [tDueTs, setTDueTs] = useState(0)   // فاز ۱۳۹: تایم‌استمپِ انتخابِ تقویمِ شمسی

  const load = useCallback(() => {
    fetch(`/api/admin/staff-crm?q=${encodeURIComponent(q)}&status=${status}&mine=${mine ? 1 : 0}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ok) { setRows(d.rows); setTotal(d.total); setDueToday(d.dueToday || []); setStats(d.stats || null); setUpcoming(d.upcoming || []); setDoneRecent(d.doneRecent || []); setReport(d.report || []); setTasks(d.tasks || []); setMeName(d.meName || '') } })
      .catch(() => {})
  }, [q, status, mine])
  useEffect(() => { load() }, [load])

  const openCustomer = async (r: any) => {
    setSel(r); setEntry(null); setProf(null); setActText(''); setActDue(''); setActDueTs(0); setSmsTxt('')
    const d = await fetch('/api/admin/staff-crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'entry', phone: r.phone }) }).then(x => x.ok ? x.json() : null).catch(() => null)
    if (d?.ok) { setEntry(d.entry); setProf(d) }
  }
  const post = async (body: object) => {
    setBusy(true)
    const d = await fetch('/api/admin/staff-crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null)
    setBusy(false)
    if (d?.error) { setMsg(d.error); setTimeout(() => setMsg(''), 4000); return null }
    return d
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT, direction: 'rtl' }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 900 }}>📞 CRM مرکزی — مشتریانِ سایت</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>هر کاربرِ واقعیِ سایت یک پرونده است؛ پرسنل تماس/پیگیری/یادداشت ثبت می‌کنند و یادآوری‌ها این‌جا سررسید می‌شوند. هر ثبت با نامِ ثبت‌کننده است.</div>
        {msg && <div style={{ marginTop: 6, fontSize: 12.5, color: '#e88' }}>{msg}</div>}
      </div>

      {/* KPIهای واقعی */}
      {stats && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        {[['کلِ مشتریان', stats.total, 'var(--text)'], ['عضوِ این هفته', stats.newWeek, '#5fd98a'], ['در حالِ پیگیری', stats.follow, '#e7a14a'], ['مشتری شده', stats.customer, '#5fd98a'], ['پیگیریِ سررسید', stats.due, stats.due > 0 ? '#e88' : 'var(--muted)']].map(([l, v, c], i) => (
          <div key={i} style={{ ...card, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: c as string }}>{fa(v as number)}</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>}

      {/* فاز ۱۲۲ — زیرمنو */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
        {([['customers', '📋 مشتریان'], ['tasks', `✅ وظایف${tasks.filter((t: any) => !t.done).length ? ` (${fa(tasks.filter((t: any) => !t.done).length)})` : ''}`], ['follow', `⏰ پیگیری‌ها${dueToday.length ? ` (${fa(dueToday.length)})` : ''}`], ['report', '📊 گزارشِ عملکرد']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...btnGhost, fontWeight: tab === k ? 800 : 400, borderColor: tab === k ? 'var(--gold)' : 'var(--line2)', color: tab === k ? 'var(--gold)' : 'var(--text)' }}>{l}</button>
        ))}
      </div>

      {/* ── تبِ وظایف (فاز ۱۲۳): تعریفِ تسکِ تیمی با مسئول/مشتری/سررسید ── */}
      {tab === 'tasks' && <>
        <div style={{ ...card, borderColor: 'var(--goldDim)' }}>
          <b style={{ fontSize: 13.5 }}>➕ تعریفِ وظیفهٔ جدید</b>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', flex: 2, minWidth: 220 }}>عنوانِ وظیفه *<br />
              <input value={tTitle} onChange={e => setTTitle(e.target.value)} maxLength={160} placeholder="مثلاً: تماس با آقای سمیعی برای تمدیدِ پلن" style={{ ...inp, width: '100%', marginTop: 4 }} /></label>
            <label style={{ fontSize: 11, color: 'var(--muted)', minWidth: 130 }}>مسئول (نامِ همکار)<br />
              <input value={tAssign} onChange={e => setTAssign(e.target.value)} placeholder={meName || 'خالی = همه'} style={{ ...inp, width: '100%', marginTop: 4 }} /></label>
            <label style={{ fontSize: 11, color: 'var(--muted)', minWidth: 150 }}>مشتریِ مرتبط (شماره — اختیاری)<br />
              <input value={tPhone} onChange={e => setTPhone(e.target.value.replace(/[^\d]/g, ''))} placeholder="09…" style={{ ...inp, width: '100%', marginTop: 4, direction: 'ltr' }} /></label>
            <label style={{ fontSize: 11, color: 'var(--muted)', minWidth: 190 }}>سررسید (شمسی)<br />
              <div style={{ marginTop: 4 }}><JalaliDatePicker value={tDue} onChange={setTDue} onPickTs={setTDueTs} withTime placeholder="انتخابِ تاریخ و ساعت" /></div></label>
            <button style={btn} disabled={busy || !tTitle.trim()} onClick={async () => {
              const d = await post({ action: 'taskAdd', title: tTitle, assignedTo: tAssign, forPhone: tPhone, dueAt: tDueTs || undefined })
              if (d) { setTasks(d.tasks || []); setTTitle(''); setTAssign(''); setTPhone(''); setTDue(''); setTDueTs(0) }
            }}>ثبتِ وظیفه</button>
          </div>
        </div>
        <div style={card}>
          <b style={{ fontSize: 13.5 }}>وظایفِ باز ({fa(tasks.filter((t: any) => !t.done).length)})</b>
          {!tasks.filter((t: any) => !t.done).length && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>وظیفهٔ بازی نیست — با فرمِ بالا برای خودت یا همکارانت تسک بساز.</div>}
          {tasks.filter((t: any) => !t.done).map((t: any) => (
            <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
              <input type="checkbox" checked={false} disabled={busy} onChange={async () => { const d = await post({ action: 'taskToggle', id: t.id }); if (d) setTasks(d.tasks || []) }} style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }} />
              <span style={{ flex: 1, minWidth: 180 }}>{t.title}</span>
              {t.assignedTo && <span style={{ fontSize: 10.5, border: '1px solid var(--goldDim)', color: 'var(--gold)', borderRadius: 9, padding: '1px 9px' }}>👤 {t.assignedTo}</span>}
              {t.forPhone && <span style={{ fontSize: 10.5, color: 'var(--gold)', cursor: 'pointer' }} onClick={() => { setTab('customers'); openCustomer(rows.find(r => r.phone === t.forPhone) || { phone: t.forPhone, name: t.forName }) }}>🗂 {t.forName || t.forPhone}</span>}
              {t.dueAt && <span style={{ fontSize: 10.5, color: t.dueAt < Date.now() ? '#e88' : 'var(--muted)' }}>⏰ {faDT(t.dueAt)}</span>}
              <span style={{ fontSize: 9.5, color: 'var(--faint)' }}>ثبتِ {String(t.by).split(' (')[0]}</span>
              <button title="حذف" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e88', fontSize: 12 }} disabled={busy} onClick={async () => { if (!confirm('این وظیفه حذف شود؟')) return; const d = await post({ action: 'taskDelete', id: t.id }); if (d) setTasks(d.tasks || []) }}>🗑</button>
            </div>
          ))}
        </div>
        {tasks.filter((t: any) => t.done).length > 0 && <div style={card}>
          <b style={{ fontSize: 13.5, color: 'var(--muted)' }}>انجام‌شده‌ها ({fa(tasks.filter((t: any) => t.done).length)})</b>
          {tasks.filter((t: any) => t.done).slice(0, 25).map((t: any) => (
            <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)' }}>
              <input type="checkbox" checked disabled={busy} onChange={async () => { const d = await post({ action: 'taskToggle', id: t.id }); if (d) setTasks(d.tasks || []) }} style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }} />
              <span style={{ flex: 1, textDecoration: 'line-through' }}>{t.title}</span>
              <span style={{ fontSize: 10 }}>✓ {String(t.doneBy || '').split(' (')[0]} · {faDT(t.doneAt)}</span>
            </div>
          ))}
        </div>}
      </>}

      {/* ── تبِ پیگیری‌ها ── */}
      {tab === 'follow' && <>
        <div style={{ ...card, borderColor: dueToday.length ? '#e7a14a' : 'var(--line)' }}>
          <b style={{ fontSize: 13.5 }}>⏰ سررسیدِ امروز و گذشته ({fa(dueToday.length)})</b>
          {!dueToday.length && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>هیچ پیگیریِ عقب‌افتاده‌ای نیست — آفرین به تیم 👏</div>}
          {dueToday.map((d: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
              <b style={{ cursor: 'pointer', color: 'var(--gold)' }} onClick={() => { setTab('customers'); openCustomer(rows.find(r => r.phone === d.phone) || { phone: d.phone, name: d.name }) }}>{d.name || d.phone}</b>
              <span style={{ flex: 1 }}>{d.text.slice(0, 80)}</span>
              <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>سررسید {faDT(d.dueAt)} · {d.by.split(' (')[0]}</span>
              <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 11 }} disabled={busy} onClick={async () => { if (await post({ action: 'done', phone: d.phone, actAt: d.at })) load() }}>✓ انجام شد</button>
            </div>
          ))}
        </div>
        <div style={card}>
          <b style={{ fontSize: 13.5 }}>📅 پیگیری‌های آینده ({fa(upcoming.length)})</b>
          {!upcoming.length && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>یادآوریِ آینده‌ای ثبت نشده — در پروندهٔ هر مشتری با «یادآوریِ پیگیری» بساز.</div>}
          {upcoming.map((d: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
              <b style={{ cursor: 'pointer', color: 'var(--gold)' }} onClick={() => { setTab('customers'); openCustomer(rows.find(r => r.phone === d.phone) || { phone: d.phone, name: d.name }) }}>{d.name || d.phone}</b>
              <span style={{ flex: 1 }}>{d.text.slice(0, 80)}</span>
              <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>⏰ {faDT(d.dueAt)} · {d.by.split(' (')[0]}</span>
            </div>
          ))}
        </div>
        {doneRecent.length > 0 && <div style={card}>
          <b style={{ fontSize: 13.5, color: 'var(--muted)' }}>✓ انجام‌شده‌های اخیر ({fa(doneRecent.length)})</b>
          {doneRecent.map((d: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, padding: '5px 0', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
              <span>✅ {d.name || d.phone}</span><span style={{ flex: 1 }}>{d.text.slice(0, 80)}</span><span style={{ fontSize: 10 }}>{d.by.split(' (')[0]}</span>
            </div>
          ))}
        </div>}
      </>}

      {/* ── تبِ گزارشِ عملکرد ── */}
      {tab === 'report' && <div style={card}>
        <b style={{ fontSize: 13.5 }}>📊 عملکردِ پرسنل — از ثبت‌های واقعی</b>
        <div style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 10px' }}>هر همکار چند تماس/پیامک/پیگیری/یادداشت ثبت کرده — پاسخ‌گویی و سنجشِ کار.</div>
        {!report.length && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز هیچ فعالیتی ثبت نشده — با اولین ثبتِ تماس/پیگیری، این گزارش ساخته می‌شود.</div>}
        {report.length > 0 && <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ color: 'var(--muted)', textAlign: 'right', background: 'var(--bg2)' }}>
              <th style={{ padding: 10 }}>همکار</th><th style={{ padding: 10 }}>📞 تماس</th><th style={{ padding: 10 }}>✉️ پیامک</th><th style={{ padding: 10 }}>⏰ پیگیری</th><th style={{ padding: 10 }}>📝 یادداشت</th><th style={{ padding: 10 }}>جمع</th><th style={{ padding: 10 }}>آخرین فعالیت</th>
            </tr></thead>
            <tbody>{report.map((r: any) => (
              <tr key={r.name} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: 10, fontWeight: 700 }}>{r.name}</td>
                <td style={{ padding: 10 }}>{fa(r.calls)}</td><td style={{ padding: 10 }}>{fa(r.sms)}</td>
                <td style={{ padding: 10 }}>{fa(r.follows)}</td><td style={{ padding: 10 }}>{fa(r.notes)}</td>
                <td style={{ padding: 10, fontWeight: 800, color: 'var(--gold)' }}>{fa(r.total)}</td>
                <td style={{ padding: 10, color: 'var(--muted)', fontSize: 11 }}>{faDT(r.lastAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
      </div>}

      {tab === 'customers' && <>
      {/* صفِ کارِ امروز */}
      {dueToday.length > 0 && <div style={{ ...card, borderColor: '#e7a14a' }}>
        <b style={{ fontSize: 13.5 }}>⏰ پیگیری‌های سررسید ({fa(dueToday.length)})</b>
        {dueToday.map((d: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
            <b style={{ cursor: 'pointer', color: 'var(--gold)' }} onClick={() => openCustomer(rows.find(r => r.phone === d.phone) || { phone: d.phone, name: d.name })}>{d.name || d.phone}</b>
            <span style={{ flex: 1 }}>{d.text.slice(0, 70)}</span>
            <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>سررسید {faDT(d.dueAt)} · ثبتِ {d.by.split(' (')[0]}</span>
            <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 11 }} disabled={busy} onClick={async () => { if (await post({ action: 'done', phone: d.phone, actAt: d.at })) load() }}>✓ انجام شد</button>
          </div>
        ))}
      </div>}

      {/* فیلترها */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی نام/شماره…" style={{ ...inp, width: 220 }} />
        {['', 'new', 'follow', 'customer', 'lost'].map(st => (
          <button key={st || 'all'} onClick={() => setStatus(st)}
            style={{ ...btnGhost, borderColor: status === st ? 'var(--gold)' : 'var(--line2)', color: status === st ? 'var(--gold)' : 'var(--text)' }}>
            {st ? (STAFF_CRM_STATUS_FA as any)[st] : 'همه'}
          </button>
        ))}
        <button onClick={() => setMine(m => !m)} style={{ ...btnGhost, borderColor: mine ? 'var(--gold)' : 'var(--line2)', color: mine ? 'var(--gold)' : 'var(--text)' }}>👤 فقط کارهای من</button>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{fa(total)} مشتری</span>
        <span style={{ flex: 1 }} />
        <button style={btnGhost} onClick={load}>↻ تازه‌سازی</button>
      </div>

      {/* جدولِ مشتریان */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ color: 'var(--muted)', textAlign: 'right', background: 'var(--bg2)' }}>
              <th style={{ padding: 10 }}>مشتری</th><th style={{ padding: 10 }}>نقش</th><th style={{ padding: 10 }}>پلن</th>
              <th style={{ padding: 10 }} title="فایل‌ها/آگهی‌های خودش در پنلش">فایل</th><th style={{ padding: 10 }} title="لیدهای خودش در CRM پنلش">لید</th>
              <th style={{ padding: 10 }}>آخرین ورود</th><th style={{ padding: 10 }}>وضعیت</th><th style={{ padding: 10 }}>مسئول</th><th style={{ padding: 10 }}>آخرین فعالیت</th><th style={{ padding: 10 }}></th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.phone} onClick={() => openCustomer(r)} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
                  <td style={{ padding: 10 }}><b>{r.name || 'بی‌نام'}</b> <span style={{ color: 'var(--faint)', fontSize: 10.5, direction: 'ltr', display: 'inline-block' }}>{r.phone}</span>{r.dueCount > 0 && <span style={{ color: '#e7a14a', fontSize: 10.5 }}> · ⏰{fa(r.dueCount)}</span>}</td>
                  <td style={{ padding: 10, color: 'var(--muted)' }}>{r.role || '—'}</td>
                  <td style={{ padding: 10, color: 'var(--muted)' }}>{r.plan || '—'}</td>
                  <td style={{ padding: 10, color: r.files > 0 ? 'var(--gold)' : 'var(--faint)', fontWeight: r.files > 0 ? 700 : 400 }}>{r.files > 0 ? fa(r.files) : '—'}</td>
                  <td style={{ padding: 10, color: r.leads > 0 ? '#5fd98a' : 'var(--faint)', fontWeight: r.leads > 0 ? 700 : 400 }}>{r.leads > 0 ? fa(r.leads) : '—'}</td>
                  <td style={{ padding: 10, color: 'var(--muted)' }}>{faDate(r.lastLogin)}</td>
                  <td style={{ padding: 10 }}><span style={{ color: ST_COLOR[r.status], fontWeight: 700 }}>{(STAFF_CRM_STATUS_FA as any)[r.status]}</span></td>
                  <td style={{ padding: 10, color: 'var(--muted)' }}>{r.assignedTo || '—'}</td>
                  <td style={{ padding: 10, color: 'var(--faint)', fontSize: 11 }}>{r.lastActText || '—'}</td>
                  <td style={{ padding: 10 }}><button style={{ ...btn, padding: '5px 14px', fontSize: 11.5 }} onClick={e => { e.stopPropagation(); openCustomer(r) }}>➕ پرونده و ثبت</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>مشتری‌ای با این فیلتر نیست.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      </>}

      {/* کشوی پرونده */}
      {sel && <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 300, display: 'flex', justifyContent: 'flex-start' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px, 94vw)', height: '100%', overflowY: 'auto', background: 'var(--surface)', borderInlineEnd: '1px solid var(--line)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <b style={{ fontSize: 15 }}>{sel.name || 'بی‌نام'}</b>
            <span style={{ color: 'var(--faint)', fontSize: 11.5, direction: 'ltr' }}>{sel.phone}</span>
            <span style={{ flex: 1 }} />
            <button style={{ ...btnGhost, padding: '3px 10px' }} onClick={() => setSel(null)}>✕</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{prof?.account?.role || sel.role || '—'}{prof?.account?.fullName ? ` · ${prof.account.fullName} ✅` : ''} · عضویت از {faDate(prof?.account?.createdAt || sel.createdAt)} · آخرین ورود {faDate(prof?.account?.lastLogin || sel.lastLogin)}</div>

          {/* اقدامِ فوری: تماسِ مستقیم + پیامکِ واقعی */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`tel:${sel.phone}`} style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>📞 تماس با {sel.phone}</a>
            <button style={btnGhost} onClick={() => { navigator.clipboard?.writeText(sel.phone).catch(() => {}) }}>⧉ کپیِ شماره</button>
          </div>
          <div style={{ ...card, background: 'var(--bg2)' }}>
            <b style={{ fontSize: 12.5 }}>📲 ارسالِ پیامکِ واقعی</b>
            <textarea value={smsTxt} onChange={e => setSmsTxt(e.target.value)} rows={2} maxLength={320} placeholder="متنِ پیامک به این مشتری… (با خطِ خدماتیِ ملک‌جت ارسال و در تایم‌لاین ثبت می‌شود)" style={{ ...inp, width: '100%', marginTop: 8, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--faint)' }}>{fa(smsTxt.length)}/۳۲۰</span>
              <span style={{ flex: 1 }} />
              <button style={btn} disabled={busy || !smsTxt.trim()} onClick={async () => {
                if (!confirm(`پیامک به ${sel.phone} ارسال شود؟`)) return
                const d = await post({ action: 'sms', phone: sel.phone, text: smsTxt })
                if (d) { setEntry(d.entry); setSmsTxt(''); setMsg('✓ پیامک ارسال و در تایم‌لاین ثبت شد'); setTimeout(() => setMsg(''), 4000); load() }
              }}>ارسالِ پیامک</button>
            </div>
          </div>

          {/* پروندهٔ ۳۶۰ درجه — ردپاهای واقعیِ این مشتری در کلِ سیستم */}
          {prof && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ ...card, background: 'var(--bg2)', padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>پلن و اشتراک</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 4 }}>{prof.account.plan || 'بدونِ پلن'}</div>
              {prof.account.planExpiresAt > 0 && <div style={{ fontSize: 10.5, color: prof.account.planExpiresAt < Date.now() ? '#e88' : 'var(--muted)' }}>انقضا: {faDate(prof.account.planExpiresAt)}{prof.account.planExpiresAt < Date.now() ? ' — منقضی! فرصتِ تمدید' : ''}</div>}
              {prof.pendingOrders > 0 && <div style={{ fontSize: 10.5, color: '#e7a14a', marginTop: 3 }}>⚠️ {fa(prof.pendingOrders)} سفارشِ در انتظارِ تأیید</div>}
            </div>
            <div style={{ ...card, background: 'var(--bg2)', padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>تیکت‌های پشتیبانی</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 4 }}>{fa(prof.tickets.total)} تیکت{prof.tickets.open > 0 ? ` · ${fa(prof.tickets.open)} باز` : ''}</div>
              {(prof.tickets.last || []).slice(0, 2).map((t: any, i: number) => <div key={i} style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.status === 'open' ? '🟠' : t.status === 'answered' ? '🟡' : '⚪'} {t.subject}</div>)}
            </div>
            <div style={{ ...card, background: 'var(--bg2)', padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>علاقه‌مندی‌ها</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 4 }}>{fa(prof.interests.favorites)} ملکِ ذخیره‌شده</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{fa(prof.interests.savedSearches)} جستجوی ذخیره‌شده</div>
            </div>
            <div style={{ ...card, background: 'var(--bg2)', padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>مسیرِ رشد (امپراتوری)</div>
              {prof.empire
                ? <><div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 4 }}>سطحِ {fa(prof.empire.level)} · {fa(prof.empire.assets)} دارایی</div><div style={{ fontSize: 10.5, color: 'var(--muted)' }}>🪙 {fa(prof.empire.coins)} کوین — کاربرِ درگیر</div></>
                : <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>هنوز شروع نکرده — فرصتِ دعوت</div>}
            </div>
          </div>}
          {prof && (prof.orders || []).length > 0 && <div style={{ ...card, background: 'var(--bg2)', padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>سفارش‌ها و خریدها</div>
            {prof.orders.map((o: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ flex: 1 }}>{o.name}</span>
                <span style={{ color: 'var(--muted)' }}>{fa(o.price)} ت</span>
                <b style={{ color: o.status === 'paid' ? '#5fd98a' : o.status === 'pending' ? '#e7a14a' : '#e88' }}>{o.status === 'paid' ? 'پرداخت شد' : o.status === 'pending' ? 'در انتظار' : 'رد شد'}</b>
                <span style={{ color: 'var(--faint)', fontSize: 10 }}>{faDate(o.at)}</span>
              </div>
            ))}
          </div>}

          {/* وضعیت + مسئول */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['new', 'follow', 'customer', 'lost'] as const).map(st => (
              <button key={st} disabled={busy} onClick={async () => { const d = await post({ action: 'status', phone: sel.phone, status: st }); if (d) { setEntry(d.entry); load() } }}
                style={{ ...btnGhost, padding: '4px 12px', fontSize: 11.5, borderColor: entry?.status === st ? ST_COLOR[st] : 'var(--line2)', color: entry?.status === st ? ST_COLOR[st] : 'var(--text)' }}>{STAFF_CRM_STATUS_FA[st]}</button>
            ))}
            <button style={{ ...btnGhost, padding: '4px 12px', fontSize: 11.5 }} disabled={busy} onClick={async () => {
              const to = prompt('مسئولِ پیگیری (نامِ همکار؛ خالی = برداشتن):', entry?.assignedTo || '')
              if (to === null) return
              const d = await post({ action: 'assign', phone: sel.phone, to }); if (d) { setEntry(d.entry); load() }
            }}>👤 {entry?.assignedTo || 'تعیینِ مسئول'}</button>
          </div>

          {/* ثبتِ فعالیت */}
          <div style={{ ...card, background: 'var(--bg2)' }}>
            <b style={{ fontSize: 12.5 }}>ثبتِ فعالیتِ جدید</b>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {Object.entries(KIND_FA).map(([k, l]) => (
                <button key={k} onClick={() => setActKind(k)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11, borderColor: actKind === k ? 'var(--gold)' : 'var(--line2)', color: actKind === k ? 'var(--gold)' : 'var(--text)' }}>{l}</button>
              ))}
            </div>
            <textarea value={actText} onChange={e => setActText(e.target.value)} rows={3} placeholder="چه گذشت؟ (نتیجهٔ تماس، قرارِ بعدی، …)" style={{ ...inp, width: '100%', marginTop: 8, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>یادآوریِ پیگیری (شمسی):
                <span style={{ minWidth: 185, display: 'inline-block' }}><JalaliDatePicker value={actDue} onChange={setActDue} onPickTs={setActDueTs} withTime placeholder="انتخابِ تاریخ و ساعت" style={{ padding: '5px 8px', fontSize: 12 }} /></span></label>
              <span style={{ flex: 1 }} />
              <button style={btn} disabled={busy || !actText.trim()} onClick={async () => {
                const d = await post({ action: 'act', phone: sel.phone, kind: actKind, text: actText, dueAt: actDueTs || undefined })
                if (d) { setEntry(d.entry); setActText(''); setActDue(''); setActDueTs(0); load() }
              }}>ثبت</button>
            </div>
          </div>

          {/* تایم‌لاین */}
          <div>
            <b style={{ fontSize: 12.5 }}>تاریخچهٔ تعاملات {entry ? `(${fa((entry.acts || []).length)})` : ''}</b>
            {!entry && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>در حالِ بارگذاری…</div>}
            {entry && !(entry.acts || []).length && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>هنوز تعاملی ثبت نشده — اولین تماس را تو ثبت کن.</div>}
            {entry && [...(entry.acts || [])].reverse().map((a: any, i: number) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>{KIND_FA[a.kind] || a.kind}</b>
                  <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>{faDT(a.at)} · {String(a.by).split(' (')[0]}</span>
                  {a.dueAt && <span style={{ fontSize: 10.5, color: a.done ? '#5fd98a' : '#e7a14a' }}>{a.done ? '✓ پیگیری انجام شد' : `⏰ سررسید ${faDT(a.dueAt)}`}</span>}
                  {a.dueAt && !a.done && <button style={{ ...btnGhost, padding: '1px 8px', fontSize: 10 }} disabled={busy} onClick={async () => { if (await post({ action: 'done', phone: sel.phone, actAt: a.at })) { openCustomer(sel); load() } }}>✓</button>}
                </div>
                <div style={{ marginTop: 3, lineHeight: 1.9 }}>{a.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>}
    </div>
  )
}
