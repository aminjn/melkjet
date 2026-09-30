import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { pendingReviews, adminSetApproved, adminDeleteReview, allApprovedReviews } from '@/app/lib/reviews-store'
import { getProfile, setVerified, listVerifiedPhones } from '@/app/lib/profile-store'
import { getAccount } from '@/app/lib/account-store'
import { FA_DIGITS, faDigit } from '@/app/lib/digits'

export const runtime = 'nodejs'

// فاز ۲۹۲ — پنلِ «نظرات و تیکِ آبی»: تاییدِ ادمین برای نظراتِ دایرکتوری + مدیریتِ نشانِ پولی.
async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) }

function ownerLabel(phone: string): string {
  const p = getProfile(phone)
  const a = getAccount(phone)
  return (p.businessName || p.displayName || a?.name || '').trim() || phone
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const pending = pendingReviews().slice(0, 100).map(r => ({
    id: r.id, ownerPhone: r.ownerPhone, ownerName: ownerLabel(r.ownerPhone),
    name: r.name, text: r.text, rating: r.rating, createdAt: r.createdAt, aiHint: r.reason || '',
  }))
  const approvedCount = allApprovedReviews().length
  const verified = listVerifiedPhones().map(ph => ({ phone: ph, name: ownerLabel(ph) }))
  return NextResponse.json({ pending, approvedCount, verified }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const action = String(b.action || '')
  if (action === 'approve') {
    if (!adminSetApproved(String(b.id), true)) return NextResponse.json({ error: 'نظر یافت نشد' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'reject') {
    if (!adminDeleteReview(String(b.id))) return NextResponse.json({ error: 'نظر یافت نشد' }, { status: 404 })
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
