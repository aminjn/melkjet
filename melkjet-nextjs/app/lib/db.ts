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
    // max: هر instance تا ۱۵ connection (۴ instance × ۱۵ = ۶۰ < سقفِ پیش‌فرضِ ۱۰۰ پستگرس).
    // statement_timeout: یک کوئریِ کندِ سرکش نباید connection را تا ابد بگیرد (۱۵ث سقف).
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 15, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8_000, statement_timeout: 15_000 })
    pool.on('error', () => { /* خطای idle client، pool خودش بازیابی می‌کند */ })
  }
  return pool
}

// schemaOnce — پیش از این یک بولین بود که *در انتهای* تابع ست می‌شد. نتیجه: هنگام بالا
// آمدنِ هر پروسه، هر ۱۵ اتصالِ استخر هم‌زمان واردِ این تابع می‌شدند و ۱۵ بار CREATE TABLE و
// CREATE INDEX می‌زدند؛ CREATE INDEX قفلِ سنگین می‌گیرد، پس همه پشتِ هم صف می‌بستند و
// درخواست‌های عادی هم پشتِ آن صف می‌ماندند. ضربدر چهار اینستنس، در هر ری‌استارت.
// حالا Promise نگه داشته می‌شود: اولی DDL را می‌زند، بقیه فقط منتظرِ همان می‌مانند.
// در صورت خطا ریست می‌شود تا تلاشِ بعدی دوباره امتحان کند (قفلِ دائمیِ شکست نداشته باشیم).
let schemaOnce: Promise<void> | null = null
async function ensureSchema(client: PoolClient) {
  if (schemaOnce) return schemaOnce
  schemaOnce = ensureSchemaOnce(client).catch(e => { schemaOnce = null; throw e })
  return schemaOnce
}
async function ensureSchemaOnce(client: PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS kv (
    key text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  // جدولِ نرمالِ آگهی‌ها (رفعِ دائمیِ گلوگاهِ تک‌بلاب): هر آگهی یک ردیفِ مستقل + ایندکس،
  // تا خواندن هدفمند و نوشتن تک‌ردیفی باشد (نه بازنویسیِ کلِ بلاب زیرِ قفلِ سراسری).
  await client.query(`CREATE TABLE IF NOT EXISTS listings (
    id text PRIMARY KEY,
    scraped_at bigint NOT NULL DEFAULT 0,
    type text,
    status text,
    data jsonb NOT NULL
  )`)
  await client.query(`CREATE INDEX IF NOT EXISTS listings_scraped ON listings(scraped_at DESC)`)
  await client.query(`CREATE INDEX IF NOT EXISTS listings_type ON listings(type)`)
  // Enrichment deltas, one row per listing.
  //
  // The baseline stays in .enrich-data.json, which enrich-store reads synchronously
  // at boot so its read API can stay synchronous on a hot path. These rows carry
  // only the changes since that snapshot: writes became one small upsert instead of
  // restringifying and fsyncing the whole ~52MB document per field (21,555 keys),
  // and updated_at lets each pm2 instance pull the other instances' results
  // incrementally instead of re-parsing 52MB whenever the file mtime moved.
  await client.query(`CREATE TABLE IF NOT EXISTS enrich (
    id text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  await client.query(`CREATE INDEX IF NOT EXISTS enrich_updated ON enrich(updated_at)`)
  // ستونِ محاسباتیِ محلِ نرمال‌شده + ایندکسِ trigram: فیلترِ محله باید داخلِ دیتابیس اجرا شود،
  // نه با کشیدنِ چند صد آگهیِ «تازه» به حافظه و فیلترِ درجا. GENERATED یعنی پستگرس خودش
  // هنگام درج پرش می‌کند، پس هیچ‌کدام از مسیرهای درج تغییر نمی‌خواهد و از هم‌گامی خارج نمی‌شود.
  // در محیطی که extension نیاز به superuser دارد و در دسترس نیست، خطا بلعیده می‌شود و
  // listingsByLoc خالی برمی‌گرداند؛ یعنی رفتار به مسیرِ قبلی برمی‌گردد نه به خطا.
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
    await client.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS loc_norm text GENERATED ALWAYS AS (translate(coalesce(data->>'location',''), chr(1610)||chr(1603)||chr(8204)||chr(8207)||chr(8206)||' ', chr(1740)||chr(1705))) STORED`)
    await client.query(`CREATE INDEX IF NOT EXISTS listings_loc_norm_trgm ON listings USING gin (loc_norm gin_trgm_ops)`)
  } catch { /* بدونِ دسترسیِ لازم: مسیرِ قدیمی کار می‌کند */ }
}

/** اجرای یک تابع داخلِ یک تراکنش (BEGIN/COMMIT با rollback خودکار). client خام برای کوئری‌های دلخواه. */
export async function pgTx<R>(fn: (client: PoolClient) => Promise<R>): Promise<R> {
  const client = await getPool().connect()
  try {
    await ensureSchema(client)
    await client.query('BEGIN')
    const r = await fn(client)
    await client.query('COMMIT')
    return r
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally { client.release() }
}

/** خواندنِ همهٔ ردیف‌های listings (فقط ستونِ data). خارج از تراکنش، سبک. */
export async function pgListingsAll(): Promise<unknown[]> {
  const client = await getPool().connect()
  try {
    await ensureSchema(client)
    const r = await client.query('SELECT data FROM listings ORDER BY scraped_at DESC')
    return r.rows.map(x => x.data)
  } finally { client.release() }
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
 * آمارِ سلامتِ PostgreSQL برای پنلِ «سلامتِ سیستم» — آیا وصل است، چند کلید در kv،
 * حجمِ کلِ دیتابیس، و بزرگ‌ترین کلیدها. اگر DATABASE_URL ست نباشد null برمی‌گردد.
 */
export async function pgStats(): Promise<
  { enabled: true; connected: boolean; kvRows: number; dbSizeMB: number; topKeys: { key: string; kb: number }[] } | { enabled: false } | null
> {
  if (!pgEnabled()) return { enabled: false }
  try {
    const client = await getPool().connect()
    try {
      await ensureSchema(client)
      const rows = await client.query('SELECT count(*)::int AS n FROM kv')
      const size = await client.query('SELECT pg_database_size(current_database())::bigint AS s')
      const top = await client.query(
        `SELECT key, (pg_column_size(data) / 1024.0)::numeric(10,1) AS kb FROM kv ORDER BY pg_column_size(data) DESC LIMIT 8`,
      )
      return {
        enabled: true, connected: true,
        kvRows: rows.rows[0].n,
        dbSizeMB: Math.round((Number(size.rows[0].s) / 1048576) * 10) / 10,
        topKeys: top.rows.map(r => ({ key: r.key as string, kb: Number(r.kb) })),
      }
    } finally { client.release() }
  } catch {
    return { enabled: true, connected: false, kvRows: 0, dbSizeMB: 0, topKeys: [] }
  }
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
    // ۲۸ سپتامبر — انتظار پشتِ FOR UPDATE «کوئریِ سرکش» نیست؛ صف‌بستن برای نوبت است
    // (pg_stat_activity: چند اتصال Lock-wait پشتِ یک تراکنشِ idle-in-transaction). سقفِ
    // سراسریِ ۱۵ث آن انتظار را می‌کُشت و کلِ کار از نو شروع می‌شد → توفانِ retry و بارِ
    // بیشتر. داخلِ همین تراکنش سقف ۴۵ث است؛ SET LOCAL با COMMIT/ROLLBACK خودش برمی‌گردد
    // و سقفِ ۱۵ثِ بقیهٔ کوئری‌ها (خواندن‌ها/API) دست‌نخورده می‌ماند.
    await client.query(`SET LOCAL statement_timeout = '45s'`)
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

/** خواندنِ همهٔ کلیدهایی که با prefix شروع می‌شوند (اسکنِ رِنجِ روی PKِ key — سبک).
 *  برای استورهای «شاردشده به ازای هر مالک» (مثلِ advisor:{owner}) تا list-all با یک کوئری بیاید. */
export async function kvGetPrefix<T>(prefix: string): Promise<{ key: string; data: T }[]> {
  const client = await getPool().connect()
  try {
    await ensureSchema(client)
    const like = prefix.replace(/([%_\\])/g, '\\$1') + '%'
    const r = await client.query(`SELECT key, data FROM kv WHERE key LIKE $1 ESCAPE '\\'`, [like])
    return r.rows.map(x => ({ key: x.key as string, data: x.data as T }))
  } finally { client.release() }
}

/** حذفِ یک کلید از kv. */
export async function kvDelete(key: string): Promise<void> {
  const client = await getPool().connect()
  try {
    await ensureSchema(client)
    await client.query('DELETE FROM kv WHERE key = $1', [key])
  } finally { client.release() }
}
