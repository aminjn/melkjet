import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { createExperiment, listExperiments, getExperiment, results, recordExposure, recordConversion, assignVariant } from '@/app/lib/reos/experiments'

function admin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/experiment            → فهرست + نتایج (مدیر)
// GET /api/reos/experiment?assign=ID  → واریانتِ کاربرِ فعلی (چسبنده)
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const assign = sp.get('assign')
  if (assign) { const e = await getExperiment(assign); if (!e) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 }); return NextResponse.json({ ok: true, variant: assignVariant(s.phone, e.id, e.variants, e.weights) }) }
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const exps = await listExperiments()
  const withResults = await Promise.all(exps.map(async e => ({ ...e, results: await results(e) })))
  return NextResponse.json({ ok: true, experiments: withResults }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/experiment — {action: create|expose|convert}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const a = String(b.action || '')
  if (a === 'create') { if (!admin(s)) return NextResponse.json({ error: 'مدیر' }, { status: 403 }); return NextResponse.json({ ok: true, experiment: await createExperiment({ name: String(b.name || 'آزمایش'), variants: (b.variants as string[]) || ['A', 'B'], weights: b.weights as number[], metric: b.metric ? String(b.metric) : undefined }) }) }
  if (a === 'expose') { await recordExposure(String(b.expId), String(b.variant)); return NextResponse.json({ ok: true }) }
  if (a === 'convert') { await recordConversion(String(b.expId), String(b.variant), Number(b.value) || 0); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}
