import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import ContactForm from './ContactForm'
import { siteConfig } from '@/app/lib/site-store'

export const metadata = { title: 'تماس با ما' }
export const dynamic = 'force-dynamic'

export default function ContactPage() {
  // فاز ۹۸: متن و اطلاعاتِ تماس از تنظیماتِ سوپرادمین (فوتر ↔ تماس یک منبع دارند)
  const { contact, footer } = siteConfig()
  const rows = [
    footer.phone && { icon: '☎', label: 'تلفن', value: footer.phone, href: `tel:${footer.phone.replace(/[^\d+]/g, '')}` },
    footer.email && { icon: '✉', label: 'ایمیل', value: footer.email, href: `mailto:${footer.email}` },
    footer.address && { icon: '📍', label: 'نشانی', value: footer.address, href: '' },
  ].filter(Boolean) as { icon: string; label: string; value: string; href: string }[]
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '40px 18px 70px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>تماس با ما</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.9, marginBottom: 24 }}>{contact.intro}</p>
        {rows.length > 0 && (
          <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
            {rows.map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px' }}>
                <span style={{ fontSize: 16 }}>{r.icon}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 44 }}>{r.label}</span>
                {r.href
                  ? <a href={r.href} dir="ltr" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>{r.value}</a>
                  : <span style={{ fontSize: 14, fontWeight: 700 }}>{r.value}</span>}
              </div>
            ))}
          </div>
        )}
        {contact.formEnabled !== false && <ContactForm />}
      </main>
      <Footer />
    </div>
  )
}
