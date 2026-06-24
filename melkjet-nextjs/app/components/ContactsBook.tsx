'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// دفترچهٔ مخاطبینِ مارکتینگ: مدیریتِ مخاطبین + گروه‌ها + تعیینِ ایمیل/پیامک + ایمپورتِ
// CSV/اکسل + افزودنِ همهٔ لیدها. منبعِ گیرندگانِ کمپین‌های ایمیل و پیامک.

const FONT = 'Vazirmatn, system-ui, sans-serif'
interface Contact { id: string; name: string; phone?: string; email?: string; groups: string[]; forEmail: boolean; forSms: boolean; createdAt: number }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%' }
const gold: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }
const act: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap' }
const FA = (n: number) => n.toLocaleString('fa-IR')

// تشخیصِ ستون‌ها در هر سطرِ CSV: ایمیل (دارای @)، موبایل (عمدتاً رقم)، بقیه نام.
function parseCsv(text: string): { name?: string; phone?: string; email?: string }[] {
  const rows: { name?: string; phone?: string; email?: string }[] = []
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim(); if (!line) continue
    const cells = line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (cells.every(c => /نام|name|phone|موبایل|تلفن|email|ایمیل/i.test(c))) continue // سطرِ هدر
    let name = '', phone = '', email = ''
    for (const c of cells) {
      if (!c) continue
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) email = c
      else if (c.replace(/[^\d۰-۹]/g, '').length >= 7 && /^[\d۰-۹+\-\s()]+$/.test(c)) phone = c.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      else if (!name) name = c
    }
    if (phone || email) rows.push({ name, phone, email })
  }
  return rows
}

export default function ContactsBook() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [filter, setFilter] = useState('__all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [nc, setNc] = useState({ name: '', phone: '', email: '', group: '', forEmail: true, forSms: true })
  const fileRef = useRef<HTMLInputElement>(null)
  const [importGroup, setImportGroup] = useState('')

  const refresh = useCallback(async () => {
    try { const r = await fetch('/api/contacts', { cache: 'no-store' }); if (r.ok) { const d = await r.json(); setContacts(d.contacts || []); setGroups(d.groups || []) } } catch {}
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const post = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setMsg('')
    try { const r = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); if (!r.ok) { setMsg(d.error || 'خطا'); return null } await refresh(); return d } catch { setMsg('اتصال ناموفق'); return null } finally { setBusy(false) }
  }, [refresh])

  const onFile = async (f: File | null) => {
    if (!f) return
    const text = await f.text()
    const rows = parseCsv(text)
    if (!rows.length) { setMsg('سطرِ معتبری در فایل پیدا نشد (ستون‌ها: نام، موبایل، ایمیل).'); return }
    const d = await post({ action: 'bulk', rows, groups: importGroup.trim() ? [importGroup.trim()] : [] })
    if (d) setMsg(`✓ ${FA(d.added || 0)} مخاطب وارد شد${d.skipped ? ` · ${FA(d.skipped)} رد شد` : ''}.`)
    if (fileRef.current) fileRef.current.value = ''
  }

  const shown = contacts.filter(c =>
    (filter === '__all' || c.groups.includes(filter)) &&
    (!q.trim() || (c.name + ' ' + (c.phone || '') + ' ' + (c.email || '')).includes(q.trim()))
  )
  const emailCount = contacts.filter(c => c.forEmail && c.email).length
  const smsCount = contacts.filter(c => c.forSms && c.phone).length

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span style={{ fontSize: 19 }}>📒</span><div style={{ fontWeight: 800, fontSize: 15 }}>دفترچهٔ مخاطبین</div></div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>مخاطبین را گروه‌بندی کنید و مشخص کنید برای ایمیل یا پیامک استفاده شوند. هنگامِ ارسالِ کمپین، گروه را از دراپ‌داون انتخاب می‌کنید.</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 12 }}>
          <span>کل: <b>{FA(contacts.length)}</b></span>
          <span style={{ color: 'var(--gold)' }}>✉ ایمیل: <b>{FA(emailCount)}</b></span>
          <span style={{ color: '#5b9bd5' }}>✆ پیامک: <b>{FA(smsCount)}</b></span>
        </div>
      </div>

      {/* افزودن / ایمپورت */}
      <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5 }}>افزودن مخاطب</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          <input value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} placeholder="نام" style={inp} />
          <input value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} placeholder="موبایل" style={{ ...inp, direction: 'ltr', textAlign: 'right' }} />
          <input value={nc.email} onChange={e => setNc({ ...nc, email: e.target.value })} placeholder="ایمیل" style={{ ...inp, direction: 'ltr', textAlign: 'right' }} />
          <input value={nc.group} onChange={e => setNc({ ...nc, group: e.target.value })} placeholder="گروه (اختیاری)" list="cb-groups" style={inp} />
          <datalist id="cb-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={nc.forEmail} onChange={e => setNc({ ...nc, forEmail: e.target.checked })} /> برای ایمیل</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={nc.forSms} onChange={e => setNc({ ...nc, forSms: e.target.checked })} /> برای پیامک</label>
          <span style={{ flex: 1 }} />
          <button disabled={busy || (!nc.phone.trim() && !nc.email.trim())} onClick={async () => { const d = await post({ action: 'add', name: nc.name, phone: nc.phone, email: nc.email, groups: nc.group.trim() ? [nc.group.trim()] : [], forEmail: nc.forEmail, forSms: nc.forSms }); if (d) setNc({ name: '', phone: '', email: '', group: '', forEmail: true, forSms: true }) }} style={{ ...gold, opacity: busy ? 0.6 : 1 }}>افزودن</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <button disabled={busy} onClick={async () => { const d = await post({ action: 'fromLeads' }); if (d) setMsg(`✓ ${FA(d.added || 0)} لید به دفترچه اضافه شد.`) }} style={act}>＋ افزودن همهٔ لیدها</button>
          <input value={importGroup} onChange={e => setImportGroup(e.target.value)} placeholder="گروهِ ایمپورت (اختیاری)" style={{ ...inp, width: 180, flex: '0 0 180px' }} />
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={e => onFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
          <button disabled={busy} onClick={() => fileRef.current?.click()} style={act}>⇪ ایمپورت از فایل (CSV/اکسل)</button>
          <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>اکسل را به‌صورت CSV ذخیره کنید؛ ستون‌ها: نام، موبایل، ایمیل.</span>
        </div>
      </div>

      {msg && <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, color: msg.startsWith('✓') ? 'var(--gold)' : 'var(--muted)' }}>{msg}</div>}

      {/* فهرست */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="__all">همهٔ گروه‌ها ({FA(contacts.length)})</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو…" style={{ ...inp, flex: 1, minWidth: 140 }} />
        </div>
        {shown.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>مخاطبی نیست. یک مخاطب اضافه کنید، لیدها را وارد کنید یا فایل CSV بدهید.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}{c.groups.length ? <span style={{ fontSize: 10.5, color: 'var(--gold)', marginRight: 6 }}> · {c.groups.join('، ')}</span> : null}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', direction: 'ltr', textAlign: 'right' }}>{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <button onClick={() => post({ action: 'update', id: c.id, patch: { forEmail: !c.forEmail } })} title="استفاده برای ایمیل" style={{ ...act, color: c.forEmail && c.email ? 'var(--gold)' : 'var(--faint)', borderColor: c.forEmail && c.email ? 'var(--gold)' : 'var(--line)' }}>✉</button>
                <button onClick={() => post({ action: 'update', id: c.id, patch: { forSms: !c.forSms } })} title="استفاده برای پیامک" style={{ ...act, color: c.forSms && c.phone ? '#5b9bd5' : 'var(--faint)', borderColor: c.forSms && c.phone ? '#5b9bd5' : 'var(--line)' }}>✆</button>
                <button onClick={() => { if (confirm('این مخاطب حذف شود؟')) post({ action: 'delete', id: c.id }) }} style={{ ...act, color: '#ef4444' }}>حذف</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
