import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import CardImg from '@/app/components/CardImg'
import { listItems } from '@/app/lib/scraper-store'
import { gradientFor } from '@/app/lib/content-display'
import { listingHref } from '@/app/lib/listing-url'

export const dynamic = 'force-dynamic'

// فیلترهای نوع/معاملهٔ آگهی (هاب). صفحاتِ محله‌محور زیرِ /locations/** هستند.
const FILTERS: Record<string, { fa: string; match: (it: any) => boolean }> = {
  sale: { fa: 'خرید و فروش', match: it => !/اجاره|رهن|ودیعه/.test(hay(it)) },
  rent: { fa: 'رهن و اجاره', match: it => /اجاره|رهن|ودیعه/.test(hay(it)) },
  'pre-sale': { fa: 'پیش‌فروش', match: it => /پیش[‌\s]?فروش/.test(hay(it)) },
  villa: { fa: 'ویلا و خانه', match: it => /ویلا|خانه|کلنگی|باغ/.test(hay(it)) },
  office: { fa: 'اداری و دفتر', match: it => /اداری|دفتر|دفترکار/.test(hay(it)) },
  shop: { fa: 'مغازه و تجاری', match: it => /مغازه|تجاری|سرقفلی/.test(hay(it)) },
  land: { fa: 'زمین و کلنگی', match: it => /زمین|کلنگی|قطعه/.test(hay(it)) },
}
const hay = (it: any) => `${it.title || ''} ${it.category || ''} ${it.price || ''} ${it.meta?.['نوع معامله'] || ''}`
const money = (s?: string) => (s || '').trim()

const PER_PAGE = 48

export async function generateMetadata({ params, searchParams }: { params: Promise<{ filter?: string[] }>; searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const { filter } = await params
  const { page } = await searchParams
  const p = Math.max(1, parseInt(page || '1', 10) || 1)
  const key = (filter || [])[0]
  const f = key ? FILTERS[key] : null
  const title = f ? `${f.fa} ملک در ایران` : 'آگهی‌های ملک — خرید، اجاره و پیش‌فروش'
  const url = `https://melkjet.com/listings${key ? '/' + key : ''}${p > 1 ? `?page=${p}` : ''}`
  return { title: `${title}${p > 1 ? ` — صفحهٔ ${p}` : ''} | ملک‌جت`, description: `${title} در ملک‌جت — جدیدترین آگهی‌های خرید، رهن و اجارهٔ املاک.`, alternates: { canonical: url } }
}

export default async function Listings({ params, searchParams }: { params: Promise<{ filter?: string[] }>; searchParams: Promise<{ page?: string }> }) {
  const { filter } = await params
  const { page } = await searchParams
  const parts = (filter || []).filter(Boolean)
  if (parts.length > 1) notFound()
  const key = parts[0]
  const f = key ? FILTERS[key] : null
  if (key && !f) notFound()

  let items = await listItems('listing', { publicOnly: true })
  if (f) items = items.filter(f.match)

  // فاز ۲۱۷ (سئو — «چرا گوگل آگهی‌ها را نمی‌گیرد؟»): صفحه‌بندیِ SSR — قبلاً فقط ۴۸ آگهیِ اول لینکِ
  // داخلی داشت و ~۱۲هزار آگهیِ دیگر فقط به سایت‌مپ تکیه داشتند؛ برای دامنهٔ جوان، گوگل URLِ
  // بدونِ لینکِ داخلی را با اولویتِ خیلی پایین می‌خزد. حالا زنجیرهٔ لینکِ خزیدنی به همهٔ آگهی‌ها هست.
  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE))
  const p = Math.min(totalPages, Math.max(1, parseInt(page || '1', 10) || 1))
  const pageItems = items.slice((p - 1) * PER_PAGE, p * PER_PAGE)
  const hub = `/listings${key ? '/' + key : ''}`
  const pageHref = (n: number) => (n <= 1 ? hub : `${hub}?page=${n}`)
  // پنجرهٔ شماره‌ها: اول، آخر، و اطرافِ صفحهٔ فعلی
  const nums = Array.from(new Set([1, totalPages, p - 2, p - 1, p, p + 1, p + 2].filter(n => n >= 1 && n <= totalPages))).sort((a, b) => a - b)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '26px 22px 70px' }}>
        <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span>
          <Link href="/listings" style={{ color: f ? 'var(--muted)' : 'var(--gold)' }}>آگهی‌ها</Link>
          {f && <><span>›</span><span style={{ color: 'var(--gold)' }}>{f.fa}</span></>}
        </nav>
        <h1 style={{ fontSize: 'clamp(23px,4vw,34px)', fontWeight: 900, margin: '0 0 6px' }}>{f ? `${f.fa} ملک` : 'آگهی‌های ملک'}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 18px' }}>{items.length.toLocaleString('fa-IR')} آگهیِ فعال</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <Link href="/listings" style={chip(!key)}>همه</Link>
          {Object.entries(FILTERS).map(([k, v]) => <Link key={k} href={`/listings/${k}`} style={chip(key === k)}>{v.fa}</Link>)}
        </div>

        {items.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--line2)', borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>آگهیِ فعالی در این دسته نیست.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
            {/* فاز ۲۱۷: لینکِ کارت همیشه داخلی — it.url برای آگهی‌های دیواری آدرسِ divar.ir بود و
                هاب، کاربر و گوگل را به سایتِ دیگر می‌فرستاد (نشتِ سئو + تجربهٔ غلط) */}
            {pageItems.map((it, i) => (
              <Link key={it.id} href={listingHref(it.id, it.title, it.location)} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ height: 152, position: 'relative', overflow: 'hidden', background: it.image ? undefined : gradientFor(it.title) }}>
                  {it.image && <CardImg src={it.image} alt={it.title} eager={i < 3} priority={i < 2 ? 'high' : undefined} />}
                </div>
                <div style={{ padding: '13px 15px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>{money(it.price) || '—'}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{it.location}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {/* فاز ۲۱۷ — ناوبریِ صفحه‌بندیِ SSR: مسیرِ خزیدنی به تک‌تکِ آگهی‌ها */}
        {totalPages > 1 && (
          <nav aria-label="صفحه‌ها" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 30 }}>
            {p > 1 && <Link href={pageHref(p - 1)} style={chip(false)}>← قبلی</Link>}
            {nums.map((n, i) => (
              <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && nums[i - 1] < n - 1 && <span style={{ color: 'var(--faint)' }}>…</span>}
                <Link href={pageHref(n)} style={chip(n === p)}>{n.toLocaleString('fa-IR')}</Link>
              </span>
            ))}
            {p < totalPages && <Link href={pageHref(p + 1)} style={chip(false)}>بعدی ←</Link>}
          </nav>
        )}
        <p style={{ marginTop: 26, fontSize: 13, color: 'var(--muted)' }}>به‌دنبالِ ملک در محلهٔ خاصی هستید؟ <Link href="/locations" style={{ color: 'var(--gold)', fontWeight: 700 }}>مرور بر اساسِ محله ←</Link></p>
      </div>
      <Footer />
    </div>
  )
}
function chip(on: boolean): React.CSSProperties {
  return { fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, textDecoration: 'none', border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}`, background: on ? 'var(--goldDim)' : 'var(--surface)', color: on ? 'var(--gold)' : 'var(--muted)' }
}
