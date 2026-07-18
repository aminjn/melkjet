// هوک بوتِ سرور (Next) — زمان‌بندِ سینکِ خودکارِ دیوار را در پروسهٔ Node راه می‌اندازد.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureCronStarted } = await import('./app/lib/cron-runner')
    ensureCronStarted()
    // فاز ۱۷۰ — گرم‌کردنِ DNS در بوتِ «هر» اینستنس (پیامکِ OTP و AI): اولین کاربرِ واقعی
    // دیگر هزینهٔ resolveِ سرد را نمی‌دهد («بار اول ارور می‌داد»). شکستش بی‌صداست.
    try {
      const { warmDns, shecanRequest } = await import('./app/lib/shecan-https')
      warmDns('api2.ippanel.com')
      warmDns('api.gapgpt.app')
      warmDns('api.pod.ir')
      // فاز ۱۷۲ — علاوه بر DNS، «اتصالِ TLS» به سرویسِ پیامک هم گرم می‌شود (agent keep-alive نگهش می‌دارد):
      // اولین OTPِ واقعیِ هر اینستنس دیگر هزینهٔ TCP+TLS handshake را هم نمی‌دهد. شکست بی‌صداست.
      setTimeout(() => { shecanRequest('https://api2.ippanel.com/', { method: 'GET', headers: {}, timeout: 5000 }).catch(() => {}) }, 1500)
    } catch { /* گرم‌کردن اختیاری است */ }
  }
}
