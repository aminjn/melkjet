// ── تستِ «فهمِ آگهی» توسط ماشین‌لرنینگ روی آگهی‌های واقعیِ سرور ──────────────────────
// چند آگهیِ واقعی (پیش‌فرض ۳تا، ترجیحاً متفاوت) برمی‌دارد و تحلیلِ محلیِ ML را نشان می‌دهد
// تا ببینی جزئیات را درست درمی‌آورد و آگهی‌های مختلف را تفکیک می‌کند. کاملاً آفلاین (بدونِ AI).
// اجرا (روی سرور):  node --import ./scripts/reos-loader.mjs scripts/analyze-test.mjs [N | id1 id2 ...]
import { readFileSync, existsSync } from 'fs'
function loadEnv(f) { if (!existsSync(f)) return; for (const l of readFileSync(f, 'utf-8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v } }
loadEnv('.env.production.local'); loadEnv('.env')

const { listItems } = await import('../app/lib/scraper-store.ts')
const { analyzeListing } = await import('../app/lib/analyze.ts')

const args = process.argv.slice(2)
const ids = args.filter(a => !/^\d+$/.test(a))
const N = Number(args.find(a => /^\d+$/.test(a))) || 3

const all = await listItems('listing')
if (!all.length) { console.log('هیچ آگهی‌ای در دیتابیس نیست (DATABASE_URL؟).'); process.exit(0) }

// انتخاب: اگر id داده شد همان‌ها، وگرنه ۳ آگهیِ «متفاوت» (فروش/اجاره/نوعِ ملکِ غیرآپارتمان).
let picked = []
if (ids.length) picked = all.filter(i => ids.includes(i.id))
else {
  const has = (i, re) => re.test(`${i.title || ''} ${i.price || ''} ${i.meta?.['نوع معامله'] || ''}`)
  const rent = all.find(i => has(i, /ودیعه|اجاره|رهن/) && !has(i, /فروش/))
  const other = all.find(i => /ویلا|زمین|مغازه|اداری|کلنگی|باغ/.test(`${i.title || ''} ${i.meta?.['نوع ملک'] || ''}`))
  const sale = all.find(i => has(i, /فروش/) && i !== other)
  picked = [...new Set([sale, rent, other].filter(Boolean))]
  for (const i of all) { if (picked.length >= N) break; if (!picked.includes(i)) picked.push(i) }
  picked = picked.slice(0, N)
}

console.log(`════════ تستِ فهمِ آگهی توسط ماشین (${picked.length} آگهیِ واقعی) ════════\n`)
for (const it of picked) {
  const payload = { title: it.title, price: it.price, location: it.location, description: it.excerpt || '', meta: it.meta || {} }
  const t = process.hrtime.bigint()
  const r = await analyzeListing(payload)
  const ms = Number(process.hrtime.bigint() - t) / 1e6
  const a = r.analysis
  console.log('─'.repeat(70))
  console.log(`🏠 «${(it.title || '').slice(0, 60)}»`)
  console.log(`   قیمت: ${it.price || '—'}  |  موقعیت: ${it.location || '—'}`)
  console.log(`   متنِ خام: ${(it.excerpt || '').replace(/\s+/g, ' ').slice(0, 120)}…`)
  if (!a) { console.log(`   ❌ ${r.error}`); continue }
  console.log(`   ⏱ ${ms.toFixed(1)}ms توسطِ «${a.by === 'ml' ? 'ماشین‌لرنینگ (بدونِ AI)' : 'AI'}»`)
  console.log(`   📋 فکت‌ها: ${(a.facts || []).map(f => `${f.label}=${f.value}`).join(' ، ') || '—'}`)
  console.log(`   ✨ امکانات: ${(a.amenities || []).join('، ') || '—'}`)
  console.log(`   📝 خلاصه: ${a.summary}`)
  console.log(`   ➕ قوت: ${(a.pros || []).join(' | ')}`)
  console.log(`   ➖ ضعف: ${(a.cons || []).join(' | ')}`)
  console.log(`   📊 امتیازها: ${Object.entries(a.scores || {}).map(([k, v]) => `${k} ${v}`).join(' ، ')}`)
  console.log(`   🎯 اطمینان: ${a.confidence}٪   رشدِ سالانه: ${a.priceTrend?.yearGrowth}`)
  console.log('')
}
console.log('نکته: ماشین جزئیاتِ عینی را استخراج و امتیاز/خلاصه می‌سازد. آگهی‌های مختلف → فکت/امتیازِ مختلف.')
process.exit(0)
