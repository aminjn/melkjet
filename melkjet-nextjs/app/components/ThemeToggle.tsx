'use client'
import { useEffect, useState } from 'react'

export default function ThemeToggle({ size = 40 }: { size?: number }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('melkjet-theme') as 'dark' | 'light' | null
    if (saved) {
      setTheme(saved)
      document.documentElement.classList.toggle('light', saved === 'light')
    }
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('light', next === 'light')
    localStorage.setItem('melkjet-theme', next)
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
