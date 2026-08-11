import ProviderProfilePage, { providerMetadata } from '@/app/components/ProviderProfilePage'

export const revalidate = 1800
export function generateStaticParams() { return [] }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return providerMetadata('agency', slug)
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ProviderProfilePage type="agency" slug={slug} />
}
