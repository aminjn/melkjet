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
    // ۳۰ سپتامبر — اندازهٔ استخر بر اساسِ «نقش»: اینستنسِ ۰ همهٔ کارهای پس‌زمینه را می‌دواند
    // (سینکِ رُستر + صفِ حساب + t2t + غنی‌سازی + کرون) و با ۱۵ اتصال دو روز تمام همه‌چیز با
    // «timeout exceeded when trying to connect» می‌مرد — اتصال‌ها پشتِ قفل‌ها پارک بودند.
    // ۳۰ برای اینستنسِ ۰ + ۱۲×۳ سرویس‌ده = ۶۶ < سقفِ ۱۰۰ پستگرس.
    const isBgWorker = process.env.NODE_APP_INSTANCE === '0'
    const poolMax = isBgWorker ? 30 : 12
    // فاز ۲۹۸ی۱۶ — ریشهٔ «سینک‌ها ابدی در صف با timeout exceeded when trying to connect»:
    // connectionTimeoutMillis همان چیزی است که یک acquireِ در صفِ استخر را رد می‌کند. فاز ف۲ آن را
    // سراسری ۴s کرد تا «درخواستِ کاربر» سریع شکست بخورد (۵۰۲ به‌جای معطلی) — درست، ولی اینستنسِ ۰
    // کارگرِ پس‌زمینه است (nginx پورت ۳۰۰۰ را backup کرده؛ عملاً ترافیکِ کاربر نمی‌گیرد)، پس آن‌جا
    // ۴s یعنی یک کارِ پس‌زمینه که اتصالِ آزاد پیدا نمی‌کند، سینک را با «connect timeout» می‌سوزاند و
    // بعد از ۸ تلاش آژانس را روزها «گیرکرده» می‌گذارد. راهِ درست: اینستنسِ ۰ «صبور» باشد (تا ۳۰s در
    // صفِ استخر منتظرِ آزادشدنِ اتصال بماند — یک kvMutate سنگین تا ۴۵s اتصال نگه می‌دارد) و اینستنس‌های
    // سرویس‌ده همان ۴sِ سریع را نگه دارند تا هیچ درخواستِ کاربری پشتِ استخرِ پر معطل نماند (۵۰۲).
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: poolMax, idleTimeoutMillis: 30_000, connectionTimeoutMillis: isBgWorker ? 30_000 : 4_000, statement_timeout: 15_000 })
    pool.on('error', () => { /* خطای idle client، pool خودش بازیابی می‌کند */ })
  }
  return pool
}

// فاز ۲۹۷ف۲ — یک تلاشِ connect، سریع (۴s). acquire-retryِ سه‌باره‌ی فاز ظ درخواستِ کاربر را
// زیرِ فشار تا ~۲۷s معطل می‌کرد (۵۰۲). حالا تک‌تلاش: شکستِ سریع برای کاربر؛ خودِ سینک در سطحِ
// بالاتر (صف + سریال) مقاوم است و نیازی به retryِ سطحِ اتصال ندارد.
async function acquire(): Promise<PoolClient> {
  return getPool().connect()
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
// فاز ۳۴۶ی («کلاً هنگ می‌کند، حتی SSH») — pg_stat_activity زنده: `CREATE INDEX IF NOT EXISTS enrich_updated` پشتِ یک INSERT
// منتظر مانده بود و همهٔ INSERTهای بعدی پشتِ «خودِ» آن صف کشیده بودند (blocked_by زنجیره‌ای). «IF NOT EXISTS» قفل را «پیش از»
// بررسیِ وجود می‌گیرد: CREATE INDEX قفلِ SHARE (ضدِ نوشتن) و `ALTER TABLE … ADD COLUMN IF NOT EXISTS` قفلِ ACCESS EXCLUSIVE
// (ضدِ همه‌چیز، حتی خواندن) — و این‌ها در «هر» بوتِ «هر» پروسه (هر دیپلوی = ۴ بار، هر ری‌استارتِ حافظه یک بار) اجرا می‌شدند.
// پشتِ یک خواندنِ کاملِ ۴۰ثانیه‌ایِ listings، ALTERِ منتظر کلِ سایت را قفل می‌کرد. حالا اول فقط کاتالوگ خوانده می‌شود (بی‌قفل)
// و DDL فقط برای چیزی که واقعاً نیست اجرا می‌شود، با lock_timeoutِ کوتاه تا هرگز صف نسازد.
async function ensureSchemaOnce(client: PoolClient) {
  const col = (t: string, c: string) => `EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('${t}') AND attname = '${c}' AND NOT attisdropped)`
  const reg = (n: string) => `to_regclass('${n}') IS NOT NULL`
  const have = (await client.query(`SELECT
    ${reg('kv')} AS kv, ${reg('listings')} AS listings, ${reg('enrich')} AS enrich,
    ${reg('listings_scraped')} AS i_scraped, ${reg('listings_type')} AS i_type, ${reg('listings_block_keys')} AS i_bk,
    ${reg('listings_url')} AS i_url, ${reg('enrich_updated')} AS i_enrich, ${reg('listings_loc_norm_trgm')} AS i_trgm,
    ${col('listings', 'block_keys')} AS c_bk, ${col('listings', 'loc_norm')} AS c_loc`)).rows[0] as Record<string, boolean>
  if (Object.values(have).every(Boolean)) return   // مسیرِ عادیِ هر بوت: هیچ DDL، هیچ قفل
  // DDL در تراکنشِ کوتاه با lock_timeout: اگر قفل در ۱۰ثانیه نرسید، شکست می‌خورد به‌جای این‌که پشتش صف بسازد.
  const ddl = async (sql: string, optional = false) => {
    try {
      await client.query('BEGIN'); await client.query(`SET LOCAL lock_timeout = '10s'`)
      await client.query(sql); await client.query('COMMIT')
    } catch (e) {
      try { await client.query('ROLLBACK') } catch {}
      if (!optional) throw e
      console.error('[db] schema: DDLِ اختیاری انجام نشد (بوتِ بعد دوباره):', String((e as Error)?.message || e).slice(0, 160))
    }
  }
  if (!have.kv) await ddl(`CREATE TABLE IF NOT EXISTS kv (
    key text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  // جدولِ نرمالِ آگهی‌ها (رفعِ دائمیِ گلوگاهِ تک‌بلاب): هر آگهی یک ردیفِ مستقل + ایندکس،
  // تا خواندن هدفمند و نوشتن تک‌ردیفی باشد (نه بازنویسیِ کلِ بلاب زیرِ قفلِ سراسری).
  if (!have.listings) await ddl(`CREATE TABLE IF NOT EXISTS listings (
    id text PRIMARY KEY,
    scraped_at bigint NOT NULL DEFAULT 0,
    type text,
    status text,
    data jsonb NOT NULL
  )`)
  if (!have.i_scraped) await ddl(`CREATE INDEX IF NOT EXISTS listings_scraped ON listings(scraped_at DESC)`, true)
  if (!have.i_type) await ddl(`CREATE INDEX IF NOT EXISTS listings_type ON listings(type)`, true)
  // SCALE-2M مرحلهٔ A — کلیدهای بلوکه‌کردنِ dedup روی خودِ ردیف (docs/SCALE-2M-DESIGN.md): ستونِ سادهٔ text[]
  // که در زمانِ نوشتن از scraper-store پر می‌شود + ایندکسِ GIN. (اجباری: نوشتنِ ردیف این ستون را می‌نویسد.)
  if (!have.c_bk) await ddl(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS block_keys text[]`)
  if (!have.i_bk) await ddl(`CREATE INDEX IF NOT EXISTS listings_block_keys ON listings USING gin (block_keys)`, true)
  // SCALE-2M مرحلهٔ B — ایندکسِ url برای تطبیقِ «همان آگهی دوباره اسکرپ شد».
  if (!have.i_url) await ddl(`CREATE INDEX IF NOT EXISTS listings_url ON listings ((data->>'url'))`, true)
  // Enrichment deltas, one row per listing (baseline در .enrich-data.json؛ این ردیف‌ها فقط تغییراتِ پس از آن‌اند و
  // updated_at به هر اینستنس اجازه می‌دهد نتیجهٔ بقیه را افزایشی بکشد).
  if (!have.enrich) await ddl(`CREATE TABLE IF NOT EXISTS enrich (
    id text PRIMARY KEY,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  if (!have.i_enrich) await ddl(`CREATE INDEX IF NOT EXISTS enrich_updated ON enrich(updated_at)`, true)
  // ستونِ محاسباتیِ محلِ نرمال‌شده + ایندکسِ trigram (فیلترِ محله داخلِ دیتابیس). بدونِ دسترسیِ extension/superuser
  // خطا بلعیده می‌شود و listingsByLoc خالی برمی‌گرداند (مسیرِ قبلی).
  if (!have.c_loc || !have.i_trgm) {
    await ddl(`CREATE EXTENSION IF NOT EXISTS pg_trgm`, true)
    if (!have.c_loc) await ddl(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS loc_norm text GENERATED ALWAYS AS (translate(coalesce(data->>'location',''), chr(1610)||chr(1603)||chr(8204)||chr(8207)||chr(8206)||' ', chr(1740)||chr(1705))) STORED`, true)
    if (!have.i_trgm) await ddl(`CREATE INDEX IF NOT EXISTS listings_loc_norm_trgm ON listings USING gin (loc_norm gin_trgm_ops)`, true)
  }
}

/** اجرای یک تابع داخلِ یک تراکنش (BEGIN/COMMIT با rollback خودکار). client خام برای کوئری‌های دلخواه. */
export async function pgTx<R>(fn: (client: PoolClient) => Promise<R>): Promise<R> {
  const client = await acquire()
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
  const client = await acquire()
  try {
    await ensureSchema(client)
    // خواندنِ کاملِ ~۲۳۲مگِ کشِ سرد روی سقفِ پیش‌فرضِ ۱۵ث statement کنسل می‌شد («canceling statement»)
    // — هم موقعِ بیلدِ صفحاتِ SSG (/blog,/about که listItems صدا می‌زنند) هم موقعِ گرم‌شدنِ کشِ هر
    // اینستنس پس از reload. SET LOCAL سقف را فقط برای همین خواندن و فقط داخلِ همین تراکنش بالا می‌برد
    // (اتصالِ استخر بعدش دست‌نخورده). مرحلهٔ D این خواندنِ کامل را حذف می‌کند؛ این تا آن موقع جلوِ کنسل را می‌گیرد.
    await client.query('BEGIN')
    await client.query("SET LOCAL statement_timeout='120s'")
    const r = await client.query('SELECT data FROM listings ORDER BY scraped_at DESC')
    await client.query('COMMIT')
    return r.rows.map(x => x.data)
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally { client.release() }
}

/** خواندنِ سندِ یک استور. اگر نبود، fallback. */
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const client = await acquire()
  try {
    await ensureSchema(client)
    const r = await client.query('SELECT data FROM kv WHERE key = $1', [key])
    return r.rows.length ? (r.rows[0].data as T) : fallback
  } finally { client.release() }
}

/** نوشتنِ سندِ کامل (upsert). */
export async function kvSet(key: string, data: unknown): Promise<void> {
  const client = await acquire()
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
    const client = await acquire()
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
  const client = await acquire()
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
  const client = await acquire()
  try {
    await ensureSchema(client)
    const like = prefix.replace(/([%_\\])/g, '\\$1') + '%'
    const r = await client.query(`SELECT key, data FROM kv WHERE key LIKE $1 ESCAPE '\\'`, [like])
    return r.rows.map(x => ({ key: x.key as string, data: x.data as T }))
  } finally { client.release() }
}

/** خواندنِ «فقط یک فیلدِ» سندِ همهٔ کلیدهای یک prefix — سمتِ سرور بریده می‌شود، انتقال سبک است.
 *  فاز ۲۸۹: دایرکتوری برای غنی‌سازیِ مشاورها کلِ سندها (با آرایه‌های آگهیِ چندمگابایتی) را
 *  می‌کشید؛ با این، همان اطلاعات در چند کیلوبایت می‌آید. */
export async function kvGetPrefixField<T>(prefix: string, field: string): Promise<{ key: string; data: T | null }[]> {
  const client = await acquire()
  try {
    await ensureSchema(client)
    const like = prefix.replace(/([%_\\])/g, '\\$1') + '%'
    const r = await client.query(`SELECT key, data -> $2 AS f FROM kv WHERE key LIKE $1 ESCAPE '\\'`, [like, field])
    return r.rows.map(x => ({ key: x.key as string, data: (x.f ?? null) as T | null }))
  } finally { client.release() }
}

/** فاز ۳۴۶ط — چند فیلدِ سطحِ اولِ سندِ همهٔ کلیدهای یک prefix (برشِ سمتِ سرور). برای pollِ وضعیتِ
 *  پنلِ روستر: به‌جای کشیدنِ سندهای چندمگابایتی (مشاوران + توکن‌ها) هر چند ثانیه، فقط چند فیلدِ کوچک. */
export async function kvGetPrefixFields<T>(prefix: string, fields: string[]): Promise<{ key: string; data: T }[]> {
  const client = await acquire()
  try {
    await ensureSchema(client)
    const like = prefix.replace(/([%_\\])/g, '\\$1') + '%'
    const r = await client.query(
      `SELECT key, (SELECT jsonb_object_agg(f, data -> f) FROM unnest($2::text[]) AS f WHERE data ? f) AS d FROM kv WHERE key LIKE $1 ESCAPE '\\'`,
      [like, fields])
    return r.rows.map(x => ({ key: x.key as string, data: (x.d || {}) as T }))
  } finally { client.release() }
}

/** حذفِ یک کلید از kv. */
export async function kvDelete(key: string): Promise<void> {
  const client = await acquire()
  try {
    await ensureSchema(client)
    await client.query('DELETE FROM kv WHERE key = $1', [key])
  } finally { client.release() }
}
