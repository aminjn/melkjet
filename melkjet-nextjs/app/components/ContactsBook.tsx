'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// دفترچهٔ مخاطبینِ مارکتینگ — گروه‌محور: اول گروه (دفترچه) می‌سازید، بعد مخاطب را
// تکی یا دسته‌ای داخلِ گروه‌ها قرار می‌دهید. منبعِ گیرندگانِ کمپین‌های ایمیل/پیامک.

const FONT = 'Vazirmatn, system-ui, sans-serif'
interface Contact { id: string; name: string; phone?: string; email?: string; groups: string[]; forEmail: boolean; forSms: boolean; createdAt: number }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%' }
const gold: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }
const act: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap' }
const FA = (n: number) => n.toLocaleString('fa-IR')

function parseCsv(text: string): { name?: string; phone?: string; email?: string }[] {
  const rows: { name?: string; phone?: string; email?: string }[] = []
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim(); if (!line) continue
    const cells = line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (cells.every(c => /نام|name|phone|موبایل|تلفن|email|ایمیل/i.test(c))) continue
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
  const [newGroup, setNewGroup] = useState('')
  const [nc, setNc] = useState({ name: '', phone: '', email: '', group: '', forEmail: true, forSms: true })
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState('')   // گروهِ مقصد برای ایمپورت/دسته‌ای
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try { const r = await fetch('/api/contacts', { cache: 'no-store' }); if (r.ok) { const d = await r.json(); setContacts(d.contacts || []); setGroups(d.groups || []) } } catch {}
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const post = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setMsg('')
    try { const r = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); if (!r.ok) { setMsg(d.error || 'خطا'); return null } if (d.groups) setGroups(d.groups); await refresh(); return d } catch { setMsg('اتصال ناموفق'); return null } finally { setBusy(false) }
  }, [refresh])

  const onFile = async (f: File | null) => {
    if (!f) return
    const rows = parseCsv(await f.text())
    if (!rows.length) { setMsg('سطرِ معتبری در فایل پیدا نشد (ستون‌ها: نام، موبایل، ایمیل).'); return }
    const d = await post({ action: 'bulk', rows, group: target.trim() })
    if (d) setMsg(`✓ ${FA(d.added || 0)} مخاطب${target ? ` به گروهِ «${target}»` : ''} وارد شد${d.skipped ? ` · ${FA(d.skipped)} رد شد` : ''}.`)
    if (fileRef.current) fileRef.current.value = ''
  }

  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const shown = contacts.filter(c =>
    (filter === '__all' || (filter === '__none' ? c.groups.length === 0 : c.groups.includes(filter))) &&
    (!q.trim() || (c.name + ' ' + (c.phone || '') + ' ' + (c.email || '')).includes(q.trim()))
  )
  const emailCount = contacts.filter(c => c.forEmail && c.email).length
  const smsCount = contacts.filter(c => c.forSms && c.phone).length
  const countIn = (g: string) => contacts.filter(c => c.groups.includes(g)).length
  const selIds = [...sel].filter(id => shown.some(c => c.id === id))

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span style={{ fontSize: 19 }}>📒</span><div style={{ fontWeight: 800, fontSize: 15 }}>دفترچهٔ مخاطبین</div></div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>اول گروه (دفترچه) بسازید، بعد مخاطب را تکی یا دسته‌ای داخلِ گروه‌ها قرار دهید. هنگام ارسالِ کمپین، گروه را از دراپ‌داون انتخاب می‌کنید.</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 12 }}>
          <span>کل: <b>{FA(contacts.length)}</b></span>
          <span style={{ color: 'var(--gold)' }}>✉ ایمیل: <b>{FA(emailCount)}</b></span>
          <span style={{ color: '#5b9bd5' }}>✆ پیامک: <b>{FA(smsCount)}</b></span>
          <span>گروه‌ها: <b>{FA(groups.length)}</b></span>
        </div>
      </div>

      {/* گروه‌ها (دفترچه‌ها) */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 10 }}>گروه‌ها (دفترچه‌ها)</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={newGroup} onChange={e => setNewGroup(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newGroup.trim()) { post({ action: 'addGroup', name: newGroup.trim() }); setNewGroup('') } }} placeholder="نام گروه جدید (مثلاً خریداران سعادت‌آباد)" style={{ ...inp, flex: 1 }} />
          <button disabled={busy || !newGroup.trim()} onClick={() => { post({ action: 'addGroup', name: newGroup.trim() }); setNewGroup('') }} style={gold}>＋ ساخت گروه</button>
        </div>
        {groups.length === 0 ? <div style={{ fontSize: 12, color: 'var(--faint)' }}>هنوز گروهی نساخته‌اید.</div> : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {groups.map(g => (
              <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 12.5, fontWeight: 600 }}>
                {g} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({FA(countIn(g))})</span>
                <button onClick={() => { if (confirm(`گروهِ «${g}» حذف شود؟ (مخاطبین می‌مانند، فقط برچسبِ گروه برداشته می‌شود)`)) post({ action: 'deleteGroup', name: g }) }} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13, padding: 0 }}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* افزودن مخاطب */}
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
          <button disabled={busy || (!nc.phone.trim() && !nc.email.trim())} onClick={async () => { const d = await post({ action: 'add', name: nc.name, phone: nc.phone, email: nc.email, groups: nc.group.trim() ? [nc.group.trim()] : [], forEmail: nc.forEmail, forSms: nc.forSms }); if (d) { setNc({ name: '', phone: '', email: '', group: '', forEmail: true, forSms: true }); setMsg('✓ مخاطب افزوده شد.') } }} style={gold}>افزودن</button>
        </div>
        {/* ایمپورت دسته‌ای → داخلِ گروهِ مقصد */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>افزودنِ دسته‌ای به گروه:</span>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="">— بدون گروه —</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <button disabled={busy} onClick={async () => { const d = await post({ action: 'fromLeads', group: target.trim() }); if (d) setMsg(`✓ ${FA(d.added || 0)} لید${target ? ` به گروهِ «${target}»` : ''} اضافه شد.`) }} style={act}>＋ همهٔ لیدها</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={e => onFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
          <button disabled={busy} onClick={() => fileRef.current?.click()} style={act}>⇪ ایمپورت از فایل (CSV/اکسل)</button>
          <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>اکسل را CSV ذخیره کنید؛ ستون‌ها: نام، موبایل، ایمیل.</span>
        </div>
      </div>

      {msg && <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, color: msg.startsWith('✓') ? 'var(--gold)' : 'var(--muted)' }}>{msg}</div>}

      {/* فهرستِ مخاطبین */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="__all">همهٔ گروه‌ها ({FA(contacts.length)})</option>
            <option value="__none">بدون گروه</option>
            {groups.map(g => <option key={g} value={g}>{g} ({FA(countIn(g))})</option>)}
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو…" style={{ ...inp, flex: 1, minWidth: 140 }} />
        </div>

        {/* نوارِ عملیاتِ دسته‌ای */}
        {selIds.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '10px 12px', background: 'var(--goldDim)', borderRadius: 10 }}>
            <b style={{ color: 'var(--gold)', fontSize: 12.5 }}>{FA(selIds.length)} انتخاب‌شده</b>
            <span style={{ flex: 1 }} />
            <select defaultValue="" onChange={e => { if (e.target.value) { post({ action: 'assignGroup', ids: selIds, group: e.target.value, add: true }); setSel(new Set()); e.target.value = '' } }} style={{ ...inp, width: 'auto' }}>
              <option value="">افزودن به گروه…</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button onClick={() => { if (confirm(`${selIds.length} مخاطب حذف شود؟`)) { selIds.forEach(id => post({ action: 'delete', id })); setSel(new Set()) } }} style={{ ...act, color: '#ef4444', borderColor: '#ef4444' }}>حذف انتخاب‌شده‌ها</button>
          </div>
        )}

        {shown.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>مخاطبی نیست. یک گروه بسازید و مخاطب اضافه کنید.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--muted)', cursor: 'pointer', padding: '0 4px' }}>
              <input type="checkbox" checked={shown.length > 0 && shown.every(c => sel.has(c.id))} onChange={e => setSel(e.target.checked ? new Set(shown.map(c => c.id)) : new Set())} /> انتخاب همه
            </label>
            {shown.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 9, background: sel.has(c.id) ? 'var(--goldDim)' : 'var(--bg2)', border: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggleSel(c.id)} />
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
