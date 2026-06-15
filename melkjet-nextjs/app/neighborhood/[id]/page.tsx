'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import { DonutChart, LineChart, BarChart } from '../../components/Charts';
import Link from 'next/link';

// ─── neighbourhood SEO landing page ───────────────────────────────────────
const mockNeighborhood = {
  id: 'tajrish',
  name: 'تجریش',
  city: 'تهران',
  zone: 'منطقه ۱',
  description: 'تجریش یکی از محله‌های قدیمی و اصیل شمال تهران است که با بازار سنتی، امامزاده صالح و دسترسی عالی به طبیعت البرز شناخته می‌شود. این محله ترکیبی منحصربه‌فرد از فرهنگ اصیل ایرانی و امکانات مدرن شهری را ارائه می‌دهد.',
  overallScore: 8.7,
  investScore: 8.2,
  liveScore: 9.1,
  accessScore: 8.4,
  safetyScore: 9.0,
  avgPrice: '۱۸۵ میلیون/متر',
  avgRent: '۱۲ میلیون/ماه',
  priceGrowth: '+۲۴٪',
  population: '۴۸,۰۰۰',
  density: 'متوسط',
  greenCover: '۳۸٪',
  priceHistory: [120, 130, 138, 145, 152, 160, 168, 175, 178, 182, 185, 188],
  propertyMix: [
    { label: 'آپارتمان', value: 68 },
    { label: 'ویلا', value: 12 },
    { label: 'پنت‌هاوس', value: 8 },
    { label: 'دوبلکس', value: 7 },
    { label: 'تجاری', value: 5 },
  ],
  scoreBreakdown: [
    { label: 'حمل‌ونقل', value: 8.4 },
    { label: 'آموزش', value: 9.2 },
    { label: 'بهداشت', value: 8.8 },
    { label: 'تفریح', value: 9.0 },
    { label: 'خرید', value: 8.6 },
    { label: 'امنیت', value: 9.0 },
  ],
  amenities: [
    { icon: '🏫', name: 'دبستان پیشتازان', type: 'مدرسه', dist: '۲۸۰ متر', rating: '۴.۸' },
    { icon: '🏫', name: 'دبیرستان البرز', type: 'مدرسه', dist: '۵۵۰ متر', rating: '۴.۹' },
    { icon: '🏥', name: 'بیمارستان شهدای تجریش', type: 'بیمارستان', dist: '۴۰۰ متر', rating: '۴.۵' },
    { icon: '🏥', name: 'درمانگاه سامان', type: 'درمانگاه', dist: '۱۵۰ متر', rating: '۴.۶' },
    { icon: '🌳', name: 'پارک جمشیدیه', type: 'پارک', dist: '۸۰۰ متر', rating: '۴.۷' },
    { icon: '🌳', name: 'بوستان قدس', type: 'پارک', dist: '۳۵۰ متر', rating: '۴.۴' },
    { icon: '🍽️', name: 'رستوران سنتی بام', type: 'رستوران', dist: '۱۲۰ متر', rating: '۴.۸' },
    { icon: '☕', name: 'کافه شمال', type: 'کافه', dist: '۲۰۰ متر', rating: '۴.۶' },
    { icon: '🛍️', name: 'بازار تجریش', type: 'بازار', dist: '۱۸۰ متر', rating: '۴.۹' },
    { icon: '🚇', name: 'مترو تجریش', type: 'حمل‌ونقل', dist: '۵۰۰ متر', rating: '۴.۳' },
  ],
  transactions: [
    { address: 'خ. فرشته، کوچه صدف، پ. ۱۲', price: '۲۲.۵ میلیارد', date: '۱۴۰۳/۰۳/۰۵', size: '۱۲۰', pricePerSqm: '۱۸۷.۵ م.ت' },
    { address: 'بلوار اندرزگو، ط. ۷', price: '۳۸.۲ میلیارد', date: '۱۴۰۳/۰۲/۲۸', size: '۲۰۰', pricePerSqm: '۱۹۱ م.ت' },
    { address: 'خ. دربند، پ. ۸', price: '۱۵.۸ میلیارد', date: '۱۴۰۳/۰۲/۲۰', size: '۸۵', pricePerSqm: '۱۸۵.۹ م.ت' },
    { address: 'خ. ولیعصر شمالی، پ. ۳۴', price: '۲۷.۱ میلیارد', date: '۱۴۰۳/۰۲/۱۵', size: '۱۴۵', pricePerSqm: '۱۸۶.۹ م.ت' },
    { address: 'خ. قدس، کوچه مهر، واحد ۳', price: '۱۲.۳ میلیارد', date: '۱۴۰۳/۰۲/۰۸', size: '۶۸', pricePerSqm: '۱۸۰.۹ م.ت' },
    { address: 'خ. تجریش، برج آسمان، ط. ۱۵', price: '۵۵.۰ میلیارد', date: '۱۴۰۳/۰۱/۲۵', size: '۲۸۰', pricePerSqm: '۱۹۶.۴ م.ت' },
  ],
  comparisons: [
    { name: 'زعفرانیه', score: 9.1, price: '۲۴۰ م.ت', growth: '+۲۸٪', color: '#e6b450' },
    { name: 'تجریش', score: 8.7, price: '۱۸۵ م.ت', growth: '+۲۴٪', color: 'var(--gold)', active: true },
    { name: 'فرمانیه', score: 8.5, price: '۱۹۵ م.ت', growth: '+۲۱٪', color: '#a0c4ff' },
    { name: 'الهیه', score: 8.8, price: '۲۱۰ م.ت', growth: '+۲۲٪', color: '#b5ead7' },
    { name: 'سعادت‌آباد', score: 8.3, price: '۱۳۵ م.ت', growth: '+۱۹٪', color: '#ffadad' },
  ],
  aiInsights: [
    'قیمت مسکن در تجریش طی ۱۲ ماه گذشته ۲۴٪ رشد داشته، بالاتر از میانگین شهر تهران (۱۷٪).',
    'بیشترین تقاضا برای آپارتمان‌های ۱۰۰-۱۵۰ متری در محدوده خیابان فرشته و اندرزگو گزارش شده.',
    'نزدیکی به بازار تجریش و امامزاده صالح، ارزش ملکی این محله را به شکل پایدار حفظ کرده.',
    'پیش‌بینی AI: رشد ۱۸-۲۲٪ در سال ۱۴۰۴ با احتمال ۷۸٪.',
  ],
}

const months = ['تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند', 'فروردین', 'اردیبهشت', 'خرداد']

export default function NeighborhoodPage() {
  const params = useParams();
  const id = params?.id as string;
  const n = mockNeighborhood
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'compare'>('overview')

  const priceMax = Math.max(...n.priceHistory)
  const priceMin = Math.min(...n.priceHistory)

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
      <Nav />

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 24px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
        <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>خانه</Link>
        <span style={{ color: 'var(--faint)' }}>›</span>
        <Link href="/search" style={{ color: 'var(--muted)', textDecoration: 'none' }}>تحلیل بازار</Link>
        <span style={{ color: 'var(--faint)' }}>›</span>
        <span style={{ color: 'var(--text)' }}>{n.name}</span>
      </div>

      {/* Hero */}
      <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--line)' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(202,168,106,0.06) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, boxShadow: '0 8px 24px -8px var(--gold)'
                }}>🏙️</div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{n.zone} · {n.city}</div>
                  <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                    {n.name}
                    <span style={{ color: 'var(--gold)', marginRight: 12, fontSize: 20 }}>· {n.city}</span>
                  </h1>
                </div>
              </div>
              <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--muted)', lineHeight: 1.8, maxWidth: 620 }}>
                {n.description}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'میانگین قیمت', value: n.avgPrice, color: 'var(--gold)' },
                  { label: 'رشد سالانه', value: n.priceGrowth, color: '#2ecc71' },
                  { label: 'اجاره', value: n.avgRent, color: '#3498db' },
                  { label: 'جمعیت', value: n.population, color: 'var(--muted)' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    padding: '10px 18px', borderRadius: 12,
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    display: 'flex', flexDirection: 'column', gap: 2
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{stat.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Score */}
            <div style={{
              background: 'var(--surface)', borderRadius: 20, padding: '28px 32px',
              border: '1px solid var(--line)', textAlign: 'center', minWidth: 200,
              boxShadow: '0 8px 32px var(--shadow)'
            }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>امتیاز کلی محله</div>
              <DonutChart value={n.overallScore} max={10} color="var(--gold)" size={100} label="از ۱۰" />
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'سرمایه‌گذاری', value: n.investScore },
                  { label: 'زندگی', value: n.liveScore },
                  { label: 'دسترسی', value: n.accessScore },
                  { label: 'امنیت', value: n.safetyScore },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 60px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '28px 0 24px', borderBottom: '1px solid var(--line)', marginBottom: 32 }}>
          {([
            { key: 'overview', label: 'نمای کلی' },
            { key: 'transactions', label: 'معاملات اخیر' },
            { key: 'compare', label: 'مقایسه محله‌ها' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                fontSize: 14, fontWeight: 600, transition: 'all 0.2s', fontFamily: 'inherit',
                background: activeTab === tab.key ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--surface)',
                color: activeTab === tab.key ? '#16140f' : 'var(--muted)',
                border: activeTab === tab.key ? 'none' : '1px solid var(--line)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

              {/* Price Trend */}
              <div style={{ background: 'var(--surface)', borderRadius: 18, padding: 24, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>روند قیمت میانگین ۱۲ ماه</h2>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>قیمت بر اساس میلیون تومان به ازای متر مربع</div>
                  </div>
                  <div style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.25)',
                    fontSize: 13, fontWeight: 700, color: '#2ecc71'
                  }}>
                    {n.priceGrowth} رشد سالانه
                  </div>
                </div>
                {/* SVG Line chart */}
                <div style={{ position: 'relative' }}>
                  <LineChart data={n.priceHistory} width={600} height={140} color="var(--gold)" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    {months.map(m => (
                      <div key={m} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--faint)' }}>{m}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                  {[
                    { label: 'کمترین (سال)', value: `${priceMin} م.ت` },
                    { label: 'بیشترین (سال)', value: `${priceMax} م.ت` },
                    { label: 'میانگین', value: `${Math.round((priceMin + priceMax) / 2)} م.ت` },
                    { label: 'آخرین تراکنش', value: `${n.priceHistory[11]} م.ت` },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Property Mix */}
              <div style={{ background: 'var(--surface)', borderRadius: 18, padding: 24, border: '1px solid var(--line)' }}>
                <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800 }}>ترکیب ملک</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
                  <div>
                    <BarChart
                      data={n.propertyMix.map(p => ({ label: p.label, value: p.value }))}
                      height={180}
                      highlightLast={false}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {n.propertyMix.map((p, i) => {
                      const colors = ['var(--gold)', '#a0c4ff', '#b5ead7', '#ffadad', '#ffdac1']
                      return (
                        <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i], flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{p.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{p.value}٪</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div style={{ background: 'var(--surface)', borderRadius: 18, padding: 24, border: '1px solid var(--line)' }}>
                <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800 }}>امکانات محله</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {n.amenities.map(a => (
                    <div key={a.name} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--bg2)', borderRadius: 12, padding: '12px 16px',
                      border: '1px solid var(--line)'
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: 'var(--surface)', border: '1px solid var(--line)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                      }}>{a.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.dist}</span>
                          <span style={{ fontSize: 11, color: 'var(--faint)' }}>·</span>
                          <span style={{ fontSize: 11, color: 'var(--gold)' }}>★ {a.rating}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--faint)', background: 'var(--bg)', padding: '3px 8px', borderRadius: 5, border: '1px solid var(--line)', flexShrink: 0 }}>{a.type}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Score breakdown */}
              <div style={{ background: 'var(--surface)', borderRadius: 18, padding: 24, border: '1px solid var(--line)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800 }}>تفکیک امتیاز</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {n.scoreBreakdown.map(s => (
                    <div key={s.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--text)' }}>{s.label}</span>
                        <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{s.value}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${(s.value / 10) * 100}%`,
                          background: 'linear-gradient(90deg,var(--gold2),var(--gold))',
                          transition: 'width 0.6s ease'
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              <div style={{ background: 'var(--goldDim)', borderRadius: 18, padding: 24, border: '1px solid var(--gold)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ color: 'var(--gold)', fontSize: 18 }}>✦</span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>تحلیل هوشمند</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {n.aiInsights.map((insight, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                        background: 'rgba(202,168,106,0.2)', border: '1px solid var(--gold)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: 'var(--gold)'
                      }}>{i + 1}</div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{insight}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick facts */}
              <div style={{ background: 'var(--surface)', borderRadius: 18, padding: 24, border: '1px solid var(--line)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>اطلاعات کلیدی</h3>
                {[
                  { label: 'منطقه شهری', value: n.zone },
                  { label: 'تراکم', value: n.density },
                  { label: 'پوشش سبز', value: n.greenCover },
                  { label: 'جمعیت', value: n.population },
                  { label: 'میانگین اجاره', value: n.avgRent },
                  { label: 'میانگین خرید', value: n.avgPrice },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>{f.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.value}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link href="/search?neighborhood=tajrish" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 24px', borderRadius: 14,
                background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                color: '#16140f', textDecoration: 'none', fontWeight: 800, fontSize: 15,
                boxShadow: '0 8px 24px -8px var(--gold)'
              }}>
                🔍 جستجو در {n.name}
              </Link>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 800 }}>معاملات اخیر</h2>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>آخرین معاملات ثبت‌شده در {n.name}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 14px' }}>
                ۶ معامله اخیر
              </div>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--line)', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 1fr',
                padding: '14px 20px', background: 'var(--bg2)',
                borderBottom: '1px solid var(--line)', fontSize: 12, color: 'var(--faint)', fontWeight: 700
              }}>
                <span>آدرس</span>
                <span style={{ textAlign: 'center' }}>قیمت کل</span>
                <span style={{ textAlign: 'center' }}>تاریخ</span>
                <span style={{ textAlign: 'center' }}>متراژ</span>
                <span style={{ textAlign: 'left' }}>قیمت/متر</span>
              </div>
              {n.transactions.map((t, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 1fr',
                  padding: '16px 20px', borderBottom: i < n.transactions.length - 1 ? '1px solid var(--line)' : 'none',
                  fontSize: 13, alignItems: 'center',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(202,168,106,0.02)'
                }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{t.address}</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 700, textAlign: 'center' }}>{t.price}</span>
                  <span style={{ color: 'var(--muted)', textAlign: 'center', direction: 'ltr', unicodeBidi: 'embed' }}>{t.date}</span>
                  <span style={{ color: 'var(--text)', textAlign: 'center', fontWeight: 600 }}>{t.size} متر</span>
                  <span style={{ color: 'var(--muted)', textAlign: 'left' }}>{t.pricePerSqm}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: 20, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--line)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'میانگین قیمت/متر', value: '۱۸۸ م.ت', color: 'var(--gold)' },
                { label: 'بیشترین', value: '۱۹۶ م.ت', color: '#2ecc71' },
                { label: 'کمترین', value: '۱۸۱ م.ت', color: '#e74c3c' },
                { label: 'تعداد معاملات این ماه', value: '۲۳ معامله', color: 'var(--text)' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compare Tab */}
        {activeTab === 'compare' && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 800 }}>مقایسه با محله‌های مجاور</h2>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>تجریش در مقایسه با محله‌های مشابه شمال تهران</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {n.comparisons.map(c => (
                <div key={c.name} style={{
                  background: c.active ? 'var(--goldDim)' : 'var(--surface)',
                  borderRadius: 16, padding: '20px 24px',
                  border: c.active ? '2px solid var(--gold)' : '1px solid var(--line)',
                  display: 'grid', gridTemplateColumns: '160px 1fr 120px 120px 120px',
                  alignItems: 'center', gap: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: c.active ? 800 : 600, color: c.active ? 'var(--gold)' : 'var(--text)' }}>
                      {c.name}
                      {c.active && <span style={{ fontSize: 10, marginRight: 6, color: 'var(--gold)', fontWeight: 700 }}>← شما</span>}
                    </span>
                  </div>
                  {/* Score bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--faint)' }}>
                      <span>امتیاز</span>
                      <span style={{ fontWeight: 700, color: c.active ? 'var(--gold)' : 'var(--text)' }}>{c.score}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(c.score / 10) * 100}%`, background: c.color, borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 3 }}>قیمت/متر</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: c.active ? 'var(--gold)' : 'var(--text)' }}>{c.price}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 3 }}>رشد سالانه</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#2ecc71' }}>{c.growth}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Link href={`/neighborhood/${c.name}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '7px 14px', borderRadius: 8, textDecoration: 'none',
                      background: c.active ? 'var(--gold)' : 'var(--bg2)',
                      color: c.active ? '#16140f' : 'var(--muted)',
                      border: c.active ? 'none' : '1px solid var(--line)',
                      fontSize: 12, fontWeight: 600
                    }}>
                      مشاهده ›
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Comparison chart */}
            <div style={{ marginTop: 32, background: 'var(--surface)', borderRadius: 18, padding: 24, border: '1px solid var(--line)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>نمودار مقایسه قیمت</h3>
              <BarChart
                data={n.comparisons.map(c => ({
                  label: c.name,
                  value: parseInt(c.price.replace(/[^۰-۹0-9]/g, '')) || 100,
                  color: c.active ? 'var(--gold)' : undefined
                }))}
                height={160}
                highlightLast={false}
              />
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
