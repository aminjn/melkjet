#!/usr/bin/env node
// Move base64 images out of the reference catalog into media files.
//
// Why this exists, precisely: 11 of 6808 catalog products carried their image as
// a data:image/png;base64 URI of ~1.98MB each. They were not scraped - the admin
// AI image generator handed a data URI straight to setCategoryImage, which then
// copied it onto every image-less product in the category. A product page then
// embedded ~12 of them twice over (once in the markup, once in the RSC flight
// payload), so /product/<slug> weighed 48MB of HTML and its ISR cache alone was
// 970MB on a 23GB disk.
//
// scripts/migrate-base64-media.mjs already did this for blog articles and the
// same comment there records the same symptom (a 77MB /blog). The catalog was
// never covered. Same disease, second host.
//
// Reads and writes .catalog-data.json directly rather than through catalog-store,
// so it is unaffected by that module's read-side guard and its JSON cache.
//
// Run:  node --import ./scripts/reos-loader.mjs scripts/migrate-catalog-base64.mjs [--apply]
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const FILE = '.catalog-data.json'
if (!existsSync(FILE)) { console.error('no ' + FILE); process.exit(1) }

const { saveMedia } = await import('../app/lib/media-store.ts')

const RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/
const db = JSON.parse(readFileSync(FILE, 'utf-8'))
const products = Array.isArray(db.products) ? db.products : []
const categories = Array.isArray(db.categories) ? db.categories : []

let before = 0, after = 0, moved = 0, failed = 0
const cache = new Map()   // identical blobs are shared across products; store once

function convert(uri) {
  if (cache.has(uri)) return cache.get(uri)
  const m = RE.exec(uri)
  if (!m) return null
  let url = null
  if (APPLY) {
    try {
      const buf = Buffer.from(m[2], 'base64')
      if (buf.length) url = '/api/media/' + saveMedia(buf, m[1], 'catalog').id
    } catch { url = null }
  } else {
    url = '/api/media/DRY'
  }
  cache.set(uri, url)
  return url
}

for (const row of [...products, ...categories]) {
  const v = row && row.image
  if (typeof v !== 'string' || !v.startsWith('data:')) continue
  before += v.length
  const url = convert(v)
  if (!url) { failed++; continue }
  after += url.length
  moved++
  if (APPLY) row.image = url
}

const mb = (n) => (n / 1048576).toFixed(2) + 'MB'
console.log('products: ' + products.length + '  categories: ' + categories.length)
console.log('base64 images: ' + moved + '  distinct blobs: ' + cache.size + '  failed: ' + failed)
console.log('data size: ' + mb(before) + ' -> ' + mb(after))

if (!moved) { console.log('\u0647\u06cc\u0686 \u0639\u06a9\u0633\u0650 base64\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f \u2014 \u06a9\u0627\u0631\u06cc \u0644\u0627\u0632\u0645 \u0646\u06cc\u0633\u062a.'); process.exit(0) }

if (!APPLY) {
  console.log('\u0627\u062c\u0631\u0627\u06cc \u0622\u0632\u0645\u0627\u06cc\u0634\u06cc \u2014 \u0628\u0631\u0627\u06cc \u0627\u0639\u0645\u0627\u0644\u0650 \u0648\u0627\u0642\u0639\u06cc: --apply')
  process.exit(0)
}

// Keep a copy of the pre-migration file, then swap atomically.
writeFileSync(FILE + '.pre-b64', readFileSync(FILE))
writeFileSync(FILE + '.tmp', JSON.stringify(db))
renameSync(FILE + '.tmp', FILE)
const sz = readFileSync(FILE).length
console.log('written. ' + FILE + ' is now ' + mb(sz) + '  (backup: ' + FILE + '.pre-b64)')
console.log('next: pm2 reload ecosystem.config.js --update-env   (drop the cached catalog)')
