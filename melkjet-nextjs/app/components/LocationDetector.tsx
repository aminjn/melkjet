'use client'
import { useEffect } from 'react'

// موقعیتِ کاربر را خودکار تشخیص می‌دهد و در کوکیِ mj_loc ذخیره می‌کند (چه لاگین چه نه).
// هر بار که اپ باز می‌شود دوباره چک می‌شود؛ صفحاتِ پابلیک بر اساس آن مرتب‌سازی می‌کنند.

export function readLoc(): { city?: string; neighborhood?: string; lat?: number; lng?: number } | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|; )mj_loc=([^;]*)/)
  if (!m) return null
  try { return JSON.parse(decodeURIComponent(m[1])) } catch { return null }
}

export default function LocationDetector() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    let done = false
    const ok = async (pos: GeolocationPosition) => {
      if (done) return; done = true
      const { latitude, longitude } = pos.coords
      try {
        const r = await fetch(`/api/geo/locate?lat=${latitude}&lng=${longitude}`)
        const d = await r.json()
        const val = JSON.stringify({ city: d.city || '', neighborhood: d.neighborhood || '', lat: latitude, lng: longitude, at: Date.now() })
        document.cookie = `mj_loc=${encodeURIComponent(val)};path=/;max-age=${30 * 86400};SameSite=Lax`
        // بارِ اول: اگر کاربر هنوز شهری انتخاب نکرده، شهرِ تشخیص‌داده‌شده را پیش‌فرض بگذار
        if (d.city && !/(?:^|; )mj_city=[^;]+/.test(document.cookie)) {
          document.cookie = `mj_city=${encodeURIComponent(d.city)};path=/;max-age=${365 * 86400};SameSite=Lax`
          window.dispatchEvent(new CustomEvent('mj-city-updated'))
        }
        window.dispatchEvent(new CustomEvent('mj-loc-updated'))
      } catch { /* بی‌سروصدا */ }
    }
    // هر بار باز شدن: اگر دسترسی قبلاً داده شده، بی‌صدا به‌روزرسانی می‌شود؛ وگرنه یک‌بار می‌پرسد.
    navigator.geolocation.getCurrentPosition(ok, () => { /* رد شد — بی‌خیال */ }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 })
  }, [])
  return null
}
