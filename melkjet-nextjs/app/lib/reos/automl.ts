// REOS v8 · AutoML — پلتفرمِ آزمایشِ خودکارِ مدل (champion/challenger بدونِ دخالتِ انسان).
// سیستم خودش نسخه‌های مدل را می‌سنجد و اگر چالش‌گر از قهرمان بهتر بود (با حاشیهٔ مطمئن)، خودکار ارتقا می‌دهد.
// این یعنی پلتفرم به‌مرور یاد می‌گیرد بهتر تصمیم بگیرد — نه فقط مدل‌ها از داده آموزش ببینند.
// هستهٔ خالص (shouldPromote/pickChallenger) تست‌پذیر؛ روی Model Registryِ واقعی کار می‌کند.
import { config } from './reos-config'
import { listVersions, promote, getChampion, type ModelVersion } from './model-registry'

// متریکِ مقایسه: AUC (بالاتر بهتر). اگر نبود، از accuracy یا -logLoss استفاده می‌شود.
function metricOf(v: ModelVersion): number {
  const m = v.metrics || {}
  if (typeof m.auc === 'number') return m.auc
  if (typeof m.accuracy === 'number') return m.accuracy
  if (typeof m.logloss === 'number') return -m.logloss
  return 0
}
function samplesOf(v: ModelVersion): number { return Number(v.metrics?.n || 0) }

// آیا چالش‌گر باید جای قهرمان را بگیرد؟ باید با حاشیهٔ مطمئن بهتر باشد و نمونهٔ کافی داشته باشد.
export function shouldPromote(champion: ModelVersion | null, challenger: ModelVersion, margin: number, minSamples: number): boolean {
  if (samplesOf(challenger) < minSamples) return false          // دادهٔ کافی نداشت
  if (!champion) return metricOf(challenger) > 0                  // قهرمانی نبود → اولین معتبر
  if (challenger.id === champion.id) return false
  return metricOf(challenger) > metricOf(champion) + margin      // بهتر با حاشیه
}

// بهترین چالش‌گر/نامزد از میانِ نسخه‌ها (به‌جز قهرمان و بازنشسته).
export function pickChallenger(versions: ModelVersion[], championId?: string): ModelVersion | null {
  const cand = versions.filter(v => v.status !== 'retired' && v.id !== championId)
  if (!cand.length) return null
  return cand.reduce((best, v) => (metricOf(v) > metricOf(best) ? v : best))
}

export interface AutoPromoteResult { name: string; promoted: boolean; reason: string; from?: { id: string; metric: number }; to?: { id: string; metric: number } }

// ارزیابیِ خودکارِ یک مدل: اگر چالش‌گر بهتر بود، ارتقا بده. برمی‌گرداند چه شد (شفافیت).
export async function autoPromote(name: string): Promise<AutoPromoteResult> {
  if (!config().automl.enabled) return { name, promoted: false, reason: 'AutoML خاموش است' }
  const versions = await listVersions(name)
  if (!versions.length) return { name, promoted: false, reason: 'نسخه‌ای ثبت نشده' }
  const champ = versions.find(v => v.status === 'champion') || null
  const challenger = pickChallenger(versions, champ?.id)
  if (!challenger) return { name, promoted: false, reason: 'چالش‌گری نیست', from: champ ? { id: champ.id, metric: metricOf(champ) } : undefined }
  const { promoteMargin, minSamples } = config().automl
  if (!shouldPromote(champ, challenger, promoteMargin, minSamples)) {
    return { name, promoted: false, reason: samplesOf(challenger) < minSamples ? 'نمونهٔ ناکافیِ چالش‌گر' : 'چالش‌گر بهتر از قهرمان نبود', from: champ ? { id: champ.id, metric: metricOf(champ) } : undefined, to: { id: challenger.id, metric: metricOf(challenger) } }
  }
  await promote(challenger.id)
  return { name, promoted: true, reason: 'چالش‌گر با حاشیهٔ مطمئن بهتر بود — ارتقا یافت', from: champ ? { id: champ.id, metric: metricOf(champ) } : undefined, to: { id: challenger.id, metric: metricOf(challenger) } }
}

// اجرای دورِ AutoML روی مدل‌های اصلی (cron). برمی‌گرداند خلاصهٔ تصمیم‌ها.
export async function runAutoML(names = ['engage', 'lead']): Promise<AutoPromoteResult[]> {
  const out: AutoPromoteResult[] = []
  for (const n of names) out.push(await autoPromote(n).catch(() => ({ name: n, promoted: false, reason: 'خطا' })))
  return out
}

// وضعیتِ فعلیِ AutoML برای نمایش (قهرمان + بهترین چالش‌گر + آیا ارتقا در انتظار است).
export async function autoMLStatus(name: string): Promise<{ name: string; champion?: { id: string; version: number; metric: number }; challenger?: { id: string; version: number; metric: number; samples: number }; wouldPromote: boolean }> {
  const versions = await listVersions(name)
  const champ = versions.find(v => v.status === 'champion') || null
  const challenger = pickChallenger(versions, champ?.id)
  const { promoteMargin, minSamples } = config().automl
  return {
    name,
    champion: champ ? { id: champ.id, version: champ.version, metric: Math.round(metricOf(champ) * 1000) / 1000 } : undefined,
    challenger: challenger ? { id: challenger.id, version: challenger.version, metric: Math.round(metricOf(challenger) * 1000) / 1000, samples: samplesOf(challenger) } : undefined,
    wouldPromote: challenger ? shouldPromote(champ, challenger, promoteMargin, minSamples) : false,
  }
}
