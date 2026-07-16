'use client'

import { useEffect, useState } from 'react'
import { previewSrc } from '@/app/lib/img-preview'

interface PublicBanner {
  id: string
  title: string
  image: string
  link: string
}

// فاز ۱۵۰: category/slug = زمینهٔ مقاله (بنرِ هدفمند)؛ bannerId = بنرِ مشخص‌شده در مقاله‌ساز.
// اگر بنری تنظیم نشده باشد هیچ‌چیزی رندر نمی‌شود — نه جای خالی، نه placeholder.
export default function BannerSlot({ placement, category, slug, bannerId }: { placement: string; category?: string; slug?: string; bannerId?: string }) {
  const [banner, setBanner] = useState<PublicBanner | null>(null)
  const [rawImg, setRawImg] = useState(false) // اگر بهینه‌ساز در دسترس نبود → آدرسِ اصلی

  useEffect(() => {
    let alive = true
    const q = bannerId
      ? `id=${encodeURIComponent(bannerId)}`
      : `placement=${encodeURIComponent(placement)}${category ? `&cat=${encodeURIComponent(category)}` : ''}${slug ? `&slug=${encodeURIComponent(slug)}` : ''}`
    fetch(`/api/banners?${q}`)
      .then(r => r.json())
      .then((d: { banners?: PublicBanner[] }) => {
        if (alive && d?.banners?.length) setBanner(d.banners[0])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [placement, category, slug, bannerId])

  if (!banner) return null

  const track = () => {
    fetch('/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: banner.id }),
    }).catch(() => {})
  }

  return (
    <a
      href={banner.link || '#'}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={track}
      title={banner.title}
      style={{
        display: 'block',
        position: 'relative',
        width: '100%',
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        borderRadius: 14,
        overflow: 'hidden',
        textDecoration: 'none',
      }}
    >
      <img
        src={rawImg ? banner.image : previewSrc(banner.image, 1080)}
        alt={banner.title}
        loading="lazy"
        decoding="async"
        onError={() => { if (!rawImg) setRawImg(true) }}
        style={{
          display: 'block',
          width: '100%',
          maxHeight: 140,
          objectFit: 'cover',
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: 6,
          insetInlineStart: 6,
          fontSize: 10,
          lineHeight: 1,
          padding: '3px 6px',
          borderRadius: 6,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          color: 'var(--muted)',
        }}
      >
        تبلیغ
      </span>
    </a>
  )
}
