import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  getPrefs, addFavorite, removeFavorite, addSavedSearch, removeSavedSearch,
} from '@/app/lib/user-store'
import { ingest } from '@/app/lib/reos/events'
import { addSaved, removeSavedByListing } from '@/app/lib/buyer-store'
import { getItemById } from '@/app/lib/scraper-store'
import { parseFaNum } from '@/app/lib/reos/features'

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
      // REOS: سیگنالِ سیو (reward +۵) → یادگیریِ سلیقهٔ کاربر + پیشرفتِ کوئستِ «۱ آگهی ذخیره کن»
      try { await ingest({ type: 'user_saved_property', propertyId: listingId, userId: uid !== 'guest' ? uid : undefined }) } catch {}
      // آینه در «علاقه‌مندی‌ها»ی پنلِ خریدار — با جزئیاتِ واقعیِ همان آگهی
      if (uid !== 'guest') {
        try {
          const it = await getItemById(listingId)
          if (it) {
            const meta = it.meta || {}
            await addSaved(uid, {
              listingId,
              title: it.title,
              ptype: meta['نوع ملک'] || it.category || 'ملک',
              location: it.location || '',
              area: parseFaNum(meta['متراژ']) || 0,
              rooms: parseFaNum(meta['اتاق']) || 0,
              price: parseFaNum(it.price) || 0,
              deal: /اجاره|ودیعه|رهن/.test(it.price || '') ? 'rent' : 'sale',
            })
          }
        } catch {}
      }
      return NextResponse.json(res)
    }
    case 'removeFav': {
      const listingId = String(body.listingId || '').trim()
      if (!listingId) return NextResponse.json({ error: 'شناسه ملک نامعتبر است' }, { status: 400 })
      const res = await removeFavorite(uid, listingId)
      if (uid !== 'guest') { try { await removeSavedByListing(uid, listingId) } catch {} }
      return NextResponse.json(res)
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
