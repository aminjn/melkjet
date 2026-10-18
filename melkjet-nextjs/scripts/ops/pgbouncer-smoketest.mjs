#!/usr/bin/env node
// اسموک‌تستِ pgbouncer — «دقیقاً مثلِ خودِ اپ» وصل می‌شود (همان pg Pool + statement_timeout +
// تراکنش + SET LOCAL) تا پیش از سوییچِ DATABASE_URLِ سایت مطمئن شویم اپ از مسیرِ pgbouncer
// سالم کار می‌کند. آرگومان: connectionString (معمولاً روی پورتِ 6432).
//   node scripts/ops/pgbouncer-smoketest.mjs "postgres://user:pass@127.0.0.1:6432/db"
import pg from 'pg'
const { Pool } = pg

const url = process.argv[2]
if (!url) { console.error('استفاده: pgbouncer-smoketest.mjs <connectionString>'); process.exit(2) }

// عینِ تنظیماتِ getPool() در app/lib/db.ts (statement_timeout روی استارت‌آپ — نقطهٔ حساسِ سازگاری)
const pool = new Pool({ connectionString: url, max: 3, connectionTimeoutMillis: 8000, statement_timeout: 15000 })

let ok = true
try {
  // ۱) کوئریِ ساده (مسیرِ خواندنِ معمول)
  const r = await pool.query('SELECT 1 AS ok')
  console.log('  ✓ کوئریِ ساده:', r.rows[0].ok === 1 ? 'OK' : 'ناموفق')

  // ۲) تراکنش + SET LOCAL + FOR UPDATE — عینِ pgTx/mutateSome که زیرِ transaction-pooling باید کار کند
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    await c.query("SET LOCAL statement_timeout = '5s'")
    await c.query('SELECT 1')
    await c.query('COMMIT')
    console.log('  ✓ تراکنش + SET LOCAL: OK')
  } catch (e) { ok = false; console.error('  ✗ تراکنش شکست:', String(e?.message || e)) ; try { await c.query('ROLLBACK') } catch {} }
  finally { c.release() }

  // ۳) چند کوئریِ هم‌زمان (شبیه‌سازیِ بارِ موازیِ اینستنس‌ها روی استخرِ pgbouncer)
  await Promise.all(Array.from({ length: 10 }, () => pool.query('SELECT pg_sleep(0.05)')))
  console.log('  ✓ ۱۰ کوئریِ هم‌زمان: OK')

  // ۴) آیا واقعاً از pgbouncer رد می‌شویم؟ (پورت)
  const p = await pool.query('SELECT inet_server_port() AS port, current_user AS usr, current_database() AS db')
  console.log(`  ℹ کاربر=${p.rows[0].usr} دیتابیس=${p.rows[0].db} پورتِ واقعیِ PG=${p.rows[0].port}`)
} catch (e) {
  ok = false
  console.error('  ✗ اتصال/کوئری شکست:', String(e?.message || e))
} finally {
  await pool.end().catch(() => {})
}

if (ok) { console.log('\n✅ اسموک‌تست سبز — اپ از مسیرِ pgbouncer سالم کار می‌کند. حالا می‌توانی DATABASE_URL را سوییچ کنی.') ; process.exit(0) }
else { console.error('\n❌ اسموک‌تست قرمز — DATABASE_URL را سوییچ نکن. خطا را بالا ببین.') ; process.exit(1) }
