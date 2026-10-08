'use client'
import { useEffect, useState } from 'react'
import { isSeen } from '@/app/lib/seen-store'
import { IconSvg } from './GlassIcon'

// نشانِ «دیده‌اید» — جزیرهٔ کوچکِ کلاینتی داخلِ کارتِ آگهی (خودِ کارت سروری می‌ماند).
// در بازدیدِ آگهی markSeen ثبت می‌شود و این نشان (چشم) روی همان کارت ظاهر می‌شود.
export default function SeenBadge({ id }: { id: string | number }) {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const upd = () => setSeen(isSeen(id))
    upd()
    window.addEventListener('mj-seen-change', upd)
    return () => window.removeEventListener('mj-seen-change', upd)
  }, [id])
  if (!seen) return null
  return (
    <span title="این آگهی را دیده‌اید" style={{ position: 'absolute', bottom: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: 'rgba(20,18,14,0.72)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 11, fontWeight: 700, border: '1px solid rgba(255,255,255,0.16)' }}>
      <IconSvg name="eye" size={12} /> دیده‌اید
    </span>
  )
}
