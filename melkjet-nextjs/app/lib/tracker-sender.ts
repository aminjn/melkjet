import { getAdminData } from './admin-store'
import { listDuePending, markSent } from './tracker-store'
import { shecanRequest } from './shecan-https'
import { shortenUrl, linkVarName } from './shortener'
import { createLink, setLinkMeta } from './tracker-links-store'

// صفِ پیامکِ هدفمندِ ترکر را پردازش می‌کند (توسطِ cron هر چند دقیقه).
// ارسالِ سریع از مسیرِ پترن (اگر تنظیم شده)، وگرنه ارسالِ تکیِ معمولی.
export async function processTrackerQueue(now = Date.now()): Promise<{ due: number; sent: number }> {
  const admin = getAdminData()
  const t = admin.tracker
  if (!t?.enabled) return { due: 0, sent: 0 }
  const apiKey = process.env.IPPANEL_API_KEY || admin.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || admin.ippanel?.sender
  if (!apiKey || !sender) return { due: 0, sent: 0 }

  const due = listDuePending(now)
  let sent = 0
  const patternCode = (t.pattern || '').trim()
  const patternVar = (t.patternVar || 'message').trim() || 'message'

  for (const { vid, phone, pending } of due) {
    const recipient = String(phone).replace(/\D/g, '')
    if (!/^09\d{9}$/.test(recipient)) { markSent(vid, false); continue }
    // لینکِ آگهی را با nxal کوتاه کن (id برای آمار ذخیره می‌شود).
    let message = pending.message
    let shortLink = ''
    if (pending.url && /^https?:\/\//.test(pending.url)) {
      try {
        const link = createLink({ dest: pending.url, title: pending.title, phone: recipient, channel: 'tracker' })
        const sh = await shortenUrl(pending.url)
        if (sh) {
          setLinkMeta(link.code, { shortUrl: sh.shortUrl, linkId: sh.id })
          shortLink = sh.shortUrl
          message = message.includes(pending.url) ? message.split(pending.url).join(sh.shortUrl) : `${message} ${sh.shortUrl}`
        }
      } catch { /* اگر کوتاه‌کننده در دسترس نبود، همان پیام را بفرست */ }
    }
    try {
      let url: string, body: any
      if (patternCode) {
        url = 'https://api2.ippanel.com/api/v1/sms/pattern/normal/send'
        const variable: any = { [patternVar]: message }
        // اگر متغیرِ مجزای لینک تنظیم باشد، لینکِ کوتاه را در آن بفرست و متغیرِ متن را بدونِ لینک بگذار
        const lv = linkVarName()
        if (lv && shortLink) { variable[lv] = shortLink; variable[patternVar] = pending.message }
        body = { code: patternCode, sender, recipient, variable }
      } else {
        url = 'https://api2.ippanel.com/api/v1/sms/send/webservice/single'
        body = { sender, recipient: [recipient], message, description: { summary: 'بازاریابی مجدد ملک‌جت', count_recipient: '1' } }
      }
      const res = await shecanRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' }, body: JSON.stringify(body), timeout: 20000 })
      let parsed: any = null; try { parsed = JSON.parse(res.body) } catch {}
      const okStatus = res.status >= 200 && res.status < 300
      const metaOk = parsed?.meta?.status !== false && !/"status"\s*:\s*"?error"?/i.test(res.body)
      const ok = okStatus && metaOk
      markSent(vid, ok)
      if (ok) sent++
    } catch { markSent(vid, false) }
  }
  return { due: due.length, sent }
}
