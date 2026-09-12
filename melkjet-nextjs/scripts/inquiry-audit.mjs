#!/usr/bin/env node
// Structural auditor for the inquiry (estelam) flows.
//
// NOT an end-to-end test. Green means the pieces are in place: the model has the
// field and the code calls the notifier. It does NOT mean a real user click works.
//
// Why it exists: the materials inquiry flow was reported "complete" while the
// seller's reply went nowhere. "I audited it" is not reviewable; this table is.
//
// Run from the project root:  node scripts/inquiry-audit.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs'

const R = (p) => { try { return existsSync(p) ? readFileSync(p, 'utf8') : null } catch { return null } }

const T = {
  title: '\u0628\u0627\u0632\u0631\u0633\u0650 \u0627\u0633\u062a\u0639\u0644\u0627\u0645\u200c\u0647\u0627',
  sub: '\u062a\u062d\u0644\u06cc\u0644\u0650 \u0633\u0627\u062e\u062a\u0627\u0631\u06cc \u2014 \u0646\u0647 \u0622\u0632\u0645\u0648\u0646\u0650 \u0633\u0631\u062a\u0627\u0633\u0631\u06cc',
  ident: '\u0647\u0648\u06cc\u062a\u0650 \u067e\u0631\u0633\u0646\u062f\u0647',
  reply: '\u0641\u06cc\u0644\u062f\u0650 \u067e\u0627\u0633\u062e',
  nAdd: '\u0627\u0639\u0644\u0627\u0646 \u0628\u0647 \u0641\u0631\u0648\u0634\u0646\u062f\u0647',
  nAns: '\u0627\u0639\u0644\u0627\u0646 \u0628\u0647 \u067e\u0631\u0633\u0646\u062f\u0647',
  view: '\u0645\u0633\u06cc\u0631\u0650 \u062f\u06cc\u062f\u0646\u0650 \u067e\u0627\u0633\u062e',
  missing: '\u0641\u0627\u06cc\u0644 \u0646\u06cc\u0633\u062a',
  gapsNone: '\u0634\u06a9\u0627\u0641\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f \u2014 \u0648\u0644\u06cc \u0627\u06cc\u0646 \u06cc\u0639\u0646\u06cc \u0642\u0637\u0639\u0647\u200c\u0647\u0627 \u0633\u0631\u0650 \u062c\u0627\u06cc\u0634\u0627\u0646\u0646\u062f\u060c \u0646\u0647 \u0627\u06cc\u0646\u06a9\u0647 \u062a\u0633\u062a \u0634\u062f\u0647',
  gaps: '\u0634\u06a9\u0627\u0641',
  feeder: '\u062e\u0648\u0631\u0627\u06a9\u200c\u062f\u0647\u0646\u062f\u0647\u0654 \u0627\u06cc\u0646 \u062c\u0631\u06cc\u0627\u0646',
  into: '\u2192 \u0648\u0631\u0648\u062f\u06cc\u0650 \u062e\u0648\u062f\u06a9\u0627\u0631 \u0628\u0647',
  unlisted: '\u062c\u0631\u06cc\u0627\u0646\u0650 \u0641\u0647\u0631\u0633\u062a\u200c\u0646\u0634\u062f\u0647 (\u0628\u0631\u0631\u0633\u06cc \u0646\u0634\u062f\u0647)',
  flows: [
    '\u0645\u0635\u0627\u0644\u062d \u0648 \u0641\u0631\u0648\u0634\u06af\u0627\u0647',
    '\u0645\u0627\u0644\u06a9 \u0648 \u0645\u0644\u06a9',
  ],
}

const FLOWS = [
  { t: 0, store: 'app/lib/materials-store.ts', add: 'addInquiry', ans: 'answerInquiry',
    views: ['app/api/inquiries/route.ts', 'app/inquiries/page.tsx'] },
  { t: 1, store: 'app/lib/owner-store.ts', add: 'addInquiry', ans: 'answerInquiry',
    views: [] },
]

// Not flows of their own: they only create inquiries inside a flow above.
const FEEDERS = [
  { file: 'app/lib/auto-lead.ts', into: 1 },
]

const RE_IDENT = /customerPhone|customerUserId/
const RE_REPLY = /\breply\s*\??\s*:|\banswerText\b/
const RE_NOTIF = /addNotif|notifyNew|sendCard|tgApi|sendSms/

// Body of the named function, up to the next top-level declaration.
function fnBody (src, name) {
  const pats = [
    new RegExp('(export\\s+)?(async\\s+)?function\\s+' + name + '\\b'),
    new RegExp('(export\\s+)?(const|let|var)\\s+' + name + '\\s*=')
  ]
  for (const re of pats) {
    const i = src.search(re)
    if (i < 0) continue
    const rest = src.slice(i + 1)
    const j = rest.search(/\nexport\s|\n(const|let|var|async function|function)\s/)
    return j < 0 ? rest : rest.slice(0, j)
  }
  return null
}

const mark = (b) => (b ? '\u2705' : '\u274c')
const line = (k, v, note) => console.log('    ' + k + ' : ' + v + (note ? '  ' + note : ''))

console.log('')
console.log('=== ' + T.title + ' \u2014 ' + T.sub + ' ===')
console.log('')

let gaps = 0
const seen = new Set()

for (const f of FLOWS) {
  seen.add(f.store)
  const src = R(f.store)
  console.log('[' + T.flows[f.t] + ']  ' + f.store)
  if (src === null) { line(T.ident, mark(false), T.missing); gaps++; console.log(''); continue }

  const bAdd = fnBody(src, f.add)
  const bAns = fnBody(src, f.ans)
  const checks = [
    [T.ident, RE_IDENT.test(src)],
    [T.reply, RE_REPLY.test(src)],
    [T.nAdd, !!bAdd && RE_NOTIF.test(bAdd)],
    [T.nAns, !!bAns && RE_NOTIF.test(bAns)],
    [T.view, f.views.length > 0 && f.views.every((p) => R(p) !== null)],
  ]
  for (const [k, ok] of checks) { line(k, mark(ok)); if (!ok) gaps++ }
  console.log('')
}

for (const fd of FEEDERS) {
  seen.add(fd.file)
  if (R(fd.file) === null) continue
  console.log('[+] ' + T.feeder + ' \u2014 ' + fd.file + '  ' + T.into + ' ' + T.flows[fd.into])
}
console.log('')

// Anything with "inquir" in app/lib that is not listed above.
try {
  for (const n of readdirSync('app/lib')) {
    const p = 'app/lib/' + n
    if (seen.has(p) || !n.endsWith('.ts')) continue
    const src = R(p)
    if (src && /inquir/i.test(src)) { console.log('[?] ' + T.unlisted + ': ' + p); gaps++ }
  }
} catch {}

console.log('')
console.log(gaps === 0 ? T.gapsNone : T.gaps + ': ' + gaps)
process.exit(gaps === 0 ? 0 : 1)
