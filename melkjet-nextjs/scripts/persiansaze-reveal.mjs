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
    if (proj) { b.projects.push(proj); if (proj.regionId) b.regions.add(proj.regionId) }
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

  let got = 0, dup = 0, fail = 0, available = null
  const cap = cfg.maxReveals || Infinity
  try {
    for (const proj of pending) {
      if (got >= cap) { log(`به سقفِ ${cap} رسید.`); break }
      const r = await api(page, `/rest/api/user/v1/Project/${proj.hashId}/Constructor`, { method: 'POST', body: '{}' })
      const j = r.json
      if (r.status === 200 && j && j.status === 'NoError' && j.constructor) {
        const c = j.constructor
        reveals.items[proj.hashId] = {
          constructorId: c.id, name: c.name || '', phones: c.mobileNumbers || [],
          hasDup: !!j.hasVisitedProjectsFromSameConstructor, receptor: proj.receptor || '', revealedAt: new Date().toISOString(),
        }
        if (j.hasVisitedProjectsFromSameConstructor) dup++
        got++
        available = j.updatedAccess?.viewCounter?.availableCount ?? available
        if (got % 25 === 0) log(`گرفته‌شده ${got} | سهمیهٔ باقی‌مانده ${available ?? '?'} | تکراری ${dup}`)
        if (available != null && available <= 0) { log('سهمیهٔ هفتگی تمام شد.'); break }
      } else {
        fail++
        // پیامِ خطا (مثلاً اتمامِ سهمیه یا عدمِ دسترسی)
        const st = j?.status || j?.errors?.[0]?.code || r.status
        if (/limit|quota|exceed|access/i.test(String(st)) || r.status === 403) { log(`توقف به‌خاطرِ دسترسی/سهمیه: ${st}`); break }
        if (fail >= 10) { log('۱۰ خطای پیاپی — توقف.'); break }
      }
      await page.waitForTimeout(350)
    }
  } catch (e) { log('خطا:', e.message) }
  await browser.close()

  reveals.meta = { availableCount: available, lastRevealAt: new Date().toISOString(), revealedTotal: Object.keys(reveals.items).length }
  fs.writeFileSync(REVEALS_FILE, JSON.stringify(reveals))
  const profiles = buildProfiles(reveals, projects)
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles))

  console.log('\n═══════════ نتیجه ═══════════')
  console.log(`شمارهٔ گرفته‌شده در این اجرا: ${got}  (تکراری: ${dup}، ناموفق: ${fail})`)
  console.log(`کل گرفته‌شده: ${reveals.meta.revealedTotal}`)
  console.log(`سهمیهٔ باقی‌مانده: ${available ?? '?'} از ۵۰۰`)
  console.log(`پروفایلِ سازنده (یکتا با شناسه): ${Object.keys(profiles).length}`)
  const sample = Object.values(profiles).slice(0, 5)
  console.log('\nنمونه:')
  for (const b of sample) console.log(`   ${b.name}  📞 ${b.phones.join('، ') || '—'}  (${b.projectCount} پروژه)`)
}

main().catch(e => { console.error('خطای کلی:', e); process.exit(1) })
