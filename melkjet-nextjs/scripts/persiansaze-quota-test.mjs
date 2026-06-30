// تستِ صرفه‌جوییِ سهمیه: آیا re-reveal رایگان است؟ آیا endpointِ رایگانِ
// «پروژه‌های یک سازنده» وجود دارد؟ (با constructorId از یک revealِ قبلی)
//
// روی سرور:
//   PS_CHANNEL=chrome PS_USER=09122862184 PS_PASS='...' node scripts/persiansaze-quota-test.mjs
//   PS_HASH=44511088  PS_CID=2085520   (پیش‌فرض همان موردِ قبلی)

import { launch, api } from './ps-lib.mjs'

const cfg = { user: process.env.PS_USER || '', pass: process.env.PS_PASS || '', channel: process.env.PS_CHANNEL || 'chrome', chrome: process.env.PS_CHROME || '' }
const HASH = process.env.PS_HASH || '44511088'
const CID = process.env.PS_CID || '2085520'

function avail(j) { return j?.updatedAccess?.viewCounter?.availableCount }

async function main() {
  console.log('═══════════ تستِ صرفه‌جوییِ سهمیه ═══════════')
  if (!cfg.user || !cfg.pass) { console.log('⚠ PS_USER/PS_PASS لازم است.'); return }
  const { browser, page } = await launch(cfg)
  console.log('✓ ورود موفق.')

  // ۱) reveal دوبارهٔ همان پروژه (که قبلاً گرفته شده) — سهمیه کم می‌شود؟
  console.log('\n── ۱) reveal دوبارهٔ همان پروژه (آیا رایگان است؟) ──')
  const r1 = await api(page, `/rest/api/user/v1/Project/${HASH}/Constructor`, { method: 'POST', body: '{}' })
  console.log(`   بار اول: status=${r1.json?.status} | سهمیهٔ باقی‌مانده=${avail(r1.json)} | تکراری=${r1.json?.hasVisitedProjectsFromSameConstructor}`)
  await page.waitForTimeout(800)
  const r2 = await api(page, `/rest/api/user/v1/Project/${HASH}/Constructor`, { method: 'POST', body: '{}' })
  console.log(`   بار دوم: status=${r2.json?.status} | سهمیهٔ باقی‌مانده=${avail(r2.json)} | تکراری=${r2.json?.hasVisitedProjectsFromSameConstructor}`)
  const a1 = avail(r1.json), a2 = avail(r2.json)
  if (a1 != null && a2 != null) console.log(`   ⇒ ${a1 === a2 ? '✅ re-revealِ همان پروژه رایگان است (سهمیه ثابت ماند).' : '⚠ سهمیه کم شد (' + a1 + '→' + a2 + ').'}`)

  // ۲) endpointهای احتمالیِ «پروژه‌های یک سازنده» (رایگان؟)
  console.log('\n── ۲) endpointهای احتمالیِ پروژه‌های یک سازنده ──')
  for (const p of [
    `/rest/api/user/v1/Constructor/${CID}`,
    `/rest/api/user/v1/Constructor/${CID}/Projects`,
    `/rest/api/user/v1/Constructor/${CID}/Project`,
    `/rest/api/user/v1/Project/Constructor/${CID}`,
  ]) {
    const r = await api(page, p)
    console.log(`   GET ${p} → ${r.status}  ${r.status === 200 ? (r.text || '').slice(0, 200) : ''}`)
    await page.waitForTimeout(300)
  }

  // ۳) آیا Project/Filter فیلترِ constructorIds را می‌پذیرد؟ (لیستِ پروژه‌های آن سازنده، رایگان)
  console.log('\n── ۳) Project/Filter با constructorIds (رایگان؟) ──')
  const body = JSON.stringify({
    term: '', searchType: 'Project', type: 'All', onlyWithConstructor: true,
    cityIds: [], regionIds: [], subRegionIds: [], phaseIds: [], folderIds: [],
    usageTypesIds: [], structureTypeIds: [], lastPhaseUpdateDateType: null, subscriptionTypes: [],
    constructorIds: [Number(CID)], constructorId: Number(CID),
  })
  const rf = await api(page, `/rest/api/user/v1/Project/Filter?limit=20&offset=0`, { method: 'POST', body })
  let cnt = 0; try { cnt = (rf.json?.results || []).length } catch {}
  console.log(`   status=${rf.status} | نتایج=${cnt}`)
  console.log('   نمونه:', (rf.text || '').slice(0, 300))

  // ۴) «مشاهده‌شده‌ها» — آیا لیستی از سازنده‌های دیده‌شده هست؟
  console.log('\n── ۴) لیستِ مشاهده‌شده‌ها (visited) ──')
  for (const p of [
    `/rest/api/user/v1/Project/Visited?limit=5&offset=0`,
    `/rest/api/user/v1/Visit?limit=5&offset=0`,
    `/rest/api/user/v1/Constructor?limit=5&offset=0`,
  ]) {
    const r = await api(page, p)
    console.log(`   GET ${p} → ${r.status}  ${r.status === 200 ? (r.text || '').slice(0, 150) : ''}`)
    await page.waitForTimeout(300)
  }

  await browser.close()
  console.log('\n═══════════ پایان ═══════════')
}

main().catch(e => { console.error('خطای کلی:', e); process.exit(1) })
