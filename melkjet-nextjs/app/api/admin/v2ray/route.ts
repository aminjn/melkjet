import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { applyV2ray, stopV2ray, testV2ray, v2rayStatus, buildOutbounds } from '@/app/lib/v2ray'

async function guard() {
  const s = await getSession()
  return s && (s.role === 'super_admin' || (s.staff || []).length > 0)
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const cfg = getAdminData().v2ray || {}
  return NextResponse.json({
    status: v2rayStatus(),
    link: cfg.link || '',
    enabled: !!cfg.enabled,
    httpPort: cfg.httpPort || 10809,
    socksPort: cfg.socksPort || 10808,
    binPath: cfg.binPath || '',
  })
}

// POST { link?, enabled?, httpPort?, socksPort?, binPath?, action? }
// action: 'apply' (ذخیره + اجرا/ری‌لود) | 'stop' | 'test' | 'count' (فقط تعدادِ سرورِ لینک)
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const data = getAdminData()
  data.v2ray = data.v2ray || {}

  if (b.action === 'test') return NextResponse.json(await testV2ray())
  if (b.action === 'count') return NextResponse.json({ servers: (await buildOutbounds(String(b.link ?? data.v2ray.link ?? ''))).length })

  if (typeof b.link === 'string') data.v2ray.link = b.link.trim()
  if (typeof b.enabled === 'boolean') data.v2ray.enabled = b.enabled
  if (b.httpPort != null && Number(b.httpPort) > 0) data.v2ray.httpPort = Number(b.httpPort)
  if (b.socksPort != null && Number(b.socksPort) > 0) data.v2ray.socksPort = Number(b.socksPort)
  if (typeof b.binPath === 'string') data.v2ray.binPath = b.binPath.trim()
  saveAdminData(data)

  if (b.action === 'stop') { stopV2ray(); return NextResponse.json({ ok: true, status: v2rayStatus() }) }

  // ذخیره + اعمال (اجرا یا توقف بر اساسِ enabled). اعمالِ واقعی فقط روی اینستنسِ کرون اتفاق می‌افتد.
  const res = await applyV2ray()
  return NextResponse.json({ ok: res.ok, applyError: res.error, servers: res.servers, status: v2rayStatus() })
}
