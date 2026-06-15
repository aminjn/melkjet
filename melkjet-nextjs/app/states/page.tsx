'use client'
import { useState } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { BarChart } from '@/app/components/Charts'

type Province = {
  id: string
  name: string
  avgPrice: number
  avgPriceLabel: string
  listings: number
  growth: number
  trend: 'up' | 'down' | 'flat'
  population: string
  area: string
  topCity: string
  barData: number[]
}

type City = {
  name: string
  avgPrice: string
  listings: number
  growth: number
}

const provinces: Province[] = [
  { id: 'tehran', name: 'تهران', avgPrice: 125, avgPriceLabel: '۱۲۵ م', listings: 48200, growth: 8.4, trend: 'up', population: '۱۶.۵ م', area: '۱۸,۹۰۹', topCity: 'تهران', barData: [82, 88, 95, 104, 115, 125] },
  { id: 'isfahan', name: 'اصفهان', avgPrice: 58, avgPriceLabel: '۵۸ م', listings: 14600, growth: 11.2, trend: 'up', population: '۵.۵ م', area: '۱۰۷,۰۲۸', topCity: 'اصفهان', barData: [38, 42, 47, 51, 55, 58] },
  { id: 'mashhad', name: 'مشهد', avgPrice: 52, avgPriceLabel: '۵۲ م', listings: 18900, growth: 9.7, trend: 'up', population: '۳.۷ م', area: '۵۵,۲۵۸', topCity: 'مشهد', barData: [34, 38, 42, 46, 49, 52] },
  { id: 'shiraz', name: 'شیراز', avgPrice: 48, avgPriceLabel: '۴۸ م', listings: 11200, growth: 13.1, trend: 'up', population: '۱.۹ م', area: '�,۹۵۷', topCity: 'شیراز', barData: [29, 33, 37, 41, 44, 48] },
  { id: 'tabriz', name: 'تبریز', avgPrice: 44, avgPriceLabel: '۴۴ م', listings: 9800, growth: 6.8, trend: 'up', population: '۱.۶ م', area: '۳۷,۵۰۳', topCity: 'تبریز', barData: [30, 33, 36, 39, 42, 44] },
  { id: 'karaj', name: 'کرج', avgPrice: 65, avgPriceLabel: '۶۵ م', listings: 16300, growth: 7.3, trend: 'up', population: '۲.۱ م', area: '۵,۰۱۷', topCity: 'کرج', barData: [44, 48, 53, 57, 61, 65] },
  { id: 'ahvaz', name: 'اهواز', avgPrice: 35, avgPriceLabel: '۳۵ م', listings: 7400, growth: -1.2, trend: 'down', population: '۱.۵ م', area: '۶۳,۲۳۸', topCity: 'اهواز', barData: [36, 37, 37, 36, 35, 35] },
  { id: 'qom', name: 'قم', avgPrice: 39, avgPriceLabel: '۳۹ م', listings: 5600, growth: 4.2, trend: 'up', population: '۱.۴ م', area: '۱۱,۵۲۶', topCity: 'قم', barData: [31, 33, 35, 36, 37, 39] },
  { id: 'rasht', name: 'رشت', avgPrice: 42, avgPriceLabel: '۴۲ م', listings: 6800, growth: 15.3, trend: 'up', population: '۶۷۹ ه', area: '۳,۸۴۸', topCity: 'رشت', barData: [25, 29, 33, 36, 39, 42] },
  { id: 'sari', name: 'ساری', avgPrice: 37, avgPriceLabel: '۳۷ م', listings: 4900, growth: 12.8, trend: 'up', population: '۳۱۴ ه', area: '�,۸۷۳', topCity: 'ساری', barData: [22, 25, 28, 31, 34, 37] },
]

const citiesMap: Record<string, City[]> = {
  tehran: [
    { name: 'تهران مرکزی', avgPrice: '۱۴۵ م', listings: 18200, growth: 9.1 },
    { name: 'سعادت‌آباد', avgPrice: '۱۲۷ م', listings: 5400, growth: 8.4 },
    { name: 'شهریار', avgPrice: '۴۸ م', listings: 6200, growth: 6.2 },
    { name: 'اسلامشهر', avgPrice: '۳۲ م', listings: 4800, growth: 4.8 },
    { name: 'ری', avgPrice: '۵۵ م', listings: 3900, growth: 5.3 },
    { name: 'رودهن', avgPrice: '۴۱ م', listings: 2900, growth: 7.2 },
  ],
  isfahan: [
    { name: 'اصفهان', avgPrice: '۶۲ م', listings: 8200, growth: 12.1 },
    { name: 'کاشان', avgPrice: '۳۸ م', listings: 3100, growth: 9.4 },
    { name: 'نجف‌آباد', avgPrice: '۲۸ م', listings: 1900, growth: 6.7 },
    { name: 'خمینی‌شهر', avgPrice: '۳۵ م', listings: 2100, growth: 8.1 },
  ],
  mashhad: [
    { name: 'مشهد', avgPrice: '۵۵ م', listings: 12400, growth: 10.2 },
    { name: 'نیشابور', avgPrice: '۲۲ م', listings: 2800, growth: 7.5 },
    { name: 'سبزوار', avgPrice: '۱۸ م', listings: 1900, growth: 5.3 },
    { name: 'تربت‌حیدریه', avgPrice: '۱۵ م', listings: 1400, growth: 4.9 },
  ],
  shiraz: [
    { name: 'شیراز', avgPrice: '۵۱ م', listings: 7800, growth: 14.2 },
    { name: 'مرودشت', avgPrice: '۲۴ م', listings: 1800, growth: 8.6 },
    { name: 'لارستان', avgPrice: '۱۸ م', listings: 900, growth: 5.1 },
  ],
  tabriz: [
    { name: 'تبریز', avgPrice: '۴۷ م', listings: 6900, growth: 7.2 },
    { name: 'مراغه', avgPrice: '۱۹ م', listings: 1400, growth: 4.8 },
    { name: 'اهر', avgPrice: '۱۵ م', listings: 900, growth: 3.9 },
  ],
  karaj: [
    { name: 'کرج', avgPrice: '۶۸ م', listings: 9800, growth: 7.8 },
    { name: 'نظرآباد', avgPrice: '۳۸ م', listings: 2200, growth: 5.4 },
    { name: 'هشتگرد', avgPrice: '۲۹ م', listings: 1800, growth: 4.6 },
  ],
  ahvaz: [
    { name: 'اهواز', avgPrice: '۳۷ م', listings: 4800, growth: -0.8 },
    { name: 'آبادان', avgPrice: '۲۲ م', listings: 1400, growth: -2.1 },
    { name: 'خرمشهر', avgPrice: '۱۸ م', listings: 900, growth: -1.8 },
  ],
  qom: [
    { name: 'قم', avgPrice: '۴۱ م', listings: 4100, growth: 4.5 },
    { name: 'جعفریه', avgPrice: '۲۴ م', listings: 800, growth: 2.9 },
  ],
  rasht: [
    { name: 'رشت', avgPrice: '۴۵ م', listings: 4200, growth: 16.1 },
    { name: 'لاهیجان', avgPrice: '۳۸ م', listings: 1400, growth: 14.8 },
    { name: 'بندرانزلی', avgPrice: '۳۲ م', listings: 900, growth: 12.3 },
  ],
  sari: [
    { name: 'ساری', avgPrice: '۳۹ م', listings: 2800, growth: 13.4 },
    { name: 'بابل', avgPrice: '۲۹ م', listings: 1400, growth: 11.6 },
    { name: 'آمل', avgPrice: '۲۷ م', listings: 1100, growth: 10.9 },
  ],
}

type SortKey = 'price' | 'listings' | 'growth'

export default function StatesPage() {
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('listings')
  const [searchQuery, setSearchQuery] = useState('')

  const sortedProvinces = [...provinces]
    .filter(p => p.name.includes(searchQuery))
    .sort((a, b) => {
      if (sortBy === 'price') return b.avgPrice - a.avgPrice
      if (sortBy === 'listings') return b.listings - a.listings
      if (sortBy === 'growth') return b.growth - a.growth
      return 0
    })

  const cities = selectedProvince ? (citiesMap[selectedProvince.id] || []) : []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      {/* Header */}
      <section style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--line)', padding: '48px 24px 40px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 11, background: 'var(--goldDim)', color: 'var(--gold)', padding: '4px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: 1 }}>بازار ملک ایران</span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-1px' }}>مرور بازار به تفکیک استان</h1>
          <p style={{ color: 'var(--muted)', fontSize: 15, margin: 0 }}>داده‌های به‌روز بازار ملک در ۱۰ استان پرتقاضای کشور</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: 32 }}>
            {[
              { label: 'کل آگهی‌های فعال', value: '۱۴۳٬۷۰۰', icon: '◈' },
              { label: 'میانگین رشد سالانه', value: '+۸٫۷٪', icon: '◰' },
              { label: 'استان‌های تحت پوشش', value: '۱۰ استان', icon: '◴' },
              { label: 'بیشترین رشد (رشت)', value: '+۱۵٫۳٪', icon: '▦' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{k.label}</span>
                  <span style={{ width: 28, height: 28, background: 'var(--goldDim)', color: 'var(--gold)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{k.icon}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 24px' }}>
        {/* Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="جستجوی استان..."
              style={{ width: '100%', padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 11, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>مرتب‌سازی:</span>
            {([['listings', 'تعداد آگهی'], ['price', 'قیمت'], ['growth', 'رشد قیمت']] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: '1px solid var(--line)',
                  background: sortBy === key ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--surface)',
                  color: sortBy === key ? '#16140f' : 'var(--muted)',
                  fontSize: 13, fontWeight: sortBy === key ? 700 : 500, cursor: 'pointer'
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Province Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18, marginBottom: 40 }}>
          {sortedProvinces.map(province => {
            const isSelected = selectedProvince?.id === province.id
            return (
              <div
                key={province.id}
                onClick={() => setSelectedProvince(isSelected ? null : province)}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isSelected ? 'var(--gold)' : 'var(--line)'}`,
                  borderRadius: 16,
                  padding: 22,
                  cursor: 'pointer',
                  transition: 'all .2s',
                  boxShadow: isSelected ? '0 0 0 3px rgba(201,168,76,0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 3 }}>{province.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>مرکز: {province.topCity}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10,
                      background: province.trend === 'up' ? 'rgba(95,217,138,0.12)' : province.trend === 'down' ? 'rgba(231,101,74,0.12)' : 'var(--bg)',
                      color: province.trend === 'up' ? '#5fd98a' : province.trend === 'down' ? '#e7674a' : 'var(--muted)',
                    }}>
                      {province.trend === 'up' ? '▲' : province.trend === 'down' ? '▼' : '─'} {province.growth > 0 ? '+' : ''}{province.growth}٪
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 2 }}>میانگین قیمت</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{province.avgPriceLabel}</div>
                    <div style={{ fontSize: 10, color: 'var(--faint)' }}>میلیون/متر</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 2 }}>آگهی فعال</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{province.listings.toLocaleString('fa-IR')}</div>
                    <div style={{ fontSize: 10, color: 'var(--faint)' }}>فایل</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 2 }}>جمعیت</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{province.population}</div>
                    <div style={{ fontSize: 10, color: 'var(--faint)' }}>نفر</div>
                  </div>
                </div>

                {/* Mini Price Bar */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 6 }}>روند قیمت ۶ ماه اخیر</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
                    {province.barData.map((val, i) => {
                      const max = Math.max(...province.barData)
                      const pct = (val / max) * 100
                      const isLast = i === province.barData.length - 1
                      return (
                        <div
                          key={i}
                          style={{
                            flex: 1, borderRadius: '3px 3px 0 0',
                            height: `${pct}%`,
                            background: isLast ? 'linear-gradient(to top, var(--gold), var(--gold2))' : 'var(--goldDim)',
                            transition: '.2s',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>

                {isSelected && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--goldDim)', borderRadius: 10, fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                    ✦ برای مشاهده شهرها اسکرول کنید
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* City Drill-down */}
        {selectedProvince && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 20, padding: '28px', marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, marginBottom: 6 }}>✦ تحلیل استان</div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>شهرهای استان {selectedProvince.name}</h2>
              </div>
              <button
                onClick={() => setSelectedProvince(null)}
                style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}
              >×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {cities.map(city => (
                <div key={city.name} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{city.name}</div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10,
                      background: city.growth >= 0 ? 'rgba(95,217,138,0.12)' : 'rgba(231,101,74,0.12)',
                      color: city.growth >= 0 ? '#5fd98a' : '#e7674a',
                    }}>
                      {city.growth > 0 ? '▲ +' : '▼ '}{city.growth}٪
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--faint)' }}>میانگین قیمت</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', marginTop: 2 }}>{city.avgPrice}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--faint)' }}>آگهی فعال</div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{city.listings.toLocaleString('fa-IR')}</div>
                    </div>
                  </div>
                  <Link href="/search" style={{ display: 'block', marginTop: 14, padding: '8px 0', textAlign: 'center', background: 'var(--goldDim)', color: 'var(--gold)', borderRadius: 9, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    مشاهده آگهی‌ها
                  </Link>
                </div>
              ))}
            </div>

            {/* Province Stats Bar */}
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>کل آگهی‌های استان</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{selectedProvince.listings.toLocaleString('fa-IR')}</div>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>رشد سالانه</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: selectedProvince.growth >= 0 ? '#5fd98a' : '#e7674a' }}>
                  {selectedProvince.growth > 0 ? '+' : ''}{selectedProvince.growth}٪
                </div>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>میانگین قیمت هر متر</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{selectedProvince.avgPriceLabel}</div>
              </div>
            </div>
          </div>
        )}

        {/* Market Comparison Chart */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 28 }}>
          <h3 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 800 }}>مقایسه قیمت میانگین استان‌ها (میلیون تومان/متر)</h3>
          <BarChart
            data={provinces.map(p => ({ value: p.avgPrice, label: p.name }))}
            height={200}
            highlightLast={false}
          />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'linear-gradient(to top, var(--gold), var(--gold2))' }} />
              استان منتخب
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--goldDim)' }} />
              سایر استان‌ها
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
