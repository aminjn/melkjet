import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local','utf-8').split('\n')) { const i=l.indexOf('='); if(i<0) continue; const k=l.slice(0,i).trim(); let v=l.slice(i+1).trim(); if(v.length>1&&v[0]===v[v.length-1]&&(v[0]==="'"||v[0]==='"')) v=v.slice(1,-1); if(k&&process.env[k]===undefined) process.env[k]=v }
const rs = await import('../app/lib/agency-roster-store.ts')
const AS = await import('../app/lib/advisor-store.ts')
const arg = n => (process.argv.find(a => a.startsWith('--'+n+'=')) || '').split('=')[1] || ''
const DRY = process.argv.includes('--dry')
const ONLY = arg('phone'), CHUNK = Number(arg('chunk')) || 20, MAX = Number(arg('max')) || 1e9
// مکث و بودجهٔ زمانی: اجرای سریع وسطِ روز به پستگرس فشار آورد و سایت را کند کرد
// (statement timeout). شبانه با دستهٔ کوچک و مکثِ بلند اجرا می‌شود.
const DELAY = Number(arg('delay')) || 400, BUDGET = (Number(arg('minutes')) || 0) * 60000, T0 = Date.now()
// فایل‌های یتیم: منتقل شده‌اند ولی چانکِ انتشارشان نیمه‌کاره مانده. مسیرِ ترمیمِ داخلِ
// reassignListings فقط با graduateِ دوباره اجرا می‌شود، و آن هم برای مشاورِ دارای
// حساب مسدود است — پس بدونِ این اسکریپت هرگز منتشر نمی‌شوند.
const phones = new Set()
for (const s of await rs.listScrapes()) for (const r of (s.advisors || [])) if (r.phone) phones.add(r.phone)
let done = 0, failed = 0, touched = 0
for (const p of phones) {
  if (ONLY && p !== ONLY) continue
  const L = (await AS.getAdvisor(p)).listings || []
  const ids = L.filter(x => x.status === 'active' && !x.publicId && !x.unpublishedAt).map(x => x.id)
  if (!ids.length) continue
  touched++
  console.log(p, '→', ids.length, 'فایلِ یتیم')
  if (DRY) { done += ids.length; continue }
  for (let i = 0; i < ids.length && done < MAX; i += CHUNK) {
    const c = ids.slice(i, i + CHUNK)
    try {
      const r = await AS.publishListingsBatch(p, c)
      done += r.length
      if (r.length !== c.length) console.log('   ناقص:', r.length, 'از', c.length)
    } catch (e) { failed += c.length; console.log('   خطا:', String(e.message).slice(0, 90)) }
    await new Promise(r => setTimeout(r, DELAY))
  }
  if (done >= MAX) break
  if (BUDGET && Date.now() - T0 > BUDGET) { console.log('بودجهٔ زمانی تمام شد — ادامه در اجرای بعدی'); break }
}
console.log(`\nمشاورِ درگیر: ${touched} | منتشرشده: ${done} | ناموفق: ${failed}`)
