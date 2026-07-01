'use client'
import { useState, useEffect } from 'react'
import Nav from '@/app/components/Nav'
import CatalogAdminView from '@/app/admin/CatalogAdminView'

// صفحهٔ مدیریتِ کاتالوگ برای کاربرِ دارای دسترسیِ «catalog» (بیرون از پنلِ سوپرادمین).
export default function CatalogAdminPage() {
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  useEffect(() => {
    fetch('/api/admin/catalog').then(r => setState(r.ok ? 'ok' : 'denied')).catch(() => setState('denied'))
  }, [])
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>
      <Nav />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 60px' }}>
        {state === 'loading' && <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>در حال بررسیِ دسترسی…</div>}
        {state === 'denied' && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 16 }}>
            شما به مدیریتِ کاتالوگِ مصالح دسترسی ندارید. برای دریافتِ دسترسی با مدیر تماس بگیرید.
          </div>
        )}
        {state === 'ok' && <CatalogAdminView />}
      </div>
    </div>
  )
}
