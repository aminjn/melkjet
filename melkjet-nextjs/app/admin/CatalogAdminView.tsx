'use client'
import { useState, useEffect, useCallback } from 'react'
import ImageUpload from '@/app/components/ImageUpload'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14 }
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT }
const UNITS = ['تن', 'کیسه', 'متر', 'عدد', 'شاخه', 'کیلوگرم', 'بسته', 'رول', 'متر مربع', 'متر مکعب', 'لیتر', 'حلب', 'گالن', 'پالت']
const gold: React.CSSProperties = { padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }
const ghost: React.CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: FONT }

interface Spec { key: string; value: string }
interface Cat { id: string; name: string; parentId?: string; order: number; active: boolean }
interface Prod { id: string; categoryId: string; name: string; brand?: string; unit?: string; image?: string; description?: string; specs?: Spec[]; tags?: string[]; source: 'manual' | 'hypersaz'; externalUrl?: string; active: boolean }
interface Stats { categories: number; products: number; hypersaz: number; manual: number }

export default function CatalogAdminView() {
  const [cats, setCats] = useState<Cat[]>([])
  const [prods, setProds] = useState<Prod[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [activeCat, setActiveCat] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Prod | 'new' | null>(null)
  const [catModal, setCatModal] = useState<{ mode: 'add' | 'edit'; cat?: Cat; parentId?: string } | null>(null)
  const [confirmDel, setConfirmDel] = useState<{ kind: 'cat' | 'prod'; id: string; name: string } | null>(null)
  const [scrape, setScrape] = useState(false)
  const [clearScope, setClearScope] = useState<'scraped' | 'all' | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(() => {
    const p = new URLSearchParams()
    if (activeCat) p.set('categoryId', activeCat)
    if (search.trim()) p.set('search', search.trim())
    fetch(`/api/admin/catalog?${p}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setCats(d.categories || []); setProds(d.products || []); setStats(d.stats || null) }
    }).catch(() => {})
  }, [activeCat, search])
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t) }, [load])

  const post = async (body: any): Promise<boolean> => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) { setToast(d.error || 'خطا'); setTimeout(() => setToast(''), 3000); return false }
      load(); return true
    } finally { setBusy(false) }
  }

  // درختِ دسته‌ها: والدها + زیردسته‌ها
  const roots = cats.filter(c => !c.parentId)
  const childrenOf = (id: string) => cats.filter(c => c.parentId === id)

  return (
    <div style={{ fontFamily: FONT }}>
      {toast && <div style={{ position: 'fixed', top: 20, insetInlineStart: '50%', transform: 'translateX(-50%)', background: '#3a1a15', border: '1px solid #e7674a', color: '#ffb4a0', padding: '10px 18px', borderRadius: 10, zIndex: 300, fontSize: 13 }}>{toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>کاتالوگِ مرجعِ مصالح</h2>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
            {stats && `${fa(stats.categories)} دسته · ${fa(stats.products)} کالا (${fa(stats.hypersaz)} اسکرپ‌شده، ${fa(stats.manual)} دستی)`}
            {' — '}مصالح‌فروش‌ها فقط از این لیست انتخاب می‌کنند.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {stats && stats.products > 0 && <button onClick={() => setClearScope('scraped')} style={{ ...ghost, border: '1px solid #e7674a', color: '#f87171' }}>🗑 پاک‌کردنِ دسته‌جمعی</button>}
          <button onClick={() => setScrape(true)} style={{ ...ghost, border: '1px solid var(--gold)', color: 'var(--gold)', fontWeight: 700 }}>⛏ اسکرپ و تنظیمات</button>
          <button onClick={() => setEditing('new')} style={gold}>+ کالای جدید</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
        {/* categories tree */}
        <div style={{ ...card, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>دسته‌بندی‌ها</span>
            <button onClick={() => setCatModal({ mode: 'add' })} style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>+ دستهٔ اصلی</button>
          </div>
          <button onClick={() => setActiveCat('')} style={catBtn(activeCat === '', 0)}>همهٔ کالاها</button>
          {(() => {
            const node = (c: Cat, depth: number): React.ReactNode => (
              <div key={c.id}>
                <CatRow c={c} depth={depth} active={activeCat === c.id} onSelect={() => setActiveCat(c.id)} onAddSub={() => setCatModal({ mode: 'add', parentId: c.id })} onEdit={() => setCatModal({ mode: 'edit', cat: c })} onDel={() => setConfirmDel({ kind: 'cat', id: c.id, name: c.name })} />
                {depth < 3 && childrenOf(c.id).map(ch => node(ch, depth + 1))}
              </div>
            )
            return roots.map(c => node(c, 0))
          })()}
          {cats.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>دسته‌ای نیست — «+ دستهٔ اصلی».</div>}
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
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>کالایی نیست — «+ کالای جدید» یا «اسکرپ».</div>
              ) : prods.map((p, i) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 0.8fr 1fr', padding: '10px 16px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0, background: p.image ? `center/cover no-repeat url(${p.image})` : 'var(--bg2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{!p.image && '🧱'}</div>
                    <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>{p.brand && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.brand}</div>}</div>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{cats.find(c => c.id === p.categoryId)?.name || '—'}</div>
                  <div><span style={{ fontSize: 10.5, fontWeight: 700, color: p.source === 'hypersaz' ? '#5fd98a' : 'var(--gold)', background: 'var(--bg2)', borderRadius: 6, padding: '2px 7px' }}>{p.source === 'hypersaz' ? 'اسکرپ' : 'دستی'}</span></div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(p)} style={rowBtn}>ویرایش</button>
                    <button onClick={() => setConfirmDel({ kind: 'prod', id: p.id, name: p.name })} style={{ ...rowBtn, color: '#f87171' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editing && <ProductEditor product={editing === 'new' ? null : editing} cats={cats} defaultCat={activeCat} post={post} busy={busy} onClose={() => setEditing(null)} />}
      {catModal && <CategoryModal state={catModal} cats={cats} post={post} busy={busy} onClose={() => setCatModal(null)} />}
      {scrape && <ScrapePanel onClose={() => setScrape(false)} onDone={load} />}
      {clearScope && (
        <Overlay onClose={() => setClearScope(null)} max={440}>
          <Head title="پاک‌کردنِ دسته‌جمعی" onClose={() => setClearScope(null)} />
          <div style={{ fontSize: 13.5, lineHeight: 1.9, marginBottom: 16 }}>چه چیزی پاک شود؟ این عملیات بازگشت‌ناپذیر است.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <button onClick={async () => { const r = await post({ action: 'clearCatalog', scope: 'scraped' }); if (r) { setClearScope(null); setActiveCat('') } }} disabled={busy} style={{ ...ghost, textAlign: 'right', padding: '12px 14px' }}>🗑 فقط محصولاتِ <b>اسکرپ‌شده</b> (هایپرساز) + دسته‌های خالی — کالاهای دستی می‌مانند</button>
            <button onClick={async () => { const r = await post({ action: 'clearCatalog', scope: 'all' }); if (r) { setClearScope(null); setActiveCat('') } }} disabled={busy} style={{ ...ghost, textAlign: 'right', padding: '12px 14px', border: '1px solid #e7674a', color: '#f87171' }}>⚠ <b>همهٔ</b> کالاها و دسته‌بندی‌ها (اسکرپ‌شده + دستی)</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => setClearScope(null)} style={ghost}>انصراف</button></div>
        </Overlay>
      )}
      {confirmDel && <ConfirmModal text={confirmDel.kind === 'cat' ? `حذفِ دستهٔ «${confirmDel.name}» و همهٔ کالاها/زیردسته‌هایش؟` : `حذفِ «${confirmDel.name}»؟`} busy={busy} onClose={() => setConfirmDel(null)} onConfirm={async () => { await post({ action: confirmDel.kind === 'cat' ? 'deleteCategory' : 'deleteProduct', id: confirmDel.id }); setConfirmDel(null) }} />}
    </div>
  )
}

function CatRow({ c, depth, active, onSelect, onAddSub, onEdit, onDel }: { c: Cat; depth: number; active: boolean; onSelect: () => void; onAddSub: () => void; onEdit: () => void; onDel: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button onClick={onSelect} style={{ ...catBtn(active, depth), flex: 1 }}>{depth ? '↳ ' : ''}{c.name}</button>
      {depth < 3 && <button onClick={onAddSub} title="زیردسته" style={miniBtn}>＋</button>}
      <button onClick={onEdit} title="ویرایش" style={miniBtn}>✎</button>
      <button onClick={onDel} title="حذف" style={{ ...miniBtn, color: '#f87171' }}>×</button>
    </div>
  )
}
function catBtn(active: boolean, depth: number): React.CSSProperties {
  return { display: 'block', width: '100%', textAlign: 'right', padding: '7px 10px', paddingInlineStart: 10 + depth * 14, borderRadius: 8, border: 'none', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text)', fontSize: 12.5, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: FONT, marginBottom: 1 }
}
const miniBtn: React.CSSProperties = { width: 24, height: 24, borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, flexShrink: 0 }
const rowBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT }

function Overlay({ children, onClose, max = 680 }: { children: React.ReactNode; onClose: () => void; max?: number }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 250, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: max, width: '100%', margin: '24px 0', padding: 22, fontFamily: FONT }}>{children}</div>
    </div>
  )
}
function Head({ title, onClose }: { title: string; onClose: () => void }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button></div>
}
const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 5, display: 'block' }

function ConfirmModal({ text, busy, onConfirm, onClose }: { text: string; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Overlay onClose={onClose} max={420}>
      <div style={{ fontSize: 14, lineHeight: 1.9, marginBottom: 18 }}>{text}</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={ghost}>انصراف</button>
        <button onClick={onConfirm} disabled={busy} style={{ ...gold, background: '#e7674a', color: '#fff' }}>حذف</button>
      </div>
    </Overlay>
  )
}

// مودالِ دسته‌بندی (افزودن/ویرایش) با انتخابِ والد برای زیردسته
function CategoryModal({ state, cats, post, busy, onClose }: { state: { mode: 'add' | 'edit'; cat?: Cat; parentId?: string }; cats: Cat[]; post: (b: any) => Promise<boolean>; busy: boolean; onClose: () => void }) {
  const [name, setName] = useState(state.cat?.name || '')
  const [parentId, setParentId] = useState(state.cat?.parentId || state.parentId || '')
  const roots = cats.filter(c => !c.parentId && c.id !== state.cat?.id)
  const save = async () => {
    if (!name.trim()) return
    const ok = state.mode === 'edit' && state.cat
      ? await post({ action: 'updateCategory', id: state.cat.id, patch: { name: name.trim(), parentId: parentId || undefined } })
      : await post({ action: 'addCategory', name: name.trim(), parentId: parentId || undefined })
    if (ok) onClose()
  }
  return (
    <Overlay onClose={onClose} max={440}>
      <Head title={state.mode === 'edit' ? 'ویرایشِ دسته' : (parentId ? 'زیردستهٔ جدید' : 'دستهٔ جدید')} onClose={onClose} />
      <label style={lab}>نامِ دسته</label>
      <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="مثلاً آهن‌آلات" style={{ ...inp, marginBottom: 14 }} />
      <label style={lab}>زیرمجموعهٔ (اختیاری)</label>
      <select value={parentId} onChange={e => setParentId(e.target.value)} style={{ ...inp, cursor: 'pointer', marginBottom: 18 }}>
        <option value="">— دستهٔ اصلی —</option>
        {roots.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={ghost}>انصراف</button>
        <button onClick={save} disabled={busy || !name.trim()} style={gold}>{busy ? '…' : 'ذخیره'}</button>
      </div>
    </Overlay>
  )
}

// گزینه‌های دسته به‌صورتِ سلسله‌مراتبی (والد + زیردسته با تورفتگی)
function catOptions(cats: Cat[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  for (const r of cats.filter(c => !c.parentId)) {
    out.push({ id: r.id, label: r.name })
    for (const ch of cats.filter(c => c.parentId === r.id)) out.push({ id: ch.id, label: `  ↳ ${ch.name}` })
  }
  return out
}

// ── ویرایشگرِ کاملِ کالای مرجع ──
function ProductEditor({ product, cats, defaultCat, post, busy, onClose }: { product: Prod | null; cats: Cat[]; defaultCat: string; post: (b: any) => Promise<boolean>; busy: boolean; onClose: () => void }) {
  const opts = catOptions(cats)
  const [f, setF] = useState({ name: product?.name || '', categoryId: product?.categoryId || defaultCat || (opts[0]?.id || ''), brand: product?.brand || '', unit: product?.unit || UNITS[0], description: product?.description || '', active: product ? product.active : true })
  const [image, setImage] = useState(product?.image || '')
  const [specs, setSpecs] = useState<Spec[]>(product?.specs?.length ? product.specs : [{ key: '', value: '' }])
  const [tags, setTags] = useState((product?.tags || []).join('، '))
  const [err, setErr] = useState('')
  const set = (k: string, v: any) => setF(s => ({ ...s, [k]: v }))
  const save = async () => {
    if (!f.name.trim()) { setErr('نامِ کالا الزامی است'); return }
    if (!f.categoryId) { setErr('دسته را انتخاب کنید (اگر دسته‌ای نیست، اول یک دسته بسازید)'); return }
    const patch = { name: f.name.trim(), categoryId: f.categoryId, brand: f.brand.trim(), unit: f.unit, description: f.description.trim(), image, active: f.active, specs: specs.filter(s => s.key.trim() && s.value.trim()), tags: tags.split(/[،,\n]+/).map(t => t.trim()).filter(Boolean) }
    const ok = product ? await post({ action: 'updateProduct', id: product.id, patch }) : await post({ action: 'addProduct', ...patch })
    if (ok) onClose()
  }
  return (
    <Overlay onClose={onClose}>
      <Head title={product ? 'ویرایشِ کالای مرجع' : 'کالای مرجعِ جدید'} onClose={onClose} />
      <label style={lab}>تصویرِ کالا</label>
      <div style={{ maxWidth: 180, marginBottom: 14 }}><ImageUpload value={image} onChange={setImage} height={100} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={lab}>نامِ کالا *</label><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="مثلاً میلگرد آجدار ۱۶ ذوب‌آهن" style={inp} /></div>
        <div><label style={lab}>دسته *</label><select value={f.categoryId} onChange={e => set('categoryId', e.target.value)} style={{ ...inp, cursor: 'pointer' }}><option value="">— انتخاب —</option>{opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}><input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} /> فعال (در دسترسِ مصالح‌فروش‌ها)</label>
      {err && <div style={{ fontSize: 12.5, color: '#f87171', marginBottom: 12 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <button onClick={onClose} style={ghost}>انصراف</button>
        <button onClick={save} disabled={busy} style={gold}>{busy ? '…' : 'ذخیره'}</button>
      </div>
    </Overlay>
  )
}

// ── پنلِ اسکرپ + تنظیمات + تستِ اتصال ──
interface Probe { name: string; url: string; ok: boolean; status: number; note: string }
function ScrapePanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [cfg, setCfg] = useState<any>({ baseUrl: 'https://www.hypersaz.com', strategy: 'auto', maxProducts: 3000 })
  const [job, setJob] = useState<any>(null)
  const [report, setReport] = useState<{ platform: string; probes: Probe[]; recommend: string; smUrl?: string; sitemapType?: string; sitemapLocs?: string[]; subSample?: string[] } | null>(null)
  const [testing, setTesting] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [inspectUrl, setInspectUrl] = useState('')
  const [inspectRes, setInspectRes] = useState<any>(null)
  const [inspecting, setInspecting] = useState(false)

  const poll = useCallback(() => {
    fetch('/api/admin/catalog/scrape').then(r => r.ok ? r.json() : null).then(d => { if (d) { setJob(d.job); if (d.config) setCfg((c: any) => ({ ...c, ...d.config })) } }).catch(() => {})
  }, [])
  useEffect(() => { poll(); const t = setInterval(poll, 2500); return () => clearInterval(t) }, [poll])
  // لیستِ کاتالوگ را زنده به‌روز کن (هر بار که تعدادِ کالاها تغییر کرد) تا محصولاتِ اسکرپ‌شده بلافاصله دیده شوند.
  useEffect(() => { if (job && (job.added || 0) + (job.updated || 0) > 0) onDone() }, [job?.added, job?.updated, job?.running]) // eslint-disable-line

  const act = async (body: any) => { const r = await fetch('/api/admin/catalog/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.ok ? r.json() : null }
  const saveCfg = async () => { await act({ action: 'setConfig', config: cfg }); setSavedMsg('ذخیره شد ✓'); setTimeout(() => setSavedMsg(''), 2000) }
  const test = async () => { setTesting(true); setReport(null); await act({ action: 'setConfig', config: cfg }); const d = await act({ action: 'test' }); if (d?.ok) setReport(d.report); setTesting(false) }
  const start = async () => { await act({ action: 'setConfig', config: cfg }); await act({ action: 'start' }); poll() }
  const stop = async () => { await act({ action: 'stop' }); poll() }

  const running = job?.running
  const pct = job && job.total ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0
  return (
    <Overlay onClose={onClose} max={600}>
      <Head title="⛏ اسکرپِ فروشگاه و تنظیمات" onClose={onClose} />

      <label style={lab}>آدرسِ سایتِ منبع</label>
      <input value={cfg.baseUrl} onChange={e => setCfg({ ...cfg, baseUrl: e.target.value })} dir="ltr" style={{ ...inp, marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={lab}>روشِ اسکرپ</label>
          <select value={cfg.strategy} onChange={e => setCfg({ ...cfg, strategy: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
            <option value="auto">خودکار (تشخیص)</option>
            <option value="wp">WordPress REST</option>
            <option value="sitemap">نقشهٔ سایت + Schema</option>
            <option value="html">HTML (سِلکتور)</option>
          </select>
        </div>
        <div>
          <label style={lab}>سقفِ تعدادِ کالا</label>
          <input value={cfg.maxProducts} onChange={e => setCfg({ ...cfg, maxProducts: Number(e.target.value) || 0 })} style={inp} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={test} disabled={testing} style={{ ...ghost, border: '1px solid var(--gold)', color: 'var(--gold)' }}>{testing ? 'در حال تست…' : '🔍 تستِ اتصال'}</button>
        <button onClick={saveCfg} style={ghost}>ذخیرهٔ تنظیمات</button>
        {savedMsg && <span style={{ fontSize: 12, color: '#5fd98a', alignSelf: 'center' }}>{savedMsg}</span>}
      </div>

      {report && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>پلتفرم: {report.platform} · پیشنهاد: <span style={{ color: 'var(--gold)' }}>{report.recommend}</span></div>
          {report.probes.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <span style={{ color: p.ok ? '#5fd98a' : 'var(--muted)' }}>{p.ok ? '✓' : '✕'} {p.name}</span>
              <span style={{ color: 'var(--faint)' }}>{p.note}</span>
            </div>
          ))}
          {report.recommend !== 'html' && <button onClick={() => setCfg({ ...cfg, strategy: report.recommend })} style={{ ...ghost, marginTop: 8, fontSize: 12 }}>استفاده از روشِ پیشنهادی ({report.recommend})</button>}
          {report.smUrl && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 5 }}>نقشهٔ سایت: <b dir="ltr">{report.smUrl}</b> — نوع: {report.sitemapType}</div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', direction: 'ltr', textAlign: 'left', wordBreak: 'break-all', lineHeight: 1.7, maxHeight: 130, overflowY: 'auto', background: 'var(--bg)', borderRadius: 6, padding: 8 }}>
                {(report.sitemapLocs || []).map((l, i) => <div key={i}>{l}</div>)}
                {(report.subSample || []).length ? <><div style={{ color: 'var(--gold)', marginTop: 6 }}>— نمونهٔ داخلِ اولین زیرنقشه —</div>{(report.subSample || []).map((l, i) => <div key={'s' + i}>{l}</div>)}</> : null}
              </div>
            </div>
          )}
        </div>
      )}

      {job && (job.running || (job.added || 0) + (job.updated || 0) > 0 || job.error) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
            <span>{job.label || 'اسکرپ'}{job.running ? ' …' : ' (پایان)'}{job.strategy ? ` · ${job.strategy}` : ''}</span>
            <span>{fa(job.done)}{job.total ? `/${fa(job.total)}` : ''} · +{fa(job.added || 0)} کالا</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--bg2)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,var(--gold2),var(--gold))', transition: 'width .3s' }} /></div>
          {job.categories ? <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{fa(job.categories)} دسته · {fa(job.added || 0)} افزوده · {fa(job.updated || 0)} به‌روز</div> : null}
          {job.error && <div style={{ fontSize: 12, color: '#f87171', marginTop: 8, lineHeight: 1.7 }}>{job.error}</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {running
          ? <button onClick={stop} style={{ ...gold, flex: 1, background: '#e7674a', color: '#fff' }}>توقف</button>
          : <button onClick={start} style={{ ...gold, flex: 1 }}>شروعِ اسکرپ</button>}
      </div>

      {/* بررسیِ یک صفحهٔ محصول — برای بهبودِ استخراجِ عکس/مشخصات */}
      <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>بررسیِ یک صفحهٔ محصول (برای عیب‌یابیِ استخراج):</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={inspectUrl} onChange={e => setInspectUrl(e.target.value)} placeholder="آدرسِ یک صفحهٔ محصولِ هایپرساز" dir="ltr" style={{ ...inp, flex: 1 }} />
          <button onClick={async () => { setInspecting(true); setInspectRes(null); const d = await act({ action: 'inspect', url: inspectUrl }); setInspectRes(d?.inspect || { error: d?.error }); setInspecting(false) }} disabled={inspecting || !inspectUrl.trim()} style={ghost}>{inspecting ? '…' : 'بررسی'}</button>
        </div>
        {inspectRes && (
          <div style={{ marginTop: 8, background: 'var(--bg)', borderRadius: 8, padding: 10, fontSize: 11, direction: 'ltr', textAlign: 'left', maxHeight: 260, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--muted)', fontFamily: 'monospace' }}>
            {JSON.stringify(inspectRes, null, 2)}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.8 }}>
        ابتدا «تستِ اتصال» را بزنید تا پلتفرمِ سایت مشخص شود؛ سپس روشِ پیشنهادی را انتخاب و «شروعِ اسکرپ» را بزنید. اسکرپ در پس‌زمینه اجرا می‌شود و می‌توانید صفحه را ببندید.
      </div>
    </Overlay>
  )
}
