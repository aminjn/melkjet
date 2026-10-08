import ProviderProfilePage, { providerMetadata } from '@/app/components/ProviderProfilePage'

export const revalidate = 300   // فاز ۲۸۹: پروفایلِ معمار زود به‌روز دیده شود (قبلا ۳۰ دقیقه کشِ ISR بود)
export function generateStaticParams() { return [] }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return providerMetadata('architect', slug)
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ProviderProfilePage type="architect" slug={slug} />
}
