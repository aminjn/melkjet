// پیکربندیِ pm2 برای استفاده از هر ۴ هستهٔ سرور.
//
// چرا این شکل و نه cluster mode؟
//   `next start` با pm2 cluster mode ناسازگار است: در cluster mode همهٔ
//   workerها می‌خواهند روی همان یک PORT گوش بدهند، next هم به‌جای استفاده از
//   socketِ مشترکِ master خودش listen می‌کند → EADDRINUSE → crash-loop بی‌نهایت
//   (همان ↺ صدها‌هزاری که چانک‌های استاتیک را ۵۰۰ می‌کرد).
//
// راهِ درست: چند فرایندِ fork، هرکدام روی پورتِ جداگانه (۳۰۰۰..۳۰۰۳)، و یک
//   reverse-proxy (nginx) جلوشان لود‌بالانس می‌کند. مشخصاتِ nginx در فایلِ
//   docs/nginx-loadbalance.conf آمده است.
//
// نکتهٔ cron: فقط اینستنسی که NODE_APP_INSTANCE=0 دارد کرون/کروم (اسکرپ) را
//   اجرا می‌کند (app/lib/cron-runner.ts خط ۶۰)، تا چند کروم موازی راه نیفتد.
//
// دیپلوی:  pm2 reload ecosystem.config.js   (یا  pm2 reload melkjet)

const CWD = '/var/www/melkjet/melkjet-nextjs'

// Which build directory to serve.
//
// next.config.ts takes distDir from NEXT_DIST_DIR, and `next start` reads that
// same config, so this env var alone decides where a process serves from.
// deploy.sh builds into the idle slot (.next-a / .next-b), writes its name into
// .next-current, then reloads. The directory being served is never the one being
// written -- which is exactly the ENOTEMPTY that took the site down: `next build`
// tried to clear .next while these processes still held files open inside it.
//
// If .next-current is missing or names a slot with no BUILD_ID, fall back to
// whichever slot actually has one, so losing the pointer cannot strand the
// server on a directory that does not exist.
const fs = require('fs')
function currentDist() {
  const ok = d => { try { return fs.existsSync(CWD + '/' + d + '/BUILD_ID') } catch { return false } }
  try {
    const v = fs.readFileSync(CWD + '/.next-current', 'utf8').trim()
    if (/^\.next(-[ab])?$/.test(v) && ok(v)) return v
  } catch {}
  for (const d of ['.next', '.next-a', '.next-b']) if (ok(d)) return d
  return '.next'
}
const DIST = currentDist()

function instance(port, idx) {
  return {
    // نامِ یکتا برای هر اینستنس — وگرنه pm2 با نام‌های تکراری در هر reload/start
    // چند اینستنسِ جدید «اضافه» می‌کند (به‌جای جایگزینی) و ده‌ها فرایندِ موازی جمع می‌شود.
    name: `melkjet-${port}`,
    cwd: CWD,
    // مستقیم به باینریِ next اشاره می‌کنیم (نه npm) تا یک لایه فرایندِ اضافه نباشد.
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    exec_mode: 'fork',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      NEXT_DIST_DIR: DIST,
      PORT: String(port),
      // فقط اینستنسِ صفر کرون را اجرا می‌کند.
      NODE_APP_INSTANCE: String(idx),
      // اینستنسِ صفر همهٔ این پورت‌ها را گرم می‌کند تا هیچ اینستنسی سرد نماند.
      WARM_PORTS: '3000,3001,3002,3003',
    },
    autorestart: true,
    // ۲۸ سپتامبر ۲۰۲۶ — سقفِ ۲۵۰۰/۳۰۰۰M «گاردِ خنثی» بود: نشتِ next-server هر ۴ اینستنس را
    // هم‌زمان بالا می‌بَرد و رمِ ۷.۸GiB «کلِ ماشین» قبل از رسیدنِ تک‌اینستنس به سقف تمام می‌شود
    // (ساعت ۲۲:۰۸ همین شب: ۱.۱–۱.۹GB×۴ + پستگرس → سواپ/لود ۹ → ۵۰۴ سراسری، دومین بار در یک روز).
    // بودجه باید در «جمع» جا شود: 1800+1300×3=۵.۷GB + پستگرس/سیستم ≈ ۷.۵GB. اینستنسِ نشتی
    // خودش تنها ری‌استارت می‌شود (چند ثانیه، بقیه سرویس می‌دهند) و ماشین هرگز خفه نمی‌شود.
    // اگر اینستنسی «بدونِ نشت» به این سقف بخورد (ری‌استارتِ مکررِ چنددقیقه‌ای در pm2 log)،
    // مشکل مصرفِ واقعی است و باید ریشه‌یابی شود — نه اینکه سقف را دوباره خنثی کنیم.
    max_memory_restart: idx === 0 ? '1800M' : '1300M',
    // اگر هنگامِ بوت خطا داد، به‌جای crash-loopِ بی‌نهایت بعد از ۱۵ تلاش بایستد.
    min_uptime: '10s',
    max_restarts: 15,
    restart_delay: 2000,
    merge_logs: true,
  }
}

module.exports = {
  apps: [
    instance(3000, 0),
    instance(3001, 1),
    instance(3002, 2),
    instance(3003, 3),
  ],
}
