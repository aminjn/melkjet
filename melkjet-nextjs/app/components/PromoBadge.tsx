// نشانِ نوعِ پروموت — روی کارتِ آگهی/پروفایل. رنگ و آیکنِ متمایز به‌ازای هر نوع.
// server component (بدونِ state) تا در صفحاتِ سروری هم قابلِ استفاده باشد.
const KIND: Record<string, { icon: string; bg: string; fg: string }> = {
  'نردبان': { icon: '↑', bg: 'linear-gradient(135deg,#4a90e2,#2f6fc0)', fg: '#fff' },
  'ویژه': { icon: '★', bg: 'linear-gradient(135deg,var(--gold2),var(--gold))', fg: '#16140f' },
  'VIP': { icon: '♛', bg: 'linear-gradient(135deg,#7b3fe4,#5a26b8)', fg: '#fff' },
  'صفحه اول': { icon: '⚑', bg: 'linear-gradient(135deg,#e0a32e,#c47d12)', fg: '#16140f' },
  'ترند': { icon: '🔥', bg: 'linear-gradient(135deg,#e7674a,#c8442a)', fg: '#fff' },
  'برتر': { icon: '✦', bg: 'linear-gradient(135deg,var(--gold2),var(--gold))', fg: '#16140f' },
  'منتخب': { icon: '✦', bg: 'linear-gradient(135deg,#4a90e2,#2f6fc0)', fg: '#fff' },
  'تأییدشده': { icon: '✓', bg: 'linear-gradient(135deg,#3fae6a,#2c8a50)', fg: '#fff' },
}
const DEFAULT = { icon: '★', bg: 'linear-gradient(135deg,var(--gold2),var(--gold))', fg: '#16140f' }

export default function PromoBadge({ kind, style, size = 'md' }: { kind?: string; style?: React.CSSProperties; size?: 'sm' | 'md' }) {
  const k = KIND[kind || 'ویژه'] || DEFAULT
  const pad = size === 'sm' ? '3px 8px' : '4px 10px'
  const fs = size === 'sm' ? 10.5 : 11.5
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: k.bg, color: k.fg, borderRadius: 8, padding: pad, fontSize: fs, fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 2px 8px -2px rgba(0,0,0,.4)', ...style }}>
      <span style={{ fontSize: fs + 1 }}>{k.icon}</span>{kind || 'ویژه'}
    </span>
  )
}
