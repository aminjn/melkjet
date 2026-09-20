#!/usr/bin/env node
// تستِ بازخوانیِ افزایشیِ scraper-store روی PostgreSQLِ واقعی.
//
// اجرا:  DATABASE_URL=postgres://user@host:port/db \
//        node --import ./scripts/reos-loader.mjs scripts/scraper-delta-test.mjs
//
// هشدار: روی دیتابیسِ تمیز اجرا کن (درج و حذف می‌کند) — هرگز روی پرود.
// نوشتنِ «اینستنسِ دیگر» با SQL خام شبیه‌سازی می‌شود — همان حالتی که اهمیت دارد،
// چون نویسندهٔ خودی کشش را null می‌کند و مسیرِ دلتا را نمی‌آزماید.
import pg from 'pg'
const URL = process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:55432/mjtest'
process.env.DATABASE_URL = URL
const pool = new pg.Pool({ connectionString: URL })

const S = await import('../app/lib/scraper-store.ts')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m) } else { fail++; console.log('  ✗    ' + m) } }

// لاگِ دلتا را می‌گیریم تا بدانیم مسیرِ افزایشی واقعاً اجرا شد یا بازخوانیِ کامل
let logs = []
const realLog = console.log
console.log = (...a) => { const s = a.join(' '); if (s.includes('[scraper-store]')) logs.push(s); else realLog(...a) }
const sawDelta = () => { const had = logs.some(l => l.includes('delta')); logs = []; return had }

const src = await S.addSource({ name: 'تست', type: 'listing', url: 'https://x/', selector: '', category: '' })
// آگهی‌ها باید واقعاً متمایز باشند، وگرنه گیتِ تشخیصِ تکراری همه را یکی می‌کند
// (بارِ اول همین شد: ۱۲ درج → ۱ ردیف).
const HOODS = ['پونک', 'هروی', 'میرداماد', 'اقدسیه', 'سعادت‌آباد', 'جنت‌آباد', 'شمس‌آباد', 'الهیه', 'نیاوران', 'تجریش', 'ونک', 'گیشا']
await S.insertItems(src, HOODS.map((h, i) => ({
  title: 'آپارتمان ' + (60 + i * 17) + ' متری در ' + h,
  price: String((3 + i) * 1_000_000_000) + ' تومان',
  location: 'تهران، ' + h,
  url: 'https://x/' + i,
  excerpt: 'توضیحِ یکتای شماره ' + i + ' با متنِ متفاوت برای پرهیز از همتایابی',
  meta: { 'متراژ': String(60 + i * 17), 'محله': h, 'شهر': 'تهران' },
})))
let items = await S.listItems('listing')
ok(items.length === 12, 'درج ۱۲ آگهی و خواندنشان (' + items.length + ')')

const victim = items[0].id
const bumpRev = async (ids, del) => {
  const r = await pool.query("SELECT data FROM kv WHERE key='scraper_meta'")
  const m = r.rows[0].data
  const rev = (m.__rev || 0) + 1
  const log = Array.isArray(m.__log) ? m.__log : []
  log.push({ rev, ids, del })
  await pool.query("UPDATE kv SET data=$1 WHERE key='scraper_meta'", [JSON.stringify({ ...m, __rev: rev, __log: log })])
  return rev
}

// ۱) به‌روزرسانیِ یک ردیف توسط «اینستنسِ دیگر»
await pool.query("UPDATE listings SET data = jsonb_set(data, '{title}', '\"عنوانِ عوض‌شده\"') WHERE id=$1", [victim])
await bumpRev([victim], [])
items = await S.listItems('listing', { fresh: true })
ok(sawDelta(), 'مسیرِ افزایشی اجرا شد (نه بازخوانیِ کامل)')
ok(items.find(i => i.id === victim)?.title === 'عنوانِ عوض‌شده', 'تغییرِ ردیف دیده شد')
ok(items.length === 12, 'تعداد دست‌نخورده ماند (' + items.length + ')')

// ۲) حذفِ یک ردیف توسط اینستنسِ دیگر
const dead = items[3].id
await pool.query('DELETE FROM listings WHERE id=$1', [dead])
await bumpRev([], [dead])
items = await S.listItems('listing', { fresh: true })
ok(sawDelta(), 'حذف هم از مسیرِ افزایشی آمد')
ok(!items.some(i => i.id === dead), 'ردیفِ حذف‌شده از کش رفت')
ok(items.length === 11, 'تعداد ۱۱ شد (' + items.length + ')')

// ۳) تغییرِ فقط-متادیتا: rev بالا می‌رود ولی هیچ ردیفی خوانده نمی‌شود
await bumpRev([], [])
items = await S.listItems('listing', { fresh: true })
ok(!sawDelta(), 'برای تغییرِ فقط-متادیتا هیچ ردیفی واکشی نشد')
ok(items.length === 11, 'آگهی‌ها دست‌نخورده (' + items.length + ')')

// ۴) revِ ثبت‌نشده در لاگ → باید به بازخوانیِ کامل برگردد (ایمنی)
const r0 = await pool.query("SELECT data FROM kv WHERE key='scraper_meta'")
const m0 = r0.rows[0].data
await pool.query("UPDATE listings SET data = jsonb_set(data, '{title}', '\"بی‌لاگ\"') WHERE id=$1", [items[5].id])
await pool.query("UPDATE kv SET data=$1 WHERE key='scraper_meta'", [JSON.stringify({ ...m0, __rev: (m0.__rev || 0) + 1 })])
const target = items[5].id
items = await S.listItems('listing', { fresh: true })
ok(!sawDelta(), 'revِ بدونِ لاگ → دلتا رد شد')
ok(items.find(i => i.id === target)?.title === 'بی‌لاگ', 'بازخوانیِ کامل تغییر را آورد')

// ۵) نویسندهٔ خودی هم درست کار می‌کند (mutateSome)
await S.setItemStatus(target, 'approved')
items = await S.listItems('listing', { fresh: true })
ok(items.find(i => i.id === target)?.status === 'approved', 'setItemStatus از مسیرِ mutateSome نوشت')

// ۶) لاگ در دیتابیس مرزدار است
const rl = await pool.query("SELECT jsonb_array_length(data->'__log') AS n FROM kv WHERE key='scraper_meta'")
ok(Number(rl.rows[0].n) > 0 && Number(rl.rows[0].n) <= 120, 'طولِ لاگ در مرز است (' + rl.rows[0].n + ')')

console.log = realLog
console.log('\n' + pass + ' پاس · ' + fail + ' شکست')
await pool.end()
process.exit(fail ? 1 : 0)
