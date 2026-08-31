import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local','utf-8').split('\n')) { const i=l.indexOf('='); if(i<0) continue; const k=l.slice(0,i).trim(); let v=l.slice(i+1).trim(); if(v.length>1&&v[0]===v[v.length-1]&&(v[0]==="'"||v[0]==='"')) v=v.slice(1,-1); if(k&&process.env[k]===undefined) process.env[k]=v }
const AS = await import('../app/lib/advisor-store.ts')
const S  = await import('../app/lib/scraper-store.ts')
const DP = await import('../app/lib/divar-post.ts')
const LI = await import('../app/lib/listing-image.ts')

const arg = n => (process.argv.find(a => a.startsWith('--'+n+'=')) || '').split('=')[1] || ''
const DRY = process.argv.includes('--dry')
const MAX = Number(arg('max')) || 1e9, DELAY = Number(arg('delay')) || 1200, BUDGET = (Number(arg('minutes')) || 0) * 60000
const T0 = Date.now()

// نگاشتِ فایلِ ما → توکنِ دیوار، از همان imports که هنگام ورود ثبت شده
const db = JSON.parse(readFileSync('.advisor-divar-data.json', 'utf-8'))
const tokOf = new Map()
for (const [ph, a] of Object.entries(db.advisors || {}))
  for (const im of (a.imports || [])) if (im.listingId && im.token) tokOf.set(ph + '|' + im.listingId, im.token)

let scanned = 0, fixed = 0, dead = 0, skipped = 0
outer:
for (const ph of Object.keys(db.advisors || {})) {
  const L = (await AS.getAdvisor(ph)).listings || []
  for (const l of L) {
    const img = l.images?.[0] || ''
    if (!img || img.startsWith('/api/li/')) { skipped++; continue }   // از قبل محلی است
    // ONLY_LIVE — اولویت با آنچه کاربر واقعاً می‌بیند: آگهیِ فعالِ منتشرشده.
    // ۳۳ هزار فایلِ کل یعنی ساعت‌ها درخواست به دیوار؛ بیشترشان هم آگهیِ مرده‌اند.
    if (!process.env.ALL && !(l.status === 'active' && l.publicId)) { skipped++; continue }
    const tok = tokOf.get(ph + '|' + l.id)
    if (!tok) { skipped++; continue }
    scanned++
    if (DRY) { if (scanned >= MAX) break outer; continue }
    try {
      const post = await DP.fetchDivarPost(tok)
      const fresh = post?.images?.[0]
      if (!fresh) { dead++ }
      else {
        const local = await LI.cacheRemote(fresh)
        if (local) {
          await AS.updateListing(ph, l.id, { images: [local, ...(post.images || []).slice(1)] })
          if (l.publicId) { try { await S.updateItem(l.publicId, { image: local }) } catch {} }
          fixed++
          console.log('✓', ph, tok, local)
        } else dead++
      }
    } catch (e) { dead++ }
    if (fixed + dead >= MAX) break outer
    if (BUDGET && Date.now() - T0 > BUDGET) { console.log('بودجهٔ زمانی تمام شد'); break outer }
    await new Promise(r => setTimeout(r, DELAY))
  }
}
console.log(`\nنیازمندِ ترمیم: ${scanned} | ترمیم‌شده: ${fixed} | بی‌نتیجه: ${dead} | ردشده: ${skipped}`)
