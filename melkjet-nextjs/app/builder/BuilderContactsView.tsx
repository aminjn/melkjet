'use client'
import { useEffect, useState } from 'react'

// گزارشِ تماس‌ها: کاربرانِ واردشده‌ای که شمارهٔ این سازنده را دیده‌اند (لیدها).
const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000)
  if (s < 60) return 'لحظاتی پیش'
  if (s < 3600) return `${fa(Math.floor(s / 60))} دقیقه پیش`
  if (s < 86400) return `${fa(Math.floor(s / 3600))} ساعت پیش`
  return `${fa(Math.floor(s / 86400))} روز پیش`
}

interface Contact { viewerPhone: string; viewerName?: string; projectName?: string; projectHashId?: string; at: number }

export default function BuilderContactsView() {
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState(true)
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    fetch('/api/builder?contacts=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setLinked(d.linked !== false); setContacts(d.contacts || []) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }
  if (loading) return <div style={{ color: 'var(--muted)', padding: '60px 0', textAlign: 'center' }}>در حال بارگذاری…</div>
  if (!linked) return <div style={{ ...card, maxWidth: 560 }}><div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>گزارشِ تماس‌ها</div><p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 0, lineHeight: 1.9 }}>حسابِ شما هنوز به پایگاهِ سازنده‌ها متصل نشده است.</p></div>

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 820 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>گزارشِ تماس‌ها</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>کاربرانی که شمارهٔ شما را در سایت دیده‌اند ({fa(contacts.length)})</div>
      </div>
      {contacts.length === 0 ? (
        <div style={{ ...card, color: 'var(--faint)', textAlign: 'center', padding: '50px 18px' }}>هنوز کسی شمارهٔ شما را مشاهده نکرده است.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👤</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{c.viewerName || 'کاربر'}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.projectName ? `پروژه: ${c.projectName}` : 'پروفایلِ سازنده'}</div>
              </div>
              <div style={{ textAlign: 'left', flexShrink: 0 }}>
                <a href={`tel:${c.viewerPhone}`} style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gold)', direction: 'ltr', display: 'block', textDecoration: 'none' }}>{c.viewerPhone}</a>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{timeAgo(c.at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
