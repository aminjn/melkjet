import { redirect } from 'next/navigation'
import { getProviderPublic } from '@/app/lib/provider-public'
import LegacyProfile from './LegacyProfile'

export const dynamic = 'force-dynamic'

// مسیرِ قدیمی: متخصص → ریدایرکت به canonicalِ جدید /{type}/{slug}؛ موارد لبه → نمای قدیمی.
export default async function ProfileRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await getProviderPublic(String(id)).catch(() => null)
  if (p) redirect(`/${p.type}/${p.slug}`)
  return <LegacyProfile />
}
