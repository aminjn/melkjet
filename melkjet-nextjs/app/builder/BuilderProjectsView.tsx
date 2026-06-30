'use client'
import { useEffect, useState, useCallback } from 'react'
import ImageUpload from '../components/ImageUpload'
import LiveScore from '../components/LiveScore'

// مدیریتِ پروژه‌ها در پنلِ سازنده — یک‌جا، یکپارچه: پروژه‌های پایگاه (با override) و
// پروژه‌های دستی. هر پروژه: مرحلهٔ ساخت (نردبانِ یکسانِ سایت)، وضعیت، عکس، پلان (چند سبک)،
// امکانات و همهٔ اطلاعات. آنچه این‌جا پر شود، در صفحهٔ عمومیِ پروژه نمایش داده می‌شود.

const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
const STAGES = ['پی و اسکلت', 'سفت‌کاری', 'گچ و خاک', 'نازک‌کاری', 'تأسیسات', 'تحویل']
const STATUSES: { v: string; l: string }[] = [{ v: 'building', l: 'در حال ساخت' }, { v: 'presale', l: 'پیش‌فروش' }, { v: 'delivered', l: 'تحویل‌شده' }]
const USAGES = ['مسکونی', 'تجاری', 'اداری', 'مسکونی-تجاری']

const inp: React.CSSProperties = { width: '100%', border: '1px solid var(--line2)', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6, display: 'block' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }
const btn: React.CSSProperties = { background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', borderRadius: 11, padding: '10px 18px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line2)', borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }

interface PSProj { hashId: string; address: string; region: string; phase: string; units: number; floors: number; photo: string; meta: any }
interface Manual { id: string; name: string; location: string; status: string; [k: string]: any }

export default function BuilderProjectsView() {
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState(false)
  const [psProjects, setPsProjects] = useState<PSProj[]>([])
  const [manual, setManual] = useState<Manual[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/builder?public=1', { cache: 'no-store' })
      const d = await r.json()
      setLinked(!!d.linked)
      if (d.linked) { setPsProjects(d.psProjects || []); setManual(d.manual || []) }
    } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }
  const send = async (body: any): Promise<any> => {
    setBusy(true)
    try { const r = await fetch('/api/builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return await r.json() } finally { setBusy(false) }
  }

  if (loading) return <div style={{ color: 'var(--muted)', padding: '60px 0', textAlign: 'center' }}>در حال بارگذاری…</div>
  if (!linked) return <div style={{ ...card, maxWidth: 620 }}><div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>پروژه‌ها</div><p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 0, lineHeight: 1.9 }}>حسابِ شما هنوز به پایگاهِ سازنده‌ها متصل نشده است. پس از اتصال، پروژه‌هایتان این‌جا می‌آیند و می‌توانید پروژهٔ جدید هم تعریف کنید.</p></div>

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 1000, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>پروژه‌ها</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>اطلاعات، عکس، پلان، امکانات و مرحلهٔ هر پروژه — همگی در صفحهٔ عمومی نمایش داده می‌شود</div>
        </div>
        <button style={btn} onClick={() => setAdding(a => !a)}>{adding ? 'انصراف' : '+ تعریفِ پروژهٔ جدید'}</button>
      </div>

      {adding && (
        <ProjectForm isManual title="پروژهٔ جدید"
          onSave={async (data) => { const d = await send({ action: 'manualAdd', data }); if (d.ok) { flash('پروژه افزوده شد ✓'); setAdding(false); load() } }}
          busy={busy} />
      )}

      {/* پروژه‌های دستی */}
      {manual.map(m => (
        <ProjectCard key={m.id} title={m.name} subtitle={`${m.location || '—'} · پروژهٔ دستی`} badge={m.published === false ? 'مخفی' : ''}>
          <ProjectForm isManual initial={m} title=""
            onSave={async (patch) => { const d = await send({ action: 'manualUpdate', mid: m.id, patch }); if (d.ok) { flash('ذخیره شد ✓'); load() } }}
            onDelete={async () => { if (!confirm('این پروژه حذف شود؟')) return; const d = await send({ action: 'manualDelete', mid: m.id }); if (d.ok) { flash('حذف شد'); load() } }}
            busy={busy} />
        </ProjectCard>
      ))}

      {/* پروژه‌های پایگاه (پرشین سازه) */}
      {psProjects.map(p => (
        <ProjectCard key={p.hashId} photo={p.photo} title={p.address || '—'} subtitle={`${p.region}${p.phase ? ' · ' + p.phase : ''} · ${fa(p.units)} واحد`} badge={p.meta?.published === false ? 'مخفی' : 'از پایگاه'}>
          <ProjectForm initial={{ ...p.meta, units: p.meta?.units ?? p.units, floors: p.meta?.floors ?? p.floors }} title="" psPhase={p.phase}
            onSave={async (patch) => { const d = await send({ action: 'projMeta', hashId: p.hashId, patch }); if (d.ok) { flash('ذخیره شد ✓'); load() } }}
            busy={busy} />
        </ProjectCard>
      ))}

      {toast && <div style={{ position: 'fixed', bottom: 24, insetInlineStart: 24, background: 'var(--surface)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 12, padding: '12px 20px', fontSize: 13.5, fontWeight: 700, zIndex: 200 }}>{toast}</div>}
    </div>
  )
}

function ProjectCard({ photo, title, subtitle, badge, children }: { photo?: string; title: string; subtitle: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
        {photo !== undefined && <div style={{ width: 56, height: 44, borderRadius: 8, background: 'var(--bg2)', overflow: 'hidden', flexShrink: 0 }}>{photo && <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
        </div>
        {badge && <span style={{ fontSize: 10.5, color: 'var(--faint)', border: '1px solid var(--line2)', borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{badge}</span>}
        <button style={btnGhost} onClick={() => setOpen(o => !o)}>{open ? 'بستن' : 'ویرایش'}</button>
      </div>
      {open && <div style={{ padding: 16, borderTop: '1px solid var(--line)', background: 'var(--bg2)' }}>{children}</div>}
    </section>
  )
}

function ProjectForm({ isManual, initial, title, psPhase, onSave, onDelete, busy }: {
  isManual?: boolean; initial?: any; title?: string; psPhase?: string
  onSave: (data: any) => void; onDelete?: () => void; busy?: boolean
}) {
  const [f, setF] = useState<any>({
    name: initial?.name || '', location: initial?.location || '', usage: initial?.usage || '',
    status: initial?.status || 'building', stage: initial?.stage || '', deliveryDate: initial?.deliveryDate || '',
    units: initial?.units ?? '', floors: initial?.floors ?? '', areaRange: initial?.areaRange || '',
    priceText: initial?.priceText || '', salesProgress: initial?.salesProgress ?? '', description: initial?.description || '',
    amenities: initial?.amenities || [], photos: initial?.photos || [], plans: initial?.plans || [],
    published: initial?.published !== false, isPast: !!initial?.isPast,
  })
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))
  const [amenityInput, setAmenityInput] = useState('')

  const save = () => {
    const data: any = { ...f, units: f.units === '' ? undefined : Number(f.units), floors: f.floors === '' ? undefined : Number(f.floors), salesProgress: f.salesProgress === '' ? undefined : Number(f.salesProgress) }
    if (!isManual) { delete data.name; delete data.location }
    onSave(data)
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {title && <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
        {isManual && <div><label style={lbl}>نامِ پروژه *</label><input style={inp} value={f.name} onChange={e => set('name', e.target.value)} placeholder="برج آرین" /></div>}
        {isManual && <div><label style={lbl}>موقعیت</label><input style={inp} value={f.location} onChange={e => set('location', e.target.value)} placeholder="سعادت‌آباد" /></div>}
        <div><label style={lbl}>کاربری</label><select style={inp} value={f.usage} onChange={e => set('usage', e.target.value)}><option value="">—</option>{USAGES.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
        <div><label style={lbl}>وضعیتِ فروش</label><select style={inp} value={f.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
        <div><label style={lbl}>مرحلهٔ ساخت{psPhase ? ` (پایگاه: ${psPhase})` : ''}</label><select style={inp} value={f.stage} onChange={e => set('stage', e.target.value)}><option value="">{psPhase ? `خودکار (${psPhase})` : '—'}</option>{STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>تاریخِ تحویل</label><input style={inp} value={f.deliveryDate} onChange={e => set('deliveryDate', e.target.value)} placeholder="۱۴۰۶" /></div>
        <div><label style={lbl}>تعداد واحد</label><input style={inp} inputMode="numeric" value={f.units} onChange={e => set('units', e.target.value.replace(/\D/g, ''))} /></div>
        <div><label style={lbl}>طبقات (روی‌زمین)</label><input style={inp} inputMode="numeric" value={f.floors} onChange={e => set('floors', e.target.value.replace(/\D/g, ''))} /></div>
        <div><label style={lbl}>بازهٔ متراژ</label><input style={inp} value={f.areaRange} onChange={e => set('areaRange', e.target.value)} placeholder="۱۰۰ تا ۲۰۰ متر" /></div>
        <div><label style={lbl}>قیمت (متن)</label><input style={inp} value={f.priceText} onChange={e => set('priceText', e.target.value)} placeholder="از ۱۴ میلیارد" /></div>
        <div><label style={lbl}>پیشرفتِ فروش (٪)</label><input style={inp} inputMode="numeric" value={f.salesProgress} onChange={e => set('salesProgress', e.target.value.replace(/\D/g, ''))} /></div>
      </div>

      <div><label style={lbl}>توضیح</label><textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={f.description} onChange={e => set('description', e.target.value)} /></div>

      {/* امکانات */}
      <div>
        <label style={lbl}>امکانات</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {f.amenities.map((a: string, i: number) => (
            <span key={i} style={{ fontSize: 12, background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 999, padding: '5px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
              {a}<button onClick={() => set('amenities', f.amenities.filter((_: any, j: number) => j !== i))} style={{ border: 'none', background: 'none', color: '#e7674a', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={inp} value={amenityInput} onChange={e => setAmenityInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && amenityInput.trim()) { set('amenities', [...f.amenities, amenityInput.trim()]); setAmenityInput('') } }} placeholder="مثلاً استخر، روف‌گاردن، پارکینگ — Enter بزنید" />
          <button style={btnGhost} onClick={() => { if (amenityInput.trim()) { set('amenities', [...f.amenities, amenityInput.trim()]); setAmenityInput('') } }}>افزودن</button>
        </div>
      </div>

      {/* عکس‌ها */}
      <div>
        <label style={lbl}>عکس‌های پروژه</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          {f.photos.map((url: string, i: number) => (
            <div key={i}><ImageUpload value={url} onChange={(u) => { const arr = [...f.photos]; if (u) arr[i] = u; else arr.splice(i, 1); set('photos', arr) }} height={90} /></div>
          ))}
          <ImageUpload value="" onChange={(u) => u && set('photos', [...f.photos, u])} height={90} label="" />
        </div>
      </div>

      {/* پلان‌ها (چند سبک) */}
      <div>
        <label style={lbl}>نقشهٔ پلان (می‌توانید چند سبک اضافه کنید)</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          {f.plans.map((pl: any, i: number) => (
            <div key={i} style={{ border: '1px solid var(--line2)', borderRadius: 10, padding: 10 }}>
              <ImageUpload value={pl.url} onChange={(u) => { const arr = [...f.plans]; if (u) arr[i] = { ...arr[i], url: u }; else arr.splice(i, 1); set('plans', arr) }} height={120} />
              <input style={{ ...inp, marginTop: 8 }} value={pl.label} onChange={e => { const arr = [...f.plans]; arr[i] = { ...arr[i], label: e.target.value }; set('plans', arr) }} placeholder="عنوان (مثلاً ۲ خوابه)" />
            </div>
          ))}
          <div style={{ border: '1px dashed var(--line2)', borderRadius: 10, padding: 10 }}>
            <ImageUpload value="" onChange={(u) => u && set('plans', [...f.plans, { label: 'پلان', url: u }])} height={120} label="افزودنِ پلان" />
          </div>
        </div>
      </div>

      {/* امتیاز و تحلیلِ زندهٔ پروژه */}
      <LiveScore kind="project" ready={!isManual || !!f.name.trim()} data={{
        'نام': f.name, 'موقعیت': f.location, 'کاربری': f.usage, 'مرحلهٔ ساخت': f.stage,
        'تعداد واحد': f.units, 'طبقات': f.floors, 'بازهٔ متراژ': f.areaRange, 'قیمت': f.priceText,
        'پیشرفتِ فروش': f.salesProgress !== '' && f.salesProgress != null ? `${f.salesProgress}٪` : '',
        'توضیح': f.description,
        'تعداد امکانات': String((f.amenities || []).length), 'تعداد عکس': String((f.photos || []).length), 'تعداد پلان': String((f.plans || []).length),
      }} />

      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={f.published} onChange={e => set('published', e.target.checked)} /> نمایشِ عمومی</label>
        <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={f.isPast} onChange={e => set('isPast', e.target.checked)} /> پروژهٔ تحویل‌شده/قبلی</label>
        {onDelete && <button onClick={onDelete} disabled={busy} style={{ ...btnGhost, color: '#e7674a', borderColor: 'rgba(231,103,74,.4)' }}>حذفِ پروژه</button>}
        <button style={{ ...btn, marginInlineStart: 'auto' }} disabled={busy || (isManual && !f.name.trim())} onClick={save}>{isManual && !initial ? 'افزودنِ پروژه' : 'ذخیره'}</button>
      </div>
    </div>
  )
}
