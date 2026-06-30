'use client'
import { useEffect, useState, useCallback } from 'react'

// ویرایشگرِ پروفایلِ عمومیِ سازنده در پنل — وصل به /api/builder (action‌های public).
// آنچه این‌جا پر می‌شود، دقیقاً در صفحهٔ عمومی /sazande/[id] نمایش داده می‌شود.

const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
const STATUSES: { v: string; l: string }[] = [{ v: 'building', l: 'در حال ساخت' }, { v: 'presale', l: 'پیش‌فروش' }, { v: 'delivered', l: 'تحویل‌شده' }]

const inp: React.CSSProperties = { width: '100%', border: '1px solid var(--line2)', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6, display: 'block' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }
const btn: React.CSSProperties = { background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', borderRadius: 11, padding: '10px 18px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line2)', borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }

interface PSProj { hashId: string; address: string; region: string; phase: string; units: number; floors: number; photo: string; meta: any }
interface Manual { id: string; name: string; location: string; status: string; deliveryDate?: string; units?: number; areaRange?: string; priceText?: string; salesProgress?: number; description?: string; published?: boolean; isPast?: boolean }

export default function BuilderPublicView() {
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState(false)
  const [builderId, setBuilderId] = useState('')
  const [name, setName] = useState('')
  const [pub, setPub] = useState<any>({})
  const [psProjects, setPsProjects] = useState<PSProj[]>([])
  const [manual, setManual] = useState<Manual[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/builder?public=1', { cache: 'no-store' })
      const d = await r.json()
      setLinked(!!d.linked)
      if (d.linked) { setBuilderId(d.builderId); setName(d.name || ''); setPub(d.public || {}); setPsProjects(d.psProjects || []); setManual(d.manual || []) }
    } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }
  const send = async (body: any): Promise<any> => {
    setBusy(true)
    try { const r = await fetch('/api/builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return await r.json() } finally { setBusy(false) }
  }

  const saveProfile = async () => {
    const patch = {
      tagline: pub.tagline || '', sinceYear: pub.sinceYear || '', activeRegionsText: pub.activeRegionsText || '',
      website: pub.website || '', officeAddress: pub.officeAddress || '', phonePublic: pub.phonePublic || '',
      about: pub.about || '', tags: typeof pub.tagsText === 'string' ? pub.tagsText.split(/[,،]/).map((s: string) => s.trim()).filter(Boolean) : (pub.tags || []),
    }
    const d = await send({ action: 'publicProfile', patch })
    if (d.ok) flash('پروفایل ذخیره شد ✓')
  }

  if (loading) return <div style={{ color: 'var(--muted)', padding: '60px 0', textAlign: 'center' }}>در حال بارگذاری…</div>

  if (!linked) return (
    <div style={{ ...card, maxWidth: 620, lineHeight: 2 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>پروفایلِ عمومی</div>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 0 }}>
        حسابِ شما هنوز به پایگاهِ سازنده‌های ملک‌جت متصل نشده است. پس از اتصال (تطبیقِ شمارهٔ شما با
        پروفایلِ سازنده)، می‌توانید پروفایلِ عمومی و پروژه‌هایتان را این‌جا مدیریت کنید و صفحهٔ عمومی
        برایتان فعال می‌شود.
      </p>
    </div>
  )

  const tagsText = pub.tagsText != null ? pub.tagsText : (pub.tags || []).join('، ')

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1000, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>پروفایلِ عمومیِ سازنده</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{name} · این اطلاعات در صفحهٔ عمومیِ شما نمایش داده می‌شود</div>
        </div>
        <a href={`/sazande/${encodeURIComponent(builderId)}`} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>مشاهدهٔ صفحهٔ عمومی ↗</a>
      </div>

      {/* Profile fields */}
      <section style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>معرفی و اطلاعاتِ تماس</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          <div><label style={lbl}>عنوان/تخصص (مثلاً انبوه‌ساز لوکس)</label><input style={inp} value={pub.tagline || ''} onChange={e => setPub({ ...pub, tagline: e.target.value })} /></div>
          <div><label style={lbl}>فعال از سال (شمسی)</label><input style={inp} inputMode="numeric" value={pub.sinceYear || ''} onChange={e => setPub({ ...pub, sinceYear: e.target.value.replace(/\D/g, '') })} placeholder="مثلاً ۱۳۸۸" /></div>
          <div><label style={lbl}>مناطقِ فعالیت</label><input style={inp} value={pub.activeRegionsText || ''} onChange={e => setPub({ ...pub, activeRegionsText: e.target.value })} placeholder="تهران و البرز" /></div>
          <div><label style={lbl}>تلفنِ تماسِ عمومی</label><input style={{ ...inp, direction: 'ltr' }} value={pub.phonePublic || ''} onChange={e => setPub({ ...pub, phonePublic: e.target.value })} placeholder="۰۲۱-..." /></div>
          <div><label style={lbl}>وب‌سایت</label><input style={{ ...inp, direction: 'ltr' }} value={pub.website || ''} onChange={e => setPub({ ...pub, website: e.target.value })} placeholder="example.com" /></div>
          <div><label style={lbl}>دفترِ مرکزی</label><input style={inp} value={pub.officeAddress || ''} onChange={e => setPub({ ...pub, officeAddress: e.target.value })} placeholder="تهران، سعادت‌آباد…" /></div>
        </div>
        <div style={{ marginTop: 14 }}><label style={lbl}>درباره</label><textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={pub.about || ''} onChange={e => setPub({ ...pub, about: e.target.value })} placeholder="معرفیِ کوتاهِ مجموعه…" /></div>
        <div style={{ marginTop: 14 }}><label style={lbl}>برچسب‌ها (با ویرگول جدا کنید)</label><input style={inp} value={tagsText} onChange={e => setPub({ ...pub, tagsText: e.target.value })} placeholder="ساخت لوکس، انبوه‌سازی، تحویل به‌موقع" /></div>
        <div style={{ marginTop: 16 }}><button style={btn} disabled={busy} onClick={saveProfile}>ذخیرهٔ پروفایل</button></div>
      </section>

      {/* Manual projects */}
      <ManualSection manual={manual} send={send} reload={load} flash={flash} busy={busy} />

      {/* Persian-saze projects public settings */}
      {psProjects.length > 0 && (
        <section style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>پروژه‌های پایگاه (نمایشِ عمومی)</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>این پروژه‌ها از دادهٔ واقعیِ شما آمده‌اند. وضعیت، قیمت و درصدِ فروشِ نمایشِ عمومی را این‌جا تنظیم کنید.</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {psProjects.map(p => <PSRow key={p.hashId} p={p} send={send} reload={load} flash={flash} busy={busy} />)}
          </div>
        </section>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 24, insetInlineStart: 24, background: 'var(--surface)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 12, padding: '12px 20px', fontSize: 13.5, fontWeight: 700, zIndex: 200 }}>{toast}</div>}
    </div>
  )
}

function PSRow({ p, send, reload, flash, busy }: { p: PSProj; send: (b: any) => Promise<any>; reload: () => void; flash: (m: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [m, setM] = useState<any>({ status: p.meta?.status || '', deliveryDate: p.meta?.deliveryDate || '', priceText: p.meta?.priceText || '', salesProgress: p.meta?.salesProgress ?? '', areaRange: p.meta?.areaRange || '', description: p.meta?.description || '', published: p.meta?.published !== false, isPast: !!p.meta?.isPast })
  const save = async () => {
    const patch = { status: m.status || undefined, deliveryDate: m.deliveryDate || undefined, priceText: m.priceText || undefined, salesProgress: m.salesProgress === '' ? undefined : Number(m.salesProgress), areaRange: m.areaRange || undefined, description: m.description || undefined, published: m.published, isPast: m.isPast }
    const d = await send({ action: 'projMeta', hashId: p.hashId, patch }); if (d.ok) { flash('ذخیره شد ✓'); reload() }
  }
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
        <div style={{ width: 54, height: 42, borderRadius: 8, background: 'var(--bg2)', flexShrink: 0, overflow: 'hidden' }}>{p.photo && <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.address || '—'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{p.region}{p.phase ? ` · ${p.phase}` : ''} · {fa(p.units)} واحد</div>
        </div>
        {m.published === false && <span style={{ fontSize: 10.5, color: 'var(--faint)', border: '1px solid var(--line2)', borderRadius: 6, padding: '2px 7px' }}>مخفی</span>}
        <button style={btnGhost} onClick={() => setOpen(o => !o)}>{open ? 'بستن' : 'تنظیم'}</button>
      </div>
      {open && (
        <div style={{ padding: 14, borderTop: '1px solid var(--line)', background: 'var(--bg2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
            <div><label style={lbl}>وضعیت</label><select style={inp} value={m.status} onChange={e => setM({ ...m, status: e.target.value })}><option value="">خودکار (از مرحله)</option>{STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
            <div><label style={lbl}>تاریخِ تحویل</label><input style={inp} value={m.deliveryDate} onChange={e => setM({ ...m, deliveryDate: e.target.value })} placeholder="۱۴۰۶" /></div>
            <div><label style={lbl}>قیمت (متن)</label><input style={inp} value={m.priceText} onChange={e => setM({ ...m, priceText: e.target.value })} placeholder="از ۱۴ میلیارد" /></div>
            <div><label style={lbl}>پیشرفتِ فروش (٪)</label><input style={inp} inputMode="numeric" value={m.salesProgress} onChange={e => setM({ ...m, salesProgress: e.target.value.replace(/\D/g, '') })} /></div>
            <div><label style={lbl}>بازهٔ متراژ</label><input style={inp} value={m.areaRange} onChange={e => setM({ ...m, areaRange: e.target.value })} placeholder="۱۳۰ تا ۳۰۰ متر" /></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={lbl}>توضیح</label><textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={m.description} onChange={e => setM({ ...m, description: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={m.published} onChange={e => setM({ ...m, published: e.target.checked })} /> نمایشِ عمومی</label>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={m.isPast} onChange={e => setM({ ...m, isPast: e.target.checked })} /> پروژهٔ تحویل‌شده/قبلی</label>
            <button style={{ ...btn, marginInlineStart: 'auto' }} disabled={busy} onClick={save}>ذخیره</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ManualSection({ manual, send, reload, flash, busy }: { manual: Manual[]; send: (b: any) => Promise<any>; reload: () => void; flash: (m: string) => void; busy: boolean }) {
  const [adding, setAdding] = useState(false)
  const empty: Manual = { id: '', name: '', location: '', status: 'building', deliveryDate: '', units: undefined, areaRange: '', priceText: '', salesProgress: undefined, description: '', published: true, isPast: false }
  const [f, setF] = useState<Manual>(empty)

  const add = async () => {
    if (!f.name.trim()) return
    const data = { ...f, units: f.units ? Number(f.units) : undefined, salesProgress: f.salesProgress != null && String(f.salesProgress) !== '' ? Number(f.salesProgress) : undefined }
    const d = await send({ action: 'manualAdd', data }); if (d.ok) { flash('پروژه افزوده شد ✓'); setF(empty); setAdding(false); reload() }
  }
  const del = async (mid: string) => { const d = await send({ action: 'manualDelete', mid }); if (d.ok) { flash('حذف شد'); reload() } }

  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>تعریفِ پروژه</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>پروژه‌هایی که خودتان تعریف می‌کنید (خارج از پایگاه) این‌جا اضافه می‌شوند و در صفحهٔ عمومی نمایش داده می‌شوند.</div>
        </div>
        <button style={btn} onClick={() => setAdding(a => !a)}>{adding ? 'انصراف' : '+ پروژهٔ جدید'}</button>
      </div>

      {adding && (
        <div style={{ border: '1px solid var(--line2)', borderRadius: 12, padding: 16, marginBottom: 14, background: 'var(--bg2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            <div><label style={lbl}>نامِ پروژه *</label><input style={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="برج آرین" /></div>
            <div><label style={lbl}>موقعیت</label><input style={inp} value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="سعادت‌آباد" /></div>
            <div><label style={lbl}>وضعیت</label><select style={inp} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
            <div><label style={lbl}>تاریخِ تحویل</label><input style={inp} value={f.deliveryDate} onChange={e => setF({ ...f, deliveryDate: e.target.value })} placeholder="۱۴۰۶" /></div>
            <div><label style={lbl}>تعداد واحد</label><input style={inp} inputMode="numeric" value={f.units ?? ''} onChange={e => setF({ ...f, units: e.target.value.replace(/\D/g, '') as any })} /></div>
            <div><label style={lbl}>بازهٔ متراژ</label><input style={inp} value={f.areaRange} onChange={e => setF({ ...f, areaRange: e.target.value })} placeholder="۱۰۰ تا ۲۰۰ متر" /></div>
            <div><label style={lbl}>قیمت (متن)</label><input style={inp} value={f.priceText} onChange={e => setF({ ...f, priceText: e.target.value })} placeholder="از ۱۴ میلیارد" /></div>
            <div><label style={lbl}>پیشرفتِ فروش (٪)</label><input style={inp} inputMode="numeric" value={f.salesProgress ?? ''} onChange={e => setF({ ...f, salesProgress: e.target.value.replace(/\D/g, '') as any })} /></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={lbl}>توضیح</label><textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, cursor: 'pointer', marginTop: 12 }}><input type="checkbox" checked={!!f.isPast} onChange={e => setF({ ...f, isPast: e.target.checked })} /> پروژهٔ تحویل‌شده/قبلی</label>
          <div style={{ marginTop: 14 }}><button style={btn} disabled={busy || !f.name.trim()} onClick={add}>افزودنِ پروژه</button></div>
        </div>
      )}

      {manual.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {manual.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name} {p.isPast && <span style={{ fontSize: 10.5, color: '#5fd98a' }}>· تحویل‌شده</span>}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{p.location}{p.units ? ` · ${fa(p.units)} واحد` : ''}{p.priceText ? ` · ${p.priceText}` : ''}</div>
              </div>
              <button style={{ ...btnGhost, color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.3)' }} disabled={busy} onClick={() => del(p.id)}>حذف</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
