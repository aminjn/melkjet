'use client'
import { useState } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

export default function ContactPage() {
  const [f, setF] = useState({ name: '', phone: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const send = async () => {
    if (!f.name.trim() || !f.message.trim()) { setDone('⚠ نام و پیام الزامی است'); return }
    setBusy(true); setDone('')
    try {
      const r = await fetch('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `پیام تماس: ${f.name}`, description: `نام: ${f.name}\nتلفن: ${f.phone}\nپیام: ${f.message}`, phone: f.phone, owner: f.name }),
      })
      const d = await r.json()
      setDone(d.ok ? '✓ پیام شما ثبت شد؛ به‌زودی تماس می‌گیریم.' : `⚠ ${d.error || 'خطا'}`)
      if (d.ok) setF({ name: '', phone: '', message: '' })
    } catch { setDone('⚠ خطا در ارسال') } finally { setBusy(false) }
  }
  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 11, padding: '11px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '40px 18px 70px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>تماس با ما</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.9, marginBottom: 24 }}>سؤال، پیشنهاد یا همکاری؟ فرم زیر را پر کن، تیم ملک‌جت با تو تماس می‌گیرد.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 22 }}>
          <input style={inp} placeholder="نام و نام خانوادگی *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} placeholder="شماره تماس (۰۹...)" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          <textarea style={{ ...inp, height: 120, resize: 'vertical' }} placeholder="پیام شما *" value={f.message} onChange={e => setF({ ...f, message: e.target.value })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={send} disabled={busy} style={{ padding: '11px 26px', borderRadius: 11, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }}>{busy ? 'در حال ارسال…' : 'ارسال پیام'}</button>
            {done && <span style={{ fontSize: 13, color: done.startsWith('✓') ? '#5fd98a' : '#e7a14a' }}>{done}</span>}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
