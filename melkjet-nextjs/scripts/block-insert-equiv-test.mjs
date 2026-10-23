#!/usr/bin/env node
// SCALE-2M مرحلهٔ B — تستِ هم‌ارزیِ insertItems (مسیرِ بلوکی در برابرِ mutateِ کامل).
// همان دنبالهٔ batchها را از _insertFull و _insertBlocked روی حالتِ تمیز اجرا می‌کند و
// «خروجیِ منطقی» را مقایسه می‌کند: شمارشِ هر batch ({added,dup,updated}) + وضعیتِ نهاییِ
// ردیف‌ها (url/title/status/price/location/dealStatus) و مالکان. اگر یکی نبود، شکست.
// شناسه‌ها تصادفی‌اند، پس بر اساسِ کلیدِ پایدار (url|title) مقایسه می‌شود، نه id.
//
// اجرا (با پستگرسِ تستِ بالا):
//   DATABASE_URL=postgres://reos:reos@127.0.0.1:5433/reos_test \
//     node --import ./scripts/reos-loader.mjs scripts/block-insert-equiv-test.mjs
import { readFileSync, existsSync } from 'node:fs'
function loadEnv(f) {
  if (!existsSync(f)) return
  for (const l of readFileSync(f, 'utf-8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue
    let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnv('.env.production.local'); loadEnv('.env')
const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
if (!pgEnabled()) { console.error('DATABASE_URL لازم است (پستگرسِ تست).'); process.exit(1) }
const { _insertFull, _insertBlocked } = await import('../app/lib/scraper-store.ts')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m) } else { fail++; console.log('  ✗ FAIL ' + m) } }

const src = { id: 'eqsrc', name: 'منبعِ تست', url: 'http://t', type: 'listing', method: 'divar', enabled: true, schedule: 'manual', lastRun: null, lastCount: 0, status: 'idle' }

// دنبالهٔ batchها: درجِ نو + مالکِ مشترک، سپس اسکرپِ مجددِ دقیق + هم‌ملک (twin) + نو + هم‌ملکِ درون‌batch.
const batches = [
  [
    { title: 'آپارتمان ۱۲۰ متری ونک', price: '10000000000', location: 'تهران، ونک', url: 'u1', phone: '09120000001', owner: 'آژانس الف' },
    { title: 'ویلا ۳۰۰ متری نیاوران', price: '50000000000', location: 'تهران، نیاوران', url: 'u2', phone: '09120000002', owner: 'آژانس ب' },
    { title: 'آپارتمان ۸۰ متری تجریش', price: '7000000000', location: 'تهران، تجریش', url: 'u3', phone: '09120000001', owner: 'آژانس الف' },
  ],
  [
    { title: 'آپارتمان ۱۲۰ متری ونک', price: '10000000000', location: 'تهران، ونک', url: 'u1', phone: '09120000001' }, // اسکرپِ مجددِ دقیق
    { title: 'آپارتمان ۱۲۰ متر ونک', price: '10000000000', location: 'تهران، ونک', url: 'u9' },                        // هم‌ملکِ u1
    { title: 'مغازه ۴۰ متری سعادت‌آباد', price: '20000000000', location: 'تهران، سعادت‌آباد', url: 'u4' },             // نو
    { title: 'مغازه ۴۰ متر سعادت آباد', price: '20000000000', location: 'تهران، سعادت‌آباد', url: 'u5' },              // هم‌ملکِ درون‌batch با u4
  ],
]

async function reset() {
  await pgTx(c => c.query('TRUNCATE listings'))
  await pgTx(c => c.query('DELETE FROM kv'))
}
async function snapshot() {
  const rows = (await pgTx(c => c.query(
    `SELECT data->>'url' url, data->>'title' title, status, data->>'price' price,
            data->>'location' loc, data->'meta'->>'__dealStatus' deal
     FROM listings ORDER BY data->>'title', data->>'url'`))).rows
  const ownersRaw = (await pgTx(c => c.query(`SELECT data->'owners' o FROM kv WHERE key='scraper_meta'`))).rows[0]?.o || []
  const owners = ownersRaw.map(o => ({ name: o.name, phone: o.phone || null, count: o.count }))
    .sort((a, b) => (a.name + a.phone).localeCompare(b.name + b.phone))
  return { rows, owners }
}
async function runSeq(insertFn) {
  await reset()
  const counts = []
  for (const b of batches) counts.push(await insertFn(src, b, []))
  return { counts, snap: await snapshot() }
}

const full = await runSeq(_insertFull)
const blocked = await runSeq(_insertBlocked)

ok(JSON.stringify(full.counts) === JSON.stringify(blocked.counts),
  'شمارشِ هر batch یکی است  full=' + JSON.stringify(full.counts) + '  blocked=' + JSON.stringify(blocked.counts))
ok(JSON.stringify(full.snap.rows) === JSON.stringify(blocked.snap.rows),
  'وضعیتِ نهاییِ ردیف‌ها یکی است (' + full.snap.rows.length + ' در برابرِ ' + blocked.snap.rows.length + ')')
ok(JSON.stringify(full.snap.owners) === JSON.stringify(blocked.snap.owners),
  'مالکان یکی‌اند: ' + JSON.stringify(blocked.snap.owners))

// تستِ توخالی نباشد: دستِ‌کم یک twin و یک exact واقعاً رخ داده (updated>0 در batch دوم).
ok((blocked.counts[1]?.updated || 0) >= 1, 'batch دوم حداقل یک به‌روزرسانی (twin/exact) داشت: updated=' + blocked.counts[1]?.updated)
ok(blocked.snap.rows.length === full.snap.rows.length && full.snap.rows.length >= 3, 'چند ردیفِ متمایز باقی ماند (' + full.snap.rows.length + ')')

if (fail) {
  console.log('\n--- full.rows ---'); console.log(JSON.stringify(full.snap.rows, null, 1))
  console.log('--- blocked.rows ---'); console.log(JSON.stringify(blocked.snap.rows, null, 1))
}
console.log(`\n${pass} پاس · ${fail} شکست`)
process.exit(fail ? 1 : 0)
