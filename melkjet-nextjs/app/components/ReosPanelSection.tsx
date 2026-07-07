'use client'
import { useEffect, useState } from 'react'
import ReosFeed from './ReosFeed'
import { roleFromPath } from '@/app/lib/reos/roles'

// بخشِ آمادهٔ REOS برای پنل‌های نقش‌ها: کارتِ «پیشنهادهای هوشمندِ REOS» با فیدِ نقش‌محورِ v2.
// نقش را از مسیرِ داشبورد (pathname) تشخیص می‌دهد → هر پنل فیدِ مخصوصِ خودش را می‌گیرد
// (سرمایه‌گذاری برای مالک، فایلِ داغ برای مشاور، زمین/کلنگی برای سازنده، …).
export default function ReosPanelSection({ title = 'پیشنهادهای هوشمندِ REOS', subtitle = 'بر اساسِ رفتار و بازارِ زنده' }: { title?: string; subtitle?: string }) {
  const FONT = 'Vazirmatn, system-ui, sans-serif'
  const [role, setRole] = useState<string | undefined>(undefined)
  useEffect(() => { if (typeof window !== 'undefined') setRole(roleFromPath(window.location.pathname)) }, [])
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>✦</span>
        <span style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{subtitle}</span>
      </div>
      <ReosFeed compact role={role} />
    </div>
  )
}
