import { redirect } from 'next/navigation'
import { slugForProductId } from '@/app/lib/product-slug-store'
export const dynamic = 'force-dynamic'
export default async function LegacyMahsul({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const slug = await slugForProductId(id)
  redirect(`/product/${slug || id}`)
}
