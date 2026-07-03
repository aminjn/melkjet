// مهاجرتِ دادهٔ فایل‌های JSON به PostgreSQL (جدولِ kv). یک‌بار قبل از فعال‌کردنِ DATABASE_URL اجرا شود.
// اجرا:  DATABASE_URL='postgresql://melkjet:PASS@127.0.0.1:5432/melkjet' node scripts/migrate-to-pg.mjs
// می‌توان یک یا چند کلید را هم داد تا فقط همان‌ها وارد شوند:  ... node scripts/migrate-to-pg.mjs messages account
import pg from 'pg'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const url = process.env.DATABASE_URL
if (!url) { console.error('✗ DATABASE_URL لازم است (مثلاً postgresql://melkjet:PASS@127.0.0.1:5432/melkjet)'); process.exit(1) }

const cwd = process.cwd()
const only = process.argv.slice(2)   // اگر داده شود، فقط این کلیدها
const pool = new pg.Pool({ connectionString: url })

await pool.query(`CREATE TABLE IF NOT EXISTS kv (
  key text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
)`)

// همهٔ فایل‌های .<name>-data.json → کلیدِ <name>
let files = readdirSync(cwd).filter(f => /^\..+-data\.json$/.test(f))
if (only.length) files = files.filter(f => only.includes(f.replace(/^\./, '').replace(/-data\.json$/, '')))

let n = 0, bytes = 0
for (const f of files) {
  const key = f.replace(/^\./, '').replace(/-data\.json$/, '')
  try {
    if (!existsSync(join(cwd, f))) continue
    const raw = readFileSync(join(cwd, f), 'utf8')
    const data = JSON.parse(raw)
    await pool.query(
      'INSERT INTO kv(key, data) VALUES($1, $2) ON CONFLICT(key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
      [key, JSON.stringify(data)],
    )
    console.log(`✓ ${f}  →  kv['${key}']  (${(raw.length / 1024).toFixed(1)} KB)`)
    n++; bytes += raw.length
  } catch (e) { console.error(`✗ ${f}: ${e.message}`) }
}

console.log(`\n${n} فایل / ${(bytes / 1024 / 1024).toFixed(2)} MB وارد شد.`)
await pool.end()
