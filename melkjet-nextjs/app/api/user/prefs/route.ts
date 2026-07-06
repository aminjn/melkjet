import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  getPrefs, addFavorite, removeFavorite, addSavedSearch, removeSavedSearch,
} from '@/app/lib/user-store'
import { ingest } from '@/app/lib/reos/events'

// Per-user favorites + saved searches. Guests (no session) are keyed as 'guest'.
async function userId(): Promise<string> {
  const session = await getSession()
  return session?.phone || 'guest'
}

export async function GET() {
  const uid = await userId()
  return NextResponse.json(await getPrefs(uid))
}

export async function POST(req: NextRequest) {
  const uid = await userId()
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')

  switch (action) {
    case 'addFav': {
      const listingId = String(body.listingId || '').trim()
      if (!listingId) return NextResponse.json({ error: 'شناسه ملک نامعتبر است' }, { status: 400 })
      const res = await addFavorite(uid, listingId)
      // REOS: سیگنالِ سیو (reward +۵) → یادگیریِ سلیقهٔ کاربر
      try { await ingest({ type: 'user_saved_property', propertyId: listingId, userId: uid !== 'guest' ? uid : undefined }) } catch {}
      return NextResponse.json(res)
    }
    case 'removeFav': {
      const listingId = String(body.listingId || '').trim()
      if (!listingId) return NextResponse.json({ error: 'شناسه ملک نامعتبر است' }, { status: 400 })
      return NextResponse.json(await removeFavorite(uid, listingId))
    }
    case 'addSearch': {
      const query = String(body.query || '').trim()
      const label = String(body.label || '').trim()
      if (!query && !label) return NextResponse.json({ error: 'جستجوی خالی است' }, { status: 400 })
      return NextResponse.json(await addSavedSearch(uid, { label, query }))
    }
    case 'removeSearch': {
      const id = String(body.id || '').trim()
      if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
      return NextResponse.json(await removeSavedSearch(uid, id))
    }
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
