import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

export const dynamic = 'force-dynamic'

// فاز ۲۱۹ (فیدبک: «خیلی چیزها تو سایت‌مپ هست ولی تو پیج‌ها نیست — کلِ سایت را بگرد») —
// هاب‌های متخصصان/سازنده‌ها/محصولات/فروشگاه‌ها 'use client' بودند و لینک‌هایشان بعدِ hydration
// از API می‌آمد → هزاران URLِ سایت‌مپی «بدونِ لینکِ داخلیِ SSR» (یتیم برای خزنده). این هاب
// سرورساید است، از «دقیقاً همان منابعِ سایت‌مپ» می‌خواند (تطابقِ تضمینی) و به تک‌تکشان لینکِ
// واقعیِ HTML می‌دهد — با صفحه‌بندی، مثلِ /listings.

const PER = 100
const GROUPS: Record<string, string> = {
  specialists: 'متخصصانِ املاک',
  builders: 'سازندگان',
  products: 'محصولاتِ مصالح',
  stores: 'فروشگاه‌های مصالح',
}

async function loadGroup(g: string): Promise<{ name: string; href: string }[]> {
  try {
    if (g === 'specialists') {
      const { listAccounts } = await import('@/app/lib/account-store')
      const { urlTypeForRole } = await import('@/app/lib/provider-public')
      const { allProviderSlugsByPhone } = await import('@/app/lib/provider-slug-store')
      const map = await allProviderSlugsByPhone()
      const norm = (p: string) => String(p || '').replace(/\D/g, '')
      const out: { name: string; href: string }[] = []
      for (const a of listAccounts()) {
        const type = urlTypeForRole(a.role); if (!type) continue
        const slug = map[norm(a.phone)]; if (!slug) continue
        out.push({ name: a.name || slug.replace(/-/g, ' '), href: `/${type}/${slug}` })
      }
      return out
    }
    if (g === 'builders') {
      const { allBuilderSlugsById } = await import('@/app/lib/builder-slug-store')
      const map = await allBuilderSlugsById()
      return Object.values(map).map((slug: string) => ({ name: slug.replace(/-/g, ' '), href: `/builders/${slug}` }))
    }
    if (g === 'products') {
      const { allProductSlugsById } = await import('@/app/lib/product-slug-store')
      const map = await allProductSlugsById()
      return Object.values(map).map((slug: string) => ({ name: slug.replace(/-/g, ' '), href: `/product/${slug}` }))
    }
    if (g === 'stores') {
      const { listPublicShops } = await import('@/app/lib/materials-store')
      const shops = await listPublicShops()
      return (shops || []).filter((s: { slug?: string }) => s.slug).map((s: { slug?: string; name?: string }) => ({ name: s.name || String(s.slug).replace(/-/g, ' '), href: `/store/${s.slug}` }))
    }
  } catch { /* فهرستِ خالی، نه کرش */ }
  return []
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ group?: string[] }>; searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const { group } = await params
  const { page } = await searchParams
  const g = (group || [])[0]
  const p = Math.max(1, parseInt(page || '1', 10) || 1)
  const title = g && GROUPS[g] ? `فهرستِ ${GROUPS[g]}${p > 1 ? ` — صفحهٔ ${p}` : ''}` : 'مرورِ کاملِ ملک‌جت'
  const url = `https://melkjet.com/browse${g ? '/' + g : ''}${p > 1 ? `?page=${p}` : ''}`
  return { title: `${title} | ملک‌جت`, description: 'فهرستِ کاملِ متخصصان، سازندگان، محصولات و فروشگاه‌های ملک‌جت.', alternates: { canonical: url } }
}

export default async function Browse({ params, searchParams }: { params: Promise<{ group?: string[] }>; searchParams: Promise<{ page?: string }> }) {
  const { group } = await params
  const { page } = await searchParams
  const parts = (group || []).filter(Boolean)
  if (parts.length > 1) notFound()
  const g = parts[0]
  if (g && !GROUPS[g]) notFound()

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '26px 22px 70px' }}>{children}</div>
      <Footer />
    </div>
  )

  if (!g) {
    const counts = await Promise.all(Object.keys(GROUPS).map(async k => ({ k, n: (await loadGroup(k)).length })))
    return wrap(
      <>
        <h1 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 900, margin: '0 0 8px' }}>مرورِ کاملِ ملک‌جت</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 22px' }}>دسترسیِ یک‌جا به همهٔ بخش‌های عمومیِ سایت.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14 }}>
          {counts.map(({ k, n }) => (
            <Link key={k} href={`/browse/${k}`} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 18px', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontSize: 15.5, fontWeight: 800 }}>{GROUPS[k]}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{n.toLocaleString('fa-IR')} مورد</div>
            </Link>
          ))}
          <Link href="/listings" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 18px', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 15.5, fontWeight: 800 }}>آگهی‌های ملک</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>فهرستِ کامل با صفحه‌بندی</div>
          </Link>
          <Link href="/locations" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 18px', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 15.5, fontWeight: 800 }}>شهرها و محله‌ها</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>مرور بر اساسِ مکان</div>
          </Link>
        </div>
      </>
    )
  }

  const all = await loadGroup(g)
  const totalPages = Math.max(1, Math.ceil(all.length / PER))
  const p = Math.min(totalPages, Math.max(1, parseInt(page || '1', 10) || 1))
  const items = all.slice((p - 1) * PER, p * PER)
  const pageHref = (n: number) => (n <= 1 ? `/browse/${g}` : `/browse/${g}?page=${n}`)

  return wrap(
    <>
      <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, display: 'flex', gap: 6 }}>
        <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span>
        <Link href="/browse" style={{ color: 'var(--muted)' }}>مرورِ کامل</Link><span>›</span>
        <span style={{ color: 'var(--gold)' }}>{GROUPS[g]}</span>
      </nav>
      <h1 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 900, margin: '0 0 6px' }}>فهرستِ {GROUPS[g]}</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '0 0 20px' }}>{all.length.toLocaleString('fa-IR')} مورد{totalPages > 1 ? ` · صفحهٔ ${p.toLocaleString('fa-IR')} از ${totalPages.toLocaleString('fa-IR')}` : ''}</p>
      {items.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--line2)', borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>موردی ثبت نشده است.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 8 }}>
          {items.map(it => (
            <li key={it.href}>
              <Link href={it.href} style={{ display: 'block', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, textDecoration: 'none', color: 'var(--text)', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</Link>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <nav aria-label="صفحه‌ها" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 26 }}>
          {p > 1 && <Link href={pageHref(p - 1)} style={pchip}>← قبلی</Link>}
          {Array.from(new Set([1, totalPages, p - 1, p, p + 1].filter(n => n >= 1 && n <= totalPages))).sort((a, b) => a - b).map(n => (
            <Link key={n} href={pageHref(n)} style={{ ...pchip, ...(n === p ? { borderColor: 'var(--gold)', color: 'var(--gold)', background: 'var(--goldDim)' } : {}) }}>{n.toLocaleString('fa-IR')}</Link>
          ))}
          {p < totalPages && <Link href={pageHref(p + 1)} style={pchip}>بعدی ←</Link>}
        </nav>
      )}
    </>
  )
}

const pchip: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, textDecoration: 'none', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)' }
