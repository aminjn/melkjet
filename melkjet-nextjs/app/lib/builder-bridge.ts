// فاز ۲۴۲ (فیدبک+اسکرین‌شات: «سازنده‌های جدید پروفایلشان خالی است ولی قدیمی‌ها صفحهٔ کامل دارند») —
// دو سیستمِ پروفایل داریم: /builder/{slug} = پروفایلِ «حسابِ کاربری» (برای سازنده‌ای که خودش ثبت‌نام
// کرده و پروفایلش را پر می‌کند) و /builders/{slug} = پروفایلِ غنیِ «بانکِ سازنده‌ها» (دیتای واقعیِ
// پرشین‌سازه: پروژه‌ها/آمار). کرانِ پرشین‌سازه برای سازنده‌ها «حساب» می‌سازد → لینک‌ها به صفحهٔ
// خالیِ حساب می‌رفتند در حالی که صفحهٔ غنیِ همان سازنده وجود داشت. این پل با «شماره» وصلشان می‌کند.
import type { PSProfile } from './persiansaze-store'

/** اگر slugِ پروفایلِ حسابِ سازنده به یک سازندهٔ واقعیِ بانک (پرشین‌سازه) برسد، مسیرِ صفحهٔ غنی را می‌دهد. */
export async function richBuilderHrefForProviderSlug(slug: string): Promise<string | null> {
  try {
    const { allProviderSlugsByPhone } = await import('./provider-slug-store')
    const map = await allProviderSlugsByPhone()
    const phone = Object.keys(map).find(ph => map[ph] === slug)
    if (!phone) return null
    const { getProfiles } = await import('./persiansaze-store')
    const profiles = Object.values(getProfiles()) as PSProfile[]
    const hit = profiles.find(p => (p.phones || []).some(x => String(x).replace(/\D/g, '') === phone))
    if (!hit) return null
    const { ensureBuilderSlug } = await import('./builder-slug-store')
    const bslug = await ensureBuilderSlug(String((hit as { id?: string | number }).id ?? ''), hit.name || '')
    return bslug ? `/builders/${bslug}` : null
  } catch { return null }
}
