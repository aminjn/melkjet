'use client'
import { useState } from 'react'

export default function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const chips = ['تحلیل قیمت یک ملک', 'بهترین محله برای بودجه‌ام', 'شروع فروش ملک']

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="دستیار هوشمند"
        className="mj-ai-btn"
        style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 60,
          width: 58, height: 58, borderRadius: 18, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
          color: '#16140f', fontSize: 22, fontWeight: 800,
          boxShadow: '0 14px 34px -10px var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: '.2s',
        }}
      >
        ✦
      </button>
      {open && (
        <div
          className="mj-ai-panel"
          style={{
            position: 'fixed', bottom: 92, left: 24, zIndex: 60,
            width: 'min(360px,calc(100vw - 48px))',
            background: 'var(--surface)',
            border: '1px solid var(--line2)',
            borderRadius: 20,
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            animation: 'rise .35s both'
          }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontWeight: 800 }}>✦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>دستیار ملک‌جت</div>
              <div style={{ fontSize: 11.5, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fbf6f', display: 'inline-block' }}></span>
                آنلاین · پاسخ‌گوی شما
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>
          <div style={{ padding: '18px 18px 0' }}>
            <div style={{ background: 'var(--bg2)', borderRadius: '13px 13px 13px 4px', padding: '12px 14px', fontSize: 13.5, lineHeight: 1.8, color: 'var(--text)' }}>
              سلام 👋 من می‌توانم در خرید، فروش، اجاره، تحلیل قیمت و سرمایه‌گذاری کمکت کنم. از کجا شروع کنیم؟
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
              {chips.map(c => (
                <button key={c} style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{c}</button>
              ))}
            </div>
          </div>
          <div style={{ padding: '12px 18px 18px' }}>
            <div style={{ display: 'flex', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 13, padding: '8px 8px 8px 14px', alignItems: 'center' }}>
              <input
                value={msg}
                onChange={e => setMsg(e.target.value)}
                placeholder="پیامت را بنویس…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5 }}
              />
              <button style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', cursor: 'pointer', fontWeight: 800 }}>↑</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
