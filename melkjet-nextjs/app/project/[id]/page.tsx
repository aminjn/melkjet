'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Unit { type: string; size: string; floor: string; price: string; status: 'available' | 'sold' | 'reserved' }
interface Milestone { label: string; date: string; done: boolean; active: boolean }
interface Amenity { ic: string; l: string }
interface FloorPlan { label: string; rooms: string; size: string }
interface Review { n: string; r: string; av: string; t: string }
interface SimilarProject { title: string; area: string; price: string; status: string; bg: string }
interface DevProfile { name: string; logo: string; projects: string; delivered: string; rating: string; since: string }

interface Project {
  title: string; developer: string; location: string; cover: string; devLogo: string
  status: string; statusColor: string; totalUnits: number; floors: number
  startDate: string; deliveryDate: string; priceFrom: string; priceTo: string; yieldPct: string
  progress: number; aiSummary: string; riskScore: number; riskLabel: string; riskColor: string
  gallery: { label: string; bg: string }[]
  units: Unit[]
  milestones: Milestone[]
  amenities: Amenity[]
  floorPlans: FloorPlan[]
  similar: SimilarProject[]
  reviews: Review[]
  devProfile: DevProfile
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const projects: Record<string, Project> = {
  '1': {
    title: 'برج لوکس آرین', developer: 'گروه ساختمانی آرین', location: 'سعادت‌آباد، بلوار دریا',
    cover: 'linear-gradient(135deg,#1a2535,#0d1520)', devLogo: 'آ',
    status: 'پیش‌فروش', statusColor: '#c9a96a', totalUnits: 182, floors: 18,
    startDate: 'فروردین ۱۴۰۱', deliveryDate: 'اسفند ۱۴۰۵', priceFrom: '۱۴ میلیارد', priceTo: '۸۵ میلیارد', yieldPct: '۳۸٪',
    progress: 75,
    aiSummary: 'این پروژه با پیشرفت فیزیکی ۷۵ درصد و تأخیر احتمالی صفر روزه، در وضعیت بسیار مطلوبی قرار دارد. قیمت هر متر مربع ۱۸٪ کمتر از میانگین منطقه سعادت‌آباد است که نشان‌دهنده فرصت سرمایه‌گذاری مناسب است. سازنده سابقه ۰ پرونده ناتمام در ۲۰ سال دارد.',
    riskScore: 82, riskLabel: 'ریسک پایین', riskColor: '#5fd98a',
    gallery: [
      { label: 'نمای بیرونی', bg: 'linear-gradient(135deg,#1a2535,#0d1520)' },
      { label: 'لابی', bg: 'linear-gradient(135deg,#2a1a35,#150d20)' },
      { label: 'آپارتمان نمونه', bg: 'linear-gradient(135deg,#1a3525,#0d2015)' },
      { label: 'روف‌گاردن', bg: 'linear-gradient(135deg,#35251a,#20150d)' },
      { label: 'استخر', bg: 'linear-gradient(135deg,#1a2a35,#0d1520)' },
      { label: 'پارکینگ', bg: 'linear-gradient(135deg,#251a35,#150d20)' },
    ],
    units: [
      { type: 'استودیو', size: '۵۵ م', floor: '۲–۵', price: 'از ۱۴ م', status: 'available' },
      { type: 'یک‌خوابه', size: '۸۵ م', floor: '۳–۱۰', price: 'از ۲۲ م', status: 'available' },
      { type: 'دوخوابه', size: '۱۲۰ م', floor: '۵–۱۵', price: 'از ۳۸ م', status: 'reserved' },
      { type: 'سه‌خوابه', size: '۱۶۵ م', floor: '۸–۱۶', price: 'از ۵۵ م', status: 'available' },
      { type: 'دوبلکس', size: '۲۲۰ م', floor: '۱۶–۱۷', price: 'از ۷۲ م', status: 'sold' },
      { type: 'پنت‌هاوس', size: '۳۵۰ م', floor: '۱۸', price: 'از ۸۵ م', status: 'reserved' },
    ],
    milestones: [
      { label: 'پی‌ریزی', date: 'تیر ۱۴۰۱', done: true, active: false },
      { label: 'اسکلت', date: 'اسفند ۱۴۰۲', done: true, active: false },
      { label: 'سفت‌کاری', date: 'شهریور ۱۴۰۳', done: true, active: false },
      { label: 'نازک‌کاری', date: 'مهر ۱۴۰۴', done: false, active: true },
      { label: 'تحویل', date: 'اسفند ۱۴۰۵', done: false, active: false },
    ],
    amenities: [
      { ic: '🏊', l: 'استخر سرپوشیده' }, { ic: '🧖', l: 'سونا و جکوزی' },
      { ic: '💪', l: 'باشگاه بدنسازی' }, { ic: '🏓', l: 'سالن بازی' },
      { ic: '🌿', l: 'روف‌گاردن' }, { ic: '🚗', l: 'پارکینگ هوشمند' },
      { ic: '🔐', l: 'امنیت ۲۴ ساعته' }, { ic: '🛎', l: 'نگهبانی و لابی' },
      { ic: '⚡', l: 'پنل خورشیدی' }, { ic: '📡', l: 'خانه هوشمند' },
      { ic: '🌐', l: 'اینترنت پرسرعت' }, { ic: '🐾', l: 'پارک حیوانات' },
    ],
    floorPlans: [
      { label: 'استودیو', rooms: '۱ اتاق', size: '۵۵ م²' },
      { label: 'یک‌خوابه', rooms: '۲ اتاق', size: '۸۵ م²' },
      { label: 'دوخوابه', rooms: '۳ اتاق', size: '۱۲۰ م²' },
      { label: 'سه‌خوابه', rooms: '۴ اتاق', size: '۱۶۵ م²' },
    ],
    similar: [
      { title: 'برج الماس', area: 'شهرک غرب', price: 'از ۱۸ م', status: 'پیش‌فروش', bg: 'linear-gradient(135deg,#2a3545,#1a2535)' },
      { title: 'مجتمع صدف', area: 'سعادت‌آباد', price: 'از ۱۵ م', status: 'در حال ساخت', bg: 'linear-gradient(135deg,#352a45,#201535)' },
      { title: 'رزیدنس پارک', area: 'ولنجک', price: 'از ۲۵ م', status: 'تحویل آماده', bg: 'linear-gradient(135deg,#2a4535,#153520)' },
    ],
    reviews: [
      { n: 'محسن طاهری', r: '۵٫۰', av: 'linear-gradient(135deg,#5b9bd5,#2f5f8a)', t: 'واحد خریدم کاملاً مطابق مشخصات اعلام‌شده است. کیفیت ساخت عالی.' },
      { n: 'فریبا کریمی', r: '۴٫۸', av: 'linear-gradient(135deg,#c97a9a,#7a4458)', t: 'تیم فروش حرفه‌ای و صادق. هیچ اطلاعات پنهانی وجود نداشت.' },
      { n: 'رضا اسدی', r: '۴٫۷', av: 'linear-gradient(135deg,#7aa88f,#476e58)', t: 'پیشرفت پروژه مطابق جدول زمانی است. راضی از انتخابم.' },
    ],
    devProfile: {
      name: 'گروه ساختمانی آرین', logo: 'آ', projects: '۱۲ پروژه', delivered: '۱٬۸۰۰ واحد', rating: '۴٫۷', since: '۱۳۸۴'
    },
  },
  '2': {
    title: 'مجتمع مسکونی نگین', developer: 'سازنده نگین', location: 'پونک، خیابان اشرفی',
    cover: 'linear-gradient(135deg,#352020,#201515)', devLogo: 'ن',
    status: 'در حال ساخت', statusColor: '#5b9bd5', totalUnits: 96, floors: 12,
    startDate: 'مهر ۱۴۰۲', deliveryDate: 'شهریور ۱۴۰۵', priceFrom: '۹ میلیارد', priceTo: '۴۲ میلیارد', yieldPct: '۳۲٪',
    progress: 48,
    aiSummary: 'پروژه در مرحله سفت‌کاری با ۴۸٪ پیشرفت قرار دارد. زمانبندی مطابق برنامه. قیمت‌ها در محدوده منطقی منطقه پونک است. سازنده سابقه مثبت با ۲ پروژه قبلی تحویل‌شده دارد.',
    riskScore: 64, riskLabel: 'ریسک متوسط', riskColor: '#c9a96a',
    gallery: [
      { label: 'نمای پروژه', bg: 'linear-gradient(135deg,#352020,#201515)' },
      { label: 'لابی', bg: 'linear-gradient(135deg,#203520,#152015)' },
      { label: 'واحد نمونه', bg: 'linear-gradient(135deg,#202035,#151520)' },
      { label: 'محوطه', bg: 'linear-gradient(135deg,#352035,#201520)' },
      { label: 'سقف', bg: 'linear-gradient(135deg,#203530,#152020)' },
      { label: 'زیرزمین', bg: 'linear-gradient(135deg,#252525,#151515)' },
    ],
    units: [
      { type: 'یک‌خوابه', size: '۷۵ م', floor: '۲–۶', price: 'از ۹ م', status: 'available' },
      { type: 'دوخوابه', size: '۱۱۰ م', floor: '۴–۱۰', price: 'از ۱۸ م', status: 'available' },
      { type: 'سه‌خوابه', size: '۱۵۰ م', floor: '۷–۱۲', price: 'از ۳۲ م', status: 'reserved' },
      { type: 'پنت‌هاوس', size: '۲۸۰ م', floor: '۱۲', price: 'از ۴۲ م', status: 'available' },
    ],
    milestones: [
      { label: 'پی‌ریزی', date: 'دی ۱۴۰۲', done: true, active: false },
      { label: 'اسکلت', date: 'شهریور ۱۴۰۳', done: true, active: false },
      { label: 'سفت‌کاری', date: 'اسفند ۱۴۰۴', done: false, active: true },
      { label: 'نازک‌کاری', date: 'خرداد ۱۴۰۵', done: false, active: false },
      { label: 'تحویل', date: 'شهریور ۱۴۰۵', done: false, active: false },
    ],
    amenities: [
      { ic: '🏋', l: 'باشگاه' }, { ic: '🌿', l: 'فضای سبز' },
      { ic: '🚗', l: 'پارکینگ' }, { ic: '🔐', l: 'امنیت' },
      { ic: '📡', l: 'هوشمند' }, { ic: '🐾', l: 'پارک' },
      { ic: '⚡', l: 'پنل خورشیدی' }, { ic: '🛎', l: 'نگهبانی' },
    ],
    floorPlans: [
      { label: 'یک‌خوابه', rooms: '۲ اتاق', size: '۷۵ م²' },
      { label: 'دوخوابه', rooms: '۳ اتاق', size: '۱۱۰ م²' },
      { label: 'سه‌خوابه', rooms: '۴ اتاق', size: '۱۵۰ م²' },
    ],
    similar: [
      { title: 'مجتمع آزادی', area: 'پونک', price: 'از ۱۰ م', status: 'پیش‌فروش', bg: 'linear-gradient(135deg,#2a3545,#1a2535)' },
      { title: 'برج سبز', area: 'جنت‌آباد', price: 'از ۱۲ م', status: 'در حال ساخت', bg: 'linear-gradient(135deg,#2a4535,#153520)' },
      { title: 'رزیدنس شهر', area: 'اشرفی', price: 'از ۸ م', status: 'تحویل آماده', bg: 'linear-gradient(135deg,#35352a,#202015)' },
    ],
    reviews: [
      { n: 'ناهید رضایی', r: '۴٫۶', av: 'linear-gradient(135deg,#9b7ad0,#5e4488)', t: 'سازنده خوش‌قول و پاسخ‌گوست. از انتخابم راضی‌ام.' },
      { n: 'امید نوری', r: '۴٫۵', av: 'linear-gradient(135deg,#c98a4a,#8a5a2e)', t: 'قیمت مناسب در منطقه. پیشرفت هم سر موعد.' },
    ],
    devProfile: {
      name: 'سازنده نگین', logo: 'ن', projects: '۳ پروژه', delivered: '۲۸۰ واحد', rating: '۴٫۵', since: '۱۳۹۵'
    },
  },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RiskGauge({ score, color }: { score: number; color: string }) {
  const r = 40
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75
  const dash = (score / 100) * arc
  const offset = circ * 0.125
  return (
    <svg width="100" height="80" viewBox="0 0 100 80">
      <circle cx="50" cy="55" r={r} fill="none" stroke="var(--line)" strokeWidth="8"
        strokeDasharray={`${arc} ${circ - arc}`} strokeDashoffset={-offset}
        strokeLinecap="round" transform="rotate(0 50 55)" />
      <circle cx="50" cy="55" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="50" y="52" textAnchor="middle" fontSize="16" fontWeight="800" fill={color} fontFamily="Vazirmatn">{score}</text>
      <text x="50" y="66" textAnchor="middle" fontSize="8" fill="var(--faint)" fontFamily="Vazirmatn">امتیاز</text>
    </svg>
  )
}

function MapSVG({ title }: { title: string }) {
  return (
    <svg width="100%" viewBox="0 0 260 160" style={{ display: 'block', borderRadius: 10 }}>
      <rect width="260" height="160" fill="var(--bg2)" rx="10" />
      {[40, 80, 120].map(y => <line key={y} x1="0" y1={y} x2="260" y2={y} stroke="var(--line)" strokeWidth="0.5" />)}
      {[65, 130, 195].map(x => <line key={x} x1={x} y1="0" x2={x} y2="160" stroke="var(--line)" strokeWidth="0.5" />)}
      <circle cx="120" cy="72" r="32" fill="var(--gold)" fillOpacity="0.08" stroke="var(--gold)" strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="120" cy="72" r="8" fill="var(--gold)" fillOpacity="0.3" />
      <circle cx="120" cy="72" r="4" fill="var(--gold)" />
      <line x1="120" y1="72" x2="120" y2="52" stroke="var(--gold)" strokeWidth="2" />
      <rect x="100" y="36" width="40" height="16" rx="5" fill="var(--bg2)" stroke="var(--gold)" strokeWidth="1" />
      <text x="120" y="48" textAnchor="middle" fontSize="8" fill="var(--gold)" fontFamily="Vazirmatn">{title.substring(0, 8)}</text>
      <text x="130" y="152" textAnchor="middle" fontSize="9" fill="var(--faint)" fontFamily="Vazirmatn">موقعیت پروژه روی نقشه</text>
    </svg>
  )
}

function FloorPlanSVG() {
  return (
    <svg width="100%" viewBox="0 0 300 220" style={{ display: 'block' }}>
      <rect width="300" height="220" fill="var(--bg)" />
      <rect x="20" y="20" width="260" height="180" fill="none" stroke="var(--gold)" strokeWidth="1.5" rx="2" />
      <line x1="140" y1="20" x2="140" y2="200" stroke="var(--gold)" strokeWidth="1" />
      <line x1="20" y1="100" x2="140" y2="100" stroke="var(--gold)" strokeWidth="1" />
      <line x1="140" y1="130" x2="300" y2="130" stroke="var(--gold)" strokeWidth="1" />
      <text x="80" y="58" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="Vazirmatn">اتاق خواب اصلی</text>
      <text x="80" y="150" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="Vazirmatn">پذیرایی</text>
      <text x="220" y="76" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="Vazirmatn">آشپزخانه</text>
      <text x="220" y="165" textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="Vazirmatn">اتاق دوم</text>
      <rect x="26" y="26" width="108" height="68" fill="var(--gold)" fillOpacity="0.05" rx="2" />
      <rect x="26" y="106" width="108" height="88" fill="var(--gold)" fillOpacity="0.08" rx="2" />
      <rect x="146" y="26" width="148" height="98" fill="var(--gold)" fillOpacity="0.06" rx="2" />
      <rect x="146" y="136" width="148" height="58" fill="var(--gold)" fillOpacity="0.05" rx="2" />
      <rect x="26" y="26" width="24" height="6" fill="var(--bg)" />
      <path d="M26 26 Q38 26 38 20" fill="none" stroke="var(--gold)" strokeWidth="1" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const params = useParams()
  const id = (params?.id as string) || '1'
  const project = projects[id] || projects['1']

  const [activeImg, setActiveImg] = useState(0)
  const [activePlan, setActivePlan] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState(1)
  const [resName, setResName] = useState('')
  const [resPhone, setResPhone] = useState('')
  const [resUnit, setResUnit] = useState('')
  const [resSent, setResSent] = useState(false)

  const p = project

  const inpSt: React.CSSProperties = {
    width: '100%', border: '1px solid var(--line2)', borderRadius: 11,
    background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit',
    fontSize: 13, padding: '11px 13px', outline: 'none', boxSizing: 'border-box',
  }

  const unitStatusLabel: Record<string, string> = { available: 'موجود', sold: 'فروش رفته', reserved: 'رزرو شده' }
  const unitStatusColor: Record<string, string> = { available: '#5fd98a', sold: '#ff6b6b', reserved: '#c9a96a' }

  const handleReserve = () => {
    if (modalStep < 3) { setModalStep(s => s + 1) }
    else { setResSent(true) }
  }

  return (
    <div dir="rtl" style={{
      '--bg': '#0d0d0f', '--bg2': '#141417', '--surface': '#18181c',
      '--navbg': 'rgba(13,13,15,0.72)', '--line': 'rgba(255,255,255,0.08)',
      '--line2': 'rgba(255,255,255,0.14)', '--text': '#f2f1ee',
      '--muted': '#9a9a98', '--faint': '#6a6a68',
      '--gold': '#c9a96a', '--gold2': '#e0c489', '--goldDim': 'rgba(201,169,106,0.12)',
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
      fontFamily: "'Vazirmatn', system-ui, sans-serif",
    } as React.CSSProperties}>

      <Nav />

      {/* Hero */}
      <div style={{ position: 'relative', height: 320, background: p.cover, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 14px,rgba(255,255,255,0.025) 14px,rgba(255,255,255,0.025) 15px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 40%,rgba(13,13,15,0.9) 100%)' }} />
        <div style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(13,13,15,0.7)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '7px 16px', fontSize: 12.5, fontWeight: 700, color: p.statusColor, border: `1px solid ${p.statusColor}55` }}>● {p.status}</div>
        <div style={{ position: 'absolute', top: 18, left: 18, background: 'rgba(13,13,15,0.7)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '7px 14px', fontSize: 12, color: 'var(--muted)', border: '1px solid var(--line)' }}>رندر پروژه</div>
        <div style={{ position: 'absolute', bottom: 24, right: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontSize: 18, fontWeight: 900 }}>{p.devLogo}</div>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.developer}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,34px)', fontWeight: 900, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>{p.title}</h1>
          <div style={{ marginTop: 8, fontSize: 13.5, color: 'rgba(255,255,255,0.65)' }}>📍 {p.location}</div>
        </div>
      </div>

      {/* Key stats bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[
            { v: String(p.totalUnits), l: 'تعداد واحد', ic: '▦' },
            { v: String(p.floors) + ' طبقه', l: 'ارتفاع برج', ic: '↑' },
            { v: p.deliveryDate, l: 'تحویل', ic: '◷' },
            { v: p.yieldPct, l: 'بازده پیش‌بینی', ic: '↗' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '18px 16px', textAlign: 'center', borderRight: i < 3 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6 }}>{s.ic} {s.l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <main className="mjpr-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 100px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'grid', gap: 22, minWidth: 0 }}>

          {/* Gallery */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ height: 260, background: p.gallery[activeImg]?.bg, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 12px,rgba(255,255,255,0.03) 12px,rgba(255,255,255,0.03) 13px)' }} />
              <div style={{ position: 'absolute', bottom: 14, left: 14, background: 'rgba(13,13,15,0.75)', backdropFilter: 'blur(6px)', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: 'var(--muted)' }}>{p.gallery[activeImg]?.label}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 12, overflowX: 'auto' }}>
              {p.gallery.map((g, i) => (
                <div key={i} onClick={() => setActiveImg(i)} style={{ width: 72, height: 52, flexShrink: 0, borderRadius: 8, background: g.bg, cursor: 'pointer', border: `2px solid ${activeImg === i ? 'var(--gold)' : 'transparent'}`, transition: 'border-color 0.2s', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 8px,rgba(255,255,255,0.03) 8px,rgba(255,255,255,0.03) 9px)' }} />
                </div>
              ))}
            </div>
          </section>

          {/* AI Summary + Risk */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✦</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>تحلیل هوش مصنوعی</span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2 }}>{p.aiSummary}</p>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <RiskGauge score={p.riskScore} color={p.riskColor} />
                <div style={{ fontSize: 12.5, fontWeight: 700, color: p.riskColor, marginTop: 4 }}>{p.riskLabel}</div>
              </div>
            </div>
          </section>

          {/* Construction Progress */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 18 }}>پیشرفت ساخت</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>پیشرفت فیزیکی</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>{p.progress}٪</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', marginBottom: 24 }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${p.progress}%`, background: 'linear-gradient(90deg,var(--gold2),var(--gold))', transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${p.milestones.length},1fr)`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 11, right: 0, left: 0, height: 2, background: 'var(--line)', zIndex: 0 }} />
              {p.milestones.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 999, border: `2px solid ${m.done ? 'var(--gold)' : m.active ? 'var(--gold)' : 'var(--line)'}`,
                    background: m.done ? 'var(--gold)' : m.active ? 'var(--goldDim)' : 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: m.done ? '#16140f' : m.active ? 'var(--gold)' : 'var(--faint)',
                  }}>{m.done ? '✓' : m.active ? '◉' : '○'}</div>
                  <div style={{ fontSize: 11.5, fontWeight: m.active ? 700 : 400, color: m.active ? 'var(--gold)' : m.done ? 'var(--text)' : 'var(--faint)', textAlign: 'center' }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--faint)', textAlign: 'center' }}>{m.date}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Unit Types Table */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>انواع واحدها</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    {['نوع', 'متراژ', 'طبقه', 'قیمت از', 'وضعیت'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.units.map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--text)' }}>{u.type}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--muted)' }}>{u.size}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--muted)' }}>{u.floor}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--gold)', fontWeight: 700 }}>{u.price}</td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, color: unitStatusColor[u.status], background: `${unitStatusColor[u.status]}20`, border: `1px solid ${unitStatusColor[u.status]}44` }}>{unitStatusLabel[u.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Amenities */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>امکانات و تجهیزات</div>
            <div className="mjpr-units" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {p.amenities.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg2)' }}>
                  <span style={{ fontSize: 18 }}>{a.ic}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{a.l}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Floor Plan Viewer */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>نقشه طبقات</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {p.floorPlans.map((fp, i) => (
                <button key={i} onClick={() => setActivePlan(i)} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${activePlan === i ? 'var(--gold)' : 'var(--line)'}`, background: activePlan === i ? 'var(--goldDim)' : 'var(--bg2)', color: activePlan === i ? 'var(--gold)' : 'var(--muted)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', fontWeight: activePlan === i ? 700 : 400 }}>{fp.label}</button>
              ))}
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
              <FloorPlanSVG />
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 12.5, color: 'var(--muted)' }}>
              <span>نوع: <strong style={{ color: 'var(--text)' }}>{p.floorPlans[activePlan]?.label}</strong></span>
              <span>تعداد اتاق: <strong style={{ color: 'var(--text)' }}>{p.floorPlans[activePlan]?.rooms}</strong></span>
              <span>متراژ: <strong style={{ color: 'var(--gold)' }}>{p.floorPlans[activePlan]?.size}</strong></span>
            </div>
          </section>

          {/* Developer Profile */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>پروفایل سازنده</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontSize: 22, fontWeight: 900 }}>{p.devProfile.logo}</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{p.devProfile.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>فعال از {p.devProfile.since}</div>
              </div>
              <div style={{ marginRight: 'auto', display: 'flex', gap: 20 }}>
                {[
                  { v: p.devProfile.projects, l: 'پروژه‌ها' },
                  { v: p.devProfile.delivered, l: 'واحد تحویلی' },
                  { v: `★ ${p.devProfile.rating}`, l: 'امتیاز' },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Reviews */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>نظرات خریداران</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {p.reviews.map((rv, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, padding: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--bg2)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 13, background: rv.av, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>{rv.n.charAt(0)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{rv.n}</span>
                      <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>★ {rv.r}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>{rv.t}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Similar Projects */}
          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>پروژه‌های مشابه</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {p.similar.map((s, i) => (
                <div key={i} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', cursor: 'pointer' }}>
                  <div style={{ height: 88, background: s.bg, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 9px,rgba(255,255,255,0.03) 9px,rgba(255,255,255,0.03) 10px)' }} />
                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(13,13,15,0.75)', color: 'var(--gold)' }}>{s.status}</span>
                  </div>
                  <div style={{ padding: '11px 13px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{s.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 5 }}>📍 {s.area}</div>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>{s.price}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: 'grid', gap: 16, position: 'sticky', top: 80 }}>

          {/* Reservation CTA */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>قیمت شروع از</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)', marginBottom: 4 }}>{p.priceFrom}</div>
            <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 18 }}>تا {p.priceTo} · بازده {p.yieldPct}</div>
            <button onClick={() => { setModalOpen(true); setModalStep(1); setResSent(false) }} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', marginBottom: 9 }}>رزرو واحد</button>
            <button style={{ width: '100%', padding: '12px', borderRadius: 13, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>دریافت مشاوره رایگان</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 11 }}>
              <span style={{ color: 'var(--gold)', fontSize: 16 }}>✦</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>بازده پیش‌بینی‌شده</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#5fd98a', marginTop: 2 }}>{p.yieldPct}</div>
              </div>
            </div>
          </div>

          {/* Timeline summary */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>جدول زمانی</div>
            <div style={{ display: 'grid', gap: 9 }}>
              {[
                { l: 'شروع ساخت', v: p.startDate },
                { l: 'تاریخ تحویل', v: p.deliveryDate },
                { l: 'پیشرفت فعلی', v: `${p.progress}٪` },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--muted)' }}>{item.l}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700 }}>{item.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Developer link */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontSize: 17, fontWeight: 900 }}>{p.devProfile.logo}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.devProfile.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{p.devProfile.projects} · ★ {p.devProfile.rating}</div>
            </div>
            <span style={{ color: 'var(--gold)', fontSize: 14 }}>←</span>
          </div>

          {/* Map */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>موقعیت مکانی</div>
            <MapSVG title={p.title} />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>📍 {p.location}</div>
          </div>

          {/* Trust badges */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>ضمانت‌ها</div>
            {[
              { ic: '✓', l: 'پروانه ساخت معتبر', c: '#5fd98a' },
              { ic: '✓', l: 'ثبت در سامانه ثبت ملک', c: '#5fd98a' },
              { ic: '✓', l: 'قرارداد رسمی پیش‌فروش', c: '#5fd98a' },
              { ic: '✦', l: 'تأیید ملک‌جت', c: 'var(--gold)' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>
                <span style={{ color: b.c, fontWeight: 700, flexShrink: 0 }}>{b.ic}</span>
                {b.l}
              </div>
            ))}
          </div>

          {/* AI Risk badge */}
          <div style={{ background: `${p.riskColor}12`, border: `1px solid ${p.riskColor}44`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <RiskGauge score={p.riskScore} color={p.riskColor} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: p.riskColor }}>{p.riskLabel}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>امتیاز ریسک توسط<br />هوش مصنوعی ملک‌جت</div>
            </div>
          </div>

        </div>
      </main>

      {/* Reservation Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 26, padding: 32, width: '100%', maxWidth: 520 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>رزرو واحد — {p.title}</div>
                {!resSent && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>مرحله {modalStep} از ۳</div>}
              </div>
              <button onClick={() => setModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>✕</button>
            </div>

            {/* Step indicators */}
            {!resSent && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: s <= modalStep ? 'var(--gold)' : 'var(--line)', transition: 'background 0.3s' }} />
                ))}
              </div>
            )}

            {resSent ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: 22, background: 'rgba(95,217,138,0.12)', border: '1px solid rgba(95,217,138,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 28, color: '#5fd98a' }}>✓</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>رزرو با موفقیت ثبت شد!</div>
                <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.8, margin: '0 0 24px' }}>کارشناسان ما در کمتر از ۲۴ ساعت با شما تماس خواهند گرفت و مراحل بعدی را توضیح خواهند داد.</p>
                <button onClick={() => { setModalOpen(false); setModalStep(1); setResSent(false) }} style={{ padding: '12px 32px', borderRadius: 13, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>بستن</button>
              </div>
            ) : modalStep === 1 ? (
              <div style={{ display: 'grid', gap: 13 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>اطلاعات شخصی</div>
                <input value={resName} onChange={e => setResName(e.target.value)} placeholder="نام و نام‌خانوادگی" style={inpSt} />
                <input value={resPhone} onChange={e => setResPhone(e.target.value)} placeholder="شماره موبایل" style={{ ...inpSt, direction: 'ltr' }} />
                <input placeholder="ایمیل (اختیاری)" style={{ ...inpSt, direction: 'ltr' }} />
                <button onClick={handleReserve} disabled={!resName || !resPhone} style={{ padding: '13px', borderRadius: 13, border: 'none', background: resName && resPhone ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--line)', color: resName && resPhone ? '#16140f' : 'var(--faint)', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: resName && resPhone ? 'pointer' : 'default' }}>مرحله بعد ←</button>
              </div>
            ) : modalStep === 2 ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>انتخاب واحد</div>
                <div style={{ display: 'grid', gap: 9, marginBottom: 16 }}>
                  {p.units.filter(u => u.status === 'available').map((u, i) => (
                    <div key={i} onClick={() => setResUnit(u.type)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', border: `1px solid ${resUnit === u.type ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 12, background: resUnit === u.type ? 'var(--goldDim)' : 'var(--bg2)', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{u.type}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{u.size} · طبقه {u.floor}</div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>{u.price}</div>
                        {resUnit === u.type && <div style={{ fontSize: 10.5, color: '#5fd98a', marginTop: 2 }}>✓ انتخاب‌شده</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleReserve} disabled={!resUnit} style={{ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: resUnit ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--line)', color: resUnit ? '#16140f' : 'var(--faint)', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: resUnit ? 'pointer' : 'default' }}>مرحله بعد ←</button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>تأیید نهایی</div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                  {[
                    { l: 'نام', v: resName },
                    { l: 'موبایل', v: resPhone },
                    { l: 'واحد انتخابی', v: resUnit },
                    { l: 'پروژه', v: p.title },
                    { l: 'سازنده', v: p.developer },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ color: 'var(--muted)' }}>{row.l}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 700 }}>{row.v}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 16, lineHeight: 1.7 }}>با کلیک روی «تأیید رزرو» موافقت خود را با شرایط پیش‌فروش اعلام می‌کنید. مبلغ رزرو: ۵۰۰ میلیون تومان.</p>
                <button onClick={handleReserve} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>✓ تأیید رزرو</button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => { setModalOpen(true); setModalStep(1); setResSent(false) }} style={{ position: 'fixed', bottom: 28, left: 28, height: 50, padding: '0 22px', borderRadius: 18, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 6px 28px rgba(201,169,106,0.35)', zIndex: 100 }}>رزرو واحد ✦</button>

      <Footer />
    </div>
  )
}
