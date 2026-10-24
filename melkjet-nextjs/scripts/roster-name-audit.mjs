#!/usr/bin/env node
// ممیزیِ یک‌بارهٔ نامِ مشاورها — به‌جای تک‌تک پیداکردنِ نوفه از اسکرین‌شات.
// همهٔ نامِ مشاورهای «غیرِ graduate» (بدونِ شماره — یعنی خوشه‌های استخراج‌شده، نه حساب‌های تأییدشده)
// را از همهٔ آژانس‌ها جمع و فهرست می‌کند؛ تک‌کلمه‌ای‌ها (ریسکِ بالای نوفه) را با ⚠ علامت می‌زند.
// فقط‌خواندنی — هیچ‌چیزی را تغییر نمی‌دهد. خروجی را برای تصمیمِ «کدام نوفه است» بفرست.
//
// اجرا:
//   cd /var/www/melkjet/melkjet-nextjs && set -a && . ./.env.production.local && set +a
//   node --import ./scripts/reos-loader.mjs scripts/roster-name-audit.mjs
import { readFileSync, existsSync } from 'node:fs'
function loadEnv(f){ if(!existsSync(f))return; for(const l of readFileSync(f,'utf-8').split('\n')){const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(process.env[m[1]]===undefined)process.env[m[1]]=v} }
loadEnv('.env.production.local'); loadEnv('.env')

const { listScrapes } = await import('../app/lib/agency-roster-store.ts')
const lex = await import('../app/lib/agency-name-lexicon.ts')

const scrapes = await listScrapes()
const byName = new Map()   // نام → { files, agencies:Set, graduated }
for (const s of scrapes) {
  for (const a of (s.advisors || [])) {
    const name = String(a.name || '').trim()
    if (!name) continue
    const files = (a.tokens || []).length
    const graduated = !!a.phone
    const e = byName.get(name) || { name, files: 0, agencies: new Set(), graduated: false }
    e.files += files; e.agencies.add(s.name || s.slug || '?'); if (graduated) e.graduated = true
    byName.set(name, e)
  }
}

const rows = [...byName.values()].map(e => {
  const words = e.name.split(/\s+/).filter(Boolean)
  const single = words.length === 1
  // مشکوک: تک‌کلمه‌ایِ غیرِ graduate (ریسکِ بالای نوفه) — graduateشده‌ها تأییدِ انسانی دارند.
  const suspicious = single && !e.graduated
  return { ...e, single, suspicious, agencyCount: e.agencies.size }
})

// مشکوک‌ها اول، بعد بر اساسِ تعدادِ فایل (کم‌فایلِ تک‌کلمه‌ای بیشترین ریسک).
rows.sort((a, b) => (b.suspicious - a.suspicious) || (a.single - b.single) || (b.files - a.files))

const susp = rows.filter(r => r.suspicious)
console.log(`\nکلِ نام‌های یکتا: ${rows.length}  ·  مشکوک (تک‌کلمه‌ایِ غیرِgraduate): ${susp.length}  ·  graduate‌شده: ${rows.filter(r=>r.graduated).length}\n`)
console.log('── مشکوک‌ها (این‌ها را نگاه کن؛ کدام نوفه است؟) ──')
for (const r of susp) console.log(`  ⚠ ${r.name}   (${r.files} فایل · ${r.agencyCount} آژانس)`)
console.log('\n── تک‌کلمه‌ایِ graduateشده (تأییدِ انسانی دارند — معمولاً سالم) ──')
for (const r of rows.filter(r => r.single && r.graduated)) console.log(`  ✓ ${r.name}   (${r.files} فایل)`)
console.log('\n(نام‌های چندکلمه‌ای معمولاً سالم‌اند و فهرست نشدند؛ اگر خواستی --all بزن.)')
if (process.argv.includes('--all')) { console.log('\n── همهٔ نام‌ها ──'); for (const r of rows) console.log(`  ${r.suspicious?'⚠':' '} ${r.name}  (${r.files}ف · ${r.agencyCount}آژ${r.graduated?' · graduate':''})`) }
process.exit(0)
