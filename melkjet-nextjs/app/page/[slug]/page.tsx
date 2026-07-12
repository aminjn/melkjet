import type { Metadata } from 'next'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import PageBody from '@/app/components/PageBody'
import { pageOf } from '@/app/lib/site-store'
import { notFound } from 'next/navigation'

// فاز ۹۸: صفحه‌های سفارشیِ ساخته‌شده در سوپرادمین (admin → تنظیماتِ سایت و صفحه‌ها)
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = pageOf(slug)
  return { title: p ? `${p.title} | ملک‌جت` : 'ملک‌جت', alternates: { canonical: `https://melkjet.com/page/${slug}` } }
}

export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
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
