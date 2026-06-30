// موتورِ گرفتنِ شمارهٔ سازنده‌ها — POST Project/{hash}/Constructor.
// با احترام به سهمیهٔ هفتگی (۵۰۰)، شماره و نامِ سازنده را می‌گیرد و پروفایل‌ها را
// بر اساسِ constructor.id (سازندهٔ واقعی) می‌سازد.
//
// روی سرور:
//   PS_CHANNEL=chrome PS_USER=09122862184 PS_PASS='...' node scripts/persiansaze-reveal.mjs
//   (اختیاری) PS_MAX_REVEALS=10  → فقط ۱۰ تا برای تست
//   کانفیگ از env یا .persiansaze-config.json.

import fs from 'node:fs'
import path from 'node:path'
import { launch, api } from './ps-lib.mjs'

const CWD = process.cwd()
const CONFIG_FILE = path.join(CWD, '.persiansaze-config.json')
const DATA_FILE = path.join(CWD, '.persiansaze-data.json')
const REVEALS_FILE = path.join(CWD, '.persiansaze-reveals.json')
const PROFILES_FILE = path.join(CWD, '.persiansaze-profiles.json')
const PHASES_FILE = path.join(CWD, '.persiansaze-phases.json')
const REGIONS_FILE = path.join(CWD, '.persiansaze-regions.json')

const log = (...a) => console.log(new Date().toLocaleTimeString('en-GB'), ...a)
function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } }

function loadConfig() {
  const c = readJson(CONFIG_FILE, {})
  return {
    user: process.env.PS_USER || c.user || '',
    pass: process.env.PS_PASS || c.pass || '',
    channel: process.env.PS_CHANNEL || c.channel || 'chrome',
    chrome: process.env.PS_CHROME || c.chrome || '',
    maxReveals: Number(process.env.PS_MAX_REVEALS || 0), // 0 = تا پایانِ سهمیه
  }
}

// ترتیب: round-robin بر اساسِ receptor تا هر بار یک سازندهٔ «جدید» (تقریبی) بیاید
// و سهمیه بیشترین تعدادِ سازندهٔ یکتا را پوشش دهد.
function orderPending(projects, revealed) {
  const groups = new Map()
  for (const p of projects) {
    if (!p.hashId || revealed[p.hashId]) continue
    const key = (p.receptor || '').trim() || p.hashId
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(p)
  }
  const lists = [...groups.values()]
  const out = []
  let round = 0, added = true
  while (added) {
    added = false
    for (const l of lists) { if (l[round]) { out.push(l[round]); added = true } }
    round++
  }
  return out
}

function buildProfiles(reveals, projects) {
  const byHash = new Map(projects.map(p => [p.hashId, p]))
  const byCons = new Map()
  for (const [hash, rv] of Object.entries(reveals.items || {})) {
    const cid = String(rv.constructorId)
    if (!byCons.has(cid)) byCons.set(cid, { id: cid, name: rv.name || '', phones: new Set(), projects: [], regions: new Set(), revealedAt: rv.revealedAt })
    const b = byCons.get(cid)
    for (const ph of rv.phones || []) b.phones.add(ph)
    if (rv.name && !b.name) b.name = rv.name
    const proj = byHash.get(hash)
    if (proj) {
      if (rv.photos?.length) proj.photos = rv.photos
      // جزئیاتِ کامل (آدرسِ کامل، مختصات، متراژ، طبقات) جایگزینِ دادهٔ بُریدهٔ لیست می‌شود.
      const d = rv.detail
      if (d) {
        if (d.address) proj.address = d.address
        if (d.latitude != null) proj.latitude = d.latitude
        if (d.longitude != null) proj.longitude = d.longitude
        if (d.floors != null) proj.floors = d.floors
        if (d.subFloors != null) proj.subFloors = d.subFloors
        if (d.units != null) proj.units = d.units
        if (d.groundArea != null) proj.groundArea = d.groundArea
        if (d.residentialArea != null) proj.residentialArea = d.residentialArea
        if (d.phaseId != null) proj.phaseId = d.phaseId
        if (d.phaseName) proj.phaseName = d.phaseName
        if (d.regionName) proj.regionName = d.regionName
        if (d.subRegionName) proj.subRegionName = d.subRegionName
      }
      b.projects.push(proj); if (proj.regionId) b.regions.add(proj.regionId)
    }
  }
  const profiles = {}
  for (const b of byCons.values()) {
    profiles[b.id] = { id: b.id, name: b.name, phones: [...b.phones], projects: b.projects, regions: [...b.regions], projectCount: b.projects.length, revealedAt: b.revealedAt }
  }
  return profiles
}

async function main() {
  const cfg = loadConfig()
  console.log('═══════════ گرفتنِ شمارهٔ سازنده‌ها ═══════════')
  if (!cfg.user || !cfg.pass) { console.log('⚠ یوزر/پسورد تنظیم نشده.'); process.exit(1) }
  const data = readJson(DATA_FILE, { projects: [] })
  const projects = data.projects || []
  if (!projects.length) { console.log('⚠ اول اسکرپ کن (پروژه‌ای نیست).'); process.exit(1) }
  const reveals = readJson(REVEALS_FILE, { meta: {}, items: {} })
  if (!reveals.items) reveals.items = {}

  const pending = orderPending(projects, reveals.items)
  log(`کل پروژه‌ها: ${projects.length} | گرفته‌شده: ${Object.keys(reveals.items).length} | در انتظار: ${pending.length}`)
  if (!pending.length) { console.log('✓ همهٔ پروژه‌ها قبلاً گرفته شده‌اند.'); process.exit(0) }

  let session
  try { session = await launch(cfg) } catch (e) { console.log('✗', e.message); process.exit(1) }
  const { browser, page } = session
  log('✓ ورود موفق.')

  const reveal = (hash) => api(page, `/rest/api/user/v1/Project/${hash}/Constructor`, { method: 'POST', body: '{}' })
  // جزئیاتِ کاملِ یک پروژه از endpointِ Detail (GET، رایگان/فقط‌خواندن): عکس‌ها + آدرسِ
  // کامل (لیست، آدرس را با «...» می‌بُرد ولی Detail کامل است) + مختصات/متراژ/طبقات.
  const fetchDetail = async (hash) => {
    try {
      const r = await api(page, `/rest/api/user/v1/Project/${hash}`)
      const j = r.json || {}
      const photos = (j.photos || []).map(x => x.imageUrl || x.imageThumbnailUrl).filter(Boolean)
      return {
        photos,
        address: j.address || '',
        latitude: j.latitude, longitude: j.longitude,
        floors: j.floors, subFloors: j.subFloors, units: j.units,
        groundArea: j.groundArea, residentialArea: j.residentialArea,
        phaseId: j.phaseId,
        phaseName: j.phaseName || j.phaseTitle || j.phase?.name || j.phase?.title || j.phaseFa || '',
        regionId: j.regionId,
        regionName: j.regionName || j.region?.name || j.region?.title || j.regionTitle || '',
        subRegionName: j.subRegionName || j.subRegion?.name || '',
      }
    } catch { return { photos: [] } }
  }

  // backfill: برای reveal‌های قبلی که عکس یا آدرسِ کامل ندارند، جزئیات را بگیر (رایگان).
  {
    let bf = 0
    for (const [hash, rv] of Object.entries(reveals.items)) {
      if (rv.photos?.length && rv.detail?.address) continue
      const d = await fetchDetail(hash)
      if (d.photos?.length) rv.photos = d.photos
      if (d.address || d.latitude != null) rv.detail = d
      if (d.photos?.length || d.address) bf++
      await page.waitForTimeout(120)
      if (bf >= 600) break
    }
    if (bf) { log(`جزئیاتِ ${bf} پروژهٔ قبلی گرفته شد (backfill: عکس + آدرسِ کامل).`); fs.writeFileSync(REVEALS_FILE, JSON.stringify(reveals)) }
  }
  // محدودهٔ دسترسی: فقط شهر/منطقه را سخت فیلتر می‌کنیم (قطعی). مرحله را از پیش رد نمی‌کنیم —
  // هر مرحله را امتحان می‌کنیم و اگر مرحله‌ای واقعاً بسته بود، بعد از چند ردِ پیاپی یاد می‌گیریم.
  let scope = null
  const inScope = (p) => {
    if (!scope) return true
    if (scope.cityIds?.length && !scope.cityIds.includes(p.cityId)) return false
    if (scope.regionIds?.length && !scope.regionIds.includes(p.regionId)) return false
    // مرحله‌ها هم محدودند (تأییدشده). از phaseIdsِ اشتراک استفاده کن تا وقت روی مرحله‌های بسته هدر نرود.
    if (scope.phaseIds?.length && !scope.phaseIds.includes(p.phaseId)) return false
    return true
  }
  const blockedPhases = new Set(), phaseDenied = {}, phaseOk = new Set()

  let got = 0, dup = 0, denied = 0, skipped = 0, available = null, consecDenied = 0
  const cap = cfg.maxReveals || Infinity
  // محدوده و سهمیه را از یک پروژهٔ قبلاً‌گرفته‌شده (رایگان) یا 44511088 بخوان
  try {
    const probeHash = Object.keys(reveals.items)[0] || '44511088'
    const pr = await reveal(probeHash)
    if (pr.json?.updatedAccess) {
      const ua = pr.json.updatedAccess
      scope = { cityIds: ua.cityIds || [], regionIds: ua.regionIds || [], phaseIds: ua.phaseIds || [] }
      available = ua.viewCounter?.availableCount ?? available
      log(`محدودهٔ دسترسی: شهر=${JSON.stringify(scope.cityIds)} منطقه=${JSON.stringify(scope.regionIds)} مرحله=${JSON.stringify(scope.phaseIds)} | سهمیهٔ باقی‌مانده=${available ?? '?'}`)
    }
  } catch { /* بی‌خیال، بدونِ scope ادامه می‌دهیم */ }

  try {
    for (const proj of pending) {
      if (got >= cap) { log(`به سقفِ ${cap} رسید.`); break }
      if (available != null && available <= 0) { log('سهمیهٔ هفتگی تمام شد.'); break }
      if (!inScope(proj)) { skipped++; continue } // خارج از شهر/منطقهٔ مجاز — بدونِ مصرفِ سهمیه رد کن
      if (blockedPhases.has(proj.phaseId)) { skipped++; continue } // مرحله‌ای که یاد گرفتیم بسته است
      const r = await reveal(proj.hashId)
      const j = r.json
      if (r.status === 200 && j && j.status === 'NoError' && j.constructor) {
        const c = j.constructor
        const detail = await fetchDetail(proj.hashId)
        reveals.items[proj.hashId] = {
          constructorId: c.id, name: c.name || '', phones: c.mobileNumbers || [],
          hasDup: !!j.hasVisitedProjectsFromSameConstructor, receptor: proj.receptor || '', revealedAt: new Date().toISOString(),
          photos: detail.photos || [], detail: (detail.address || detail.latitude != null) ? detail : undefined,
        }
        if (j.hasVisitedProjectsFromSameConstructor) dup++
        got++; consecDenied = 0
        if (proj.phaseId) phaseOk.add(proj.phaseId)
        available = j.updatedAccess?.viewCounter?.availableCount ?? available
        if (got % 25 === 0) { log(`گرفته‌شده ${got} | سهمیهٔ باقی‌مانده ${available ?? '?'} | تکراری ${dup} | ردشده(محدوده) ${skipped}`); fs.writeFileSync(REVEALS_FILE, JSON.stringify({ ...reveals, meta: { availableCount: available, lastRevealAt: new Date().toISOString(), revealedTotal: Object.keys(reveals.items).length } })) }
      } else {
        // AccessDenied → رد کن و ادامه بده. یادگیریِ مرحله‌های بسته:
        denied++; consecDenied++
        const ph = proj.phaseId
        if (ph) { phaseDenied[ph] = (phaseDenied[ph] || 0) + 1; if (phaseDenied[ph] >= 8 && !phaseOk.has(ph)) { blockedPhases.add(ph); log(`مرحلهٔ ${ph} بسته است (۸ ردِ پیاپی) — از این به بعد ردش می‌کنم.`) } }
        // اگر روی همه‌چیز پشتِ‌سرِ‌هم رد می‌خوریم، احتمالاً سهمیه تمام شده
        if (consecDenied >= 60) { log(`۶۰ ردِ پیاپی — احتمالاً سهمیه تمام شده. توقف.`); break }
      }
      await page.waitForTimeout(300)
    }
  } catch (e) { log('خطا:', e.message) }
  await browser.close()

  reveals.meta = { availableCount: available, lastRevealAt: new Date().toISOString(), revealedTotal: Object.keys(reveals.items).length, gotLast: got }
  fs.writeFileSync(REVEALS_FILE, JSON.stringify(reveals))
  const profiles = buildProfiles(reveals, projects)
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles))

  // نگاشتِ نامِ مرحله‌ها (phaseId→name) از جزئیاتِ گرفته‌شده — تا سایت نامِ واقعی نشان دهد.
  const phasesMap = readJson(PHASES_FILE, {})
  for (const rv of Object.values(reveals.items)) {
    const d = rv.detail
    if (d && d.phaseId != null && d.phaseName) phasesMap[d.phaseId] = d.phaseName
  }
  fs.writeFileSync(PHASES_FILE, JSON.stringify(phasesMap))
  log(`نگاشتِ مرحله‌ها: ${Object.keys(phasesMap).length} مرحله شناخته شد.`)

  // نگاشتِ نامِ منطقه‌ها (regionId→name) از جزئیات — تا «منطقه ۱۲۳» با نامِ واقعی نشان داده شود.
  const regionsMap = readJson(REGIONS_FILE, {})
  for (const rv of Object.values(reveals.items)) {
    const d = rv.detail
    if (d && d.regionId != null && d.regionName) regionsMap[d.regionId] = d.regionName
  }
  fs.writeFileSync(REGIONS_FILE, JSON.stringify(regionsMap))
  log(`نگاشتِ منطقه‌ها: ${Object.keys(regionsMap).length} منطقه شناخته شد.`)

  console.log('\n═══════════ نتیجه ═══════════')
  console.log(`شمارهٔ گرفته‌شده در این اجرا: ${got}  (تکراری: ${dup}، خارج‌محدوده‌ردشده: ${skipped}، AccessDenied: ${denied})`)
  console.log(`کل گرفته‌شده: ${reveals.meta.revealedTotal}`)
  console.log(`سهمیهٔ باقی‌مانده: ${available ?? '?'} از ۵۰۰`)
  console.log(`پروفایلِ سازنده (یکتا با شناسه): ${Object.keys(profiles).length}`)
  const sample = Object.values(profiles).slice(0, 5)
  console.log('\nنمونه:')
  for (const b of sample) console.log(`   ${b.name}  📞 ${b.phones.join('، ') || '—'}  (${b.projectCount} پروژه)`)
}

main().catch(e => { console.error('خطای کلی:', e); process.exit(1) })
