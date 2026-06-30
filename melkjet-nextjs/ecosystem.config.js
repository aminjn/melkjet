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

function instance(port, idx) {
  return {
    name: 'melkjet',
    cwd: CWD,
    // مستقیم به باینریِ next اشاره می‌کنیم (نه npm) تا یک لایه فرایندِ اضافه نباشد.
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    exec_mode: 'fork',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: String(port),
      // فقط اینستنسِ صفر کرون را اجرا می‌کند.
      NODE_APP_INSTANCE: String(idx),
      // اینستنسِ صفر همهٔ این پورت‌ها را گرم می‌کند تا هیچ اینستنسی سرد نماند.
      WARM_PORTS: '3000,3001,3002,3003',
    },
    autorestart: true,
    max_memory_restart: '1200M',
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
