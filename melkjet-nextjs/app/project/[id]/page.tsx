import { redirect } from 'next/navigation'
import { publicProject } from '@/app/lib/persiansaze-store'
import { slugForProjectHash } from '@/app/lib/project-slug-store'

export const dynamic = 'force-dynamic'

// مسیرِ قدیمی → canonicalِ /projects/{slug} (یا هابِ پروژه‌ها اگر resolve نشد)
export default async function LegacyProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (publicProject(id)) {
    const slug = await slugForProjectHash(id)
    redirect(`/projects/${slug || id}`)
  }
  redirect('/projects')
}
