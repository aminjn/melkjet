import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import PageBody from '@/app/components/PageBody'
import { getHomeData } from '@/app/lib/home-data'
import { pageOf } from '@/app/lib/site-store'
import { notFound } from 'next/navigation'

export const metadata = { title: 'دربارهٔ ملک‌جت' }
export const dynamic = 'force-dynamic'

export default async function AboutPage() {
  // فاز ۹۸: متن از تنظیماتِ سوپرادمین (admin → تنظیماتِ سایت و صفحه‌ها)
  const page = pageOf('about')
  if (!page) notFound()
  // آمارِ واقعیِ سیستم — همان منبعِ صفحهٔ اصلی؛ بدونِ عددِ ساختگی (اگر نبود، بخش پنهان می‌شود).
  let stats: { n: string; l: string }[] = []
  try {
    const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
    const { sysStats } = await getHomeData()
    stats = [
      { n: `${fa(sysStats.listings)}+`, l: 'آگهیِ فعالِ ملک' },
      { n: `${fa(sysStats.products)}+`, l: 'محصولِ مصالح' },
      { n: `${fa(sysStats.shops)}+`, l: 'فروشگاهِ مصالح' },
      { n: `${fa(sysStats.advisors)}+`, l: 'متخصص و مشاور' },
      { n: `${fa(sysStats.builders)}+`, l: 'سازنده در دیتابیس' },
    ]
  } catch {}
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 18px 70px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 14 }}>{page.title}</h1>
        <PageBody body={page.body} />
        {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, margin: '30px 0' }}>
          {stats.map(s => (
            <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--goldText)' }}>{s.n}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
