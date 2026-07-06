'use client'

import { useMemo, useState } from 'react'
import { listingHref } from '@/app/lib/listing-url'

// آگهیِ غنی‌شده برای صفحهٔ جستجو/فیلترِ سایت‌ساز (مثلِ صفحهٔ اصلیِ آگهی‌ها).
export interface SiteListing {
  id: string
  title?: string
  location?: string
  price?: string
  image?: string
  category?: string
  deal: 'sale' | 'rent'
  ptype?: string
  city?: string
  neighborhood?: string
  rooms: number
  area: number
  priceNum: number
}

const CARD_SHADOW = '0 10px 34px -22px rgba(20,16,10,.55), 0 2px 8px -4px rgba(20,16,10,.10)'
const GRADS = ['#2d2215,#1e1a12', '#1e2215,#141a10', '#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d1515,#1e0e0e']
const uniq = (a: (string | undefined)[]) => Array.from(new Set(a.map(s => (s || '').trim()).filter(Boolean)))

export default function SiteListings({ items, primary, siteSlug = '' }: { items: SiteListing[]; primary: string; siteSlug?: string }) {
  const [q, setQ] = useState('')
  const [deal, setDeal] = useState<'all' | 'sale' | 'rent'>('all')
  const [ptype, setPtype] = useState('all')
  const [city, setCity] = useState('all')
  const [nb, setNb] = useState('all')
  const [rooms, setRooms] = useState('all')
  const [sort, setSort] = useState<'new' | 'priceAsc' | 'priceDesc' | 'areaDesc'>('new')
  const [showFilters, setShowFilters] = useState(false)

  const ptypes = uniq(items.map(i => i.ptype))
  const cities = uniq(items.map(i => i.city))
  const nbs = uniq(items.filter(i => city === 'all' || i.city === city).map(i => i.neighborhood))

  const nq = q.trim().toLocaleLowerCase()
  const shown = useMemo(() => {
    let r = items.filter(i => {
      if (deal !== 'all' && i.deal !== deal) return false
      if (ptype !== 'all' && (i.ptype || '') !== ptype) return false
      if (city !== 'all' && (i.city || '') !== city) return false
      if (nb !== 'all' && (i.neighborhood || '') !== nb) return false
      if (rooms !== 'all' && i.rooms < Number(rooms)) return false
      if (nq && !`${i.title} ${i.location} ${i.ptype} ${i.category}`.toLocaleLowerCase().includes(nq)) return false
      return true
    })
    r = r.slice().sort((a, b) =>
      sort === 'priceAsc' ? a.priceNum - b.priceNum
        : sort === 'priceDesc' ? b.priceNum - a.priceNum
          : sort === 'areaDesc' ? b.area - a.area
            : 0)
    return r
  }, [items, deal, ptype, city, nb, rooms, nq, sort])

  const reset = () => { setQ(''); setDeal('all'); setPtype('all'); setCity('all'); setNb('all'); setRooms('all'); setSort('new') }
  const activeCount = [deal !== 'all', ptype !== 'all', city !== 'all', nb !== 'all', rooms !== 'all'].filter(Boolean).length

  const sel: React.CSSProperties = {
    padding: '11px 13px', borderRadius: 12, background: 'var(--mjs-bg)', border: '1px solid #e6ddcd',
    color: 'var(--mjs-heading)', fontSize: 14, outline: 'none', fontFamily: 'inherit', minHeight: 44, cursor: 'pointer',
  }

  return (
    <div>
      <style>{`
        .mjsl-card{transition:transform .22s ease, box-shadow .22s ease}
        .mjsl-card:hover{transform:translateY(-5px);box-shadow:0 22px 50px -24px rgba(20,16,10,.55),0 6px 16px -8px rgba(20,16,10,.18)}
        .mjsl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px}
        .mjsl-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
        .mjsl-toggle{display:none}
        @media(max-width:680px){
          .mjsl-grid{grid-template-columns:1fr}
          .mjsl-toggle{display:flex}
          .mjsl-filters.closed{display:none}
        }
      `}</style>

      {/* نوارِ جستجو */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="جستجو در عنوان، موقعیت، نوع ملک…"
          style={{ ...sel, flex: '1 1 240px', cursor: 'text' }}
        />
        <button onClick={() => setShowFilters(s => !s)} className="mjsl-toggle" style={{ ...sel, gap: 8, alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: primary, borderColor: primary }}>
          فیلترها {activeCount > 0 ? `(${activeCount.toLocaleString('fa-IR')})` : ''}
        </button>
      </div>

      {/* فیلترها */}
      <div className={`mjsl-filters${showFilters ? '' : ' closed'}`} style={{ marginBottom: 18 }}>
        <select value={deal} onChange={e => setDeal(e.target.value as any)} style={sel}>
          <option value="all">همهٔ معاملات</option>
          <option value="sale">فروش</option>
          <option value="rent">اجاره/رهن</option>
        </select>
        <select value={ptype} onChange={e => setPtype(e.target.value)} style={sel}>
          <option value="all">همهٔ انواع ملک</option>
          {ptypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={city} onChange={e => { setCity(e.target.value); setNb('all') }} style={sel}>
          <option value="all">همهٔ شهرها</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={nb} onChange={e => setNb(e.target.value)} style={sel}>
          <option value="all">همهٔ محله‌ها</option>
          {nbs.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={rooms} onChange={e => setRooms(e.target.value)} style={sel}>
          <option value="all">تعداد خواب</option>
          <option value="1">۱+ خواب</option>
          <option value="2">۲+ خواب</option>
          <option value="3">۳+ خواب</option>
          <option value="4">۴+ خواب</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as any)} style={sel}>
          <option value="new">جدیدترین</option>
          <option value="priceDesc">گران‌ترین</option>
          <option value="priceAsc">ارزان‌ترین</option>
          <option value="areaDesc">بزرگ‌ترین متراژ</option>
        </select>
      </div>

      {/* شمارش + ریست */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, color: 'var(--mjs-text)', fontWeight: 600 }}>{shown.length.toLocaleString('fa-IR')} آگهی</div>
        {(activeCount > 0 || nq) && <button onClick={reset} style={{ background: 'transparent', border: 'none', color: primary, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>پاک‌کردنِ فیلترها ✕</button>}
      </div>

      {/* گرید */}
      {shown.length === 0 ? (
        <div style={{ background: 'var(--mjs-surface)', border: '1px dashed #ddd4c5', borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>
          آگهی‌ای با این فیلترها پیدا نشد.
        </div>
      ) : (
        <div className="mjsl-grid">
          {shown.map((it, i) => (
            <a key={it.id} href={siteSlug ? `/${siteSlug}${listingHref(it.id, it.title, it.location)}` : `/property/${it.id}`} className="mjsl-card" style={{
              background: 'var(--mjs-bg)', borderRadius: 18, overflow: 'hidden', border: '1px solid #efe9df',
              textDecoration: 'none', display: 'block', boxShadow: CARD_SHADOW,
            }}>
              <div style={{ position: 'relative' }}>
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ height: 200, background: `linear-gradient(135deg,${GRADS[i % GRADS.length]})` }} />
                )}
                <span style={{ position: 'absolute', top: 12, insetInlineStart: 12, fontSize: 11.5, fontWeight: 800, color: '#fff', background: it.deal === 'rent' ? '#2dd4bf' : primary, borderRadius: 999, padding: '4px 12px' }}>{it.deal === 'rent' ? 'اجاره' : 'فروش'}</span>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--mjs-heading)', marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                <div style={{ fontSize: 13, color: 'var(--mjs-text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ opacity: .7 }}>📍</span>{it.location || 'موقعیت نامشخص'}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--mjs-text)', marginBottom: 14, flexWrap: 'wrap' }}>
                  {it.area > 0 && <span>◰ {it.area.toLocaleString('fa-IR')} متر</span>}
                  {it.rooms > 0 && <span>⌂ {it.rooms.toLocaleString('fa-IR')} خواب</span>}
                  {it.ptype && <span>● {it.ptype}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f2ede4', paddingTop: 12 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: primary }}>{it.price || 'قیمت توافقی'}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mjs-text)' }}>مشاهده ←</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
