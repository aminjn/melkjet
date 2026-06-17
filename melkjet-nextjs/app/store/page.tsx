'use client'
import { useState, useEffect } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { fetchContent } from '@/app/lib/content-display'

type StockStatus = 'موجود' | 'محدود' | 'سفارشی'

type Product = {
  id: string
  name: string
  brand: string
  category: string
  price: number
  priceLabel: string
  unit: string
  stock: StockStatus
  hot?: boolean
  gradientFrom: string
  gradientTo: string
  description: string
  specs: string[]
  image?: string
  url?: string
}

type CartItem = { product: Product; qty: number }

type Review = {
  name: string
  company: string
  rating: number
  text: string
  date: string
}

const PRODUCT_PALETTE: [string, string][] = [
  ['#374151', '#1f2937'], ['#9ca3af', '#6b7280'], ['#d97706', '#92400e'],
  ['#1e3a5f', '#0f2340'], ['#7c3aed', '#4c1d95'], ['#0f766e', '#134e4a'],
]
function seedNumP(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}
function toProduct(it: { id: string; title: string; price?: string; sourceName: string; category?: string; excerpt?: string; tags?: string[]; image?: string; url?: string }): Product {
  const priceNum = parseFloat((it.price || '').replace(/[^\d.]/g, '')) || 0
  const [from, to] = PRODUCT_PALETTE[seedNumP(it.id) % PRODUCT_PALETTE.length]
  return {
    id: it.id,
    name: it.title,
    brand: it.sourceName || 'نامشخص',
    category: it.category || 'سایر',
    price: priceNum,
    priceLabel: it.price || '—',
    unit: '',
    stock: 'موجود',
    hot: false,
    gradientFrom: from,
    gradientTo: to,
    description: it.excerpt || '',
    specs: it.tags || [],
    image: it.image,
    url: it.url,
  }
}

const BRANDS = [
  { name: 'فولاد خوزستان', abbr: 'F.KH', color: '#374151' },
  { name: 'سیمان تهران', abbr: 'S.T', color: '#6b7280' },
  { name: 'سرامیک ایران', abbr: 'S.IR', color: '#d1d5db' },
  { name: 'کاشی یزد', abbr: 'K.Y', color: '#d97706' },
  { name: 'ذوب‌آهن اصفهان', abbr: 'Z.A', color: '#1e3a5f' },
]

const CATEGORY_CHIPS = ['همه', 'آهن و میلگرد', 'سیمان و گچ', 'کاشی‌وسرامیک', 'درب‌وپنجره', 'تأسیسات', 'دکوراسیون', 'ابزار']

const SIDEBAR_CATS = [
  { name: 'مصالح ساختمانی', children: ['آهن و میلگرد', 'سیمان و گچ', 'بتون'] },
  { name: 'کاشی‌وسرامیک', children: ['پرسلان', 'سرامیک کف', 'دیوار'] },
  { name: 'درب‌وپنجره', children: ['درب ضدسرقت', 'پنجره UPVC', 'پنجره آلومینیوم'] },
  { name: 'تأسیسات', children: ['شیرآلات', 'برق و کلید', 'لوله‌کشی'] },
  { name: 'دکوراسیون', children: ['کابینت', 'رنگ', 'کفپوش'] },
  { name: 'ابزار', children: ['ابزار برقی', 'ابزار دستی'] },
]

const BRAND_FILTERS = ['فولاد خوزستان', 'سیمان تهران', 'سرامیک ایران', 'کاشی یزد', 'ذوب‌آهن اصفهان', 'ایران رنگ', 'ترموپنجره']

const REVIEWS: Review[] = [
  { name: 'مهندس رضایی', company: 'شرکت عمران پارس', rating: 5, text: 'کیفیت میلگردهای فولاد خوزستان عالی بود. تحویل به موقع و بسته‌بندی مناسب.', date: '۱۴۰۳/۰۳/۱۰' },
  { name: 'آقای کریمی', company: 'پیمانکاری البرز', rating: 4, text: 'سیمان تیپ ۲ با کیفیت خوب. قیمت رقابتی در مقایسه با بازار آزاد.', date: '۱۴۰۳/۰۲/۲۸' },
  { name: 'خانم محمدی', company: 'طراحی داخلی مدرن', rating: 5, text: 'کاشی پرسلان سرامیک ایران بی‌نقص بود. رنگ و کیفیت سطح فوق‌العاده.', date: '۱۴۰۳/۰۲/۱۵' },
]

const SORT_OPTIONS = ['جدیدترین', 'ارزان‌ترین', 'گران‌ترین', 'پرفروش‌ترین']

function Stars({ count }: { count: number }) {
  return (
    <span style={{ color: 'var(--gold)', fontSize: 14, letterSpacing: 1 }}>
      {'★'.repeat(count)}{'☆'.repeat(5 - count)}
    </span>
  )
}

export default function StorePage() {
  const [activeCategory, setActiveCategory] = useState('همه')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('جدیدترین')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(10000000)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['مصالح ساختمانی']))
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())
  const [modalQty, setModalQty] = useState(1)
  const [addedId, setAddedId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [orderState, setOrderState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [rfqState, setRfqState] = useState<'idle' | 'sending' | 'done'>('idle')

  useEffect(() => {
    let alive = true
    fetchContent('product', undefined, 100).then((d) => {
      if (alive) { setProducts(d.map(toProduct)); setLoading(false) }
    })
    return () => { alive = false }
  }, [])

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev => {
      const next = new Set(prev)
      next.has(brand) ? next.delete(brand) : next.add(brand)
      return next
    })
  }

  const addToCart = (product: Product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + qty } : i)
      return [...prev, { product, qty }]
    })
    setAddedId(product.id)
    setTimeout(() => setAddedId(null), 1500)
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.product.id !== id))
  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0)
  const totalPrice = cart.reduce((sum, i) => sum + i.product.price * i.qty, 0)

  const placeOrder = async () => {
    if (cart.length === 0 || orderState === 'sending') return
    setOrderState('sending')
    const lines = cart.map(i => `${i.product.name} (${i.product.brand}) × ${i.qty}`).join('\n')
    const description = `سفارش از فروشگاه ملک‌جت:\n${lines}\n\nجمع کل: ${totalPrice.toLocaleString('fa-IR')} تومان`
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'سفارش فروشگاه', description }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.ok) {
        setOrderState('done')
        setCart([])
      } else {
        setOrderState('idle')
      }
    } catch {
      setOrderState('idle')
    }
  }

  const sendRfq = async () => {
    if (rfqState === 'sending') return
    setRfqState('sending')
    const source = cart.length > 0 ? cart : products.slice(0, 10).map(p => ({ product: p, qty: 1 }))
    const lines = source.map(i => `${i.product.name} (${i.product.brand}) × ${i.qty}`).join('\n')
    const description = `درخواست استعلام قیمت عمده (RFQ):\n${lines || 'بدون محصول انتخاب‌شده — لطفاً تماس بگیرید.'}`
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'استعلام قیمت عمده (RFQ)', description }),
      })
      const d = await res.json().catch(() => ({}))
      setRfqState(res.ok && d.ok ? 'done' : 'idle')
    } catch {
      setRfqState('idle')
    }
  }

  let filtered = products.filter(p => {
    if (activeCategory !== 'همه' && p.category !== activeCategory) return false
    if (selectedBrands.size > 0 && !selectedBrands.has(p.brand)) return false
    if (p.price < priceMin || p.price > priceMax) return false
    return true
  })

  if (sortBy === 'ارزان‌ترین') filtered = [...filtered].sort((a, b) => a.price - b.price)
  else if (sortBy === 'گران‌ترین') filtered = [...filtered].sort((a, b) => b.price - a.price)
  else if (sortBy === 'پرفروش‌ترین') filtered = [...filtered].sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0))

  const stockColor = (s: StockStatus) =>
    s === 'موجود' ? '#34d399' : s === 'محدود' ? '#fbbf24' : '#a78bfa'

  const s: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 14,
  }

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      {/* ── CART DRAWER ── */}
      {cartOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
          <div
            onClick={() => { setCartOpen(false); setOrderState('idle') }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 420,
            background: 'var(--bg)', borderLeft: '1px solid var(--line)',
            display: 'flex', flexDirection: 'column', zIndex: 1,
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>سبد خرید ({totalItems})</h2>
              <button
                onClick={() => { setCartOpen(false); setOrderState('idle') }}
                style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {cart.length === 0 ? (
                orderState === 'done' ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12, color: '#22c55e' }}>✓</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>سفارش ثبت شد</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>
                      سفارش شما با موفقیت ثبت شد. کارشناسان ما به‌زودی با شما تماس می‌گیرند.
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>◈</div>
                    <div style={{ fontSize: 14 }}>سبد خرید خالی است</div>
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {cart.map(item => (
                    <div key={item.product.id} style={{ ...s, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                        background: `linear-gradient(135deg, ${item.product.gradientFrom}, ${item.product.gradientTo})`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{item.product.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{item.product.brand}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>
                            {(item.product.price * item.qty).toLocaleString('fa-IR')} ت
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 6 }}>
                            ×{item.qty}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div style={{ padding: 20, borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontSize: 15, fontWeight: 700 }}>
                  <span style={{ color: 'var(--muted)' }}>جمع کل:</span>
                  <span style={{ color: 'var(--gold)' }}>{totalPrice.toLocaleString('fa-IR')} تومان</span>
                </div>
                <button
                  onClick={placeOrder}
                  disabled={orderState === 'sending'}
                  style={{
                  width: '100%', padding: '13px', background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                  color: '#000', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800,
                  cursor: orderState === 'sending' ? 'not-allowed' : 'pointer',
                  opacity: orderState === 'sending' ? 0.7 : 1, fontFamily: 'inherit',
                }}>
                  {orderState === 'sending' ? 'در حال ثبت...' : 'ثبت سفارش'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PRODUCT DETAIL MODAL ── */}
      {selectedProduct && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
          <div
            onClick={() => { setSelectedProduct(null); setModalQty(1) }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: '90%', maxWidth: 640, background: 'var(--bg)', borderRadius: 20,
            border: '1px solid var(--line)', zIndex: 1, overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{
              height: 220,
              background: `linear-gradient(135deg, ${selectedProduct.gradientFrom}, ${selectedProduct.gradientTo})`,
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selectedProduct.hot && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20 }}>
                  پرفروش
                </div>
              )}
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 2 }}>
                {selectedProduct.brand}
              </div>
              <button
                onClick={() => { setSelectedProduct(null); setModalQty(1) }}
                style={{ position: 'absolute', top: 16, left: 16, width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>{selectedProduct.name}</h2>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{selectedProduct.brand} · {selectedProduct.category}</div>
                </div>
                <span style={{
                  background: stockColor(selectedProduct.stock) + '22',
                  color: stockColor(selectedProduct.stock),
                  fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, flexShrink: 0,
                }}>
                  {selectedProduct.stock}
                </span>
              </div>

              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.8, margin: '0 0 20px' }}>
                {selectedProduct.description}
              </p>

              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>مشخصات فنی</div>
                {selectedProduct.specs.map(spec => (
                  <div key={spec} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, color: 'var(--text)' }}>
                    <span style={{ color: 'var(--gold)', fontSize: 8 }}>◆</span>
                    {spec}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)' }}>{selectedProduct.priceLabel}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)' }}>{selectedProduct.unit}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
                  <button
                    onClick={() => setModalQty(q => Math.max(1, q - 1))}
                    style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                  >
                    −
                  </button>
                  <span style={{ fontSize: 16, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{modalQty}</span>
                  <button
                    onClick={() => setModalQty(q => q + 1)}
                    style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={() => { addToCart(selectedProduct, modalQty); setSelectedProduct(null); setModalQty(1); setCartOpen(true) }}
                style={{
                  width: '100%', padding: '14px', background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                  color: '#000', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                افزودن به سبد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STORE HEADER ── */}
      <section style={{ background: 'var(--navbg)', borderBottom: '1px solid var(--line)', padding: '32px 24px 24px' }}>
        <div style={{ maxWidth: 1340, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 900, color: '#000',
              }}>
                م
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>بازار مصالح و محصولات</h1>
                  <span style={{ background: '#22c55e22', color: '#22c55e', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    تأییدشده
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--muted)' }}>
                  <span>ملک‌جت B2B · بازار عمده مصالح ساختمانی</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>★ ۴.۸</span>
                  <span>(۱٬۲۴۷ نظر)</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setCartOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 22px',
                background: totalItems > 0 ? 'linear-gradient(135deg, var(--gold2), var(--gold))' : 'var(--surface)',
                border: `1px solid ${totalItems > 0 ? 'transparent' : 'var(--line)'}`,
                color: totalItems > 0 ? '#000' : 'var(--text)',
                borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <span>سبد خرید</span>
              {totalItems > 0 && (
                <span style={{ background: '#000', color: 'var(--gold)', borderRadius: 20, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                  {totalItems}
                </span>
              )}
            </button>
          </div>

          {/* Featured Brands Bar */}
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {BRANDS.map(brand => (
              <button
                key={brand.name}
                onClick={() => toggleBrand(brand.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
                  background: selectedBrands.has(brand.name) ? 'var(--goldDim)' : 'var(--surface)',
                  border: `1px solid ${selectedBrands.has(brand.name) ? 'var(--gold)' : 'var(--line)'}`,
                  borderRadius: 12, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: brand.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 900, color: '#fff', letterSpacing: 0.5,
                }}>
                  {brand.abbr}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{brand.name}</span>
              </button>
            ))}
          </div>

          {/* Category Chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {CATEGORY_CHIPS.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '7px 18px', borderRadius: 24,
                  border: activeCategory === cat ? '1.5px solid var(--gold)' : '1.5px solid var(--line)',
                  background: activeCategory === cat ? 'var(--gold)' : 'var(--surface)',
                  color: activeCategory === cat ? '#000' : 'var(--text)',
                  fontSize: 13, fontWeight: activeCategory === cat ? 700 : 400,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1340, margin: '0 auto', padding: '28px 24px', display: 'flex', gap: 24 }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside className="mjst-sidebar" style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>

          {/* Categories Tree */}
          <div style={{ ...s, padding: '18px 0', overflow: 'hidden' }}>
            <div style={{ padding: '0 18px 14px', borderBottom: '1px solid var(--line)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              دسته‌بندی‌ها
            </div>
            {SIDEBAR_CATS.map(cat => (
              <div key={cat.name}>
                <button
                  onClick={() => toggleCategory(cat.name)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 18px', border: 'none', background: 'transparent',
                    color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'right',
                  }}
                >
                  <span>{cat.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11, transition: 'transform 0.2s', transform: expandedCategories.has(cat.name) ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    ›
                  </span>
                </button>
                {expandedCategories.has(cat.name) && (
                  <div style={{ paddingBottom: 6 }}>
                    {cat.children.map(child => (
                      <button
                        key={child}
                        onClick={() => setActiveCategory(child)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 18px 7px 32px', border: 'none',
                          background: activeCategory === child ? 'var(--goldDim)' : 'transparent',
                          color: activeCategory === child ? 'var(--gold)' : 'var(--muted)',
                          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
                        }}
                      >
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                        {child}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Brand Filter */}
          <div style={{ ...s, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>برند</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {BRAND_FILTERS.map(brand => (
                <label key={brand} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                  <input
                    type="checkbox"
                    checked={selectedBrands.has(brand)}
                    onChange={() => toggleBrand(brand)}
                    style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }}
                  />
                  {brand}
                </label>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div style={{ ...s, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>محدوده قیمت (تومان)</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>از</div>
                <input
                  type="number"
                  value={priceMin}
                  onChange={e => setPriceMin(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--line)', background: 'var(--bg2)',
                    color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>تا</div>
                <input
                  type="number"
                  value={priceMax}
                  onChange={e => setPriceMax(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--line)', background: 'var(--bg2)',
                    color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ height: 4, background: 'var(--line2)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '100%', background: 'linear-gradient(90deg, var(--gold2), var(--gold))', borderRadius: 4 }} />
            </div>
          </div>

          {/* Certification Filter */}
          <div style={{ ...s, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>گواهینامه</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['ISO 9001', 'CE', 'استاندارد ملی', 'ISIRI'].map(cert => (
                <span
                  key={cert}
                  style={{
                    padding: '4px 10px', borderRadius: 20,
                    border: '1px solid var(--gold2)', background: 'var(--goldDim)',
                    color: 'var(--gold)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{filtered.length}</span> محصول یافت شد
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  padding: '8px 14px', borderRadius: 10, border: '1px solid var(--line)',
                  background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit', outline: 'none', direction: 'rtl',
                }}
              >
                {SORT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    padding: '8px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: viewMode === 'grid' ? 'var(--gold)' : 'var(--surface)',
                    color: viewMode === 'grid' ? '#000' : 'var(--muted)', fontSize: 16,
                  }}
                >
                  ⊞
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '8px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: viewMode === 'list' ? 'var(--gold)' : 'var(--surface)',
                    color: viewMode === 'list' ? '#000' : 'var(--muted)', fontSize: 16,
                    borderRight: '1px solid var(--line)',
                  }}
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          {/* GRID VIEW */}
          {viewMode === 'grid' && (
            <div className="mjst-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
              {filtered.map(product => {
                const justAdded = addedId === product.id
                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    style={{
                      ...s, cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                      transition: 'border-color 0.2s, transform 0.2s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    {product.hot && (
                      <div style={{ position: 'absolute', top: 12, right: 12, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, zIndex: 1 }}>
                        پرفروش
                      </div>
                    )}
                    <div style={{
                      height: 140,
                      background: `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
                        {product.brand}
                      </span>
                    </div>
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, marginBottom: 3 }}>{product.brand}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{product.name}</div>
                        </div>
                        <span style={{
                          background: stockColor(product.stock) + '22',
                          color: stockColor(product.stock),
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0, whiteSpace: 'nowrap',
                        }}>
                          {product.stock}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)' }}>{product.priceLabel}</div>
                          <div style={{ fontSize: 10, color: 'var(--faint)' }}>{product.unit}</div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); addToCart(product) }}
                          style={{
                            padding: '7px 14px', borderRadius: 10, border: 'none',
                            background: justAdded ? '#22c55e' : 'linear-gradient(135deg, var(--gold2), var(--gold))',
                            color: justAdded ? '#fff' : '#000',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                          }}
                        >
                          {justAdded ? '✓ افزوده شد' : 'افزودن به سبد'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div style={{ ...s, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {['محصول', 'برند', 'دسته', 'واحد', 'قیمت', 'موجودی', 'عملیات'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(product => (
                      <tr
                        key={product.id}
                        style={{ transition: 'background 0.15s', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => setSelectedProduct(product)}
                      >
                        <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--line)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})` }} />
                            <span style={{ fontWeight: 600 }}>{product.name}</span>
                            {product.hot && <span style={{ background: '#ef444422', color: '#ef4444', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 20 }}>پرفروش</span>}
                          </div>
                        </td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--gold)', fontWeight: 600, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{product.brand}</td>
                        <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{product.category}</td>
                        <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{product.unit.split('/')[1] || product.unit}</td>
                        <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 700, color: 'var(--text)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {product.priceLabel} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>ت</span>
                        </td>
                        <td style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
                          <span style={{ background: stockColor(product.stock) + '22', color: stockColor(product.stock), fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                            {product.stock}
                          </span>
                        </td>
                        <td style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
                          <button
                            onClick={e => { e.stopPropagation(); addToCart(product) }}
                            style={{
                              padding: '6px 14px', borderRadius: 8,
                              border: '1px solid var(--gold)', background: 'transparent',
                              color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = '#000' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gold)' }}
                          >
                            افزودن به سبد
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>◈</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>محصولی با این فیلترها یافت نشد</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>فیلترهای خود را تغییر دهید</div>
            </div>
          )}

          {/* ── BULK ORDER CTA BANNER ── */}
          <div style={{
            background: 'linear-gradient(135deg, var(--goldDim), rgba(168, 115, 32, 0.08))',
            border: '1px solid var(--gold2)', borderRadius: 16, padding: '24px 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: 'var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
              }}>
                📦
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>
                  خرید عمده برای پروژه؟
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  با ارسال فرم استعلام قیمت، بهترین پیشنهاد را در کمتر از ۲ ساعت دریافت کنید
                </div>
              </div>
            </div>
            <button
              onClick={sendRfq}
              disabled={rfqState === 'sending'}
              style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: rfqState === 'done' ? '#22c55e' : 'linear-gradient(135deg, var(--gold2), var(--gold))',
              color: rfqState === 'done' ? '#fff' : '#000', fontSize: 14, fontWeight: 800,
              cursor: rfqState === 'sending' ? 'not-allowed' : 'pointer',
              opacity: rfqState === 'sending' ? 0.7 : 1, fontFamily: 'inherit', flexShrink: 0,
            }}>
              {rfqState === 'sending' ? 'در حال ارسال...' : rfqState === 'done' ? '✓ استعلام ثبت شد' : 'ارسال استعلام (RFQ)'}
            </button>
          </div>

          {/* ── REVIEWS SECTION ── */}
          <div style={{ marginTop: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 20px', color: 'var(--text)' }}>نظرات خریداران</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {REVIEWS.map((review, i) => (
                <div key={i} style={{ ...s, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 900, color: '#000',
                      }}>
                        {review.name.charAt(review.name.length - 1)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{review.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{review.company}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', flexShrink: 0 }}>{review.date}</div>
                  </div>
                  <Stars count={review.rating} />
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, margin: '10px 0 0' }}>
                    {review.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}
