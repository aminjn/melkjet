'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import StaticMap from '../components/StaticMap'
import NeshanMap from '../components/NeshanMap'

interface MapPoint { id: string; lat: number; lng: number; title?: string; price?: string }
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

interface Item {
  hashId: string; address?: string; builderId: string; builderName: string
  regionId?: number; cityId?: number; phaseId?: number; floors?: number; units?: number
  residentialArea?: number; groundArea?: number; latitude?: number; longitude?: number
  photo?: { imageUrl?: string; imageThumbnailUrl?: string }
}
interface Facets {
  regions: { value: string; count: number }[]
  phases: { value: number; label: string; count: number }[]
  area: { min: number; max: number }
  total: number
}

const regionLabel = (p: Item) => (p.cityId === 1 && p.regionId && p.regionId > 100 && p.regionId < 123) ? `تهران، منطقه ${p.regionId - 100}` : (p.regionId ? `منطقه ${p.regionId}` : '')

export default function Sazandeha() {
  const [facets, setFacets] = useState<Facets | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [points, setPoints] = useState<MapPoint[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // فیلترها
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [phase, setPhase] = useState('')
  const [floorsMin, setFloorsMin] = useState('')
  const [unitsMin, setUnitsMin] = useState('')
  const [areaMin, setAreaMin] = useState('')
  const [areaMax, setAreaMax] = useState('')
  const [withPhoto, setWithPhoto] = useState(false)
  const [sort, setSort] = useState('')

  const debTimer = useRef<any>(null)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set('search', search.trim())
    if (region) p.set('region', region)
    if (phase) p.set('phase', phase)
    if (floorsMin) p.set('floorsMin', floorsMin)
    if (unitsMin) p.set('unitsMin', unitsMin)
    if (areaMin) p.set('areaMin', areaMin)
    if (areaMax) p.set('areaMax', areaMax)
    if (withPhoto) p.set('withPhoto', '1')
    if (sort) p.set('sort', sort)
    return p.toString()
  }, [search, region, phase, floorsMin, unitsMin, areaMin, areaMax, withPhoto, sort])

  // بارگذاریِ صفحهٔ ۱ هنگامِ تغییرِ فیلتر (با debounce برای جستجو)
  useEffect(() => {
    if (debTimer.current) clearTimeout(debTimer.current)
    debTimer.current = setTimeout(() => load(1, false), 280)
    return () => debTimer.current && clearTimeout(debTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs])

  async function load(pg: number, append: boolean) {
    setLoading(true)
    try {
      const r = await fetch(`/api/public/projects?${qs}&page=${pg}&pageSize=24${facets ? '' : '&facets=1'}`)
      const d = await r.json()
      if (d.ok) {
        setItems(prev => append ? [...prev, ...d.items] : d.items)
        setPoints(d.points || [])
        setTotal(d.total || 0)
        setPage(pg)
        if (d.facets) setFacets(d.facets)
      }
    } catch {}
    setLoading(false)
  }

  function reset() {
    setSearch(''); setRegion(''); setPhase(''); setFloorsMin(''); setUnitsMin(''); setAreaMin(''); setAreaMax(''); setWithPhoto(false); setSort('')
  }
  const activeCount = [search.trim(), region, phase, floorsMin, unitsMin, areaMin, areaMax, withPhoto ? '1' : '', sort].filter(Boolean).length

  const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }
  const labelStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6, display: 'block' }

  const FilterPanel = (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <label style={labelStyle}>منطقه</label>
        <select value={region} onChange={e => setRegion(e.target.value)} style={inputStyle}>
          <option value="">همهٔ مناطق</option>
          {facets?.regions.map(r => <option key={r.value} value={r.value}>{r.value} ({fa(r.count)})</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>مرحلهٔ ساخت</label>
        <select value={phase} onChange={e => setPhase(e.target.value)} style={inputStyle}>
          <option value="">همهٔ مراحل</option>
          {facets?.phases.map(p => <option key={p.value} value={p.value}>{p.label} ({fa(p.count)})</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>زیربنا (متر مربع)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={areaMin} onChange={e => setAreaMin(e.target.value.replace(/\D/g, ''))} placeholder="از" inputMode="numeric" style={inputStyle} />
          <input value={areaMax} onChange={e => setAreaMax(e.target.value.replace(/\D/g, ''))} placeholder="تا" inputMode="numeric" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>حداقل طبقات</label>
          <input value={floorsMin} onChange={e => setFloorsMin(e.target.value.replace(/\D/g, ''))} placeholder="مثلاً ۵" inputMode="numeric" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>حداقل واحد</label>
          <input value={unitsMin} onChange={e => setUnitsMin(e.target.value.replace(/\D/g, ''))} placeholder="مثلاً ۱۰" inputMode="numeric" style={inputStyle} />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
        <input type="checkbox" checked={withPhoto} onChange={e => setWithPhoto(e.target.checked)} />
        فقط دارای عکس
      </label>
      {activeCount > 0 && <button onClick={reset} style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 10, padding: '9px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>پاک‌کردنِ فیلترها ({fa(activeCount)})</button>}
    </div>
  )

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '22px 16px 60px' }}>
        {/* سرتیتر */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>پروژه‌های ساختمانی و سازنده‌ها</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
            {facets ? `${fa(facets.total)} پروژه از سازنده‌های واقعی` : 'در حال بارگذاری…'}
            {activeCount > 0 && ` · ${fa(total)} نتیجه با فیلترِ فعلی`}
          </div>
        </div>

        {/* نوار جستجو + ابزار */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی آدرس یا نامِ سازنده…" style={{ ...inputStyle, flex: 1, minWidth: 200, padding: '11px 14px', fontSize: 14 }} />
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="">مرتب‌سازی: پیش‌فرض</option>
            <option value="area">بزرگ‌ترین زیربنا</option>
            <option value="units">بیشترین واحد</option>
            <option value="recent">به‌روزترین</option>
          </select>
          <button onClick={() => setShowMap(m => !m)} style={{ background: showMap ? 'var(--gold)' : 'var(--bg2)', color: showMap ? '#1a1408' : 'var(--text)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🗺 نقشه</button>
          <button onClick={() => setShowFilters(f => !f)} style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', position: 'relative' }} className="ps-filtbtn">
            ⚙ فیلترها{activeCount > 0 ? ` (${fa(activeCount)})` : ''}
          </button>
        </div>

        {/* نقشهٔ تعاملی (زوم/جابه‌جایی) با پینِ نتایج — اگر SDK بارگذاری نشد، نقشهٔ استاتیک */}
        {showMap && (
          <div style={{ marginBottom: 18 }}>
            <NeshanMap points={points} height={460} onSelect={(id) => { window.location.href = `/proje/${id}` }}
              fallback={<StaticMap points={points.map(p => ({ id: p.id, lat: p.lat, lng: p.lng }))} aspect={2.4} onSelect={(id) => { window.location.href = `/proje/${id}` }} />} />
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6 }}>{fa(points.length)} پروژه روی نقشه · روی هر پین بزنید تا صفحهٔ پروژه باز شود</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 20 }}>
          {/* چیدمانِ دسکتاپ: ستونِ فیلتر کنار */}
          <div className="ps-layout" style={{ display: 'grid', gap: 20 }}>
            {/* لیست */}
            <section>
              {items.length === 0 && !loading ? (
                <div style={{ color: 'var(--faint)', padding: '40px 0', textAlign: 'center' }}>پروژه‌ای با این فیلترها پیدا نشد.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                  {items.map(p => (
                    <Link key={p.hashId} href={`/proje/${p.hashId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <article style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 14, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {p.photo?.imageThumbnailUrl || p.photo?.imageUrl ? (
                          <img src={p.photo.imageThumbnailUrl || p.photo.imageUrl} alt="" loading="lazy" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                        ) : <div style={{ width: '100%', height: 150, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: 'var(--faint)' }}>🏗</div>}
                        <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.7, minHeight: 42, overflow: 'hidden' }}>{p.address || '—'}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                            {!!p.floors && <span style={chip}>{fa(p.floors)} طبقه</span>}
                            {!!p.units && <span style={chip}>{fa(p.units)} واحد</span>}
                            {!!p.residentialArea && <span style={chip}>{fa(p.residentialArea)} م²</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 'auto' }}>📍 {regionLabel(p) || '—'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--gold)', marginTop: 4, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🏗 {p.builderName || 'سازنده'}</div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}

              {items.length < total && (
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <button onClick={() => load(page + 1, true)} disabled={loading} style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {loading ? 'در حال بارگذاری…' : `نمایشِ بیشتر (${fa(total - items.length)} پروژهٔ دیگر)`}
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* پنلِ فیلترِ کشویی (موبایل و دسکتاپ) */}
      {showFilters && (
        <div onClick={() => setShowFilters(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: 320, maxWidth: '85vw', background: 'var(--surface)', borderInlineEnd: '1px solid var(--line2)', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>فیلترها</h3>
              <button onClick={() => setShowFilters(false)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            {FilterPanel}
            <button onClick={() => setShowFilters(false)} style={{ width: '100%', marginTop: 18, background: 'var(--gold)', color: '#1a1408', border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              نمایشِ {fa(total)} نتیجه
            </button>
          </div>
        </div>
      )}
      <Footer />
    </>
  )
}

const chip: React.CSSProperties = { fontSize: 10.5, background: 'var(--bg2)', color: 'var(--muted)', borderRadius: 6, padding: '3px 7px', fontWeight: 600 }
