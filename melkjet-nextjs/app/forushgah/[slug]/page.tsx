import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
export default async function LegacyForushgah({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/store/${slug}`)
}
