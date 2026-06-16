'use client'
import { useState } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

type View = 'dashboard' | 'units' | 'sales' | 'investors'

type UnitStatus = 'sold' | 'reserved' | 'available'

interface Unit {
  id: string
  floor: number
  unit: number
  size: number
  price: string
  status: UnitStatus
  buyer?: string
}

const generateUnits = (): Unit[] => {
  const units: Unit[] = []
  const statuses: UnitStatus[] = ['sold', 'sold', 'sold', 'reserved', 'available', 'sold', 'reserved', 'sold']
  const buyers = ['علی رضایی', 'مریم احمدی', 'حسین موسوی', 'فاطمه کریمی', 'محمد نجفی', 'زهرا صادقی']
  let bi = 0
  for (let floor = 6; floor >= 1; floor--) {
    for (let u = 1; u <= 8; u++) {
      const idx = (floor + u) % 8
      const st = statuses[idx]
      units.push({
        id: `${floor}${String(u).padStart(2, '0')}`,
        floor,
        unit: u,
        size: 85 + ((floor * u) % 60),
        price: `${(floor * 2 + u * 3 + 8).toFixed(0)}`,
        status: st,
        buyer: st !== 'available' ? buyers[bi++ % buyers.length] : undefined,
      })
    }
  }
  return units
}

const ALL_UNITS = generateUnits()

const salesData = [
  { id: '۶۰۱', buyer: 'علی رضایی', type: 'اقساطی', amount: '۱۴ م.د', progress: 72 },
  { id: '۵۰۳', buyer: 'مریم احمدی', type: 'نقدی', amount: '۱۸ م.د', progress: 100 },
  { id: '۴۰۲', buyer: 'حسین موسوی', type: 'اقساطی', amount: '۱۲ م.د', progress: 45 },
  { id: '۳۰۷', buyer: 'فاطمه کریمی', type: 'نقدی', amount: '۱۶ م.د', progress: 100 },
  { id: '۲۰۴', buyer: 'محمد نجفی', type: 'اقساطی', amount: '۱۱ م.د', progress: 30 },
  { id: '۱۰۸', buyer: 'زهرا صادقی', type: 'نقدی', amount: '۹ م.د', progress: 100 },
  { id: '۵۰۶', buyer: 'رضا حسینی', type: 'اقساطی', amount: '۱۵ م.د', progress: 60 },
  { id: '۴۰۱', buyer: 'سارا محمدی', type: 'اقساطی', amount: '۱۳ م.د', progress: 85 },
]

const investorsData = [
  { name: 'شرکت عمران آریا', share: 40, invested: '۲۸۰ م.د', return: '۳۴۲ م.د', color: 'var(--gold)' },
  { name: 'سرمایه‌گذاری پارس', share: 30, invested: '۲۱۰ م.د', return: '۲۵۷ م.د', color: '#60a5fa' },
  { name: 'صندوق توسعه مسکن', share: 20, invested: '۱۴۰ م.د', return: '۱۷۱ م.د', color: '#34d399' },
  { name: 'سرمایه‌گذاران خصوصی', share: 10, invested: '۷۰ م.د', return: '۸۶ م.د', color: '#f87171' },
]

const milestones = [
  { label: 'پی‌سازی', status: 'done' },
  { label: 'اسکلت', status: 'done' },
  { label: 'نازک‌کاری', status: 'active' },
  { label: 'تأسیسات', status: 'pending' },
  { label: 'تحویل', status: 'future' },
]

const barData = [
  { month: 'دی', value: 18, max: 35 },
  { month: 'بهمن', value: 24, max: 35 },
  { month: 'اسفند', value: 31, max: 35 },
  { month: 'فروردین', value: 28, max: 35 },
  { month: 'اردیبهشت', value: 22, max: 35 },
  { month: 'خرداد', value: 19, max: 35 },
]

const statusColor: Record<UnitStatus, string> = {
  sold: '#22c55e',
  reserved: '#f97316',
  available: 'var(--gold)',
}

const statusLabel: Record<UnitStatus, string> = {
  sold: 'فروخته‌شده',
  reserved: 'رزرو',
  available: 'موجود',
}

export default function BuilderPage() {
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)

  const navItems: { id: View; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'داشبورد', icon: '◈' },
    { id: 'units', label: 'واحدها', icon: '⊞' },
    { id: 'sales', label: 'فروش', icon: '◎' },
    { id: 'investors', label: 'سرمایه‌گذاران', icon: '◆' },
  ]

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Vazirmatn, Tahoma, sans-serif' }}>
      <Nav />

      {/* Page wrapper */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 120px)', position: 'relative' }}>

        {/* ── SIDEBAR ── */}
        <aside className="mju-side" style={{
          width: 240,
          minHeight: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          flexShrink: 0,
          zIndex: 10,
        }}>
          {/* Logo */}
          <div style={{ padding: '28px 20px 24px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38,
                background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: '#000', fontWeight: 700,
                transform: 'rotate(45deg)',
                flexShrink: 0,
              }}>
                <span style={{ transform: 'rotate(-45deg)', display: 'block' }}>م</span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', letterSpacing: '-0.3px' }}>ملک‌جت</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>میز کار سازنده</div>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ padding: '12px 12px', flex: 1 }}>
            {navItems.map(item => {
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 14px',
                    marginBottom: 4,
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive ? 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))' : 'transparent',
                    color: isActive ? 'var(--gold)' : 'var(--muted)',
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'right',
                    transition: 'all 0.2s',
                    boxShadow: isActive ? 'inset 0 0 0 1px rgba(212,175,55,0.25)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  <span className="mju-sidelabel">{item.label}</span>
                  {isActive && <span style={{ marginRight: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />}
                </button>
              )
            })}
          </nav>

          {/* Construction progress widget */}
          <div style={{
            margin: 12,
            padding: '16px',
            background: 'rgba(212,175,55,0.06)',
            borderRadius: 12,
            border: '1px solid rgba(212,175,55,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>پیشرفت ساخت</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>۶۸٪</span>
            </div>
            <div style={{ height: 6, background: 'var(--line)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%',
                width: '68%',
                background: 'linear-gradient(90deg, var(--gold2), var(--gold))',
                borderRadius: 99,
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>فاز ۲ — نازک‌کاری</div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Topbar */}
          <div style={{
            padding: '16px 28px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                padding: '8px 16px',
                background: 'var(--bg2)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}>
                <span style={{ color: 'var(--gold)', fontSize: 12 }}>◆</span>
                پروژه برج آرین · سعادت‌آباد
                <span style={{ color: 'var(--muted)', fontSize: 11, marginRight: 4 }}>▾</span>
              </div>
              <div style={{
                padding: '6px 12px',
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 8,
                fontSize: 12,
                color: '#22c55e',
              }}>در حال ساخت</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>۱۴۰۳/۰۳/۲۵</div>
              <div style={{
                width: 34, height: 34,
                background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#000',
                cursor: 'pointer',
              }}>س</div>
            </div>
          </div>

          {/* View content */}
          <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>

            {/* ══ DASHBOARD VIEW ══ */}
            {activeView === 'dashboard' && (
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: 'var(--text)' }}>داشبورد پروژه</h1>

                {/* KPI cards */}
                <div className="mju-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                  {[
                    { label: 'فروخته‌شده', value: '۱۴۲', unit: 'واحد', color: '#22c55e', icon: '✓' },
                    { label: 'رزرو', value: '۲۴', unit: 'واحد', color: '#f97316', icon: '⏸' },
                    { label: 'موجود', value: '۱۶', unit: 'واحد', color: 'var(--gold)', icon: '◎' },
                    { label: 'پیش‌فروش', value: '۱٬۸۴۰', unit: 'م.د', color: '#60a5fa', icon: '◈' },
                  ].map(kpi => (
                    <div key={kpi.label} style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 14,
                      padding: '20px 18px',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        position: 'absolute', top: 0, right: 0,
                        width: 80, height: 80,
                        background: `radial-gradient(circle at top right, ${kpi.color}18, transparent)`,
                      }} />
                      <div style={{ fontSize: 22, color: kpi.color, marginBottom: 10, fontWeight: 300 }}>{kpi.icon}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>
                        {kpi.value}
                        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', marginRight: 4 }}>{kpi.unit}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{kpi.label}</div>
                    </div>
                  ))}
                </div>

                {/* Charts + Timeline row */}
                <div className="mju-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                  {/* Bar chart */}
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: '22px',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>فروش ماهانه (واحد)</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
                      {barData.map((d, i) => (
                        <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{d.value}</div>
                          <div style={{
                            width: '100%',
                            height: `${(d.value / d.max) * 100}%`,
                            background: i === 2
                              ? 'linear-gradient(180deg, var(--gold), var(--gold2))'
                              : 'linear-gradient(180deg, rgba(212,175,55,0.5), rgba(212,175,55,0.2))',
                            borderRadius: '4px 4px 2px 2px',
                            transition: 'opacity 0.2s',
                            minHeight: 4,
                          }} />
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{d.month}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Milestone timeline */}
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: '22px',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 22 }}>نقاط عطف ساخت</div>
                    <div style={{ position: 'relative' }}>
                      {/* Connecting line */}
                      <div style={{
                        position: 'absolute',
                        top: 14, right: 14,
                        width: 2,
                        height: 'calc(100% - 28px)',
                        background: 'var(--line)',
                        zIndex: 0,
                      }} />
                      {milestones.map((m, i) => {
                        const isDone = m.status === 'done'
                        const isActive = m.status === 'active'
                        const isPending = m.status === 'pending'
                        const dotColor = isDone ? '#22c55e' : isActive ? 'var(--gold)' : 'var(--line2)'
                        return (
                          <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: i < milestones.length - 1 ? 18 : 0, position: 'relative', zIndex: 1 }}>
                            <div style={{
                              width: 28, height: 28,
                              borderRadius: '50%',
                              background: isDone ? 'rgba(34,197,94,0.15)' : isActive ? 'rgba(212,175,55,0.15)' : 'var(--bg2)',
                              border: `2px solid ${dotColor}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: dotColor,
                              flexShrink: 0,
                              boxShadow: isActive ? '0 0 12px rgba(212,175,55,0.4)' : 'none',
                              animation: isActive ? 'pulse 2s infinite' : 'none',
                            }}>
                              {isDone ? '✓' : isActive ? '●' : '○'}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: isDone ? 500 : isActive ? 700 : 400, color: isDone ? 'var(--muted)' : isActive ? 'var(--gold)' : isPending ? 'var(--text)' : 'var(--faint)' }}>
                                {m.label}
                              </div>
                              {isActive && (
                                <div style={{ marginTop: 4, height: 3, width: 100, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: '68%', background: 'var(--gold)', borderRadius: 99 }} />
                                </div>
                              )}
                            </div>
                            {isDone && <span style={{ marginRight: 'auto', fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 99 }}>تکمیل‌شده</span>}
                            {isActive && <span style={{ marginRight: 'auto', fontSize: 11, color: 'var(--gold)', background: 'rgba(212,175,55,0.1)', padding: '2px 8px', borderRadius: 99 }}>در جریان</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══ UNITS VIEW ══ */}
            {activeView === 'units' && (
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>مدیریت واحدها</h1>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>برج آرین · ۶ طبقه · ۴۸ واحد</div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                  {(['sold', 'reserved', 'available'] as UnitStatus[]).map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: statusColor[s] }} />
                      {statusLabel[s]}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 20 }}>
                  {/* Floor grid */}
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: '22px',
                    flex: 1,
                  }}>
                    {/* Column headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(8, 1fr)', gap: 6, marginBottom: 8 }}>
                      <div />
                      {Array.from({ length: 8 }, (_, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>واحد {i + 1}</div>
                      ))}
                    </div>
                    {Array.from({ length: 6 }, (_, fi) => {
                      const floor = 6 - fi
                      const floorUnits = ALL_UNITS.filter(u => u.floor === floor)
                      return (
                        <div key={floor} style={{ display: 'grid', gridTemplateColumns: '56px repeat(8, 1fr)', gap: 6, marginBottom: 6 }}>
                          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: 8 }}>
                            طبقه {floor}
                          </div>
                          {floorUnits.map(unit => {
                            const isSelected = selectedUnit?.id === unit.id
                            return (
                              <button
                                key={unit.id}
                                onClick={() => setSelectedUnit(isSelected ? null : unit)}
                                style={{
                                  height: 40,
                                  borderRadius: 8,
                                  border: isSelected ? `2px solid ${statusColor[unit.status]}` : '1px solid transparent',
                                  background: isSelected
                                    ? `${statusColor[unit.status]}30`
                                    : `${statusColor[unit.status]}22`,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: statusColor[unit.status],
                                  transition: 'all 0.15s',
                                  boxShadow: isSelected ? `0 0 8px ${statusColor[unit.status]}44` : 'none',
                                }}
                                title={`واحد ${unit.id}`}
                              >
                                {unit.id}
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>

                  {/* Unit detail panel */}
                  <div style={{
                    width: 240,
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: '22px',
                    flexShrink: 0,
                  }}>
                    {selectedUnit ? (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>واحد {selectedUnit.id}</span>
                          <span style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: `${statusColor[selectedUnit.status]}20`,
                            color: statusColor[selectedUnit.status],
                          }}>{statusLabel[selectedUnit.status]}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {[
                            { label: 'طبقه', value: `طبقه ${selectedUnit.floor}` },
                            { label: 'متراژ', value: `${selectedUnit.size} م²` },
                            { label: 'قیمت', value: `${selectedUnit.price} م.د` },
                            { label: 'خریدار', value: selectedUnit.buyer || '—' },
                          ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                              <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                        {selectedUnit.status === 'available' && (
                          <button style={{
                            marginTop: 20,
                            width: '100%',
                            padding: '10px',
                            background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
                            color: '#000',
                            border: 'none',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}>
                            ثبت رزرو
                          </button>
                        )}
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--muted)', paddingTop: 40 }}>
                        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>⊞</div>
                        <div style={{ fontSize: 13 }}>روی یک واحد کلیک کنید</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ SALES VIEW ══ */}
            {activeView === 'sales' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>گزارش فروش</h1>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>برج آرین · ۸ قرارداد فعال</div>
                  </div>
                  <button style={{
                    padding: '9px 18px',
                    background: 'linear-gradient(135deg, var(--gold), var(--gold2))',
                    color: '#000',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                    + قرارداد جدید
                  </button>
                </div>

                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 14,
                  overflow: 'hidden',
                }}>
                  {/* Table header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 100px 100px 200px',
                    padding: '14px 20px',
                    background: 'var(--bg2)',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--muted)',
                  }}>
                    <div>شناسه واحد</div>
                    <div>خریدار</div>
                    <div>نوع</div>
                    <div>مبلغ</div>
                    <div>پیشرفت پرداخت</div>
                  </div>
                  {salesData.map((row, i) => (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 1fr 100px 100px 200px',
                        padding: '16px 20px',
                        borderBottom: i < salesData.length - 1 ? '1px solid var(--line)' : 'none',
                        fontSize: 13,
                        alignItems: 'center',
                        transition: 'background 0.15s',
                        cursor: 'default',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>واحد {row.id}</div>
                      <div style={{ color: 'var(--text)', fontWeight: 500 }}>{row.buyer}</div>
                      <div>
                        <span style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 99,
                          background: row.type === 'نقدی' ? 'rgba(34,197,94,0.12)' : 'rgba(96,165,250,0.12)',
                          color: row.type === 'نقدی' ? '#22c55e' : '#60a5fa',
                        }}>{row.type}</span>
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{row.amount}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${row.progress}%`,
                            background: row.progress === 100
                              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                              : 'linear-gradient(90deg, var(--gold2), var(--gold))',
                            borderRadius: 99,
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 28, textAlign: 'left' }}>{row.progress}٪</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary footer */}
                <div style={{
                  marginTop: 16,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                }}>
                  {[
                    { label: 'مجموع درآمد', value: '۱۰۸ م.د', color: 'var(--gold)' },
                    { label: 'وصول‌شده', value: '۷۲ م.د', color: '#22c55e' },
                    { label: 'مانده', value: '۳۶ م.د', color: '#f87171' },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: '16px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ INVESTORS VIEW ══ */}
            {activeView === 'investors' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>سرمایه‌گذاران</h1>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>سهامداران پروژه برج آرین</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Share breakdown */}
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: '22px',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>تقسیم سهام</div>
                    {investorsData.map(inv => (
                      <div key={inv.name} style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: inv.color, flexShrink: 0 }} />
                            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{inv.name}</span>
                          </div>
                          <span style={{ color: inv.color, fontWeight: 700 }}>{inv.share}٪</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${inv.share}%`,
                            background: inv.color,
                            borderRadius: 99,
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Investor portfolio cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {investorsData.map(inv => (
                      <div key={inv.name} style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 14,
                        padding: '18px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        transition: 'border-color 0.2s',
                        cursor: 'default',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = inv.color)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
                      >
                        <div style={{
                          width: 42, height: 42,
                          borderRadius: 10,
                          background: `${inv.color}20`,
                          border: `1px solid ${inv.color}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, color: inv.color,
                          flexShrink: 0,
                        }}>◆</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{inv.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>سرمایه: {inv.invested}</div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{inv.return}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>بازده پیش‌بینی</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total summary */}
                <div style={{
                  marginTop: 20,
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.03))',
                  border: '1px solid rgba(212,175,55,0.25)',
                  borderRadius: 14,
                  padding: '22px 24px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 20,
                }}>
                  {[
                    { label: 'ارزش کل پروژه', value: '۸۵۶ م.د' },
                    { label: 'سرمایه جذب‌شده', value: '۷۰۰ م.د' },
                    { label: 'بازده پیش‌بینی', value: '۲۲٪' },
                    { label: 'تاریخ تحویل', value: 'اردیبهشت ۱۴۰۴' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      <Footer />

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 6px rgba(212,175,55,0.4); }
          50% { box-shadow: 0 0 16px rgba(212,175,55,0.8); }
        }
      `}</style>
    </div>
  )
}
