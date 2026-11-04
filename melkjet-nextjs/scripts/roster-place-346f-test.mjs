// فاز ۳۴۶و — «محلات اومده توش»: AI (با قاعدهٔ اشتباهِ نسخهٔ ۵) «هروی/دروس/اختیاریه دروس/نیلوفر سران» را مشاور گفت.
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-place-346f-test.mjs
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }
const { saveAdminData, getAdminData } = await import('../app/lib/admin-store.ts')
const { buildAgencyRoster } = await import('../app/lib/agency-roster.ts')
const SNAP = JSON.parse(JSON.stringify(getAdminData())); process.on('exit', () => { try { saveAdminData(SNAP) } catch {} })
saveAdminData({ email: 'x', passwordHash: 'x', gapgpt: { baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k' }, agentModels: { roster: { text: 'm' } }, aiEnabled: true, aiAreas: { roster: true } })
const ads = {
  d1: ['دروس', 'نوساز\nکارشناس ملکی منطقه دروس'], d2: ['دروس', 'فول\nکارشناس ملکی منطقه دروس'],
  h1: ['قیطریه', 'نوساز\nکارشناس تخصصی منطقه هروی'],
  x1: ['اختیاریه', 'نورگیر\nکارشناس امور ملکی منطقه اختیاریه دروس'],
  s1: ['سران', 'دفتر نیلوفر سران'],
  r1: ['دروس', 'نوساز\nکارشناس فروش خانم رضایی'], r2: ['دروس', 'فول\nکارشناس فروش خانم رضایی'],
}
const said = { d1: 'دروس', d2: 'دروس', h1: 'هروی', x1: 'اختیاریه دروس', s1: 'نیلوفر سران', r1: 'رضایی', r2: 'رضایی' }
const toks = Object.keys(ads)
let locs = [], notN = []
const ai = async (items, ag, notNames) => { notN = notNames; for (const it of items) locs.push(it.loc); return { map: Object.fromEntries(items.map(it => [it.i, said[toks[it.i]]])), raw: '', answered: items.map(it => it.i) } }
const f = { ai, profileTokens: async () => ({ posts: toks.map(t => ({ token: t, title: 'آپارتمان', location: ads[t][0] })), name: 'آژانس سران', reason: '' }), post: async (t) => ({ title: 'آپارتمان', description: ads[t][1], images: [] }) }
const r = await buildAgencyRoster('s346f', { useAI: true, f })
const names = r.advisors.map(a => a.name)
ok('محله‌ها مشاور نشدند (دروس/هروی/اختیاریه دروس/نیلوفر سران)', !names.some(n => /دروس|هروی|اختیاریه|نیلوفر|سران/.test(n)))
ok('مشاورِ واقعی (رضایی، ۲ فایل) سالم', r.advisors.some(a => a.name === 'رضایی' && a.tokens.length === 2))
ok('محلِ هر آگهی به AI داده شد', locs.includes('دروس') && locs.includes('قیطریه'))
ok('محله‌های همین آژانس به‌عنوانِ «نام نیست» به AI گفته شد', notN.includes('دروس') && notN.includes('اختیاریه'))
// تأییدِ ادمین از ردِ مکان معاف است
const r2 = await buildAgencyRoster('s346f2', { useAI: true, f, confirmed: ['هروی'], manual: { d1: 'دروس' } })
ok('تأییدِ دستیِ ادمین («دروس» برای همین آگهی) پذیرفته می‌شود', r2.advisors.some(a => a.name === 'دروس' && a.tokens.includes('d1')))
// جوابِ نسخهٔ ۵ دوباره پرسیده می‌شود، نسخهٔ ۴ نه
const asked = []
const ai2 = async (items) => { asked.push(...items.map(it => toks[it.i])); return { map: {}, raw: '', answered: items.map(it => it.i) } }
const cached = Object.fromEntries(toks.map(t => [t, { title: 'آپارتمان', desc: ads[t][1], name: said[t], aiv: t.startsWith('r') ? 4 : 5 }]))
await buildAgencyRoster('s346f3', { useAI: true, cached, f: { ...f, ai: ai2 } })
ok('جواب‌های نسخهٔ ۵ (قاعدهٔ اشتباه) دوباره پرسیده شدند؛ نسخهٔ ۴ نه', asked.length === 5 && !asked.includes('r1') && !asked.includes('r2'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
