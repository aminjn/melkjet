// فاز ۲۸۴ — «دیده‌شده» روی کارت‌های جست‌وجو: helperِ SSR-safe روی همان استورِ فاز ۲۵۵.
// ⚠️ منبعِ حقیقتِ ذخیره‌سازی فقط seen-store.ts است (کلیدِ mj_seen_v1، فرمتِ آبجکتِ
// Record<id, timestamp>، سقفِ ۳۰۰۰) — این ماژول استورِ دوم نمی‌سازد و هیچ‌وقت نمی‌نویسد؛
// فقط خوانشِ خالص/تزریق‌پذیر (برای تست) + hookِ گِیت‌شدهٔ بعد از mount (ضدِ hydration mismatch) می‌دهد.
import { useEffect, useState } from 'react'

// نوشتن/تک‌خوانی همچنان از استورِ اصلی — تا هر مصرف‌کننده یک import کافی داشته باشد.
export { isSeen, markSeen } from './seen-store'

export type SeenMap = Record<string, number>

// همان کلید و رویدادِ seen-store (آن‌جا export نشده‌اند؛ این‌جا ثابتِ مرجعِ خواندن‌اند —
// اگر روزی آن‌جا عوض شد، این دو هم باید هم‌زمان عوض شوند)
export const SEEN_KEY = 'mj_seen_v1'
export const SEEN_EVENT = 'mj-seen-change'
export const SEEN_MAX = 3000

// حداقلِ سطحِ Storage که لازم داریم — تا در تست بشود آبجکتِ ساده تزریق کرد (بدونِ localStorage/DOM)
export interface StorageLike { getItem(key: string): string | null }

// خوانشِ امن و تزریق‌پذیرِ نقشهٔ دیده‌شده‌ها؛ روی سرور (بدونِ window) همیشه {}
export function readSeenMap(storage?: StorageLike | null): SeenMap {
  const s = storage !== undefined ? storage : (typeof window === 'undefined' ? null : window.localStorage)
  if (!s) return {}
  try {
    const m = JSON.parse(s.getItem(SEEN_KEY) || '{}')
    return m && typeof m === 'object' && !Array.isArray(m) ? (m as SeenMap) : {}
  } catch { return {} }
}

// خالص: مجموعهٔ شناسه‌های دیده‌شده از یک نقشه
export function seenIdsOf(map: SeenMap): Set<string> { return new Set(Object.keys(map)) }

// خالص: ترتیبِ «جدیدترین اول» (برای هر UIِ آینده مثلِ «بازدیدهای اخیر»)
export function sortSeenNewestFirst(map: SeenMap): string[] {
  return Object.keys(map).sort((a, b) => (map[b] || 0) - (map[a] || 0))
}

// خالص: آینهٔ قانونِ سقفِ seen-store (سرریز → قدیمی‌ترین‌ها حذف) برای تستِ واحد.
// نوشتنِ واقعی همیشه از markSeen (seen-store) می‌گذرد؛ این تابع چیزی ذخیره نمی‌کند.
export function pruneSeenMap(map: SeenMap, max = SEEN_MAX): SeenMap {
  const keys = Object.keys(map)
  if (keys.length <= max) return map
  const out: SeenMap = {}
  for (const k of sortSeenNewestFirst(map).slice(0, max)) out[k] = map[k]
  return out
}

// hookِ کلاینتی: قبل از mount (و در HTMLِ سرور) null → هیچ نشانه‌ای رندر نمی‌شود و
// hydration mismatch پیش نمی‌آید؛ بعد از mount مجموعهٔ دیده‌شده‌ها + گوش‌دادن به تغییرها.
export function useSeenSet(): ReadonlySet<string> | null {
  const [set, setSet] = useState<ReadonlySet<string> | null>(null)
  useEffect(() => {
    const load = () => setSet(seenIdsOf(readSeenMap()))
    load()
    window.addEventListener(SEEN_EVENT, load)
    return () => window.removeEventListener(SEEN_EVENT, load)
  }, [])
  return set
}
