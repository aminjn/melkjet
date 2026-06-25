'use client'

import { useEffect, useState } from 'react'

// لایهٔ پس‌زمینهٔ اسلایدشوِ هیرو: تصاویر با محو-تدریجی (cross-fade) هر چند ثانیه
// به‌صورت چرخشی نمایش داده می‌شوند. این مؤلفه به‌صورت absolute پشتِ محتوای هیرو می‌نشیند.
export default function HeroSlider({
  images, overlay = 'dark', interval = 5000,
}: {
  images: string[]
  overlay?: 'dark' | 'light' | 'none'
  interval?: number
}) {
  const imgs = (images || []).filter(Boolean)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (imgs.length < 2) return
    const id = setInterval(() => {
      setActive(i => (i + 1) % imgs.length)
    }, Math.max(2000, interval))
    return () => clearInterval(id)
  }, [imgs.length, interval])

  const overlayBg =
    overlay === 'dark'
      ? 'linear-gradient(180deg, rgba(12,9,6,.38), rgba(12,9,6,.70))'
      : overlay === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,.55))'
        : 'none'

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
      {imgs.map((src, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center',
            opacity: i === active ? 1 : 0,
            transition: 'opacity 1.2s ease-in-out',
          }}
        />
      ))}
      {overlayBg !== 'none' ? (
        <div style={{ position: 'absolute', inset: 0, background: overlayBg }} />
      ) : null}
    </div>
  )
}
