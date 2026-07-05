import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import { assembleBuilderProfile } from '../../lib/builder-profile'
import { isFollowing } from '../../lib/builder-public-store'
import { getSession } from '../../lib/session'
import { builderIdForSlug, ensureBuilderSlug, slugForBuilderId } from '../../lib/builder-slug-store'
import BuilderProfileView from './BuilderProfileView'

export const dynamic = 'force-dynamic'

// slug → id (یا خودِ id برای سازگاریِ عقب‌رو).
async function resolveId(slug: string): Promise<string | null> {
  const byId = await builderIdForSlug(slug)
  if (byId) return byId
  if (assembleBuilderProfile(slug)) return slug   // slug همان idِ خام است (عقب‌رو)
  return null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const id = await resolveId(slug)
  const p = id ? assembleBuilderProfile(id) : null
  if (!p) return { title: 'سازنده یافت نشد | ملک‌جت' }
  const canonSlug = (await slugForBuilderId(id!)) || slug
  const region = (p as any).regionName || (p as any).city || ''
  const title = `${p.name}${region ? ` — ${region}` : ''}`
  return {
    title: `سازندهٔ ${title} | ملک‌جت`,
    description: `پروفایلِ سازندهٔ ${p.name}${region ? ` در ${region}` : ''}: پروژه‌های ساختمانی، سوابق و اطلاعاتِ تماس در ملک‌جت.`,
    alternates: { canonical: `https://melkjet.com/builders/${canonSlug}` },
  }
}

export default async function BuilderProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const id = await resolveId(slug)
  const profile = id ? assembleBuilderProfile(id) : null
  if (!profile) {
    return (<><Nav /><main style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>سازنده پیدا نشد</main><Footer /></>)
  }
  // کنونیکال: اگر با idِ خام آمده و slug داریم/می‌سازیم، به /builders/{slug} ریدایرکت کن.
  const canonSlug = (await slugForBuilderId(id!)) || (await ensureBuilderSlug(id!, profile.name))
  if (canonSlug && slug !== canonSlug) redirect(`/builders/${canonSlug}`)

  const s = await getSession()
  // شماره هرگز در payloadِ اولیه به مرورگر نمی‌رود؛ فقط با ورود از /api/contact-reveal می‌آید.
  const safe = { ...profile, hasPhone: !!profile.phone, phone: '' }
  return <BuilderProfileView profile={safe} initialFollowing={s ? isFollowing(id!, s.phone) : false} loggedIn={!!s} />
}
