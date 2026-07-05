import { redirect, notFound } from 'next/navigation'
import { publicProject } from '@/app/lib/persiansaze-store'
import { ensureProjectSlug } from '@/app/lib/project-slug-store'

export const dynamic = 'force-dynamic'

// مسیرِ قدیمی → canonicalِ جدید /projects/{slug}
export default async function LegacyProje({ params }: { params: Promise<{ hashId: string }> }) {
  const { hashId } = await params
  const r = publicProject(hashId)
  if (!r) notFound()
  const slug = await ensureProjectSlug(hashId, r.project.address || r.project.receptor || r.builder?.name || 'پروژه')
  redirect(`/projects/${slug}`)
}
