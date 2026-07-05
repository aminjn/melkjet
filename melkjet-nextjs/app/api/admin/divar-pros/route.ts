import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listPros, proStats } from '@/app/lib/divar-pro-store'
import { startDiscovery } from '@/app/lib/divar-pro-discovery'
import { logAudit } from '@/app/lib/audit-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' ? s : null }

// GET → فهرستِ pro‌ها + وضعیت. ?export=links → متنِ همهٔ لینک‌ها (برای دانلود/کپی).
export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const exp = new URL(req.url).searchParams.get('export')
  const pros = await listPros()
  if (exp) {
    const body = pros.map(p => p.url).join('\n')
    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="divar-pros.txt"' } })
  }
  const stats = await proStats()
  return NextResponse.json({ ok: true, pros, ...stats })
}

// POST { method:'sitemap'|'search', searchUrl? } → شروعِ کشفِ پس‌زمینه.
export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as Record<string, any>))
  const method = b.method === 'search' ? 'search' : 'sitemap'
  const r = await startDiscovery({ method, searchUrl: b.searchUrl })
  if (r.started) logAudit((s as any).name || (s as any).phone || 'مدیر', 'کشفِ pro دیوار', method)
  return NextResponse.json(r)
}
