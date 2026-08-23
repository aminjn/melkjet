// استخراجِ خودکارِ منفی‌ها: نامی که در چند آژانسِ بی‌ارتباط پیش‌بینی شود، نام نیست.
// اجرا: node --import ./scripts/reos-loader.mjs scripts/roster-mine-noise.mjs [--save] [--min=4]
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local', 'utf-8').split('\n')) {
  const i = l.indexOf('='); if (i < 0) continue
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim()
  if (v.length > 1 && v[0] === v[v.length - 1] && (v[0] === "'" || v[0] === '"')) v = v.slice(1, -1)
  if (k && process.env[k] === undefined) process.env[k] = v
}
const { kvGet, kvSet } = await import('../app/lib/db.ts')
const rs = await import('../app/lib/agency-roster-store.ts')
const M = await import('../app/lib/roster-name-model.ts')
const N = await import('../app/lib/roster-ner.ts')
await M.primeNameModel()
if (!await N.loadNer()) { console.log('NER نیست'); process.exit(1) }
const MIN = Number((process.argv.find(a => a.startsWith('--min=')) || '').split('=')[1]) || 4

const byName = new Map()          // نام → مجموعهٔ آژانس‌ها
const confirmed = new Set()       // نامِ تأییدشدهٔ مدیر — هرگز منفی نمی‌شود
for (const sc of await rs.listScrapes()) {
  const full = await rs.getScrape(sc.id); if (!full) continue
  for (const a of (full.advisors || [])) if (a.phone) confirmed.add(M.norm(a.name))
  const rc = await kvGet('agency_roster_cache:' + sc.id, {})
  for (const r of Object.values(rc || {})) {
    if (!r?.desc) continue
    const b = N.bestName(r.title || '', r.desc || '')
    if (!b) continue
    const k = M.norm(b.name)
    let g = byName.get(k); if (!g) { g = new Set(); byName.set(k, g) }
    g.add(sc.id)
  }
}
const noise = [...byName.entries()]
  .filter(([k, ag]) => ag.size >= MIN && !confirmed.has(k))
  .sort((a, b) => b[1].size - a[1].size)
console.log('نامِ متمایزِ پیش‌بینی‌شده:', byName.size, '| تأییدِ مدیر:', confirmed.size,
            '| منفیِ خودکار (≥' + MIN + ' آژانس):', noise.length)
console.log('\n--- پرتکرارترین‌ها ---')
console.log(noise.slice(0, 40).map(([k, ag]) => `${k}(${ag.size})`).join(' · '))
console.log('\n--- مرزی‌ها ---')
console.log(noise.slice(-25).map(([k, ag]) => `${k}(${ag.size})`).join(' · '))
const single = [...byName.entries()].filter(([, ag]) => ag.size === 1).length
console.log('\nنام‌هایی که فقط در یک آژانس دیده شدند (احتمالاً واقعی):', single)
if (process.argv.includes('--save')) {
  await kvSet('roster_auto_noise', noise.map(([k]) => k))
  console.log('ذخیره شد در roster_auto_noise')
} else console.log('(ذخیره نشد — --save بده)')
process.exit(0)
