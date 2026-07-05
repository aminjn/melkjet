// نشانِ نوعِ پروموت — روی کارتِ آگهی/پروفایل. طراحیِ تمیز و ظریف (نه پُررنگ و شلوغ).
// server component (بدونِ state) تا در صفحاتِ سروری هم قابلِ استفاده باشد.
const KIND: Record<string, { icon: string; bg: string; fg: string; bd: string }> = {
  'نردبان': { icon: '↑', bg: 'rgba(74,144,226,.16)', fg: '#7cb3f0', bd: 'rgba(74,144,226,.45)' },
  'ویژه': { icon: '★', bg: 'rgba(212,175,55,.16)', fg: 'var(--gold2)', bd: 'rgba(212,175,55,.5)' },
  'VIP': { icon: '♛', bg: 'rgba(139,92,246,.18)', fg: '#b79bf5', bd: 'rgba(139,92,246,.5)' },
  'صفحه اول': { icon: '⚑', bg: 'linear-gradient(135deg,var(--gold2),var(--gold))', fg: '#16140f', bd: 'transparent' },
  'ترند': { icon: '🔥', bg: 'rgba(231,106,74,.16)', fg: '#f08a6e', bd: 'rgba(231,106,74,.45)' },
  'برتر': { icon: '✦', bg: 'rgba(212,175,55,.16)', fg: 'var(--gold2)', bd: 'rgba(212,175,55,.5)' },
  'منتخب': { icon: '✦', bg: 'rgba(74,144,226,.16)', fg: '#7cb3f0', bd: 'rgba(74,144,226,.45)' },
  'تأییدشده': { icon: '✓', bg: 'rgba(95,217,138,.15)', fg: '#5fd98a', bd: 'rgba(95,217,138,.4)' },
  'مزایده': { icon: '🏆', bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', fg: '#fff', bd: 'transparent' },
}
const DEFAULT = KIND['ویژه']

export default function PromoBadge({ kind, style, size = 'md' }: { kind?: string; style?: React.CSSProperties; size?: 'sm' | 'md' }) {
  const k = KIND[kind || 'ویژه'] || DEFAULT
  const pad = size === 'sm' ? '2px 8px' : '3px 10px'
  const fs = size === 'sm' ? 10.5 : 11.5
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: k.bg, color: k.fg, border: `1px solid ${k.bd}`, borderRadius: 7, padding: pad, fontSize: fs, fontWeight: 700, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)', ...style }}>
      <span style={{ fontSize: fs - 0.5 }}>{k.icon}</span>{kind || 'ویژه'}
    </span>
  )
}
