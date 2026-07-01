'use client'
import { useState, useMemo } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
const mt = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} میلیون` : fa(t)

interface Spec { key: string; value: string }
interface PProduct {
  id: string; name: string; category: string; price: number; unit: string; stock: number; sold: number
  brand?: string; origin?: string; description?: string; images?: string[]; specs?: Spec[]; tags?: string[]
  minOrder?: number; discountPct?: number; deliveryDays?: number; warranty?: string; featured?: boolean
}
interface PShop {
  slug: string; name: string; tagline: string; about: string; logo: string; cover: string; rating: number
  city: string; province: string; address: string; workHours: string; website: string; email: string
  social: { instagram?: string; telegram?: string; whatsapp?: string; eitaa?: string; linkedin?: string }
  specialties: string[]; services: string[]; areas: string[]; establishedYear: string
  hasPhone: boolean; productCount: number; products: PProduct[]
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const finalPrice = (p: PProduct) => Math.round(p.price * (1 - (p.discountPct || 0) / 100))

export default function StorefrontView({ shop }: { shop: PShop }) {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('همه')
  const [sort, setSort] = useState('پیشنهادی')
  const [detail, setDetail] = useState<PProduct | null>(null)

  const categories = useMemo(() => ['همه', ...Array.from(new Set(shop.products.map(p => p.category).filter(Boolean)))], [shop.products])
  const list = useMemo(() => {
    const q = search.trim()
    let r = shop.products.filter(p =>
      (cat === 'همه' || p.category === cat) &&
      (!q || p.name.includes(q) || (p.brand || '').includes(q) || (p.tags || []).some(t => t.includes(q))))
    if (sort === 'ارزان‌ترین') r = [...r].sort((a, b) => finalPrice(a) - finalPrice(b))
    else if (sort === 'گران‌ترین') r = [...r].sort((a, b) => finalPrice(b) - finalPrice(a))
    else if (sort === 'پرفروش‌ترین') r = [...r].sort((a, b) => b.sold - a.sold)
    else r = [...r].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.sold - a.sold)
    return r
  }, [shop.products, search, cat, sort])

  const socials = Object.entries(shop.social || {}).filter(([, v]) => v)

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <Nav />

      {/* ── Hero ── */}
      <div style={{ position: 'relative' }}>
        <div style={{ height: 220, background: shop.cover ? `center/cover no-repeat url(${shop.cover})` : 'linear-gradient(120deg,#1f2937,#0f2340)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,var(--bg) 4%,rgba(0,0,0,0.35) 60%,rgba(0,0,0,0.15))' }} />
        </div>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px' }}>
          <div className="mjf-hero" style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: -60, position: 'relative', flexWrap: 'wrap' }}>
            <div style={{ width: 116, height: 116, borderRadius: 20, background: shop.logo ? `center/cover no-repeat url(${shop.logo})` : 'linear-gradient(135deg,var(--gold2),var(--gold))', border: '3px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: '#16140f', flexShrink: 0, boxShadow: 'var(--shadow)' }}>
              {!shop.logo && (shop.name.trim().charAt(0) || 'ف')}
            </div>
            <div style={{ flex: 1, minWidth: 240, paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{shop.name}</h1>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5fd98a', background: 'rgba(95,217,138,0.12)', padding: '3px 10px', borderRadius: 999 }}>✓ فروشندهٔ ملک‌جت</span>
                {shop.rating > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{fa(shop.rating)} ★</span>}
              </div>
              {shop.tagline && <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>{shop.tagline}</div>}
              <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--faint)' }}>
                {shop.city && <span>📍 {[shop.city, shop.province].filter(Boolean).join('، ')}</span>}
                {shop.establishedYear && <span>🏭 از سالِ {shop.establishedYear}</span>}
                <span>📦 {fa(shop.productCount)} محصول</span>
              </div>
            </div>
            <RevealPhone slug={shop.slug} disabled={!shop.hasPhone} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div className="mjf-2col" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>

          {/* ── Sidebar: about / contact / categories ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {shop.about && (
              <div style={{ ...card, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>دربارهٔ فروشگاه</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 2 }}>{shop.about}</div>
              </div>
            )}
            <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>اطلاعاتِ تماس</div>
              {shop.address && <Row icon="📍" text={shop.address} />}
              {shop.workHours && <Row icon="🕒" text={shop.workHours} />}
              {shop.website && <Row icon="🌐" text={shop.website} href={shop.website} />}
              {shop.email && <Row icon="✉️" text={shop.email} />}
              {socials.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {socials.map(([k, v]) => <a key={k} href={socialHref(k, v as string)} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--gold)', border: '1px solid var(--line2)', borderRadius: 8, padding: '4px 10px', textDecoration: 'none' }}>{socialLabel(k)}</a>)}
                </div>
              )}
              <RevealPhone slug={shop.slug} disabled={!shop.hasPhone} block />
            </div>
            {(shop.specialties.length > 0 || shop.areas.length > 0) && (
              <div style={{ ...card, padding: 16 }}>
                {shop.specialties.length > 0 && <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>تخصص‌ها</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: shop.areas.length ? 14 : 0 }}>
                    {shop.specialties.map(s => <span key={s} style={chip}>{s}</span>)}
                  </div>
                </>}
                {shop.areas.length > 0 && <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>مناطقِ ارسال</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{shop.areas.map(s => <span key={s} style={chip}>{s}</span>)}</div>
                </>}
              </div>
            )}
          </div>

          {/* ── Products ── */}
          <div>
            {/* toolbar */}
            <div className="mjf-tools" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="جستجوی محصول…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180, height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, outline: 'none', fontFamily: FONT }} />
              <select value={sort} onChange={e => setSort(e.target.value)} style={selStyle}>
                <option>پیشنهادی</option><option>ارزان‌ترین</option><option>گران‌ترین</option><option>پرفروش‌ترین</option>
              </select>
            </div>
            {/* category chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <button key={c} onClick={() => setCat(c)} style={{ padding: '7px 14px', borderRadius: 999, border: `1px solid ${cat === c ? 'var(--gold)' : 'var(--line2)'}`, background: cat === c ? 'var(--goldDim)' : 'transparent', color: cat === c ? 'var(--gold)' : 'var(--muted)', fontSize: 12.5, fontWeight: cat === c ? 700 : 400, cursor: 'pointer', fontFamily: FONT }}>{c}</button>
              ))}
            </div>

            {list.length === 0 ? (
              <div style={{ ...card, padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>محصولی برای نمایش نیست.</div>
            ) : (
              <div className="mjf-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 16 }}>
                {list.map(p => {
                  const disc = (p.discountPct || 0) > 0
                  const low = p.stock <= 0
                  return (
                    <button key={p.id} onClick={() => setDetail(p)} style={{ ...card, overflow: 'hidden', padding: 0, textAlign: 'right', cursor: 'pointer', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
                      <div style={{ height: 150, background: p.images?.[0] ? `center/cover no-repeat url(${p.images[0]})` : 'linear-gradient(135deg,#2b2620,#171410)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {!p.images?.[0] && <span style={{ fontSize: 30, opacity: 0.4 }}>🧱</span>}
                        {p.featured && <span style={{ position: 'absolute', top: 8, insetInlineStart: 8, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>★ ویژه</span>}
                        {disc && <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, background: '#e7674a', color: '#fff', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>٪{fa(p.discountPct!)}</span>}
                        {low && <span style={{ position: 'absolute', bottom: 8, insetInlineEnd: 8, background: 'rgba(0,0,0,0.7)', color: '#f87171', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>ناموجود</span>}
                      </div>
                      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.6, minHeight: 42 }}>{p.name}</div>
                        {p.brand && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p.brand}</div>}
                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>{mt(finalPrice(p))}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>تومان/{p.unit}</span>
                          {disc && <span style={{ fontSize: 11, color: 'var(--faint)', textDecoration: 'line-through' }}>{mt(p.price)}</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {detail && <ProductModal p={detail} shop={shop} onClose={() => setDetail(null)} />}
      <Footer />

      <style>{`
        @media(max-width:820px){ .mjf-2col{grid-template-columns:1fr!important} }
      `}</style>
    </div>
  )
}

function Row({ icon, text, href }: { icon: string; text: string; href?: string }) {
  const inner = <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>{text}</span>
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      {href ? <a href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: 12.5 }}>{text}</a> : inner}
    </div>
  )
}

const chip: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '4px 10px' }
const selStyle: React.CSSProperties = { height: 44, padding: '0 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, cursor: 'pointer', outline: 'none', fontFamily: FONT }
function socialLabel(k: string) { return ({ instagram: 'اینستاگرام', telegram: 'تلگرام', whatsapp: 'واتساپ', eitaa: 'ایتا', linkedin: 'لینکدین' } as any)[k] || k }
function socialHref(k: string, v: string) {
  if (v.startsWith('http')) return v
  if (k === 'instagram') return `https://instagram.com/${v.replace('@', '')}`
  if (k === 'telegram') return `https://t.me/${v.replace('@', '')}`
  if (k === 'whatsapp') return `https://wa.me/${v.replace(/\D/g, '')}`
  return v
}

// ── نمایشِ شمارهٔ فروشنده فقط پس از ورود ──
function RevealPhone({ slug, disabled, block }: { slug: string; disabled?: boolean; block?: boolean }) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const reveal = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/materials/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reveal', slug }) })
      const d = await r.json().catch(() => ({}))
      if (r.status === 401 || d.login) { window.location.href = `/auth?next=${encodeURIComponent(location.pathname)}`; return }
      if (d.ok && d.phone) setPhone(d.phone)
    } finally { setBusy(false) }
  }
  const style: React.CSSProperties = { padding: '11px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONT, width: block ? '100%' : 'auto', opacity: disabled ? 0.5 : 1 }
  if (phone) return <a href={`tel:${phone}`} style={{ ...style, textDecoration: 'none', textAlign: 'center', display: 'block' }} dir="ltr">{phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3')}</a>
  return <button onClick={reveal} disabled={busy || disabled} style={style}>{disabled ? 'شماره ثبت نشده' : busy ? '…' : '📞 نمایشِ شماره تماس'}</button>
}

// ── مودالِ جزئیاتِ محصول ──
function ProductModal({ p, shop, onClose }: { p: PProduct; shop: PShop; onClose: () => void }) {
  const imgs = p.images && p.images.length ? p.images : []
  const [active, setActive] = useState(0)
  const disc = (p.discountPct || 0) > 0
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} className="mjf-modal" style={{ ...card, maxWidth: 860, width: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* gallery */}
        <div style={{ padding: 18, borderInlineEnd: '1px solid var(--line)' }}>
          <div style={{ height: 260, borderRadius: 14, background: imgs[active] ? `center/cover no-repeat url(${imgs[active]})` : 'linear-gradient(135deg,#2b2620,#171410)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!imgs[active] && <span style={{ fontSize: 46, opacity: 0.4 }}>🧱</span>}
          </div>
          {imgs.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {imgs.map((im, i) => <button key={i} onClick={() => setActive(i)} style={{ width: 54, height: 54, borderRadius: 8, background: `center/cover no-repeat url(${im})`, border: `2px solid ${i === active ? 'var(--gold)' : 'transparent'}`, cursor: 'pointer' }} />)}
            </div>
          )}
        </div>
        {/* info */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>{p.category}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.5 }}>{p.name}</h2>
          {(p.brand || p.origin) && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{[p.brand, p.origin].filter(Boolean).join(' · ')}</div>}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>{mt(finalPrice(p))}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>تومان / {p.unit}</span>
            {disc && <><span style={{ fontSize: 13, color: 'var(--faint)', textDecoration: 'line-through' }}>{mt(p.price)}</span><span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#e7674a', borderRadius: 7, padding: '2px 8px' }}>٪{fa(p.discountPct!)} تخفیف</span></>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11.5 }}>
            <Badge label={p.stock > 0 ? `موجود (${fa(p.stock)} ${p.unit})` : 'ناموجود'} color={p.stock > 0 ? '#5fd98a' : '#f87171'} />
            {p.minOrder ? <Badge label={`حداقل سفارش: ${fa(p.minOrder)} ${p.unit}`} /> : null}
            {p.deliveryDays ? <Badge label={`تحویل: ${fa(p.deliveryDays)} روز`} /> : null}
            {p.warranty ? <Badge label={`گارانتی: ${p.warranty}`} /> : null}
          </div>
          {p.description && <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 2 }}>{p.description}</div>}
          {p.specs && p.specs.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>مشخصاتِ فنی</div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {p.specs.map((sp, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', fontSize: 12.5, borderBottom: i < p.specs!.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ padding: '8px 12px', background: 'var(--bg2)', color: 'var(--muted)' }}>{sp.key}</div>
                    <div style={{ padding: '8px 12px', fontWeight: 600 }}>{sp.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {p.tags && p.tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{p.tags.map(t => <span key={t} style={chip}>{t}</span>)}</div>}
          <InquiryBox slug={shop.slug} product={p.name} unit={p.unit} />
          <RevealPhone slug={shop.slug} disabled={!shop.hasPhone} block />
        </div>
      </div>
    </div>
  )
}

function Badge({ label, color }: { label: string; color?: string }) {
  return <span style={{ color: color || 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '4px 10px', fontWeight: 600 }}>{label}</span>
}

// ── ارسالِ استعلامِ خرید ──
function InquiryBox({ slug, product, unit }: { slug: string; product: string; unit: string }) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'' | 'busy' | 'done'>('')
  const send = async () => {
    setState('busy')
    try {
      const r = await fetch('/api/materials/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'inquiry', slug, product, qty, note }) })
      const d = await r.json().catch(() => ({}))
      if (r.status === 401 || d.login) { window.location.href = `/auth?next=${encodeURIComponent(location.pathname)}`; return }
      if (d.ok) setState('done'); else setState('')
    } catch { setState('') }
  }
  if (state === 'done') return <div style={{ fontSize: 13, color: '#5fd98a', background: 'rgba(95,217,138,0.1)', borderRadius: 10, padding: '10px 12px' }}>✓ استعلام برای فروشنده ارسال شد.</div>
  if (!open) return <button onClick={() => setOpen(true)} style={{ padding: '11px 22px', borderRadius: 12, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: FONT }}>✉️ استعلامِ قیمت / موجودی</button>
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>استعلام دربارهٔ «{product}»</div>
      <input placeholder={`مقدارِ موردنیاز (${unit})`} value={qty} onChange={e => setQty(e.target.value)} style={inp} />
      <textarea placeholder="توضیحِ اختیاری…" value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={send} disabled={state === 'busy'} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--gold)', color: '#16140f', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT, opacity: state === 'busy' ? 0.6 : 1 }}>{state === 'busy' ? '…' : 'ارسال استعلام'}</button>
        <button onClick={() => setOpen(false)} style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>انصراف</button>
      </div>
    </div>
  )
}
