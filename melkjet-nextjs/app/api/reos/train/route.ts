import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getFeatures } from '@/app/lib/reos/store'
import { trainEngageModel, DEFAULT_ENGAGE, buildTrainingSet, type EngageWeights } from '@/app/lib/reos/train'

async function guard() {
  const s = await getSession()
  const ok = !!s && (s.role === 'super_admin' || s.phone === '09122862184')
  return ok
}

// GET /api/reos/train — وزن‌های فعلیِ مدل + وضعیتِ آموزش (فقط مدیر).
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const f = await getFeatures('model', 'engage_v1').catch(() => ({} as Record<string, number>))
  const trained = f && f.trainedAt ? ({ ...DEFAULT_ENGAGE, ...f } as unknown as EngageWeights) : null
  const sampleSize = (await buildTrainingSet().catch(() => [])).length
  return NextResponse.json({ ok: true, trained, defaults: DEFAULT_ENGAGE, sampleSize }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/train — آموزشِ مجددِ مدل از رویدادهای واقعی (فقط مدیر).
export async function POST() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const w = await trainEngageModel()
  return NextResponse.json({
    ok: true,
    weights: w,
    message: w.usedDefault
      ? `دادهٔ کافی برای آموزش نیست (نمونه: ${w.n}) — وزنِ پیش‌فرضِ امن حفظ شد. با تعاملِ بیشترِ کاربران دوباره آموزش دهید.`
      : `مدل با ${w.n} نمونه آموزش دید — AUC=${w.auc}، LogLoss=${w.logloss}.`,
  })
}
