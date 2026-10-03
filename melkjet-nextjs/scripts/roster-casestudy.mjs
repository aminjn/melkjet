// ── فاز ۲۹۷ش — کیس‌استادیِ آگهی‌های «بی‌نام» یک آژانس ─────────────────────────────
// پاسخِ قطعی به «چرا این‌همه آگهی بی‌نام ماند؟» با دادهٔ واقعی، نه حدس:
// توکن‌های بی‌نامِ ذخیره‌شدهٔ همان آژانس را از دیوار می‌کشد، «دقیقاً با دروازه‌های تولید»
// ارزیابی می‌کند و الگوهای خطِ امضای شکست‌خورده را دسته‌بندی می‌کند.
// اجرا (روی سرور):
//   node --import ./scripts/reos-loader.mjs scripts/roster-casestudy.mjs شاهان        ← ۶۰ آگهی
//   node --import ./scripts/reos-loader.mjs scripts/roster-casestudy.mjs شاهان 100
import { readFileSync, existsSync, writeFileSync } from 'fs'
function loadEnv(f) { if (!existsSync(f)) return; for (const l of readFileSync(f, 'utf-8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v } }
loadEnv('.env.production.local'); loadEnv('.env')

const q = process.argv[2]
if (!q) { console.log('استفاده: roster-casestudy.mjs <بخشی از slug یا نامِ آژانس> [تعداد]'); process.exit(1) }
const N = Math.max(5, Math.min(100, parseInt(process.argv[3] || '60', 10) || 60))

const { listScrapes } = await import('../app/lib/agency-roster-store.ts')
const { extractSignature, validName, addressTokens, aiCanonical } = await import('../app/lib/agency-roster.ts')
const { knownNames } = await import('../app/lib/agency-roster-ml.ts')
const { keyOf } = await import('../app/lib/agency-name-lexicon.ts')
const { fetchDivarPost } = await import('../app/lib/divar-post.ts')

const scrapes = await listScrapes()
const s = scrapes.find(x => `${x.slug} ${x.agencyName || ''}`.includes(q))
if (!s) { console.log(`✗ اسکرپی با «${q}» پیدا نشد. موجودها: ${scrapes.map(x => x.slug).join(', ')}`); process.exit(1) }

const fa = (n) => Number(n || 0).toLocaleString('fa-IR')
console.log(`════════ کیس‌استادیِ «${s.agencyName || s.slug}» (${s.slug}) ════════`)
console.log(`مشاورانِ شناخته: ${fa(s.advisors.length)} · کلِ آخرین سینک: ${fa(s.lastTotal)} · بی‌نامِ آخرین سینک: ${fa(s.lastUnnamed)}`)
const tokens = (s.unnamedTokens || []).slice(0, N)
console.log(`توکنِ بی‌نامِ ذخیره‌شده: ${fa((s.unnamedTokens || []).length)} — بررسیِ ${fa(tokens.length)} تای اول…\n`)
if (!tokens.length) { console.log('✗ توکنِ بی‌نامی ذخیره نشده.'); process.exit(0) }

const learned = await knownNames(1)
const rows = []
for (let i = 0; i < tokens.length; i++) {
  const t = tokens[i]
  let title = '', desc = ''
  try { const d = await fetchDivarPost(t); title = (d.title || '').trim(); desc = (d.description || '').trim() } catch (e) { rows.push({ t, err: String(e?.message || e).slice(0, 60) }); continue }
  rows.push({ t, title, desc })
  process.stdout.write(`\r  ${i + 1}/${tokens.length}…`)
  await new Promise(r => setTimeout(r, 500))
}
console.log('')

// همان دروازه‌های تولید: heuristic (extractSignature) + lexicon (تطبیقِ آموخته‌ها در ناحیهٔ امضا).
const lastLines = (desc) => desc.split('\n').map(x => x.trim()).filter(Boolean).slice(-4)
let fetchErr = 0, emptyDesc = 0, nowNamed = [], still = []
for (const r of rows) {
  if (r.err) { fetchErr++; continue }
  if (!r.desc) { emptyDesc++; still.push({ ...r, why: 'متنِ خالی' }); continue }
  const addr = addressTokens(`${r.title}\n${r.desc}`)
  const heur = extractSignature(r.title, r.desc, s.agencyName || '')[0] || ''
  const zone = lastLines(r.desc).join('\n')
  const zoneKey = keyOf(zone)
  let lex = ''
  for (const l of learned) { const k = keyOf(l.name); if (k && zoneKey.includes(k)) { lex = validName(l.name, s.agencyName || '', addr); if (lex) break } }
  const chosen = lex || heur
  if (chosen) nowNamed.push({ t: r.t, name: chosen, via: lex ? 'lexicon' : 'heuristic' })
  else still.push(r)
}

console.log(`─── نتیجه با کدِ فعلی (بدونِ AI) ───`)
console.log(`✅ حالا اسم می‌گیرند (سینکِ بعدی خودکار درست می‌شوند): ${fa(nowNamed.length)}`)
for (const x of nowNamed.slice(0, 15)) console.log(`   ${x.t}  →  ${x.name}  (${x.via})`)
if (nowNamed.length > 15) console.log(`   … و ${fa(nowNamed.length - 15)} تای دیگر`)
console.log(`✗ هنوز بی‌نام: ${fa(still.length)}   (متنِ خالی: ${fa(emptyDesc)} · خطای واکشی: ${fa(fetchErr)})\n`)

// دسته‌بندیِ الگوی «خطِ آخر» بی‌نام‌های واقعی + نمونهٔ کامل برای هر الگو.
const norm = (l) => l.replace(/[0-9۰-۹]/g, '#').replace(/\s+/g, ' ').trim().slice(0, 60)
const buckets = new Map()
for (const r of still) {
  if (!r.desc) continue
  const ll = lastLines(r.desc)
  const key = norm(ll[ll.length - 1] || '(خالی)')
  const b = buckets.get(key) || { n: 0, sample: null }
  b.n++
  if (!b.sample) b.sample = { t: r.t, lines: ll }
  buckets.set(key, b)
}
console.log(`─── الگوهای خطِ آخرِ بی‌نام‌ها (پرتکرار → کم‌تکرار) ───`)
for (const [k, b] of [...buckets.entries()].sort((a, b2) => b2[1].n - a[1].n).slice(0, 18)) {
  console.log(`\n■ ×${fa(b.n)}  «${k}»   (نمونه: ${b.sample.t})`)
  for (const l of b.sample.lines) console.log(`   │ ${l.slice(0, 90)}`)
}

// کاوشِ AI: در تولید اولویتِ اول AI است — اگر AI از کار افتاده باشد (اعتبار/خطا)، علتِ اصلیِ
// حجمِ بی‌نام‌ها همین است. روی ۶ نمونهٔ اول آزمایش می‌کنیم.
console.log(`\n─── کاوشِ مسیرِ AI (اولویتِ اولِ تولید) ───`)
try {
  const probe = still.filter(r => r.desc).slice(0, 6).map((r, i) => ({ i, title: r.title, desc: r.desc }))
  if (probe.length) {
    const res = await aiCanonical(probe)
    const got = Object.values(res.map || {}).filter(Boolean)
    console.log(`AI جواب داد — از ${fa(probe.length)} نمونهٔ بی‌نام، AI برای ${fa(got.length)} اسم داد: ${got.join('، ') || '—'}`)
    if (res.raw) console.log(`پاسخِ خام (۲۰۰ نویسه): ${String(res.raw).replace(/\s+/g, ' ').slice(0, 200)}`)
  } else console.log('نمونه‌ای برای کاوش نماند.')
} catch (e) {
  console.log(`✗ AI خطا داد: ${String(e?.message || e).slice(0, 200)}`)
  console.log('  ⚠ اگر این خطا اعتبار/سهمیه است، علتِ اصلیِ حجمِ بی‌نام‌ها همین است — AI اولویتِ اولِ خوشه‌بندی است.')
}

// گزارشِ کاملِ خام برای تحلیلِ عمیق‌تر.
const out = `.roster-casestudy-${s.slug}.json`
writeFileSync(out, JSON.stringify({ slug: s.slug, agencyName: s.agencyName, nowNamed, still: still.map(r => ({ t: r.t, title: r.title, desc: r.desc })) }, null, 1))
console.log(`\nگزارشِ کامل: ${out}`)
process.exit(0)
