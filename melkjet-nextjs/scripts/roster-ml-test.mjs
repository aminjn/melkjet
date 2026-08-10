// ── تستِ «فلایویلِ» ماشین‌لرنینگِ رُسترِ آژانس ──────────────────────────────
// هدف: بسنجیم آیا ML واقعاً با هر بار اجرا، وابستگی به AI را کم می‌کند یا نه.
// کاملاً آفلاین: fetcherهای دیوار و خودِ AI تزریق می‌شوند (opts.f) — هیچ شبکه‌ای.
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/roster-ml-test.mjs
import { buildAgencyRoster } from '../app/lib/agency-roster.ts'
import { knownNames, resetMl, mlStats } from '../app/lib/agency-roster-ml.ts'

const AGENCY = 'املاک نمونه'

// آگهی‌های ساختگیِ آژانس. مشاورهای واقعی چند فایل امضا می‌کنند؛ چند آگهیِ «چرت» هم داریم
// که متن‌شان AI را وسوسه می‌کند اسمِ الکی بسازد. یک دسته آگهیِ «سخت» هم هست که اسمِ مشاور
// در وسطِ متن است (نه بعد از «کارشناس فروش») تا فقط lexicon بتواند بگیردش — نه regex.
const ADS = [
  // رضایی — ۴ فایل، امضای تمیز
  { token: 'aaa001', title: 'آپارتمان ۹۰ متری', desc: 'واحد نوساز فول امکانات. کارشناس فروش: خانم رضایی' },
  { token: 'aaa002', title: 'آپارتمان ۱۲۰ متری', desc: 'خوش‌نقشه با نور عالی. کارشناس فروش خانم رضایی جهت هماهنگی' },
  { token: 'aaa003', title: 'واحد ۷۵ متری', desc: 'بازسازی‌شده. مشاور فروش: رضایی' },
  { token: 'aaa004', title: 'پنت‌هاوس', desc: 'ویو ابدی. جهت راهنمایی خانم رضایی' },
  // کاملی — ۳ فایل
  { token: 'bbb001', title: 'آپارتمان ۱۰۰ متری', desc: 'کلیدنخورده. مشاور فروش آقای کاملی' },
  { token: 'bbb002', title: 'واحد ۸۵ متری', desc: 'قیمت مناسب. کارشناس فروش کاملی' },
  { token: 'bbb003', title: 'آپارتمان اداری', desc: 'موقعیت اداری. جهت هماهنگی آقای کاملی' },
  // مرادی — ۲ فایل
  { token: 'ccc001', title: 'ویلا', desc: 'حیاط‌دار. جهت هماهنگی مرادی' },
  { token: 'ccc002', title: 'زمین', desc: 'سنددار. مشاور فروش مرادی' },
  // آگهی‌های چرت — هیچ مشاورِ واقعی امضا نکرده
  { token: 'zzz001', title: 'فرصت استثنایی', desc: 'همین حالا این فرصت را از دست ندهید. عکس‌ها تزئینی است.' },
  { token: 'zzz002', title: 'فقط امروز', desc: 'فقط فایل قطعی. مستاجر واقعی. رزرو فوری.' },
  { token: 'zzz003', title: 'بهترین موقعیت', desc: 'بهترین موقعیت منطقه با دسترسی عالی.' },
]

// آگهی‌های «سخت» برای پاسِ دوم: اسمِ مشاورِ آموخته‌شده در وسطِ متن، بدونِ کلیدواژهٔ امضا.
// regex اینها را نمی‌گیرد؛ فقط lexiconِ آموخته می‌تواند. ملاکِ واقعیِ «ML کارِ AI را می‌کند».
const HARD_ADS = [
  { token: 'hard01', title: 'آپارتمان ۹۵ متری', desc: 'این واحد را رضایی برای بازدید آماده کرده و امروز خالی است.' },
  { token: 'hard02', title: 'واحد ۱۱۰ متری', desc: 'هماهنگی بازدید با کاملی انجام می‌شود، واحد رو به آفتاب.' },
]

// AIِ شبیه‌سازی‌شدهٔ «نویزی»: برای امضاهای تمیز نامِ درست می‌دهد؛ برای دو آگهیِ چرت،
// عمداً یک عبارتِ الکی «توهم» می‌زند (تا مقاومتِ ضدِّآلودگی را بسنجیم). یک شمارنده هم دارد
// تا ببینیم در هر پاس چند آگهی به AI رفته — این معیارِ اصلیِ «کم‌شدنِ AI» است.
function makeAi(counter) {
  return async (chunk) => {
    counter.calls += chunk.length
    const map = {}
    for (const it of chunk) {
      const d = `${it.title} ${it.desc}`
      if (d.includes('رضایی')) map[it.i] = 'رضایی'
      else if (d.includes('کاملی')) map[it.i] = 'کاملی'
      else if (d.includes('مرادی')) map[it.i] = 'مرادی'
      else if (it.desc.includes('همین حالا')) map[it.i] = 'همین حالا'      // توهمِ AI
      else if (it.desc.includes('مستاجر واقعی')) map[it.i] = 'واقعی مستاجر'  // توهمِ AI
      // بقیه: خالی (AI درست تشخیص می‌دهد اسمی نیست)
    }
    return { map, raw: JSON.stringify(map) }
  }
}

function fetchers(ads, counter) {
  return {
    profileTokens: async () => ({ posts: ads.map(a => ({ token: a.token, title: a.title })), name: AGENCY }),
    post: async (token) => { const a = ads.find(x => x.token === token); return { title: a?.title || '', description: a?.desc || '' } },
    ai: makeAi(counter),
  }
}

async function run(label, ads, useAI) {
  const counter = { calls: 0 }
  const r = await buildAgencyRoster('nemoone-agency', { useAI, f: fetchers(ads, counter) })
  const advisors = r.advisors.map(a => `${a.name}(${a.tokens.length})`)
  return { label, useAI, aiCalls: counter.calls, advisors, unnamed: r.unnamed.tokens.length, scanned: r.scanned }
}

function pretty(x) {
  console.log(`\n── ${x.label} ──  (AI ${x.useAI === false ? 'خاموش' : 'روشن'})`)
  console.log(`   فراخوانِ AI: ${x.aiCalls}   |   بی‌نام: ${x.unnamed}/${x.scanned}`)
  console.log(`   مشاوران: ${x.advisors.join('  ،  ') || '(هیچ)'}`)
}

const main = async () => {
  await resetMl()   // از صفر شروع کن تا فلایویل خالص دیده شود
  console.log('══════════ تستِ فلایویلِ ML رُسترِ آژانس ══════════')

  // پاس ۱: هیچ‌چیز آموخته نشده → AI باید برای همه (۱۲ آگهی) صدا زده شود.
  const p1 = await run('پاس ۱ (شروعِ سرد)', ADS, true); pretty(p1)
  const learned1 = await knownNames(1)
  console.log(`   ML یاد گرفت: ${learned1.map(l => `${l.name}[w${l.weight}]`).join('، ') || '(هیچ)'}`)

  // پاس ۲: همان آگهی‌ها، دوباره با AI روشن. اگر ML کار کند، باید فراخوانِ AI به‌شدت کم شود
  // (نام‌های آموخته دیگر نباید به AI بروند). این «کم‌شدنِ AI»یی است که کاربر می‌خواهد.
  const p2 = await run('پاس ۲ (بعد از یادگیری)', ADS, true); pretty(p2)

  // پاس ۳: با AI کاملاً خاموش + آگهی‌های سخت (اسم وسطِ متن). فقط lexicon می‌تواند بگیرد.
  const p3 = await run('پاس ۳ (AI خاموش + آگهیِ سخت)', [...ADS, ...HARD_ADS], false); pretty(p3)

  // داوری
  console.log('\n══════════ داوری ══════════')
  const junkLearned = (await knownNames(1)).filter(l => /همین|واقعی|مستاجر|فقط|تزئین|قطعی/.test(l.name))
  const junkAdvisors = p1.advisors.filter(a => /همین|واقعی|مستاجر|فقط|تزئین|قطعی/.test(a))
  const hardHit = p3.advisors.some(a => a.startsWith('رضایی')) && p3.advisors.some(a => a.startsWith('کاملی'))
  console.log(`M1 آلودگی — اسمِ چرت در ML: ${junkLearned.map(l => l.name).join('،') || 'هیچ ✅'} ${junkLearned.length ? '❌' : ''}`)
  console.log(`M1b چرت در فهرستِ مشاوران پاس ۱: ${junkAdvisors.join('،') || 'هیچ ✅'} ${junkAdvisors.length ? '❌' : ''}`)
  console.log(`M2 کم‌شدنِ AI — پاس۱=${p1.aiCalls} → پاس۲=${p2.aiCalls}  ${p2.aiCalls < p1.aiCalls ? `✅ (${Math.round((1 - p2.aiCalls / p1.aiCalls) * 100)}٪ کمتر)` : '❌ اصلاً کم نشد'}`)
  console.log(`M3 پوششِ بدونِ AI (آگهیِ سخت با lexicon): ${hardHit ? '✅ رضایی و کاملی گرفته شد' : '❌ lexicon نتوانست'}`)
  console.log('')
}
main().catch(e => { console.error(e); process.exit(1) })
