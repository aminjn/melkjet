// REOS · In-process Event Queue (معادلِ Kafka برای مونولیتِ تک-نودی)
// هدف: رویداد هرگز مسیرِ درخواستِ کاربر را کند نکند. ingest فقط در بافرِ حافظه push می‌کند و
// برمی‌گردد؛ یک فلاشرِ پس‌زمینه به‌صورتِ دسته‌ای (batch INSERT + coalesced feature bumps) تخلیه می‌کند.
// دوام (durability): بهترین-تلاش — رویدادهای تعاملی (کلیک/سیو) اگر پروسه پیش از فلاش بمیرد از دست
// می‌روند؛ برای آنالیتیکسِ رفتاری قابل‌قبول است. مسیرِ ارتقا: صفِ پایدار/Kafka با همین API.
import { recordEventBatch, bumpFeatures } from './store'
import type { ReosEvent } from './types'

const EV_BUF: ReosEvent[] = []
const FEAT_BUF = new Map<string, Record<string, number>>()   // key = `${type}|${id}`
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false
const MAX_BUFFER = 500       // اگر بافر پر شد فوراً فلاش کن (پشتیبان در برابرِ برست)
const FLUSH_MS = 1500        // فلاشِ دوره‌ای

export function enqueueEvent(ev: ReosEvent): void {
  EV_BUF.push(ev)
  if (EV_BUF.length >= MAX_BUFFER) void flushQueue()
  else schedule()
}

// افزایشِ ویژگی‌ها را coalesce می‌کند: N رویدادِ یک ملک → یک bumpFeatures.
export function enqueueFeature(type: string, id: string, inc: Record<string, number>): void {
  if (!id) return
  const k = `${type}|${id}`
  const cur = FEAT_BUF.get(k) || {}
  for (const kk in inc) cur[kk] = (cur[kk] || 0) + inc[kk]
  FEAT_BUF.set(k, cur)
  schedule()
}

function schedule(): void {
  if (timer) return
  timer = setTimeout(() => { timer = null; void flushQueue() }, FLUSH_MS)
  if (typeof timer === 'object' && timer && 'unref' in timer) (timer as { unref: () => void }).unref()
}

// تخلیهٔ بافر (idempotent؛ اگر حین فلاش رویدادِ جدید آمد دوباره schedule می‌شود).
export async function flushQueue(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    if (EV_BUF.length) {
      const batch = EV_BUF.splice(0, EV_BUF.length)
      try { await recordEventBatch(batch) } catch { /* best-effort */ }
    }
    if (FEAT_BUF.size) {
      const entries = Array.from(FEAT_BUF.entries()); FEAT_BUF.clear()
      for (const [k, inc] of entries) {
        const sep = k.indexOf('|')
        try { await bumpFeatures(k.slice(0, sep), k.slice(sep + 1), inc) } catch { /* best-effort */ }
      }
    }
  } finally {
    flushing = false
  }
  if (EV_BUF.length || FEAT_BUF.size) schedule()
}

// وضعیتِ صف (برای observability).
export function queueDepth(): { events: number; features: number } { return { events: EV_BUF.length, features: FEAT_BUF.size } }
