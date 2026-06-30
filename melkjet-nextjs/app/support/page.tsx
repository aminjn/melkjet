'use client'
import { useState } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import SupportPanel from '../components/SupportPanel'

const FAQ = [
  { q: 'چطور آگهی ثبت کنم؟', a: 'از دکمهٔ «ثبت آگهی» در نوار بالا وارد فرم چندمرحله‌ای شو؛ نوع ملک، موقعیت، مشخصات و عکس را وارد کن. هوش مصنوعی در نگارش توضیحات و قیمت‌گذاری کمک می‌کند.' },
  { q: 'جستجوی هوشمند چطور کار می‌کند؟', a: 'کافی‌ست خواسته‌ات را به زبان ساده بنویسی؛ موتورِ هوشمند، منطقه/متراژ/بودجه را تشخیص می‌دهد و بهترین گزینه‌ها را با امتیاز نشان می‌دهد.' },
  { q: 'تفاوت پلن‌ها چیست؟', a: 'هر پلن سقفِ آگهی، ابزارهای هوش مصنوعی و امکاناتِ پنل را مشخص می‌کند. در صفحهٔ «پلن‌ها» می‌توانی مقایسه و انتخاب کنی.' },
  { q: 'توکن AI چیست و چطور شارژ کنم؟', a: 'توکن، واحدِ مصرفِ ابزارهای هوش مصنوعی است. از پنل خود می‌توانی موجودی را ببینی و شارژ کنی.' },
  { q: 'چطور آگهی‌ام را پروموت کنم؟', a: 'از پنل، روی آگهی گزینهٔ «نردبان/ویژه» را بزن تا در نتایج بالاتر دیده شود.' },
]
const CATS = [
  { icon: '🔒', label: 'حساب و امنیت' }, { icon: '◔', label: 'پلن و پرداخت' },
  { icon: '🏠', label: 'خرید و فروش' }, { icon: '◆', label: 'شروع کار' },
]

export default function SupportPage() {
  const [open, setOpen] = useState<number | null>(0)
  const [q, setQ] = useState('')
  const faq = FAQ.filter(f => !q.trim() || f.q.includes(q) || f.a.includes(q))

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '30px 18px 70px' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <h1 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 900, margin: 0 }}>چطور می‌تونیم کمکت کنیم؟</h1>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در راهنما و سوالات…" style={{ width: '100%', maxWidth: 540, margin: '18px auto 0', display: 'block', border: '1px solid var(--line2)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, padding: '13px 16px', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 34 }}>
          {CATS.map(c => (
            <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ width: 46, height: 46, margin: '0 auto 10px', borderRadius: 13, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{c.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }} className="sup-grid">
          {/* FAQ */}
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 14px' }}>سوالات پرتکرار</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {faq.map((f, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                  <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '16px 18px', background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', textAlign: 'right' }}>
                    <span>{f.q}</span><span style={{ color: 'var(--gold)', fontSize: 18 }}>{open === i ? '−' : '+'}</span>
                  </button>
                  {open === i && <div style={{ padding: '0 18px 16px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 2 }}>{f.a}</div>}
                </div>
              ))}
              {!faq.length && <div style={{ color: 'var(--faint)', fontSize: 13.5, padding: 12 }}>پاسخی پیدا نشد — می‌توانید تیکت ثبت کنید.</div>}
            </div>
          </section>

          {/* Tickets */}
          <aside>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 14px' }}>تیکت‌های پشتیبانی</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>پاسخ معمولاً کمتر از ۲ ساعت کاری</div>
            <SupportPanel panel="support" />
          </aside>
        </div>
      </main>
      <style>{`@media(max-width:820px){.sup-grid{grid-template-columns:1fr!important}}`}</style>
      <Footer />
    </>
  )
}
