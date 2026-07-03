import { getAccount, dashForRole } from './account-store'
import { addLead as addGenericLead } from './leads-store'
import { addLead as addAdvisorLead } from './advisor-store'
import { addLead as addAgencyLead } from './agency-store'

// ساختِ خودکارِ لید در CRMِ صاحبِ آگهی/محصول — بر اساسِ نقشش در storeِ درست ثبت می‌شود.
// مثلاً وقتی خریدار دربارهٔ یک ملک پیام می‌دهد، برای مشاور/آژانس/مالکِ آن، لیدِ همان ملک ساخته می‌شود.
export function createAutoLead(ownerPhone: string, input: { name: string; phone?: string; need?: string; note?: string; source?: string }): void {
  if (!ownerPhone || !input?.name) return
  try {
    const dash = dashForRole(getAccount(ownerPhone)?.role)
    const base = { name: input.name, phone: input.phone, need: input.need, note: input.note, source: input.source || 'خودکار', stage: 'new' as const }
    if (dash === '/pros') addAdvisorLead(ownerPhone, base)
    else if (dash === '/agency') addAgencyLead(ownerPhone, base)
    else addGenericLead(ownerPhone, { name: base.name, phone: base.phone, need: base.need, note: base.note, stage: 'new' })
  } catch { /* ساختِ لید نباید مسیرِ اصلی را بشکند */ }
}
