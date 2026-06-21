import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'

// درگاه پرداخت زرین‌پال (REST v4). داخلی است؛ از طریق shecan-https درخواست می‌زنیم
// تا DNS/خروجی محدودِ سرور مشکل‌ساز نشود. مبلغ‌ها بر حسب «ریال» است (تومان×۱۰).

function cfg() {
  const z = getAdminData().zarinpal
  if (!z?.merchantId) return null
  const base = z.sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com'
  return { merchantId: z.merchantId, base }
}

export function zarinpalConfigured(): boolean { return !!cfg() }

export function startPayUrl(authority: string, sandbox?: boolean): string {
  const base = sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com'
  return `${base}/pg/StartPay/${authority}`
}

export interface ReqResult { ok: boolean; authority?: string; url?: string; error?: string }

// مبلغ بر حسب تومان داده می‌شود؛ به ریال تبدیل می‌کنیم.
export async function requestPayment(amountToman: number, description: string, callbackUrl: string, mobile?: string): Promise<ReqResult> {
  const c = cfg(); if (!c) return { ok: false, error: 'درگاه پرداخت تنظیم نشده است' }
  const body = JSON.stringify({
    merchant_id: c.merchantId,
    amount: Math.max(1000, Math.round(amountToman * 10)),
    callback_url: callbackUrl,
    description: description.slice(0, 250),
    metadata: mobile ? { mobile } : undefined,
  })
  try {
    const res = await shecanRequest(`${c.base}/pg/v4/payment/request.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', accept: 'application/json' }, body, timeout: 20000,
    })
    const d = JSON.parse(res.body)
    const code = d?.data?.code
    if (code === 100 && d?.data?.authority) {
      const sandbox = c.base.includes('sandbox')
      return { ok: true, authority: d.data.authority, url: startPayUrl(d.data.authority, sandbox) }
    }
    const msg = (Array.isArray(d?.errors) ? d.errors[0]?.message : d?.errors?.message) || d?.data?.message || `کد ${code}`
    return { ok: false, error: `زرین‌پال: ${msg}` }
  } catch (e: any) {
    return { ok: false, error: `اتصال به زرین‌پال ناموفق: ${e?.message || 'خطا'}` }
  }
}

export interface VerifyResult { ok: boolean; refId?: string; error?: string }

export async function verifyPayment(authority: string, amountToman: number): Promise<VerifyResult> {
  const c = cfg(); if (!c) return { ok: false, error: 'درگاه تنظیم نشده' }
  const body = JSON.stringify({ merchant_id: c.merchantId, amount: Math.max(1000, Math.round(amountToman * 10)), authority })
  try {
    const res = await shecanRequest(`${c.base}/pg/v4/payment/verify.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', accept: 'application/json' }, body, timeout: 20000,
    })
    const d = JSON.parse(res.body)
    const code = d?.data?.code
    if (code === 100 || code === 101) return { ok: true, refId: String(d?.data?.ref_id || '') }
    const msg = (Array.isArray(d?.errors) ? d.errors[0]?.message : d?.errors?.message) || `کد ${code}`
    return { ok: false, error: `تأیید پرداخت ناموفق: ${msg}` }
  } catch (e: any) {
    return { ok: false, error: `اتصال به زرین‌پال ناموفق: ${e?.message || 'خطا'}` }
  }
}
