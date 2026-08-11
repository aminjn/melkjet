import ProviderProfilePage, { providerMetadata } from '@/app/components/ProviderProfilePage'

export const revalidate = 600
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return providerMetadata('materials', slug)
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ProviderProfilePage type="materials" slug={slug} />
}
