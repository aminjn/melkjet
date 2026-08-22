import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local', 'utf-8').split('\n')) {
  const i = l.indexOf('='); if (i < 0) continue
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim()
  if (v.length > 1 && v[0] === v[v.length - 1] && (v[0] === "'" || v[0] === '"')) v = v.slice(1, -1)
  if (k && process.env[k] === undefined) process.env[k] = v
}
const { kvGet } = await import('../app/lib/db.ts')
const rs = await import('../app/lib/agency-roster-store.ts')
const M = await import('../app/lib/roster-name-model.ts')
const N = await import('../app/lib/roster-ner.ts')

if (!await M.primeNameModel()) { console.log('پیکره بارگذاری نشد'); process.exit(1) }
const corpus = M.getCorpus()

// ── برچسب‌گذاری از راه دور: مشاورِ فارغ‌التحصیل = نامِ تأییدشدهٔ مدیر ──────────
const docs = []
for (const sc of await rs.listScrapes()) {
  const full = await rs.getScrape(sc.id)
  const grads = (full?.advisors || []).filter(a => a.phone && a.name && a.tokens?.length)
  if (!grads.length) continue
  const rc = await kvGet('agency_roster_cache:' + sc.id, {})
  for (const a of grads) {
    const parts = new Set(M.norm(a.name).split(' ').filter(Boolean))
    for (const t of a.tokens) {
      const r = rc[t]
      if (r?.desc) docs.push({ title: r.title || '', desc: r.desc, name: M.norm(a.name), parts })
    }
  }
}
console.log('آگهیِ برچسب‌دار:', docs.length)
if (docs.length < 100) { console.log('کم است — آموزش انجام نشد'); process.exit(0) }

// تقسیم بر اساسِ *آگهی* نه توکن، وگرنه نشتِ داده رخ می‌دهد
const tr = [], te = []
docs.forEach((d, i) => (i % 5 === 0 ? te : tr).push(d))
const build = set => {
  const X = [], y = []
  for (const d of set) {
    const { toks, nLines, nDoc } = N.tokenize(d.desc)
    const ts = N.titleTokens(d.title)
    toks.forEach((t, i) => { X.push(N.featsOf(toks, i, nLines, nDoc, ts, corpus)); y.push(d.parts.has(M.norm(t.w)) ? 1 : 0) })
  }
  return [X, y]
}
const [Xtr, ytr] = build(tr), [Xte, yte] = build(te)
console.log('توکنِ آموزشی:', Xtr.length, '(مثبت', ytr.reduce((a, b) => a + b, 0) + ')',
            '| آزمون:', Xte.length, '(مثبت', yte.reduce((a, b) => a + b, 0) + ')')

const w = N.trainNer(Xtr, ytr, 600, 0.6, 0.01)
console.log('\n--- وزن‌ها ---')
N.NER_FEATURES.forEach((f, i) => console.log('  ', f.padEnd(12), w[i].toFixed(3)))

// سنجشِ توکنی
let tp = 0, fp = 0, fn = 0
for (let i = 0; i < Xte.length; i++) { const p = N.dot(Xte[i], w) >= 0.55 ? 1 : 0
  if (p && yte[i]) tp++; else if (p && !yte[i]) fp++; else if (!p && yte[i]) fn++ }
console.log('\nتوکنی → precision', (tp / (tp + fp || 1)).toFixed(3), 'recall', (tp / (tp + fn || 1)).toFixed(3))

// سنجشِ واقعی: در هر آگهیِ کنارگذاشته، نامِ پیش‌بینی‌شده با نامِ درست یکی است؟
let exact = 0, partial = 0, none = 0, wrong = 0
const misses = []
for (const d of te) {
  const { toks, nLines, nDoc } = N.tokenize(d.desc)
  if (!toks.length) { none++; continue }
  const ts = N.titleTokens(d.title)
  const sc = toks.map((_, i) => N.dot(N.featsOf(toks, i, nLines, nDoc, ts, corpus), w))
  let bi = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[bi]) bi = i
  if (sc[bi] < 0.55) { none++; continue }
  const pred = M.norm(toks[bi].w)
  if (pred === d.name) exact++
  else if (d.parts.has(pred)) partial++
  else { wrong++; if (misses.length < 12) misses.push(pred + ' ≠ ' + d.name) }
}
const tot = te.length
console.log('\nآگهی‌محور →  دقیق', exact, '| بخشی', partial, '| اشتباه', wrong, '| بی‌نام', none, '| کل', tot)
console.log('  نرخِ درست (دقیق+بخشی):', (((exact + partial) / tot) * 100).toFixed(1) + '%')
console.log('  نمونهٔ خطا:', misses.join(' · '))

if (process.argv.includes('--save')) {
  await N.saveNer({ w, trainedAt: Date.now(), n: Xtr.length,
    metrics: { exact, partial, wrong, none, total: tot } })
  console.log('\nSAVED')
} else console.log('\n(ذخیره نشد — --save بده)')
process.exit(0)
