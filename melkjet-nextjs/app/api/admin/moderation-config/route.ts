import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { DEFAULT_CRITERIA, modConfig } from '@/app/lib/moderation'
import { mlStats, resetMl } from '@/app/lib/moderation-ml'

// معیارهای ممیزیِ آگهی (سوپرادمین): متنِ معیارها + آستانه‌های امتیاز + قانونِ قیمت.
// AI بر اساسِ این‌ها تصمیم می‌گیرد و ML از تصمیم‌ها یاد می‌گیرد تا کم‌کم خودش انجام دهد.
export async function GET() {
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).includes('moderation'))) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })   // فاز ۱۲۵: پرسنلِ بخشِ مربوط هم
  const cfg = modConfig()
  return NextResponse.json({ config: cfg, defaultCriteria: DEFAULT_CRITERIA, ml: mlStats() })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).includes('moderation'))) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })   // فاز ۱۲۵: پرسنلِ بخشِ مربوط هم
  const b = await req.json().catch(() => ({} as any))
  // ریستِ مدلِ یادگیرنده (وقتی مسموم شده و همه‌چیز را رد می‌کند).
  if (b.resetMl) { resetMl(); return NextResponse.json({ ok: true, reset: true, ml: mlStats() }) }
  // فاز ۱۳۸: بازممیزیِ ردشده‌های خودکارِ قبلی با قانونِ جدید (رد فقط با مدرکِ قطعیِ تماس).
  if (b.requeueAutoRejected) {
    const { requeueAutoRejected } = await import('@/app/lib/scraper-store')
    const requeued = await requeueAutoRejected()
    return NextResponse.json({ ok: true, requeued })
  }
  // فاز ۱۴۸ (فیدبک: «راهی بذار ماشین لرنینگ را بسنجم») — سنجشِ زندهٔ یک آگهیِ فرضی، بدونِ هیچ ذخیره/آموزشی:
  // پیش‌بینیِ مدل + دلایل + مدرکِ تماس + حکمی که پایپ‌لاین می‌گرفت. قبل/بعدِ آموزشِ دستی قابلِ مقایسه است.
  if (b.test && typeof b.test === 'object') {
    const t = b.test as { title?: string; excerpt?: string; price?: string }
    const pseudo = { title: String(t.title || '').slice(0, 200), excerpt: String(t.excerpt || '').slice(0, 1200), price: String(t.price || '').slice(0, 60), meta: {} }
    const { predict, explainPrediction, contactEvidenceOf } = await import('@/app/lib/moderation-ml')
    const cfgNow = modConfig()
    const ml = predict(pseudo)
    const ex = explainPrediction(pseudo)
    const contact = cfgNow.autoRejectContact ? contactEvidenceOf(pseudo) : []
    const verdict = contact.length ? 'reject-rule'
      : (ml.confident && cfgNow.autoMl && ml.label === 'approved') ? 'auto-approve'
      : (ml.confident && cfgNow.autoMl && ml.label === 'rejected') ? 'human-review'
      : 'ai-or-review'
    return NextResponse.json({ ok: true, test: { verdict, contact, ml: { label: ml.label, prob: Math.round(ml.prob * 100), ready: ml.ready, confident: ml.confident }, reasons: ex.reasons } })
  }
  const data = getAdminData()
  const cur = data.moderation || {}
  const clamp = (n: any, d: number) => { const x = Number(n); return Number.isFinite(x) ? Math.max(0, Math.min(100, Math.round(x))) : d }
  const approveMin = b.approveMin !== undefined ? clamp(b.approveMin, 70) : (cur.approveMin ?? 70)
  let rejectMax = b.rejectMax !== undefined ? clamp(b.rejectMax, 40) : (cur.rejectMax ?? 40)
  // اطمینان از منطقی‌بودن: rejectMax نباید از approveMin بزرگ‌تر یا مساوی باشد.
  if (rejectMax >= approveMin) rejectMax = Math.max(0, approveMin - 1)
  data.moderation = {
    criteria: b.criteria !== undefined ? String(b.criteria).slice(0, 4000) : (cur.criteria || ''),
    approveMin,
    rejectMax,
    requirePrice: b.requirePrice !== undefined ? !!b.requirePrice : !!cur.requirePrice,
    priceMissing: (b.priceMissing === 'review' || b.priceMissing === 'reject') ? b.priceMissing : (cur.priceMissing || 'reject'),
    autoMl: b.autoMl !== undefined ? !!b.autoMl : (cur.autoMl !== false),
    // فاز ۱۳۸: ردِ خودکار با مدرکِ قطعیِ تماس در متن (شماره/لینک/آیدی) — قابلِ خاموش‌کردن
    autoRejectContact: b.autoRejectContact !== undefined ? !!b.autoRejectContact : ((cur as any).autoRejectContact !== false),
  }
  saveAdminData(data)
  return NextResponse.json({ ok: true, config: modConfig() })
}
