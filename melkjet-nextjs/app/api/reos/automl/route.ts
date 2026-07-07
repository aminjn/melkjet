import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { autoMLStatus, runAutoML } from '@/app/lib/reos/automl'

function admin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/automl — وضعیتِ قهرمان/چالش‌گر + آیا ارتقا در انتظار است (فقط سوپرادمین).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const names = (new URL(req.url).searchParams.get('names') || 'engage,lead').split(',').map(x => x.trim()).filter(Boolean)
  const status = await Promise.all(names.map(autoMLStatus))
  return NextResponse.json({ ok: true, status }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/automl — اجرای دستیِ دورِ AutoML (ارزیابی + ارتقای خودکار).
export async function POST() {
  const s = await getSession()
  if (!admin(s)) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const results = await runAutoML()
  const promoted = results.filter(r => r.promoted).map(r => r.name)
  return NextResponse.json({ ok: true, results, message: promoted.length ? `ارتقا یافت: ${promoted.join('، ')}` : 'ارتقایی لازم نبود' })
}
