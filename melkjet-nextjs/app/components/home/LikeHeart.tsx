'use client'
import { useEffect, useState } from 'react'

// دکمهٔ ذخیرهٔ واقعی — به /api/user/prefs وصل است (addFav/removeFav) و رویدادِ REOS ثبت می‌شود؛
// همان سیگنالی که کوئستِ «۱ آگهی ذخیره کن» و یادگیریِ سلیقهٔ کاربر از آن می‌خوانند.
// وضعیتِ ذخیره‌ها یک بار در هر صفحه گرفته و بینِ همهٔ قلب‌ها به اشتراک گذاشته می‌شود (نه یک درخواست به‌ازای هر کارت).
let favsPromise: Promise<Set<string>> | null = null
function favsOf(): Promise<Set<string>> {
  if (!favsPromise) {
    favsPromise = fetch('/api/user/prefs')
      .then(r => r.json())
      .then(d => new Set<string>(((d?.favorites || []) as unknown[]).map(String)))
      .catch(() => { favsPromise = null; return new Set<string>() })
  }
  return favsPromise
}

export async function toggleFav(listingId: string, next: boolean): Promise<void> {
  const r = await fetch('/api/user/prefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: next ? 'addFav' : 'removeFav', listingId }),
  })
  if (!r.ok) throw new Error('save failed')
  const set = await favsOf()
  if (next) set.add(listingId); else set.delete(listingId)
}

export function useFav(listingId?: string | number): [boolean, () => void] {
  const id = listingId == null ? '' : String(listingId)
  const [liked, setLiked] = useState(false)
  useEffect(() => {
    if (!id) return
    let alive = true
    favsOf().then(s => { if (alive) setLiked(s.has(id)) })
    return () => { alive = false }
  }, [id])
  const toggle = () => {
    if (!id) return
    const next = !liked
    setLiked(next)                                            // خوش‌بینانه؛ اگر سرور رد کرد برمی‌گردد
    toggleFav(id, next).catch(() => setLiked(!next))
  }
  return [liked, toggle]
}

export default function LikeHeart({ listingId }: { listingId?: string | number }) {
  const [liked, toggle] = useFav(listingId)
  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggle() }}
      aria-label={liked ? 'حذف از ذخیره‌ها' : 'ذخیره'}
      title={liked ? 'ذخیره شد — برای حذف دوباره بزن' : 'ذخیرهٔ آگهی'}
      style={{ position: 'absolute', top: 12, left: 12, width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(20,18,14,0.6)', backdropFilter: 'blur(6px)', color: liked ? '#ff6b81' : 'rgba(255,255,255,0.85)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .15s', transform: liked ? 'scale(1.12)' : 'none' }}
    >
      ♥
    </button>
  )
}
