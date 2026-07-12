'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DEFAULT_SITE, type SiteFooter } from '@/app/lib/site-defaults'

// فاز ۹۸: فوتر از تنظیماتِ سوپرادمین می‌خواند (admin → تنظیماتِ سایت و صفحه‌ها).
// پیش‌فرض = همان محتوای همیشگی، پس تا وقتی ادمین چیزی عوض نکرده هیچ تغییری دیده
// نمی‌شود؛ پاسخ در sessionStorage کش می‌شود تا در ناوبری‌های بعدی فلیکر نباشد.
const CACHE_KEY = 'mj_site_footer'

export default function Footer() {
  // شروع همیشه با پیش‌فرض (تا SSR و هیدریت یکسان باشند)؛ کش/سرور بعد از mount می‌نشیند
  const [f, setF] = useState<SiteFooter>(DEFAULT_SITE.footer)
  useEffect(() => {
    let alive = true
    try {
      const c = sessionStorage.getItem(CACHE_KEY)
      if (c) setF({ ...DEFAULT_SITE.footer, ...JSON.parse(c) })
    } catch { /* کشِ خراب → پیش‌فرض */ }
    fetch('/api/site').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!alive || !d?.footer) return
      setF({ ...DEFAULT_SITE.footer, ...d.footer })
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(d.footer)) } catch { /* حالت خصوصی */ }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const contactRows = [
    f.phone && { icon: '☎', text: f.phone, href: `tel:${f.phone.replace(/[^\d+]/g, '')}` },
    f.email && { icon: '✉', text: f.email, href: `mailto:${f.email}` },
    f.address && { icon: '📍', text: f.address, href: '' },
  ].filter(Boolean) as { icon: string; text: string; href: string }[]
  const socials = [
    f.instagram && { label: 'اینستاگرام', href: f.instagram },
    f.telegram && { label: 'تلگرام', href: f.telegram },
    f.whatsapp && { label: 'واتساپ', href: f.whatsapp },
  ].filter(Boolean) as { label: string; href: string }[]

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
          <p style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.9, color: 'var(--muted)', maxWidth: 280 }}>{f.blurb}</p>
          {contactRows.length > 0 && (
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              {contactRows.map(c => c.href
                ? <a key={c.text} href={c.href} style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}><span>{c.icon}</span><span dir="ltr">{c.text}</span></a>
                : <span key={c.text} style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 7 }}><span>{c.icon}</span>{c.text}</span>)}
            </div>
          )}
          {socials.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {socials.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--muted)', textDecoration: 'none', border: '1px solid var(--line2)', borderRadius: 999, padding: '5px 12px' }}>{s.label}</a>
              ))}
            </div>
          )}
        </div>
        {f.cols.map(col => (
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
          <span>{f.copyright}</span>
          <span>{f.tagline}</span>
        </div>
      </div>
    </footer>
  )
}
