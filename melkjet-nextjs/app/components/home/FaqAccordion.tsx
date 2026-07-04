'use client'
import { useState } from 'react'

// جزیرهٔ آکاردئونِ سؤالاتِ پرتکرار.
export default function FaqAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [openFaq, setOpenFaq] = useState(-1)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {faqs.map((f, i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
          <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '18px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}>
            <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)' }}>{f.q}</span>
            <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: 'var(--goldDim)', color: 'var(--gold)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{openFaq === i ? '−' : '+'}</span>
          </button>
          {openFaq === i && (
            <div style={{ padding: '0 20px 18px', fontSize: 14.5, lineHeight: 1.9, color: 'var(--muted)' }}>{f.a}</div>
          )}
        </div>
      ))}
    </div>
  )
}
