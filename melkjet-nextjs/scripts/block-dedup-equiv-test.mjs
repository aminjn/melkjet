#!/usr/bin/env node
// SCALE-2M مرحلهٔ B — تستِ هم‌ارزیِ dedupِ بلوکی با اسکنِ کامل.
// برای مجموعه‌ای از probeها، _findTwinFull (اسکنِ کلِ جدول) و _findTwinBlocked (کاندیدا از
// block_keys) باید «دقیقاً» یک نتیجه بدهند. اثباتِ by-construction در scraper-store هست؛ این
// تست همان را تجربی روی پستگرسِ واقعی تأیید می‌کند.
//
// اجرا (با یک پستگرسِ تستِ بالا):
//   DATABASE_URL=postgres://reos:reos@127.0.0.1:5433/reos_test \
//     node --import ./scripts/reos-loader.mjs scripts/block-dedup-equiv-test.mjs
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
const store = await import('../app/lib/scraper-store.ts')
const { insertItems, _findTwinFull, _findTwinBlocked, candidatesByBlocks } = store

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m) } else { fail++; console.log('  ✗ FAIL ' + m) } }

// جدول را تمیز کن تا تست قطعی باشد.
await pgTx(c => c.query('TRUNCATE listings'))
await pgTx(c => c.query(`DELETE FROM kv WHERE key IN ('scraper_meta')`))

const src = { id: 'equivsrc', name: 'تستِ هم‌ارزی', url: 'http://t', type: 'listing', method: 'divar', enabled: true, schedule: 'manual', lastRun: null, lastCount: 0, status: 'idle' }

// پیکرهٔ آگهی‌های «متمایز» (در بلوک‌های مختلف تا هیچ‌کدام سرِ درج هم‌ملکِ هم نشوند).
const corpus = [
  { title: 'آپارتمان ۱۲۰ متری ونک نوساز', price: '10000000000', location: 'تهران، ونک', url: 'u1' },
  { title: 'آپارتمان ۸۰ متری تجریش', price: '7000000000', location: 'تهران، تجریش', url: 'u2' },
  { title: 'ویلا ۳۰۰ متری نیاوران', price: '50000000000', location: 'تهران، نیاوران', url: 'u3' },
  { title: 'مغازه ۴۰ متری سعادت‌آباد', price: '20000000000', location: 'تهران، سعادت‌آباد', url: 'u4' },
  { title: 'آپارتمان ۱۲۵ متری الهیه', price: '30000000000', location: 'تهران، الهیه', url: 'u5' },
  { title: 'آپارتمان ۶۰ متری پیروزی', price: '3000000000', location: 'تهران، پیروزی', url: 'u6' },
]
const ins = await insertItems(src, corpus)
ok(ins.added === corpus.length, `پیکره درج شد (${ins.added}/${corpus.length})`)

// probeها: برخی باید هم‌ملک پیدا کنند، برخی نه، در بلوک‌های مختلف + حالتِ fallback.
const probes = [
  { label: 'match ونک ۱۲۰', p: { title: 'فروش آپارتمان ۱۲۰ متر ونک', price: '10000000000', location: 'تهران، ونک' } },
  { label: 'match تجریش ۸۰', p: { title: 'آپارتمان ۸۰ متر تجریش فول', price: '7000000000', location: 'تهران، تجریش' } },
  { label: 'ونک ولی ۵۰۰متر (بلوکِ متراژِ متفاوت)', p: { title: 'آپارتمان ۵۰۰ متر ونک', price: '10000000000', location: 'تهران، ونک' } },
  { label: 'محلهٔ بی‌آگهی (جنت‌آباد)', p: { title: 'آپارتمان ۱۰۰ متر جنت‌آباد', price: '5000000000', location: 'تهران، جنت‌آباد' } },
  { label: 'رهن/اجاره در ونک (معاملهٔ متفاوت)', p: { title: 'رهن و اجاره آپارتمان ۱۲۰ متر ونک', price: 'ودیعه ۵۰۰ میلیون اجاره ۲۰ میلیون', location: 'تهران، ونک' } },
  { label: 'بدونِ محله/متراژ (بلوکِ fallback)', p: { title: 'ملک فروشی', price: '10000000000', location: 'تهران' } },
  { label: 'الهیه ۱۲۵ دقیق', p: { title: 'آپارتمان ۱۲۵ متری الهیه', price: '30000000000', location: 'تهران، الهیه' } },
]

let matched = 0
for (const { label, p } of probes) {
  const full = await _findTwinFull(p)
  const blocked = await _findTwinBlocked(p)
  const fId = full ? full.id : null
  const bId = blocked ? blocked.id : null
  ok(fId === bId, `هم‌ارزی «${label}»: full=${fId || 'null'}  blocked=${bId || 'null'}`)
  if (fId) matched++
}
ok(matched > 0, `دستِ‌کم چند probe واقعاً هم‌ملک پیدا کردند (${matched}) — تست توخالی نیست`)

// candidatesByBlocks هرگز نباید بیش از آیتم‌های هم‌بلوک برگرداند (کرانِ بالا = کلِ پیکره).
const allKeys = (await pgTx(c => c.query('SELECT DISTINCT unnest(block_keys) k FROM listings'))).rows.map(r => r.k)
const allCand = await candidatesByBlocks(allKeys)
ok(allCand.length === corpus.length, `candidatesByBlocks با همهٔ کلیدها = کلِ پیکره (${allCand.length}/${corpus.length})`)
const oneCand = await candidatesByBlocks(['sale|h:ونک'])
ok(oneCand.length >= 1 && oneCand.every(i => (i.location || '').includes('ونک')), `candidatesByBlocks('sale|h:ونک') فقط ونک (${oneCand.length})`)

console.log(`\n${pass} پاس · ${fail} شکست`)
process.exit(fail ? 1 : 0)
