#!/usr/bin/env node
// ۱۸ ثانیه کجا می‌رود؟
//
// users-page-check said listItemsStable took 21,164ms. listings-load-check then
// ran the very same SQL and it came back in 2,735ms. So the query is not the cost
// - something around it is. The difference between the two scripts is which call
// happened FIRST: whatever runs first pays for the pool connect and for
// ensureSchema, which issues CREATE EXTENSION / CREATE INDEX IF NOT EXISTS against
// a 166 MB table.
//
// This times each stage on its own so the 18 seconds has to show itself.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/load-profile.mjs
import { readFileSync, existsSync } from 'node:fs'

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

const ms = t => String(Math.round(t) + 'ms').padStart(9)
const step = async (label, fn) => { const t0 = Date.now(); const r = await fn(); console.log('  ' + label.padEnd(46) + ms(Date.now() - t0)); return r }

const { pgEnabled, pgTx, pgListingsAll } = await import('../app/lib/db.ts')
if (!pgEnabled()) { console.error('دیتابیس در دسترس نیست.'); process.exit(1) }

console.log('— مرحله به مرحله، در یک پراسسِ تازه —')
await step('۱) اولین تماس با PG (کانکشن + ensureSchema)', () => pgTx(c => c.query('SELECT 1')))
await step('۲) دومین تماس (اسکیما قبلاً آماده)', () => pgTx(c => c.query('SELECT 1')))
const items = await step('۳) pgListingsAll (همان کوئریِ load)', () => pgListingsAll())
console.log('     ← ' + items.length + ' آیتم')
await step('۴) فیلتر+مرتب‌سازی (کارِ buildList)', async () => {
  const a = items.filter(i => i.type === 'listing')
  a.sort((x, y) => (y.scrapedAt || 0) - (x.scrapedAt || 0))
  return a.length
})
await step('۵) همان pgListingsAll، بارِ دوم', () => pgListingsAll())

const mem = process.memoryUsage()
console.log('')
console.log('  هیپِ مصرفی: ' + Math.round(mem.heapUsed / 1048576) + ' MB از ' + Math.round(mem.heapTotal / 1048576) + ' MB')
console.log('')
console.log('اگر مرحلهٔ ۱ چند ثانیه باشد، هزینه راه‌اندازیِ اسکیماست و فقط یک بار در هر پراسس رخ می‌دهد.')
console.log('اگر مرحلهٔ ۳ چند ثانیه باشد، خودِ بارگذاری است و بازخوانیِ افزایشی جوابش است.')
process.exit(0)
