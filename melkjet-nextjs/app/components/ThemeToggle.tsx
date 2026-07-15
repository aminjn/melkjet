'use client'
import { useEffect, useState } from 'react'

// فاز ۱۲۹ — یک منبعِ حقیقت برای تم در کلِ پروژه:
// بدونِ انتخابِ صریح، تم از ساعتِ کاربر می‌آید (اسکریپتِ headِ layout)؛ این تابع انتخابِ دستی را
// اعمال و «ماندگار» می‌کند ('light' یا 'dark' صریح — تا انتخابِ شب در روزِ بعد هم بماند).
export function applyTheme(next: 'light' | 'dark') {
  document.documentElement.classList.toggle('light', next === 'light')
  try { localStorage.setItem('melkjet-theme', next) } catch {}
}
export const isLightNow = () => typeof document !== 'undefined' && document.documentElement.classList.contains('light')

export default function ThemeToggle({ size = 40 }: { size?: number }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    // Read from the class that was applied by the inline head script (saved choice or ساعتِ کاربر)
    setTheme(isLightNow() ? 'light' : 'dark')
  }, [])

  const toggle = () => {
    // تصمیم از خودِ DOM در لحظهٔ کلیک — state ممکن است هنوز با تمِ خودکارِ ساعتی سینک نشده باشد (ریسِ hydration)
    const next = isLightNow() ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <button
      onClick={toggle}
      aria-label="تغییر تم"
      title={theme === 'dark' ? 'تمِ روز' : 'تمِ شب'}
      style={{
        width: size, height: size,
        borderRadius: 11, border: '1px solid var(--line)',
        background: 'var(--surface)', color: 'var(--text)',
        cursor: 'pointer', fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: '.18s', flexShrink: 0
      }}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
