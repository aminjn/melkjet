'use client'
import ReosFeed from './ReosFeed'

// بخشِ آمادهٔ REOS برای پنل‌های نقش‌ها: کارتِ «پیشنهادهای هوشمندِ REOS» با فیدِ فشرده.
// silent=false تا در پنل حتی حالتِ «هنوز داده‌ای نیست» هم نمایش داده شود (کاربر بداند موتور هست).
export default function ReosPanelSection({ title = 'پیشنهادهای هوشمندِ REOS', subtitle = 'بر اساسِ رفتار و بازارِ زنده' }: { title?: string; subtitle?: string }) {
  const FONT = 'Vazirmatn, system-ui, sans-serif'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>✦</span>
        <span style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{subtitle}</span>
      </div>
      <ReosFeed compact />
    </div>
  )
}
