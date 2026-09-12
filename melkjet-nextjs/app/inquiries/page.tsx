'use client'
import { useEffect, useState } from 'react'

// «استعلام‌ها» — یک صفحه برای هر دو نقش. پیش از این پاسخِ فروشنده فقط در سندِ خودش
// می‌نشست و پرسنده هیچ جایی برای دیدنش نداشت؛ و صفحه‌ای که ساخته شد به هیچ منویی وصل
// نبود. حالا از منوی همهٔ پنل‌ها در دسترس است.

type Sent = { id: string; product: string; qty?: string; note?: string; status: 'new' | 'answered'; reply?: string; createdAt: number; shopName: string; shopSlug: string }
type Recv = { id: string; customer: string; product: string; qty?: string; note?: string; status: 'new' | 'answered'; reply?: string; createdAt: number }

const fa = (n: number) => n.toLocaleString('fa-IR')
const dateFa = (ms: number) => new Date(ms).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
const CARD: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }

function Pill({ done }: { done: boolean }) {
  return <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 10px', color: done ? '#2f7d4f' : '#8a6a1e', background: done ? 'rgba(95,180,120,.12)' : 'rgba(200,160,60,.12)', border: `1px solid ${done ? 'rgba(95,180,120,.45)' : 'rgba(200,160,60,.45)'}` }}>{done ? 'پاسخ داده شد' : 'در انتظارِ پاسخ'}</span>
}

export default function InquiriesPage() {
  const [tab, setTab] = useState<'sent' | 'recv'>('sent')
  const [sent, setSent] = useState<Sent[] | null>(null)
  const [recv, setRecv] = useState<Recv[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/inquiries').then(async r => {
      if (r.status === 401) { window.location.href = `/auth?next=${encodeURIComponent('/inquiries')}`; return }
      const d = await r.json().catch(() => ({}))
      if (d?.ok) { setSent(d.sent || []); setRecv(d.received || []) } else setFailed(true)
    }).catch(() => setFailed(true))
  }, [])

  const tabBtn = (k: 'sent' | 'recv', label: string, n: number | null) => (
    <button onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: tab === k ? 800 : 600, border: `1px solid ${tab === k ? 'var(--gold)' : 'var(--line)'}`, background: tab === k ? 'var(--goldDim)' : 'transparent', color: tab === k ? 'var(--gold)' : 'var(--muted)' }}>
      {label}{n !== null && n > 0 ? ` (${fa(n)})` : ''}
    </button>
  )

  return (
    <main dir="rtl" style={{ maxWidth: 780, margin: '0 auto', padding: '28px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>استعلام‌ها</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 2 }}>
          استعلام‌هایی که فرستاده‌ای و آنهایی که دریافت کرده‌ای. وقتی طرفِ مقابل پاسخ بدهد، اعلان هم برایت می‌آید.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {tabBtn('sent', 'فرستاده‌ها', sent ? sent.length : null)}
        {tabBtn('recv', 'دریافتی‌ها', recv ? recv.length : null)}
      </div>

      {failed && <div style={{ fontSize: 13, color: 'var(--muted)' }}>فهرست نیامد — صفحه را تازه کن.</div>}
      {!failed && sent === null && <div style={{ fontSize: 13, color: 'var(--muted)' }}>در حالِ بارگذاری…</div>}

      {tab === 'sent' && sent && sent.length === 0 && (
        <div style={{ ...CARD, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2 }}>
          هنوز استعلامی نفرستاده‌ای. از صفحهٔ هر فروشندهٔ مصالح می‌توانی قیمت و موجودی بپرسی —{' '}
          <a href="/materials" style={{ color: 'var(--gold)' }}>فروشندگانِ مصالح</a>
        </div>
      )}

      {tab === 'sent' && sent && sent.map(q => {
        const ok = q.status === 'answered' && !!q.reply
        return (
          <div key={q.id} style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 14.5 }}>{q.product}</b>
              {q.qty ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {q.qty}</span> : null}
              <span style={{ flex: 1 }} /><Pill done={ok} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              {q.shopSlug ? <a href={`/store/${q.shopSlug}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>{q.shopName}</a> : q.shopName}
              {' · '}{dateFa(q.createdAt)}
            </div>
            {q.note ? <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.9 }}>یادداشتِ تو: {q.note}</div> : null}
            {ok && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(95,180,120,.07)', border: '1px solid rgba(95,180,120,.3)', fontSize: 13, lineHeight: 2 }}>
                <b style={{ fontSize: 12 }}>پاسخِ فروشنده:</b>
                <div style={{ marginTop: 4 }}>{q.reply}</div>
              </div>
            )}
          </div>
        )
      })}

      {tab === 'recv' && recv && recv.length === 0 && (
        <div style={{ ...CARD, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2 }}>
          استعلامی دریافت نکرده‌ای. اگر فروشندهٔ مصالحی، از پنلِ فروشگاه پاسخ می‌دهی —{' '}
          <a href="/materials" style={{ color: 'var(--gold)' }}>پنلِ فروشگاه</a>
        </div>
      )}

      {tab === 'recv' && recv && recv.map(q => {
        const ok = q.status === 'answered' && !!q.reply
        return (
          <div key={q.id} style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 14.5 }}>{q.product}</b>
              {q.qty ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {q.qty}</span> : null}
              <span style={{ flex: 1 }} /><Pill done={ok} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>از {q.customer} · {dateFa(q.createdAt)}</div>
            {q.note ? <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.9 }}>{q.note}</div> : null}
            {ok
              ? <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(95,180,120,.07)', border: '1px solid rgba(95,180,120,.3)', fontSize: 13, lineHeight: 2 }}>
                  <b style={{ fontSize: 12 }}>پاسخِ تو:</b><div style={{ marginTop: 4 }}>{q.reply}</div>
                </div>
              : <div style={{ marginTop: 10, fontSize: 12.5 }}><a href="/materials" style={{ color: 'var(--gold)' }}>پاسخ بده در پنلِ فروشگاه ←</a></div>}
          </div>
        )
      })}
    </main>
  )
}
