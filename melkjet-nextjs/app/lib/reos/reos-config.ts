// REOS · Config Center — تنظیماتِ قابل‌ویرایشِ سوپرادمین برای همهٔ موتورها.
// پیش‌فرض‌ها = ثابت‌های فعلیِ کد؛ سوپرادمین می‌تواند override کند. کشِ همگام تا مسیرهای داغ بخوانند.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface ReosConfig {
  gateway: { cacheTtlMin: number; rates: Record<string, number> }
  rl: { lr: number; epsilon: number; rewards: { click: number; save: number; contact: number; visit: number; contract: number } }
  promotion: { boost: number; featured: number; vip: number; trustGate: boolean }
  trust: { weights: { verified: number; profile: number; response: number; deals: number; rating: number; tenure: number } }
  training: { autoHours: number; enabled: boolean; useLearnedLead: boolean }
  feed: { rankWeights: { userMatch: number; quality: number; engagement: number; freshness: number; demand: number; promotion: number } }
  scoring: { budget: number; location: number; behavior: number; intent: number; historical: number; demand: number }
  hybrid: { ml: number; vector: number; rule: number; behavioral: number; boost: number }
  twin: { saleWindowDays: number; overpricePct: number; underpricePct: number }
  territory: { weights: { transactions: number; listingQuality: number; leadConversion: number; satisfaction: number; content: number; activity: number; aiTrust: number }; battleDays: number; fraudThreshold: number; feedAuthority: number; contestGap: number }
  xp: { actions: Record<string, number>; levelBase: number; levelExp: number }
  economy: { commissionPct: number; affiliatePct: number; loyaltyBonusPct: number; missionRewardXp: number; missionRewardCredit: number }
  community: { weights: { followers: number; dominance: number; trust: number; level: number }; commentMaxLen: number }
  automl: { enabled: boolean; promoteMargin: number; minSamples: number }
  suspension: { enabled: boolean; fraudPct: number; autoSuspend: boolean }
  empire: {
    giftToman: number; welcomeCoins: number; welcomeXp: number; welcomeAiTokens: number
    buyRewardXp: number; missionRewardXp: number; missionRewardCoins: number
    guessTolerancePct: number; guessRewardXp: number; guessRewardCoins: number
    levelCurve: { base: number; exp: number }
    mentorInitiates: boolean
    dailyBrief: boolean
    sellProfitXp: number
    land: { buildGainPct: number; partnerGainPct: number; buildMonths: number }
    rentIncome: boolean
    maintenancePctYear: number
    chest: { enabled: boolean; maxCoins: number; maxXp: number }
  }
}

export const DEFAULT_CONFIG: ReosConfig = {
  gateway: { cacheTtlMin: 10, rates: { 'gpt-4o': 3000, 'gpt-4o-mini': 300, default: 800 } },
  rl: { lr: 0.05, epsilon: 0.1, rewards: { click: 1, save: 5, contact: 20, visit: 40, contract: 100 } },
  promotion: { boost: 0.5, featured: 0.75, vip: 1, trustGate: true },
  trust: { weights: { verified: 0.28, profile: 0.16, response: 0.16, deals: 0.16, rating: 0.16, tenure: 0.08 } },
  training: { autoHours: 6, enabled: true, useLearnedLead: true },
  feed: { rankWeights: { userMatch: 0.35, quality: 0.20, engagement: 0.15, freshness: 0.10, demand: 0.10, promotion: 0.10 } },
  scoring: { budget: 0.35, location: 0.25, behavior: 0.15, intent: 0.10, historical: 0.10, demand: 0.05 },
  hybrid: { ml: 0.30, vector: 0.25, rule: 0.20, behavioral: 0.15, boost: 0.10 },
  twin: { saleWindowDays: 45, overpricePct: 12, underpricePct: 8 },
  territory: { weights: { transactions: 0.30, listingQuality: 0.15, leadConversion: 0.20, satisfaction: 0.10, content: 0.10, activity: 0.10, aiTrust: 0.05 }, battleDays: 7, fraudThreshold: 0.5, feedAuthority: 0.08, contestGap: 8 },
  xp: { actions: { list_property: 10, close_deal: 200, respond_lead: 5, get_review: 30, publish_content: 20, win_battle: 100, verify: 40, refer_convert: 60 }, levelBase: 100, levelExp: 1.6 },
  economy: { commissionPct: 0.02, affiliatePct: 0.2, loyaltyBonusPct: 0.005, missionRewardXp: 50, missionRewardCredit: 20000 },
  community: { weights: { followers: 0.30, dominance: 0.30, trust: 0.25, level: 0.15 }, commentMaxLen: 800 },
  automl: { enabled: true, promoteMargin: 0.02, minSamples: 100 },
  // قوانینِ تعلیق: تقلب ≥ fraudPct٪ → پرچمِ بازبینی؛ اگر autoSuspend روشن باشد → تعلیقِ خودکار (ورود مسدود).
  suspension: { enabled: true, fraudPct: 70, autoSuspend: false },
  // امپراتوری (سندِ Empire، جلد۲ فصل ۱–۶): چهار نوع ارزش — XP (غیرقابل‌خرید)، Melk Coin (ارزِ داخلی)،
  // Real Asset (به تومان، دارایی = آگهیِ واقعی)، Reputation (از trustِ REOS). بستهٔ خوش‌آمد طبق §6.3.
  empire: {
    giftToman: 10_000_000_000, welcomeCoins: 500, welcomeXp: 100, welcomeAiTokens: 5,
    buyRewardXp: 100, missionRewardXp: 200, missionRewardCoins: 50,
    guessTolerancePct: 15, guessRewardXp: 30, guessRewardCoins: 10,
    // سطح‌بندیِ GDD جلد۳: سطحِ L نیازمندِ base×(L-1)^exp XP تجمعی — مراحل: Rookie→Explorer→…→Empire.
    levelCurve: { base: 100, exp: 1.5 },
    mentorInitiates: true,
    dailyBrief: true,
    // چرخهٔ عمرِ ملک (§6.7-6.8 و فصل ۵): فروش با سود → XP؛ برآوردِ زمین (ساخت/مشارکت) با پارامترهای شفافِ ادمین.
    sellProfitXp: 50,
    land: { buildGainPct: 45, partnerGainPct: 20, buildMonths: 18 },
    // درآمدِ اجاره از میانهٔ اجارهٔ واقعیِ هم‌محله‌ها + هزینهٔ مالکیت (GDD جلد۵: اقتصاد باید در گردش بماند).
    rentIncome: true,
    maintenancePctYear: 1,
    chest: { enabled: true, maxCoins: 100, maxXp: 50 },
  },
}

const FILE = join(process.cwd(), '.reos-config-settings.json')
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_config (id text PRIMARY KEY, data jsonb NOT NULL, at bigint NOT NULL)`)); ready = true }

// ادغامِ عمیقِ ساده (یک سطح تودرتو).
function merge(base: ReosConfig, over: Record<string, unknown>): ReosConfig {
  const out = JSON.parse(JSON.stringify(base)) as Record<string, Record<string, unknown>>
  for (const k in over) {
    const v = over[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k]) {
      for (const kk in v as Record<string, unknown>) {
        const vv = (v as Record<string, unknown>)[kk]
        if (vv && typeof vv === 'object' && !Array.isArray(vv) && out[k][kk]) Object.assign(out[k][kk] as object, vv)
        else (out[k] as Record<string, unknown>)[kk] = vv
      }
    } else out[k] = v as Record<string, unknown>
  }
  return out as unknown as ReosConfig
}

async function loadStored(): Promise<Record<string, unknown>> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_config WHERE id='main'`)); return (r.rows[0]?.data as Record<string, unknown>) || {} }
  if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} }
  return {}
}

// ── کشِ همگام (مسیرهای داغ) ──
let CFG: ReosConfig = DEFAULT_CONFIG
let primedAt = 0
export function config(): ReosConfig { return CFG }              // همگام
export async function primeConfig(): Promise<ReosConfig> {
  if (Date.now() - primedAt < 60_000) return CFG
  try { CFG = merge(DEFAULT_CONFIG, await loadStored()); primedAt = Date.now() } catch { CFG = DEFAULT_CONFIG }
  return CFG
}
export async function getConfig(): Promise<ReosConfig> { return merge(DEFAULT_CONFIG, await loadStored()) }
export async function setConfig(patch: Record<string, unknown>): Promise<ReosConfig> {
  const stored = await loadStored()
  const next = merge(merge(DEFAULT_CONFIG, stored), patch)
  // فقط delta نسبت به پیش‌فرض را ذخیره نمی‌کنیم؛ کلِ merged را ذخیره می‌کنیم (ساده و قابلِ‌بازگردانی).
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_config(id,data,at) VALUES('main',$1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, at=EXCLUDED.at`, [JSON.stringify(next), Date.now()])) }
  else { try { writeFileSync(FILE, JSON.stringify(next)) } catch {} }
  CFG = next; primedAt = Date.now()
  return next
}
export async function resetConfig(): Promise<ReosConfig> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`DELETE FROM reos_config WHERE id='main'`)) }
  else { try { if (existsSync(FILE)) writeFileSync(FILE, '{}') } catch {} }
  CFG = DEFAULT_CONFIG; primedAt = Date.now()
  return DEFAULT_CONFIG
}
