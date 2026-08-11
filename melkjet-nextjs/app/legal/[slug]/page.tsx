import ProviderProfilePage, { providerMetadata } from '@/app/components/ProviderProfilePage'

export const revalidate = 1800
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return providerMetadata('legal', slug)
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ProviderProfilePage type="legal" slug={slug} />
}
