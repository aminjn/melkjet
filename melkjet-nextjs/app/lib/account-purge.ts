// فاز ۲۹۸ه — حذفِ «کاملِ» دادهٔ یک کاربر (cascade حذفِ حساب).
// فیدبک: «اکانتِ یک انبوه‌ساز را پاک کردم ولی سایت‌سازش پاک نشد — وقتی کاربر پاک می‌شود باید
// همه‌چیزش کامل پاک شود». ریشه: deleteAccount فقط رکوردِ حساب را حذف می‌کرد و merge هم
// sites-store را پوشش نمی‌داد، پس سایت/پروفایل/آگهی‌ها/داشبوردها یتیم می‌ماندند.
// این orchestrator همهٔ استورهای دادهٔ کاربر را جارو می‌کند. هر بخش best-effort و مستقل است
// (قانونِ شمارهٔ یک: شکستِ یک استور بقیه را متوقف نمی‌کند و لاگ می‌شود) — چون این عملیات پس از
// حذفِ خودِ حساب اجرا می‌شود و نباید نیمه‌کاره بماند.

import { FA_DIGITS, faDigit } from './digits'

export interface PurgeSummary {
  phone: string
  sites?: number
  profile?: boolean
  advisorListings?: number
  advisorPublic?: number
  divar?: boolean
  publicListings?: number
  leads?: number
  tasks?: number
  workflows?: number
  builder?: boolean
  materials?: boolean
  prefs?: boolean
  reviewsAbout?: number
  reviewsByUser?: number
  autositeMeta?: boolean
  errors: string[]
}

export async function purgeUserData(phone: string): Promise<PurgeSummary> {
  const p = String(phone || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')
  const out: PurgeSummary = { phone: p, errors: [] }
  if (!p) { out.errors.push('شمارهٔ نامعتبر'); return out }
  const run = async (label: string, fn: () => Promise<void> | void) => {
    try { await fn() } catch (e) {
      const msg = `${label}: ${String((e as Error)?.message || e).slice(0, 120)}`
      out.errors.push(msg)
      console.error(`[account-purge] ${msg}`)
    }
  }

  // ۱) سایتِ اختصاصی (ریشهٔ گزارش) + متای سایت‌سازِ خودکار
  await run('sites', async () => { const { deleteSitesByOwner } = await import('./sites-store'); out.sites = await deleteSitesByOwner(p) })
  await run('autosite_meta', async () => { const { purgeAutoSiteMeta } = await import('./auto-site'); out.autositeMeta = await purgeAutoSiteMeta(p) })
  // ۲) پروفایلِ عمومیِ دایرکتوری
  await run('profile', async () => { const { deleteProfile } = await import('./profile-store'); out.profile = deleteProfile(p) })
  // ۳) دادهٔ مشاور (فایل‌ها/لیدها) + آگهی‌های عمومیِ منتشرشده‌اش
  await run('advisor', async () => { const { deleteAdvisorData } = await import('./advisor-store'); const r = await deleteAdvisorData(p); out.advisorListings = r.listings; out.advisorPublic = r.publicDeleted })
  await run('divar', async () => { const { deleteAdvisorDivar } = await import('./advisor-divar-store'); out.divar = deleteAdvisorDivar(p) })
  // ۴) بقیهٔ آگهی‌های عمومیِ متعلق به این شماره (ثبتِ دستی/اسکرپی)
  await run('public_listings', async () => { const { deleteListingsByOwnerPhone } = await import('./scraper-store'); out.publicListings = await deleteListingsByOwnerPhone(p) })
  // ۵) داشبوردهای نقش‌محور
  await run('builder', async () => { const { deleteBuilderData } = await import('./builder-store'); out.builder = await deleteBuilderData(p) })
  await run('materials', async () => { const { deleteMaterialsData } = await import('./materials-store'); out.materials = await deleteMaterialsData(p) })
  // ۶) دادهٔ خصوصیِ ابزارها
  await run('leads', async () => { const { deleteLeadsByOwner } = await import('./leads-store'); out.leads = await deleteLeadsByOwner(p) })
  await run('crm', async () => { const { deleteTasksByOwner } = await import('./crm-store'); out.tasks = await deleteTasksByOwner(p) })
  await run('workflow', async () => { const { deleteWorkflowsByOwner } = await import('./workflow-store'); out.workflows = await deleteWorkflowsByOwner(p) })
  await run('prefs', async () => { const { deletePrefs } = await import('./user-store'); out.prefs = await deletePrefs(p) })
  // ۷) نظرها (دربارهٔ او + نوشته‌شده توسطِ او)
  await run('reviews', async () => { const { deleteReviewsByOwner, deleteReviewsByAuthor } = await import('./reviews-store'); out.reviewsAbout = deleteReviewsByOwner(p); out.reviewsByUser = deleteReviewsByAuthor(p) })

  console.log(`[account-purge] ${p} → sites=${out.sites ?? 0} profile=${out.profile ?? false} advisor=${out.advisorListings ?? 0}(+${out.advisorPublic ?? 0} public) publicListings=${out.publicListings ?? 0} builder=${out.builder ?? false} materials=${out.materials ?? false} leads=${out.leads ?? 0} tasks=${out.tasks ?? 0} workflows=${out.workflows ?? 0} reviews=${(out.reviewsAbout ?? 0) + (out.reviewsByUser ?? 0)} errors=${out.errors.length}`)
  return out
}
