// فاز ۱۵۲ (سنجشِ prod: /search با ۲.۰۶ث و /api/content با ۱.۰۲ث TTFB) — کشِ stale-while-revalidate
// مشترک. الگوی همان کشی است که TTFB صفحهٔ اصلی را حل کرد (home-data): پاسخِ کهنه فوری داده
// می‌شود و تازه‌سازی در پس‌زمینه انجام می‌شود، پس هیچ درخواستی پشتِ خواندن/serialize کلِ آگهی‌ها
// نمی‌ماند. maxStaleMs سقفِ صداقت است: کهنه‌تر از آن، درخواست منتظرِ محاسبهٔ تازه می‌ماند.
export interface SwrOpts {
  ttlMs: number        // تا این سن، پاسخ «تازه» است و هیچ محاسبه‌ای نمی‌شود
  maxStaleMs?: number  // کهنه‌تر از این، دیگر پاسخِ کهنه نمی‌دهیم (پیش‌فرض: بی‌سقف)
}

// یک مقدارِ سراسری (مثل استخرِ SSR جستجو)
export function swrValue<T>(compute: () => Promise<T>, opts: SwrOpts) {
  let cache: { at: number; data: T } | null = null
  let inflight: Promise<T> | null = null
  const refresh = () => {
    if (!inflight) inflight = compute().then(d => { cache = { at: Date.now(), data: d }; return d }).finally(() => { inflight = null })
    return inflight
  }
  return {
    async get(): Promise<T> {
      if (!cache) return refresh()
      const age = Date.now() - cache.at
      if (age >= opts.ttlMs) {
        const p = refresh()
        if (opts.maxStaleMs !== undefined && age >= opts.maxStaleMs) return p
        p.catch(() => {})   // خطای تازه‌سازیِ پس‌زمینه نباید پاسخِ سالمِ فعلی را بشکند
      }
      return cache.data
    },
    invalidate() { cache = null },
  }
}

// چند-کلیدی (مثل /api/content که هر ترکیبِ پارامتر یک پاسخ دارد) + سقفِ تعدادِ کلید (LRU ساده)
export function swrMap<T>(opts: SwrOpts & { maxKeys?: number }) {
  const max = opts.maxKeys ?? 200
  const map = new Map<string, { at: number; data?: T; has: boolean; inflight: Promise<T> | null }>()
  const prune = () => {
    if (map.size <= max) return
    let oldestK: string | null = null; let oldestAt = Infinity
    for (const [k, v] of map) if (v.at < oldestAt) { oldestAt = v.at; oldestK = k }
    if (oldestK !== null) map.delete(oldestK)
  }
  const refresh = (e: { at: number; data?: T; has: boolean; inflight: Promise<T> | null }, compute: () => Promise<T>) => {
    if (!e.inflight) inflight_set(e, compute)
    return e.inflight!
  }
  const inflight_set = (e: { at: number; data?: T; has: boolean; inflight: Promise<T> | null }, compute: () => Promise<T>) => {
    e.inflight = compute().then(d => { e.at = Date.now(); e.data = d; e.has = true; return d }).finally(() => { e.inflight = null })
  }
  return {
    async get(key: string, compute: () => Promise<T>): Promise<T> {
      let e = map.get(key)
      // at = زمانِ درج تا کلیدِ تازه‌واردِ در حالِ محاسبه، خودش قربانیِ LRU نشود
      if (!e) { e = { at: Date.now(), has: false, inflight: null }; map.set(key, e); prune() }
      if (!e.has) return refresh(e, compute)
      const age = Date.now() - e.at
      if (age >= opts.ttlMs) {
        const p = refresh(e, compute)
        if (opts.maxStaleMs !== undefined && age >= opts.maxStaleMs) return p
        p.catch(() => {})
      }
      return e.data as T
    },
    invalidate(key?: string) { if (key === undefined) map.clear(); else map.delete(key) },
    size() { return map.size },
  }
}
