import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { locationTree, resolveLocationPath, type LocationNode } from '@/app/lib/locations-store'
import { listItems } from '@/app/lib/scraper-store'
import { gradientFor, initialsFor } from '@/app/lib/content-display'
import { providersInArea } from '@/app/lib/provider-public'
import { listingHref } from '@/app/lib/listing-url'

export const dynamic = 'force-dynamic'

// اکشن‌های Programmatic زیرِ هر مکان (خرید/اجاره/متخصصان/…).
const ACTIONS: Record<string, { fa: string; deal?: 'sale' | 'rent'; kind: 'listing' | 'provider' | 'info' | 'project'; types?: string[] }> = {
  buy: { fa: 'خرید', deal: 'sale', kind: 'listing' },
  rent: { fa: 'اجاره', deal: 'rent', kind: 'listing' },
  investment: { fa: 'سرمایه‌گذاری', kind: 'listing' },
  'market-analysis': { fa: 'تحلیل بازار', kind: 'info' },
  agents: { fa: 'مشاوران املاک', kind: 'provider', types: ['pros'] },
  agencies: { fa: 'آژانس‌های املاک', kind: 'provider', types: ['agency'] },
  builders: { fa: 'سازندگان', kind: 'provider', types: ['builder'] },
  architects: { fa: 'معماران', kind: 'provider', types: ['architect'] },
  contractors: { fa: 'پیمانکاران', kind: 'provider', types: ['contractor'] },
  legal: { fa: 'خدماتِ حقوقی', kind: 'provider', types: ['legal', 'lawfirm'] },
  finance: { fa: 'وام و بیمه', kind: 'provider', types: ['finance'] },
  projects: { fa: 'پروژه‌های ساختمانی', kind: 'project' },
}

function parse(path?: string[]): { locSlugs: string[]; action?: string } {
  const p = (path || []).filter(Boolean)
  if (p.length && ACTIONS[p[p.length - 1]]) return { locSlugs: p.slice(0, -1), action: p[p.length - 1] }
  return { locSlugs: p }
}
const money = (s?: string) => (s || '').trim()
async function listingsIn(node: LocationNode | null): Promise<any[]> {
  if (!node) return []
  const all = await listItems('listing', { publicOnly: true })
  const name = node.nameFa
  return all.filter(it => `${it.location || ''} ${it.title || ''}`.includes(name))
}

export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }): Promise<Metadata> {
  const { path } = await params
  const { locSlugs, action } = parse(path)
  if (locSlugs.length === 0) return { title: 'مناطق و محله‌های ایران | ملک‌جت', description: 'خرید، اجاره و سرمایه‌گذاری ملک در همهٔ شهرها و محله‌های ایران.', alternates: { canonical: 'https://melkjet.com/locations' } }
  const r = resolveLocationPath(locSlugs)
  if (!r) return { title: 'یافت نشد | ملک‌جت' }
  const act = action ? ACTIONS[action] : null
  const name = r.node.nameFa
  const title = act ? `${act.fa} در ${name}` : `املاک ${name} — خرید، اجاره و قیمت`
  const listings = act?.kind !== 'provider' ? await listingsIn(r.node) : []
  const thin = !act && r.node.children.length === 0 && listings.length < 3
  const url = `https://melkjet.com/locations/${locSlugs.join('/')}${action ? '/' + action : ''}`
  return { title: `${title} | ملک‌جت`, description: `${title} در ملک‌جت — آگهی‌ها، متخصصان و اطلاعاتِ بازارِ ${name}.`, alternates: { canonical: url }, robots: thin ? { index: false, follow: true } : undefined }
}

export default async function LocationPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params
  const { locSlugs, action } = parse(path)

  // ریشه: فهرستِ شهرها (از استان‌ها).
  if (locSlugs.length === 0) {
    const cities: LocationNode[] = locationTree().flatMap(p => p.children)
    return <Shell trail={[]} title="مناطق و محله‌های ایران" intro="شهر یا محلهٔ موردِ نظر را انتخاب کنید تا آگهی‌ها، متخصصان و تحلیلِ بازارِ آن را ببینید.">
      <Grid nodes={cities} base="/locations" />
    </Shell>
  }

  const r = resolveLocationPath(locSlugs)
  if (!r) notFound()
  const node = r.node
  const base = `/locations/${node.path.join('/')}`
  const act = action ? ACTIONS[action] : null

  // پاراگرافِ پویا (ضدِ محتوای تکراری) + داده.
  const listings = (!act || act.kind === 'listing') ? await (async () => {
    let ls = await listingsIn(node)
    if (act?.deal) ls = ls.filter(it => act.deal === 'rent' ? /اجاره|رهن|ودیعه/.test(`${it.price} ${it.title} ${it.meta?.['نوع معامله'] || ''}`) : !/اجاره|رهن|ودیعه/.test(`${it.price} ${it.title} ${it.meta?.['نوع معامله'] || ''}`))
    return ls
  })() : []

  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://melkjet.com/' }, { '@type': 'ListItem', position: 2, name: 'مناطق', item: 'https://melkjet.com/locations' },
      ...r.trail.map((t, i) => ({ '@type': 'ListItem', position: 3 + i, name: t.nameFa, item: `https://melkjet.com/locations/${t.path.join('/')}` }))],
  }

  const title = act ? `${act.fa} در ${node.nameFa}` : `املاک ${node.nameFa}`
  const intro = act
    ? `فهرستِ ${act.fa} در ${node.nameFa}. ${listings.length ? `${listings.length.toLocaleString('fa-IR')} مورد یافت شد.` : 'به‌زودی موارد بیشتری اضافه می‌شود.'}`
    : `${node.type === 'city' ? 'شهرِ' : node.type === 'district' ? 'منطقهٔ' : 'محلهٔ'} ${node.nameFa}: ${node.children.length ? `${node.children.length.toLocaleString('fa-IR')} ${node.type === 'city' ? 'منطقه' : 'محله'} و ` : ''}${listings.length.toLocaleString('fa-IR')} آگهیِ فعال. خرید، اجاره، متخصصان و تحلیلِ بازارِ این ${node.type === 'neighborhood' ? 'محله' : 'منطقه'} را این‌جا ببینید.`

  return (
    <Shell trail={r.trail} title={title} intro={intro} crumbLd={crumbLd}>
      {/* تب‌های اکشن */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        <ActionTab href={base} label="نمای کلی" on={!action} />
        {Object.entries(ACTIONS).map(([k, v]) => <ActionTab key={k} href={`${base}/${k}`} label={v.fa} on={action === k} />)}
      </div>

      {/* فرزندان (منطقه/محله) */}
      {!action && node.children.length > 0 && <>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '10px 0 12px' }}>{node.type === 'city' ? 'مناطق' : 'محله‌ها'}</h2>
        <Grid nodes={node.children} base="/locations" />
      </>}

      {/* آگهی‌ها */}
      {(!act || act.kind === 'listing') && <>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '26px 0 12px' }}>آگهی‌های {act ? act.fa : node.nameFa}</h2>
        {listings.length === 0 ? <Empty text="هنوز آگهیِ فعالی در این محدوده ثبت نشده است." />
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
            {listings.slice(0, 24).map(it => (
              <Link key={it.id} href={it.url || listingHref(it.id, it.title, it.location)} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ height: 150, background: it.image ? `center/cover no-repeat url(${it.image})` : gradientFor(it.title) }} />
                <div style={{ padding: '13px 15px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>{money(it.price) || '—'}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{it.location}</div>
                </div>
              </Link>
            ))}
          </div>}
      </>}

      {/* متخصصانِ همان محدوده (داده‌محور) */}
      {act && act.kind === 'provider' && await (async () => {
        const provs = await providersInArea(act.types || [], r.trail.map(t => t.nameFa))
        return <>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '10px 0 12px' }}>{act.fa} در {node.nameFa}</h2>
          {provs.length === 0 ? <Empty text={`هنوز ${act.fa} در این محدوده ثبت نشده است.`} extra={<Link href="/directory" style={{ color: 'var(--gold)', fontWeight: 700 }}>مشاهدهٔ همهٔ متخصصان ←</Link>} />
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
              {provs.map(p => (
                <Link key={p.phone} href={`/${p.type}/${p.slug}`} style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit', background: 'var(--surface)', border: `1px solid ${p.promoted ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 14, padding: '13px 15px' }}>
                  {p.photo ? <img src={p.photo} alt={p.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 48, height: 48, borderRadius: '50%', background: gradientFor(p.name, 'avatar'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{initialsFor(p.name)}</span>}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.promoted && <span style={{ color: 'var(--gold)', marginInlineStart: 5 }}>★</span>}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{p.typeLabel}{p.city ? ` · ${p.city}` : ''}</span>
                  </span>
                </Link>
              ))}
            </div>}
        </>
      })()}

      {act && act.kind === 'project' && (
        <Empty text={`پروژه‌های ${node.nameFa} را در صفحهٔ پروژه‌ها ببینید.`} extra={<Link href="/projects" style={{ color: 'var(--gold)', fontWeight: 700 }}>مشاهدهٔ پروژه‌ها ←</Link>} />
      )}
      {act && act.kind === 'info' && <Empty text={`تحلیلِ بازارِ ${node.nameFa} به‌زودی از دادهٔ واقعیِ آگهی‌ها تولید می‌شود.`} />}
    </Shell>
  )
}

/* ── اجزا ── */
function Shell({ trail, title, intro, crumbLd, children }: { trail: LocationNode[]; title: string; intro: string; crumbLd?: any; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      {crumbLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '26px 22px 70px' }}>
        <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span>
          <Link href="/locations" style={{ color: trail.length ? 'var(--muted)' : 'var(--gold)' }}>مناطق</Link>
          {trail.map((t, i) => <span key={t.slug} style={{ display: 'inline-flex', gap: 6 }}><span>›</span><Link href={`/locations/${t.path.join('/')}`} style={{ color: i === trail.length - 1 ? 'var(--gold)' : 'var(--muted)' }}>{t.nameFa}</Link></span>)}
        </nav>
        <h1 style={{ fontSize: 'clamp(23px,4vw,34px)', fontWeight: 900, margin: '0 0 10px' }}>{title}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 2, margin: '0 0 22px', maxWidth: '70ch' }}>{intro}</p>
        {children}
      </div>
      <Footer />
    </div>
  )
}
function Grid({ nodes, base }: { nodes: LocationNode[]; base: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
    {nodes.map(n => <Link key={n.slug} href={`${base}/${n.path.join('/')}`} style={{ display: 'block', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 11, padding: '13px 15px', color: 'var(--text)', fontSize: 13.5, fontWeight: 700 }}>{n.nameFa}<span style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)', fontFamily: 'monospace', direction: 'ltr', marginTop: 3 }}>{n.slug}</span></Link>)}
  </div>
}
function ActionTab({ href, label, on }: { href: string; label: string; on: boolean }) {
  return <Link href={href} style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, textDecoration: 'none', border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}`, background: on ? 'var(--goldDim)' : 'var(--surface)', color: on ? 'var(--gold)' : 'var(--muted)' }}>{label}</Link>
}
function Empty({ text, extra }: { text: string; extra?: React.ReactNode }) {
  return <div style={{ background: 'var(--surface)', border: '1px dashed var(--line2)', borderRadius: 14, padding: '28px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>{text}{extra && <div style={{ marginTop: 10 }}>{extra}</div>}</div>
}
