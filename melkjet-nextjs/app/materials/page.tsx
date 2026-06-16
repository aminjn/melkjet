'use client'
import { useState } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

type View = 'dashboard' | 'catalog' | 'orders' | 'rfq'
type Category = 'همه' | 'سیمان' | 'آجر' | 'کاشی' | 'تأسیسات' | 'رنگ'

const kpis = [
  { label: 'فروش ماهانه', value: '۴٬۸۰۰ م.ت', icon: '﷼', color: 'var(--gold)' },
  { label: 'سفارش فعال', value: '۳۷', icon: '📦', color: '#60a5fa' },
  { label: 'تامین‌کننده', value: '۱۴۲', icon: '🏭', color: '#34d399' },
  { label: 'صرفه‌جویی AI', value: '۱۲٪', icon: '🤖', color: '#a78bfa' },
]

const categories = [
  { label: 'سیمان و بتون', pct: 34 },
  { label: 'آجر و بلوک', pct: 22 },
  { label: 'کاشی و سرامیک', pct: 18 },
  { label: 'درب و پنجره', pct: 15 },
  { label: 'تأسیسات', pct: 11 },
]

const recentOrders = [
  { id: '#۱۰۴۵', product: 'سیمان پرتلند', supplier: 'گروه صنعتی ارس', amount: '۱۲٬۵۰۰٬۰۰۰', status: 'تحویل‌شده', statusColor: '#34d399' },
  { id: '#۱۰۴۴', product: 'آجر سفال', supplier: 'کارخانه آجر نوین', amount: '۴٬۸۰۰٬۰۰۰', status: 'در ارسال', statusColor: '#60a5fa' },
  { id: '#۱۰۴۳', product: 'کاشی پرسلان', supplier: 'سرامیک ایران', amount: '۲۸٬۰۰۰٬۰۰۰', status: 'در انتظار', statusColor: 'var(--gold)' },
  { id: '#۱۰۴۲', product: 'لوله آهنی', supplier: 'فولاد مبارکه', amount: '۸٬۵۰۰٬۰۰۰', status: 'تحویل‌شده', statusColor: '#34d399' },
  { id: '#۱۰۴۱', product: 'رنگ ساختمانی', supplier: 'ایران رنگ', amount: '۴٬۵۰۰٬۰۰۰', status: 'لغو‌شده', statusColor: '#f87171' },
]

const allProducts = [
  { name: 'سیمان پرتلند ۴۲.۵', unit: 'کیلوگرم', price: '۱۲٬۵۰۰', aiPrice: '۱۱٬۸۰۰', aiDiff: '-۵.۶٪', stock: 'موجود', cat: 'سیمان' },
  { name: 'آجر سفال ۲۰×۱۰', unit: 'هزار عدد', price: '۴٬۸۰۰٬۰۰۰', aiPrice: '۴٬۵۰۰٬۰۰۰', aiDiff: '-۶.۳٪', stock: 'موجود', cat: 'آجر' },
  { name: 'کاشی پرسلان ۶۰×۶۰', unit: 'متر مربع', price: '۲۸۰٬۰۰۰', aiPrice: '۲۶۵٬۰۰۰', aiDiff: '-۵.۴٪', stock: 'موجود', cat: 'کاشی' },
  { name: 'لوله آهنی ۱ اینچ', unit: 'متر', price: '۸۵٬۰۰۰', aiPrice: '۷۹٬۰۰۰', aiDiff: '-۷.۱٪', stock: 'کمبود موجودی', cat: 'تأسیسات' },
  { name: 'رنگ ساختمانی سفید', unit: 'لیتر', price: '۴۵٬۰۰۰', aiPrice: '۴۲٬۵۰۰', aiDiff: '-۵.۶٪', stock: 'موجود', cat: 'رنگ' },
  { name: 'پروفیل آلومینیوم', unit: 'متر', price: '۱۲۰٬۰۰۰', aiPrice: '۱۱۵٬۰۰۰', aiDiff: '-۴.۲٪', stock: 'موجود', cat: 'تأسیسات' },
]

const ordersList = [
  { id: '#۱۰۴۵', product: 'سیمان پرتلند', supplier: 'گروه صنعتی ارس', date: '۱۴۰۳/۰۳/۱۲', amount: '۱۲٬۵۰۰٬۰۰۰', status: 'تحویل‌شده', statusColor: '#34d399' },
  { id: '#۱۰۴۴', product: 'آجر سفال', supplier: 'کارخانه آجر نوین', date: '۱۴۰۳/۰۳/۱۰', amount: '۴٬۸۰۰٬۰۰۰', status: 'در ارسال', statusColor: '#60a5fa' },
  { id: '#۱۰۴۳', product: 'کاشی پرسلان', supplier: 'سرامیک ایران', date: '۱۴۰۳/۰۳/۰۸', amount: '۲۸٬۰۰۰٬۰۰۰', status: 'در انتظار', statusColor: 'var(--gold)' },
  { id: '#۱۰۴۲', product: 'لوله آهنی', supplier: 'فولاد مبارکه', date: '۱۴۰۳/۰۳/۰۵', amount: '۸٬۵۰۰٬۰۰۰', status: 'تحویل‌شده', statusColor: '#34d399' },
  { id: '#۱۰۴۱', product: 'رنگ ساختمانی', supplier: 'ایران رنگ', date: '۱۴۰۳/۰۳/۰۱', amount: '۴٬۵۰۰٬۰۰۰', status: 'لغو‌شده', statusColor: '#f87171' },
  { id: '#۱۰۴۰', product: 'پروفیل آلومینیوم', supplier: 'آلومینیوم البرز', date: '۱۴۰۳/۰۲/۲۸', amount: '۶٬۰۰۰٬۰۰۰', status: 'در انتظار', statusColor: 'var(--gold)' },
  { id: '#۱۰۳۹', product: 'سیمان پرتلند', supplier: 'گروه صنعتی ارس', date: '۱۴۰۳/۰۲/۲۵', amount: '۹٬۲۰۰٬۰۰۰', status: 'در ارسال', statusColor: '#60a5fa' },
]

const rfqCards = [
  {
    builder: 'شرکت عمران پارس',
    product: 'سیمان',
    qty: '۵۰۰ تن',
    aiPrice: '۶٬۲۵۰٬۰۰۰٬۰۰۰ ریال',
    deadline: '۱۴۰۳/۰۳/۲۰',
    urgency: 'فوری',
  },
  {
    builder: 'گروه ساختمانی نیلوفر',
    product: 'آجر سفال',
    qty: '۲۰۰ هزار عدد',
    aiPrice: '۹۰۰٬۰۰۰٬۰۰۰ ریال',
    deadline: '۱۴۰۳/۰۳/۲۵',
    urgency: 'عادی',
  },
  {
    builder: 'برج‌سازی ایرانیان',
    product: 'کاشی پرسلان',
    qty: '۵٬۰۰۰ متر',
    aiPrice: '۱٬۳۲۵٬۰۰۰٬۰۰۰ ریال',
    deadline: '۱۴۰۳/۰۴/۰۱',
    urgency: 'عادی',
  },
  {
    builder: 'مجتمع مسکونی سپند',
    product: 'رنگ ساختمانی',
    qty: '۲٬۰۰۰ لیتر',
    aiPrice: '۸۵٬۰۰۰٬۰۰۰ ریال',
    deadline: '۱۴۰۳/۰۴/۰۵',
    urgency: 'عادی',
  },
]

const navItems: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'داشبورد', icon: '⊞' },
  { id: 'catalog', label: 'کاتالوگ', icon: '◫' },
  { id: 'orders', label: 'سفارش‌ها', icon: '◈' },
  { id: 'rfq', label: 'استعلام (RFQ)', icon: '◎' },
]

const catFilters: Category[] = ['همه', 'سیمان', 'آجر', 'کاشی', 'تأسیسات', 'رنگ']

export default function MaterialsPage() {
  const [view, setView] = useState<View>('dashboard')
  const [activeCat, setActiveCat] = useState<Category>('همه')

  const filteredProducts =
    activeCat === 'همه' ? allProducts : allProducts.filter((p) => p.cat === activeCat)

  /* ── shared styles ── */
  const surface: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    padding: '20px 24px',
  }

  const badge = (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color,
    background: bg,
  })

  const th: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'right',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)',
    borderBottom: '1px solid var(--line)',
    whiteSpace: 'nowrap',
  }

  const td: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: 13,
    color: 'var(--text)',
    borderBottom: '1px solid var(--line)',
    whiteSpace: 'nowrap',
  }

  /* ════════════════════════════════════════
     VIEWS
  ════════════════════════════════════════ */

  const Dashboard = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPIs */}
      <div className="mjm-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...surface, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 8 }}>
                این ماه
              </span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color, fontVariantNumeric: 'tabular-nums' }}>
              {k.value}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20 }}>
        {/* Categories */}
        <div style={surface}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>
            دسته‌بندی کالاها
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {categories.map((c) => (
              <div key={c.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{c.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>{c.pct}٪</span>
                </div>
                <div style={{ height: 6, background: 'var(--line2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${c.pct}%`,
                      background: 'linear-gradient(90deg, var(--gold2), var(--gold))',
                      borderRadius: 4,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div style={{ ...surface, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>آخرین سفارش‌ها</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['شناسه', 'محصول', 'تامین‌کننده', 'مبلغ (ت)', 'وضعیت'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} style={{ transition: 'background 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...td, color: 'var(--gold)', fontWeight: 600 }}>{o.id}</td>
                    <td style={td}>{o.product}</td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{o.supplier}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{o.amount}</td>
                    <td style={td}>
                      <span style={badge(o.statusColor, o.statusColor + '22')}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

  const Catalog = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Category filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {catFilters.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCat(c)}
            style={{
              padding: '8px 20px',
              borderRadius: 24,
              border: activeCat === c ? '1.5px solid var(--gold)' : '1.5px solid var(--line)',
              background: activeCat === c ? 'var(--gold)' : 'var(--surface)',
              color: activeCat === c ? '#000' : 'var(--text)',
              fontSize: 13,
              fontWeight: activeCat === c ? 700 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* AI hint */}
      <div style={{
        background: 'linear-gradient(135deg, #a78bfa18, #60a5fa10)',
        border: '1px solid #a78bfa44',
        borderRadius: 10,
        padding: '12px 18px',
        fontSize: 13,
        color: '#a78bfa',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        هوش مصنوعی قیمت‌های رقابتی را بر اساس داده‌های بازار روز تحلیل کرده است.
      </div>

      {/* Products table */}
      <div style={{ ...surface, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['محصول', 'واحد', 'قیمت (ریال)', 'پیشنهاد AI', 'تفاوت', 'موجودی', 'عملیات'].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr
                  key={p.name}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{p.unit}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{p.price}</td>
                  <td style={{ ...td, color: '#34d399', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{p.aiPrice}</td>
                  <td style={td}>
                    <span style={badge('#34d399', '#34d39922')}>{p.aiDiff}</span>
                  </td>
                  <td style={td}>
                    <span style={p.stock === 'موجود'
                      ? badge('#34d399', '#34d39922')
                      : badge('#f87171', '#f8717122')}>
                      {p.stock}
                    </span>
                  </td>
                  <td style={td}>
                    <button style={{
                      padding: '5px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--gold)',
                      background: 'transparent',
                      color: 'var(--gold)',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--gold)'
                        e.currentTarget.style.color = '#000'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--gold)'
                      }}
                    >
                      سفارش
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const orderStatusCounts = [
    { label: 'در انتظار', count: '۸', color: 'var(--gold)', bg: 'var(--goldDim)' },
    { label: 'در حال ارسال', count: '۱۲', color: '#60a5fa', bg: '#60a5fa22' },
    { label: 'تحویل‌شده', count: '۱۷', color: '#34d399', bg: '#34d39922' },
    { label: 'لغو‌شده', count: '۲', color: '#f87171', bg: '#f8717122' },
  ]

  const Orders = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Status counters */}
      <div className="mjm-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {orderStatusCounts.map((s) => (
          <div key={s.label} style={{
            ...surface,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 20px',
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: s.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 700,
              color: s.color,
            }}>
              {s.count}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div style={{ ...surface, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>لیست سفارش‌ها</span>
          <button style={{
            padding: '7px 18px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--gold)',
            color: '#000',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            + سفارش جدید
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                {['شناسه', 'محصول', 'تامین‌کننده', 'تاریخ', 'مبلغ (ت)', 'وضعیت', 'عملیات'].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordersList.map((o) => (
                <tr
                  key={o.id}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...td, color: 'var(--gold)', fontWeight: 600 }}>{o.id}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{o.product}</td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{o.supplier}</td>
                  <td style={{ ...td, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{o.date}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{o.amount}</td>
                  <td style={td}>
                    <span style={badge(o.statusColor, o.statusColor + '22')}>{o.status}</span>
                  </td>
                  <td style={td}>
                    <button style={{
                      padding: '5px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'transparent',
                      color: 'var(--muted)',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>
                      جزئیات
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const RFQ = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Gold banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--goldDim), #a8732018)',
        border: '1px solid var(--gold2)',
        borderRadius: 12,
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}>
          🔔
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>
            ۵ استعلام جدید دریافت شد، AI قیمت رقابتی آماده کرده است
          </div>
        </div>
      </div>

      {/* RFQ Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
        {rfqCards.map((r, i) => (
          <div key={i} style={{
            ...surface,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Urgency tag */}
            {r.urgency === 'فوری' && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                background: '#f87171',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 12px',
                borderBottomRightRadius: 8,
              }}>
                فوری
              </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{r.builder}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  مهلت پاسخ: {r.deadline}
                </div>
              </div>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--bg2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}>
                📋
              </div>
            </div>

            {/* Details */}
            <div className="mjm-2col" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              background: 'var(--bg2)',
              borderRadius: 8,
              padding: '12px 14px',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>محصول</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.product}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>کمیت</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.qty}</div>
              </div>
            </div>

            {/* AI Price */}
            <div style={{
              background: 'linear-gradient(135deg, #a78bfa14, #60a5fa10)',
              border: '1px solid #a78bfa33',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>🤖</span>
              <div>
                <div style={{ fontSize: 11, color: '#a78bfa', marginBottom: 2 }}>پیشنهاد هوش مصنوعی</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', fontVariantNumeric: 'tabular-nums' }}>
                  {r.aiPrice}
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              style={{
                width: '100%',
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                color: '#000',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              ارائه پیشنهاد
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  const viewMap: Record<View, React.ReactNode> = {
    dashboard: Dashboard,
    catalog: Catalog,
    orders: Orders,
    rfq: RFQ,
  }

  const viewTitle: Record<View, string> = {
    dashboard: 'داشبورد',
    catalog: 'کاتالوگ مصالح',
    orders: 'سفارش‌ها',
    rfq: 'استعلام قیمت (RFQ)',
  }

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 120px)', maxWidth: 1300, margin: '0 auto', padding: '32px 20px', gap: 24 }}>

        {/* ── SIDEBAR ── */}
        <aside className="mjm-side" style={{
          width: 220,
          flexShrink: 0,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
          height: 'fit-content',
          position: 'sticky',
          top: 24,
          boxShadow: 'var(--shadow)',
        }}>
          {/* Logo */}
          <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38,
                height: 38,
                background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 900,
                color: '#000',
                transform: 'rotate(45deg)',
                flexShrink: 0,
              }}>
                <span style={{ transform: 'rotate(-45deg)', display: 'block', fontSize: 13 }}>م</span>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-0.3px' }}>ملک‌جت</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>بازار مصالح</div>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            {navItems.map((item) => {
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: active ? 'linear-gradient(135deg, var(--goldDim), #a8732015)' : 'transparent',
                    color: active ? 'var(--gold)' : 'var(--muted)',
                    fontSize: 14,
                    fontWeight: active ? 700 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'right',
                    borderRight: active ? '3px solid var(--gold)' : '3px solid transparent',
                    transition: 'all 0.15s',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = 'var(--bg2)'
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span className="mjm-sidelabel">{item.label}</span>
                  {item.id === 'rfq' && (
                    <span style={{
                      marginRight: 'auto',
                      background: '#f87171',
                      color: '#fff',
                      borderRadius: 10,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 7px',
                    }}>
                      ۵
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Status badge */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--line)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#34d39918',
              border: '1px solid #34d39944',
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#34d399',
                boxShadow: '0 0 6px #34d399',
                flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>فروشگاه فعال</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>آنلاین</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Page header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {viewTitle[view]}
              </h1>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                بازار B2B مصالح ساختمانی | MelkJet
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{
                padding: '9px 18px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                ⬇ خروجی
              </button>
              <button style={{
                padding: '9px 18px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, var(--gold2), var(--gold))',
                color: '#000',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                + استعلام جدید
              </button>
            </div>
          </div>

          {/* Active view */}
          {viewMap[view]}
        </main>
      </div>

      <Footer />
    </div>
  )
}
