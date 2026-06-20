import Link from 'next/link'

const cols = [
  { h: 'محصول', links: [{ t: 'جستجوی هوشمند', href: '/search' }, { t: 'فروشگاه', href: '/store' }, { t: 'بازار مصالح', href: '/materials' }, { t: 'بلاگ', href: '/blog' }] },
  { h: 'برای کسب‌وکار', links: [{ t: 'پنل آژانس', href: '/agency' }, { t: 'مارکتینگ', href: '/marketing' }, { t: 'پلن‌ها و اشتراک', href: '/pricing' }, { t: 'میز کار سازنده', href: '/builder' }, { t: 'CRM مشاوران', href: '/crm' }] },
  { h: 'ملک‌جت', links: [{ t: 'درباره ما', href: '/about' }, { t: 'تماس با ما', href: '/contact' }, { t: 'قوانین و شرایط', href: '/terms' }, { t: 'بلاگ', href: '/blog' }] },
]

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--bg2)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 24px 28px', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 32 }}>
        <div>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: 'var(--text)' }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 13, height: 13, background: 'var(--bg2)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }}></span>
            </span>
            <span style={{ fontWeight: 800, fontSize: 20 }}>ملک‌جت</span>
          </Link>
          <p style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.9, color: 'var(--muted)', maxWidth: 280 }}>بزرگ‌ترین اکوسیستم هوشمند صنعت املاک و ساختمان ایران. تصمیم بهتر، با داده‌ی بهتر.</p>
        </div>
        {cols.map(col => (
          <div key={col.h}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{col.h}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {col.links.map(l => (
                <Link key={l.t} href={l.href} style={{ fontSize: 13.5, color: 'var(--muted)', textDecoration: 'none' }}>{l.t}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '18px 24px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--faint)' }}>
          <span>© ۱۴۰۵ ملک‌جت · تمام حقوق محفوظ است</span>
          <span>ساخته‌شده با ✦ هوش مصنوعی</span>
        </div>
      </div>
    </footer>
  )
}
