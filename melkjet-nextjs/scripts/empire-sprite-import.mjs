#!/usr/bin/env node
// 🎨 فاز ۱۶۴ — واردکنندهٔ پکِ اسپرایت (Kenney و مشابه، CC0) → public/empire/sprites + manifest.json
// کاربرد:  node scripts/empire-sprite-import.mjs <پوشه‌یا-zipِ استخراج‌شده> [<پوشهٔ دیگر> ...]
// - PNGها را با واژه‌های نامِ فایل دسته‌بندی می‌کند (building/house/shop/tower/road/car/tree/...)
// - ابعاد را مستقیم از هدرِ IHDRِ خودِ PNG می‌خواند (بدونِ هیچ وابستگی)
// - ساختمان‌های هر دسته را بر اساسِ ارتفاعِ تصویر (کوتاه→بلند) مرتب می‌کند تا نگاشتِ طبقه درست باشد
// - خروجی: کپیِ فایل‌ها با نامِ نرمال + public/empire/sprites/manifest.json
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'

const OUT = join(process.cwd(), 'public', 'empire', 'sprites')
const args = process.argv.slice(2)
if (!args.length) { console.error('پوشهٔ پکِ استخراج‌شده را بده: node scripts/empire-sprite-import.mjs <dir> [...]'); process.exit(1) }

function pngSize(file) {
  const b = readFileSync(file)
  if (b.length < 24 || b.readUInt32BE(12) !== 0x49484452) return null   // IHDR
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}
function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    const st = statSync(p)
    if (st.isDirectory()) yield* walk(p)
    else if (extname(f).toLowerCase() === '.png') yield p
  }
}

const K = (s) => s.toLowerCase()
const CAT = [
  ['landmark', /landmark|monument|tower.?big|skyscraper.?large|cathedral|castle/],
  ['office', /office|skyscraper|glass|corporate|highrise|high-rise/],
  ['shop', /shop|store|market|awning|commercial|restaurant|cafe/],
  ['villa', /house|home|villa|cottage|suburban|residential(?!s)/],
  ['apartment', /apartment|building|block|condo|flat/],
]
const GROUND = [
  ['cross', /cross|intersection|4way|four/],
  ['roadNS', /road.*(ns|vertical|north)|street.*(ns|vertical)/],
  ['roadEW', /road.*(ew|horizontal|east)|street.*(ew|horizontal)/],
  ['road', /road|street|asphalt/],
  ['grass', /grass|lot|ground|dirt|park(?!ing)|tile.*green|green.*tile/],
]
const OTHER = [
  ['vehicles', /car|vehicle|truck|van|taxi|police|bus/],
  ['props', /tree|bush|fountain|billboard|bench|lamp|hydrant|sign|plant|flower/],
]

const man = { tileW: 0, ground: { grass: [] }, buildings: {}, vehicles: [], props: [] }
const roads = { roadNS: null, roadEW: null, cross: null, any: [] }
let copied = 0

mkdirSync(OUT, { recursive: true })
for (const root of args) {
  if (!existsSync(root)) { console.error('نبود:', root); continue }
  for (const p of walk(root)) {
    const size = pngSize(p)
    if (!size) continue
    const name = K(basename(p))
    const rel = `${copied.toString(36)}-${basename(p).replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const def = { file: rel, w: size.w, h: size.h }
    let placed = false
    for (const [cat, re] of OTHER) { if (re.test(name)) { man[cat].push(def); placed = true; break } }
    if (!placed) for (const [cat, re] of GROUND) {
      if (re.test(name)) {
        if (cat === 'grass') man.ground.grass.push(def)
        else if (cat === 'road') roads.any.push(def)
        else roads[cat] = roads[cat] || def
        placed = true; break
      }
    }
    if (!placed) for (const [cat, re] of CAT) { if (re.test(name)) { (man.buildings[cat] = man.buildings[cat] || []).push(def); placed = true; break } }
    if (!placed && /iso|building/.test(name)) { (man.buildings.generic = man.buildings.generic || []).push(def) }
    if (placed || /iso|building/.test(name)) { copyFileSync(p, join(OUT, rel)); copied++ }
  }
}
// جاده‌ها: اگر جهت‌دار پیدا نشد از عمومی‌ها بردار
if (!roads.roadNS && roads.any[0]) roads.roadNS = roads.any[0]
if (!roads.roadEW && (roads.any[1] || roads.any[0])) roads.roadEW = roads.any[1] || roads.any[0]
if (roads.roadNS) man.ground.roadNS = roads.roadNS
if (roads.roadEW) man.ground.roadEW = roads.roadEW
if (roads.cross) man.ground.cross = roads.cross
// مرتب‌سازیِ ساختمان‌ها کوتاه→بلند (نگاشتِ طبقه) و tileW از پهن‌ترین کاشیِ چمن
for (const k of Object.keys(man.buildings)) man.buildings[k].sort((a, b) => a.h - b.h)
man.tileW = Math.max(0, ...man.ground.grass.map(g => g.w))
if (!man.tileW && man.ground.roadNS) man.tileW = man.ground.roadNS.w

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(man, null, 1))
const bl = Object.entries(man.buildings).map(([k, v]) => `${k}:${v.length}`).join(' ')
console.log(`✓ ${copied} اسپرایت کپی شد → public/empire/sprites`)
console.log(`  زمین: چمن ${man.ground.grass.length}، جاده ${man.ground.roadNS ? '✓' : '✗'}/${man.ground.roadEW ? '✓' : '✗'}، تقاطع ${man.ground.cross ? '✓' : '✗'} · ساختمان‌ها: ${bl || '—'} · خودرو ${man.vehicles.length} · دکور ${man.props.length}`)
if (!man.ground.grass.length || !Object.keys(man.buildings).length) console.log('⚠️ دسته‌بندیِ ناقص — نامِ فایل‌های پک را بفرست تا الگوها را تنظیم کنم')
