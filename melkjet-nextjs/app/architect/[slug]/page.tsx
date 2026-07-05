import ProviderProfilePage, { providerMetadata } from '@/app/components/ProviderProfilePage'

export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return providerMetadata('architect', slug)
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ProviderProfilePage type="architect" slug={slug} />
}
