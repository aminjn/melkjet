import ProviderProfilePage, { providerMetadata } from '@/app/components/ProviderProfilePage'

export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return providerMetadata('builder', slug)
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // فاز ۲۴۲: اگر همین سازنده در «بانکِ سازنده‌ها» پروفایلِ غنی دارد (پروژه‌ها/آمارِ واقعیِ پرشین‌سازه)،
  // صفحهٔ خالیِ حساب نمایش داده نمی‌شود — ۳۰۸ به صفحهٔ کامل (یک سازنده، یک صفحهٔ حقیقی؛ سئو هم یکی می‌شود).
  const { richBuilderHrefForProviderSlug } = await import('@/app/lib/builder-bridge')
  const rich = await richBuilderHrefForProviderSlug(slug)
  if (rich) { const { permanentRedirect } = await import('next/navigation'); permanentRedirect(rich) }
  return <ProviderProfilePage type="builder" slug={slug} />
}
