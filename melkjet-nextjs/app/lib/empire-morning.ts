// ☀️ فاز ۱۶۷ — زنگِ صبحگاهیِ امپراتوری: هر روز رأسِ ساعتِ تنظیم‌شده (وقتِ تهران، پیش‌فرض ۹ صبح)
// برای هر امپراتوری نامهٔ روز ساخته می‌شود و مأموریتِ روز با پوش‌نوتیفیکیشن به گوشیِ کاربر می‌رسد —
// با همان اعدادِ زندهٔ knob (پاداشِ کوئست) و «چند درصد از راهِ سطحِ بعد». ایدمپوتنت: نشانِ morningAt
// روی خودِ رکوردِ نامه می‌نشیند، پس ری‌استارت/اجرای دوباره هرگز پوشِ دوم نمی‌فرستد.
// فقط روی instance صفر (کرون) اجرا می‌شود. هیچ دادهٔ ساختگی — متنِ پوش از کوئستِ واقعیِ روز است.

// ساعتِ محلیِ تهران — ایران از ۱۴۰۱ ساعتِ تابستانی ندارد: همیشه UTC+3:30 (قطعی، بدونِ Intl)
export function tehranHourOf(now: number): number {
  return Math.floor(((now + 3.5 * 3600e3) % 864e5) / 3600e3)
}

// آیا پنجرهٔ صبحگاهی باز است؟ (از ساعتِ تنظیم‌شده تا پایانِ روز — تا اگر سرور ری‌استارت بود، جا نماند)
export function morningWindowOpen(now: number, hour: number): boolean {
  const h = Math.max(0, Math.min(23, Math.floor(Number(hour) || 0)))
  return tehranHourOf(now) >= h
}

// «مأموریتِ امروز چند درصد از راهِ سطحِ بعد است؟» — عددِ صادق از منحنیِ واقعیِ سطح
export function pathPct(xpToNext: number, potentialXp: number): number {
  if (potentialXp <= 0) return 0
  if (xpToNext <= 0) return 100
  return Math.max(1, Math.min(100, Math.round((potentialXp / xpToNext) * 100)))
}

// متنِ پوش — بدونِ واژهٔ ممنوعه، با اعدادِ فارسی و پاداشِ واقعیِ روز
export function morningPushBody(questTitle: string, coins: number, xp: number, pct: number): string {
  const fa = (n: number) => n.toLocaleString('fa-IR')
  const reward = [coins > 0 ? `${fa(coins)} سکه` : '', xp > 0 ? `${fa(xp)} امتیاز` : ''].filter(Boolean).join(' و ')
  const path = pct > 0 ? ` — ${fa(pct)}٪ از راهِ سطحِ بعد` : ''
  return `«${questTitle}»${reward ? ` → ${reward}` : ''}${path}`
}

let lastDoneDay = 0   // میان‌بُرِ حافظه‌ای: وقتی گذرِ کامل چیزی برای فرستادن نداشت، تا فردا دیگر اسکن نکن

// اجرای صبحگاهی — خروجی: چند کاربر امروز نامه/پوش گرفتند. importهای store داینامیک تا تست‌های pure سبک بمانند.
export async function maybeRunMorning(now = Date.now()): Promise<number> {
  const { config } = await import('./reos/reos-config')
  const cfg = config().empire
  if (!cfg.morning?.enabled) return 0
  if (!morningWindowOpen(now, cfg.morning.hour)) return 0
  const { dayNumberOf } = await import('./empire-store')
  const day = dayNumberOf(now)
  if (lastDoneDay === day) return 0
  const { listEmpireUsers, getEmpire, getBrief, markBriefMorning, empireLevel, questOf } = await import('./empire-store')
  const { buildBriefFor } = await import('./empire-brief')
  const { listForPhone, removeByEndpoint } = await import('./push-store')
  const { sendPush } = await import('./web-push')
  const users = await listEmpireUsers()
  let touched = 0
  for (const userId of users) {
    try {
      const e = await getEmpire(userId)
      if (!e) continue
      await buildBriefFor(userId, now)
      const b = await getBrief(userId, day)
      if (!b || b.morningAt) continue
      await markBriefMorning(userId, day, now)   // اول نشان، بعد پوش — دوباره‌فرستی محال است
      touched++
      if (!cfg.morning.push) continue
      const q = questOf(userId, day, 'daily')
      const lv = empireLevel(e.xp)
      const pct = pathPct(Math.max(0, (lv.next ?? e.xp) - e.xp), cfg.quests.dailyXp)
      const body = morningPushBody(q.title, cfg.quests.dailyCoins, cfg.quests.dailyXp, pct)
      for (const sub of listForPhone(userId)) {
        try {
          const st = await sendPush(sub, { title: '☀️ مأموریتِ امروزت آماده است', body, url: '/empire', tag: 'mj-morning' })
          if (st === 404 || st === 410) removeByEndpoint(sub.endpoint)
        } catch { /* یک اشتراکِ خراب بقیه را متوقف نکند */ }
      }
    } catch { /* خطای یک کاربر گذرِ بقیه را نشکند */ }
  }
  if (!touched) lastDoneDay = day
  return touched
}
