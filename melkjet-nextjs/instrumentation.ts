// فاز ۲۹۰ — ردیابِ نشتِ حافظه (قانونِ شمارهٔ یک: نشتی که اندازه گرفته نشود، درمان نمی‌شود).
// هر اینستنس هر ۱۰ دقیقه ترکیبِ حافظه‌اش را لاگ می‌کند. تفکیکِ heap (اشیای جاوااسکریپت —
// یعنی نشت از کدِ خودِ ما: کش/آرایهٔ بی‌سقف) از external/arrayBuffers (حافظهٔ native —
// یعنی sharp/undici/سوکت) مشخص می‌کند شکار باید کجا برود. handles هم نشتِ سوکت/تایمر را لو می‌دهد.
// خواندن:  sudo grep -a '\[mem\]' /root/.pm2/logs/melkjet-300*-out.log | tail -40
export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return
  const mb = (n: number) => Math.round(n / 1048576)
  const t = setInterval(() => {
    try {
      const m = process.memoryUsage()
      const handles = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.()?.length ?? -1
      console.log(`[mem] rss=${mb(m.rss)}MB heapUsed=${mb(m.heapUsed)}MB heapTotal=${mb(m.heapTotal)}MB external=${mb(m.external)}MB arrayBuffers=${mb(m.arrayBuffers)}MB handles=${handles}`)
    } catch { /* هرگز سرویس را نیندازد */ }
  }, 10 * 60_000)
  ;(t as unknown as { unref?: () => void }).unref?.()
}
