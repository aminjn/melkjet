#!/usr/bin/env node
// 🎨 فاز ۱۶۴ب — کامپوزرِ دست‌چینِ پکِ Kenney Isometric (City + Buildings) → public/empire/sprites
// نگاشتِ شماره‌ها با «چشم» از کانتکت‌شیت‌ها انتخاب شده (نامِ فایل‌های پک شماره‌ای است).
// کاربرد: node scripts/empire-sprite-curate.mjs <cityPNGdir> <buildingsPNGdir>
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const [cityDir, bldDir] = process.argv.slice(2)
if (!cityDir || !bldDir) { console.error('node scripts/empire-sprite-curate.mjs <city/PNG> <bld/PNG>'); process.exit(1) }
const OUT = join(process.cwd(), 'public', 'empire', 'sprites')
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true })

const sz = (f) => { const b = readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } }
const C = (n) => join(cityDir, `cityTiles_${String(n).padStart(3, '0')}.png`)
const B = (n) => join(bldDir, `buildingTiles_${String(n).padStart(3, '0')}.png`)
let i = 0
const put = (src, name) => {
  const file = `${name}-${(i++).toString(36)}.png`
  copyFileSync(src, join(OUT, file))
  const { w, h } = sz(src)
  return { file, w, h }
}

// ── دست‌چین (قابلِ تیون — شماره‌ها = فایل‌های پک) ──
// فاز ۱۶۴ب-۲: همهٔ بدنه‌ها «فقط» قطعه‌های استک‌شوندهٔ ۹۹×۸۵ و همهٔ سقف‌ها کلاهکِ ۹۹×۵۴..۶۳ —
// قطعه‌های تمام‌کاشی (۱۳۲×۱۲۷) از استک‌ها حذف شدند چون تکرارِ طبقه را می‌شکستند.
const CUR = {
  grass: [66],                    // قوارهٔ خالیِ ساده
  trees: [67, 75, 83],            // قواره‌های درخت‌دار/پارک
  roadNS: 80, roadEW: 80, cross: 80,   // ۸۵/۸۴: جادهٔ مستقیم با پیاده‌رو (محورها بعد از پیش‌نمایش جابه‌جا شد)؛ ۸۰: آسفالتِ کاملِ تقاطع
  stacks: {
    apartment: { bodies: [43, 44, 47, 48, 38, 53], roofs: [59, 72, 62, 65] },
    shop: { bodies: [0, 7, 8, 15, 16, 23], roofs: [121, 126, 128] },
    villa: { bodies: [24, 32, 45], roofs: [74, 75, 82, 90] },
    office: { bodies: [7, 8, 31, 50], roofs: [72, 59, 86] },
    landmark: { bodies: [50, 55], roofs: [90, 91, 98] },
    generic: { bodies: [43, 47, 50], roofs: [59, 72] },
  },
}

const man = {
  tileW: 132,
  geo: { bodyW: 99, step: 34, lift: 10, roofOverlap: 24 },   // تیون‌شده در پیش‌نمایشِ بصری
  ground: {
    grass: CUR.grass.map(n => put(C(n), 'grass')),
    roadNS: put(C(CUR.roadNS), 'road-ns'),
    roadEW: put(C(CUR.roadEW), 'road-ew'),
    cross: put(C(CUR.cross), 'cross'),
  },
  buildings: {},
  props: CUR.trees.map(n => put(C(n), 'tree')),
  stacks: {},
}
for (const [kind, s] of Object.entries(CUR.stacks)) {
  man.stacks[kind] = { bodies: s.bodies.map(n => put(B(n), `${kind}-b`)), roofs: s.roofs.map(n => put(B(n), `${kind}-r`)) }
}
// سازگاری با اعتبارسنجِ v1 (buildings باید ناخالی باشد): استکِ هر دسته را به‌صورتِ بدنه‌ها هم ثبت می‌کنیم
for (const [kind, s] of Object.entries(man.stacks)) man.buildings[kind] = s.bodies

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(man, null, 1))
console.log(`✓ ${i} sprite → public/empire/sprites (stacks: ${Object.keys(man.stacks).join('،')})`)
if (!existsSync(join(OUT, 'manifest.json'))) process.exit(1)
