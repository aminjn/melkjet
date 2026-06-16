'use client'

import { useState, useEffect } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

type Toast = { kind: 'ok' | 'err'; msg: string } | null

const SECTIONS = [
  { id: 'loading', label: 'بارگذاری' },
  { id: 'empty', label: 'حالت خالی' },
  { id: 'error', label: 'خطا' },
  { id: 'buttons', label: 'دکمه‌ها' },
  { id: 'inputs', label: 'فیلدهای ورودی' },
  { id: 'cards', label: 'کارت‌ها' },
  { id: 'badges', label: 'برچسب‌ها' },
  { id: 'pagination', label: 'صفحه‌بندی' },
  { id: 'filters', label: 'فیلتر‌ها' },
  { id: 'micro', label: 'میکرواینتراکشن' },
]

const EMPTY_STATES = [
  { ic: '⌕', t: 'نتیجه‌ای یافت نشد', d: 'با این فیلترها ملکی پیدا نشد. کمی بازه‌ی قیمت یا محله را گسترده‌تر کن.', cta: 'بازنشانی فیلترها' },
  { ic: '♥', t: 'هنوز علاقه‌مندی نداری', d: 'ملک‌هایی که ذخیره کنی اینجا جمع می‌شوند تا بعداً مقایسه کنی.', cta: 'شروع جستجو' },
  { ic: '◍', t: 'لیدی ثبت نشده', d: 'وقتی مشتری جدیدی فرم تماس را پر کند، اینجا ظاهر می‌شود.', cta: 'افزودن دستی لید' },
  { ic: '✦', t: 'دستیار خرید را راه بینداز', d: 'نیازت را یک بار بگو تا بازار را ۲۴ ساعته برایت بپایم.', cta: 'تعریف نیاز' },
]

const STATUS_BADGES = [
  { label: 'فروش', bg: 'rgba(95,217,138,0.12)', color: '#5fd98a', border: 'rgba(95,217,138,0.3)' },
  { label: 'اجاره', bg: 'rgba(122,143,174,0.18)', color: '#7a8fae', border: 'rgba(122,143,174,0.3)' },
  { label: 'پیش‌فروش', bg: 'rgba(201,169,106,0.14)', color: 'var(--gold)', border: 'rgba(201,169,106,0.3)' },
  { label: 'رزرو شد', bg: 'rgba(231,103,74,0.12)', color: '#e7674a', border: 'rgba(231,103,74,0.3)' },
  { label: 'فروخته شد', bg: 'rgba(150,150,150,0.12)', color: 'var(--muted)', border: 'rgba(150,150,150,0.2)' },
  { label: 'VIP', bg: 'rgba(201,169,106,0.22)', color: 'var(--gold2)', border: 'var(--gold)' },
]

const FILTER_CHIPS = [
  'تهران', 'آپارتمان', 'زیر ۲ میلیارد', '۲ خواب', 'پارکینگ', 'آسانسور', 'بالکن',
]

export default function StatesPage() {
  const [liked, setLiked] = useState(false)
  const [success, setSuccess] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [activeFilters, setActiveFilters] = useState<string[]>(['تهران', 'آپارتمان'])
  const [page, setPage] = useState(3)
  const [inputFocus, setInputFocus] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingBtn, setLoadingBtn] = useState(false)
  const [stRef, setStRef] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [ttRef, setTtRef] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const s = document.createElement('style')
    s.textContent = `
      @keyframes mjs-spin { to { transform:rotate(360deg); } }
      @keyframes mjs-scan { 0%{transform:translateX(0)} 100%{transform:translateX(-100%)} }
      @keyframes mjs-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      @keyframes mjs-blink { 0%,100%{opacity:1} 50%{opacity:.25} }
      @keyframes mjs-pop { 0%{transform:scale(.4)} 60%{transform:scale(1.18)} 100%{transform:scale(1)} }
      @keyframes mjs-toastin { from{transform:translateY(16px)} to{transform:translateY(0)} }
      @keyframes mjs-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      @keyframes mjs-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
      .mjs-skel { background:linear-gradient(90deg,var(--bg2) 25%,var(--surface) 50%,var(--bg2) 75%);background-size:200% 100%;animation:mjs-shimmer 1.4s linear infinite;border-radius:7px; }
    `
    document.head.appendChild(s)
    return () => { document.head.removeChild(s) }
  }, [])

  useEffect(() => () => {
    if (stRef) clearTimeout(stRef)
    if (ttRef) clearTimeout(ttRef)
  }, [stRef, ttRef])

  function showToast(kind: 'ok' | 'err') {
    if (ttRef) clearTimeout(ttRef)
    setToast({ kind, msg: kind==='ok' ? 'با موفقیت ذخیره شد' : 'خطا در ذخیره — دوباره تلاش کن' })
    setTtRef(setTimeout(() => setToast(null), 2600))
  }

  function fireSuccess() {
    setSuccess(false)
    if (stRef) clearTimeout(stRef)
    requestAnimationFrame(() => {
      setSuccess(true)
      setStRef(setTimeout(() => setSuccess(false), 1400))
    })
  }

  function handleLoadingBtn() {
    setLoadingBtn(true)
    setTimeout(() => setLoadingBtn(false), 2000)
  }

  function toggleFilter(f: string) {
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x!==f) : [...prev, f])
  }

  const sectionHead = (num: string, title: string, sub: string) => (
    <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:18, paddingBottom:12, borderBottom:'1px solid var(--line)' }}>
      <h2 style={{ fontSize:21, fontWeight:800, color:'var(--text)', margin:0 }}>{num} · {title}</h2>
      <span style={{ fontSize:12.5, color:'var(--muted)' }}>{sub}</span>
    </div>
  )

  const card = (children: React.ReactNode, extra?: React.CSSProperties) => (
    <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, padding:18, ...extra }}>
      {children}
    </div>
  )

  const sectionLabel = (t: string) => (
    <div style={{ fontSize:12.5, fontWeight:700, color:'var(--muted)', marginBottom:14 }}>{t}</div>
  )

  return (
    <div dir="rtl" style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', fontFamily:'Vazirmatn,sans-serif' }}>
      <Nav />

      {/* HERO */}
      <div style={{ background:'var(--bg2)', borderBottom:'1px solid var(--line)', padding:'36px 24px 30px' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--gold)', marginBottom:8 }}>production-ready</div>
            <h1 style={{ fontSize:'clamp(26px,4vw,38px)', fontWeight:800, letterSpacing:'-1px', margin:'0 0 10px' }}>
              سیستم طراحی ملک‌جت — وضعیت‌های UI
            </h1>
            <p style={{ fontSize:15, lineHeight:1.85, color:'var(--muted)', maxWidth:560, margin:0 }}>
              هر تجربه‌ی واقعی نیاز به حالت‌های بارگذاری، خالی و خطا دارد. این الگوها در تمام صفحات ملک‌جت یکدست به‌کار می‌روند.
            </p>
          </div>
          {/* Section nav pills */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxWidth:400 }}>
            {SECTIONS.map(sec => (
              <a key={sec.id} href={`#${sec.id}`} style={{ padding:'5px 12px', borderRadius:9, background:'var(--surface)', border:'1px solid var(--line)', color:'var(--muted)', textDecoration:'none', fontSize:12.5, fontWeight:500 }}>
                {sec.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mjst-main" style={{ maxWidth:1280, margin:'0 auto', padding:'40px 24px 100px', display:'grid', gap:44 }}>

        {/* ════ 1. LOADING ════ */}
        <section id="loading">
          {sectionHead('۱', 'بارگذاری', 'اسکلت، اسپینر، تحلیل AI')}
          <div className="mjst-2" style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16, marginBottom:16 }}>
            {/* skeleton card */}
            {card(
              <>
                {sectionLabel('اسکلت کارت ملک')}
                <div style={{ background:'var(--bg2)', border:'1px solid var(--line)', borderRadius:14, overflow:'hidden', maxWidth:280 }}>
                  <div className="mjs-skel" style={{ height:130, borderRadius:0 }} />
                  <div style={{ padding:14, display:'grid', gap:9 }}>
                    <div className="mjs-skel" style={{ height:18, width:'55%' }} />
                    <div className="mjs-skel" style={{ height:13, width:'80%' }} />
                    <div className="mjs-skel" style={{ height:13, width:'40%' }} />
                  </div>
                </div>
              </>
            )}
            <div style={{ display:'grid', gap:16 }}>
              {/* spinners */}
              {card(
                <>
                  {sectionLabel('اسپینر و نوار پیشرفت')}
                  <div style={{ display:'flex', alignItems:'center', gap:18 }}>
                    <span style={{ width:34, height:34, borderRadius:'50%', border:'3px solid var(--goldDim)', borderTop:'3px solid var(--gold)', animation:'mjs-spin .8s linear infinite', display:'inline-block' }} />
                    <span style={{ width:26, height:26, borderRadius:'50%', border:'2.5px solid var(--line)', borderTop:'2.5px solid var(--text)', animation:'mjs-spin 1s linear infinite', display:'inline-block' }} />
                    <div style={{ flex:1, height:6, borderRadius:4, background:'var(--bg2)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:'40%', background:'linear-gradient(90deg,transparent,var(--gold),transparent)', animation:'mjs-scan 1.1s linear infinite' }} />
                    </div>
                  </div>
                </>
              )}
              {/* AI loading */}
              {card(
                <>
                  {sectionLabel('✦ تحلیل هوش مصنوعی')}
                  <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                    <span style={{ width:30, height:30, borderRadius:'50%', border:'2.5px solid var(--goldDim)', borderTop:'2.5px solid var(--gold)', animation:'mjs-spin .8s linear infinite', display:'inline-block', flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color:'var(--text)', fontWeight:600 }}>در حال بررسی ۲٬۴۰۰ فایل…</div>
                      <div style={{ display:'flex', gap:4, marginTop:6 }}>
                        {[0,.2,.4].map((d,i) => (
                          <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--gold)', display:'inline-block', animation:`mjs-blink 1s ${d}s infinite` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </>, { border:'1px solid var(--gold)' }
              )}
            </div>
          </div>
          {/* skeleton list */}
          {card(
            <>
              {sectionLabel('اسکلت ردیف لیست')}
              <div style={{ display:'grid', gap:10 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div className="mjs-skel" style={{ width:48, height:48, borderRadius:10, flexShrink:0 }} />
                    <div style={{ flex:1, display:'grid', gap:7 }}>
                      <div className="mjs-skel" style={{ height:14, width:'45%' }} />
                      <div className="mjs-skel" style={{ height:11, width:'65%' }} />
                    </div>
                    <div className="mjs-skel" style={{ width:60, height:24, borderRadius:999 }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ════ 2. EMPTY STATES ════ */}
        <section id="empty">
          {sectionHead('۲', 'حالت خالی', 'با اقدام پیشنهادی، نه بن‌بست')}
          <div className="mjst-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {EMPTY_STATES.map((e,i) => (
              <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, padding:'36px 24px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ width:64, height:64, borderRadius:18, background:'var(--goldDim)', color:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, animation:'mjs-float 3s ease-in-out infinite' }}>{e.ic}</div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginTop:18 }}>{e.t}</div>
                <div style={{ fontSize:13, color:'var(--muted)', marginTop:8, lineHeight:1.7, maxWidth:280 }}>{e.d}</div>
                <button style={{ marginTop:18, height:40, padding:'0 20px', border:'none', borderRadius:12, background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer' }}>{e.cta}</button>
              </div>
            ))}
          </div>
        </section>

        {/* ════ 3. ERRORS ════ */}
        <section id="error">
          {sectionHead('۳', 'خطا', 'روشن، بدون سرزنش، با راه خروج')}
          <div className="mjst-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* 404 */}
            <div style={{ gridColumn:'1/-1', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, padding:34, display:'flex', alignItems:'center', gap:28, flexWrap:'wrap' }}>
              <div style={{ fontSize:'clamp(48px,8vw,80px)', fontWeight:800, letterSpacing:'-3px', background:'linear-gradient(120deg,var(--gold2),var(--gold))', WebkitBackgroundClip:'text', backgroundClip:'text', WebkitTextFillColor:'transparent' }}>۴۰۴</div>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>این ملک دیگر در دسترس نیست</div>
                <div style={{ fontSize:13.5, color:'var(--muted)', marginTop:8, lineHeight:1.8 }}>شاید فروخته شده یا آگهی حذف شده باشد. بگذار گزینه‌های مشابه را نشانت دهم.</div>
                <div style={{ display:'flex', gap:10, marginTop:16 }}>
                  <button style={{ height:40, padding:'0 18px', border:'none', borderRadius:11, background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer' }}>مشاهده مشابه‌ها</button>
                  <button style={{ height:40, padding:'0 18px', border:'1px solid var(--line2)', borderRadius:11, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontWeight:600, fontSize:13, cursor:'pointer' }}>بازگشت به خانه</button>
                </div>
              </div>
            </div>
            {/* Network */}
            {card(
              <>
                <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:12 }}>
                  <span style={{ width:36, height:36, borderRadius:10, background:'rgba(231,103,74,0.15)', color:'#e7674a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>⚠</span>
                  <div style={{ fontSize:15, fontWeight:700 }}>اتصال قطع شد</div>
                </div>
                <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.8 }}>اینترنت در دسترس نیست. تغییرات تو ذخیره شده و پس از اتصال همگام می‌شود.</div>
                <button style={{ marginTop:14, height:38, padding:'0 16px', border:'1px solid var(--line2)', borderRadius:10, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontWeight:600, fontSize:12.5, cursor:'pointer' }}>↻ تلاش دوباره</button>
              </>
            )}
            {/* AI failure */}
            {card(
              <>
                <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:12 }}>
                  <span style={{ width:36, height:36, borderRadius:10, background:'var(--goldDim)', color:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>✦</span>
                  <div style={{ fontSize:15, fontWeight:700 }}>دستیار در دسترس نیست</div>
                </div>
                <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.8 }}>تحلیل هوشمند موقتاً ممکن نشد. می‌توانی از جستجوی کلاسیک با فیلترها استفاده کنی.</div>
                <button style={{ marginTop:14, height:38, padding:'0 16px', border:'1px solid var(--gold)', borderRadius:10, background:'var(--goldDim)', color:'var(--gold)', fontFamily:'inherit', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>جستجوی کلاسیک</button>
              </>
            )}
            {/* Form validation */}
            <div style={{ gridColumn:'1/-1', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, padding:22 }}>
              {sectionLabel('اعتبارسنجی فرم')}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:7 }}>شماره موبایل</div>
                  <div style={{ display:'flex', alignItems:'center', gap:9, background:'var(--bg2)', border:'1px solid #e7674a', borderRadius:11, padding:'11px 14px' }}>
                    <input defaultValue="0912" style={{ flex:1, border:'none', outline:'none', background:'transparent', color:'var(--text)', fontFamily:'inherit', fontSize:13, direction:'ltr' }} />
                    <span style={{ color:'#e7674a' }}>✕</span>
                  </div>
                  <div style={{ fontSize:11.5, color:'#e7674a', marginTop:6 }}>⚠ شماره موبایل باید ۱۱ رقم باشد</div>
                </div>
                <div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:7 }}>کد تأیید</div>
                  <div style={{ display:'flex', alignItems:'center', gap:9, background:'var(--bg2)', border:'1px solid #5fd98a', borderRadius:11, padding:'11px 14px' }}>
                    <input defaultValue="۸۴۲۱۹" style={{ flex:1, border:'none', outline:'none', background:'transparent', color:'var(--text)', fontFamily:'inherit', fontSize:13 }} />
                    <span style={{ color:'#5fd98a' }}>✓</span>
                  </div>
                  <div style={{ fontSize:11.5, color:'#5fd98a', marginTop:6 }}>✓ تأیید شد</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════ 4. BUTTONS ════ */}
        <section id="buttons">
          {sectionHead('۴', 'دکمه‌ها', 'همه حالت‌های ممکن')}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {card(
              <>
                {sectionLabel('انواع دکمه')}
                <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                  <button style={{ height:42, padding:'0 20px', border:'none', borderRadius:12, background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 8px 22px -10px var(--gold)' }}>اصلی</button>
                  <button style={{ height:42, padding:'0 20px', border:'1px solid var(--line2)', borderRadius:12, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit', fontWeight:600, fontSize:14, cursor:'pointer' }}>ثانویه</button>
                  <button style={{ height:42, padding:'0 20px', border:'1px solid transparent', borderRadius:12, background:'transparent', color:'var(--gold)', fontFamily:'inherit', fontWeight:600, fontSize:14, cursor:'pointer' }}>Ghost</button>
                  <button style={{ height:42, padding:'0 20px', border:'1px solid var(--line)', borderRadius:12, background:'var(--bg2)', color:'var(--faint)', fontFamily:'inherit', fontWeight:600, fontSize:14, cursor:'not-allowed', opacity:.6 }} disabled>غیرفعال</button>
                  <button style={{ height:42, padding:'0 20px', borderRadius:12, background:'rgba(231,103,74,0.15)', color:'#e7674a', fontFamily:'inherit', fontWeight:700, fontSize:14, cursor:'pointer', border:'1px solid rgba(231,103,74,0.3)' } as React.CSSProperties}>خطرناک</button>
                </div>
              </>
            )}
            {card(
              <>
                {sectionLabel('دکمه در حال بارگذاری')}
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <button
                    onClick={handleLoadingBtn}
                    disabled={loadingBtn}
                    style={{
                      height:42, padding:'0 24px', border:'none', borderRadius:12,
                      background: loadingBtn ? 'var(--line2)' : 'linear-gradient(140deg,var(--gold2),var(--gold))',
                      color: loadingBtn ? 'var(--muted)' : '#16140f',
                      fontFamily:'inherit', fontWeight:700, fontSize:14, cursor: loadingBtn ? 'not-allowed' : 'pointer',
                      display:'flex', alignItems:'center', gap:9,
                    }}
                  >
                    {loadingBtn && <span style={{ width:16, height:16, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid currentColor', animation:'mjs-spin .7s linear infinite', display:'inline-block' }} />}
                    {loadingBtn ? 'در حال پردازش…' : 'برای آزمایش کلیک کن'}
                  </button>
                </div>
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>اندازه‌های مختلف:</div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <button style={{ height:32, padding:'0 14px', fontSize:12, fontWeight:700, border:'none', borderRadius:9, background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', cursor:'pointer' }}>کوچک</button>
                    <button style={{ height:42, padding:'0 20px', fontSize:14, fontWeight:700, border:'none', borderRadius:12, background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', cursor:'pointer' }}>متوسط</button>
                    <button style={{ height:52, padding:'0 28px', fontSize:15, fontWeight:800, border:'none', borderRadius:14, background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', cursor:'pointer' }}>بزرگ</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ════ 5. INPUTS ════ */}
        <section id="inputs">
          {sectionHead('۵', 'فیلدهای ورودی', 'پیش‌فرض، فوکوس، خطا، موفق، غیرفعال')}
          {card(
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              {/* Default */}
              <div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:7 }}>پیش‌فرض</div>
                <input
                  placeholder="جستجوی منطقه یا شهر"
                  style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', border:'1px solid var(--line2)', borderRadius:11, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none' }}
                />
              </div>
              {/* Focus */}
              <div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:7 }}>فوکوس</div>
                <input
                  defaultValue="تهران، سعادت‌آباد"
                  onFocus={() => setInputFocus('focus')}
                  onBlur={() => setInputFocus(null)}
                  style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', border:`1px solid ${inputFocus==='focus' ? 'var(--gold)' : 'var(--line2)'}`, borderRadius:11, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none', boxShadow: inputFocus==='focus' ? '0 0 0 3px var(--goldDim)' : 'none', transition:'all .15s' }}
                />
              </div>
              {/* Error */}
              <div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:7 }}>خطا</div>
                <input
                  defaultValue="متن نامعتبر"
                  style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', border:'1px solid #e7674a', borderRadius:11, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none' }}
                />
                <div style={{ fontSize:11.5, color:'#e7674a', marginTop:5 }}>⚠ این فیلد اجباری است</div>
              </div>
              {/* Success */}
              <div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:7 }}>موفق</div>
                <input
                  defaultValue="۰۹۱۲۳۴۵۶۷۸۹"
                  style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', border:'1px solid #5fd98a', borderRadius:11, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none', direction:'ltr' }}
                />
                <div style={{ fontSize:11.5, color:'#5fd98a', marginTop:5 }}>✓ شماره تأیید شد</div>
              </div>
              {/* Disabled */}
              <div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:7 }}>غیرفعال</div>
                <input
                  disabled defaultValue="قابل ویرایش نیست"
                  style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', border:'1px solid var(--line)', borderRadius:11, background:'var(--bg)', color:'var(--faint)', fontFamily:'inherit', fontSize:13, outline:'none', cursor:'not-allowed', opacity:.6 }}
                />
              </div>
              {/* Select */}
              <div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:7 }}>دراپ‌داون</div>
                <select style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', border:'1px solid var(--line2)', borderRadius:11, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none', cursor:'pointer', appearance:'none' }}>
                  <option>مدرن</option>
                  <option>کلاسیک</option>
                  <option>مینیمال</option>
                </select>
              </div>
            </div>
          )}
        </section>

        {/* ════ 6. CARDS ════ */}
        <section id="cards">
          {sectionHead('۶', 'کارت‌ها', 'کارت ملک و مشاور در حالت‌های مختلف')}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
            {/* Property card — normal */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ height:140, background:'linear-gradient(135deg,var(--bg),var(--bg2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, color:'var(--gold)', opacity:.4, position:'relative' }}>
                ⊞
                <span style={{ position:'absolute', top:10, right:10, background:'rgba(95,217,138,0.9)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>فروش</span>
              </div>
              <div style={{ padding:14 }}>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>آپارتمان ۱۲۰ متری</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>سعادت‌آباد · طبقه ۴</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--gold)' }}>۱٬۸۵۰ میلیون</div>
                  <button style={{ fontSize:11, color:'var(--muted)', background:'transparent', border:'1px solid var(--line)', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontFamily:'inherit' }}>♡ ذخیره</button>
                </div>
              </div>
            </div>
            {/* Property card — selected */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--gold)', borderRadius:16, overflow:'hidden', boxShadow:'0 0 0 3px var(--goldDim)' }}>
              <div style={{ height:140, background:'linear-gradient(135deg,var(--goldDim),var(--bg2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, color:'var(--gold)', opacity:.6, position:'relative' }}>
                ⊟
                <span style={{ position:'absolute', top:10, right:10, background:'var(--gold)', color:'#16140f', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>انتخاب‌شده</span>
              </div>
              <div style={{ padding:14 }}>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>ویلا ۲۰۰ متری</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>لواسان · باغ</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--gold)' }}>۴٬۲۰۰ میلیون</div>
                  <button style={{ fontSize:11, color:'var(--gold)', background:'var(--goldDim)', border:'1px solid var(--gold)', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontFamily:'inherit' }}>♥ ذخیره شد</button>
                </div>
              </div>
            </div>
            {/* Advisor card */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:16, padding:18 }}>
              <div style={{ display:'flex', gap:13, alignItems:'center', marginBottom:14 }}>
                <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,var(--gold2),var(--gold))', display:'flex', alignItems:'center', justifyContent:'center', color:'#16140f', fontSize:20, fontWeight:800, flexShrink:0 }}>م</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:700 }}>مهندس رضایی</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>مشاور ارشد · سعادت‌آباد</div>
                  <div style={{ display:'flex', gap:4, marginTop:5 }}>
                    {[1,2,3,4,5].map(s => (
                      <span key={s} style={{ color: s<=4 ? 'var(--gold)' : 'var(--line2)', fontSize:12 }}>★</span>
                    ))}
                    <span style={{ fontSize:11, color:'var(--muted)', marginRight:3 }}>۴.۸ (۱۲۴ نظر)</span>
                  </div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                <div style={{ textAlign:'center', background:'var(--bg2)', borderRadius:9, padding:10 }}>
                  <div style={{ fontSize:18, fontWeight:800, color:'var(--gold)' }}>۸۲</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>معامله موفق</div>
                </div>
                <div style={{ textAlign:'center', background:'var(--bg2)', borderRadius:9, padding:10 }}>
                  <div style={{ fontSize:18, fontWeight:800 }}>۶ سال</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>سابقه کار</div>
                </div>
              </div>
              <button style={{ width:'100%', height:40, border:'none', borderRadius:11, background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer' }}>تماس با مشاور</button>
            </div>
          </div>
        </section>

        {/* ════ 7. BADGES ════ */}
        <section id="badges">
          {sectionHead('۷', 'برچسب‌ها', 'وضعیت، نوع ملک، ویژگی‌ها')}
          {card(
            <>
              {sectionLabel('برچسب‌های وضعیت')}
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:20 }}>
                {STATUS_BADGES.map((b,i) => (
                  <span key={i} style={{ padding:'5px 13px', borderRadius:100, background:b.bg, color:b.color, border:`1px solid ${b.border}`, fontSize:12.5, fontWeight:700 }}>{b.label}</span>
                ))}
              </div>
              {sectionLabel('برچسب‌های ویژگی')}
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {['آسانسور','پارکینگ','انباری','بالکن','سیستم هوشمند','روف‌گاردن','استخر','جکوزی'].map(f => (
                  <span key={f} style={{ padding:'4px 11px', borderRadius:8, background:'var(--bg2)', color:'var(--muted)', border:'1px solid var(--line)', fontSize:12, fontWeight:500 }}>{f}</span>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ════ 8. PAGINATION ════ */}
        <section id="pagination">
          {sectionHead('۸', 'صفحه‌بندی', 'ناوبری بین صفحات')}
          {card(
            <>
              {sectionLabel('صفحه‌بندی استاندارد')}
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <button onClick={() => setPage(p => Math.max(1,p-1))} style={{ width:38, height:38, borderRadius:10, border:'1px solid var(--line2)', background:'var(--bg2)', color:'var(--text)', fontSize:16, cursor:'pointer', fontFamily:'inherit' }}>‹</button>
                {[1,2,3,4,5,6,7].map(n => {
                  const active = n===page
                  return (
                    <button key={n} onClick={() => setPage(n)} style={{
                      width:38, height:38, borderRadius:10, border:'none',
                      background: active ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--bg2)',
                      color: active ? '#16140f' : 'var(--muted)',
                      fontSize:13, fontWeight: active ? 700 : 500, cursor:'pointer', fontFamily:'inherit',
                    }}>{n}</button>
                  )
                })}
                <span style={{ color:'var(--muted)', fontSize:14, padding:'0 4px' }}>…</span>
                <button style={{ width:38, height:38, borderRadius:10, border:'none', background:'var(--bg2)', color:'var(--muted)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>۱۲</button>
                <button onClick={() => setPage(p => Math.min(12,p+1))} style={{ width:38, height:38, borderRadius:10, border:'1px solid var(--line2)', background:'var(--bg2)', color:'var(--text)', fontSize:16, cursor:'pointer', fontFamily:'inherit' }}>›</button>
              </div>
              <div style={{ marginTop:12, fontSize:12.5, color:'var(--muted)' }}>صفحه {page} از ۱۲ · ۲۳۴ نتیجه</div>
            </>
          )}
        </section>

        {/* ════ 9. FILTER CHIPS ════ */}
        <section id="filters">
          {sectionHead('۹', 'فیلتر‌ها', 'چیپ‌های فیلتر فعال و غیرفعال')}
          {card(
            <>
              {sectionLabel('فیلترهای فعال')}
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
                {FILTER_CHIPS.map(f => {
                  const on = activeFilters.includes(f)
                  return (
                    <button
                      key={f}
                      onClick={() => toggleFilter(f)}
                      style={{
                        padding:'7px 14px', borderRadius:100,
                        border: `1px solid ${on ? 'var(--gold)' : 'var(--line2)'}`,
                        background: on ? 'var(--goldDim)' : 'var(--bg2)',
                        color: on ? 'var(--gold)' : 'var(--muted)',
                        fontSize:13, fontWeight: on ? 700 : 500,
                        cursor:'pointer', fontFamily:'inherit', transition:'all .15s',
                        display:'flex', alignItems:'center', gap:6,
                      }}
                    >
                      {f}
                      {on && <span style={{ fontSize:11, opacity:.7 }}>✕</span>}
                    </button>
                  )
                })}
              </div>
              {activeFilters.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--goldDim)', borderRadius:11, fontSize:12, color:'var(--gold)' }}>
                  <span style={{ fontWeight:700 }}>{activeFilters.length} فیلتر فعال</span>
                  <button onClick={() => setActiveFilters([])} style={{ background:'transparent', border:'none', color:'var(--gold)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600, marginRight:'auto' }}>× پاک کردن همه</button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ════ 10. MICRO-INTERACTIONS ════ */}
        <section id="micro">
          {sectionHead('۱۰', 'میکرواینتراکشن', 'امتحانشان کن — تعاملی‌اند')}
          <div className="mjst-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {/* Like */}
            {card(
              <>
                {sectionLabel('ذخیره / علاقه‌مندی')}
                <div style={{ textAlign:'center' }}>
                  <button
                    onClick={() => setLiked(v => !v)}
                    style={{ width:60, height:60, borderRadius:18, border:'1px solid var(--line2)', background:'var(--bg2)', cursor:'pointer', fontSize:26, color: liked ? '#ff6b81' : 'var(--muted)', transition:'.2s', display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                  >
                    {liked ? '♥' : '♡'}
                  </button>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:12 }}>{liked ? 'ذخیره شد ✓' : 'برای ذخیره کلیک کن'}</div>
                </div>
              </>
            )}
            {/* Success check */}
            {card(
              <>
                {sectionLabel('تأیید موفقیت')}
                <div style={{ textAlign:'center' }}>
                  <button
                    onClick={fireSuccess}
                    style={{ width:60, height:60, borderRadius:'50%', border:'none', background: success ? '#5fd98a' : 'var(--bg2)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', transition:'.3s' }}
                  >
                    <span style={{ fontSize:26, fontWeight:800, color: success ? '#0a2a16' : 'var(--muted)', animation: success ? 'mjs-pop .4s both' : 'none' }}>✓</span>
                  </button>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:12 }}>برای پخش کلیک کن</div>
                </div>
              </>
            )}
            {/* Toast */}
            {card(
              <>
                {sectionLabel('اعلان (Toast)')}
                <div style={{ display:'grid', gap:8 }}>
                  <button onClick={() => showToast('ok')} style={{ height:40, border:'none', borderRadius:11, background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', fontWeight:700, fontSize:13, cursor:'pointer' }}>اعلان موفقیت</button>
                  <button onClick={() => showToast('err')} style={{ height:40, border:'1px solid var(--line2)', borderRadius:11, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontWeight:600, fontSize:13, cursor:'pointer' }}>اعلان خطا</button>
                </div>
              </>
            )}
          </div>

          {/* Modal demo */}
          <div style={{ marginTop:16 }}>
            {card(
              <>
                {sectionLabel('مودال نمونه')}
                <button
                  onClick={() => setModalOpen(true)}
                  style={{ height:42, padding:'0 20px', border:'1px solid var(--line2)', borderRadius:12, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontWeight:600, fontSize:14, cursor:'pointer' }}
                >
                  باز کردن مودال
                </button>
                {modalOpen && (
                  <div
                    onClick={e => { if (e.target===e.currentTarget) setModalOpen(false) }}
                    style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)' }}
                  >
                    <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:20, padding:28, maxWidth:440, width:'90%', animation:'mjs-fade .2s both' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                        <div style={{ fontSize:18, fontWeight:800 }}>تأیید رزرو ملک</div>
                        <button onClick={() => setModalOpen(false)} style={{ width:32, height:32, borderRadius:9, border:'1px solid var(--line)', background:'var(--bg)', color:'var(--muted)', cursor:'pointer', fontSize:16 }}>×</button>
                      </div>
                      <p style={{ fontSize:13.5, color:'var(--muted)', lineHeight:1.8, marginBottom:20 }}>آیا از رزرو این ملک مطمئن هستید؟ پس از تأیید، یک SMS با جزئیات برای شما ارسال می‌شود.</p>
                      <div style={{ display:'flex', gap:10 }}>
                        <button onClick={() => setModalOpen(false)} style={{ flex:1, height:42, border:'none', borderRadius:12, background:'linear-gradient(140deg,var(--gold2),var(--gold))', color:'#16140f', fontFamily:'inherit', fontWeight:700, fontSize:14, cursor:'pointer' }}>بله، رزرو کن</button>
                        <button onClick={() => setModalOpen(false)} style={{ flex:1, height:42, border:'1px solid var(--line2)', borderRadius:12, background:'var(--bg2)', color:'var(--text)', fontFamily:'inherit', fontWeight:600, fontSize:14, cursor:'pointer' }}>انصراف</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position:'fixed', bottom:26, left:'50%', transform:'translateX(-50%)', zIndex:80,
          display:'flex', alignItems:'center', gap:11, padding:'13px 18px', borderRadius:14,
          background:'var(--surface)', border:`1px solid ${toast.kind==='err' ? '#e7674a' : '#5fd98a'}`,
          boxShadow:'0 18px 44px -16px rgba(0,0,0,0.5)', animation:'mjs-toastin .25s ease both',
          whiteSpace:'nowrap',
        }}>
          <span style={{ width:28, height:28, borderRadius:9, background: toast.kind==='err' ? 'rgba(231,103,74,0.15)' : 'rgba(95,217,138,0.15)', color: toast.kind==='err' ? '#e7674a' : '#5fd98a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800 }}>
            {toast.kind==='err' ? '✕' : '✓'}
          </span>
          <span style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>{toast.msg}</span>
        </div>
      )}

      <Footer />
    </div>
  )
}
