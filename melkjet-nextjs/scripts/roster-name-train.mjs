import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local', 'utf-8').split('\n')) {
  const i = l.indexOf('='); if (i < 0) continue
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim()
  if (v.length > 1 && v[0] === v[v.length - 1] && (v[0] === "'" || v[0] === '"')) v = v.slice(1, -1)
  if (k && process.env[k] === undefined) process.env[k] = v
}
const { kvGet } = await import('../app/lib/db.ts')
const rs = await import('../app/lib/agency-roster-store.ts')
const ml = await import('../app/lib/agency-roster-ml.ts')
const M = await import('../app/lib/roster-name-model.ts')

const docs = []
for (const sc of await rs.listScrapes()) {
  const rc = await kvGet('agency_roster_cache:' + sc.id, {})
  for (const r of Object.values(rc || {})) if (r?.desc) docs.push({ id: sc.id, desc: r.desc })
}
const corpus = M.buildCorpus(docs)
console.log('docs:', docs.length, '| corpus:', corpus.size)

// RAW_ML: برچسبِ مثبت باید از خودِ ذخیره‌گاه بیاید — knownNames فیلدِ teacher را برنمی‌گرداند
// و mlStats فقط ۲۰ ردیفِ برتر می‌دهد، پس ۱۵۹ تأییدِ مدیر به ۴ تقلیل پیدا می‌کرد.
const raw = await kvGet('agency_ml', { names: {}, negatives: {} })
const adminSet = new Set(), negSet = new Set()
for (const [k, v] of Object.entries(raw.names || {})) {
  const nm = M.norm(v?.name || k)
  if (v?.teacher === 'admin') adminSet.add(nm)
}
for (const k of Object.keys(raw.negatives || {})) negSet.add(M.norm(k))
const pos = [...adminSet]
const neg = [...negSet]
for (const [k, st] of corpus) {
  if (st.ag >= 8 && st.b >= 60 && st.s / (st.s + st.b + 1) < 0.05) neg.push(k)
  if (neg.length >= 4000) break
}
console.log('pos(admin):', pos.length, '| neg(auto):', neg.length)
if (pos.length < 40) { console.log('برچسبِ مثبتِ کافی نیست'); process.exit(0) }

// STRUCT_GATE — مدل دروازهٔ دوم است. سنجیدنش روی کاندیداهایی که دروازهٔ اول
// (validName: القاب/واژگانِ نوفه/ساختار) از قبل رد می‌کند، عددِ گمراه‌کننده می‌دهد.
const { validName } = await import('../app/lib/agency-name-lexicon.ts')
const passes = n => { try { return validName(n) === M.norm(n) } catch { return false } }
const pos2 = pos.filter(passes), neg2 = neg.filter(passes)
console.log('پس از دروازهٔ ساختاری → مثبت:', pos2.length, '| منفی:', neg2.length)
const rows = [...pos2.map(n => [n, 1]), ...neg2.map(n => [n, 0])]
const tr = [], te = []
rows.forEach((r, i) => (i % 5 === 0 ? te : tr).push(r))
const XY = a => [a.map(([n]) => M.featurize(n, corpus)), a.map(([, y]) => y)]
const [Xtr, ytr] = XY(tr), [Xte, yte] = XY(te)
const w = M.train(Xtr, ytr, { epochs: 600, lr: 0.7, l2: 0.01 })

console.log('\n--- weights ---')
M.FEATURES.forEach((f, i) => console.log('  ', f.padEnd(10), w[i].toFixed(3)))
console.log('\n--- held-out ---')
console.log('  ', JSON.stringify(M.evaluate(Xte, yte, w)))
// FP_DUMP — خطاهای مثبت را با چشم ببینیم: منفی‌های خودکار ممکن است خودشان نام باشند.
console.log('\n--- threshold sweep ---')
for (const thr of [0.5, 0.6, 0.65, 0.7, 0.8])
  console.log('  thr', thr, JSON.stringify(M.evaluate(Xte, yte, w, thr)))
console.log('\n--- false positives (thr 0.6) ---')
const fps = te.filter(([n, y], i) => y === 0 && M.score(M.featurize(n, corpus), w) >= 0.6)
console.log('  ', fps.slice(0, 30).map(([n]) => n).join(' | '))
console.log('\n--- spot check ---')
for (const t of ['کلید نخورده','تک واحدی','سالن اجتماعات','امور ملکی','مشخصات ملک:','غرق نور',
                 'محمدی','کاظمی','سعیدی','رستگار شادمهری','غریب','متمدن','آرش عبادزاده','جلال گلرنگ'])
  console.log('  ', String(M.score(M.featurize(t, corpus), w).toFixed(3)).padStart(6), t)

if (process.argv.includes('--save')) {
  await M.saveModel({ w, trainedAt: Date.now(), n: rows.length, metrics: M.evaluate(Xte, yte, w) })
  const n = await M.saveCorpus(corpus)
  console.log('\nSAVED | corpus entries:', n)
} else console.log('\n(not saved — pass --save)')
process.exit(0)
