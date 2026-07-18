import { generateOTP, setOTP, canSendOTP, RESEND_COOLDOWN_S } from './otp-store'
import { getAdminData } from './admin-store'
import { shecanRequest, bustDns, type ShecanResp } from './shecan-https'

// ارسالِ کدِ OTP با IPPanel (پترن). اگر پیامک پیکربندی نشده باشد، کد را برای حالتِ توسعه برمی‌گرداند.
// مهلتِ ارسالِ مجدد «سمتِ سرور» چک می‌شود (رفرشِ صفحه دیگر دورش نمی‌زند — فیدبکِ کاربر: «۲۰ پیامک آمد»)
// و ذخیرهٔ کد «بعد از» ارسالِ موفق است تا خطای سرویسِ پیامک، مهلتِ کاربر را نسوزاند.
// retryIn به کلاینت برمی‌گردد تا تایمرِ UI بعد از رفرش هم از سرور تنظیم شود.
//
// فاز ۱۷۰ (فیدبکِ پرود: «بار اول عموماً ارور می‌ده، بار دوم کد میاد و کلی طول می‌کشه»):
// قبلاً یک تلاشِ ۱۵ثانیه‌ایِ بدونِ retry بود — DNSِ سردِ اولین درخواستِ هر اینستنس همه‌اش را می‌سوزاند.
// حالا: ۲ تلاشِ ۷ثانیه‌ای در همان یک درخواست؛ بینِ تلاش‌ها کشِ DNS باطل می‌شود (شاید IP مرده باشد)؛
// خطای «قطعیِ» سرویس (پترن/کلیدِ غلط — 4xx/meta) هرگز retry نمی‌شود تا پیامکِ دوباره نرود.
// DNS هم در بوتِ هر اینستنس گرم می‌شود (instrumentation) تا اولین کاربرِ واقعی هزینه‌اش را ندهد.

const SMS_HOST = 'api2.ippanel.com'
const SMS_URL = `https://${SMS_HOST}/api/v1/sms/pattern/normal/send`
const ATTEMPT_TIMEOUT_MS = 7000
const MAX_TRIES = 2

export interface SmsPatternCfg { apiKey: string; sender: string; pattern: string; patternVar: string }
export type SmsSendResult = { ok: true } | { ok: false; permanent: boolean; error: string }
type RequestFn = (url: string, init: { method: string; headers: Record<string, string>; body?: string; timeout?: number }) => Promise<ShecanResp>

// یک تلاشِ تکی (requestFn تزریق‌پذیر برای تستِ یونیت): خطای شبکه/تایم‌اوت/۵xx = گذرا؛ ردِ خودِ سرویس = قطعی.
export async function sendPatternOnce(cfg: SmsPatternCfg, phone: string, code: string, request: RequestFn = shecanRequest): Promise<SmsSendResult> {
  let res: ShecanResp
  try {
    res = await request(SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey, accept: 'application/json' },
      body: JSON.stringify({ code: cfg.pattern, sender: cfg.sender, recipient: phone, variable: { [cfg.patternVar]: code } }),
      timeout: ATTEMPT_TIMEOUT_MS,
    })
  } catch (e: any) {
    return { ok: false, permanent: false, error: `اتصال به سرویس پیامک ناموفق: ${e?.message || 'خطا'}` }
  }
  if (res.status >= 500 || res.status === 0) return { ok: false, permanent: false, error: `سرویس پیامک: HTTP ${res.status}` }
  let parsed: any = null; try { parsed = JSON.parse(res.body) } catch {}
  const okStatus = res.status >= 200 && res.status < 300
  const metaOk = parsed?.meta?.status !== false && !/"status"\s*:\s*"?error"?/i.test(res.body)
  if (!okStatus || !metaOk) {
    const detail = parsed?.meta?.message || parsed?.error_message || parsed?.message || res.body.slice(0, 240) || `HTTP ${res.status}`
    return { ok: false, permanent: true, error: `سرویس پیامک: ${detail}` }
  }
  return { ok: true }
}

// تلاش با retry — فقط خطاهای گذرا؛ خطای قطعی همان بار اول برمی‌گردد (پیامکِ تکراری ممنوع).
export async function sendPatternWithRetry(cfg: SmsPatternCfg, phone: string, code: string, request: RequestFn = shecanRequest, onTransient: () => void = () => bustDns(SMS_HOST)): Promise<SmsSendResult> {
  let last: SmsSendResult = { ok: false, permanent: false, error: 'ارسال انجام نشد' }
  for (let t = 0; t < MAX_TRIES; t++) {
    last = await sendPatternOnce(cfg, phone, code, request)
    if (last.ok || last.permanent) return last
    onTransient()
  }
  return last
}

export async function sendOtpSms(phone: string): Promise<{ ok: boolean; dev?: boolean; code?: string; error?: string; retryIn?: number }> {
  const can = await canSendOTP(phone)
  if (!can.ok) return { ok: false, error: `کد قبلاً ارسال شده و هنوز معتبر است — ${can.retryIn.toLocaleString('fa-IR')} ثانیهٔ دیگر می‌توانی دوباره درخواست بدهی.`, retryIn: can.retryIn }
  const code = generateOTP()
  const a = getAdminData()
  const apiKey = process.env.IPPANEL_API_KEY || a.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || a.ippanel?.sender
  const pattern = process.env.IPPANEL_PATTERN || a.ippanel?.pattern
  const patternVar = (a.ippanel?.patternVar || 'code').trim() || 'code'
  if (!apiKey || !sender || !pattern) {
    await setOTP(phone, code)
    console.log(`[DEV OTP] ${phone} → ${code}`)
    return { ok: true, dev: true, code, retryIn: RESEND_COOLDOWN_S }
  }
  const t0 = Date.now()
  const r = await sendPatternWithRetry({ apiKey, sender, pattern, patternVar }, phone, code)
  console.log(`[otp] send ${r.ok ? 'ok' : 'FAIL'} in ${Date.now() - t0}ms${r.ok ? '' : ` (${(r as any).error})`}`)   // تشخیصِ کندی در pm2 logs
  if (!r.ok) return { ok: false, error: r.error }
  await setOTP(phone, code)   // فقط بعدِ ارسالِ موفق — تا شکستِ پیامک مهلتِ resend را نسوزاند
  return { ok: true, retryIn: RESEND_COOLDOWN_S }
}
