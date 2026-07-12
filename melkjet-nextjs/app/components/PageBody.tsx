import React from 'react'

// رندرِ متنِ صفحه‌های عمومی (فاز ۹۸): پاراگراف با خطِ خالی، «## » تیترِ بخش،
// «- » بولت، **متن** پررنگ. عمداً HTML خام رندر نمی‌شود (امن).

function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((p, i) => i % 2 === 1
    ? <strong key={`${keyBase}-${i}`} style={{ fontWeight: 800, color: 'var(--text)' }}>{p}</strong>
    : <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>)
}

export default function PageBody({ body }: { body: string }) {
  const blocks = String(body || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  const out: React.ReactNode[] = []
  blocks.forEach((block, bi) => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (line.startsWith('## ')) {
        out.push(<h2 key={`h-${bi}-${i}`} style={{ fontSize: 18, fontWeight: 800, margin: '22px 0 10px', color: 'var(--goldText)' }}>{line.slice(3)}</h2>)
        i++
        continue
      }
      if (line.startsWith('- ')) {
        const items: string[] = []
        while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i++ }
        out.push(
          <ul key={`ul-${bi}-${i}`} style={{ margin: '0 0 14px', paddingInlineStart: 22, display: 'grid', gap: 8 }}>
            {items.map((it, k) => <li key={k} style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 2 }}>{inline(it, `li-${bi}-${i}-${k}`)}</li>)}
          </ul>,
        )
        continue
      }
      // خط‌های سادهٔ چسبیده = یک پاراگراف
      const para: string[] = []
      while (i < lines.length && !lines[i].startsWith('## ') && !lines[i].startsWith('- ')) { para.push(lines[i]); i++ }
      out.push(<p key={`p-${bi}-${i}`} style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 2.1, margin: '0 0 14px' }}>{inline(para.join(' '), `p-${bi}-${i}`)}</p>)
    }
  })
  return <>{out}</>
}
