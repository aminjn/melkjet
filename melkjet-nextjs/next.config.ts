import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⚙️ بیلد و سرورِ زنده نباید روی یک پوشه کار کنند.
  // سرورِ در حالِ اجرا کشِ ISR را داخلِ .next/server/app می‌نویسد؛ next build هنگامِ پاک‌کردنِ
  // همان پوشه با ENOTEMPTY می‌شکند. پاک‌کردنِ دستیِ زیرپوشه‌ها قبل از بیلد یک وصله بود که
  // هر بار یک پوشهٔ تازه پیدا می‌کرد. با این متغیر، بیلد در پوشهٔ کاملا جدا انجام می‌شود و
  // سایتِ زنده حتی یک بایت هم دست نمی‌خورد؛ جابه‌جایی فقط در پایان و در چند ثانیه.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // فاز ۲۵۷ (سرعت): در بیلدِ پروداکشن همهٔ console.* از باندلِ کلاینت حذف می‌شود (باندلِ JS کوچک‌تر،
  // بدونِ نشتِ لاگ در مرورگرِ کاربر) — به‌جز error/warn که برای تشخیصِ مشکل روی prod لازم‌اند.
  // فاز ۲۷۶ — ⚠️ removeConsole خاموش شد و باید خاموش بماند.
  // این گزینه فقط باندلِ مرورگر را هدف نداشت: SWC آن را روی **کدِ سرور هم** اعمال می‌کند،
  // پس همهٔ `console.log`های عملیاتی (`[roster] import N/M`، `graduate job start/end`،
  // `[cron] …`) در پروداکشن حذف می‌شدند. نتیجه: یک ساعت دنبالِ کارِ گیرکردهٔ «ساخت حساب»
  // گشتیم و لاگِ pm2 خالی بود — همان «کارِ بی‌صدا مرده»ی قانونِ شمارهٔ یک، این‌بار خودِ
  // ابزارِ تشخیص را خاموش کرده بود. سودش (چند کیلوبایت باندل) هیچ نسبتی با این هزینه ندارد.
  compiler: {},
  // فاز ۹۵ — بهینه‌سازِ داخلی تصاویر برای کارت‌های آگهی (تصاویر CDN دیوار):
  // /_next/image نسخهٔ webp کوچک‌شده را از دامنهٔ خودمان سرو و روی دیسک کش می‌کند.
  // آدرس‌های دیوار content-addressed هستند (هرگز عوض نمی‌شوند) → TTL بلند امن است.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.divarcdn.com" }],
    qualities: [60, 75],
    // فاز ۹۷: AVIF ~۳۰-۴۰٪ کوچک‌تر از webp؛ فقط بارِ اولِ هر تصویر encode می‌شود (کشِ دیسک)
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 604800, // ۷ روز
  },
  // Cache headers to stop the CDN serving stale HTML after a new build (which
  // breaks all styling because it points at old, deleted CSS/JS chunks).
  async headers() {
    return [
      {
        // hashed, content-addressed assets — safe to cache forever
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // پنلِ مدیریت — هرگز و در هیچ لایه‌ای (CDN/مرورگر) ذخیره نشود؛ سوراخِ «هر اکانتی پنل را می‌بیند»
        // وقتی رخ می‌دهد که CDN همین HTML را کش کند و درخواست اصلاً به گاردهای سرور نرسد.
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, private, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, private, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // API routes (auth/session/data) — NEVER cache or store at the edge.
        // `no-cache` alone lets some CDNs (Arvan) treat the response as
        // cacheable-with-revalidation and STRIP Set-Cookie, which silently
        // breaks login (the cookie never reaches the browser → user is logged
        // out again on refresh). `no-store, private` tells every cache to keep
        // its hands off, so Set-Cookie survives and session checks aren't stale.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, private" }],
      },
      {
        // فاز ۱۷۹ — استثنای تصویرِ نقشهٔ استاتیک: بدونِ کوکی/سشن است و باید در مرورگر/CDN کش شود
        // وگرنه هر زوم/پنِ نقشه یک رفتِ کامل به نشان است (کندیِ گزارش‌شدهٔ کاربر). قانونِ بعدی، قبلی را override می‌کند.
        source: "/api/geo/static-map",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, immutable" }],
      },
      {
        // everything else (HTML pages, etc.) — always revalidate so a new
        // deploy is picked up immediately instead of serving stale markup.
        // /_next/image excluded: the optimizer sets its own long-lived
        // Cache-Control so Arvan can edge-cache the resized images.
        source: "/((?!_next/static|_next/image|api/).*)",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
