'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import SupportPanel from './SupportPanel'

// دکمهٔ پشتیبانیِ شناور در همهٔ پنل‌ها (یک‌جا، تو در تو نیست). با کلیک، کشوی تیکت‌ها باز می‌شود.
const PANEL_ROUTES = ['/builder', '/materials', '/owner', '/buyer', '/pros', '/agency', '/crm', '/marketing', '/workflow', '/website-builder']

export default function SupportLauncher() {
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const onPanel = PANEL_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))

  useEffect(() => {
    if (!onPanel) return
    let dead = false
    fetch('/api/support', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (!dead && d?.ok) setUnread(d.unread || 0) }).catch(() => {})
    return () => { dead = true }
  }, [onPanel, open])

  if (!onPanel) return null

  return (
    <>
      <button onClick={() => setOpen(true)} title="پشتیبانی" style={{ position: 'fixed', bottom: 18, insetInlineStart: 18, zIndex: 250, height: 48, padding: '0 18px', borderRadius: 24, border: '1px solid var(--gold)', background: 'var(--surface)', color: 'var(--gold)', fontFamily: 'Vazirmatn, sans-serif', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 8px 28px -8px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', gap: 7 }}>
        🛟 پشتیبانی{unread > 0 && <span style={{ background: 'var(--gold)', color: '#16140f', borderRadius: 999, minWidth: 18, height: 18, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{unread.toLocaleString('fa-IR')}</span>}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 400, display: 'flex', justifyContent: 'flex-start' }}>
          <div onClick={e => e.stopPropagation()} dir="rtl" style={{ width: 460, maxWidth: '94vw', height: '100%', background: 'var(--bg)', borderInlineEnd: '1px solid var(--line2)', padding: 20, overflowY: 'auto', fontFamily: 'Vazirmatn, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>🛟 پشتیبانی</div>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <SupportPanel panel={pathname} />
          </div>
        </div>
      )}
    </>
  )
}
