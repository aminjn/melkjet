// گیتِ مرکزیِ پلن (فاز ۵۱ — فیدبک: «پلن‌ها اعمال نمی‌شود؛ هر کسی وارد می‌شود همه‌چیز دارد»).
// یک منبعِ واحد برای «این کاربر به این ماژول دسترسی دارد؟» — همهٔ APIهای ابزار/داشبورد از همین می‌پرسند.
// قواعد:
//  • دسترسیِ مؤثر فقط از «پلنِ فعالِ» کاربر می‌آید (activePlan — انقضادار)؛ بدونِ پلن → پلنِ رایگانِ همان داشبورد.
//  • سوپرادمین همیشه معاف است.
//  • کلیدِ enforce (پنلِ پلن‌ها) برای رول‌اوتِ امن: خاموش = هیچ قفلی (رفتارِ قبلی)، روشن = اعمالِ واقعی.
import { getAccount, activePlan } from './account-store'
import { listRoles, PERMISSIONS } from './role-store'
import { getPlan, listActive, planEnforcement, QUOTA_KEYS, type Plan } from './plan-store'

export interface PlanAccess {
  phone: string; isAdmin: boolean; enforce: boolean
  roleName: string; dashboard: string
  planId: string; planName: string; planTier: string; paid: boolean; expiresAt?: number
  permissions: string[]; quotas: Record<string, number>
  dashModules: string[]; dashLocked: boolean
}

export const PERM_LABEL: Record<string, string> = Object.fromEntries(PERMISSIONS.map(p => [p.id, p.label]))

// خالص و تست‌پذیر: مجموعهٔ مجوز/سهمیهٔ مؤثر — پلنِ فعال اگر بود، وگرنه پلنِ رایگانِ داشبورد.
export function effectivePermsOf(
  plan: Pick<Plan, 'permissions' | 'quotas'> | null,
  freePlan: Pick<Plan, 'permissions' | 'quotas'> | null,
): { permissions: string[]; quotas: Record<string, number> } {
  const src = plan || freePlan
  return { permissions: [...(src?.permissions || [])], quotas: { ...(src?.quotas || {}) } }
}

// فاز ۵۵ — قفلِ کلِ داشبورد، کاملاً داینامیک (هیچ نگاشتِ هاردکدی از داشبورد→ماژول):
// «universe» = اجتماعِ ماژول‌هایی که پلن‌های فعالِ همان داشبورد باز می‌کنند. اگر universe خالی باشد
// (مثل /buyer که پلن‌هایش فقط سهمیه‌ای‌اند) داشبورد ماژول‌محور نیست → هرگز قفل نمی‌شود. وگرنه
// کاربری که «هیچ‌کدام» از آن ماژول‌ها را ندارد، عملاً هیچ‌چیزِ آن پنل را نمی‌تواند استفاده کند → قفلِ تمام‌صفحه.
export function panelLockOf(userPerms: string[], dashPlans: Array<Pick<Plan, 'permissions'>>): { locked: boolean; modules: string[] } {
  const modules = [...new Set(dashPlans.flatMap(p => p.permissions || []))]
  return { modules, locked: modules.length > 0 && !userPerms.some(p => modules.includes(p)) }
}

export function resolveAccess(session: { phone: string; role?: string }): PlanAccess {
  const phone = String(session.phone || '')
  const isAdmin = session.role === 'super_admin'
  const acc = getAccount(phone)
  const roles = (() => { try { return listRoles() } catch { return [] } })()
  const role = roles.find(r => r.id === acc?.role) || roles.find(r => r.name === acc?.role) || null
  const ap = activePlan(phone)
  const plan = ap ? getPlan(ap.plan) : null
  const dash = role?.dashboard || '/buyer'
  const actives = (() => { try { return listActive() } catch { return [] as Plan[] } })()
  const freePlan = actives.find(p => p.priceMonthly === 0 && p.dashboard === dash) || actives.find(p => p.priceMonthly === 0) || null
  const eff = effectivePermsOf(plan, freePlan)
  const enforce = planEnforcement()
  // فاز ۵۵: قفلِ کلِ داشبورد از پلن‌های فعالِ همان داشبورد (داینامیک — ادمین پلنِ رایگانِ ماژول‌دار بسازد، باز می‌شود)
  const lock = panelLockOf(eff.permissions, actives.filter(p => p.dashboard === dash))
  return {
    phone, isAdmin, enforce,
    roleName: role?.name || '', dashboard: dash,
    planId: plan?.id || freePlan?.id || '', planName: plan?.name || freePlan?.name || 'رایگان',
    planTier: plan?.tier || (plan ? '' : 'free'), paid: !!plan, expiresAt: ap?.expiresAt,
    permissions: eff.permissions, quotas: eff.quotas,
    dashModules: lock.modules, dashLocked: enforce && !isAdmin && lock.locked,
  }
}

// ── فاز ۵۲: سقف‌های مصرف (quotas) — همه از خودِ پلن، داینامیک؛ هیچ عددی در کد ──
export const QUOTA_LABEL: Record<string, string> = Object.fromEntries(QUOTA_KEYS.map(q => [q.id, q.label]))

// سقفِ مؤثرِ یک کلید: >۰ = سقف؛ −۱ یا ۰/تعریف‌نشده = نامحدود (همان قراردادِ plan-store).
export function quotaCapOf(access: Pick<PlanAccess, 'quotas'>, key: string): number | null {
  const q = access.quotas[key]
  return typeof q === 'number' && q > 0 ? q : null
}

// null = مجاز؛ وگرنه بدنهٔ 403 با code:'plan' — «current» تعدادِ فعلیِ واقعی از خودِ store همان بخش می‌آید
// (عددِ نمایش = عددِ واقعی، نه شمارندهٔ موازی). سوپرادمین و حالتِ خاموشِ enforce همیشه معاف.
export function requireQuota(session: { phone: string; role?: string }, key: string, current: number, adding = 1):
  null | { error: string; code: 'plan'; need: string; needLabel: string; plan: string; upgrade: string; cap: number; current: number } {
  const a = resolveAccess(session)
  if (!a.enforce || a.isAdmin) return null
  const cap = quotaCapOf(a, key)
  if (cap === null || current + Math.max(1, adding) <= cap) return null
  const label = QUOTA_LABEL[key] || key
  return {
    error: `به سقفِ پلنِ فعلی‌ات رسیدی — ${cap.toLocaleString('fa-IR')} ${label} در پلنِ «${a.planName}». برای ادامه پلن را ارتقا بده.`,
    code: 'plan', need: key, needLabel: label, plan: a.planName, upgrade: '/pricing', cap, current,
  }
}

// null = مجاز؛ وگرنه بدنهٔ یکنواختِ خطای 403 (code:'plan') برای همهٔ APIها — UI با همین code قفل/CTA می‌سازد.
export function requireModule(session: { phone: string; role?: string }, perm: string):
  null | { error: string; code: 'plan'; need: string; needLabel: string; plan: string; upgrade: string } {
  const a = resolveAccess(session)
  if (!a.enforce || a.isAdmin) return null
  if (a.permissions.includes(perm)) return null
  const label = PERM_LABEL[perm] || perm
  return {
    error: `بخشِ «${label}» در پلنِ فعلی‌ات (${a.planName}) فعال نیست — برای دسترسی، پلن را ارتقا بده.`,
    code: 'plan', need: perm, needLabel: label, plan: a.planName, upgrade: '/pricing',
  }
}
