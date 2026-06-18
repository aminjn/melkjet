'use client'

import { useEffect, useState } from 'react'

interface PublicBanner {
  id: string
  title: string
  image: string
  link: string
}

export default function BannerSlot({ placement }: { placement: string }) {
  const [banner, setBanner] = useState<PublicBanner | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/banners?placement=${encodeURIComponent(placement)}`)
      .then(r => r.json())
      .then((d: { banners?: PublicBanner[] }) => {
        if (alive && d?.banners?.length) setBanner(d.banners[0])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [placement])

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
        src={banner.image}
        alt={banner.title}
        loading="lazy"
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
