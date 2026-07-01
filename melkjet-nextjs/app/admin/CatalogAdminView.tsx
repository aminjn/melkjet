'use client'
import { useState, useEffect, useCallback } from 'react'
import ImageUpload from '@/app/components/ImageUpload'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT }
const UNITS = ['تن', 'کیسه', 'متر', 'عدد', 'شاخه', 'کیلوگرم', 'بسته', 'رول', 'متر مربع', 'متر مکعب', 'لیتر']

interface Spec { key: string; value: string }
interface Cat { id: string; name: string; parentId?: string; order: number; active: boolean }
interface Prod { id: string; categoryId: string; name: string; brand?: string; unit?: string; image?: string; description?: string; specs?: Spec[]; tags?: string[]; source: 'manual' | 'hypersaz'; externalUrl?: string; active: boolean }
interface Stats { categories: number; products: number; hypersaz: number; manual: number }

// مدیریتِ کاتالوگِ مرجعِ مصالح — ادمین دسته و کالا می‌سازد؛ مصالح‌فروش‌ها فقط انتخاب می‌کنند.
export default function CatalogAdminView() {
  const [cats, setCats] = useState<Cat[]>([])
  const [prods, setProds] = useState<Prod[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [activeCat, setActiveCat] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Prod | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [scrapeOpen, setScrapeOpen] = useState(false)

  const load = useCallback(() => {
    const p = new URLSearchParams()
    if (activeCat) p.set('categoryId', activeCat)
    if (search.trim()) p.set('search', search.trim())
    fetch(`/api/admin/catalog?${p}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setCats(d.categories || []); setProds(d.products || []); setStats(d.stats || null) }
    }).catch(() => {})
  }, [activeCat, search])
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t) }, [load])

  const post = async (body: any) => {
    setBusy(true)
    try { const r = await fetch('/api/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); if (!r.ok || d.error) { alert(d.error || 'خطا'); return false } load(); return true }
    finally { setBusy(false) }
  }

  const addCat = async () => { const name = prompt('نامِ دستهٔ جدید:'); if (name?.trim()) await post({ action: 'addCategory', name: name.trim() }) }
  const renameCat = async (c: Cat) => { const name = prompt('نامِ دسته:', c.name); if (name != null && name.trim()) await post({ action: 'updateCategory', id: c.id, patch: { name: name.trim() } }) }
  const delCat = async (c: Cat) => { if (confirm(`حذفِ دستهٔ «${c.name}» و همهٔ کالاهایش؟`)) await post({ action: 'deleteCategory', id: c.id }) }
  const delProd = async (p: Prod) => { if (confirm(`حذفِ «${p.name}»؟`)) await post({ action: 'deleteProduct', id: p.id }) }

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>کاتالوگِ مرجعِ مصالح</h2>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
            {stats && `${fa(stats.categories)} دسته · ${fa(stats.products)} کالا (${fa(stats.hypersaz)} هایپرساز، ${fa(stats.manual)} دستی)`}
            {' — '}مصالح‌فروش‌ها فقط از این لیست انتخاب می‌کنند.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setScrapeOpen(true)} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>⛏ ایمپورت از هایپرساز</button>
          <button onClick={() => setEditing('new')} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>+ کالای جدید</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 16, alignItems: 'start' }}>
        {/* categories */}
        <div style={{ ...card, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>دسته‌بندی‌ها</span>
            <button onClick={addCat} style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>+ افزودن</button>
          </div>
          <button onClick={() => setActiveCat('')} style={catBtn(activeCat === '')}>همهٔ کالاها</button>
          {cats.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => setActiveCat(c.id)} style={{ ...catBtn(activeCat === c.id), flex: 1 }}>{c.name}</button>
              <button onClick={() => renameCat(c)} title="ویرایش" style={miniBtn}>✎</button>
              <button onClick={() => delCat(c)} title="حذف" style={{ ...miniBtn, color: '#f87171' }}>×</button>
            </div>
          ))}
          {cats.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>دسته‌ای نیست.</div>}
        </div>

        {/* products */}
        <div>
          <input placeholder="جستجوی کالا…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, marginBottom: 12, height: 42 }} />
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 0.8fr 1fr', padding: '10px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              <div>کالا</div><div>دسته</div><div>منبع</div><div style={{ textAlign: 'left' }}>عملیات</div>
            </div>
            <div style={{ maxHeight: 560, overflowY: 'auto' }}>
              {prods.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>کالایی نیست — «+ کالای جدید» یا «ایمپورت از هایپرساز».</div>
              ) : prods.map((p, i) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 0.8fr 1fr', padding: '10px 16px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0, background: p.image ? `center/cover no-repeat url(${p.image})` : 'var(--bg2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{!p.image && '🧱'}</div>
                    <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>{p.brand && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.brand}</div>}</div>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{cats.find(c => c.id === p.categoryId)?.name || '—'}</div>
                  <div><span style={{ fontSize: 10.5, fontWeight: 700, color: p.source === 'hypersaz' ? '#5fd98a' : 'var(--gold)', background: 'var(--bg2)', borderRadius: 6, padding: '2px 7px' }}>{p.source === 'hypersaz' ? 'هایپرساز' : 'دستی'}</span></div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(p)} style={rowBtn}>ویرایش</button>
                    <button onClick={() => delProd(p)} style={{ ...rowBtn, color: '#f87171' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editing && <ProductEditor product={editing === 'new' ? null : editing} cats={cats} defaultCat={activeCat} post={post} busy={busy} onClose={() => setEditing(null)} />}
      {scrapeOpen && <ScrapePanel onClose={() => setScrapeOpen(false)} onDone={load} />}
    </div>
  )
}

function catBtn(active: boolean): React.CSSProperties {
  return { display: 'block', width: '100%', textAlign: 'right', padding: '8px 10px', borderRadius: 8, border: 'none', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text)', fontSize: 12.5, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: FONT, marginBottom: 2 }
}
const miniBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, flexShrink: 0 }
const rowBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT }

// ── ویرایشگرِ کالای مرجع ──
function ProductEditor({ product, cats, defaultCat, post, busy, onClose }: { product: Prod | null; cats: Cat[]; defaultCat: string; post: (b: any) => Promise<boolean>; busy: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: product?.name || '', categoryId: product?.categoryId || defaultCat || (cats[0]?.id || ''), brand: product?.brand || '', unit: product?.unit || UNITS[0], description: product?.description || '', active: product ? product.active : true })
  const [image, setImage] = useState(product?.image || '')
  const [specs, setSpecs] = useState<Spec[]>(product?.specs?.length ? product.specs : [{ key: '', value: '' }])
  const [tags, setTags] = useState((product?.tags || []).join('، '))
  const set = (k: string, v: any) => setF(s => ({ ...s, [k]: v }))
  const save = async () => {
    if (!f.name.trim()) { alert('نامِ کالا الزامی است'); return }
    if (!f.categoryId) { alert('دسته را انتخاب کنید'); return }
    const patch = { name: f.name.trim(), categoryId: f.categoryId, brand: f.brand.trim(), unit: f.unit, description: f.description.trim(), image, active: f.active, specs: specs.filter(s => s.key.trim() && s.value.trim()), tags: tags.split(/[،,\n]+/).map(t => t.trim()).filter(Boolean) }
    const ok = product ? await post({ action: 'updateProduct', id: product.id, patch }) : await post({ action: 'addProduct', ...patch })
    if (ok) onClose()
  }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 5, display: 'block' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 680, width: '100%', margin: '24px 0', padding: 22, fontFamily: FONT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{product ? 'ویرایشِ کالای مرجع' : 'کالای مرجعِ جدید'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <label style={lab}>تصویرِ کالا</label>
        <div style={{ maxWidth: 180, marginBottom: 14 }}><ImageUpload value={image} onChange={setImage} height={100} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}><label style={lab}>نامِ کالا *</label><input value={f.name} onChange={e => set('name', e.target.value)} style={inp} /></div>
          <div><label style={lab}>دسته *</label><select value={f.categoryId} onChange={e => set('categoryId', e.target.value)} style={{ ...inp, cursor: 'pointer' }}><option value="">— انتخاب —</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label style={lab}>واحدِ فروش</label><select value={f.unit} onChange={e => set('unit', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
          <div><label style={lab}>برند / تولیدکننده</label><input value={f.brand} onChange={e => set('brand', e.target.value)} style={inp} /></div>
        </div>
        <label style={lab}>توضیحات</label>
        <textarea value={f.description} onChange={e => set('description', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', marginBottom: 14 }} />
        <label style={lab}>مشخصاتِ فنی</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {specs.map((sp, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 8 }}>
              <input value={sp.key} onChange={e => setSpecs(ss => ss.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="عنوان" style={inp} />
              <input value={sp.value} onChange={e => setSpecs(ss => ss.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="مقدار" style={inp} />
              <button onClick={() => setSpecs(ss => ss.length > 1 ? ss.filter((_, j) => j !== i) : [{ key: '', value: '' }])} style={{ ...rowBtn, color: '#f87171', width: 34 }}>×</button>
            </div>
          ))}
          <button onClick={() => setSpecs(ss => [...ss, { key: '', value: '' }])} style={{ ...rowBtn, color: 'var(--gold)', alignSelf: 'flex-start' }}>+ مشخصه</button>
        </div>
        <label style={lab}>برچسب‌ها (با ویرگول)</label>
        <input value={tags} onChange={e => setTags(e.target.value)} style={{ ...inp, marginBottom: 14 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 14 }}><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} /> فعال (در دسترسِ مصالح‌فروش‌ها)</label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>انصراف</button>
          <button onClick={save} disabled={busy} style={{ padding: '10px 26px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1, fontFamily: FONT }}>{busy ? '…' : 'ذخیره'}</button>
        </div>
      </div>
    </div>
  )
}

// ── پنلِ اسکرپِ هایپرساز ──
function ScrapePanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [job, setJob] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const poll = useCallback(() => {
    fetch('/api/admin/catalog/scrape').then(r => r.ok ? r.json() : null).then(d => { if (d?.job) { setJob(d.job); setRunning(d.job.running) } }).catch(() => {})
  }, [])
  useEffect(() => { poll(); const t = setInterval(poll, 2500); return () => clearInterval(t) }, [poll])
  useEffect(() => { if (job && !job.running && job.done > 0) onDone() }, [job?.running]) // eslint-disable-line

  const start = async () => {
    setRunning(true)
    await fetch('/api/admin/catalog/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) }).catch(() => {})
    poll()
  }
  const stop = async () => { await fetch('/api/admin/catalog/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) }).catch(() => {}); poll() }

  const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 560, width: '100%', padding: 24, fontFamily: FONT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>⛏ ایمپورت از هایپرساز</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9, marginBottom: 16 }}>
          دسته‌بندی‌ها و کالاهای <b>hypersaz.com</b> اسکرپ و به کاتالوگِ مرجع اضافه می‌شوند. این کار در پس‌زمینه اجرا می‌شود و می‌توانید صفحه را ببندید.
        </div>
        {job && (job.running || job.done > 0) && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
              <span>{job.label || 'در حال اسکرپ'}{job.running ? ' …' : ' (پایان)'}</span>
              <span>{fa(job.done)}{job.total ? ` / ${fa(job.total)}` : ''} · +{fa(job.added || 0)} کالا</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--bg2)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,var(--gold2),var(--gold))', transition: 'width .3s' }} /></div>
            {job.error && <div style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>{job.error}</div>}
            {job.categories ? <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{fa(job.categories)} دسته · {fa(job.added || 0)} افزوده · {fa(job.updated || 0)} به‌روز</div> : null}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          {running
            ? <button onClick={stop} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #f87171', background: 'transparent', color: '#f87171', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: FONT }}>توقف</button>
            : <button onClick={start} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: FONT }}>شروعِ اسکرپ</button>}
        </div>
      </div>
    </div>
  )
}
