import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import { assembleBuilderProfile } from '../../lib/builder-profile'
import { isFollowing } from '../../lib/builder-public-store'
import { getSession } from '../../lib/session'
import BuilderProfileView from './BuilderProfileView'

export const dynamic = 'force-dynamic'

export default async function SazandeProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = assembleBuilderProfile(id)

  if (!profile) {
    return (
      <>
        <Nav />
        <main style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>سازنده پیدا نشد</main>
        <Footer />
      </>
    )
  }
  const s = await getSession()
  // شماره هرگز در payloadِ اولیه به مرورگر نمی‌رود؛ فقط با ورود از /api/contact-reveal می‌آید.
  const safe = { ...profile, hasPhone: !!profile.phone, phone: '' }
  return <BuilderProfileView profile={safe} initialFollowing={s ? isFollowing(id, s.phone) : false} loggedIn={!!s} />
}
