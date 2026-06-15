'use client'
import { useState } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { DonutChart } from '@/app/components/Charts'

type Room = {
  id: string
  name: string
  area: number
  x: number
  y: number
  w: number
  h: number
  color: string
  efficiency: number
}

type Suggestion = {
  id: string
  icon: string
  type: 'improve' | 'warn' | 'info'
  title: string
  desc: string
}

type FurnitureItem = {
  room: string
  items: string[]
}

const sampleRooms: Room[] = [
  { id: 'living', name: 'پذیرایی', area: 32, x: 20, y: 20, w: 180, h: 120, color: 'rgba(201,168,76,0.18)', efficiency: 88 },
  { id: 'kitchen', name: 'آشپزخانه', area: 14, x: 200, y: 20, w: 90, h: 80, color: 'rgba(122,168,143,0.2)', efficiency: 75 },
  { id: 'master', name: 'اتاق خواب اصلی', area: 22, x: 20, y: 140, w: 140, h: 100, color: 'rgba(122,143,174,0.2)', efficiency: 82 },
  { id: 'bath1', name: 'سرویس بهداشتی', area: 6, x: 160, y: 140, w: 60, h: 50, color: 'rgba(176,122,138,0.18)', efficiency: 65 },
  { id: 'room2', name: 'اتاق خواب ۲', area: 16, x: 160, y: 190, w: 130, h: 90, color: 'rgba(95,137,217,0.18)', efficiency: 79 },
  { id: 'corridor', name: 'راهرو', area: 8, x: 20, y: 240, w: 140, h: 40, color: 'rgba(150,150,150,0.12)', efficiency: 55 },
  { id: 'balcony', name: 'بالکن', area: 7, x: 200, y: 100, w: 90, h: 40, color: 'rgba(95,217,138,0.15)', efficiency: 70 },
]

const suggestions: Suggestion[] = [
  { id: 's1', icon: '◈', type: 'improve', title: 'بهینه‌سازی راهرو', desc: 'راهرو ۸ متری را با قرارگیری کمد دیواری بهینه کنید و فضای ذخیره‌سازی ایجاد کنید.' },
  { id: 's2', icon: '◰', type: 'improve', title: 'نور طبیعی آشپزخانه', desc: 'پنجره سمت شمال‌شرق می‌تواند نور طبیعی آشپزخانه را تا ۴۰٪ افزایش دهد.' },
  { id: 's3', icon: '▦', type: 'warn', title: 'سرویس بهداشتی کوچک', desc: 'مساحت سرویس (۶ متر) زیر استاندارد است. در صورت امکان ۲ متر به آن اضافه کنید.' },
  { id: 's4', icon: '◴', type: 'info', title: 'تهویه مناسب', desc: 'موقعیت پنجره‌های موجود برای تهویه متقاطع مناسب است. از این مزیت استفاده کنید.' },
  { id: 's5', icon: '◧', type: 'improve', title: 'ادغام فضا', desc: 'حذف دیوار بین پذیرایی و آشپزخانه می‌تواند حس بزرگ‌تری به فضا بدهد.' },
]

const furnitureRecommendations: FurnitureItem[] = [
  { room: 'پذیرایی', items: ['مبل ال‌شکل ۳+۲ نفره', 'میز قهوه گرد', 'قفسه دیواری', 'تلویزیون ۵۵ اینچ'] },
  { room: 'اتاق خواب اصلی', items: ['تخت ۱۶۰×۲۰۰ سانت', 'کمد ۳ درب', 'میز آرایش', 'پاتختی دو طرفه'] },
  { room: 'آشپزخانه', items: ['کابینت L شکل', 'جزیره کوچک ۸۰×۱۲۰', 'هود گنبدی', 'یخچال فریزر فرانسوی'] },
  { room: 'اتاق خواب ۲', items: ['تخت یک‌نفره ۹۰×۲۰۰', 'میز تحریر', 'قفسه کتاب', 'کمد ۲ درب'] },
]

export default function PlanAIPage() {
  const [analyzed, setAnalyzed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [activeExport, setActiveExport] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const overallScore = 7.8
  const totalArea = sampleRooms.reduce((s, r) => s + r.area, 0)

  const startAnalysis = () => {
    setAnalyzing(true)
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          setAnalyzing(false)
          setAnalyzed(true)
          return 100
        }
        return p + 8
      })
    }, 120)
  }

  const handleExport = (format: string) => {
    setActiveExport(format)
    setTimeout(() => setActiveExport(null), 1500)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      {/* Header */}
      <section style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--line)', padding: '48px 24px 40px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, background: 'var(--goldDim)', color: 'var(--gold)', padding: '4px 10px', borderRadius: 20, fontWeight: 700, display: 'inline-block', marginBottom: 12 }}>هوش مصنوعی</div>
              <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-1px' }}>تحلیل نقشه هوشمند ✦</h1>
              <p style={{ color: 'var(--muted)', fontSize: 15, margin: 0 }}>نقشه ملک خود را آپلود کنید تا هوش مصنوعی آن را تحلیل کند</p>
            </div>
            {analyzed && (
              <div style={{ display: 'flex', gap: 10 }}>
                {['PDF', 'PNG', 'JSON'].map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    style={{
                      padding: '9px 18px', borderRadius: 10, border: '1px solid var(--line)',
                      background: activeExport === fmt ? 'rgba(95,217,138,0.15)' : 'var(--surface)',
                      color: activeExport === fmt ? '#5fd98a' : 'var(--text)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
                    }}
                  >
                    {activeExport === fmt ? '✓ دانلود شد' : `دریافت ${fmt}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        {!analyzed ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
            {/* Upload Area */}
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); startAnalysis() }}
                onClick={startAnalysis}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--gold)' : 'var(--line2)'}`,
                  borderRadius: 20,
                  padding: '60px 40px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'var(--goldDim)' : 'var(--surface)',
                  transition: 'all .2s',
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 56, marginBottom: 16, color: dragOver ? 'var(--gold)' : 'var(--faint)' }}>◈</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>آپلود نقشه</h3>
                <p style={{ color: 'var(--muted)', margin: '0 0 20px', fontSize: 14, lineHeight: 1.7 }}>
                  فایل نقشه را اینجا بکشید و رها کنید<br />
                  یا برای انتخاب فایل کلیک کنید
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {['PDF', 'PNG', 'JPG', 'DWG', 'DXF'].map(fmt => (
                    <span key={fmt} style={{ padding: '4px 10px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 7, fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{fmt}</span>
                  ))}
                </div>
                <button style={{ padding: '12px 32px', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                  انتخاب فایل
                </button>
              </div>

              {analyzing && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>در حال تحلیل نقشه...</div>
                  <div style={{ background: 'var(--bg)', borderRadius: 100, height: 8, marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(to left, var(--gold2), var(--gold))', borderRadius: 100, transition: 'width .1s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {progress < 30 ? 'شناسایی اتاق‌ها...' : progress < 60 ? 'محاسبه متراژ...' : progress < 85 ? 'بررسی استانداردها...' : 'آماده‌سازی گزارش...'}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', marginTop: 8 }}>{progress}٪</div>
                </div>
              )}
            </div>

            {/* Info Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 22 }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>قابلیت‌های تحلیل</div>
                {[
                  { icon: '◈', text: 'شناسایی خودکار اتاق‌ها و فضاها' },
                  { icon: '◰', text: 'محاسبه دقیق متراژ هر بخش' },
                  { icon: '◴', text: 'امتیاز بهره‌وری فضا' },
                  { icon: '▦', text: 'پیشنهاد بهینه‌سازی چیدمان' },
                  { icon: '◧', text: 'پیشنهاد مبلمان مناسب' },
                  { icon: '◎', text: 'تحلیل نور طبیعی و تهویه' },
                ].map(item => (
                  <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                    <span style={{ color: 'var(--gold)', fontSize: 15 }}>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 16, padding: 20 }}>
                <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>✦ نکته</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>برای نتیجه بهتر، نقشه با مقیاس مشخص و به‌صورت سیاه و سفید ارسال کنید.</p>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>نمونه نتایج</div>
                {[
                  { label: 'دقت شناسایی اتاق', value: '۹۴٪' },
                  { label: 'میانگین زمان تحلیل', value: '۱۵ ثانیه' },
                  { label: 'نقشه تحلیل‌شده', value: '+۱۲۰٬۰۰۰' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>{s.label}</span>
                    <span style={{ fontWeight: 700 }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Results */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>

              {/* Main Analysis Area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* SVG Floor Plan */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>نقشه تحلیل‌شده</h3>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>برای مشاهده جزئیات هر اتاق کلیک کنید</div>
                    </div>
                    <span style={{ fontSize: 11, background: 'rgba(95,217,138,0.12)', color: '#5fd98a', padding: '4px 10px', borderRadius: 8, fontWeight: 700 }}>✓ تحلیل کامل</span>
                  </div>

                  <svg viewBox="0 0 320 300" style={{ width: '100%', maxHeight: 340, display: 'block', background: 'var(--bg)', borderRadius: 12 }}>
                    {/* Grid */}
                    {Array.from({ length: 16 }, (_, i) => (
                      <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={300} stroke="var(--line)" strokeWidth={0.4} />
                    ))}
                    {Array.from({ length: 15 }, (_, i) => (
                      <line key={`h${i}`} x1={0} y1={i * 20} x2={320} y2={i * 20} stroke="var(--line)" strokeWidth={0.4} />
                    ))}

                    {/* Rooms */}
                    {sampleRooms.map(room => (
                      <g key={room.id} onClick={() => setSelectedRoom(selectedRoom?.id === room.id ? null : room)} style={{ cursor: 'pointer' }}>
                        <rect
                          x={room.x} y={room.y} width={room.w} height={room.h}
                          fill={room.color}
                          stroke={selectedRoom?.id === room.id ? 'var(--gold)' : 'rgba(201,168,76,0.4)'}
                          strokeWidth={selectedRoom?.id === room.id ? 2 : 1}
                          rx={3}
                        />
                        <text
                          x={room.x + room.w / 2}
                          y={room.y + room.h / 2 - 5}
                          textAnchor="middle"
                          fontSize={9}
                          fill="var(--text)"
                          fontFamily="Vazirmatn, sans-serif"
                          fontWeight="600"
                        >{room.name}</text>
                        <text
                          x={room.x + room.w / 2}
                          y={room.y + room.h / 2 + 8}
                          textAnchor="middle"
                          fontSize={8}
                          fill="var(--muted)"
                          fontFamily="Vazirmatn, sans-serif"
                        >{room.area} م²</text>
                      </g>
                    ))}

                    {/* Compass */}
                    <g transform="translate(290, 22)">
                      <circle cx={0} cy={0} r={14} fill="var(--surface)" stroke="var(--line)" strokeWidth={1} />
                      <text x={0} y={-4} textAnchor="middle" fontSize={9} fill="var(--gold)" fontWeight="800">N</text>
                      <text x={0} y={10} textAnchor="middle" fontSize={7} fill="var(--faint)">S</text>
                      <text x={-10} y={4} textAnchor="middle" fontSize={7} fill="var(--faint)">W</text>
                      <text x={10} y={4} textAnchor="middle" fontSize={7} fill="var(--faint)">E</text>
                    </g>
                  </svg>

                  {selectedRoom && (
                    <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--goldDim)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--gold)', marginBottom: 2 }}>{selectedRoom.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>کلیک مجدد برای لغو انتخاب</div>
                      </div>
                      <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                        <div>
                          <div style={{ color: 'var(--faint)', fontSize: 11, marginBottom: 2 }}>مساحت</div>
                          <div style={{ fontWeight: 700 }}>{selectedRoom.area} م²</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--faint)', fontSize: 11, marginBottom: 2 }}>بهره‌وری</div>
                          <div style={{ fontWeight: 700, color: selectedRoom.efficiency >= 80 ? '#5fd98a' : selectedRoom.efficiency >= 65 ? 'var(--gold)' : '#e7674a' }}>
                            {selectedRoom.efficiency}٪
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--faint)', fontSize: 11, marginBottom: 2 }}>ابعاد تقریبی</div>
                          <div style={{ fontWeight: 700, direction: 'ltr' }}>{Math.round(selectedRoom.w / 6)}m × {Math.round(selectedRoom.h / 6)}m</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Room Breakdown */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 24 }}>
                  <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 800 }}>تفکیک فضاها</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {sampleRooms.map(room => (
                      <div
                        key={room.id}
                        onClick={() => setSelectedRoom(selectedRoom?.id === room.id ? null : room)}
                        style={{
                          padding: '14px 16px',
                          background: selectedRoom?.id === room.id ? 'var(--goldDim)' : 'var(--bg)',
                          border: `1px solid ${selectedRoom?.id === room.id ? 'var(--gold)' : 'var(--line)'}`,
                          borderRadius: 12, cursor: 'pointer', transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{room.name}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{room.area} م²</div>
                        </div>
                        <div style={{ background: 'var(--surface)', borderRadius: 100, height: 5, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${room.efficiency}%`,
                            background: room.efficiency >= 80 ? 'linear-gradient(to left, #5fd98a, #3db87a)' : room.efficiency >= 65 ? 'linear-gradient(to left, var(--gold2), var(--gold))' : 'linear-gradient(to left, #e7a14a, #e7674a)',
                            borderRadius: 100,
                          }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4 }}>بهره‌وری: {room.efficiency}٪</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Furniture Recommendations */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 24 }}>
                  <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 800 }}>پیشنهاد مبلمان</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                    {furnitureRecommendations.map(f => (
                      <div key={f.room} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: 'var(--gold)' }}>◈ {f.room}</div>
                        {f.items.map(item => (
                          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5, color: 'var(--text)' }}>
                            <span style={{ color: 'var(--faint)', fontSize: 9 }}>▸</span>
                            {item}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Side Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Score */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 16 }}>امتیاز بهره‌وری فضا</div>
                  <DonutChart value={overallScore} max={10} size={110} label="/۱۰" />
                  <div style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    نقشه شما نسبت به میانگین بازار <span style={{ color: '#5fd98a', fontWeight: 700 }}>۱۵٪ بهتر</span> است
                  </div>
                </div>

                {/* Stats */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: 'var(--muted)' }}>آمار کلی نقشه</div>
                  {[
                    { label: 'متراژ کل', value: `${totalArea} م²` },
                    { label: 'تعداد اتاق خواب', value: '۲ اتاق' },
                    { label: 'سرویس‌های بهداشتی', value: '۱ سرویس' },
                    { label: 'نسبت پذیرایی', value: `${Math.round((32 / totalArea) * 100)}٪` },
                    { label: 'فضای تلف‌شده', value: `~${Math.round(totalArea * 0.08)} م²` },
                  ].map(stat => (
                    <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>{stat.label}</span>
                      <span style={{ fontWeight: 700 }}>{stat.value}</span>
                    </div>
                  ))}
                </div>

                {/* Suggestions */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>پیشنهادها</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {suggestions.map(s => (
                      <div
                        key={s.id}
                        style={{
                          padding: '12px 14px', borderRadius: 12,
                          background: s.type === 'warn' ? 'rgba(231,161,74,0.08)' : s.type === 'improve' ? 'rgba(95,217,138,0.07)' : 'rgba(122,143,174,0.08)',
                          border: `1px solid ${s.type === 'warn' ? 'rgba(231,161,74,0.25)' : s.type === 'improve' ? 'rgba(95,217,138,0.2)' : 'rgba(122,143,174,0.2)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: s.type === 'warn' ? '#e7a14a' : s.type === 'improve' ? '#5fd98a' : '#7a8fae' }}>{s.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: s.type === 'warn' ? '#e7a14a' : s.type === 'improve' ? '#5fd98a' : '#7a8fae' }}>{s.title}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{s.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export */}
                <div style={{ background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)', marginBottom: 10 }}>✦ خروجی گزارش</div>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>گزارش کامل تحلیل نقشه شامل تمام پیشنهادها را دریافت کنید.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['PDF', 'PNG'].map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => handleExport(fmt)}
                        style={{
                          flex: 1, padding: '9px 0',
                          background: activeExport === fmt ? '#5fd98a' : 'linear-gradient(140deg,var(--gold2),var(--gold))',
                          color: activeExport === fmt ? '#fff' : '#16140f',
                          border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all .2s',
                        }}
                      >
                        {activeExport === fmt ? '✓ دانلود' : fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => { setAnalyzed(false); setProgress(0) }}
                  style={{ padding: '11px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  آپلود نقشه جدید
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
