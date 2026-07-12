import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import PageBody from '@/app/components/PageBody'
import { pageOf } from '@/app/lib/site-store'
import { notFound } from 'next/navigation'

export const metadata = { title: 'حریم خصوصی' }
export const dynamic = 'force-dynamic'

export default function PrivacyPage() {
  // فاز ۹۸: متن از تنظیماتِ سوپرادمین
  const page = pageOf('privacy')
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
