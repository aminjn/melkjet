import { redirect } from 'next/navigation'
import { flatNeighborhoods } from '@/app/lib/locations-store'
import NeighborhoodClient from './NeighborhoodClient'

export const dynamic = 'force-dynamic'

const normFa = (s: string) => String(s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()

// مسیرِ قدیمیِ محله (نامِ فارسی در URL) → canonicalِ /locations/{city}/{district}/{slug}
// اگر نام به محلهٔ شناخته‌شده resolve شود ریدایرکت می‌کند؛ وگرنه صفحهٔ قدیمی را نشان می‌دهد.
export default async function NeighborhoodLegacy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let name = id
  try { name = decodeURIComponent(id) } catch {}
  const key = normFa(name)
  const hit = flatNeighborhoods().find(n => normFa(n.nameFa) === key)
  if (hit) redirect(`/locations/${hit.path.join('/')}`)
  return <NeighborhoodClient name={name} />
}
