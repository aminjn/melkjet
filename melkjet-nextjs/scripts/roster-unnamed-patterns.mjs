#!/usr/bin/env node
// ── عیب‌یابیِ «چرا اینها بی‌نام ماندند؟» برای یک آژانس (فاز ۳۱۵) ──────────────────
// به‌جای اینکه کاربر ۶۵۶ آگهی را دونه‌دونه ببیند و بگوید، این اسکریپت همهٔ آگهی‌های آژانس را
// یک‌بار می‌خواند، *عینِ* تابعِ تولید (extractSignature) را روی هرکدام اجرا می‌کند، و آنهایی را
// که همچنان بی‌نام می‌مانند بر اساسِ «قالبِ خطِ امضا» دسته‌بندی می‌کند. خروجی: هیستوگرامِ
// الگوهای شکست (پرتکرارترین اول) + چند نمونهٔ خام. فقط‌خواندنی — هیچ چیزی در دیتابیس/روستر
// تغییر نمی‌کند، هیچ سینکی اجرا نمی‌شود.
//
// اجرا (روی سرور):
//   cd /var/www/melkjet/melkjet-nextjs
//   node --import ./scripts/reos-loader.mjs scripts/roster-unnamed-patterns.mjs <slug|لینکِ‌برند> [سقفِ‌آگهی]
// مثال:  node --import ./scripts/reos-loader.mjs scripts/roster-unnamed-patterns.mjs saran-amlak
// خروجی هم در ترمینال چاپ می‌شود و هم در /tmp/roster-unnamed-<slug>.json ذخیره می‌شود.
import { readFileSync, existsSync, writeFileSync } from 'node:fs'

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

const slugArg = process.argv[2]
const limit = Number(process.argv[3]) || 100000
if (!slugArg) { console.error('استفاده: … roster-unnamed-patterns.mjs <slug|لینکِ‌برند> [سقفِ‌آگهی]'); process.exit(1) }

const { fetchDivarProfileTokens, fetchDivarPost, divarProfileSlug } = await import('../app/lib/divar-post.ts')
const { extractSignature } = await import('../app/lib/agency-roster.ts')

const slug = divarProfileSlug(slugArg) || slugArg.trim()
const sleep = ms => new Promise(r => setTimeout(r, ms))

console.log(`→ واکشیِ فهرستِ آگهی‌های «${slug}» از دیوار …`)
const { posts, name, reason } = await fetchDivarProfileTokens(slug)
if (!posts.length) { console.error(`آگهی‌ای یافت نشد (${reason || '؟'}) — آیا پروکسی بالاست؟`); process.exit(1) }
console.log(`آژانس: ${name || '(بی‌نام)'}   کلِ آگهی‌ها: ${posts.length}   (پردازشِ ${Math.min(limit, posts.length)} تا)\n`)

// ── ابزارِ «اثرِ انگشتِ خطِ امضا» ────────────────────────────────────────────────
// نقشِ «شخص‌دار» (جای نامِ مشاور) بر نقشِ «برندِ عام» (املاک/مسکن که در شعارِ آژانس هم هست) مقدم است،
// تا اثرِ انگشت خطِ «کارشناس … منطقه ∎» را بگیرد نه شعارِ «با املاک … باشید».
const ROLE_PERSON = /(کارشناسِ?\s*فروش|مشاورِ?\s*فروش|کارشناس|مشاورین|مشاوران|مشاور|فروشنده|نماینده|منطقه|امضا|احترام|تشکر|هماهنگی|راهنمایی|خدمت|همراه)/
const ROLE_ANY = /(کارشناس|مشاور|فروشنده|نماینده|منطقه|املاک|مسکن|امضا|احترام|تشکر|هماهنگی|راهنمایی|تماس|خدمت|همراه)/
const clean = s => String(s || '').replace(/[ـ]/g, '').replace(/[^؀-ۿ A-Za-z0-9\s:：.\-،؛]/g, ' ').replace(/[ \t]+/g, ' ')
const linesOf = s => clean(s).split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
// اثرِ انگشت: خطِ امضا (آخرین خطِ دارای کلیدواژهٔ شخص‌دار؛ وگرنه هر کلیدواژه؛ وگرنه آخرین خط) با
// توکنِ پایانی (احتمالِ نام) و توکنِ پس از «منطقه/محله» ماسک‌شده (∎) و ارقام #، تا «… منطقه
// رامتین/فراهانی» یک خوشه شوند و خودِ قالب (نه نام) دیده شود.
function fingerprint(desc) {
  const ls = linesOf(desc)
  if (!ls.length) return { fp: '(متنِ خالی)', line: '' }
  const pick = re => { for (let k = ls.length - 1; k >= 0 && k >= ls.length - 6; k--) if (re.test(ls[k])) return k; return -1 }
  let i = pick(ROLE_PERSON); if (i < 0) i = pick(ROLE_ANY)
  const line = i >= 0 ? ls[i] : ls[ls.length - 1]
  const toks = line.split(/\s+/)
  // توکنِ پایانیِ فارسی → ماسک
  for (let k = toks.length - 1; k >= 0; k--) { if (/[؀-ۿ]{2,}/.test(toks[k])) { toks[k] = '∎'; break } }
  // توکنِ پس از منطقه/محله/ناحیه → ماسک
  for (let k = 0; k < toks.length - 1; k++) { if (/^(منطقه|محله|ناحیه|محدوده)$/.test(toks[k].replace(/ی/g, 'ی'))) toks[k + 1] = '∎' }
  const fp = toks.join(' ').replace(/[0-9۰-۹]+/g, '#').trim()
  return { fp, line }
}

let named = 0, unnamed = 0, emptyDesc = 0, done = 0
const buckets = new Map()   // fp → { count, examples:[{line, token, tail}] }
for (const p of posts.slice(0, limit)) {
  let title = p.title || '', desc = ''
  try { const d = await fetchDivarPost(p.token); title = (d.title || title || '').trim(); desc = (d.description || '').trim() } catch {}
  done++
  if (!desc) { emptyDesc++; await sleep(500); continue }
  const got = extractSignature(title, desc, name)
  if (got && got.length) { named++ }
  else {
    unnamed++
    const { fp, line } = fingerprint(desc)
    let b = buckets.get(fp); if (!b) { b = { count: 0, examples: [] }; buckets.set(fp, b) }
    b.count++
    if (b.examples.length < 4) b.examples.push({ token: p.token, line, tail: linesOf(desc).slice(-4).join(' ⏎ ').slice(0, 240) })
  }
  if (done % 25 === 0) { console.log(`… ${done}/${Math.min(limit, posts.length)}  (نام‌دار ${named} · بی‌نام ${unnamed} · متن‌خالی ${emptyDesc})`); await sleep(0) }
  await sleep(500)
}

const sorted = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count)
console.log(`\n══════════ خلاصه ══════════`)
console.log(`کلِ پردازش‌شده: ${done}   نام‌دار: ${named}   بی‌نام: ${unnamed}   متنِ خالی (دیوار نداد): ${emptyDesc}`)
console.log(`الگوهای شکستِ متمایز: ${sorted.length}\n`)
console.log(`── پرتکرارترین الگوهای «بی‌نام» (قالبِ خطِ امضا؛ ∎ = جای نام) ──`)
let shown = 0
for (const [fp, b] of sorted) {
  if (shown++ >= 40) { console.log(`… و ${sorted.length - 40} الگوی دیگر (در JSON)`); break }
  console.log(`\n[${b.count}×]  ${fp}`)
  for (const e of b.examples.slice(0, 2)) console.log(`      مثال: ${e.line}`)
}

const outPath = `/tmp/roster-unnamed-${slug}.json`
writeFileSync(outPath, JSON.stringify({ slug, agency: name, total: posts.length, processed: done, named, unnamed, emptyDesc,
  patterns: sorted.map(([fp, b]) => ({ fp, count: b.count, examples: b.examples })) }, null, 2), 'utf-8')
console.log(`\n✅ خروجیِ کامل در: ${outPath}`)
console.log('   این فایل را برایم بفرست (یا محتوایش را پیست کن) تا همهٔ الگوها را یک‌جا ببینم و با هم رفعشان کنم.')
