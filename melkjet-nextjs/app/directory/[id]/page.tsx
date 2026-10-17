// فاز ۳۰۴ — صفحهٔ پروفایلِ داخلیِ متخصصِ دایرکتوری (کارشناسِ رسمی / وکیل) در خودِ ملک‌جت.
// استایل inline + متغیرهای CSS (پروژه Tailwind utility نمی‌سازد).
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import NeshanMap from '@/app/components/NeshanMap'
import ProviderReviews from '@/app/components/ProviderReviews'
import RevealPhoneDir from './RevealPhoneDir'
import { listReviews } from '@/app/lib/reviews-store'
import { getItemById } from '@/app/lib/scraper-store'
import { getSiteStats } from '@/app/lib/site-stats-store'
import { sealPhone, phoneMask } from '@/app/lib/phone-token'
import { canonCat } from '@/app/lib/directory-cats'

export const revalidate = 600
export function generateStaticParams() { return [] }

type Props = { params: Promise<{ id: string }> }
const CAT_FA: Record<string, string> = { 'کارشناس': 'کارشناسِ رسمی دادگستری', 'حقوقی': 'وکیل / دفترِ حقوقی' }

export async function generateMetadata({ params }: Props) {
  const id = decodeURIComponent((await params).id)
  const it = await getItemById(id)
  if (!it || it.type !== 'directory') return { title: 'یافت نشد | ملک‌جت' }
  const role = CAT_FA[canonCat(it.category)] || 'متخصص'
  return { title: `${it.title} — ${role} | ملک‌جت`, description: `${it.title}، ${role}${it.location ? ` در ${it.location}` : ''}.`, alternates: { canonical: `https://melkjet.com/directory/${encodeURIComponent(id)}` } }
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px -6px rgba(0,0,0,0.25)' }
const h2: CSSProperties = { fontSize: '1.02rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 12px' }
const faDigit = (s?: string) => String(s || '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])

export default async function DirectoryProfilePage({ params }: Props) {
  const id = decodeURIComponent((await params).id)
  const it = await getItemById(id)
  if (!it || it.type !== 'directory') notFound()
  const m = (it.meta || {}) as Record<string, string>
  const role = CAT_FA[canonCat(it.category)] || it.category || 'متخصص'
  const lat = Number(m['__lat']), lng = Number(m['__lng'])
  const hasMap = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.1
  // شماره‌ها «سربسته» (توکنِ رمزنگاری‌شده) به مرورگر می‌روند؛ با کلیکِ «نمایشِ شماره» باز می‌شوند.
  const phones = ([{ raw: it.phone, label: 'همراه' }, { raw: m['تلفن موسسه'], label: 'دفتر' }] as { raw?: string; label: string }[])
    .filter(x => String(x.raw || '').trim())
    .map(x => ({ token: sealPhone(String(x.raw)), mask: phoneMask(String(x.raw)), label: x.label }))
  const reveals = (await getSiteStats('dir:' + id))?.totalP || 0
  const rows: [string, string][] = ([
    ['پایه', m['پایه']], ['رشتهٔ کارشناسی', m['رشته']], ['شمارهٔ پروانه', faDigit(m['شماره پروانه'])],
    ['اعتبارِ پروانه', faDigit(m['اعتبار پروانه'])], ['استان', m['استان']], ['شهر', m['شهر']], ['آدرس', m['آدرس']],
  ] as [string, string][]).filter(([, v]) => v && v.trim())
  const our = listReviews('dir:' + id).slice(0, 30).map(r => ({ name: r.name, text: r.text, rating: Math.max(0, Math.min(5, Number(r.rating) || 0)), createdAt: r.createdAt }))
  const ld = { '@context': 'https://schema.org', '@type': 'Person', name: it.title, jobTitle: role, address: m['شهر'] ? { '@type': 'PostalAddress', addressLocality: m['شهر'], addressRegion: m['استان'], addressCountry: 'IR' } : undefined }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Nav />
      <main style={{ maxWidth: 940, margin: '0 auto', padding: '22px 16px 60px' }}>
        <nav style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
          <a href="/directory" style={{ color: 'var(--muted)' }}>دایرکتوری متخصصان</a> › <a href={`/directory?category=${encodeURIComponent(it.category || '')}`} style={{ color: 'var(--muted)' }}>{role}</a> › <span style={{ color: 'var(--text)' }}>{it.title}</span>
        </nav>

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)' }}>{it.title}</div>
          <div style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 700, marginTop: 4 }}>{role}</div>
          {it.location && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>📍 {it.location}</div>}
          {(it.excerpt || m['صلاحیت']) && <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 2, marginTop: 12, whiteSpace: 'pre-wrap' }}>{m['صلاحیت'] || it.excerpt}</p>}
          <div style={{ marginTop: 14 }}>
            <RevealPhoneDir id={id} phones={phones} />
          </div>
          {reveals > 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>👁 شمارهٔ این متخصص {faDigit(String(reveals))} بار نمایش داده شده</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: hasMap ? '1fr 1fr' : '1fr', gap: 16 }} className="mjs-dir2">
          {rows.length > 0 && <section style={card}>
            <h2 style={h2}>مشخصات</h2>
            <div style={{ display: 'grid', gap: 9 }}>
              {rows.map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13, borderBottom: '1px dashed var(--line)', paddingBottom: 7 }}><span style={{ color: 'var(--muted)' }}>{k}</span><span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'left' }}>{v}</span></div>)}
            </div>
          </section>}
          {hasMap && <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <NeshanMap points={[{ id, lat, lng, title: it.title }]} center={{ lat, lng }} zoom={14} height={rows.length ? 280 : 340} />
          </section>}
        </div>

        <div style={{ ...card, marginTop: 16 }}>
          <h2 style={h2}>نظرات</h2>
          <ProviderReviews ptype="directory" pslug={id} reviews={our} />
        </div>
      </main>
      <Footer />
      <style>{`@media(max-width:720px){.mjs-dir2{grid-template-columns:1fr!important}}`}</style>
    </>
  )
}
