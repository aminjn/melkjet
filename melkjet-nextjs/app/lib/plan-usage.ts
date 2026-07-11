// شمارندهٔ مصرفِ ماهانهٔ پلن (فاز ۵۲) — برای سهمیه‌های «مصرفی» که موجودیِ قابلِ‌شمارش در store ندارند:
// پیامک/ایمیل/کمپین، ایمپورتِ دیوار، درخواستِ AI، تماسِ آشکارشده و… . سطلِ ماهانه (YYYY-MM) per کاربر.
// dual-mode مثلِ بقیه: PG (kv «plan_usage» — اتمیک) وگرنه فایلِ مشترک. سقف‌ها همیشه از خودِ پلن می‌آیند.
import fs from 'fs'
import path from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import { resolveAccess, quotaCapOf, QUOTA_LABEL } from './plan-gate'

type UsageMap = Record<string, number>   // `${phone}|${quotaKey}|${YYYY-MM}` → count
const FILE = path.join(process.cwd(), '.plan-usage-data.json')
const KV = 'plan_usage'

export const monthBucketOf = (ts = Date.now()) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const keyOf = (phone: string, quotaKey: string, ts = Date.now()) => `${phone}|${quotaKey}|${monthBucketOf(ts)}`

async function loadAll(): Promise<UsageMap> {
  if (pgEnabled()) return await kvGet<UsageMap>(KV, {}).catch(() => ({} as UsageMap))
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return {} }
}
// سطل‌های ماه‌های گذشته پاک می‌شوند تا نقشه کوچک بماند (فقط ماهِ جاری معتبر است).
const prune = (m: UsageMap): UsageMap => {
  const cur = '|' + monthBucketOf()
  for (const k of Object.keys(m)) if (!k.endsWith(cur)) delete m[k]
  return m
}
async function mutate<R>(fn: (m: UsageMap) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<UsageMap, R>(KV, {}, m => fn(prune(m)))
  const m = prune(await loadAll())
  const out = fn(m)
  fs.writeFileSync(FILE, JSON.stringify(m))
  return out
}

export async function usageOf(phone: string, quotaKey: string): Promise<number> {
  const m = await loadAll()
  return m[keyOf(phone, quotaKey)] || 0
}

export async function bumpUsage(phone: string, quotaKey: string, n = 1): Promise<number> {
  return mutate(m => { const k = keyOf(phone, quotaKey); m[k] = (m[k] || 0) + Math.max(1, Math.round(n)); return m[k] })
}

// گیت + مصرف در یک قدمِ اتمیک: اگر سقفِ ماهانهٔ پلن پر شده → خطای 403 (code:'plan')؛ وگرنه شمارنده بالا می‌رود.
// سقف از خودِ پلن (داینامیک)؛ enforce خاموش یا سوپرادمین → فقط شمارش (برای گزارش)، بدونِ قفل.
export async function requireAndBumpUsage(session: { phone: string; role?: string }, quotaKey: string, n = 1):
  Promise<null | { error: string; code: 'plan'; need: string; needLabel: string; plan: string; upgrade: string; cap: number; current: number }> {
  const a = resolveAccess(session)
  const cap = quotaCapOf(a, quotaKey)
  return mutate(m => {
    const k = keyOf(session.phone, quotaKey)
    const current = m[k] || 0
    if (a.enforce && !a.isAdmin && cap !== null && current + Math.max(1, Math.round(n)) > cap) {
      const label = QUOTA_LABEL[quotaKey] || quotaKey
      return {
        error: `سهمیهٔ ماهانهٔ پلنِ فعلی‌ات پر شد — ${cap.toLocaleString('fa-IR')} ${label} در ماه (پلنِ «${a.planName}»). برای ادامه پلن را ارتقا بده یا ماهِ بعد برگرد.`,
        code: 'plan' as const, need: quotaKey, needLabel: label, plan: a.planName, upgrade: '/pricing', cap, current,
      }
    }
    m[k] = current + Math.max(1, Math.round(n))
    return null
  })
}
