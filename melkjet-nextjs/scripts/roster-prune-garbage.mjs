// حذفِ مشاورانِ جعلی (واژگانِ بازار) بدونِ دست‌زدن به بقیه.
// اجرا: node --import ./scripts/reos-loader.mjs scripts/roster-prune-garbage.mjs [--apply] [--thr=0.35]
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local', 'utf-8').split('\n')) {
  const i = l.indexOf('='); if (i < 0) continue
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim()
  if (v.length > 1 && v[0] === v[v.length - 1] && (v[0] === "'" || v[0] === '"')) v = v.slice(1, -1)
  if (k && process.env[k] === undefined) process.env[k] = v
}
const { kvSet } = await import('../app/lib/db.ts')
const rs = await import('../app/lib/agency-roster-store.ts')
const M = await import('../app/lib/roster-name-model.ts')
const { validName } = await import('../app/lib/agency-name-lexicon.ts')
if (!await M.primeNameModel()) { console.log('مدل بارگذاری نشد'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const THR = Number((process.argv.find(a => a.startsWith('--thr=')) || '').split('=')[1]) || 0.35
let scr = 0, dropped = 0, freed = 0
for (const sc of await rs.listScrapes()) {
  const full = await rs.getScrape(sc.id); if (!full?.advisors?.length) continue
  const bad = [], keep = []
  for (const a of full.advisors) {
    if (a.phone) { keep.push(a); continue }              // حسابِ واقعی هرگز حذف نمی‌شود
    const p = M.nameProbSync(a.name)
    const struct = !!validName(a.name)
    ;(!struct || (p !== null && p < THR) ? bad : keep).push(a)
  }
  if (!bad.length) continue
  scr++; dropped += bad.length
  const tks = bad.flatMap(a => a.tokens || []); freed += tks.length
  console.log(`\n### ${sc.slug} | حذف ${bad.length} از ${full.advisors.length} | ${tks.length} فایل آزاد`)
  console.log('  ', bad.map(a => `${a.name}(${(M.nameProbSync(a.name) ?? -1).toFixed(2)}·${a.listingCount || 0})`).join(' · '))
  if (!APPLY) continue
  await kvSet('agency_roster_backup2:' + sc.id, full.advisors)
  const un = [...new Set([...(full.unnamedTokens || []), ...tks])].slice(0, 100)
  await rs.patchScrape(sc.id, { advisors: keep, unnamedTokens: un,
    lastUnnamed: (full.lastUnnamed || 0) + tks.length })
}
console.log(`\nآژانس: ${scr} | مشاورِ جعلی: ${dropped} | فایلِ آزادشده: ${freed}`)
console.log(APPLY ? 'اعمال شد.' : '(آزمایشی — --apply بده)')
process.exit(0)
