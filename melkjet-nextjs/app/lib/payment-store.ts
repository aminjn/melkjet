import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// استورِ درگاه‌های پرداخت + حالتِ قیمت‌گذاری. همه‌چیز از پنلِ سوپرادمین قابلِ مدیریت.
// «کارت‌به‌کارت» یک درگاهِ دستی است: اطلاعاتِ کارت/حساب/شبا به کاربر نشان داده می‌شود،
// کاربر کدِ رهگیری را وارد می‌کند، سفارش «در انتظارِ تأیید» می‌شود و سوپرادمین تأیید می‌کند.
const FILE = join(process.cwd(), '.payment-data.json')

export type PricingMode = 'startup' | 'growth' | 'scale' | 'enterprise'
export interface Gateway {
  id: string
  type: 'card2card' | 'zarinpal' | 'wallet' | 'custom'
  label: string
  enabled: boolean
  order: number
  // کارت‌به‌کارت:
  cardNumber?: string
  iban?: string          // شمارهٔ شبا
  accountNumber?: string // شمارهٔ حساب
  holderName?: string    // نامِ صاحبِ حساب
  bank?: string          // نامِ بانک
  note?: string          // توضیح به کاربر (مثلاً «پس از واریز، کدِ رهگیری را وارد کنید»)
}
export interface PaymentConfig { pricingMode: PricingMode; gateways: Gateway[] }

function gid() { return 'gw_' + randomBytes(4).toString('hex') }
function defaults(): PaymentConfig {
  return {
    pricingMode: 'startup',
    gateways: [
      { id: gid(), type: 'card2card', label: 'کارت به کارت', enabled: true, order: 0, cardNumber: '', iban: '', accountNumber: '', holderName: '', bank: '', note: 'مبلغ را به کارتِ زیر واریز و سپس کدِ رهگیری/چهار رقمِ آخرِ کارت را وارد کنید.' },
      { id: gid(), type: 'zarinpal', label: 'درگاهِ آنلاین (زرین‌پال)', enabled: false, order: 1 },
      { id: gid(), type: 'wallet', label: 'کیفِ پولِ ملک‌جت', enabled: false, order: 2 },
    ],
  }
}
function load(): PaymentConfig {
  if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { pricingMode: d.pricingMode || 'startup', gateways: Array.isArray(d.gateways) ? d.gateways : defaults().gateways } } catch {} }
  const d = defaults(); save(d); return d
}
function save(c: PaymentConfig) { writeFileSync(FILE, JSON.stringify(c, null, 2), 'utf-8') }

export function getPaymentConfig(): PaymentConfig { return load() }

export function setPricingMode(mode: PricingMode): PaymentConfig {
  const c = load(); c.pricingMode = (['startup', 'growth', 'scale', 'enterprise'] as const).includes(mode) ? mode : c.pricingMode; save(c); return c
}
// جایگزینیِ کاملِ فهرستِ درگاه‌ها (از پنل)
export function setGateways(rows: Partial<Gateway>[]): Gateway[] {
  const c = load()
  c.gateways = (rows || []).map((r, i) => ({
    id: r.id && String(r.id).startsWith('gw_') ? String(r.id) : gid(),
    type: (['card2card', 'zarinpal', 'wallet', 'custom'] as const).includes(r.type as any) ? r.type as any : 'custom',
    label: String(r.label || '').trim() || 'درگاه',
    enabled: r.enabled !== false,
    order: Number(r.order) || i,
    cardNumber: str(r.cardNumber, 32), iban: str(r.iban, 34), accountNumber: str(r.accountNumber, 32),
    holderName: str(r.holderName, 60), bank: str(r.bank, 40), note: str(r.note, 300),
  })).sort((a, b) => a.order - b.order)
  save(c); return c.gateways
}
function str(v: any, max: number) { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, max) : undefined }

// درگاه‌های فعال برای نمایش در checkout (کاربرِ واردشده)
export function enabledGateways(): Gateway[] { return load().gateways.filter(g => g.enabled).sort((a, b) => a.order - b.order) }
