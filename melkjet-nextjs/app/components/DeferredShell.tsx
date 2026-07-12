'use client'
// فاز ۱۰۸ (پرفورمنس): پوستهٔ به‌تعویق‌افتادهٔ کامپوننت‌های سراسریِ غیرِحیاتی.
// این ۷ کامپوننت هیچ‌کدام برای اولین رندر لازم نیستند (همه overlay/بنر/لانچرند)؛ با next/dynamic
// در چانکِ جدا می‌مانند و فقط بعد از بیکارشدنِ مرورگر (یا اولین تعاملِ کاربر — هرکدام زودتر)
// mount می‌شوند تا هایدریشنِ اولیهٔ موبایل سبک شود (TBT). رفتارشان بعد از mount عیناً همان قبلی است.
// BottomNav (UI دیدنی)، AuthModal (قراردادِ رویدادِ mj-open-auth)، Tracker/SessionKeeper/LocationDetector
// (یکپارچگیِ داده و لوکیشن) عمداً همچنان فوری در layout می‌مانند — قانون ۱۱.
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const ImpersonationBar = dynamic(() => import('./ImpersonationBar'), { ssr: false })
const SuspensionGate = dynamic(() => import('./SuspensionGate'), { ssr: false })
const PlanLock = dynamic(() => import('./PlanLock'), { ssr: false })
const CompareBar = dynamic(() => import('./CompareBar'), { ssr: false })
const SupportLauncher = dynamic(() => import('./SupportLauncher'), { ssr: false })
const LegalAssistant = dynamic(() => import('./LegalAssistant'), { ssr: false })
const PWAInstall = dynamic(() => import('./PWAInstall'), { ssr: false })

export default function DeferredShell() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let done = false
    const go = () => { if (!done) { done = true; setOn(true) } }
    // هرکدام زودتر: بیکاریِ مرورگر، ۲.۵ ثانیه، یا اولین تعاملِ واقعیِ کاربر
    const t = setTimeout(go, 2500)
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback?.(go, { timeout: 2000 })
    const evs: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll']
    evs.forEach(e => window.addEventListener(e, go, { once: true, passive: true }))
    return () => {
      clearTimeout(t)
      if (ric) (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(ric)
      evs.forEach(e => window.removeEventListener(e, go))
    }
  }, [])
  if (!on) return null
  return (
    <>
      <ImpersonationBar />
      <SuspensionGate />
      <PlanLock />
      <CompareBar />
      <SupportLauncher />
      <LegalAssistant />
      <PWAInstall />
    </>
  )
}
