'use client'
import { useEffect, useState } from 'react'

export default function ThemeToggle({ size = 40 }: { size?: number }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    // Read from the class that was applied by the inline head script
    const isLight = document.documentElement.classList.contains('light')
    setTheme(isLight ? 'light' : 'dark')
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('light', next === 'light')
    if (next === 'light') {
      localStorage.setItem('melkjet-theme', 'light')
    } else {
      localStorage.removeItem('melkjet-theme')
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="تغییر تم"
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
