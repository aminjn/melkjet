// هوک بوتِ سرور (Next) — زمان‌بندِ سینکِ خودکارِ دیوار را در پروسهٔ Node راه می‌اندازد.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureCronStarted } = await import('./app/lib/cron-runner')
    ensureCronStarted()
    // فاز ۱۷۰ — گرم‌کردنِ DNS در بوتِ «هر» اینستنس (پیامکِ OTP و AI): اولین کاربرِ واقعی
    // دیگر هزینهٔ resolveِ سرد را نمی‌دهد («بار اول ارور می‌داد»). شکستش بی‌صداست.
    try {
      const { warmDns } = await import('./app/lib/shecan-https')
      warmDns('api2.ippanel.com')
      warmDns('api.gapgpt.app')
      warmDns('api.pod.ir')
    } catch { /* گرم‌کردن اختیاری است */ }
  }
}
