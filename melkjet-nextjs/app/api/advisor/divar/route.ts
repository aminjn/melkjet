import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getDivar, updateDivarConfig, removeImport, addSource, updateSource, removeSource, getSource, markSourceRun } from '@/app/lib/advisor-divar-store'
import { importDivarInput, syncAdvisorDivar, clearDivarImports } from '@/app/lib/advisor-divar-import'
import { ensureCronStarted } from '@/app/lib/cron-runner'

// پنل «ایمپورت از دیوار» مخصوص هر مشاور (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  ensureCronStarted()
  return NextResponse.json({ config: getDivar(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  ensureCronStarted()
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))

  switch (b.action as string) {
    case 'importUrl': {
      if (!b.url) return NextResponse.json({ error: 'لینک الزامی است' }, { status: 400 })
      const r = await importDivarInput(o, String(b.url))
      if (!r.ok) return NextResponse.json({ error: r.reason || 'ایمپورت ناموفق بود' }, { status: 400 })
      return NextResponse.json({ ok: true, profile: r.profile, imported: r.imported, updated: r.updated, skipped: r.skipped, failed: r.failed, sold: r.sold, config: getDivar(o) })
    }
    case 'clearImports': {
      const r = clearDivarImports(o)
      return NextResponse.json({ ok: true, removed: r.removed, config: getDivar(o) })
    }
    case 'sync': {
      const r = await syncAdvisorDivar(o)
      return NextResponse.json({ ...r, config: getDivar(o) })
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
      const r = await syncAdvisorDivar(o, { ...base, searchUrl: src.searchUrl, divarName: src.divarName, autoPublish: src.autoPublish, autoNeighborhood: src.autoNeighborhood, schedule: src.schedule })
      markSourceRun(o, src.id, r.imported || 0, r.ok ? '' : (r.reason || 'خطا'))
      return NextResponse.json({ ...r, config: getDivar(o) })
    }
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
