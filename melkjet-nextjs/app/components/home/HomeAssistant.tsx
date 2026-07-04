'use client'
import dynamic from 'next/dynamic'

// پوستهٔ کلاینتیِ دستیارِ AI (بارگذاریِ تنبل، بدونِ SSR).
const AIAssistant = dynamic(() => import('../AIAssistant'), { ssr: false })

export default function HomeAssistant() {
  return <AIAssistant />
}
