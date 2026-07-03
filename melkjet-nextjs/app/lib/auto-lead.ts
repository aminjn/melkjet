import { getAccount, dashForRole } from './account-store'
import { addLead as addGenericLead } from './leads-store'
import { addLead as addAdvisorLead } from './advisor-store'
import { addLead as addAgencyLead } from './agency-store'
import { addInquiry as addOwnerInquiry, listProperties } from './owner-store'

// ساختِ خودکارِ لید در CRMِ صاحبِ آگهی/محصول — بر اساسِ نقشش در storeِ درست ثبت می‌شود.
// مثلاً وقتی خریدار دربارهٔ یک ملک پیام می‌دهد، برای مشاور/آژانس/مالکِ آن، لیدِ همان ملک ساخته می‌شود.
//   مشاور  (/pros)     → advisor-store   (تبِ «لیدها»)
//   آژانس  (/agency)   → agency-store    (تبِ «لیدها»)
//   مالک   (/owner)    → owner-store     («استعلام»، گره‌خورده به همان ملک)
//   سازنده (/builder)  → leads-store     (CRMِ عمومی که در پنلش embed شده)
//   مصالح  (/materials)→ leads-store     (علاوه بر «استعلامِ ویترین» که جداگانه ساخته می‌شود)
function norm(s: string) { return (s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() }

export function createAutoLead(ownerPhone: string, input: {
  name: string; phone?: string; need?: string; note?: string; source?: string; listingTitle?: string
}): void {
  if (!ownerPhone || !input?.name) return
  try {
    const dash = dashForRole(getAccount(ownerPhone)?.role)
    const base = { name: input.name, phone: input.phone, need: input.need, note: input.note, source: input.source || 'خودکار', stage: 'new' as const }
    if (dash === '/pros') addAdvisorLead(ownerPhone, base)
    else if (dash === '/agency') addAgencyLead(ownerPhone, base)
    else if (dash === '/owner') {
      // پنلِ مالک لید ندارد؛ معادلش «استعلام» است که به یک ملک گره می‌خورد.
      const title = norm(input.listingTitle || input.need || '')
      const prop = title
        ? listProperties(ownerPhone).find(p => { const t = norm(p.title); return t === title || t.includes(title) || title.includes(t) })
        : null
      addOwnerInquiry(ownerPhone, { propertyId: prop?.id || '', name: input.name, phone: input.phone, message: input.note })
    }
    else addGenericLead(ownerPhone, { name: base.name, phone: base.phone, need: base.need, note: base.note, stage: 'new' })
  } catch { /* ساختِ لید نباید مسیرِ اصلی را بشکند */ }
}
