// گیتِ مرکزیِ پلن (فاز ۵۱ — فیدبک: «پلن‌ها اعمال نمی‌شود؛ هر کسی وارد می‌شود همه‌چیز دارد»).
// یک منبعِ واحد برای «این کاربر به این ماژول دسترسی دارد؟» — همهٔ APIهای ابزار/داشبورد از همین می‌پرسند.
// قواعد:
//  • دسترسیِ مؤثر فقط از «پلنِ فعالِ» کاربر می‌آید (activePlan — انقضادار)؛ بدونِ پلن → پلنِ رایگانِ همان داشبورد.
//  • سوپرادمین همیشه معاف است.
//  • کلیدِ enforce (پنلِ پلن‌ها) برای رول‌اوتِ امن: خاموش = هیچ قفلی (رفتارِ قبلی)، روشن = اعمالِ واقعی.
import { getAccount, activePlan } from './account-store'
import { listRoles, PERMISSIONS } from './role-store'
import { getPlan, listActive, planEnforcement, type Plan } from './plan-store'

export interface PlanAccess {
  phone: string; isAdmin: boolean; enforce: boolean
  roleName: string; dashboard: string
  planId: string; planName: string; planTier: string; paid: boolean; expiresAt?: number
  permissions: string[]; quotas: Record<string, number>
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
  return {
    phone, isAdmin, enforce: planEnforcement(),
    roleName: role?.name || '', dashboard: dash,
    planId: plan?.id || freePlan?.id || '', planName: plan?.name || freePlan?.name || 'رایگان',
    planTier: plan?.tier || (plan ? '' : 'free'), paid: !!plan, expiresAt: ap?.expiresAt,
    permissions: eff.permissions, quotas: eff.quotas,
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
