// ⏰ فاز ۱۷۳ — یادآورِ خودکارِ CRM مرکزیِ پرسنل (فیدبک: «اگر پیگیری ثبت می‌کنن باید خودش
// یادآورِ اتومات ثبت بشه و بهشون یادآوری کنه»): کرونِ اینستنسِ صفر هر تیک، پیگیری‌ها و وظایفِ
// سررسیدشده را «اتمیک» برمی‌دارد (claimDueReminders — هر یادآور فقط یک‌بار) و به خودِ پرسنلِ
// ثبت‌کننده می‌رساند: پوش‌نوتیفیکیشنِ مرورگر + پیامکِ واقعی (خطِ خدماتی). هیچ دادهٔ ساختگی.

import { claimDueReminders } from './staff-crm-store'

export async function runStaffReminders(now = Date.now()): Promise<number> {
  const due = await claimDueReminders(now)
  if (!due.length) return 0
  const { getAccount } = await import('./account-store')
  const { listForPhone, removeByEndpoint } = await import('./push-store')
  const { sendPush } = await import('./web-push')
  const { sendServiceSms } = await import('./sms')
  let sent = 0
  for (const r of due) {
    const cust = r.customerPhone ? getAccount(r.customerPhone) : null
    const who = cust?.name ? `${cust.name} (${r.customerPhone})` : (r.customerPhone || 'وظیفهٔ تیمی')
    const body = `${who} — ${r.text.slice(0, 120)}`
    // پوشِ مرورگر (اگر پرسنل اجازه داده باشد)
    for (const sub of listForPhone(r.staffPhone)) {
      try {
        const st = await sendPush(sub, { title: r.source === 'act' ? '⏰ یادآورِ پیگیریِ مشتری' : '⏰ یادآورِ وظیفهٔ تیمی', body, url: '/admin', tag: 'mj-staff-crm' })
        if (st === 404 || st === 410) removeByEndpoint(sub.endpoint)
      } catch { /* یک اشتراکِ خراب بقیه را متوقف نکند */ }
    }
    // پیامکِ واقعی به خودِ پرسنل — پیگیریِ مشتری هیچ‌وقت فراموش نشود
    try { await sendServiceSms(r.staffPhone, `⏰ یادآورِ ملک‌جت: ${body}\nپنلِ CRM را باز کن.`, 'یادآورِ CRM پرسنل') } catch { /* بی‌صدا */ }
    sent++
  }
  return sent
}
