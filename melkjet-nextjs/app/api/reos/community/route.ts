import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount } from '@/app/lib/account-store'
import { primeConfig } from '@/app/lib/reos/reos-config'
import {
  follow, unfollow, isFollowing, followerCount, followingList,
  createCollection, addToCollection, removeFromCollection, listCollections, collectionItems,
  addComment, listComments, hideComment, socialProof, publicRankings, type TargetType,
} from '@/app/lib/reos/community'

// GET /api/reos/community — لایهٔ اجتماعی.
//   ?view=me (پیش‌فرض)            → اثباتِ اجتماعی + مجموعه‌های کاربرِ جاری
//   ?view=profile&agent=…         → اثباتِ اجتماعیِ عمومیِ یک آژانس + وضعیتِ دنبال‌کردن
//   ?view=comments&target=&type=  → نظرهایِ یک هدف (درختی)
//   ?view=collection&id=…         → آیتم‌های یک مجموعه
//   ?view=rankings                → رتبه‌بندیِ عمومیِ آژانس‌ها
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  await primeConfig().catch(() => {})
  const url = new URL(req.url)
  const view = url.searchParams.get('view') || 'me'
  const me = String(s.phone || '').replace(/\D/g, '')
  const H = { headers: { 'Cache-Control': 'no-store, private' } }

  if (view === 'rankings') return NextResponse.json({ ok: true, rankings: await publicRankings(30) }, H)
  if (view === 'comments') {
    const target = url.searchParams.get('target') || ''
    if (!target) return NextResponse.json({ error: 'target لازم است' }, { status: 400 })
    return NextResponse.json({ ok: true, comments: await listComments(target, (url.searchParams.get('type') as TargetType) || 'agent') }, H)
  }
  if (view === 'collection') {
    const id = url.searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'id لازم است' }, { status: 400 })
    return NextResponse.json({ ok: true, items: await collectionItems(id) }, H)
  }
  if (view === 'profile') {
    const agent = String(url.searchParams.get('agent') || '').replace(/\D/g, '')
    if (!agent) return NextResponse.json({ error: 'agent لازم است' }, { status: 400 })
    const [proof, following] = await Promise.all([socialProof(agent), isFollowing(me, agent, 'agent')])
    return NextResponse.json({ ok: true, agent, proof, following }, H)
  }
  // me
  const [proof, collections, following] = await Promise.all([socialProof(me), listCollections(me), followingList(me)])
  return NextResponse.json({ ok: true, agentId: me, proof, collections, following }, H)
}

// POST /api/reos/community
//   {action:'follow'|'unfollow', targetId, targetType?}
//   {action:'collection_create', name, public?}
//   {action:'collection_add'|'collection_remove', collectionId, itemId, itemType?}
//   {action:'comment', targetId, targetType?, text, parentId?}
//   {action:'comment_hide', id}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  await primeConfig().catch(() => {})
  const b = await req.json().catch(() => ({})) as Record<string, string | boolean>
  const me = String(s.phone || '').replace(/\D/g, '')
  const isAdmin = String(s.phone) === '09122862184'
  const str = (k: string) => (typeof b[k] === 'string' ? String(b[k]) : '')

  switch (b.action) {
    case 'follow': return NextResponse.json(await follow(me, str('targetId').replace(/\D/g, '') || str('targetId'), (str('targetType') as TargetType) || 'agent'))
    case 'unfollow': return NextResponse.json(await unfollow(me, str('targetId').replace(/\D/g, '') || str('targetId'), (str('targetType') as TargetType) || 'agent'))
    case 'collection_create': return NextResponse.json({ ok: true, collection: await createCollection(me, str('name'), b.public !== false) })
    case 'collection_add': return NextResponse.json(await addToCollection(str('collectionId'), str('itemId'), (str('itemType') as TargetType) || 'property'))
    case 'collection_remove': return NextResponse.json(await removeFromCollection(str('collectionId'), str('itemId')))
    case 'comment': {
      const authorName = getAccount(String(s.phone))?.name || ''
      const r = await addComment({ authorId: me, authorName, targetId: str('targetId'), targetType: (str('targetType') as TargetType) || 'agent', text: str('text'), parentId: str('parentId') || undefined })
      return NextResponse.json(r.ok ? { ok: true, comment: r.comment } : { error: r.reason }, { status: r.ok ? 200 : 400 })
    }
    case 'comment_hide': {
      const r = await hideComment(str('id'), me, isAdmin)
      return NextResponse.json(r.ok ? { ok: true } : { error: r.reason }, { status: r.ok ? 200 : 403 })
    }
    default: return NextResponse.json({ error: 'action نامعتبر' }, { status: 400 })
  }
}
