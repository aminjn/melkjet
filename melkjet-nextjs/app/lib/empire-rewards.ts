// Empire · جوایزِ پولِ واقعی (فاز ۴۸ — درخواستِ مستقیم): مسیرِ مرحله‌ایِ رشد → جایزهٔ تومانیِ «واقعی»
// به سطلِ «پاداشِ» کیف‌پولِ یکپارچهٔ سایت (reos/wallet).
// دو ستونِ پایداری (تا مدل هرگز ضررده نشود):
//  ۱) استخر: سقفِ کلِ پرداختی = payoutPct٪ از درآمدِ «واقعیِ تأییدشدهٔ» درگاه (خریدِ کوین) —
//     نمونهٔ خواسته‌شده: کاربران ۵۰۰م تومان خرج کردند → حداکثر ۲۰۰م جایزه (payoutPct=۴۰).
//     درخواستی که از ظرفیتِ استخر بگذرد همان لحظه، صادقانه رد می‌شود — بدهیِ معلق نمی‌سازیم.
//  ۲) نردبان: آستانه‌ها هندسی تند بالا می‌روند (thresholdGrowth×) ولی جایزه‌ها کند (rewardGrowth×،
//     با سقف) — «همه نباید خیلی زود به مراحلِ بعد برسند». هر مرحله برای هر بازیکن فقط یک‌بار.
// پرداخت فقط با تأییدِ انسانیِ سوپرادمین (پولِ واقعی = صفِ بررسی؛ اسنپ‌شاتِ متریک‌ها برای تشخیصِ تقلب).
import fs from 'fs'
import path from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import { randomBytes } from 'crypto'

export interface PayoutRequest {
  id: string; userId: string; no: number; name: string
  step: number; amount: number
  netWorth: number; level: number; ageDays: number   // اسنپ‌شاتِ لحظهٔ ادعا — خوراکِ تصمیمِ ادمین
  at: number
  status: 'pending' | 'approved' | 'rejected'
  decidedAt?: number; by?: string; note?: string
}
export interface RewardsDb {
  revenueTotal: number                                   // جمعِ درآمدِ واقعیِ تأییدشده (تومان)
  seenRefs: Record<string, number>                       // ایدمپوتنسیِ ثبتِ درآمد (authority درگاه)
  revenueLog: Array<{ at: number; phone: string; amount: number; ref: string }>
  paidOut: number                                        // جمعِ جوایزِ «تأییدشده» (تومان)
  requests: PayoutRequest[]
}
export interface RewardsCfg {
  payoutPct: number
  baseThresholdToman: number; thresholdGrowth: number
  baseRewardToman: number; rewardGrowth: number
  maxSteps: number; maxRewardToman: number
}

const FILE = path.join(process.cwd(), '.empire-rewards-data.json')
const KV = 'empire_rewards'
const EMPTY: RewardsDb = { revenueTotal: 0, seenRefs: {}, revenueLog: [], paidOut: 0, requests: [] }
const norm = (d: Partial<RewardsDb> | null | undefined): RewardsDb => ({
  revenueTotal: Math.max(0, Number(d?.revenueTotal) || 0),
  seenRefs: d?.seenRefs || {},
  revenueLog: Array.isArray(d?.revenueLog) ? d!.revenueLog! : [],
  paidOut: Math.max(0, Number(d?.paidOut) || 0),
  requests: Array.isArray(d?.requests) ? d!.requests! : [],
})

export async function rewardsDb(): Promise<RewardsDb> {
  if (pgEnabled()) return norm(await kvGet<RewardsDb>(KV, EMPTY).catch(() => EMPTY))
  try { return norm(JSON.parse(fs.readFileSync(FILE, 'utf-8'))) } catch { return { ...EMPTY, seenRefs: {}, revenueLog: [], requests: [] } }
}
async function mutate<R>(fn: (d: RewardsDb) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<RewardsDb, R>(KV, EMPTY, raw => {
    const d = norm(raw)
    const out = fn(d)
    // kvMutate همان آبجکتِ پاس‌داده‌شده را ذخیره می‌کند — نرمال‌شده را برگردانیم
    Object.assign(raw as RewardsDb, d)
    return out
  })
  const d = await rewardsDb()
  const out = fn(d)
  fs.writeFileSync(FILE, JSON.stringify(d))
  return out
}

// ── هسته‌های خالص (تست‌پذیر) ──

// نردبانِ مراحل: آستانهٔ ارزشِ خالص (تومانِ درون‌بازی) و جایزه (تومانِ «واقعی») — همه knob.
export function rewardLadderOf(cfg: RewardsCfg): Array<{ step: number; threshold: number; reward: number }> {
  const steps = Math.max(1, Math.min(30, Math.round(cfg.maxSteps)))
  const g = Math.max(1.1, cfg.thresholdGrowth), rg = Math.max(1, cfg.rewardGrowth)
  const out: Array<{ step: number; threshold: number; reward: number }> = []
  for (let k = 1; k <= steps; k++) {
    out.push({
      step: k,
      threshold: Math.round(cfg.baseThresholdToman * Math.pow(g, k - 1)),
      reward: Math.min(Math.max(1, cfg.maxRewardToman), Math.round(cfg.baseRewardToman * Math.pow(rg, k - 1))),
    })
  }
  return out
}

// فاز ۵۰ (سند ۳۰ Ch19 Part 6 — Reward Forecast): برآوردِ صادقانه از سرعتِ رشدِ «واقعیِ» همین هفتهٔ خودِ بازیکن.
// بدونِ رشدِ مثبت یا بدونِ مرجعِ زمانی → هیچ ادعایی (null)؛ عددِ ساختگی نداریم.
export function rewardForecastOf(netWorth: number, threshold: number, refNetWorth: number, refDays: number): { left: number; perDay: number; days: number } | null {
  const left = threshold - netWorth
  if (left <= 0) return { left: 0, perDay: 0, days: 0 }
  if (!(refDays > 0)) return null
  const perDay = (netWorth - refNetWorth) / refDays
  if (!(perDay > 0)) return null
  return { left, perDay: Math.round(perDay), days: Math.max(1, Math.ceil(left / perDay)) }
}

// وضعیتِ استخر: pool = ٪ از درآمدِ واقعی؛ تعهد = پرداخت‌شده + در انتظارِ تأیید؛ available هرگز منفی نه.
export function rewardPoolOf(db: Pick<RewardsDb, 'revenueTotal' | 'paidOut' | 'requests'>, payoutPct: number) {
  const pool = Math.floor(Math.max(0, db.revenueTotal) * Math.max(0, Math.min(100, payoutPct)) / 100)
  const pending = db.requests.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0)
  return { pool, paidOut: db.paidOut, pending, available: Math.max(0, pool - db.paidOut - pending) }
}

// ── عملیاتِ اتمیک ──

// ثبتِ درآمدِ واقعیِ تأییدشدهٔ درگاه — ایدمپوتنت با ref (همان authority زرین‌پال).
export async function recordRealRevenue(phone: string, amountToman: number, ref: string) {
  const amt = Math.round(Number(amountToman) || 0)
  if (!(amt > 0) || !ref) return { ok: false as const }
  return mutate(d => {
    if (d.seenRefs[ref]) return { ok: true as const, dup: true }
    d.seenRefs[ref] = Date.now()
    d.revenueTotal += amt
    d.revenueLog.unshift({ at: Date.now(), phone, amount: amt, ref })
    d.revenueLog = d.revenueLog.slice(0, 300)
    return { ok: true as const, dup: false }
  })
}

// درخواستِ جایزهٔ یک مرحله: یک‌بار برای هر (کاربر، مرحله)؛ سقفِ ماهانهٔ هر کاربر؛ ظرفیتِ استخر.
export async function requestPayout(
  input: { userId: string; no: number; name: string; step: number; amount: number; netWorth: number; level: number; ageDays: number },
  payoutPct: number, monthlyCapToman: number, now = Date.now(),
): Promise<{ ok: boolean; reason?: string; request?: PayoutRequest }> {
  return mutate(d => {
    if (d.requests.some(r => r.userId === input.userId && r.step === input.step && r.status !== 'rejected'))
      return { ok: false, reason: 'برای این مرحله قبلاً درخواست ثبت کرده‌ای' }
    const month = d.requests.filter(r => r.userId === input.userId && r.status !== 'rejected' && now - r.at < 30 * 864e5)
      .reduce((s, r) => s + r.amount, 0)
    if (monthlyCapToman > 0 && month + input.amount > monthlyCapToman)
      return { ok: false, reason: `سقفِ جایزهٔ ماهانه‌ات (${Math.round(monthlyCapToman / 1e6).toLocaleString('fa-IR')}م تومان) پر شده — ماهِ بعد ادامه بده` }
    const { available } = rewardPoolOf(d, payoutPct)
    if (input.amount > available)
      return { ok: false, reason: 'ظرفیتِ استخرِ جوایزِ این دوره تکمیل شده — به‌زودی ظرفیتِ تازه باز می‌شود؛ پیشرفتت محفوظ است' }
    const request: PayoutRequest = { id: 'rw_' + randomBytes(5).toString('hex'), at: now, status: 'pending', ...input }
    d.requests.unshift(request)
    d.requests = d.requests.slice(0, 1000)
    return { ok: true, request }
  })
}

// تصمیمِ ادمین — اتمیک: فقط از pending؛ تأیید = تعهدِ قطعی (paidOut). واریزِ کیف‌پول را «صداکننده»
// بعد از این انجام می‌دهد (این تابع فقط دفتر را قفل می‌کند تا تأییدِ همزمانِ دوباره، دوبار واریز نشود).
export async function decidePayout(id: string, approve: boolean, by: string, note = ''):
  Promise<{ ok: boolean; reason?: string; request?: PayoutRequest }> {
  return mutate(d => {
    const r = d.requests.find(x => x.id === id)
    if (!r) return { ok: false, reason: 'درخواست یافت نشد' }
    if (r.status !== 'pending') return { ok: false, reason: 'قبلاً تصمیم‌گیری شده' }
    r.status = approve ? 'approved' : 'rejected'
    r.decidedAt = Date.now(); r.by = by.slice(0, 40); if (note) r.note = note.slice(0, 200)
    if (approve) d.paidOut += r.amount
    return { ok: true, request: { ...r } }
  })
}

// برگشتِ اضطراری (اگر واریزِ کیف‌پول بعد از تأیید شکست خورد): تعهد آزاد و درخواست به صف برمی‌گردد.
export async function revertApproval(id: string) {
  return mutate(d => {
    const r = d.requests.find(x => x.id === id)
    if (!r || r.status !== 'approved') return { ok: false }
    r.status = 'pending'; r.decidedAt = undefined; r.by = undefined
    d.paidOut = Math.max(0, d.paidOut - r.amount)
    return { ok: true }
  })
}

// وضعیتِ درخواست‌های یک کاربر (برای نمایشِ نردبان در UI): step → status
export async function userPayoutsOf(userId: string): Promise<Record<number, PayoutRequest['status']>> {
  const d = await rewardsDb()
  const out: Record<number, PayoutRequest['status']> = {}
  for (const r of d.requests) if (r.userId === userId && out[r.step] === undefined) out[r.step] = r.status
  return out
}
