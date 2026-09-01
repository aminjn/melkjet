import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local','utf-8').split('\n')) { const i=l.indexOf('='); if(i<0) continue; const k=l.slice(0,i).trim(); let v=l.slice(i+1).trim(); if(v.length>1&&v[0]===v[v.length-1]&&(v[0]==="'"||v[0]==='"')) v=v.slice(1,-1); if(k&&process.env[k]===undefined) process.env[k]=v }
const S = await import('../app/lib/scraper-store.ts')
const all = (await S.listItems('listing')).filter(x => x.image && x.url && /divar/.test(x.url))
all.sort((a,b) => b.scrapedAt - a.scrapedAt)
for (const it of all.slice(0, 3)) {
  const tok = (String(it.url).match(/([A-Za-z0-9_-]{8,})\/?$/) || [])[1]
  console.log('\n=== توکن:', tok)
  console.log('ذخیرهٔ ما :', String(it.image).slice(0, 115))
  try {
    const r = await fetch('https://api.divar.ir/v8/posts-v2/web/' + tok, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const t = await r.text()
    const urls = [...new Set(t.match(/https:[^"\s]*divarcdn[^"\s]*/g) || [])].map(u => u.replace(/\\\//g, '/'))
    console.log('پاسخِ دیوار:', r.status, '| عکسِ یافته:', urls.length)
    for (const u of urls.slice(0, 2)) {
      const h = await fetch(u, { method: 'HEAD' }).catch(() => ({ status: 'ERR' }))
      console.log('   ', h.status, u.slice(0, 115))
    }
  } catch (e) { console.log('خطا:', e.message) }
  await new Promise(r => setTimeout(r, 700))
}
