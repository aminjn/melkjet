import { publicShop } from '@/app/lib/materials-store'
import StorefrontView from './StorefrontView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const shop = publicShop(slug)
  if (!shop) return { title: 'فروشگاه یافت نشد | ملک‌جت' }
  return { title: `${shop.name} | فروشگاه مصالح ملک‌جت`, description: shop.tagline || shop.about?.slice(0, 150) || `فروشگاه مصالح ساختمانی ${shop.name}` }
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const shop = publicShop(slug)
  if (!shop) {
    return (
      <div dir="rtl" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>
        فروشگاه یافت نشد.
      </div>
    )
  }
  return <StorefrontView shop={shop} />
}
