// نشان‌های اعتبار/گیمیفیکیشن — سبک و خاکستری‌طلایی (متمایز از نشانِ پروموتِ پولی).
// server component. حداکثر چند نشان تا شلوغ نشود.
export interface RepBadgeT { id: string; label: string; icon: string; desc?: string }

export default function RepBadges({ badges, max = 3, size = 'md' }: { badges?: RepBadgeT[]; max?: number; size?: 'sm' | 'md' }) {
  if (!badges || badges.length === 0) return null
  const shown = badges.slice(0, max)
  const fs = size === 'sm' ? 10 : 11
  const pad = size === 'sm' ? '2px 7px' : '3px 8px'
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
      {shown.map(b => (
        <span key={b.id} title={b.desc || b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--gold)', borderRadius: 999, padding: pad, fontSize: fs, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <span>{b.icon}</span>{b.label}
        </span>
      ))}
    </span>
  )
}
