import { NextRequest, NextResponse } from 'next/server'
import { requireAndBumpUsage } from '@/app/lib/plan-usage'
import { requireModule } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import { getDivar, updateDivarConfig, removeImport, addSource, updateSource, removeSource, getSource } from '@/app/lib/advisor-divar-store'
import { importDivarInput, startBackgroundSync, clearDivarImports, resumeJob } from '@/app/lib/advisor-divar-import'
import { getJob, getJobNormalized, stopJob } from '@/app/lib/advisor-divar-job'
import { ensureCronStarted } from '@/app/lib/cron-runner'

// پنل «ایمپورت از دیوار» مخصوص هر مشاور (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  ensureCronStarted()
  return NextResponse.json({ config: getDivar(s.phone), job: getJobNormalized(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  ensureCronStarted()
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))

  try {
  switch (b.action as string) {
    case 'importUrl': {
      if (!b.url) return NextResponse.json({ error: 'لینک الزامی است' }, { status: 400 })
      const r = await importDivarInput(o, String(b.url))
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ایمپورت ناموفق بود' }, { status: 400 })
      return NextResponse.json({ ok: true, profile: r.profile, imported: r.imported, updated: r.updated, skipped: r.skipped, failed: r.failed, sold: r.sold, config: getDivar(o) })
    }
    case 'clearImports': {
      const r = await clearDivarImports(o)
      return NextResponse.json({ ok: true, removed: r.removed, config: getDivar(o) })
    }
    case 'sync': {
      { const u52 = await requireAndBumpUsage(s as any, 'divarImports', 1); if (u52) return NextResponse.json(u52, { status: 403 }) }   // فاز ۵۲: سهمیهٔ ماهانهٔ پلن
      // در پس‌زمینه اجرا می‌شود و تا پایان ادامه می‌یابد حتی اگر کاربر صفحه را ببندد.
      const r = startBackgroundSync(o, undefined, undefined, 'همگام‌سازیِ دیوار')
      return NextResponse.json({ ok: true, ...r, job: getJob(o), config: getDivar(o) })
    }
    case 'jobStatus': {
      return NextResponse.json({ ok: true, job: getJobNormalized(o) })
    }
    case 'resumeJob': {
      resumeJob(o)
      return NextResponse.json({ ok: true, job: getJob(o) })
    }
    case 'stopJob': {
      return NextResponse.json({ ok: true, job: stopJob(o) })
    }
    case 'setConfig': {
      const cfg = updateDivarConfig(o, {
        divarName: b.divarName, searchUrl: b.searchUrl, schedule: b.schedule,
        autoPublish: b.autoPublish, autoNeighborhood: b.autoNeighborhood,
      })
      return NextResponse.json({ ok: true, config: cfg })
    }
    case 'removeImport': {
      if (!b.token) return NextResponse.json({ error: 'توکن الزامی است' }, { status: 400 })
      removeImport(o, String(b.token))
      return NextResponse.json({ ok: true, config: getDivar(o) })
    }
    // ── منابعِ متعددِ اسکرپ ──
    case 'addSource': {
      addSource(o, { name: b.name, searchUrl: b.searchUrl, divarName: b.divarName, schedule: b.schedule, autoPublish: b.autoPublish, autoNeighborhood: b.autoNeighborhood })
      return NextResponse.json({ ok: true, config: getDivar(o) })
    }
    case 'updateSource': {
      if (!b.id) return NextResponse.json({ error: 'شناسهٔ منبع الزامی است' }, { status: 400 })
      updateSource(o, String(b.id), { name: b.name, searchUrl: b.searchUrl, divarName: b.divarName, schedule: b.schedule, autoPublish: b.autoPublish, autoNeighborhood: b.autoNeighborhood })
      return NextResponse.json({ ok: true, config: getDivar(o) })
    }
    case 'removeSource': {
      if (!b.id) return NextResponse.json({ error: 'شناسهٔ منبع الزامی است' }, { status: 400 })
      removeSource(o, String(b.id))
      return NextResponse.json({ ok: true, config: getDivar(o) })
    }
    case 'syncSource': {
      const src = getSource(o, String(b.id))
      if (!src) return NextResponse.json({ error: 'منبع یافت نشد' }, { status: 404 })
      if (!src.searchUrl.trim()) return NextResponse.json({ error: 'لینکِ این منبع خالی است' }, { status: 400 })
      const base = getDivar(o)
      const r = startBackgroundSync(o, { ...base, searchUrl: src.searchUrl, divarName: src.divarName, autoPublish: src.autoPublish, autoNeighborhood: src.autoNeighborhood, schedule: src.schedule }, src.id, src.name || 'همگام‌سازیِ منبع')
      return NextResponse.json({ ok: true, ...r, job: getJob(o), config: getDivar(o) })
    }
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطای داخلیِ سرور هنگامِ خواندن از دیوار' }, { status: 500 })
  }
}
