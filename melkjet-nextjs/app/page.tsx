'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import Nav from './components/Nav'
import Footer from './components/Footer'
import AIAssistant from './components/AIAssistant'
import PropertyCard from './components/PropertyCard'

const featured = [
  { id: '1', title: 'آپارتمان لوکس نوساز', location: 'سعادت‌آباد، تهران', price: '۱۷٫۸ میلیارد', size: '۱۴۰', beds: '۳', year: '۱۴۰۲', tag: 'ویژه', score: 96, img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
  { id: '2', title: 'پنت‌هاوس دوبلکس با ویو', location: 'زعفرانیه، تهران', price: '۸۵ میلیارد', size: '۲۶۰', beds: '۴', year: '۱۴۰۳', tag: 'لوکس', score: 94, img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
  { id: '3', title: 'آپارتمان دنج و آفتاب‌گیر', location: 'ونک، تهران', price: '۹٫۲ میلیارد', size: '۹۵', beds: '۲', year: '۱۳۹۸', tag: 'فرصت', score: 88, img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
  { id: '4', title: 'ویلا باغ با استخر', location: 'لواسان', price: '۱۲۰ میلیارد', size: '۴۲۰', beds: '۵', year: '۱۴۰۱', tag: 'لوکس', score: 92, img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
  { id: '5', title: 'آپارتمان روشن خوش‌نقشه', location: 'جردن، تهران', price: '۱۴٫۵ میلیارد', size: '۱۱۰', beds: '۲', year: '۱۴۰۰', tag: 'ویژه', score: 91, img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
  { id: '6', title: 'دفتر کار اداری مدرن', location: 'میرداماد، تهران', price: '۶٫۸ میلیارد', size: '۸۰', beds: '—', year: '۱۳۹۹', tag: 'اداری', score: 84, img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
]
const stats = [
  { n: '۲۴۰٬۰۰۰+', l: 'فایل فعال' }, { n: '۱۸٬۵۰۰', l: 'مشاور تأییدشده' },
  { n: '۴۲', l: 'شهر تحت پوشش' }, { n: '۹۸٪', l: 'دقت تحلیل قیمت' }
]
const hoods = [
  { n: 'سعادت‌آباد', p: '۱۲۷ م', g: '+۸٪', img: 'linear-gradient(135deg,#3a3530,#23201c)' },
  { n: 'زعفرانیه', p: '۳۲۷ م', g: '+۵٪', img: 'linear-gradient(135deg,#33303a,#201d26)' },
  { n: 'ونک', p: '۹۷ م', g: '+۱۱٪', img: 'linear-gradient(135deg,#2c343a,#1c2126)' },
  { n: 'جردن', p: '۱۳۲ م', g: '+۶٪', img: 'linear-gradient(135deg,#34323c,#221f29)' },
  { n: 'لواسان', p: '۲۸۶ م', g: '+۹٪', img: 'linear-gradient(135deg,#2f3a34,#1d231f)' },
  { n: 'میرداماد', p: '۱۰۵ م', g: '+۴٪', img: 'linear-gradient(135deg,#3a3630,#241f1a)' },
]
const modules = [
  { ic: '◈', t: 'تحلیل ارزش واقعی', d: 'برآورد قیمت منصفانه بر اساس موقعیت، متراژ و داده‌های تاریخی، همراه با Confidence Score.', cta: 'محاسبه ارزش ملک' },
  { ic: '◰', t: 'نقشه حرارتی بازار', d: 'میانگین قیمت، رشد، تقاضا و فرصت سرمایه‌گذاری هر محله را روی نقشه ببین.', cta: 'مشاهده نقشه' },
  { ic: '◴', t: 'پیش‌بینی آینده بازار', d: 'روند رشد، احتمال کاهش و میزان ریسک هر منطقه را پیش از تصمیم بدان.', cta: 'پیش‌بینی منطقه' }
]
const advisors = [
  { n: 'سارا محمدی', r: 'مشاور لوکس · زعفرانیه', deals: '۱۲۴', rate: '۴٫۹', img: 'linear-gradient(135deg,#caa86a,#8a6f3e)' },
  { n: 'امیر رضایی', r: 'سرمایه‌گذاری · ونک', deals: '۲۰۳', rate: '۴٫۸', img: 'linear-gradient(135deg,#7a8fae,#465a78)' },
  { n: 'نگار کریمی', r: 'مسکونی · سعادت‌آباد', deals: '۹۷', rate: '۵٫۰', img: 'linear-gradient(135deg,#b07a8a,#6e4754)' },
  { n: 'کاوه اسدی', r: 'تجاری و اداری · میرداماد', deals: '۱۵۶', rate: '۴٫۷', img: 'linear-gradient(135deg,#7aa88f,#476e58)' }
]
const invest = [
  { id: '7', title: 'پیش‌فروش برج آرین', location: 'سعادت‌آباد', roi: '۳۸٪', risk: 'کم', riskColor: '#5fd98a', price: 'از ۱۴ م.د', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
  { id: '8', title: 'مجتمع تجاری ونک‌پارک', location: 'ونک', roi: '۲۹٪', risk: 'متوسط', riskColor: '#e7a14a', price: 'از ۳۴ م.د', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
  { id: '9', title: 'ویلاهای باغ لواسان', location: 'لواسان', roi: '۴۲٪', risk: 'متوسط', riskColor: '#e7a14a', price: 'از ۱۲۰ م.د', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
]
const faqs = [
  { q: 'جستجوی هوشمند ملک‌جت چطور کار می‌کند؟', a: 'کافی‌ست نیازت را به زبان طبیعی بنویسی؛ هوش مصنوعی منظور تو را تحلیل می‌کند، در صورت نیاز سؤال تکمیلی می‌پرسد و بهترین فایل‌ها را همراه با دلیل انتخاب نمایش می‌دهد.' },
  { q: 'تحلیل قیمت ملک‌جت چقدر دقیق است؟', a: 'موتور قیمت‌گذاری ما با اتکا به داده‌های تاریخی، املاک مشابه و روند بازار، ارزش منصفانه را با Confidence Score برآورد می‌کند تا بدانی یک ملک گران است یا ارزان.' },
  { q: 'آیا ثبت آگهی و استفاده رایگان است؟', a: 'پلن رایگان برای جستجو، ذخیره و دریافت پیشنهادهای هوشمند در دسترس است. مشاوران و آژانس‌ها می‌توانند با پلن‌های حرفه‌ای به CRM، اتوماسیون و ابزارهای بازاریابی دسترسی پیدا کنند.' },
  { q: 'دستیار هوشمند چه کارهایی انجام می‌دهد؟', a: 'دستیار همیشگی ملک‌جت در خرید، فروش، اجاره، تحلیل قیمت، مذاکره و راهنمایی حقوقی کنار توست و ۲۴ ساعته پاسخ‌گوست.' }
]
const examples = ['آپارتمان نوساز در زعفرانیه با ویو', 'خانه زیر ۱۰ میلیارد برای سرمایه‌گذاری', 'اجاره ۲ خوابه نزدیک مترو ونک', 'ویلا در شمال با باغ']
const aiMatches = [
  { id: '1', title: 'آپارتمان لوکس نوساز سعادت‌آباد', loc: 'سعادت‌آباد، تهران', price: '۱۷٫۸ میلیارد', size: '۱۴۰', beds: '۳', match: 96, img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
  { id: '5', title: 'آپارتمان روشن جردن', loc: 'جردن، تهران', price: '۱۴٫۵ میلیارد', size: '۱۱۰', beds: '۲', match: 91, img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
]
const materials = [
  { l: 'آهن و میلگرد', ic: '▭', bg: 'rgba(122,143,174,0.15)', color: '#7a8fae' },
  { l: 'سیمان و گچ', ic: '◳', bg: 'rgba(201,168,76,0.15)', color: 'var(--gold)' },
  { l: 'کاشی و سرامیک', ic: '▦', bg: 'rgba(176,122,138,0.15)', color: '#b07a8a' },
  { l: 'کابینت و دکور', ic: '◫', bg: 'rgba(122,168,143,0.15)', color: '#7aa88f' },
  { l: 'شیرآلات', ic: '◌', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
  { l: 'سرمایش و گرمایش', ic: '❄', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
]

export default function Home() {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<'idle'|'thinking'|'results'>('idle')
  const [openFaq, setOpenFaq] = useState(-1)
  const [likes, setLikes] = useState<Record<string, boolean>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = () => {
    setPhase('thinking')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setPhase('results'), 2200)
  }
  const fillQuery = (text: string) => { setQuery(text); setTimeout(runSearch, 100) }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(48px,7vw,96px) 24px clamp(40px,5vw,72px)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 460px at 78% -8%,var(--goldDim),transparent 60%)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'relative', maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 0 4px var(--goldDim)', animation: 'glow 2s infinite', display: 'inline-block' }}></span>
            موتور تصمیم‌گیری هوشمند املاک
          </div>
          <h1 style={{ marginTop: 22, fontSize: 'clamp(34px,6vw,64px)', lineHeight: 1.12, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>
            خانه‌ی بعدی‌ات،<br />
            <span style={{ background: 'linear-gradient(120deg,var(--gold2),var(--gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>هوشمندانه</span> انتخاب می‌شود
          </h1>
          <p style={{ margin: '20px auto 0', maxWidth: 620, fontSize: 'clamp(15px,2vw,18.5px)', lineHeight: 1.85, color: 'var(--muted)' }}>
            به زبان خودت بگو چه می‌خواهی. ملک‌جت بازار را تحلیل می‌کند، دلیل هر پیشنهاد را توضیح می‌دهد و کنارت می‌ماند تا بهترین تصمیم را بگیری.
          </p>

          <div style={{ margin: '34px auto 0', maxWidth: 740, textAlign: 'right' }}>
            <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 18, boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="مثلاً: آپارتمان ۱۳۰ متری در سعادت‌آباد، زیر ۱۸ میلیارد، با آسانسور و پارکینگ، نزدیک مترو…" rows={2} style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.7, paddingTop: 8 }} />
                <button onClick={runSearch} style={{ flexShrink: 0, height: 48, padding: '0 22px', border: 'none', borderRadius: 13, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 24px -10px var(--gold)' }}>جستجو</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--faint)', alignSelf: 'center' }}>امتحان کنید:</span>
                {examples.map(ex => (
                  <button key={ex} onClick={() => fillQuery(ex)} style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{ex}</button>
                ))}
              </div>
            </div>

            {phase === 'thinking' && (
              <div style={{ marginTop: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', border: '2.5px solid var(--goldDim)', borderTopColor: 'var(--gold)', animation: 'spin .8s linear infinite', display: 'block', flexShrink: 0 }}></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14.5 }}>در حال تحلیل درخواست شما…</div>
                    <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--bg2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '40%', background: 'linear-gradient(90deg,transparent,var(--gold),transparent)', animation: 'scan 1s linear infinite' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {phase === 'results' && (
              <div style={{ marginTop: 14, animation: 'rise .5s both' }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(400px 160px at 90% 0,var(--goldDim),transparent)' }}></div>
                  <div style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontWeight: 800, fontSize: 15 }}>✦</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)', marginBottom: 6 }}>تحلیل ملک‌جت</div>
                      <p style={{ fontSize: 14.5, lineHeight: 1.85, color: 'var(--text)' }}>۳ گزینه با تطابق بالا پیدا کردم. بودجه‌ی شما برای سعادت‌آباد منطقی است؛ اما با حدود ۵٪ افزایش، واحدهای نوسازتر با کیفیت ساخت بالاتر هم در دسترس می‌شوند.</p>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                  {aiMatches.map(p => (
                    <Link key={p.id} href={`/property/${p.id}`} style={{ display: 'flex', gap: 14, textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 12, alignItems: 'center' }}>
                      <div style={{ width: 96, height: 74, borderRadius: 10, flexShrink: 0, background: p.img }}></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{p.loc} · {p.size} متر · {p.beds} خواب</div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--gold)', marginTop: 6 }}>{p.price}</div>
                      </div>
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--faint)' }}>تطابق</div>
                        <div style={{ fontWeight: 800, fontSize: 19, color: 'var(--text)' }}>{p.match}٪</div>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href="/search" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, height: 46, borderRadius: 13, border: '1px solid var(--gold)', background: 'var(--goldDim)', color: 'var(--gold)', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>مشاهده‌ی همه‌ی نتایج روی نقشه ←</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '26px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 18 }}>
          {stats.map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(24px,3vw,32px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px' }}>{s.n}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>★ منتخب ملک‌جت</div><h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>املاک ویژه و لوکس</h2></div>
          <Link href="/search" style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 11 }}>مشاهده همه ←</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 18 }}>
          {featured.map(p => (
            <PropertyCard key={p.id} {...p} liked={likes[p.id]} onLike={() => setLikes(prev => ({ ...prev, [p.id]: !prev[p.id] }))} />
          ))}
        </div>
      </section>

      {/* INVESTMENT */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px clamp(48px,6vw,80px)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>◈ بازده بالا</div><h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>فرصت‌های سرمایه‌گذاری</h2></div>
          <Link href="/owner" style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 11 }}>میز کار سرمایه‌گذار ←</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>
          {invest.map(o => (
            <Link key={o.id} href={`/property/${o.id}`} style={{ display: 'block', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: 150, background: o.img }}>
                <span style={{ position: 'absolute', top: 12, right: 12, padding: '5px 11px', borderRadius: 999, background: 'rgba(95,217,138,0.9)', color: '#0a2a16', fontSize: 12, fontWeight: 800 }}>بازده {o.roi}</span>
                <span style={{ position: 'absolute', bottom: 12, left: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(20,18,14,0.7)', backdropFilter: 'blur(6px)', color: o.riskColor, fontSize: 11, fontWeight: 700 }}>ریسک {o.risk}</span>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{o.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{o.location}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--gold)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>{o.price}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* AI MODULES */}
      <section style={{ background: 'var(--bg2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>✦ هوش مصنوعی ملک‌جت</div>
            <h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>تصمیم بگیر، نه حدس بزن</h2>
            <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.85, color: 'var(--muted)' }}>سه موتور هوشمند که قبل از هر تصمیم، تصویر کاملی از ارزش، بازار و آینده‌ی ملک به تو می‌دهند.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
            {modules.map(m => (
              <div key={m.ic} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 26 }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--goldDim)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--gold)' }}>{m.ic}</div>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginTop: 18 }}>{m.t}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--muted)', marginTop: 10 }}>{m.d}</p>
                <Link href="/search" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 14, fontWeight: 700, color: 'var(--gold)', textDecoration: 'none' }}>{m.cta} ←</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEIGHBORHOODS */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>◴ نقشه بازار</div><h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>محله‌های محبوب تهران</h2></div>
          <Link href="/search" style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 11 }}>نقشه کامل ←</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
          {hoods.map(h => (
            <Link key={h.n} href={`/neighborhood/${encodeURIComponent(h.n)}`} style={{ position: 'relative', display: 'block', height: 148, borderRadius: 16, overflow: 'hidden', background: h.img, textDecoration: 'none', border: '1px solid var(--line)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.6),transparent 60%)' }}></div>
              <span style={{ position: 'absolute', top: 10, left: 10, padding: '4px 9px', borderRadius: 999, background: 'rgba(63,191,111,0.18)', color: '#5fd98a', fontSize: 11, fontWeight: 700, border: '1px solid rgba(63,191,111,0.4)' }}>{h.g}</span>
              <div style={{ position: 'absolute', bottom: 12, right: 12, left: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{h.n}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>میانگین {h.p} / متر</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ADVISORS */}
      <section style={{ background: 'var(--bg2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>♛ تأییدشده</div><h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>مشاوران برتر</h2></div>
            <Link href="/directory" style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 11 }}>همه مشاوران ←</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }}>
            {advisors.map(a => (
              <div key={a.n} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22, textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto', background: a.img, border: '2px solid var(--gold)' }}></div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginTop: 14 }}>{a.n}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{a.r}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{a.deals}</div><div style={{ fontSize: 11, color: 'var(--faint)' }}>معامله</div></div>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>★ {a.rate}</div><div style={{ fontSize: 11, color: 'var(--faint)' }}>امتیاز</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MATERIALS */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, border: '1px solid var(--line)', background: 'var(--bg2)', padding: 'clamp(28px,4vw,44px)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>⛓ بازار B2B</div>
              <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>بازار مصالح ساختمانی</h2>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, maxWidth: 460, lineHeight: 1.7 }}>خرید عمده، استعلام قیمت و سفارش مستقیم از تأمین‌کنندگان معتبر.</p>
            </div>
            <Link href="/materials" style={{ flexShrink: 0, padding: '0 18px', height: 44, display: 'flex', alignItems: 'center', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>ورود به بازار مصالح ←</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
            {materials.map(m => (
              <Link key={m.l} href="/materials" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 14, borderRadius: 13, background: 'var(--surface)', border: '1px solid var(--line)', textDecoration: 'none' }}>
                <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{m.ic}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.l}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(40px,5vw,72px) 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)', marginBottom: 32 }}>سوال‌های پرتکرار</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '18px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}>
                <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)' }}>{f.q}</span>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: 'var(--goldDim)', color: 'var(--gold)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 20px 18px', fontSize: 14.5, lineHeight: 1.9, color: 'var(--muted)' }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <Footer />
      <AIAssistant />
    </div>
  )
}
