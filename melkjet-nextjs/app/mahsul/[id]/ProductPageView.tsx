'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} میلیون` : fa(t)

interface Spec { key: string; value: string }
interface PricePoint { date: string; price: number }
interface Product { id: string; name: string; brand?: string; unit?: string; image?: string; description?: string; specs?: Spec[]; tags?: string[]; priceHistory?: PricePoint[]; externalUrl?: string }
interface Seller { slug: string; name: string; logo: string; city: string; rating: number; price: number; discountPct: number; stock: number; unit: string }
interface Rel { id: string; name: string; image: string; brand: string }

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }

export default function ProductPageView({ product, breadcrumb, sellers, related }: { product: Product; breadcrumb: { id: string; name: string }[]; sellers: Seller[]; related: Rel[] }) {
  const ph = (product.priceHistory || []).filter(p => p.price > 0)
  const best = sellers.length ? sellers[0] : null
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <Nav />
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 20px 60px' }}>
        {/* breadcrumb */}
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/forushgaha" style={{ color: 'var(--muted)', textDecoration: 'none' }}>بازار مصالح</Link>
          {breadcrumb.map(b => <span key={b.id} style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--faint)' }}>›</span><span>{b.name}</span></span>)}
        </div>

        {/* hero */}
        <div className="mjp-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 24, alignItems: 'start' }}>
          <div style={{ ...card, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
            {product.image
              ? <img src={product.image} alt={product.name} style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 12 }} />
              : <div style={{ fontSize: 64, opacity: 0.3 }}>🧱</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {product.brand && <span style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700 }}>{product.brand}</span>}
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1.5 }}>{product.name}</h1>
            {product.tags && product.tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{product.tags.slice(0, 6).map(t => <span key={t} style={chip}>{t}</span>)}</div>}
            {/* best price box */}
            <div style={{ ...card, padding: 16, background: 'linear-gradient(120deg,var(--goldDim),transparent)' }}>
              {best ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>کمترین قیمت بین {fa(sellers.length)} فروشنده</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)' }}>{money(best.price)}</span>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>تومان / {best.unit || product.unit}</span>
                  </div>
                  <a href="#sellers" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 16px' }}>مقایسهٔ {fa(sellers.length)} فروشنده ↓</a>
                </>
              ) : (
                <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.9 }}>
                  هنوز فروشنده‌ای این کالا را عرضه نکرده است.
                  <Link href="/forushgaha" style={{ display: 'block', marginTop: 8, color: 'var(--gold)', textDecoration: 'none' }}>مشاهدهٔ فروشگاه‌های مصالح ↗</Link>
                </div>
              )}
            </div>
            {/* quick specs */}
            {product.specs && product.specs.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {product.specs.slice(0, 6).map((s, i) => (
                  <div key={i} style={{ fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px' }}>
                    <span style={{ color: 'var(--muted)' }}>{s.key}: </span><span style={{ fontWeight: 600 }}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* price history chart */}
        {ph.length >= 2 && (
          <section style={{ ...card, padding: 20, marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>📈 روندِ تاریخیِ قیمت</div>
              <PriceTrendBadge points={ph} />
            </div>
            <PriceChart points={ph} />
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>قیمتِ مرجع (تومان) بر اساسِ دادهٔ تأمین‌کننده. برای قیمتِ خرید به فروشندگانِ زیر مراجعه کنید.</div>
          </section>
        )}

        {/* full specs */}
        {product.specs && product.specs.length > 0 && (
          <section style={{ ...card, padding: 20, marginTop: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>مشخصاتِ فنی</div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              {product.specs.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', fontSize: 13, borderBottom: i < product.specs!.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ padding: '11px 14px', background: 'var(--bg2)', color: 'var(--muted)' }}>{s.key}</div>
                  <div style={{ padding: '11px 14px', fontWeight: 600 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* description */}
        {product.description && (
          <section style={{ ...card, padding: 20, marginTop: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>توضیحات</div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 2.1, margin: 0 }}>{product.description}</p>
          </section>
        )}

        {/* sellers */}
        <section id="sellers" style={{ marginTop: 24, scrollMarginTop: 80 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>فروشندگانِ این کالا {sellers.length ? `(${fa(sellers.length)})` : ''}</div>
          {sellers.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              هنوز فروشنده‌ای این کالا را با قیمت عرضه نکرده است.
              <Link href="/forushgaha" style={{ display: 'block', marginTop: 10, color: 'var(--gold)', textDecoration: 'none' }}>مرورِ فروشگاه‌های مصالح ↗</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sellers.map((s, i) => (
                <div key={s.slug + i} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 11, flexShrink: 0, background: s.logo ? `center/cover no-repeat url(${s.logo})` : 'linear-gradient(135deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#16140f' }}>{!s.logo && (s.name.charAt(0) || 'ف')}</div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name}{i === 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#5fd98a', background: 'rgba(95,217,138,0.12)', borderRadius: 6, padding: '2px 8px', marginInlineStart: 8 }}>ارزان‌ترین</span>}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{s.city ? `${s.city} · ` : ''}{s.stock > 0 ? `موجود (${fa(s.stock)} ${s.unit})` : 'ناموجود'}{s.rating > 0 ? ` · ${fa(s.rating)}★` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)' }}>{money(s.price)}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>تومان/{s.unit}</div>
                    </div>
                    <Link href={`/forushgah/${s.slug}`} style={{ fontSize: 12.5, color: '#16140f', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', textDecoration: 'none', borderRadius: 9, padding: '9px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>مشاهدهٔ فروشگاه</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* related */}
        {related.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>محصولاتِ مشابه</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14 }}>
              {related.map(r => (
                <Link key={r.id} href={`/mahsul/${r.id}`} style={{ ...card, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 120, background: r.image ? `center/contain no-repeat url(${r.image}) var(--bg2)` : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{!r.image && '🧱'}</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.6, minHeight: 40 }}>{r.name}</div>
                    {r.brand && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{r.brand}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <Footer />
      <style>{`@media(max-width:780px){.mjp-hero{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}

const chip: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '4px 10px' }

function PriceTrendBadge({ points }: { points: PricePoint[] }) {
  const first = points[0].price, last = points[points.length - 1].price
  const pct = first ? Math.round(((last - first) / first) * 100) : 0
  const up = pct >= 0
  return <span style={{ fontSize: 13, fontWeight: 700, color: up ? '#5fd98a' : '#f87171' }}>{up ? '↗' : '↘'} {fa(Math.abs(pct))}٪ از {points[0].date}</span>
}

// نمودارِ خطیِ SVG با گرادیانِ زیرِ خط + نقاط + برجسته‌سازیِ آخرین قیمت.
function PriceChart({ points }: { points: PricePoint[] }) {
  const [sel, setSel] = useState<number | null>(null)
  const W = 620, H = 240, padX = 12, padY = 22
  const vals = points.map(p => p.price)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const x = (i: number) => padX + (i / (points.length - 1)) * (W - padX * 2)
  const y = (v: number) => padY + (1 - (v - min) / span) * (H - padY * 2)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - padY} L${x(0).toFixed(1)},${H - padY} Z`
  const active = sel != null ? sel : points.length - 1
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6, minHeight: 18 }}>
        <b style={{ color: 'var(--gold)' }}>{points[active].date}</b>: {money(Math.round(points[active].price / 10))} تومان
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 200, display: 'block' }}>
        <defs>
          <linearGradient id="pcArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pcArea)" />
        <path d={line} fill="none" stroke="var(--gold)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <rect x={x(i) - (W / points.length) / 2} y={0} width={W / points.length} height={H} fill="transparent" onMouseEnter={() => setSel(i)} onMouseLeave={() => setSel(null)} style={{ cursor: 'pointer' }} />
            <circle cx={x(i)} cy={y(p.price)} r={i === active ? 5 : 2.6} fill={i === active ? 'var(--gold2)' : 'var(--gold)'} stroke={i === active ? '#16140f' : 'none'} strokeWidth={1.5} />
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>
        <span>{points[0].date}</span>
        <span>کمترین {money(Math.round(min / 10))} · بیشترین {money(Math.round(max / 10))} تومان</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  )
}
