// فاز ۳۴۴ح — «Cannot read properties of undefined (reading 'idx')» روی ده‌ها آژانس: مسابقهٔ کارگرهای AI.
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-ai-race-344h-test.mjs
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }
const { saveAdminData, getAdminData } = await import('../app/lib/admin-store.ts')
const { buildAgencyRoster } = await import('../app/lib/agency-roster.ts')
const SNAP = JSON.parse(JSON.stringify(getAdminData()))
process.on('exit', () => { try { saveAdminData(SNAP) } catch {} })
saveAdminData({ email: 'x', passwordHash: 'x', gapgpt: { baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k' }, agentModels: { content: { text: 'm' } }, aiEnabled: true, aiAreas: { roster: true } })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
for (const n of [4, 5, 7, 10]) {
  const tokens = Array.from({ length: n }, (_, i) => 'rc' + n + '_' + i)
  const f = {
    profileTokens: async () => ({ posts: tokens.map(t => ({ token: t, title: 'آپارتمان ' + t })), name: 'آژانس مسابقه', reason: '' }),
    post: async (t) => ({ title: 'آپارتمان ' + t, description: 'نوساز فول امکانات ' + t, images: [] }),
    // AIِ سریع؛ اولی کمی کندتر تا کارگرها ناهم‌گام شوند
    ai: async (ch) => { await sleep(ch[0].i === 0 ? 30 : 1); return { map: {}, raw: '', answered: ch.map(it => it.i) } },
  }
  let calls = 0
  // shouldStop ناهم‌زمان (مثلِ تولید که getScrape می‌زند) — همان awaitی که پنجرهٔ مسابقه را باز می‌کرد
  const shouldStop = async () => { calls++; await sleep(5); return false }
  let err = ''
  let r
  try { r = await buildAgencyRoster('race' + n, { useAI: true, f, shouldStop }) } catch (e) { err = String(e?.message || e) }
  ok(`${n} آگهی، ۳ کارگر، shouldStopِ ناهم‌زمان ⇒ بی‌خطا (${err || (r?.error || 'ok')})`, !err && !r?.error)
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
