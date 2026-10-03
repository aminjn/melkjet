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
const { extractSignature, validName, addressTokens, aiCanonical, lexiconMatch } = await import('../app/lib/agency-roster.ts')
const { knownNames } = await import('../app/lib/agency-roster-ml.ts')
const { fetchDivarPost } = await import('../app/lib/divar-post.ts')

// «عینِ» تولید: سینکِ واقعی قبل از شروع مدل‌ها را prime می‌کند (agency-roster-store) —
// بدونِ این، nameProbSync=null و مدلِ خلوت غایب است و نتیجه با تولید فرق می‌کند (دورِ ۳ کیس‌استادی).
const { primeNameModel } = await import('../app/lib/roster-name-model.ts')
const { loadNer } = await import('../app/lib/roster-ner.ts')
const primed = await primeNameModel().catch(() => false)
const nerLoaded = !!(await loadNer().catch(() => null))
console.log(`مدل‌ها: nameProb=${primed ? '✓' : '✗ (آموزش‌ندیده)'} · NER=${nerLoaded ? '✓' : '✗'}`)

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

// «عینِ» تصمیمِ تولید برای هر آگهی: chosen = AI || cand[0] (extractSignature = مدل+دروازه‌ها).
// واژه‌نامه در تولید «به‌تنهایی» آگهی تصاحب نمی‌کند (قانونِ موضع، فاز ۲۸۰) — فقط اطلاع.
const lastLines = (desc) => desc.split('\n').map(x => x.trim()).filter(Boolean).slice(-4)
let fetchErr = 0, emptyDesc = 0, nowNamed = [], still = [], lexInfo = []
for (const r of rows) {
  if (r.err) { fetchErr++; continue }
  if (!r.desc) { emptyDesc++; still.push({ ...r, why: 'متنِ خالی' }); continue }
  const addr = addressTokens(`${r.title}\n${r.desc}`)
  const heur = extractSignature(r.title, r.desc, s.agencyName || '')[0] || ''
  const lex = validName(lexiconMatch(`${r.title}\n${r.desc}`, learned), s.agencyName || '', addr)
  if (heur) nowNamed.push({ t: r.t, name: heur })
  else { still.push(r); if (lex) lexInfo.push({ t: r.t, lex }) }
}

console.log(`─── نتیجه با «تصمیمِ واقعیِ تولید» (مدل/heuristic، بدونِ AI) ───`)
console.log(`✅ اسم می‌گیرند: ${fa(nowNamed.length)}`)
const byName = new Map()
for (const x of nowNamed) byName.set(x.name, (byName.get(x.name) || 0) + 1)
for (const [n, c] of [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`   ×${fa(c)}  ${n}`)
console.log(`✗ بی‌نام می‌مانند: ${fa(still.length)}   (متنِ خالی: ${fa(emptyDesc)} · خطای واکشی: ${fa(fetchErr)})`)
if (lexInfo.length) {
  console.log(`\nℹ واژه‌نامه برای ${fa(lexInfo.length)} تای بی‌نام «پیشنهاد» دارد (در تولید فقط برای مشاورِ تثبیت‌شدهٔ همین آژانس اعمال می‌شود):`)
  for (const x of lexInfo.slice(0, 10)) console.log(`   ${x.t}  ~  ${x.lex}`)
}
console.log('')

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

// کاوشِ AI: از فاز ۲۹۷خ شناساییِ نام «کاملاً ML-only» است و AI در تولید دخالت ندارد.
// این بخش فقط «اطلاعاتی» است: اگر گپ شارژ شود، AI چه نام‌هایی اضافه می‌کرد.
console.log(`\n─── کاوشِ مسیرِ AI (اطلاعاتی — در تولید غیرفعال است؛ ML-only) ───`)
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

// گزارشِ کاملِ خام برای تحلیلِ عمیق‌تر — در /tmp تا با مالکِ rootِ پوشهٔ اپ EACCES نخورد.
const out = `/tmp/roster-casestudy-${s.slug}.json`
writeFileSync(out, JSON.stringify({ slug: s.slug, agencyName: s.agencyName, nowNamed, still: still.map(r => ({ t: r.t, title: r.title, desc: r.desc })) }, null, 1))
console.log(`\nگزارشِ کامل: ${out}`)
process.exit(0)
