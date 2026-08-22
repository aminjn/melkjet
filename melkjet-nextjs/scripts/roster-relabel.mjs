// بازبرچسب‌زنیِ روستر با مدلِ جدید — بدونِ هیچ درخواستی به دیوار.
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/roster-relabel.mjs [--scrape=ID] [--apply]
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
if (!await N.loadNer()) { console.log('مدلِ NER بارگذاری نشد — متوقف'); process.exit(1) }
const only = (process.argv.find(a => a.startsWith('--scrape=')) || '').split('=')[1] || ''
const APPLY = process.argv.includes('--apply')

for (const sc of await rs.listScrapes()) {
  if (only && sc.id !== only) continue
  const full = await rs.getScrape(sc.id); if (!full) continue
  const rc = await kvGet('agency_roster_cache:' + sc.id, {})
  const tokens = Object.keys(rc || {}).filter(t => rc[t]?.desc)
  if (tokens.length < 5) { console.log(sc.id, sc.slug, '→ کشِ کافی نیست:', tokens.length); continue }

  // نامِ کش‌شده عمداً حذف می‌شود، وگرنه همان برچسبِ قدیمی دوباره برنده می‌شود.
  const cached = {}
  for (const t of tokens) cached[t] = { title: rc[t].title || '', desc: rc[t].desc || '' }
  const pinnedKeys = (full.advisors || []).filter(a => a.phone).map(a => a.key)

  const roster = await R.buildAgencyRoster(full.slug, {
    useAI: false, cached, pinnedKeys,
    f: {
      profileTokens: async () => ({ posts: tokens.map(t => ({ token: t, title: rc[t].title || '' })), name: full.agencyName }),
      post: async (t) => ({ title: rc[t]?.title || '', description: rc[t]?.desc || '' }),
      ai: async () => ({ map: {}, raw: '' }),
    },
  })
  if (!roster.ok) { console.log(sc.id, sc.slug, '→ خطا:', roster.error); continue }

  const oldNames = new Set((full.advisors || []).map(a => a.name))
  const newNames = new Set(roster.advisors.map(a => a.name))
  const gone = [...oldNames].filter(x => !newNames.has(x))
  const added = [...newNames].filter(x => !oldNames.has(x))
  console.log('\n###', sc.slug, '| ردیف:', tokens.length,
    '| مشاور:', (full.advisors || []).length, '→', roster.advisors.length,
    '| بی‌نام:', full.lastUnnamed ?? '?', '→', roster.unnamed.tokens.length)
  if (gone.length) console.log('  حذف:', gone.slice(0, 20).join(' · '))
  if (added.length) console.log('  افزوده:', added.slice(0, 20).join(' · '))

  if (!APPLY) continue
  await kvSet('agency_roster_backup:' + sc.id, full.advisors || [])
  const oldByKey = new Map((full.advisors || []).map(a => [a.key, a]))
  const recs = roster.advisors.map(a => {
    const o = oldByKey.get(a.key)
    return o
      ? { ...o, name: o.phone ? o.name : a.name, tokens: a.tokens.slice(0, 100), listingCount: a.tokens.length }
      : { key: a.key, name: a.name, owner: `adv:${full.slug}:${a.key}`, listingCount: a.tokens.length, tokens: a.tokens.slice(0, 100) }
  })
  for (const a of (full.advisors || [])) if (a.phone && !recs.some(r => r.key === a.key)) recs.push(a)
  await rs.patchScrape(sc.id, { advisors: recs, lastUnnamed: roster.unnamed.tokens.length,
    unnamedTokens: roster.unnamed.tokens.slice(0, 100) })
  console.log('  ✅ اعمال شد (پشتیبان: agency_roster_backup:' + sc.id + ')')
}
process.exit(0)
