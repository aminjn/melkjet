import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { assembleBuilderProfile } from '@/app/lib/builder-profile'
import { follow, unfollow, isFollowing, addReview } from '@/app/lib/builder-public-store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || ''
  const profile = assembleBuilderProfile(id)
  if (!profile) return NextResponse.json({ error: 'سازنده پیدا نشد' }, { status: 404 })
  const s = await getSession()
  return NextResponse.json({ ok: true, profile, isFollowing: s ? isFollowing(id, s.phone) : false })
}

// دنبال‌کردن و ثبتِ نظر — نیازمندِ ورود (تا فیک نباشد).
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای این کار باید وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const id = String(b.id || '')
  if (!id || !assembleBuilderProfile(id)) return NextResponse.json({ error: 'سازنده نامعتبر' }, { status: 404 })
  const a = b.action
  if (a === 'follow') { follow(id, s.phone); return NextResponse.json({ ok: true, following: true }) }
  if (a === 'unfollow') { unfollow(id, s.phone); return NextResponse.json({ ok: true, following: false }) }
  if (a === 'review') {
    const text = String(b.text || '').trim()
    if (!text) return NextResponse.json({ error: 'متنِ نظر الزامی است' }, { status: 400 })
    const rev = addReview(id, { name: String(b.name || 'کاربر'), rating: Number(b.rating) || 5, text, projectName: b.projectName, phone: s.phone })
    return NextResponse.json({ ok: true, review: rev })
  }
  return NextResponse.json({ error: 'اقدام نامعتبر' }, { status: 400 })
}
