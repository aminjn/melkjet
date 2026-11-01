// فاز ۳۴۵ج — «هر مالک ردیفِ خودش» برای انبارهایی که شکلشان `{ [field]: Record<owner, T> }` است
// (buyer / owner / agency / materials). الگوی فاز ۲۵۹ (advisor) و ۳۴۵ (builder)، عمومی‌شده.
//
// چرا: هر کدام از این انبارها «یک» ردیفِ kv برای همهٔ کاربران بود. باز کردنِ هر پنل کلِ آن را می‌خواند
// (GETِ خریدار ~۱۱ بار پشتِ سرِ هم) و هر کلیک (ذخیرهٔ آگهی، ثبتِ لید، سفارش) کلِ آن را زیرِ FOR UPDATE
// بازنویسی می‌کرد ⇒ صفِ قفل، timeout، و پنل‌هایی که «باز نمی‌شدند». با رشدِ کاربران فقط بدتر می‌شد.
//
// قرارداد: بدنهٔ توابعِ انبار دست‌نخورده می‌ماند. به‌جای `load()` → `loadOwnerDb(o)` (یک DB که فقط همین مالک را
// دارد)، به‌جای `withDb(fn)` → `withOwnerDb(o, fn)` (قفلِ ردیفِ همین مالک)، و برای خواننده‌های «همهٔ مالکان»
// → `loadAllDb()` (اسکنِ prefix با کشِ کوتاه). مهاجرتِ یک‌باره و ایدمپوتنت (INSERT … ON CONFLICT DO NOTHING)
// با نشانِ `{marker}`؛ بلابِ قدیمی یخ‌زده می‌ماند (rollback). حالتِ فایل (بی‌DATABASE_URL) به خودِ انبار سپرده می‌شود.
import { pgEnabled, kvGet, kvMutate, kvDelete, kvGetPrefix, pgTx } from './db'

export interface OwnerShardsCfg { legacyKey: string; field: string; prefix: string; marker: string; allTtlMs?: number }

export function ownerShards<T, DB extends Record<string, any>>(cfg: OwnerShardsCfg) {
  const { legacyKey, field, prefix, marker } = cfg
  const allTtl = cfg.allTtlMs ?? 20_000
  const key = (o: string) => prefix + o
  let migrated = false
  let migrating: Promise<void> | null = null
  let allCache: { at: number; map: Record<string, T> } | null = null
  let allInflight: Promise<Record<string, T>> | null = null

  async function ensureMigrated(): Promise<void> {
    if (migrated) return
    if (migrating) return migrating
    migrating = (async () => {
      try { if ((await kvGet<{ done?: boolean }>(marker, {})).done) { migrated = true; return } } catch { return }
      await pgTx(async (client) => {
        await client.query(`SET LOCAL statement_timeout = '180s'`)
        await client.query(`INSERT INTO kv(key, data) VALUES($1, '{}'::jsonb) ON CONFLICT(key) DO NOTHING`, [marker])
        const m = await client.query('SELECT data FROM kv WHERE key = $1 FOR UPDATE', [marker])
        if (m.rows[0]?.data?.done) return
        const lb = await client.query('SELECT data FROM kv WHERE key = $1', [legacyKey])
        const map = (lb.rows[0]?.data?.[field] || {}) as Record<string, T>
        let n = 0
        for (const [o, data] of Object.entries(map)) {
          if (!o || !data || typeof data !== 'object') continue
          await client.query(`INSERT INTO kv(key, data) VALUES($1, $2) ON CONFLICT(key) DO NOTHING`, [key(o), JSON.stringify(data)])
          n++
        }
        await client.query('UPDATE kv SET data = $2, updated_at = now() WHERE key = $1', [marker, JSON.stringify({ done: true, at: Date.now(), n })])
        console.log(`[${legacyKey}] per-owner migration: ${n} owners split from legacy blob`)
      })
      migrated = true
    })().finally(() => { migrating = null })
    return migrating
  }

  const wrap = (map: Record<string, T>): DB => ({ [field]: map } as unknown as DB)

  /** DBِ «فقط همین مالک» (اگر ردیف ندارد، نقشهٔ خالی). */
  async function loadOwnerDb(o: string): Promise<DB> {
    await ensureMigrated()
    const d = await kvGet<T | null>(key(o), null)
    return wrap(d ? { [o]: d } : {})
  }

  /** خواندن-تغییر-نوشتن زیرِ قفلِ ردیفِ «همین مالک». ساختن/جایگزینی/حذفِ رکورد در fn پشتیبانی می‌شود. */
  async function withOwnerDb<R>(o: string, fn: (db: DB) => R): Promise<R> {
    await ensureMigrated()
    let gone = false
    const r = await kvMutate<any, R>(key(o), { __absent: true }, d => {
      const absent = !!d.__absent
      const map: Record<string, T> = absent ? {} : { [o]: d as T }
      const db = wrap(map)
      const res = fn(db)
      const nd = (db as any)[field]?.[o] as T | undefined
      if (nd === undefined) { gone = true; return res }
      if (nd !== d) { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, nd) }
      return res
    })
    if (gone) { try { await kvDelete(key(o)) } catch {} }
    if (allCache) { allCache = null }   // نوشتنِ خودی ⇒ کشِ «همه» کهنه است
    return r
  }

  /** همهٔ مالکان (برای صفحه‌های عمومی/گزارش‌ها) — اسکنِ prefix، کشِ کوتاه و singleflight. */
  async function loadAllDb(): Promise<DB> {
    await ensureMigrated()
    if (allCache && Date.now() - allCache.at < allTtl) return wrap(allCache.map)
    if (!allInflight) {
      allInflight = (async () => {
        const rows = await kvGetPrefix<T>(prefix)
        const map: Record<string, T> = {}
        for (const { key: k, data } of rows) if (data && !(data as any).__absent) map[k.slice(prefix.length)] = data
        allCache = { at: Date.now(), map }
        return map
      })().finally(() => { allInflight = null })
    }
    return wrap(await allInflight)
  }

  async function deleteOwner(o: string): Promise<boolean> {
    await ensureMigrated()
    const had = !!(await kvGet<T | null>(key(o), null))
    if (had) await kvDelete(key(o))
    allCache = null
    return had
  }

  return { enabled: pgEnabled, loadOwnerDb, withOwnerDb, loadAllDb, deleteOwner, ensureMigrated }
}
