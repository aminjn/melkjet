'use client'
// 📞 فاز ۱۱۶ — CRM مرکزیِ پرسنل: همهٔ مشتریانِ واقعیِ سایت + ثبت/پیگیریِ تماس‌ها توسطِ پرسنل.
import { useCallback, useEffect, useState } from 'react'

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
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(() => {
    fetch(`/api/admin/staff-crm?q=${encodeURIComponent(q)}&status=${status}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ok) { setRows(d.rows); setTotal(d.total); setDueToday(d.dueToday || []) } })
      .catch(() => {})
  }, [q, status])
  useEffect(() => { load() }, [load])

  const openCustomer = async (r: any) => {
    setSel(r); setEntry(null); setActText(''); setActDue('')
    const d = await fetch('/api/admin/staff-crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'entry', phone: r.phone }) }).then(x => x.ok ? x.json() : null).catch(() => null)
    if (d?.ok) setEntry(d.entry)
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
              <th style={{ padding: 10 }}>آخرین ورود</th><th style={{ padding: 10 }}>وضعیت</th><th style={{ padding: 10 }}>مسئول</th><th style={{ padding: 10 }}>آخرین فعالیت</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.phone} onClick={() => openCustomer(r)} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
                  <td style={{ padding: 10 }}><b>{r.name || 'بی‌نام'}</b> <span style={{ color: 'var(--faint)', fontSize: 10.5, direction: 'ltr', display: 'inline-block' }}>{r.phone}</span>{r.dueCount > 0 && <span style={{ color: '#e7a14a', fontSize: 10.5 }}> · ⏰{fa(r.dueCount)}</span>}</td>
                  <td style={{ padding: 10, color: 'var(--muted)' }}>{r.role || '—'}</td>
                  <td style={{ padding: 10, color: 'var(--muted)' }}>{r.plan || '—'}</td>
                  <td style={{ padding: 10, color: 'var(--muted)' }}>{faDate(r.lastLogin)}</td>
                  <td style={{ padding: 10 }}><span style={{ color: ST_COLOR[r.status], fontWeight: 700 }}>{(STAFF_CRM_STATUS_FA as any)[r.status]}</span></td>
                  <td style={{ padding: 10, color: 'var(--muted)' }}>{r.assignedTo || '—'}</td>
                  <td style={{ padding: 10, color: 'var(--faint)', fontSize: 11 }}>{r.lastActText || '—'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>مشتری‌ای با این فیلتر نیست.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* کشوی پرونده */}
      {sel && <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 300, display: 'flex', justifyContent: 'flex-start' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px, 94vw)', height: '100%', overflowY: 'auto', background: 'var(--surface)', borderInlineEnd: '1px solid var(--line)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <b style={{ fontSize: 15 }}>{sel.name || 'بی‌نام'}</b>
            <span style={{ color: 'var(--faint)', fontSize: 11.5, direction: 'ltr' }}>{sel.phone}</span>
            <span style={{ flex: 1 }} />
            <button style={{ ...btnGhost, padding: '3px 10px' }} onClick={() => setSel(null)}>✕</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{sel.role || '—'}{sel.plan ? ` · پلنِ ${sel.plan}` : ''} · عضویت از {faDate(sel.createdAt)} · آخرین ورود {faDate(sel.lastLogin)}</div>

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
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>یادآوریِ پیگیری: <input type="datetime-local" value={actDue} onChange={e => setActDue(e.target.value)} style={{ ...inp, padding: '5px 8px' }} /></label>
              <span style={{ flex: 1 }} />
              <button style={btn} disabled={busy || !actText.trim()} onClick={async () => {
                const d = await post({ action: 'act', phone: sel.phone, kind: actKind, text: actText, dueAt: actDue ? new Date(actDue).getTime() : undefined })
                if (d) { setEntry(d.entry); setActText(''); setActDue(''); load() }
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
