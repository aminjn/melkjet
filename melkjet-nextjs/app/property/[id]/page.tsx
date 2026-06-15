'use client'
import { useState } from 'react'
import Nav from '@/app/components/Nav'
import Link from 'next/link'

// ── helpers ──────────────────────────────────────────────────────────────────
function toPersian(n: number | string): string {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
}

function computeMonthly(principal: number, annualRate: number, years: number): number {
  const r = annualRate / 12
  const n = years * 12
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function formatMilliard(n: number): string {
  if (n >= 1_000_000_000) return toPersian((n / 1_000_000_000).toFixed(1)) + ' میلیارد'
  if (n >= 1_000_000) return toPersian((n / 1_000_000).toFixed(0)) + ' میلیون'
  return toPersian(Math.round(n).toLocaleString())
}

// ── static data ───────────────────────────────────────────────────────────────
const gallery = [
  { label: 'نمای کلی',    bg: 'linear-gradient(135deg,#3a3530,#211e1b)' },
  { label: 'آشپزخانه',   bg: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
  { label: 'پذیرایی',    bg: 'linear-gradient(135deg,#34323c,#1e1d23)' },
  { label: 'اتاق خواب',  bg: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
  { label: 'سرویس',      bg: 'linear-gradient(135deg,#3a3630,#221f1b)' },
]

const aiScores = [
  { label: 'سرمایه‌گذاری', value: 8.7 },
  { label: 'محله',          value: 9.2 },
  { label: 'دسترسی',        value: 9.0 },
  { label: 'کیفیت ساخت',   value: 8.5 },
  { label: 'ارزش خرید',    value: 8.8 },
]

const months = ['تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند','فروردین','اردیبهشت','خرداد']
const chartVals = [62,64,65,66,68,68,70,71,73,74,76,78]

const amenities = ['آسانسور','پارکینگ','انباری','کولر','بالکن','پکیج','امنیت ۲۴ساعته','لابی']

const nearby = [
  { icon: '🚇', label: 'مترو',       time: '۶ دقیقه' },
  { icon: '🛍',  label: 'مرکز خرید', time: '۴ دقیقه' },
  { icon: '🏥', label: 'بیمارستان', time: '۹ دقیقه' },
  { icon: '🌳', label: 'پارک',       time: '۷ دقیقه' },
]

const similar = [
  { id:'2', title:'آپارتمان ۱۲۰ متری نوساز',  location:'سعادت‌آباد، تهران', price:'۱۵٫۲ میلیارد', size:'۱۲۰', beds:'۳', bg:'linear-gradient(135deg,#33303a,#1d1b22)' },
  { id:'3', title:'آپارتمان لوکس با ویو',       location:'علامه، تهران',       price:'۱۹٫۵ میلیارد', size:'۱۵۵', beds:'۳', bg:'linear-gradient(135deg,#2c343a,#1a1f23)' },
  { id:'5', title:'واحد نقلی مدرن ۹۸ متر',      location:'سعادت‌آباد، تهران', price:'۸٫۶ میلیارد',  size:'۹۸',  beds:'۲', bg:'linear-gradient(135deg,#34323c,#1e1d23)' },
]

const visitDays = ['شنبه ۱۵ تیر','یکشنبه ۱۶ تیر','دوشنبه ۱۷ تیر','سه‌شنبه ۱۸ تیر','چهارشنبه ۱۹ تیر','پنج‌شنبه ۲۰ تیر','شنبه ۲۲ تیر','یکشنبه ۲۳ تیر']
const visitTimes = ['۹:۰۰','۱۰:۳۰','۱۲:۰۰','۱۴:۰۰','۱۵:۳۰','۱۷:۰۰']

const aiReplies: Record<string, string> = {
  'کیفیت ساخت؟':       'کیفیت ساخت این واحد عالی است. اسکلت بتنی، نمای سنگ ایرانی، کابینت MDF با روکش پلی‌استر. امتیاز ملک‌جت: ۸.۵ از ۱۰.',
  'برای سرمایه‌گذاری؟': 'سعادت‌آباد در ۱۲ ماه اخیر ۲۶٪ رشد قیمت داشته. بازده سرمایه‌گذاری ۳۸٪ در ۲ سال پیش‌بینی می‌شود.',
  'قابل مذاکره؟':       'تا ۵٪ مذاکره امکان‌پذیر است. پیشنهاد اولیه ۱۶٫۹ میلیارد منطقی به نظر می‌رسد.',
}

// ── Score Ring SVG ────────────────────────────────────────────────────────────
function ScoreRing({ value, label }: { value: number; label: string }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const filled = (value / 10) * circ
  const color = value >= 8 ? '#5fd98a' : value >= 6 ? 'var(--gold)' : '#e7a14a'
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      <div style={{ position:'relative', width:48, height:48 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="24" cy="24" r={r} fill="none" stroke="var(--line2)" strokeWidth="3"/>
          <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"/>
        </svg>
        <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color }}>
          {toPersian(value.toFixed(1))}
        </span>
      </div>
      <span style={{ fontSize:11, color:'var(--muted)', textAlign:'center', lineHeight:1.4 }}>{label}</span>
    </div>
  )
}

// ── Visit Modal (4-step) ──────────────────────────────────────────────────────
function VisitModal({ onClose }: { onClose: () => void }) {
  const [step, setStep]       = useState(0)
  const [selDay, setSelDay]   = useState('')
  const [selTime, setSelTime] = useState('')

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}
    >
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(6px)' }}/>
      <div
        style={{ position:'relative', width:'100%', maxWidth:480, background:'var(--surface)', border:'1px solid var(--line2)', borderRadius:24, padding:28, animation:'drop .3s both' }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>رزرو بازدید حضوری</h2>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--line)', background:'var(--bg2)', color:'var(--muted)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {/* step indicator */}
        <div style={{ display:'flex', gap:6, marginBottom:24 }}>
          {['روز','ساعت','تأیید','موفق'].map((s, i) => (
            <div key={s} style={{ flex:1 }}>
              <div style={{ height:3, borderRadius:4, background: i <= step ? 'var(--gold)' : 'var(--line2)', marginBottom:5, transition:'background .3s' }}/>
              <span style={{ fontSize:10, color: i <= step ? 'var(--gold)' : 'var(--faint)', fontWeight:600 }}>{s}</span>
            </div>
          ))}
        </div>

        {/* step 0 – day */}
        {step === 0 && (
          <>
            <p style={{ margin:'0 0 14px', fontSize:13, color:'var(--muted)' }}>روز بازدید را انتخاب کن:</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {visitDays.map(d => (
                <button key={d} onClick={() => setSelDay(d)} style={{
                  padding:'12px 14px', borderRadius:12,
                  border:`1px solid ${selDay === d ? 'var(--gold)' : 'var(--line)'}`,
                  background: selDay === d ? 'var(--goldDim)' : 'var(--bg2)',
                  color: selDay === d ? 'var(--gold)' : 'var(--text)',
                  fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'right'
                }}>{d}</button>
              ))}
            </div>
            <button disabled={!selDay} onClick={() => setStep(1)} style={{
              marginTop:18, width:'100%', height:48, borderRadius:14, border:'none',
              background: selDay ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--line)',
              color: selDay ? '#16140f' : 'var(--faint)',
              fontFamily:'inherit', fontWeight:700, fontSize:15, cursor: selDay ? 'pointer' : 'not-allowed'
            }}>بعدی ←</button>
          </>
        )}

        {/* step 1 – time */}
        {step === 1 && (
          <>
            <p style={{ margin:'0 0 4px', fontSize:13, color:'var(--muted)' }}>ساعت بازدید</p>
            <p style={{ margin:'0 0 16px', fontSize:14, fontWeight:700, color:'var(--text)' }}>{selDay}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {visitTimes.map(t => (
                <button key={t} onClick={() => setSelTime(t)} style={{
                  padding:'14px 0', borderRadius:12,
                  border:`1px solid ${selTime === t ? 'var(--gold)' : 'var(--line)'}`,
                  background: selTime === t ? 'var(--goldDim)' : 'var(--bg2)',
                  color: selTime === t ? 'var(--gold)' : 'var(--text)',
                  fontFamily:'inherit', fontSize:16, fontWeight:700, cursor:'pointer'
                }}>{t}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button onClick={() => setStep(0)} style={{ flex:1, height:48, borderRadius:14, border:'1px solid var(--line)', background:'transparent', color:'var(--muted)', fontFamily:'inherit', fontWeight:600, fontSize:14, cursor:'pointer' }}>← قبلی</button>
              <button disabled={!selTime} onClick={() => setStep(2)} style={{
                flex:2, height:48, borderRadius:14, border:'none',
                background: selTime ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--line)',
                color: selTime ? '#16140f' : 'var(--faint)',
                fontFamily:'inherit', fontWeight:700, fontSize:15, cursor: selTime ? 'pointer' : 'not-allowed'
              }}>بعدی ←</button>
            </div>
          </>
        )}

        {/* step 2 – confirm */}
        {step === 2 && (
          <>
            <p style={{ margin:'0 0 16px', fontSize:14, fontWeight:700, color:'var(--text)' }}>تأیید اطلاعات بازدید</p>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--line)', borderRadius:14, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { l:'ملک',   v:'آپارتمان لوکس نوساز ۱۴۰ متری' },
                { l:'روز',   v:selDay },
                { l:'ساعت',  v:selTime },
                { l:'مشاور', v:'سارا محمدی' },
              ].map(row => (
                <div key={row.l} style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--muted)', fontSize:13 }}>{row.l}</span>
                  <span style={{ color: row.l === 'ساعت' ? 'var(--gold)' : 'var(--text)', fontSize:13, fontWeight:600 }}>{row.v}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button onClick={() => setStep(1)} style={{ flex:1, height:48, borderRadius:14, border:'1px solid var(--line)', background:'transparent', color:'var(--muted)', fontFamily:'inherit', fontWeight:600, fontSize:14, cursor:'pointer' }}>← قبلی</button>
              <button onClick={() => setStep(3)} style={{ flex:2, height:48, borderRadius:14, border:'none', background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', fontWeight:700, fontSize:15, cursor:'pointer' }}>ثبت بازدید ✓</button>
            </div>
          </>
        )}

        {/* step 3 – success */}
        {step === 3 && (
          <div style={{ textAlign:'center', padding:'12px 0' }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(95,217,138,0.15)', border:'2px solid #5fd98a', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:32, animation:'pop .4s both' }}>✓</div>
            <h3 style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:8 }}>بازدید ثبت شد!</h3>
            <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.8 }}>
              {selDay} ساعت {selTime}<br/>سارا محمدی با تو تماس می‌گیرد.
            </p>
            <button onClick={onClose} style={{ marginTop:24, width:'100%', height:48, borderRadius:14, border:'none', background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', fontWeight:700, fontSize:15, cursor:'pointer' }}>بستن</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PropertyDetail() {
  const [activeImg, setActiveImg]   = useState(0)
  const [loanAmount, setLoanAmount] = useState(8_000_000_000)
  const [showModal, setShowModal]   = useState(false)
  const [chatInput, setChatInput]   = useState('')
  const [messages, setMessages]     = useState<{ role:'user'|'ai'; text:string }[]>([
    { role:'ai', text:'سلام! درباره این ملک چه سوالی داری؟ کیفیت ساخت، موقعیت، یا پتانسیل سرمایه‌گذاری؟' }
  ])
  const [typing, setTyping]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [compared, setCompared] = useState(false)
  const [activeChip, setActiveChip] = useState<string|null>(null)

  const monthly   = computeMonthly(loanAmount, 0.18, 20)
  const chartMax  = Math.max(...chartVals)

  function sendMsg(text: string) {
    if (!text.trim()) return
    setMessages(m => [...m, { role:'user', text }])
    setChatInput('')
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(m => [...m, { role:'ai', text: aiReplies[text] ?? 'بر اساس داده‌های موجود، این ملک گزینه‌ی مناسبی برای سرمایه‌گذاری است. اگر سوال دیگری داری بپرس!' }])
    }, 1600)
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', direction:'rtl' }}>
      <Nav />

      {/* ── GALLERY ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth:1280, margin:'0 auto', padding:'28px 24px 0' }}>
        {/* main grid: 2fr + 1fr with 2 stacked thumbs */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gridTemplateRows:'200px 200px', gap:10, borderRadius:20, overflow:'hidden', height:410 }}>
          {/* large main */}
          <div style={{ gridRow:'1/3', position:'relative', background:gallery[activeImg].bg, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.4),transparent 55%)' }}/>
            <div style={{ position:'absolute', top:16, right:16, padding:'6px 13px', borderRadius:999, background:'rgba(201,168,76,0.9)', color:'#16140f', fontSize:12, fontWeight:800 }}>★ ویژه</div>
            <div style={{ position:'absolute', bottom:18, right:20, padding:'5px 12px', borderRadius:999, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)', color:'#fff', fontSize:12, fontWeight:600 }}>
              {gallery[activeImg].label}
            </div>
            <span style={{ fontSize:72, opacity:0.08 }}>🏠</span>
          </div>
          {/* two stacked thumbs */}
          {[1,2].map(i => (
            <div key={i} onClick={() => setActiveImg(i)} style={{
              position:'relative', background:gallery[i].bg, cursor:'pointer', overflow:'hidden',
              display:'flex', alignItems:'center', justifyContent:'center'
            }}>
              {activeImg === i && <div style={{ position:'absolute', inset:0, border:'2.5px solid var(--gold)', borderRadius:0, pointerEvents:'none', zIndex:2 }}/>}
              <div style={{ position:'absolute', bottom:10, right:12, fontSize:11, fontWeight:600, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.5)' }}>{gallery[i].label}</div>
              <span style={{ fontSize:32, opacity:0.08 }}>🏠</span>
            </div>
          ))}
        </div>

        {/* thumbnail strip */}
        <div style={{ display:'flex', gap:10, marginTop:10, paddingBottom:4, overflowX:'auto' }}>
          {gallery.map((g, i) => (
            <button key={i} onClick={() => setActiveImg(i)} style={{
              flexShrink:0, width:88, height:58, borderRadius:10,
              border:`2px solid ${activeImg === i ? 'var(--gold)' : 'transparent'}`,
              background:g.bg, cursor:'pointer', position:'relative', overflow:'hidden', padding:0
            }}>
              {activeImg === i && <div style={{ position:'absolute', inset:0, background:'rgba(201,168,76,0.18)' }}/>}
              <span style={{ position:'absolute', bottom:4, right:0, left:0, textAlign:'center', fontSize:10, fontWeight:600, color: activeImg === i ? 'var(--gold)' : 'rgba(255,255,255,0.75)' }}>{g.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── 2/3 + 1/3 GRID ────────────────────────────────────────────── */}
      <section style={{ maxWidth:1280, margin:'0 auto', padding:'32px 24px 80px', display:'grid', gridTemplateColumns:'2fr 1fr', gap:32, alignItems:'start' }}>

        {/* ══ LEFT COLUMN ══════════════════════════════════════════════ */}
        <div style={{ display:'flex', flexDirection:'column', gap:28 }}>

          {/* 1. Breadcrumb */}
          <nav style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--muted)', flexWrap:'wrap' }}>
            <Link href="/"        style={{ color:'var(--muted)', textDecoration:'none' }}>خانه</Link>
            <span style={{ color:'var(--faint)' }}>›</span>
            <Link href="/search"  style={{ color:'var(--muted)', textDecoration:'none' }}>تهران</Link>
            <span style={{ color:'var(--faint)' }}>›</span>
            <Link href="/neighborhood/saadatabad" style={{ color:'var(--muted)', textDecoration:'none' }}>سعادت‌آباد</Link>
            <span style={{ color:'var(--faint)' }}>›</span>
            <span style={{ color:'var(--text)', fontWeight:600 }}>آپارتمان ۱۴۰ متری</span>
          </nav>

          {/* 2. Title + Price + Per-sqm badge + location */}
          <div>
            <h1 style={{ fontSize:'clamp(22px,3vw,30px)', fontWeight:800, color:'var(--text)', letterSpacing:'-.5px', lineHeight:1.3, marginBottom:14 }}>
              آپارتمان لوکس نوساز ۱۴۰ متری
            </h1>
            <div style={{ display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap', marginBottom:10 }}>
              <span style={{ fontSize:28, fontWeight:900, color:'var(--gold)', letterSpacing:'-.5px' }}>۱۷٫۸ میلیارد</span>
              <span style={{ padding:'4px 12px', borderRadius:999, background:'var(--goldDim)', border:'1px solid var(--gold)', color:'var(--gold)', fontSize:13, fontWeight:700 }}>
                ۱۲۷ میلیون / متر
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:14, color:'var(--muted)' }}>
              <span>📍</span>
              <span>سعادت‌آباد، خیابان علامه شمالی، تهران</span>
            </div>
          </div>

          {/* 3. Facts row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {[
              { icon:'📐', label:'متراژ',   value:'۱۴۰ م²' },
              { icon:'🛏', label:'خواب',    value:'۳'       },
              { icon:'📅', label:'سال ساخت',value:'۱۴۰۲'   },
              { icon:'🏢', label:'طبقه',    value:'۵ از ۸'  },
            ].map(f => (
              <div key={f.label} style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, padding:'16px 12px', textAlign:'center' }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{f.icon}</div>
                <div style={{ fontSize:16, fontWeight:800, color:'var(--text)' }}>{f.value}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{f.label}</div>
              </div>
            ))}
          </div>

          {/* 4. AI Summary card */}
          <div style={{ position:'relative', background:'var(--surface)', border:'1px solid var(--gold)', borderRadius:18, padding:22, overflow:'hidden' }}>
            <div style={{ position:'absolute', inset:0, background:'radial-gradient(500px 200px at 110% -20%,var(--goldDim),transparent 60%)', pointerEvents:'none' }}/>
            <div style={{ position:'relative' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(140deg,var(--gold2),var(--gold))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#16140f', fontWeight:800, flexShrink:0 }}>✦</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--gold)' }}>خلاصه‌ی هوشمند ملک‌جت</div>
                    <div style={{ fontSize:11, color:'var(--faint)', marginTop:1 }}>تحلیل خودکار · بروز شده ۲ ساعت پیش</div>
                  </div>
                </div>
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <div style={{ fontSize:22, fontWeight:900, color:'#5fd98a' }}>۹۴٪</div>
                  <div style={{ fontSize:10, color:'var(--faint)' }}>اطمینان</div>
                </div>
              </div>
              <p style={{ fontSize:14.5, lineHeight:1.9, color:'var(--text)', marginBottom:16 }}>
                این آپارتمان نوساز در یکی از معتبرترین محله‌های شمال غرب تهران، با طراحی مدرن و متریال درجه یک، گزینه‌ای ایده‌آل برای خانواده‌هایی است که کیفیت و موقعیت را در اولویت دارند. قیمت فعلی ۴٪ پایین‌تر از میانگین منطقه است.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#5fd98a', marginBottom:8 }}>✓ مزایا</div>
                  {['نوساز ۱۴۰۲ با سند تک‌برگ','موقعیت عالی نزدیک مترو','کیفیت ساخت بالا و متریال لوکس','بازار پایدار با رشد مستمر'].map(p => (
                    <div key={p} style={{ fontSize:13, color:'var(--text)', lineHeight:1.8 }}>· {p}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#e7a14a', marginBottom:8 }}>⚠ نکات</div>
                  {['قیمت بالاتر از میانگین محله','فضای پارکینگ محدود','ترافیک ساعات اوج'].map(c => (
                    <div key={c} style={{ fontSize:13, color:'var(--text)', lineHeight:1.8 }}>· {c}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 5. AI Scores */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:18, padding:22 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'var(--gold)' }}>✦</span> امتیازات هوشمند ملک‌جت
            </div>
            <div style={{ display:'flex', justifyContent:'space-around', gap:8 }}>
              {aiScores.map(s => <ScoreRing key={s.label} value={s.value} label={s.label}/>)}
            </div>
          </div>

          {/* 6. Price Chart (SVG bar chart) */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:18, padding:22 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>روند قیمت ۱۲ ماه اخیر</div>
              <span style={{ padding:'4px 10px', borderRadius:999, background:'rgba(95,217,138,0.12)', color:'#5fd98a', fontSize:12, fontWeight:700 }}>↑ +۲۶٪</span>
            </div>
            <svg viewBox="0 0 520 110" width="100%" height="110">
              {chartVals.map((v, i) => {
                const colW  = 520 / 12
                const barW  = colW - 10
                const barH  = (v / chartMax) * 88
                const x     = i * colW + 5
                const isLast = i === chartVals.length - 1
                return (
                  <g key={i}>
                    <rect x={x} y={90 - barH} width={barW} height={barH} rx="4"
                      fill={isLast ? 'var(--gold)' : 'var(--goldDim)'}
                      stroke={isLast ? 'var(--gold2)' : 'none'} strokeWidth="1"
                    />
                    <text x={x + barW/2} y={106} textAnchor="middle" fill="var(--faint)" fontSize="8.5" fontFamily="Vazirmatn,sans-serif">
                      {months[i].slice(0,3)}
                    </text>
                  </g>
                )
              })}
            </svg>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:11, color:'var(--faint)' }}>
              <span>تیر ۱۴۰۳</span><span>واحد: میلیون تومان/متر</span><span>خرداد ۱۴۰۴</span>
            </div>
          </div>

          {/* 7. Amenities 2×4 */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:18, padding:22 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:16 }}>امکانات ملک</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {amenities.map(a => (
                <div key={a} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:10, background:'var(--bg2)', border:'1px solid var(--line)' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'#5fd98a', flexShrink:0 }}/>
                  <span style={{ fontSize:12.5, color:'var(--text)' }}>{a}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 8. Nearby */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:18, padding:22 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:16 }}>دسترسی‌های مجاور</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {nearby.map(n => (
                <div key={n.label} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, background:'var(--bg2)', border:'1px solid var(--line)' }}>
                  <span style={{ fontSize:22, flexShrink:0 }}>{n.icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{n.label}</div>
                    <div style={{ fontSize:12, color:'var(--gold)', fontWeight:700, marginTop:2 }}>{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 9. Loan Calculator */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:18, padding:22 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>ماشین‌حساب وام</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:20 }}>نرخ سود ۱۸٪ سالانه · دوره ۲۰ سال</div>
            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:13, color:'var(--muted)' }}>مبلغ وام</span>
                <span style={{ fontSize:15, fontWeight:800, color:'var(--gold)' }}>{formatMilliard(loanAmount)}</span>
              </div>
              <input
                type="range" min={1_000_000_000} max={10_000_000_000} step={100_000_000}
                value={loanAmount}
                onChange={e => setLoanAmount(Number(e.target.value))}
                style={{ width:'100%', accentColor:'var(--gold)', cursor:'pointer', height:4 }}
              />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--faint)' }}>
                <span>۱ میلیارد</span><span>۱۰ میلیارد</span>
              </div>
            </div>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--line2)', borderRadius:14, padding:18, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:6 }}>قسط ماهانه تخمینی</div>
              <div style={{ fontSize:24, fontWeight:900, color:'var(--gold)' }}>{formatMilliard(Math.round(monthly))}</div>
              <div style={{ fontSize:12, color:'var(--faint)', marginTop:4 }}>تومان در ماه</div>
            </div>
          </div>

          {/* 10. Similar Properties */}
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:16 }}>ملک‌های مشابه</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
              {similar.map(p => (
                <Link key={p.id} href={`/property/${p.id}`} style={{ textDecoration:'none', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, overflow:'hidden', display:'block' }}>
                  <div style={{ height:110, background:p.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:28, opacity:0.08 }}>🏠</span>
                  </div>
                  <div style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', lineHeight:1.4, marginBottom:4 }}>{p.title}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:2 }}>{p.location}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:8 }}>{p.size} م · {p.beds} خواب</div>
                    <div style={{ fontSize:14, fontWeight:800, color:'var(--gold)' }}>{p.price}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* ══ RIGHT COLUMN (sticky) ════════════════════════════════════ */}
        <div style={{ position:'sticky', top:90, display:'flex', flexDirection:'column', gap:16 }}>

          {/* Agent card */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:20, padding:22 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#caa86a,#8a6f3e)', border:'2px solid var(--gold)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff', fontWeight:800 }}>س</div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>سارا محمدی</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>مشاور لوکس · ۴٫۹ ★ · ۱۲۴ معامله</div>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:5 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:'#5fd98a', animation:'glow 2s infinite', display:'inline-block' }}/>
                  <span style={{ fontSize:11, color:'#5fd98a' }}>آنلاین</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              style={{ width:'100%', height:48, borderRadius:14, border:'none', background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:10, boxShadow:'0 8px 22px -10px var(--gold)' }}
            >
              درخواست بازدید 📅
            </button>
            <button style={{ width:'100%', height:44, borderRadius:14, border:'1px solid var(--gold)', background:'transparent', color:'var(--gold)', fontFamily:'inherit', fontWeight:700, fontSize:14, cursor:'pointer', marginBottom:16 }}>
              تماس با مشاور ☎
            </button>

            {/* Save / Compare / Share */}
            <div style={{ display:'flex', gap:10 }}>
              {[
                { icon: saved    ? '❤️' : '🤍', label:'ذخیره',  action:() => setSaved(s   => !s),   active:saved    },
                { icon: compared ? '✅' : '⊕',  label:'مقایسه', action:() => setCompared(c => !c), active:compared },
                { icon:'↗',                       label:'اشتراک', action:() => {},                    active:false    },
              ].map(b => (
                <button key={b.label} onClick={b.action} style={{
                  flex:1, height:44, borderRadius:12, cursor:'pointer',
                  border:`1px solid ${b.active ? 'var(--gold)' : 'var(--line)'}`,
                  background: b.active ? 'var(--goldDim)' : 'var(--bg2)',
                  color: b.active ? 'var(--gold)' : 'var(--muted)',
                  fontFamily:'inherit', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2
                }}>
                  <span style={{ fontSize:14 }}>{b.icon}</span>
                  <span style={{ fontSize:10 }}>{b.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Authenticity badge */}
          <div style={{ background:'var(--surface)', border:'1px solid rgba(95,217,138,0.35)', borderRadius:16, padding:16, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(95,217,138,0.13)', border:'1.5px solid #5fd98a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>✓</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#5fd98a' }}>آگهی اصیل تشخیص داده شد</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>احتمال جعلی: کمتر از ۲٪</div>
            </div>
          </div>

          {/* AI Chat panel */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:20, overflow:'hidden' }}>
            {/* panel header */}
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--line)', background:'var(--bg2)', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:30, height:30, borderRadius:9, background:'linear-gradient(140deg,var(--gold2),var(--gold))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#16140f', fontWeight:800, flexShrink:0 }}>✦</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>درباره‌ی این ملک بپرس</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>دستیار هوشمند ملک‌جت</div>
              </div>
            </div>

            {/* message history */}
            <div style={{ padding:'14px 16px', minHeight:140, maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:10 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display:'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end' }}>
                  <div style={{
                    maxWidth:'85%', padding:'9px 13px',
                    borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.role === 'user' ? 'var(--bg2)' : 'var(--goldDim)',
                    border:`1px solid ${m.role === 'user' ? 'var(--line)' : 'var(--gold)'}`,
                    fontSize:12.5, lineHeight:1.7, color:'var(--text)'
                  }}>
                    {m.role === 'ai' && <span style={{ color:'var(--gold)', marginLeft:4 }}>✦ </span>}
                    {m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <div style={{ padding:'10px 16px', borderRadius:'14px 14px 14px 4px', background:'var(--goldDim)', border:'1px solid var(--gold)', display:'flex', gap:4, alignItems:'center' }}>
                    {[0,1,2].map(i => (
                      <span key={i} style={{ width:7, height:7, borderRadius:'50%', background:'var(--gold)', display:'inline-block', animation:`blink 1.2s ${i*0.2}s infinite` }}/>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* quick chips */}
            <div style={{ padding:'0 14px 10px', display:'flex', gap:7, flexWrap:'wrap' }}>
              {['کیفیت ساخت؟','برای سرمایه‌گذاری؟','قابل مذاکره؟'].map(chip => (
                <button key={chip}
                  onClick={() => { setActiveChip(chip); sendMsg(chip) }}
                  style={{
                    padding:'6px 11px', borderRadius:999, cursor:'pointer', fontFamily:'inherit', fontSize:11.5, fontWeight:600,
                    border:`1px solid ${activeChip === chip ? 'var(--gold)' : 'var(--line)'}`,
                    background: activeChip === chip ? 'var(--goldDim)' : 'var(--bg2)',
                    color: activeChip === chip ? 'var(--gold)' : 'var(--muted)'
                  }}
                >{chip}</button>
              ))}
            </div>

            {/* input row */}
            <div style={{ padding:'0 14px 14px', display:'flex', gap:8 }}>
              <input
                type="text" value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMsg(chatInput)}
                placeholder="سوالت را بنویس…"
                style={{ flex:1, height:40, borderRadius:11, border:'1px solid var(--line)', background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontSize:13, padding:'0 12px', outline:'none' }}
              />
              <button
                onClick={() => sendMsg(chatInput)}
                style={{ width:40, height:40, borderRadius:11, border:'none', background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', cursor:'pointer', fontSize:16, fontWeight:800, flexShrink:0 }}
              >↑</button>
            </div>
          </div>

        </div>
      </section>

      {/* ── VISIT MODAL ──────────────────────────────────────────────── */}
      {showModal && <VisitModal onClose={() => setShowModal(false)}/>}
    </div>
  )
}
