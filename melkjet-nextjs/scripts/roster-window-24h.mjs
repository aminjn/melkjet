#!/usr/bin/env node
// ── پنجرهٔ سینکِ روستر را «۲۴ساعته» کن (همه جای سایت) ────────────────────────────
// چرا: تغییرِ کد (فاز ۳۳۴) پیش‌فرضِ پنجره را ۲۴ساعته کرد، ولی «تنظیماتِ ذخیره‌شدهٔ زنده»
// روی پیش‌فرضِ کد اولویت دارد (`{ ...DEFAULT_SETTINGS, ...(db.settings) }`). اگر قبلاً
// روی سرور بازهٔ ۰–۶ ذخیره شده باشد، کدِ تازه خودبه‌خود اثر نمی‌کند. این اسکریپت:
//   (۱) تنظیماتِ سراسریِ زنده را به ۲۴ساعته می‌نشاند (startHour=0, endHour=0, autoSync=true)
//   (۲) override‌های اختصاصیِ هر آژانس روی بازهٔ ساعت (startHour/endHour) را پاک می‌کند تا
//       «همه جای سایت» واقعاً ۲۴ساعته باشد. autoSync‌ِ اختصاصیِ هر آژانس دست نمی‌خورد
//       (اگر کسی عمداً یک آژانس را خاموش کرده، خاموش می‌ماند).
//
// اجرا (روی سرور):
//   cd /var/www/melkjet/melkjet-nextjs
//   sudo -E env "PATH=$PATH" node --import ./scripts/reos-loader.mjs scripts/roster-window-24h.mjs
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

const { getRosterSettings, saveRosterSettings, listScrapes, patchScrape } = await import('../app/lib/agency-roster-store.ts')

const before = await getRosterSettings()
console.log(`تنظیماتِ فعلیِ سراسری: autoSync=${before.autoSync}  startHour=${before.startHour}  endHour=${before.endHour}`)

// (۱) سراسری → ۲۴ساعته
const after = await saveRosterSettings({ autoSync: true, startHour: 0, endHour: 0 })
console.log(`✅ تنظیماتِ سراسری به ۲۴ساعته نشانده شد: autoSync=${after.autoSync}  startHour=${after.startHour}  endHour=${after.endHour}`)

// (۲) پاک‌کردنِ override‌های بازهٔ هر آژانس
const all = await listScrapes()
let cleared = 0
for (const s of all) {
  if (s.startHour !== undefined || s.endHour !== undefined) {
    try { await patchScrape(s.id, { startHour: undefined, endHour: undefined }); cleared++ }
    catch (e) { console.error(`  پاک‌کردنِ override‌ِ ${s.slug || s.id} نشد: ${String(e?.message || e).slice(0, 80)}`) }
  }
}
console.log(`✅ override‌ِ بازهٔ ساعت از ${cleared} آژانس پاک شد (از کلِ ${all.length}).`)
console.log('اکنون همهٔ آژانس‌ها (بدونِ بازهٔ اختصاصی) تمامِ شبانه‌روز تلاش می‌کنند تا سینک شوند.')
process.exit(0)
