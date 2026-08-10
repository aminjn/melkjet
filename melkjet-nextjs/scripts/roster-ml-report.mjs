// ── گزارش/بذرپاشی/سنجشِ دقتِ ماشین‌لرنینگِ رُسترِ آژانس (روی دادهٔ واقعیِ سرور) ──────────
// سه زیرفرمان:
//   (بدونِ آرگومان)   وضعیت: ماشین تا الان چند نام یاد گرفته؟ (admin/ai، وزن‌ها) — آفلاین
//   seed              بذرپاشی: از همهٔ مشاورانِ کشف‌شدهٔ انباشته، لِکسیکون را پر کن — آفلاین
//   accuracy <slug>   دقت: یک آژانسِ واقعی را اسکرپ کن و «نظرِ ML» را با «نظرِ AI» بسنج — نیازمندِ دیوار
// اجرا (روی سرور):  node --import ./scripts/reos-loader.mjs scripts/roster-ml-report.mjs [seed|accuracy <slug>]
import { listScrapes } from '../app/lib/agency-roster-store.ts'
import { buildAgencyRoster, validName } from '../app/lib/agency-roster.ts'
import { knownNames, mlStats, learnName } from '../app/lib/agency-roster-ml.ts'

const ZWNJ = /‌/g
const keyOf = (s) => { const t = String(s || '').replace(ZWNJ, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim(); return /^[A-Za-z]+$/.test(t) ? t.toUpperCase() : t }
const pct = (n, d) => d ? Math.round((n / d) * 100) : 0

async function showState() {
  const s = await mlStats()
  const trusted = (await knownNames(2)).length
  console.log('══════════ وضعیتِ فعلیِ ماشین‌لرنینگ ══════════')
  console.log(`  نام‌های یادگرفته‌شده : ${s.learned}   (ادمین‌تأیید: ${s.byAdmin} ، AI: ${s.byAi})`)
  console.log(`  «مورد اعتماد» (وزن≥۲، مجازِ short-circuitِ AI) : ${trusted}`)
  console.log(`  منفی‌ها (فراموش‌شده) : ${s.negatives}`)
  console.log(`  ۲۰ نامِ پروزن‌تر : ${s.top.map(t => `${t.name}[w${t.weight}${t.teacher === 'admin' ? '،ادمین' : ''}]`).join('  ،  ') || '(خالی)'}`)
  if (!s.learned) console.log('\n  ⚠️ لِکسیکون خالی است — «seed» را اجرا کن تا از دادهٔ انباشته پر شود.')
}

async function seed() {
  const scrapes = await listScrapes()
  let adminSeeded = 0, aiSeeded = 0, skipped = 0
  for (const sc of scrapes) {
    for (const a of sc.advisors || []) {
      const nm = validName(a.name || '', sc.agencyName)   // همان گیتِ چرت‌وپرت‌زدایی
      if (!nm) { skipped++; continue }
      const files = a.listingCount || (a.tokens?.length || 0)
      if (a.phone || a.graduatedAt) { await learnName(nm, 'admin'); adminSeeded++ }        // انسان‌تأییدشده = طلا
      else if (files >= 2) { await learnName(nm, 'ai', files); aiSeeded++ }                 // ≥۲ فایل = تأییدشده
      else skipped++
    }
  }
  console.log('══════════ بذرپاشی از دادهٔ انباشته ══════════')
  console.log(`  اسکرپ‌ها: ${scrapes.length}   |   ادمین‌تأیید: +${adminSeeded}   |   ≥۲فایل: +${aiSeeded}   |   ردشده(چرت/تک‌فایلی): ${skipped}`)
  console.log('')
  await showState()
}

// دقتِ واقعی: آژانس را یک‌بار اسکرپ می‌کنیم؛ «رانِ A» با AI (مرجع)، «رانِ B» فقط با ML+heuristic
// روی همان متنِ کش‌شده (بدونِ دیوارِ دوباره، بدونِ AI). بعد نظرِ ML را با نظرِ AI مقایسه می‌کنیم.
async function accuracy(slug) {
  if (!slug) { console.log('استفاده: accuracy <slug-یا-لینکِ آژانس>'); return }
  console.log(`══════════ سنجشِ دقت روی آژانسِ واقعی: ${slug} ══════════`)
  const cache = {}
  const onRow = (tok, r) => { if (r?.desc) cache[tok] = r }
  console.log('  رانِ A (با AI — مرجع)…')
  const A = await buildAgencyRoster(slug, { useAI: true, onRow })
  if (!A.ok) { console.log(`  ❌ ${A.error}`); return }
  // متنِ خالص (بدونِ نامِ AI) برای رانِ B تا واقعاً «فقط ML» بسنجیم، نه پژواکِ AI.
  const textOnly = {}
  for (const [k, v] of Object.entries(cache)) textOnly[k] = { title: v.title, desc: v.desc }
  console.log('  رانِ B (فقط ML+heuristic، بدونِ AI، روی همان متن)…')
  const B = await buildAgencyRoster(slug, { useAI: false, cached: textOnly })

  const refMap = new Map(), mlMap = new Map()
  for (const adv of A.advisors) for (const t of adv.tokens) refMap.set(t, adv.name)
  for (const adv of B.advisors) for (const t of adv.tokens) mlMap.set(t, adv.name)

  let refNamed = 0, mlCovered = 0, agree = 0, disagree = 0
  for (const [tok, refName] of refMap) {
    refNamed++
    const ml = mlMap.get(tok)
    if (!ml) continue
    mlCovered++
    if (keyOf(ml) === keyOf(refName)) agree++; else disagree++
  }
  console.log('\n── نتیجه ──')
  console.log(`  کلِ آگهی‌ها: ${A.scanned}   |   AI اسم داد: ${refNamed}   |   ML(بدونِ AI) اسم داد: ${mlMap.size}`)
  console.log(`  پوششِ ML (چند٪ از آگهی‌های نام‌دارِ AI را ML هم بدونِ AI می‌گیرد): ${pct(mlCovered, refNamed)}٪  (${mlCovered}/${refNamed})`)
  console.log(`  دقتِ ML (هرجا ML و AI هردو اسم دادند، چند٪ یکی‌اند): ${pct(agree, mlCovered)}٪  (توافق ${agree} ، اختلاف ${disagree})`)
  console.log(`  یعنی اگر امشب این آژانس دوباره اجرا شود، ~${pct(mlCovered, refNamed)}٪ آگهی‌ها بدونِ AI و با دقتِ ~${pct(agree, mlCovered)}٪ حل می‌شوند.`)
  console.log('')
}

const cmd = process.argv[2]
const main = async () => {
  if (cmd === 'seed') await seed()
  else if (cmd === 'accuracy') await accuracy(process.argv[3])
  else await showState()
}
main().catch(e => { console.error(e); process.exit(1) })
