import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// تعرفهٔ واقعیِ پیامک (از اپراتور/پنلِ IPPanel) + درصدِ سود → قیمتِ فروشِ پیامک.
// قیمت‌ها به ریال به‌ازای هر پیامک (فارسی/لاتین)، به‌تفکیکِ خطِ ارسال و اپراتور.
const FILE = join(process.cwd(), '.smscost-data.json')
const SEED_V = 1

// هر ردیف: یک خطِ ارسال، با قیمتِ فارسی/لاتینِ همراه‌اول و ایرانسل‌وسایر (ریال).
export interface SmsTariff { lineType: string; mciFa: number; mciLat: number; otherFa: number; otherLat: number }
export interface SmsCostConfig {
  profitPercent: number   // درصدِ سود
  roundTo: number         // گِردکردنِ قیمتِ بسته (تومان)
  refLine: string         // خطِ مرجع (قیمتِ پیامک از رویش حساب می‌شود)
  refOperator: 'mci' | 'other'  // اپراتورِ مرجع
  refLang: 'fa' | 'lat'   // زبانِ مرجع (فارسی/لاتین)
  tariffs: SmsTariff[]
  v?: number
}

function seedTariffs(): SmsTariff[] {
  const T = (lineType: string, mciFa: number, mciLat: number, otherFa: number, otherLat: number): SmsTariff => ({ lineType, mciFa, mciLat, otherFa, otherLat })
  return [
    T('1000', 2000, 5000, 2200, 5500), T('2000', 2000, 5000, 2200, 5500), T('3000', 2000, 5000, 2200, 5500),
    T('50001-50009', 2000, 5000, 2200, 5500), T('50004', 2000, 5000, 2200, 5500), T('BTS', 2000, 5000, 2200, 5500),
    T('998', 2000, 5000, 2200, 5500), T('9000', 2000, 5000, 2200, 5500), T('9000clubs', 4000, 10000, 4400, 11000),
    T('Samantel', 2000, 5000, 2200, 5500), T('EVENT', 4000, 10000, 4400, 11000), T('bale', 2700, 6750, 2700, 6750),
    T('پیام صوتی', 2125, 5312.5, 2125, 5312.5),
  ]
}
function defaults(): SmsCostConfig {
  return { profitPercent: 100, roundTo: 1000, refLine: '3000', refOperator: 'mci', refLang: 'fa', tariffs: seedTariffs(), v: SEED_V }
}
function load(): SmsCostConfig {
  if (existsSync(FILE)) {
    try { const d = JSON.parse(readFileSync(FILE, 'utf-8')) as SmsCostConfig; if (d && d.v === SEED_V) return { ...defaults(), ...d, tariffs: d.tariffs?.length ? d.tariffs : seedTariffs() } } catch {}
  }
  const d = defaults(); save(d); return d
}
function save(c: SmsCostConfig) { c.v = SEED_V; writeFileSync(FILE, JSON.stringify(c, null, 2), 'utf-8') }

export function getSmsCostConfig(): SmsCostConfig { return load() }
export function setSmsCostConfig(patch: Partial<SmsCostConfig>): SmsCostConfig {
  const c = load()
  if (patch.profitPercent !== undefined) c.profitPercent = Math.max(0, Number(patch.profitPercent) || 0)
  if (patch.roundTo !== undefined) c.roundTo = Math.max(1, Number(patch.roundTo) || 1)
  if (patch.refLine !== undefined) c.refLine = String(patch.refLine)
  if (patch.refOperator !== undefined) c.refOperator = patch.refOperator === 'other' ? 'other' : 'mci'
  if (patch.refLang !== undefined) c.refLang = patch.refLang === 'lat' ? 'lat' : 'fa'
  if (Array.isArray(patch.tariffs)) c.tariffs = patch.tariffs.map(t => ({ lineType: String(t.lineType || '').trim(), mciFa: Number(t.mciFa) || 0, mciLat: Number(t.mciLat) || 0, otherFa: Number(t.otherFa) || 0, otherLat: Number(t.otherLat) || 0 })).filter(t => t.lineType)
  save(c); return c
}
// هزینهٔ خامِ هر پیامکِ مرجع (ریال)
export function smsCostRial(): number {
  const c = load()
  const t = c.tariffs.find(x => x.lineType === c.refLine) || c.tariffs[0]
  if (!t) return 0
  return c.refOperator === 'other' ? (c.refLang === 'lat' ? t.otherLat : t.otherFa) : (c.refLang === 'lat' ? t.mciLat : t.mciFa)
}
// قیمتِ فروشِ هر پیامک (تومان) = هزینهٔ ریالی ÷۱۰ × (۱ + درصدِ سود/۱۰۰)
export function smsSellPriceToman(): number {
  return (smsCostRial() / 10) * (1 + (Number(load().profitPercent) || 0) / 100)
}
