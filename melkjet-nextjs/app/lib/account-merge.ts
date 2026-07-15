// ── فاز ۱۴۲ — ادغامِ دو حسابِ یک نفر (فیدبک: «دیوار احراز نمی‌کند؛ یک نفر دو شماره دارد») ──
// همه‌چیز به حسابِ «اصلی» (primary) می‌رود و حسابِ دوم تعلیق می‌شود (تاریخچه می‌ماند، ورود نه):
//  - حساب: هویتِ احرازشدهٔ شاهکار + نام/نقش + پلنِ فعالِ دیرپاتر (mergeAccounts)
//  - دادهٔ مشاور: فایل‌ها/لیدها/قرارها/کمیسیون‌ها/آمار + تنظیمات و تاریخچهٔ سینکِ دیوار
//  - مالکیتِ آگهی‌های عمومی (__ownerPhone) + لیدهای Sales OS + وظایفِ CRM + پروفایلِ عمومی
// adminSections (دسترسیِ پرسنلی) عمداً هرگز منتقل نمی‌شود.

import { mergeAccounts, isProtectedAccount, getAccount } from './account-store'

export interface MergeSummary {
  ok: boolean; error?: string
  advisorListings?: number; advisorLeads?: number; publicListings?: number
  leads?: number; tasks?: number; divarSources?: number
}

export async function mergeUserAccounts(primary: string, secondary: string): Promise<MergeSummary> {
  const p = String(primary || '').replace(/\D/g, ''); const s = String(secondary || '').replace(/\D/g, '')
  if (!p || !s || p === s) return { ok: false, error: 'دو شمارهٔ متفاوت لازم است' }
  if (!getAccount(p) || !getAccount(s)) return { ok: false, error: 'یکی از دو حساب پیدا نشد' }
  // حسابِ محافظت‌شده (سوپرادمین/پرسنل) هرگز «ادغام‌شونده» نمی‌شود — تعلیق و انتقالِ داده‌اش ممنوع.
  if (isProtectedAccount(s)) return { ok: false, error: 'حسابِ محافظت‌شده (سوپرادمین/پرسنل) قابلِ ادغام‌شدن نیست' }

  const acc = mergeAccounts(p, s)
  if (!acc.ok) return { ok: false, error: acc.error }

  const out: MergeSummary = { ok: true }
  try { const { mergeAdvisorData } = await import('./advisor-store'); const r = await mergeAdvisorData(s, p); out.advisorListings = r.listings; out.advisorLeads = r.leads } catch {}
  try { const { mergeDivarData } = await import('./advisor-divar-store'); out.divarSources = mergeDivarData(s, p) } catch {}
  try { const { reassignListingOwnerPhone } = await import('./scraper-store'); out.publicListings = await reassignListingOwnerPhone(s, p) } catch {}
  try { const { reassignLeadsOwner } = await import('./leads-store'); out.leads = await reassignLeadsOwner(s, p) } catch {}
  try { const { reassignTasksOwner } = await import('./crm-store'); out.tasks = await reassignTasksOwner(s, p) } catch {}
  try { const { mergeProfiles } = await import('./profile-store'); mergeProfiles(s, p) } catch {}
  return out
}
