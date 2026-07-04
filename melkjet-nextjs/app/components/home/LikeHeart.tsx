'use client'
import { useState } from 'react'

// دکمهٔ لایک/ذخیرهٔ خودگردان (state محلی). چون خودش جزیرهٔ کوچکِ کلاینتی است،
// کارتِ آگهی می‌تواند server-render بماند و کلِ لیست hydrate نشود.
export default function LikeHeart() {
  const [liked, setLiked] = useState(false)
  return (
    <button onClick={e => { e.preventDefault(); setLiked(v => !v) }} aria-label="ذخیره" style={{ position: 'absolute', top: 12, left: 12, width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(20,18,14,0.6)', backdropFilter: 'blur(6px)', color: liked ? '#ff6b81' : 'rgba(255,255,255,0.85)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      ♥
    </button>
  )
}
