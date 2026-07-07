import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listVersions, registerModel, promote, setChallenger, getChampion } from '@/app/lib/reos/model-registry'

function admin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/models?name=engage — نسخه‌های مدل + قهرمانِ فعلی (مدیر).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const name = new URL(req.url).searchParams.get('name') || 'engage'
  return NextResponse.json({ ok: true, name, versions: await listVersions(name), champion: await getChampion(name) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/models — {action: register|promote|challenger}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'مدیر' }, { status: 403 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const a = String(b.action || '')
  if (a === 'register') return NextResponse.json({ ok: true, version: await registerModel(String(b.name || 'engage'), (b.weights as Record<string, number>) || {}, (b.metrics as Record<string, number>) || {}) })
  if (a === 'promote') return NextResponse.json({ ok: true, version: await promote(String(b.id)) })
  if (a === 'challenger') { await setChallenger(String(b.id)); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}
