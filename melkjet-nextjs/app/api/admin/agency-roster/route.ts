import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listScrapes, addScrape, removeScrape, requestRun, requestStop, enqueueGraduate, removeAdvisor, getScrape, getRosterSettings, saveRosterSettings, saveScrapeSchedule, phoneConflict, phoneConflicts, editAdvisor, listDueRosters} from '@/app/lib/agency-roster-store'
import { getCronBeat } from '@/app/lib/cron-heartbeat'
import { debugRoster } from '@/app/lib/agency-roster'
import { rosterCities } from '@/app/lib/agency-roster-city'
import { logAudit } from '@/app/lib/audit-store'

export const maxDuration = 60

async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) ? s : null }
const who = (s: any) => s?.name || s?.phone || 'مدیر'

// GET → فهرستِ اسکرپ‌های آژانس. با ?debug=<slug> → عیب‌یابیِ استخراجِ اسم روی آگهی‌های واقعی.
//        با ?cities=1 → نقشهٔ «آژانس → شهر» (فیلترِ شهرِ پنل).
export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const dbg = req.nextUrl.searchParams.get('debug')
  if (dbg) return NextResponse.json(await debugRoster(dbg), { headers: { 'Cache-Control': 'no-store' } })
  // ۸ اکتبر — عمداً جدا از GETِ اصلی: پنل هنگامِ سینک هر ۴ ثانیه poll می‌کند و این
  // مسیر (برای ردیف‌های بدونِ city) شاردِ advisor می‌خواند. یک‌بار در mount صدا زده
  // می‌شود، نه در هر poll.
  if (req.nextUrl.searchParams.get('cities')) {
    const list = await listScrapes()
    const force = req.nextUrl.searchParams.get('force') === '1'
    return NextResponse.json({ ok: true, cities: await rosterCities(list, force) }, { headers: { 'Cache-Control': 'no-store' } })
  }
  // ?health=1 → وضعیتِ کرون (آیا شبانه اجرا می‌شود؟). جدا از GETِ اصلی تا پولِ ۴ثانیه‌ای سنگین نشود.
  if (req.nextUrl.searchParams.get('health')) {
    const [cron, due] = await Promise.all([getCronBeat(), listDueRosters(Date.now())])
    const scrapes = await listScrapes()
    return NextResponse.json({
      ok: true, cron,
      dueNow: due.length,
      runningNow: scrapes.filter(s => s.running).length,
      serverNow: Date.now(),
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ ok: true, scrapes: await listScrapes(), settings: await getRosterSettings() })
}

// POST { action } → add | sync | graduate | remove
export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as Record<string, any>))
  const action = String(b.action || '')

  if (action === 'add') {
    const r = await addScrape({ slug: String(b.slug || ''), agencyName: b.agencyName, useAI: b.useAI, schedule: b.schedule })
    if (r.ok) logAudit(who(s), 'افزودنِ اسکرپِ آژانس', r.scrape!.slug)
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  }
  if (action === 'scrape-schedule') {
    if (!b.id) return NextResponse.json({ error: 'id لازم است' }, { status: 400 })
    const ok = await saveScrapeSchedule(String(b.id), { autoSync: b.autoSync, startHour: b.startHour, endHour: b.endHour })
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
  }
  if (action === 'settings') {
    const set = await saveRosterSettings({ autoSync: b.autoSync, startHour: b.startHour, endHour: b.endHour })
    logAudit(who(s), 'تنظیمِ زمان‌بندیِ همگام‌سازیِ آژانس', `auto=${set.autoSync} ${set.startHour}→${set.endHour}`)
    return NextResponse.json({ ok: true, settings: set })
  }
  if (action === 'sync') {
    if (!b.id) return NextResponse.json({ error: 'id لازم است' }, { status: 400 })
    const ok = await requestRun(String(b.id))
    return NextResponse.json({ ok, queued: ok, note: ok ? 'در صفِ همگام‌سازیِ اینستنسِ ۰ قرار گرفت' : 'اسکرپ یافت نشد' })
  }
  // همگام‌سازیِ «همهٔ بک‌لاگ» روی تقاضا: همهٔ آژانس‌ها (یا فقط آن‌هایی که امروز سینکِ موفق نداشته‌اند)
  // را در صف می‌گذارد — runRequested پنجرهٔ شب را دور می‌زند و کرونِ سریال یکی‌یکی می‌رساندشان.
  if (action === 'sync-all') {
    const onlyStale = b.onlyStale !== false   // پیش‌فرض: فقط آن‌هایی که امروز سینکِ موفق نداشته‌اند
    const dayAgo = Date.now() - 20 * 3600_000
    const list = await listScrapes()
    const targets = (onlyStale ? list.filter(sc => !sc.lastOkAt || sc.lastOkAt < dayAgo || sc.lastError) : list).filter(sc => !sc.running)
    // فاز ۳۱۳ — «پله‌ای»: دیگر ۱۳۲ آژانس را یک‌جا force نمی‌کنیم (ریشهٔ خفگیِ دیتابیسِ ۱۸ اکتبر —
    // runRequested پنجرهٔ شب را دور می‌زد و همه با هم وسطِ روز دیتابیس را قُرق می‌کردند). فقط
    // N تای کهنه‌ترین را «الان» در صف می‌گذاریم؛ بقیهٔ کهنه‌ها خودکار در پنجرهٔ شبانهٔ (۰–۶) سینک می‌شوند.
    const cap = Math.max(1, Math.min(Number(b.cap) || 8, 40))
    targets.sort((a, c) => (a.lastOkAt || 0) - (c.lastOkAt || 0))
    let n = 0
    for (const sc of targets.slice(0, cap)) { if (await requestRun(sc.id)) n++ }
    logAudit(who(s), 'همگام‌سازیِ بک‌لاگ (پله‌ای)', `${n} آژانس الان؛ ${Math.max(0, targets.length - n)} برای پنجرهٔ شب`)
    return NextResponse.json({ ok: true, queued: n, deferred: Math.max(0, targets.length - n), total: list.length })
  }
  // فاز ۱۹۶ — «⏹ توقفِ همگام‌سازی»: state فوراً بسته می‌شود؛ رانِ زنده در اولین چک می‌ایستد
  if (action === 'stop') {
    const ok = await requestStop(String(b.id))
    return NextResponse.json(ok ? { ok: true } : { ok: false, error: 'اسکرپ یافت نشد' })
  }
  if (action === 'remove') {
    if (!b.id) return NextResponse.json({ error: 'id لازم است' }, { status: 400 })
    await removeScrape(String(b.id))
    logAudit(who(s), 'حذفِ اسکرپِ آژانس', String(b.id))
    return NextResponse.json({ ok: true })
  }
  if (action === 'graduate') {
    if (!b.id || !b.key || !b.phone) return NextResponse.json({ error: 'id/key/phone لازم است' }, { status: 400 })
    // یکتاییِ شماره: اگر به مشاورِ دیگری با نامِ ناسازگار داده شده، جلویش گرفته می‌شود.
    // مسدود نمی‌شود، معلق می‌شود — تصمیمِ نهایی با مدیر است (force).
    if (!b.force) {
      const cf = await phoneConflict(String(b.phone), String(b.id), String(b.key))
      if (cf) return NextResponse.json({
        error: `این شماره از قبل به «${cf.name}» در آژانسِ ${cf.slug} داده شده. اگر همان شخص است، دوباره با تأیید بزنید.`,
        conflict: cf,
      }, { status: 409 })
    }
    const r = await enqueueGraduate(String(b.id), String(b.key), String(b.phone), b.role ? String(b.role) : undefined)
    if (r.ok) { const sc = await getScrape(String(b.id)); logAudit(who(s), 'درخواستِ ساختِ حسابِ مشاور از آژانس', `${sc?.slug || ''} · ${b.key} → ${b.phone}`) }
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  }
  if (action === 'edit-advisor') {
    if (!b.id || !b.key) return NextResponse.json({ error: 'id/key لازم است' }, { status: 400 })
    if (b.phone && !b.force) {
      const cf = await phoneConflict(String(b.phone), String(b.id), String(b.key))
      if (cf) return NextResponse.json({
        error: `این شماره از قبل به «${cf.name}» در آژانسِ ${cf.slug} داده شده.`, conflict: cf,
      }, { status: 409 })
    }
    const r = await editAdvisor(String(b.id), String(b.key), {
      name: b.name != null ? String(b.name) : undefined,
      phone: b.phone != null ? String(b.phone) : undefined,
    })
    if (r.ok) logAudit(who(s), 'ویرایشِ مشاورِ آژانس', `${b.key} → ${b.name || ''} ${b.phone || ''} (${r.moved || 0} فایل منتقل شد)`)
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  }

  if (action === 'conflicts') {
    return NextResponse.json({ ok: true, conflicts: await phoneConflicts() })
  }

  if (action === 'remove-advisor') {
    if (!b.id || !b.key) return NextResponse.json({ error: 'id/key لازم است' }, { status: 400 })
    const r = await removeAdvisor(String(b.id), String(b.key))
    if (r.ok) logAudit(who(s), 'حذفِ مشاور از رُسترِ آژانس', `${b.id} · ${b.key}`)
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  }
  return NextResponse.json({ error: 'action نامعتبر' }, { status: 400 })
}
