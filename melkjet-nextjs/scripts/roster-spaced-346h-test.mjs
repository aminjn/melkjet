// فاز ۳۴۶ح — «✦✦ S H A Y G A N ✦✦»: نامِ حرف‌به‌حرف فاصله‌دار. AI «SHAYGAN» می‌گفت و ضدِ توهم ردش می‌کرد؛ تأییدِ ادمین هم
// فقط همان یک آگهی را می‌گرفت («باید دونه‌دونه بزنم»). حالا دنبالهٔ ≥۳ تک‌حرف یک واژه است.
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-spaced-346h-test.mjs
const R = await import('../app/lib/agency-roster.ts')
const S = await import('../app/lib/agency-roster-store.ts')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }
const lines = R.textLines('✦✦✦✦✦✦ S H A Y G A N ✦✦✦✦✦✦\n(( خرید و فروش تخصصی مطب ))\nعلی و رضا\nبلوک A B')
ok('S H A Y G A N ⇒ یک واژه', JSON.stringify(lines[0]) === '["shaygan"]')
ok('«خرید و فروش»/«علی و رضا» دست نخورد', lines[1].includes('و') && JSON.stringify(lines[2]) === '["علی","و","رضا"]')
ok('دو تک‌حرف (A B) چسبانده نمی‌شود', JSON.stringify(lines[3]) === '["بلوک","a","b"]')
const T = 'فروش دفتر کار'
const head = '✦✦✦✦✦✦ S H A Y G A N ✦✦✦✦✦✦\n(( خرید و فروش تخصصی مطب و دفترکار ))\n'
const D = { s1: head + 'واحد ۹۰ متری', s2: head + 'واحد ۱۲۰ متری', s3: head + 'واحد ۲۲۰ متری', x1: 'سند آزاد\nتماس بگیرید' }
const aiSays = async (items) => ({ map: Object.fromEntries(items.filter(it => /S H A Y/.test(it.desc)).map(it => [it.i, 'SHAYGAN'])), raw: '', answered: items.map(it => it.i) })
const aiSilent = async (items) => ({ map: {}, raw: '', answered: items.map(it => it.i) })
const mk = (ai) => ({ ai, profileTokens: async () => ({ posts: Object.keys(D).map(t => ({ token: t, title: T })), name: 'x' }), post: async (t) => ({ title: T, description: D[t], images: [] }) })
const fp = async (t) => ({ title: T, description: D[t] || '', images: [], facts: [], amenities: [] })
const ids = []
try {
  const id = (await S.addScrape({ slug: 'MjSpaced346h', agencyName: 'املاک شایگان‌تست' })).scrape.id; ids.push(id)
  await S.syncRoster(id, undefined, { budgetMs: 60000, f: mk(aiSays), fetchPost: fp })
  let sc = await S.getScrape(id)
  const sh = sc.advisors.find(a => a.name === 'SHAYGAN')
  ok('جوابِ AI «SHAYGAN» دیگر ضدِ توهم رد نمی‌شود — هر ۳ آگهی', !!sh && ['s1', 's2', 's3'].every(t => sh.tokens.includes(t)))
  // AIِ ساکت + تأییدِ یک‌کلیکیِ ادمین ⇒ همه
  const id2 = (await S.addScrape({ slug: 'MjSpaced346h2', agencyName: 'املاک دیگر' })).scrape.id; ids.push(id2)
  await S.syncRoster(id2, undefined, { budgetMs: 60000, f: mk(aiSilent), fetchPost: fp })
  const r = await S.setAdName(id2, 's1', 'SHAYGAN')
  ok('یک کلیک: ۳ آگهی این نام را دارند', r.ok && r.matched === 3)
  await S.syncRoster(id2, undefined, { budgetMs: 60000, f: mk(aiSilent), fetchPost: fp })
  sc = await S.getScrape(id2)
  const sh2 = sc.advisors.find(a => a.name === 'SHAYGAN')
  ok('هر ۳ آگهی با یک تأیید به «SHAYGAN» رفتند', !!sh2 && ['s1', 's2', 's3'].every(t => sh2.tokens.includes(t)))
  ok('آگهیِ بی‌ربط بی‌نام ماند', (sc.unnamedTokens || []).includes('x1'))
} catch (e) { fail++; console.log('  ✗ استثنا:', e?.stack || e) }
finally { for (const id of ids) try { await S.removeScrape(id) } catch {} }
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
