import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local', 'utf-8').split('\n')) {
  const i = l.indexOf('='); if (i < 0) continue
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim()
  if (v.length > 1 && v[0] === v[v.length - 1] && (v[0] === "'" || v[0] === '"')) v = v.slice(1, -1)
  if (k && process.env[k] === undefined) process.env[k] = v
}
const { kvGet } = await import('../app/lib/db.ts')
const ml = await import('../app/lib/agency-roster-ml.ts')
const M = await import('../app/lib/roster-name-model.ts')
const { validName } = await import('../app/lib/agency-name-lexicon.ts')

if (!await M.primeNameModel()) { console.log('مدل آموزش ندیده — متوقف شد'); process.exit(1) }
const raw = await kvGet('agency_ml', { names: {}, negatives: {} })
const names = Object.entries(raw.names || {})
console.log('ورودی‌های واژه‌نامه:', names.length)

const drop = [], keep = []
for (const [key, rec] of names) {
  const nm = String(rec?.name || key)
  const structural = !!validName(nm)
  const p = M.nameProbSync(nm)
  // ADMIN_PROTECT — برچسبِ انسانی حقیقتِ زمینی است؛ مدل که روی همان‌ها آموزش دیده
  // حق ندارد ردشان کند. اگر مدل با تأییدِ مدیر مخالف است، ایراد از مدل است نه از برچسب.
  const bad = rec?.teacher !== 'admin' && (!structural || (p !== null && p < 0.4))
  ;(bad ? drop : keep).push({ nm, w: rec?.weight || 0, t: rec?.teacher, p: p == null ? -1 : +p.toFixed(2), structural })
}
drop.sort((a, b) => b.w - a.w); keep.sort((a, b) => b.w - a.w)
console.log('حذف:', drop.length, '| نگه‌داشتن:', keep.length)
console.log('  از حذف‌شده‌ها، تأییدِ مدیر:', drop.filter(x => x.t === 'admin').length, '(باید ۰ باشد)')
console.log('  تأییدِ مدیر که مدل مخالفش بود (حفظ شد):',
  keep.filter(x => x.t === 'admin' && x.p >= 0 && x.p < 0.4).map(x => x.nm + '(p' + x.p + ')').join(' · ') || '—')
console.log('\n--- سنگین‌ترین حذف‌ها ---')
console.log(drop.slice(0, 30).map(x => x.nm + '(w' + x.w + ' p' + x.p + (x.structural ? '' : ' ✗ساختار') + ')').join(' | '))
console.log('\n--- سنگین‌ترین ماندگارها ---')
console.log(keep.slice(0, 25).map(x => x.nm + '(w' + x.w + ' p' + x.p + ')').join(' | '))

if (process.argv.includes('--apply')) {
  let n = 0
  for (const d of drop) { try { await ml.forgetName(d.nm); n++ } catch {} }
  console.log('\nحذف شد:', n)
} else console.log('\n(آزمایشی — برای اعمال --apply بده)')
process.exit(0)
