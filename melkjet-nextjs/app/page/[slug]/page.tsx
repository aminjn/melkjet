import type { Metadata } from 'next'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import PageBody from '@/app/components/PageBody'
import { pageOf } from '@/app/lib/site-store'
import { notFound } from 'next/navigation'

// فاز ۹۸: صفحه‌های سفارشیِ ساخته‌شده در سوپرادمین (admin → تنظیماتِ سایت و صفحه‌ها)
export const revalidate = 600

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug)   // اسلاگِ فارسیِ درصد-کدشده را باز کن (وگرنه pageOf ۴۰۴ می‌دهد)
  const p = pageOf(slug)
  if (!p) return { title: 'یافت نشد | ملک‌جت' }
  const desc = (p.body || '').replace(/[#*>\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155) || p.title
  return { title: `${p.title} | ملک‌جت`, description: desc, alternates: { canonical: `https://melkjet.com/page/${encodeURIComponent(slug)}` } }
}

export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug)
  const page = pageOf(slug)
  if (!page) notFound()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 18px 70px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>{page.title}</h1>
        <PageBody body={page.body} />
      </main>
      <Footer />
    </div>
  )
}
