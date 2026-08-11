import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import PageBody from '@/app/components/PageBody'
import { pageOf } from '@/app/lib/site-store'
import { notFound } from 'next/navigation'

// فاز ۲۵۴ (M3): متادیتای کامل — عنوان/توضیحات/canonical.
export const metadata = {
  title: 'سؤالات متداول | ملک‌جت',
  description: 'پاسخِ پرسش‌های پرتکرار دربارهٔ خرید، فروش، اجاره، آگهی، پلن‌ها و خدماتِ ملک‌جت.',
  alternates: { canonical: 'https://melkjet.com/faq' },
}
export const dynamic = 'force-dynamic'

// پارسِ محتاطانهٔ پرسش/پاسخ از متنِ آزادِ ادمین برای FAQPage JSON-LD: هر خطِ پایان‌یافته به «؟»
// یک پرسش است و متنِ تا پرسشِ بعدی پاسخِ آن. اگر <۲ جفت پیدا شد، اسکیما ساخته نمی‌شود (بی‌خطر).
function faqPairs(body: string): { q: string; a: string }[] {
  const lines = String(body || '').replace(/<[^>]+>/g, '\n').replace(/&[a-z#0-9]+;/gi, ' ').split(/\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const out: { q: string; a: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/[؟?]$/.test(lines[i])) {
      const q = lines[i]; const ans: string[] = []
      let j = i + 1
      while (j < lines.length && !/[؟?]$/.test(lines[j])) { ans.push(lines[j]); j++ }
      const a = ans.join(' ').trim()
      if (q.length > 5 && a) out.push({ q, a: a.slice(0, 600) })
      i = j - 1
    }
  }
  return out.slice(0, 30)
}

export default function FaqPage() {
  // فاز ۹۸: متن از تنظیماتِ سوپرادمین
  const page = pageOf('faq')
  if (!page) notFound()
  const pairs = faqPairs(page.body)
  const faqLd = pairs.length >= 2 ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: pairs.map(p => ({ '@type': 'Question', name: p.q, acceptedAnswer: { '@type': 'Answer', text: p.a } })),
  } : null
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 18px 70px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>{page.title}</h1>
        <PageBody body={page.body} />
      </main>
      <Footer />
    </div>
  )
}
