import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { pendingReviews, adminSetApproved, adminDeleteReview, allApprovedReviews } from '@/app/lib/reviews-store'
import { pendingBuilderReviews, setBuilderReviewApproved, deleteBuilderReview } from '@/app/lib/builder-public-store'
import { getProfile, setVerified, listVerifiedPhones } from '@/app/lib/profile-store'
import { getAccount } from '@/app/lib/account-store'
import { FA_DIGITS, faDigit } from '@/app/lib/digits'

export const runtime = 'nodejs'

// فاز ۲۹۲ — پنلِ «نظرات و تیکِ آبی»: تاییدِ ادمین برای نظراتِ دایرکتوری + مدیریتِ نشانِ پولی.
async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) }

function ownerLabel(phone: string): string {
  if (phone.startsWith('lw:')) return `وکیل: ${decodeURIComponent(phone.slice(3))}`
  const p = getProfile(phone)
  const a = getAccount(phone)
  return (p.businessName || p.displayName || a?.name || '').trim() || phone
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const pending = [
    ...pendingReviews().slice(0, 100).map(r => ({
      id: r.id, source: 'pro' as const, ownerPhone: r.ownerPhone, ownerName: ownerLabel(r.ownerPhone),
      name: r.name, text: r.text, rating: r.rating, createdAt: r.createdAt, aiHint: r.reason || '',
    })),
    // فاز ۲۹۲ — نظراتِ سازنده‌ها (پرشین‌سازه) هم از همین صف تایید می‌شوند.
    ...await Promise.all(pendingBuilderReviews().slice(0, 100).map(async pr => {
      let bName = 'سازنده'
      try { const { getProfile: bProf } = await import('@/app/lib/persiansaze-store'); bName = bProf(pr.builderId)?.name || 'سازنده' } catch {}
      return {
        id: pr.review.id, source: 'builder' as const, ownerPhone: pr.builderId, ownerName: bName + (pr.review.projectName ? ` — پروژهٔ ${pr.review.projectName}` : ''),
        name: pr.review.name, text: pr.review.text, rating: pr.review.rating, createdAt: pr.review.at, aiHint: '',
      }
    })),
  ].sort((a, b) => b.createdAt - a.createdAt)
  const approvedCount = allApprovedReviews().length
  const verified = listVerifiedPhones().map(ph => ({ phone: ph, name: ownerLabel(ph) }))
  return NextResponse.json({ pending, approvedCount, verified }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const action = String(b.action || '')
  if (action === 'approve') {
    const ok = b.source === 'builder'
      ? setBuilderReviewApproved(String(b.ownerPhone), String(b.id), true)
      : adminSetApproved(String(b.id), true)
    if (!ok) return NextResponse.json({ error: 'نظر یافت نشد' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'reject') {
    const ok = b.source === 'builder'
      ? deleteBuilderReview(String(b.ownerPhone), String(b.id))
      : adminDeleteReview(String(b.id))
    if (!ok) return NextResponse.json({ error: 'نظر یافت نشد' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'verify') {
    const phone = String(b.phone || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')
    if (!/^09\d{9}$/.test(phone)) return NextResponse.json({ error: 'شمارهٔ معتبرِ حساب را وارد کنید (۰۹…)' }, { status: 400 })
    if (b.on && !getAccount(phone)) return NextResponse.json({ error: 'حسابی با این شماره ثبت نشده است' }, { status: 404 })
    setVerified(phone, !!b.on)
    return NextResponse.json({ ok: true, phone, name: ownerLabel(phone) })
  }
  return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
}
