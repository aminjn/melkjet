import { Pool, type PoolClient } from 'pg'

// ── لایهٔ PostgreSQL (پایهٔ مهاجرت از فایل‌های JSON) ──────────────────────────
// فعال‌سازی: با ستِ کردنِ DATABASE_URL. اگر ست نباشد، همه‌چیز مثلِ قبل روی فایل می‌ماند
// (کلید امنیت: هیچ استوری بدونِ DATABASE_URL رفتار خود را عوض نمی‌کند).
//
// مدلِ اولیه: جدولِ kv(key, data jsonb) — همان «سندِ» هر استور، ولی با نوشتنِ اتمیک و
// قفلِ ردیف (FOR UPDATE) که جلوی گم‌شدنِ نوشتنِ همزمان (چند کاربر/چند اینستنس) را می‌گیرد —
// مشکلی که فایل‌ها ذاتاً داشتند. بعداً استورهای داغ به جدول‌های نرمالِ واقعی می‌روند.

export function pgEnabled(): boolean { return !!process.env.DATABASE_URL }

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8_000 })
    pool.on('error', () => { /* خطای idle client، pool خودش بازیابی می‌کند */ })
  }
  return pool
}

let schemaReady = false
async function ensureSchema(client: PoolClient) {
  if (schemaReady) return
  await client.query(`CREATE TABLE IF NOT EXISTS kv (
    key text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  schemaReady = true
}

/** خواندنِ سندِ یک استور. اگر نبود، fallback. */
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const client = await getPool().connect()
  try {
    await ensureSchema(client)
    const r = await client.query('SELECT data FROM kv WHERE key = $1', [key])
    return r.rows.length ? (r.rows[0].data as T) : fallback
  } finally { client.release() }
}

/** نوشتنِ سندِ کامل (upsert). */
export async function kvSet(key: string, data: unknown): Promise<void> {
  const client = await getPool().connect()
  try {
    await ensureSchema(client)
    await client.query(
      'INSERT INTO kv(key, data) VALUES($1, $2) ON CONFLICT(key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
      [key, JSON.stringify(data)],
    )
  } finally { client.release() }
}

/**
 * خواندن-تغییر-نوشتنِ اتمیک با قفلِ ردیف. fn سند را «در جا» تغییر می‌دهد و مقدارِ دلخواه برمی‌گرداند.
 * دو نوشتنِ همزمان روی همان کلید سریالایز می‌شوند → هیچ به‌روزرسانی‌ای گم نمی‌شود (برخلافِ فایل).
 */
export async function kvMutate<T, R>(key: string, fallback: T, fn: (data: T) => R): Promise<R> {
  const client = await getPool().connect()
  try {
    await ensureSchema(client)
    await client.query('BEGIN')
    const r = await client.query('SELECT data FROM kv WHERE key = $1 FOR UPDATE', [key])
    const data: T = r.rows.length ? (r.rows[0].data as T) : fallback
    const result = fn(data)
    await client.query(
      'INSERT INTO kv(key, data) VALUES($1, $2) ON CONFLICT(key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
      [key, JSON.stringify(data)],
    )
    await client.query('COMMIT')
    return result
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally { client.release() }
}
