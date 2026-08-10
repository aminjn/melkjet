// ── سنجش/آموزشِ ماشین‌لرنینگِ ممیزیِ آگهی (روی دادهٔ واقعیِ سرور) ─────────────────────
// هدف: رساندنِ «تصمیمِ خودکارِ ممیزی» به ۹۹٪ حجم × ۹۹٪ صحت — با استفاده از کلِ ۲۶هزار آگهیِ تصمیم‌گرفته.
// زیرفرمان‌ها:
//   (بدون آرگومان)  stats  — وضعیتِ مدل + نسبتِ تصمیمِ خودکار به AI
//   sweep [N]              — مبادلهٔ «پوشش/آستانه»: در هر آستانه چند٪ آگهی را مدل خودش تصمیم می‌گیرد
//   backtest [N]           — هم‌خوانیِ حکمِ مدل با وضعیتِ ذخیره‌شده، تفکیکِ «مطمئن/نامطمئن» (با احتیاطِ زیر)
//   train                  — آموزش از کلِ آرشیوِ تصمیم‌گرفته (۲۶هزار) → پوششِ اطمینان می‌پرد
// اجرا (روی سرور):  node --import ./scripts/reos-loader.mjs scripts/moderation-ml.mjs [sweep|backtest|train] [N]
import { readFileSync, existsSync } from 'fs'
function loadEnv(f) { if (!existsSync(f)) return; for (const l of readFileSync(f, 'utf-8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v } }
loadEnv('.env.production.local'); loadEnv('.env')

const { listItems } = await import('../app/lib/scraper-store.ts')
const { predict, mlStats } = await import('../app/lib/moderation-ml.ts')
const { trainFromArchive } = await import('../app/lib/moderation.ts')
const pct = (n, d) => d ? Math.round((n / d) * 1000) / 10 : 0

async function decided(limit) {
  const items = await listItems('listing')
  const d = items.filter(i => i.status === 'approved' || i.status === 'rejected')
  return limit ? d.slice(0, limit) : d
}

async function stats() {
  const s = await mlStats()
  const total = s.autoDecided + s.aiDecided
  console.log('══════════ وضعیتِ ممیزیِ ماشین‌لرنینگ ══════════')
  console.log(`  آموزش‌دیده روی: ${s.approvedSamples + s.rejectedSamples} سند (تأیید ${s.approvedSamples} / رد ${s.rejectedSamples}) ، واژگان ${s.vocab}`)
  console.log(`  آماده: ${s.ready ? 'بله' : 'خیر'} ، آستانهٔ اطمینان: ${s.confidence}`)
  console.log(`  تصمیم‌ها → خودکار(ML): ${s.autoDecided}  ،  با AI: ${s.aiDecided}   ⇒  ML سهمِ ${pct(s.autoDecided, total)}٪`)
  console.log(`  صحت روی بازبینیِ انسانی (سختِ مبهم): ${s.recentAgreePct ?? '—'}٪ از ${s.recentReviewed ?? 0} مورد`)
  console.log(`  تصحیحِ ادمین: ${s.adminTaught} ، اصلاحیه: ${s.corrections}`)
}

// مبادلهٔ پوشش/آستانه — بدونِ برچسبِ حقیقت، فقط «مدل روی چند٪ به این آستانه می‌رسد».
async function sweep(N = 2000) {
  const items = (await listItems('listing')).slice(0, N)
  const preds = items.map(predict).filter(p => p.ready)
  console.log(`══════════ مبادلهٔ پوشش/آستانه (روی ${preds.length} آگهی) ══════════`)
  console.log('  آستانه   پوششِ خودکار (٪ آگهی‌هایی که مدل به‌تنهایی تصمیم می‌گیرد)')
  for (const t of [0.90, 0.92, 0.95, 0.97, 0.98, 0.99]) {
    const cov = preds.filter(p => p.prob >= t).length
    console.log(`   ${t.toFixed(2)}     ${String(pct(cov, preds.length)).padStart(5)}٪   (${cov}/${preds.length})`)
  }
  console.log('  ↑ آستانهٔ بالاتر = پوششِ کمتر ولی مطمئن‌تر. نقطهٔ ۹۹/۹۹ را با backtest می‌سنجیم.')
}

// هم‌خوانیِ مدل با وضعیتِ ذخیره‌شده. ⚠️ احتیاط: بخشی از این وضعیت‌ها را خودِ ML ست کرده،
// پس این «سازگاری» است نه صحتِ مستقل. برای همین «مطمئن» را جدا گزارش می‌کنیم و در قدمِ بعد با AI می‌سنجیم.
async function backtest(N = 3000) {
  const items = await decided(N)
  let confN = 0, confAgree = 0, allAgree = 0
  const perT = [0.92, 0.95, 0.97, 0.99].map(t => ({ t, cov: 0, agree: 0 }))
  for (const it of items) {
    const p = predict(it)
    if (!p.ready) continue
    if (p.label === it.status) allAgree++
    if (p.confident) { confN++; if (p.label === it.status) confAgree++ }
    for (const r of perT) if (p.prob >= r.t) { r.cov++; if (p.label === it.status) r.agree++ }
  }
  console.log(`══════════ backtest روی ${items.length} آگهیِ تصمیم‌گرفته ══════════`)
  console.log(`  هم‌خوانیِ کلی (هر پیش‌بینی): ${pct(allAgree, items.length)}٪`)
  console.log(`  هم‌خوانیِ «تصمیم‌های مطمئن» (آستانهٔ فعلی): ${pct(confAgree, confN)}٪  روی ${confN} مورد`)
  console.log('  ── به تفکیکِ آستانه ──')
  console.log('  آستانه   پوشش٪   صحت(هم‌خوانی)٪')
  for (const r of perT) console.log(`   ${r.t.toFixed(2)}    ${String(pct(r.cov, items.length)).padStart(5)}   ${String(pct(r.agree, r.cov)).padStart(5)}`)
  console.log('  ⚠️ چون بخشی از وضعیت‌ها را خودِ ML زده، این «سازگاری» است؛ صحتِ مستقل را قدمِ بعد با AI می‌سنجیم.')
}

async function train() {
  const before = await mlStats()
  if (before.approvedSamples > 20000) { console.log(`  ⚠️ مدل قبلاً روی ${before.approvedSamples} سند آموزش دیده — trainFromArchive افزایشی است، دوباره اجرا نکن (تکرار می‌شود).`); return }
  console.log('  در حالِ آموزش از کلِ آرشیوِ تصمیم‌گرفته…')
  const r = await trainFromArchive()
  const after = await mlStats()
  console.log('══════════ آموزش از آرشیو ══════════')
  console.log(`  افزوده شد: تأیید +${r.approved} ، رد +${r.rejected}`)
  console.log(`  اسناد: ${before.approvedSamples + before.rejectedSamples} → ${after.approvedSamples + after.rejectedSamples}  ،  واژگان: ${before.vocab} → ${after.vocab}`)
  console.log('  حالا «sweep» را دوباره بزن تا جهشِ پوشش را ببینی، بعد آستانه را تنظیم می‌کنیم.')
}

const cmd = process.argv[2]; const N = Number(process.argv[3]) || undefined
if (cmd === 'sweep') await sweep(N)
else if (cmd === 'backtest') await backtest(N)
else if (cmd === 'train') await train()
else await stats()
process.exit(0)
