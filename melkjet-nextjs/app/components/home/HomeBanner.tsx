'use client'
import dynamic from 'next/dynamic'

// پوستهٔ کلاینتیِ بنر — چون ssr:false فقط داخلِ کامپوننتِ کلاینت مجاز است و صفحهٔ
// اصلی حالا سروری است.
const BannerSlot = dynamic(() => import('../BannerSlot'), { ssr: false })

export default function HomeBanner() {
  return <BannerSlot placement="home" />
}
