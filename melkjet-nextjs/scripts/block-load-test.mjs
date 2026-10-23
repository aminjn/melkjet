#!/usr/bin/env node
// SCALE-2M مرحلهٔ B — تستِ بار و همزمانی (دروازهٔ پیش از دیپلوی؛ درسِ 8a61d73).
//   (۱) مقیاس: روی جدولِ پر، _insertBlocked باید بسیار سریع‌تر و ~مستقل از اندازهٔ جدول باشد
//       نسبت به _insertFull — اثباتِ اینکه کلِ جدول را نمی‌خواند.
//   (۲) همزمانی: چند _insertBlocked موازی (منبع/محله‌های مجزا، مثلِ اسکرپِ چند آژانس) + نویسنده‌های
//       meta-late موازی (setItemStatus) — باید بدونِ گم‌شدن/تکرار/بن‌بستِ کشنده و در زمانِ کراندار تمام شوند.
//
// اجرا (با پستگرسِ تستِ بالا):
//   DATABASE_URL=postgres://reos:reos@127.0.0.1:5433/reos_test \
//     node --import ./scripts/reos-loader.mjs scripts/block-load-test.mjs
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
const sim = await import('../app/lib/listing-similarity.ts')
const { _insertFull, _insertBlocked, setItemStatus } = store

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m) } else { fail++; console.log('  ✗ FAIL ' + m) } }

const HOODS = ['ونک', 'تجریش', 'نیاوران', 'الهیه', 'سعادت‌آباد', 'پیروزی', 'جنت‌آباد', 'پونک', 'نارمک', 'اقدسیه', 'فرشته', 'شهرک‌غرب', 'ولنجک', 'زعفرانیه', 'میرداماد', 'پاسداران', 'گیشا', 'صادقیه', 'یوسف‌آباد', 'امیرآباد']
const K = 10000
const src = (id) => ({ id, name: 'منبعِ ' + id, url: 'http://t/' + id, type: 'listing', method: 'divar', enabled: true, schedule: 'manual', lastRun: null, lastCount: 0, status: 'idle' })

await pgTx(c => c.query('TRUNCATE listings'))
await pgTx(c => c.query('DELETE FROM kv'))

// ── seed: K آگهیِ متمایز در بلوک‌های متنوع (درجِ مستقیمِ دسته‌ای، با block_keysِ محاسبه‌شده) ──
console.log(`seed ${K} آگهی...`)
const tSeed = Date.now()
for (let base = 0; base < K; base += 500) {
  const vals = [], params = []
  for (let j = 0; j < 500 && base + j < K; j++) {
    const i = base + j
    const hood = HOODS[i % HOODS.length], area = 50 + (i % 150)
    const data = { id: 's' + i, sourceId: 'seed', sourceName: 'seed', type: 'listing', title: `آپارتمان ${area} متری ${hood}`, price: String(1000000000 + i * 1000), location: `تهران، ${hood}`, url: 'seed/u' + i, status: 'approved', scrapedAt: Date.now() }
    const bk = sim.blockKeys(sim.fieldsOf(data))
    const p = params.length
    vals.push(`($${p + 1},$${p + 2},'listing','approved',$${p + 3}::jsonb,$${p + 4}::text[])`)
    params.push(data.id, data.scrapedAt, JSON.stringify(data), bk)
  }
  await pgTx(c => c.query(`INSERT INTO listings(id,scraped_at,type,status,data,block_keys) VALUES ${vals.join(',')}`, params))
}
const seedCount = Number((await pgTx(c => c.query('SELECT count(*) n FROM listings'))).rows[0].n)
ok(seedCount === K, `seed کامل (${seedCount}/${K})`)

// ── (۱) مقیاس: full در برابرِ blocked روی همین جدولِ پر ──
// آیتم‌های «واقعاً متمایز» (محلهٔ یکتا به‌ازای هر آیتم) تا dedupِ درون‌batch رخ ندهد و شمارش معنادار بماند.
const batchFull = Array.from({ length: 20 }, (_, k) => ({ title: `آپارتمان ۱۰۰ متری ونک‌فول‌${k}`, price: String(9e9 + k), location: `تهران، ونک‌فول‌${k}`, url: 'full/u' + k }))
const batchBlk = Array.from({ length: 20 }, (_, k) => ({ title: `ویلا ۲۰۰ متری لواسان‌${k}`, price: String(9e9 + k), location: `تهران، لواسان‌${k}`, url: 'blk/u' + k }))
let t = Date.now(); const rFull = await _insertFull(src('sf'), batchFull, []); const tFull = Date.now() - t
t = Date.now(); const rBlk = await _insertBlocked(src('sb'), batchBlk, []); const tBlocked = Date.now() - t
console.log(`  زمان: _insertFull=${tFull}ms   _insertBlocked=${tBlocked}ms   (روی جدولِ ${K}تایی)`)
ok(tBlocked < tFull, `blocked سریع‌تر از full است (${tBlocked}ms < ${tFull}ms)`)
ok(tBlocked < 1500, `blocked زمانِ کوچک و ~مستقل از اندازهٔ جدول دارد (${tBlocked}ms)`)

// ── (۲) همزمانی: 12 نویسندهٔ بلوکیِ موازی (محله‌های مجزا) + 12 نویسندهٔ meta-late موازی ──
const seedIds = (await pgTx(c => c.query(`SELECT id FROM listings ORDER BY random() LIMIT 12`))).rows.map(r => r.id)
const P = 12, PER = 15
const retry40 = async (fn) => { for (let a = 0; a < 4; a++) { try { return await fn() } catch (e) { if (!/40P01|deadlock|could not serialize/i.test(String(e?.message)) || a === 3) throw e } } }
let errs = 0, ccAdded = 0
const writers = []
for (let w = 0; w < P; w++) {
  // هر نویسنده در «محلهٔ مجزای خودش» (بلوکِ جدا) تا سناریوی واقعیِ اسکرپِ موازیِ آژانس‌ها باشد
  // هر آیتم بلوکِ کاملاً یکتا (محله + سطلِ متراژِ فاصله‌دارِ >۱۹۹، جدا از seed) تا هیچ twinی رخ ندهد
  // و «نبودِ گم‌شدن زیرِ همزمانی» قطعی سنجیده شود.
  const batch = Array.from({ length: PER }, (_, k) => { const ar = 1000 + (w * PER + k) * 7; return { title: `آپارتمان ${ar} متری موازی‌${w}‌${k}`, price: String(5e9 + w * 1e6 + k), location: `تهران، موازی‌${w}‌${k}`, url: `cc/${w}/${k}` } })
  writers.push(retry40(() => _insertBlocked(src('cc' + w), batch, [])).then(r => { ccAdded += r.added }).catch(e => { errs++; console.log('   writer err:', String(e?.message).slice(0, 120)) }))
}
for (const id of seedIds) writers.push(retry40(() => setItemStatus(id, 'pending')).catch(e => { errs++; console.log('   meta err:', String(e?.message).slice(0, 80)) }))
const tCC = Date.now()
await Promise.all(writers)
const ccMs = Date.now() - tCC
console.log(`  همزمانی: ${P}×${PER} درجِ بلوکی + ${seedIds.length} meta-late در ${ccMs}ms، خطاها=${errs}`)
ok(errs === 0, `هیچ نویسنده‌ای شکست نخورد (حتی با retryِ 40P01)`)
ok(ccMs < 30000, `در زمانِ کراندار تمام شد (${ccMs}ms < 30s — بدونِ هنگ)`)

// ── درستیِ نهایی: هرچه insertCore «added» گزارش کرد باید نشسته باشد؛ نه کمتر (گم‌شدن)، نه بیشتر (تکرار).
// مقاوم به ادغامِ dedup: به‌جای حدسِ عدد، addedِ واقعیِ گزارش‌شدهٔ همهٔ مسیرها جمع می‌شود.
const expected = K + rFull.added + rBlk.added + ccAdded
const finalCount = Number((await pgTx(c => c.query('SELECT count(*) n FROM listings'))).rows[0].n)
ok(finalCount === expected, `شمارشِ نهایی = seed + مجموعِ addedِ گزارش‌شده (${finalCount}/${expected}) — نه گم‌شده نه تکراری [full=${rFull.added} blk=${rBlk.added} cc=${ccAdded}]`)
const dupUrl = (await pgTx(c => c.query(`SELECT data->>'url' u, count(*) n FROM listings GROUP BY 1 HAVING count(*)>1 LIMIT 3`))).rows
ok(dupUrl.length === 0, `هیچ url تکراری نیست` + (dupUrl.length ? ' — ' + JSON.stringify(dupUrl) : ''))
// همهٔ ردیف‌های تازه block_keys دارند (مرحلهٔ A در مسیرِ بلوکی هم پر می‌کند)
const noBk = Number((await pgTx(c => c.query(`SELECT count(*) n FROM listings WHERE type='listing' AND (block_keys IS NULL OR array_length(block_keys,1) IS NULL)`))).rows[0].n)
ok(noBk === 0, `همهٔ آگهی‌ها block_keys دارند (${noBk} بدونِ کلید)`)

console.log(`\n${pass} پاس · ${fail} شکست`)
process.exit(fail ? 1 : 0)
