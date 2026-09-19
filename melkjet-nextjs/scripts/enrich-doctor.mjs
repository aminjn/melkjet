#!/usr/bin/env node
// One run, every branch of the enrichment question answered.
//
// Written after a long session of one-hypothesis-per-round-trip: the heartbeat said
// enrichPending 0 while a standalone probe said 14,378 listings had no enrichment at
// all, and six guesses in a row about why were wrong. The numbers involved move
// (expiry is time-based, the scraper is always running), so the only useful report
// is one that takes every measurement in the same breath.
//
// Run:  node --import ./scripts/reos-loader.mjs scripts/enrich-doctor.mjs
import { readFileSync, existsSync, statSync } from 'node:fs'

function loadEnv(f) {
  if (!existsSync(f)) return
  for (const l of readFileSync(f, 'utf-8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnv('.env.production.local'); loadEnv('.env')

const out = (k, v) => console.log('  ' + String(k).padEnd(26) + String(v))
const head = t => console.log('\n' + t)
const day = ms => Math.floor((Date.now() - ms) / 86400000)

const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
const { listItems } = await import('../app/lib/scraper-store.ts')
const { getEnrichment } = await import('../app/lib/enrich-store.ts')
const { isEnriched } = await import('../app/lib/enrich-warm.ts')

head('env')
out('DATABASE_URL', process.env.DATABASE_URL ? 'set' : 'MISSING')
out('pgEnabled()', pgEnabled())

head('enrich file')
const F = '.enrich-data.json'
const st = existsSync(F) ? statSync(F) : null
const raw = st ? JSON.parse(readFileSync(F, 'utf-8')) : {}
const fileKeys = new Set(Object.keys(raw))
out('mtime', st ? new Date(st.mtimeMs).toISOString() : 'MISSING')
out('size MB', st ? (st.size / 1048576).toFixed(1) : '-')
out('keys', fileKeys.size)

head('listings table')
if (pgEnabled()) {
  const r = await pgTx(c => c.query(`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE status NOT IN ('rejected','duplicate')) AS not_rejected
    FROM listings WHERE type='listing'`))
  out('type=listing', r.rows[0].total)
  out('status ok', r.rows[0].not_rejected)
  const e = await pgTx(c => c.query(`SELECT count(*) AS n FROM enrich`))
  out('enrich rows', e.rows[0].n)
}

head('what the sweep actually sees')
const pub = await listItems('listing', { publicOnly: true })
const noEntry = pub.filter(it => getEnrichment(it.id) === null)
const notEnriched = pub.filter(it => isEnriched(it.id) === false)
out('listItems publicOnly', pub.length)
out('  of those, no entry', noEntry.length)
out('  isEnriched === false', notEnriched.length)
out('  key present in file', pub.filter(it => fileKeys.has(it.id)).length)

// The question the counts alone cannot answer: is the gap a backlog the sweep is
// still working through, or listings it has been ignoring for weeks? At 12 per 45s
// the sweep clears about 960/hour, so anything older than a couple of days without
// an entry means it is not reaching them at all.
head('age of the listings with no enrichment')
const buckets = { '0-1d': 0, '1-3d': 0, '3-7d': 0, '7-30d': 0, '30d+': 0, 'no date': 0 }
for (const it of noEntry) {
  const d = it.scrapedAt ? day(it.scrapedAt) : null
  if (d === null) buckets['no date']++
  else if (d <= 1) buckets['0-1d']++
  else if (d <= 3) buckets['1-3d']++
  else if (d <= 7) buckets['3-7d']++
  else if (d <= 30) buckets['7-30d']++
  else buckets['30d+']++
}
for (const [k, v] of Object.entries(buckets)) out(k, v)

// Two different questions, and reading the first as the second is a mistake this
// script has already caused once: a key whose listing is expired or rejected is
// not orphaned, it is just not on display. Only a key with no row at all in
// listings is unreachable, because an id is the only way back to it.
head('enrichment keys vs listings')
const liveIds = new Set(pub.map(it => it.id))
let notPublic = 0
for (const k of fileKeys) if (liveIds.has(k) === false) notPublic++
out('not currently public', notPublic + '  (expired or rejected - keep)')
if (pgEnabled()) {
  const ids = await pgTx(c => c.query('SELECT id FROM listings'))
  const known = new Set(ids.rows.map(x => x.id))
  let orphan = 0
  for (const k of fileKeys) if (known.has(k) === false) orphan++
  out('no listing row at all', orphan + '  (unreachable - prunable)')
  out('  as % of file', fileKeys.size ? ((orphan / fileKeys.size) * 100).toFixed(1) + '%' : '-')
}

console.log('')
process.exit(0)
