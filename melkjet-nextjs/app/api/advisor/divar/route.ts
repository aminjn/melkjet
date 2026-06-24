import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getDivar, updateDivarConfig, removeImport } from '@/app/lib/advisor-divar-store'
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
      return NextResponse.json({ ok: true, profile: r.profile, imported: r.imported, updated: r.updated, skipped: r.skipped, failed: r.failed, config: getDivar(o) })
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
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
