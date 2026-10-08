// ── اصلاحِ نامِ مشاورانِ graduateشده‌ای که آشکارا خراب‌اند («شهریار هستم» → «شهریار») ──
// چرا لازم است: مشاورِ graduateشده پین است، پس سینک نامش را عوض نمی‌کند — حتی بعد از اینکه
// استخراج درست شد. این‌ها رکوردهای کهنه‌اند (پیش از فیکسِ selfIntro). نامِ تمیز هم به رُستر و
// هم به حساب/پروفایل (منبعِ نامِ دایرکتوری) می‌نشیند. نام‌های تازه از اول درست‌اند.
//
// اجرا (اول فقط گزارش):
//   cd /var/www/melkjet/melkjet-nextjs && set -a && . ./.env.production.local && set +a
//   node --import ./scripts/reos-loader.mjs scripts/roster-fix-graduated-names.mjs
// و برای اصلاح:  … scripts/roster-fix-graduated-names.mjs --apply

const APPLY = process.argv.includes('--apply')
const { listScrapes, editAdvisor } = await import('../app/lib/agency-roster-store.ts')
const { isNoiseWord } = await import('../app/lib/agency-name-lexicon.ts')

// توکن‌هایی که هرگز بخشی از نام نیستند (فعلِ «بودن» و معرفی) + هر واژهٔ نوفه.
const BAD = new Set(['هستم', 'هستیم', 'هستند', 'هست', 'باشم', 'میباشم', 'می‌باشم', 'بنده', 'اینجانب', 'عزیزان', 'عزیز', 'شما'])
function cleanName(name) {
  const toks = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (toks.length < 2) return ''                         // تک‌کلمه‌ای = چیزی برای پاک‌کردن نیست
  const keep = toks.filter(t => !BAD.has(t) && !isNoiseWord(t))
  const out = keep.join(' ')
  if (out && out !== toks.join(' ') && keep.length >= 1 && keep.length <= 3) return out
  return ''
}

const scrapes = await listScrapes()
let found = 0, fixed = 0
for (const s of scrapes) {
  for (const a of (s.advisors || [])) {
    if (!a.phone) continue                               // فقط graduateشده‌ها (پین)
    const cleaned = cleanName(a.name)
    if (!cleaned) continue
    found++
    console.log(`«${a.name}» → «${cleaned}»   (${s.agencyName || s.slug} · ${a.phone})`)
    if (APPLY) {
      const r = await editAdvisor(s.id, a.key, { name: cleaned })
      console.log(r.ok ? '   ✓ اصلاح شد (رُستر + حساب + پروفایل)' : `   ✗ ${r.error}`)
      if (r.ok) fixed++
    }
  }
}
console.log(`\n${found} نامِ خرابِ graduateشده پیدا شد` + (APPLY ? `، ${fixed} اصلاح شد.` : ' — برای اصلاح: --apply'))
if (found && !APPLY) console.log('(نام‌های تازه از اول درست‌اند؛ این فقط رکوردهای کهنهٔ پیش از فیکس است.)')
