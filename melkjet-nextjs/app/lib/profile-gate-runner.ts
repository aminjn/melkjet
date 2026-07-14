import { listAccounts, setSuspended, setProfileWarn, SUPER_ADMIN_PHONE } from './account-store'
import { getProfile, completeness } from './profile-store'
import { getAdminData } from './admin-store'
import { dashForRoleId } from './role-store'
import { shecanRequest } from './shecan-https'

// fullText برای حالتِ آزاد (خطِ تبلیغاتی)؛ varValue مقدارِ کوتاهِ متغیرِ پترن (خطِ خدماتی).
async function sendGateSms(phone: string, fullText: string, varValue: string, cfg: any) {
  const admin = getAdminData()
  const apiKey = process.env.IPPANEL_API_KEY || admin.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || admin.ippanel?.sender
  if (!apiKey || !sender) return
  const recipient = String(phone).replace(/\D/g, '')
  if (!/^09\d{9}$/.test(recipient)) return
  const patternCode = (cfg.pattern || '').trim()
  const patternVar = (cfg.patternVar || 'message').trim() || 'message'
  try {
    let url: string, body: any
    if (patternCode) { const { linkVarName, trackAndShorten, firstUrl, siteBase } = await import('./shortener'); const variable: any = { [patternVar]: varValue }; const lv = linkVarName(); if (lv) { const u = firstUrl(fullText); variable[lv] = u ? await trackAndShorten(u, { channel: 'alert', phone: recipient }) : siteBase() } url = 'https://api2.ippanel.com/api/v1/sms/pattern/normal/send'; body = { code: patternCode, sender, recipient, variable } }
    else { const { shortenLinksInText } = await import('./shortener'); const msg = await shortenLinksInText(fullText, { channel: 'alert', phone: recipient }); url = 'https://api2.ippanel.com/api/v1/sms/send/webservice/single'; body = { sender, recipient: [recipient], message: msg, description: { summary: 'تکمیل پروفایل ملک‌جت', count_recipient: '1' } } }
    await shecanRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' }, body: JSON.stringify(body), timeout: 20000 })
  } catch { /* بی‌صدا */ }
}

// چرخهٔ سامانهٔ تکمیلِ پروفایل: پروفایل‌های ناقص را هشدارِ پیامکی می‌دهد و پس از مهلت، پنل را معلق می‌کند.
export async function processProfileGate(now = Date.now()): Promise<{ checked: number; warned: number; suspended: number }> {
  const cfg = getAdminData().profileGate
  if (!cfg?.enabled) return { checked: 0, warned: 0, suspended: 0 }
  const minPercent = cfg.minPercent ?? 70
  const graceMs = Math.max(0, (cfg.graceDays ?? 3)) * 86400000
  let warned = 0, suspended = 0, checked = 0
  for (const a of listAccounts()) {
    if (a.phone === SUPER_ADMIN_PHONE || !a.role) continue
    if (dashForRoleId(a.role) === '/buyer') continue   // کاربرانِ عادی پروفایلِ کسب‌وکار ندارند
    if (a.gateExempt) continue   // فاز ۱۲۷: رفعِ تعلیقِ دستیِ ادمین = معافیتِ ماندگار — دیگر نه هشدار، نه تعلیقِ دوباره
    checked++
    const pct = completeness(getProfile(a.phone))
    if (pct >= minPercent) {
      if (a.suspended || a.profileWarnAt) setSuspended(a.phone, false)   // کامل شد → رفعِ تعلیق/هشدار
      continue
    }
    if (!a.profileWarnAt) {
      setProfileWarn(a.phone, now)
      await sendGateSms(a.phone, `کاربرِ گرامیِ ملک‌جت، پروفایلِ کسب‌وکارِ شما ناقص است (${Math.round(pct)}٪). لطفاً ظرفِ ${cfg.graceDays ?? 3} روز آن را کامل کنید، در غیرِ این صورت پنلِ شما معلق می‌شود.`, `ناقص ${Math.round(pct)} درصد`, cfg)
      warned++
    } else if (!a.suspended && now - a.profileWarnAt > graceMs) {
      setSuspended(a.phone, true)
      await sendGateSms(a.phone, 'پنلِ شما به‌دلیلِ تکمیل‌نشدنِ پروفایل معلق شد. برای رفعِ تعلیق، وارد پنل شوید و پروفایلِ کسب‌وکار را کامل کنید.', 'معلق به‌دلیلِ نقصِ پروفایل', cfg)
      suspended++
    }
  }
  return { checked, warned, suspended }
}
