import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { addReview, listReviews, deleteReview, setReviewApproved, applyReviewModeration } from '@/app/lib/reviews-store'
import { getSite } from '@/app/lib/sites-store'
import { moderateReview } from '@/app/lib/moderation'

// نظرِ سایت را به مالکِ آن (از روی slug) نسبت می‌دهد تا شمارهٔ مالک در صفحه لو نرود.
async function ownerOfSlug(slug: string): Promise<string> {
  const s = await getSite(String(slug || ''))
  return s?.owner || ''
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')
  if (slug) {
    const owner = await ownerOfSlug(slug)
    return NextResponse.json({ reviews: owner ? listReviews(owner) : [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
  // بدونِ slug → نظراتِ خودِ کاربرِ واردشده (برای پیش‌نمایش/مدیریت)
  const s = await getSession()
  if (!s) return NextResponse.json({ reviews: [] })
  return NextResponse.json({ reviews: listReviews(s.phone, { all: true }) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// ثبتِ نظر توسطِ بازدیدکننده (عمومی) — با slugِ سایت، یا (فاز ۲۹۲) با متخصصِ دایرکتوری.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  // فاز ۲۹۲ — نظر روی صفحهٔ متخصصِ دایرکتوری (/{type}/{slug}): شمارهٔ مالک سمتِ سرور
  // از slug حل می‌شود (لو نمی‌رود) و انتشار فقط با تاییدِ ادمین است؛ AI صرفاً پیشنهاد می‌دهد.
  if (b.ptype && b.pslug) {
    // وکیلِ اسکرپ‌شده (بدونِ حسابِ ملک‌جتی) → کلیدِ عمومیِ lw:{slug}؛ بقیه → شمارهٔ حساب از slug.
    let owner292 = ''
    if (b.ptype === 'lawyer') {
      const { getLawyerProfile } = await import('@/app/lib/bonyad-profiles')
      const lw = await getLawyerProfile(String(b.pslug)).catch(() => null)
      if (!lw) return NextResponse.json({ error: 'متخصص یافت نشد' }, { status: 404 })
      owner292 = 'lw:' + String(b.pslug)
    } else {
      const { resolveProvider } = await import('@/app/lib/provider-public')
      const p = await resolveProvider(String(b.ptype), String(b.pslug)).catch(() => null)
      if (!p) return NextResponse.json({ error: 'متخصص یافت نشد' }, { status: 404 })
      owner292 = p.phone
    }
    const r = addReview(owner292, { name: b.name, text: b.text, rating: b.rating })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    try {
      const v = await moderateReview(r.review!.name, r.review!.text)
      applyReviewModeration(r.review!.id, false, `پیشنهادِ AI: ${v.verdict === 'approve' ? 'تایید' : 'رد'} — ${v.reason}`)
    } catch { /* بدونِ AI هم در صفِ ادمین می‌ماند */ }
    return NextResponse.json({ ok: true, published: false, message: 'نظرِ شما ثبت شد و پس از تاییدِ مدیر نمایش داده می‌شود. سپاسگزاریم!' })
  }
  const owner = await ownerOfSlug(b.slug)
  if (!owner) return NextResponse.json({ error: 'سایت یافت نشد' }, { status: 404 })
  const r = addReview(owner, { name: b.name, text: b.text, rating: b.rating })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  // ممیزیِ هوش مصنوعی: تأیید/رد. در صورتِ نبودِ مدل → در انتظارِ تأییدِ دستیِ مالک می‌ماند.
  let published = false
  try {
    const v = await moderateReview(r.review!.name, r.review!.text)
    applyReviewModeration(r.review!.id, v.verdict === 'approve', v.reason)
    published = v.verdict === 'approve'
  } catch { /* در انتظارِ بررسیِ دستی */ }
  return NextResponse.json({
    ok: true,
    published,
    message: published ? 'نظرِ شما ثبت و منتشر شد. سپاسگزاریم!' : 'نظرِ شما ثبت شد و پس از بررسی نمایش داده می‌شود. سپاسگزاریم!',
    review: { name: r.review!.name, text: r.review!.text, rating: r.review!.rating },
  })
}

// مدیریتِ نظرات توسطِ مالک (حذف/تأیید).
export async function PATCH(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  if (b.delete) { deleteReview(s.phone, String(b.id)); return NextResponse.json({ ok: true }) }
  if (b.approved !== undefined) { setReviewApproved(s.phone, String(b.id), !!b.approved); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
}
