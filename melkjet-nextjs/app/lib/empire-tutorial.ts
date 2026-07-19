// 🧭 فاز ۱۸۲ — راهنمای روزهای اول (سبکِ تراوین): کاربرِ تازه تا N روز (knob) با زنجیره‌ای از
// قدم‌های هدایت‌شده جلو می‌رود؛ شرطِ «انجام شد»ِ هر قدم مستقیم از وضعیتِ واقعیِ امپراتوری
// خوانده می‌شود (هیچ شمارندهٔ موازی)؛ جایزهٔ هر قدم knob و ادعا با کلیدِ tut_ در claims.
import type { EmpireData } from './empire-store'

export interface TutorialStep { id: string; icon: string; title: string; desc: string; go: string }
// go = مقصدِ UI: city|deals|portfolio|hoods|missions|towerRenovate|towerSell
export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'buy_first', icon: '🏠', title: 'اولین ملکت را بخر', desc: 'از «فرصت‌های امروز» یک آگهیِ واقعی انتخاب کن و بخر — سرمایهٔ شروع همین‌جاست.', go: 'deals' },
  { id: 'decide', icon: '🧭', title: 'برای ملکت تصمیم بگیر', desc: 'روی برجت بزن: اجاره بده، بازسازی کن یا نگه دار — هر تصمیمی آینده‌ات را می‌سازد.', go: 'city' },
  { id: 'renovate', icon: '🛠', title: 'یک بازسازیِ واقعی انجام بده', desc: 'روی برجت بزن → بازسازی: هزینه می‌کنی و ارزشِ ملک همان لحظه بالا می‌رود.', go: 'towerRenovate' },
  { id: 'explore', icon: '🔎', title: 'شهرت را کشف کن', desc: 'چند آگهیِ واقعی ببین و ذخیره کن — ملک‌جت سلیقه‌ات را یاد می‌گیرد.', go: 'missions' },
  { id: 'hood_home', icon: '🏘', title: 'محلهٔ خانه‌ات را ثبت کن', desc: 'در بنای «⚔️ محله‌ها» بگو خانه‌ات کجاست — ببین فرمانروای محله‌ات کیست.', go: 'hoods' },
  { id: 'sell_list', icon: '🤝', title: 'یک ملک را به مشاور بسپار', desc: 'قیمتِ پیشنهادی بده؛ هر ساعت خریدار می‌آید — چانه بزن یا قبول کن.', go: 'towerSell' },
  { id: 'chest', icon: '🎁', title: 'صندوقچهٔ روز را باز کن', desc: 'هر روز یک صندوقچهٔ رایگان داری — هیچ‌کس نمی‌داند داخلش چیست.', go: 'city' },
]

// شرطِ انجام — فقط از وضعیتِ واقعی
export function tutorialDoneOf(e: EmpireData, id: string): boolean {
  switch (id) {
    case 'buy_first': return e.assets.length > 0 || (e.realized || 0) > 0
    case 'decide': return e.assets.some(a => a.action || a.landPlan || a.business)
    case 'renovate': return e.assets.some(a => (a.renovBoostPct || 0) > 0)
    case 'explore': return !!e.claims['m1_explore'] || (e.identity?.explorer || 0) > 0
    case 'hood_home': return !!(e.homeHood || '').trim()
    // فروشِ کامل‌شده (realized تغییر کرده) هم یعنی این قدم طی شده — وگرنه بعدِ قبولِ پیشنهاد، برج حذف و sale گم می‌شد
    case 'sell_list': return e.assets.some(a => !!a.sale) || (e.realized || 0) !== 0 || !!e.claims['tut_sell_list']
    case 'chest': return Object.keys(e.claims).some(k => k.startsWith('chest_'))
    default: return false
  }
}

export interface TutorialState { active: boolean; daysLeft: number; steps: Array<TutorialStep & { done: boolean; claimed: boolean }>; doneCount: number }
export function tutorialOf(e: EmpireData, cfg: { enabled: boolean; days: number }, now = Date.now()): TutorialState | null {
  if (!cfg.enabled) return null
  const ageDays = Math.floor((now - e.createdAt) / 864e5)
  const steps = TUTORIAL_STEPS.map(st => ({ ...st, done: tutorialDoneOf(e, st.id), claimed: !!e.claims['tut_' + st.id] }))
  const doneCount = steps.filter(s => s.claimed).length
  const allDone = steps.every(s => s.claimed)
  // فعال تا N روز یا تا تکمیل — بعدش دیگر نمایش داده نمی‌شود
  if (allDone || ageDays >= Math.max(1, cfg.days)) return { active: false, daysLeft: 0, steps, doneCount }
  return { active: true, daysLeft: Math.max(0, cfg.days - ageDays), steps, doneCount }
}
