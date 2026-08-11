'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// فاز ۲۵۵ — بازگرداندنِ موقعیتِ اسکرول: وقتی کاربر از فیدِ آگهی‌ها یک آگهی را باز می‌کند و برمی‌گردد،
// به‌جای «از اول»، دقیقاً همان‌جا که بود ادامه می‌دهد. موقعیت per-URL در sessionStorage نگه می‌شود؛
// چون فیدها محتوا را async می‌سازند، بازگردانی چند فریم retry می‌شود تا به ارتفاعِ لازم برسد.
export default function ScrollRestorer() {
  const pathname = usePathname()
  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = 'mjscroll:' + pathname + (window.location.search || '')
    let saved = 0
    try { saved = Number(sessionStorage.getItem(key) || '0') } catch {}

    let raf = 0, tries = 0
    const restore = () => {
      // تا وقتی به موقعیتِ ذخیره‌شده نرسیده (محتوا هنوز کوتاه است) و کمتر از ~۱ ثانیه، دوباره تلاش کن
      if (saved > 4 && Math.abs(window.scrollY - saved) > 4 && tries < 40 && document.documentElement.scrollHeight - window.innerHeight >= saved - 4) {
        window.scrollTo(0, saved); tries++
        raf = requestAnimationFrame(restore)
      } else if (saved > 4 && tries < 40) {
        // هنوز محتوا کوتاه‌تر از موقعیتِ هدف است؛ منتظرِ رشدِ محتوا بمان و باز تلاش کن
        tries++
        raf = requestAnimationFrame(restore)
      }
    }
    if (saved > 4) raf = requestAnimationFrame(restore)

    let t: ReturnType<typeof setTimeout> | undefined
    const save = () => { try { sessionStorage.setItem(key, String(window.scrollY)) } catch {} }
    const onScroll = () => { if (t) clearTimeout(t); t = setTimeout(save, 120) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', save)
    return () => {
      cancelAnimationFrame(raf); if (t) clearTimeout(t)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', save)
      save()   // موقعیتِ لحظهٔ ترک را قطعی ذخیره کن (قبل از رفتن به آگهی)
    }
  }, [pathname])
  return null
}
