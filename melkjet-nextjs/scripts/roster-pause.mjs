#!/usr/bin/env node
// ── توقفِ موقتِ سینکِ «هوش آژانس» (روستر) تا ممیزی/انتشار/تلگرام نفس بکشند ──────────
// چرا: یک «همگام‌سازیِ همهٔ بک‌لاگ» (runRequested روی همهٔ آژانس‌ها) باعث شده روستر وسطِ روز
// (بیرونِ پنجرهٔ ۰–۶) بی‌وقفه ایمپورت کند و قفلِ scraper_meta را نگه دارد؛ در نتیجه نوشتنِ
// moderatePending (تغییرِ وضعیتِ آگهی‌های منتظر) statement_timeout می‌خورد و «منتظر»ها پاک
// نمی‌شوند و چیزی به تلگرام نمی‌رود. این اسکریپت روی همهٔ روسترها requestStop می‌زند:
// رانِ زنده در اولین چکِ بعدی تمیز می‌ایستد و runRequested پاک می‌شود، پس کرون دیگر وسطِ روز
// برنمی‌داردشان. سینکِ واقعی در پنجرهٔ شبانه (۰–۶ تهران) طبقِ برنامه اجرا می‌شود — یا هر وقت
// خواستی دوباره «همگام‌سازی الان» را بزنی.
//
// اجرا:  cd /var/www/melkjet/melkjet-nextjs
//        node --import ./scripts/reos-loader.mjs scripts/roster-pause.mjs
import { readFileSync, existsSync } from 'node:fs'

function loadEnv(f) {
  if (!existsSync(f)) return
  for (const l of readFileSync(f, 'utf-8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnv('.env.production.local'); loadEnv('.env')

const { listScrapes, requestStop } = await import('../app/lib/agency-roster-store.ts')

const all = await listScrapes()
const active = all.filter(s => s.running || s.runRequested)
console.log(`کلِ روسترها: ${all.length}   در حالِ اجرا/درخواستِ اجرا: ${active.length}`)
if (!active.length) { console.log('روستری در حالِ اجرا نیست — چیزی برای توقف نداریم.'); process.exit(0) }

let n = 0
for (const s of active) {
  try { if (await requestStop(s.id)) n++ } catch (e) { console.error(`  توقفِ ${s.id} نشد: ${String(e?.message || e).slice(0, 80)}`) }
}
console.log(`توقف درخواست شد برای ${n} روستر. رانِ زنده ظرفِ چند ثانیه تمیز می‌ایستد.`)
console.log('حالا کرون می‌تواند moderatePending را بدونِ رقابتِ قفل اجرا کند → «منتظر»ها شروع به کم‌شدن می‌کنند.')
console.log('سینکِ روستر در پنجرهٔ شبانه (۰–۶ تهران) خودکار از سر گرفته می‌شود.')
process.exit(0)
