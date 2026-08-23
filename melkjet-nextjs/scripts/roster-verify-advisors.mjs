// راستی‌آزماییِ هر مشاور با آگهی‌های خودش، توسطِ مدلِ توکنی.
// اجرا: node --import ./scripts/reos-loader.mjs scripts/roster-verify-advisors.mjs [--apply] [--scrape=ID]
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local', 'utf-8').split('\n')) {
  const i = l.indexOf('='); if (i < 0) continue
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim()
  if (v.length > 1 && v[0] === v[v.length - 1] && (v[0] === "'" || v[0] === '"')) v = v.slice(1, -1)
  if (k && process.env[k] === undefined) process.env[k] = v
}
const { kvGet, kvSet } = await import('../app/lib/db.ts')
const rs = await import('../app/lib/agency-roster-store.ts')
const R = await import('../app/lib/agency-roster.ts')
const M = await import('../app/lib/roster-name-model.ts')
const N = await import('../app/lib/roster-ner.ts')
await M.primeNameModel()
if (!await N.loadNer()) { console.log('NER بارگذاری نشد'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const only = (process.argv.find(a => a.startsWith('--scrape=')) || '').split('=')[1] || ''
let scr = 0, pruned = 0, renamed = 0, freed = 0

for (const sc of await rs.listScrapes()) {
  if (only && sc.id !== only && sc.slug !== only) continue
  const full = await rs.getScrape(sc.id); if (!full?.advisors?.length) continue
  const rc = await kvGet('agency_roster_cache:' + sc.id, {})
  const keep = [], drop = [], fix = []
  for (const a of full.advisors) {
    if (a.phone) { keep.push(a); continue }
    const toks = (a.tokens || []).filter(t => rc[t]?.desc)
    if (toks.length < 2) { keep.push(a); continue }        // نمونهٔ کم = قضاوت نمی‌کنیم
    const votes = new Map(); let hit = 0
    for (const t of toks) {
      const n = R.extractSignature(rc[t].title || '', rc[t].desc || '', full.agencyName || '')[0] || ''
      if (!n) continue
      votes.set(M.norm(n), (votes.get(M.norm(n)) || 0) + 1)
      if (M.norm(n) === M.norm(a.name)) hit++
    }
    const support = hit / toks.length
    const top = [...votes.entries()].sort((x, y) => y[1] - x[1])[0]
    if (support >= 0.34) { keep.push(a); continue }
    const NORENAME = process.argv.includes("--no-rename")
    if (top && top[1] / toks.length >= 0.5 && M.norm(top[0]) !== M.norm(a.name)) {
      // با --no-rename فقط دست نمی‌زنیم؛ حذف‌کردنشان نامِ درست را هم می‌بُرد.
      if (NORENAME) keep.push(a); else fix.push({ a, to: top[0], sup: support, n: toks.length })
    }
    else drop.push({ a, sup: support, n: toks.length, top: top ? `${top[0]}×${top[1]}` : '—' })
  }
  if (!drop.length && !fix.length) continue
  scr++; pruned += drop.length; renamed += fix.length
  freed += drop.reduce((s, d) => s + (d.a.tokens?.length || 0), 0)
  console.log(`\n### ${sc.slug} | ${full.advisors.length} مشاور | حذف ${drop.length} | تغییرِنام ${fix.length}`)
  if (drop.length) console.log('  حذف:', drop.slice(0, 14).map(d => `${d.a.name}(پشتیبانی ${(d.sup * 100) | 0}٪ از ${d.n} · غالب ${d.top})`).join(' · '))
  if (fix.length) console.log('  تغییرِنام:', fix.slice(0, 10).map(f => `${f.a.name} → ${f.to}`).join(' · '))
  if (!APPLY) continue
  await kvSet('agency_roster_backup3:' + sc.id, full.advisors)
  for (const f of fix) keep.push({ ...f.a, key: f.to, name: f.to, owner: `adv:${full.slug}:${f.to}` })
  const tks = drop.flatMap(d => d.a.tokens || [])
  const un = [...new Set([...(full.unnamedTokens || []), ...tks])].slice(0, 100)
  await rs.patchScrape(sc.id, { advisors: keep, unnamedTokens: un, lastUnnamed: (full.lastUnnamed || 0) + tks.length })
  console.log('  ✅ اعمال شد')
}
console.log(`\nآژانس ${scr} | حذف ${pruned} | تغییرِنام ${renamed} | فایلِ آزاد ${freed}`)
console.log(APPLY ? 'اعمال شد.' : '(آزمایشی — --apply بده)')
process.exit(0)
