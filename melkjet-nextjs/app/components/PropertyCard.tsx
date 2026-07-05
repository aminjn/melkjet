import Link from 'next/link'
import CompareButton from './CompareButton'
import LikeHeart from './home/LikeHeart'
import PromoBadge from './PromoBadge'

interface PropertyCardProps {
  id?: string | number
  title: string
  location: string
  price: string
  size: string
  beds: string
  year?: string
  tag?: string
  score?: string | number
  img?: string
  promoKind?: string
}

// کارتِ آگهی — server component. دکمهٔ لایک یک جزیرهٔ کوچکِ کلاینتی (LikeHeart) است،
// پس این کارت خودش hydrate نمی‌شود و می‌تواند در صفحاتِ سروری استفاده شود.
export default function PropertyCard({ id = '1', title, location, price, size, beds, year, tag, score, img = 'linear-gradient(135deg,#3a3530,#211e1b)', promoKind }: PropertyCardProps) {
  return (
    <Link href={`/property/${id}`} style={{ display: 'block', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', transition: '.2s' }}>
      <div style={{ position: 'relative', height: 184, background: img }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg,transparent,transparent 9px,rgba(255,255,255,0.025) 9px,rgba(255,255,255,0.025) 10px)' }}></div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.35),transparent 55%)' }}></div>
        {promoKind ? (
          <span style={{ position: 'absolute', top: 12, right: 12 }}><PromoBadge kind={promoKind} /></span>
        ) : tag && (
          <span style={{ position: 'absolute', top: 12, right: 12, padding: '5px 11px', borderRadius: 999, background: 'rgba(20,18,14,0.65)', backdropFilter: 'blur(6px)', color: 'var(--gold2)', fontSize: 11.5, fontWeight: 700, border: '1px solid var(--gold)' }}>
            {tag}
          </span>
        )}
        <LikeHeart />
        {score && (
          <span style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: 'rgba(20,18,14,0.7)', backdropFilter: 'blur(6px)', fontSize: 11.5, fontWeight: 700, color: '#fff' }}>
            <span style={{ color: 'var(--gold2)' }}>✦</span> امتیاز AI {score}
          </span>
        )}
      </div>
      <div style={{ padding: '16px 18px 18px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', letterSpacing: '-.3px' }}>{price}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{location}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)' }}>
          <span>{size} متر</span>
          <span style={{ color: 'var(--faint)' }}>·</span>
          <span>{beds} خواب</span>
          {year && <><span style={{ color: 'var(--faint)' }}>·</span><span>ساخت {year}</span></>}
          <span style={{ marginInlineStart: 'auto' }}>
            <CompareButton entry={{ kind: 'item', id: String(id), title, photo: (img && (img.startsWith('http') || img.startsWith('/'))) ? img : undefined, subtitle: location }} />
          </span>
        </div>
      </div>
    </Link>
  )
}
