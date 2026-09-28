import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import RevealContact from '@/app/components/RevealContact'
import { listingHref } from '@/app/lib/listing-url'
import RepBadges from '@/app/components/RepBadges'
import ProInquiryForm from '@/app/components/ProInquiryForm'
import { resolveProvider, typeLabel } from '@/app/lib/provider-public'
import { gradientFor, initialsFor } from '@/app/lib/content-display'
import ProjectsMap from '@/app/components/ProjectsMap'

// Only these provider types have a ProDesk inbox that can receive an inquiry.
const PRO_INQUIRY_TYPES = ['architect', 'contractor', 'appraiser', 'lawfirm', 'finance', 'notary', 'legal']

// متایِ SSR برای صفحهٔ عمومیِ یک متخصص.
export async function providerMetadata(type: string, slug: string): Promise<Metadata> {
  const p = await resolveProvider(type, slug)
  if (!p) return { title: 'متخصص یافت نشد | ملک‌جت' }
  const url = `https://melkjet.com/${p.type}/${p.slug}`
  const title = `${p.name} — ${p.typeLabel}${p.city ? ` در ${p.city}` : ''}`
  const desc = (p.bio || `${p.name}، ${p.typeLabel}${p.city ? ` در ${p.city}` : ''} در ملک‌جت. مشاهدهٔ آگهی‌ها و اطلاعاتِ تماس.`).replace(/<[^>]+>/g, '').slice(0, 160)
  return { title: `${title} | ملک‌جت`, description: desc, alternates: { canonical: url }, openGraph: { title, description: desc, url, type: 'profile', images: p.photo ? [p.photo] : undefined } }
}

export default async function ProviderProfilePage({ type, slug }: { type: string; slug: string }) {
  const p = await resolveProvider(type, slug)
  if (!p) notFound()
  if (p.type !== type) redirect(`/${p.type}/${p.slug}`)   // canonicalِ نوعِ درست

  // فاز ۲۸۸ — دادهٔ کاملِ معمارِ اسکرپ‌شده (طرح‌۲طرح): آمار، پروژه‌ها، نقشه، افتخارات.
  // اعداد و برچسب‌ها واقعیت‌های ساخت‌یافته‌اند؛ هیچ متنِ آزادِ مبدأ عینا نمایش داده نمی‌شود (سئو).
  let arch: import('@/app/lib/tarh2tarh-store').T2tProfile | null = null
  if (type === 'architect' && p.phone) {
    try { const { getArchitectPublic } = await import('@/app/lib/tarh2tarh-store'); arch = await getArchitectPublic(p.phone) } catch {}
  }
  const archProjects = (arch?.projects || []).filter(x => x.title || x.image || x.city || x.builtArea)
  const archPins = (arch?.projects || [])
    .map((x, i) => ({ id: 'pr' + i, lat: x.lat as number, lng: x.lng as number, title: x.title }))
    .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng))
  const faN = (n?: number) => (n ?? 0).toLocaleString('fa-IR')

  // فاز ۲۵۴ (سئو L4): فیلدهای خالی از JSON-LD حذف می‌شوند (description=""" اسکیمای نامعتبر می‌ساخت).
  const bio = (p.bio || '').replace(/<[^>]+>/g, '').trim().slice(0, 300)
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': type === 'agency' ? 'RealEstateAgent' : 'LocalBusiness',
    name: p.name, image: p.photo || undefined, description: bio || undefined,
    areaServed: p.city || undefined, url: `https://melkjet.com/${p.type}/${p.slug}`,
  }
  Object.keys(ld).forEach(k => ld[k] === undefined && delete ld[k])
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://melkjet.com/' },
      { '@type': 'ListItem', position: 2, name: 'متخصصان', item: 'https://melkjet.com/directory' },
      { '@type': 'ListItem', position: 3, name: p.typeLabel, item: `https://melkjet.com/directory?category=${encodeURIComponent(p.typeLabel)}` },
      { '@type': 'ListItem', position: 4, name: p.name },
    ],
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '26px 22px 70px' }}>
        <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span>
          <Link href="/directory" style={{ color: 'var(--muted)' }}>متخصصان</Link><span>›</span>
          <span style={{ color: 'var(--gold)' }}>{p.typeLabel}</span>
        </nav>

        {/* کاورِ پروفایل (معمارِ اسکرپ‌شده) */}
        {arch?.cover && (
          <div style={{ height: 180, borderRadius: 18, marginBottom: -46, background: `linear-gradient(rgba(10,10,14,.25), rgba(10,10,14,.55)), url(${arch.cover}) center/cover no-repeat`, border: '1px solid var(--line)' }} />
        )}

        {/* هدر */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22, marginBottom: 22, position: 'relative' }}>
          {p.photo
            ? <img src={p.photo} alt={p.name} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', flexShrink: 0 }} />
            : <div style={{ width: 88, height: 88, borderRadius: '50%', background: gradientFor(p.name, 'avatar'), border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 800, flexShrink: 0 }}>{initialsFor(p.name)}</div>}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, margin: '0 0 6px' }}>{p.name}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{p.typeLabel}</span>
              {p.city && <><span style={{ color: 'var(--faint)' }}>·</span><span>{p.city}</span></>}
            </div>
            {p.badges.length > 0 && <div style={{ marginTop: 10 }}><RepBadges badges={p.badges} /></div>}
          </div>
          {p.hasPhone && <div style={{ flexShrink: 0 }}><RevealContact kind="advisor" id={p.phone} compact label="نمایشِ شماره" /></div>}
        </div>

        {PRO_INQUIRY_TYPES.includes(p.type) && <ProInquiryForm type={p.type} slug={p.slug} />}

        {p.bio && <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, marginBottom: 22, fontSize: 14.5, lineHeight: 2, color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: /<\/?[a-z]/i.test(p.bio) ? p.bio : p.bio.replace(/\n/g, '<br/>') }} />}

        {p.specialties.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>تخصص‌ها</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{p.specialties.map((s, i) => <span key={i} style={{ fontSize: 12.5, padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--muted)' }}>{s}</span>)}</div>
          </div>
        )}

        {arch && (
          <>
            {/* آمارِ حرفه‌ای */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
              {[
                arch.credit != null && { l: 'اعتبار تخصصی', v: faN(arch.credit) },
                arch.score != null && { l: 'امتیاز رقابت', v: faN(arch.score) },
                arch.rank != null && { l: 'رتبه در معماران', v: faN(arch.rank) },
                arch.rating != null && { l: 'امتیاز بازخوردها', v: `${arch.rating.toLocaleString('fa-IR')} از ۵${arch.ratingCount ? ` (${faN(arch.ratingCount)} دیدگاه)` : ''}` },
                arch.nps != null && { l: 'تمایلِ کارفرمایان (NPS)', v: `${arch.nps > 0 ? '+' : ''}${faN(arch.nps)}` },
              ].filter(Boolean).map((t, i) => {
                const tt = t as { l: string; v: string }
                return (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 18px', minWidth: 130 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{tt.l}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', marginTop: 4 }}>{tt.v}</div>
                  </div>
                )
              })}
            </div>

            {/* وضعیتِ پروژه‌ها و افتخارات */}
            {((arch.projDone || 0) + (arch.projDoing || 0) + (arch.projPresented || 0) > 0 || (arch.honor1 || 0) + (arch.honor2 || 0) + (arch.honor3 || 0) + (arch.honorFinal || 0) > 0) && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
                {[
                  ['اجراشده', arch.projDone], ['در حال اجرا', arch.projDoing], ['ارائه‌شده', arch.projPresented],
                  ['🥇 مقام اول', arch.honor1], ['🥈 مقام دوم', arch.honor2], ['🥉 مقام سوم', arch.honor3], ['فینالیست', arch.honorFinal],
                ].filter(([, v]) => (v as number || 0) > 0).map(([l, v], i) => (
                  <span key={i} style={{ fontSize: 12.5, padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 999 }}>
                    <b style={{ color: 'var(--gold)' }}>{faN(v as number)}</b> {l as string}
                  </span>
                ))}
              </div>
            )}

            {/* نقاطِ قوت از دیدِ کارفرمایان */}
            {(arch.strengths?.length || 0) > 0 && (
              <div style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>نقاطِ قوت از دیدِ کارفرمایان</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{arch.strengths!.map((s, i) => <span key={i} style={{ fontSize: 12.5, padding: '5px 12px', background: 'rgba(95,217,138,.1)', border: '1px solid rgba(95,217,138,.35)', borderRadius: 999 }}>✓ {s}</span>)}</div>
              </div>
            )}

            {/* جوایز */}
            {(arch.honours?.length || 0) > 0 && (
              <div style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>جوایز و افتخارات</h2>
                <div style={{ display: 'grid', gap: 8 }}>
                  {arch.honours!.slice(0, 10).map((hn, i) => (
                    <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>
                      🏆 {hn.title}{hn.rank ? <span style={{ color: 'var(--gold)', marginInlineStart: 8, fontSize: 12 }}>{hn.rank}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* تحصیلات، مهارت‌ها و همکاری‌ها — همهٔ بخش‌های پروفایلِ مبدأ */}
            {([['تحصیلات و سوابق', arch.edus], ['مهارت‌ها و خدمات', arch.skills], ['تخصص‌ها و همکاری‌ها', arch.engagements]] as [string, string[] | undefined][])
              .filter(([, arr]) => (arr?.length || 0) > 0).map(([ttl, arr], k) => (
                <div key={k} style={{ marginBottom: 22 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>{ttl}</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{arr!.slice(0, 20).map((s, i) => <span key={i} style={{ fontSize: 12.5, padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--muted)' }}>{s}</span>)}</div>
                </div>
              ))}
            {(arch.officeName || arch.managerName) && (
              <div style={{ marginBottom: 22, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 18px', fontSize: 13.5 }}>
                🏢 {arch.officeName || ''}{arch.managerName ? <span style={{ color: 'var(--muted)' }}> · مدیریت: {arch.managerName}</span> : null}
              </div>
            )}

            {/* نقشهٔ پروژه‌ها — روی نقشهٔ خودِ ملک‌جت */}
            {archPins.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>موقعیتِ پروژه‌ها روی نقشه</h2>
                <ProjectsMap points={archPins} />
              </div>
            )}

            {/* پروژه‌ها */}
            {archProjects.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>نمونه‌کارها و پروژه‌ها</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
                  {archProjects.slice(0, 24).map((pr, i) => (
                    <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, overflow: 'hidden' }}>
                      <div style={{ height: 140, background: pr.image ? `center/cover no-repeat url(${pr.image})` : gradientFor(pr.title || p.name) }} />
                      <div style={{ padding: '11px 13px' }}>
                        {pr.title && <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>{pr.title}</div>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}>
                          {pr.city && <span>📍 {pr.city}</span>}
                          {pr.builtArea ? <span>زیربنا {faN(pr.builtArea)} م²</span> : null}
                          {pr.landArea ? <span>زمین {faN(pr.landArea)} م²</span> : null}
                          {pr.year && <span>سال {pr.year.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])}</span>}
                        </div>
                        {pr.category && <div style={{ marginTop: 8 }}><span style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.3)', borderRadius: 999, color: 'var(--gold)' }}>{pr.category}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {p.listings.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>آگهی‌های {p.name}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
              {p.listings.map(it => (
                <Link key={it.id} href={listingHref(it.id, it.title, it.location)} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, overflow: 'hidden' }}>
                  <div style={{ height: 130, background: it.image ? `center/cover no-repeat url(${it.image})` : gradientFor(it.title) }} />
                  <div style={{ padding: '11px 13px' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{it.price || '—'}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                    {it.location && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{it.location}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
