import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

export const metadata = { title: 'دربارهٔ ملک‌جت' }

const stats = [
  { n: '۲۴۰٬۰۰۰+', l: 'فایل فعال' }, { n: '۱۸٬۵۰۰', l: 'مشاور تأییدشده' },
  { n: '۴۲', l: 'شهر تحت پوشش' }, { n: '۹۸٪', l: 'دقت تحلیل قیمت' },
]
const values = [
  { t: 'داده‌محور', d: 'هر تصمیم را با داده‌های واقعی بازار، نه حدس، می‌سازیم.' },
  { t: 'هوش مصنوعی واقعی', d: 'از تحلیل قیمت تا تولید محتوا و دستیار، همه‌جا AI واقعی کار می‌کند.' },
  { t: 'شفافیت', d: 'امتیازها و تحلیل‌ها با منطق و فرمول مشخص ارائه می‌شوند.' },
  { t: 'بومی ایران', d: 'با سرویس‌های داخلی (نشان، دیوار) و زیرساخت داخل کشور.' },
]

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 18px 70px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 14 }}>دربارهٔ ملک‌جت</h1>
        <p style={{ fontSize: 15.5, lineHeight: 2.1, color: 'var(--muted)' }}>
          ملک‌جت یک پلتفرم هوشمند و داده‌محورِ صنعت املاک و ساختمان ایران است. هدف ما این است که خرید، فروش، اجاره و سرمایه‌گذاری ملک را با کمک هوش مصنوعی، ساده‌تر، شفاف‌تر و مطمئن‌تر کنیم. از جستجوی هوشمند و تحلیل قیمت واقعی تا CRM مشاوران، تولید محتوا، و ابزارهای بازاریابی — همه در یک اکوسیستم یکپارچه.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, margin: '30px 0' }}>
          {stats.map(s => (
            <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gold)' }}>{s.n}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '10px 0 16px' }}>ارزش‌های ما</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          {values.map(v => (
            <div key={v.t} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--gold)' }}>{v.t}</div>
              <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.9 }}>{v.d}</div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
