import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getItemById } from '@/app/lib/scraper-store'
import { getAdvisor } from '@/app/lib/advisor-store'
import { getAccount } from '@/app/lib/account-store'
import { addContact } from '@/app/lib/contact-log-store'

export const dynamic = 'force-dynamic'

const digits = (s: string) => String(s || '').replace(/[^\d+]/g, '')

// نمایشِ شمارهٔ آگهی/مشاور فقط برای کاربرِ واردشده + ثبتِ تماس برای صاحبِ آن.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای دیدنِ شماره ابتدا وارد شوید', login: true }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const kind = b.kind, id = String(b.id || '')
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })

  let phone = '', ownerKey = '', label = ''
  if (kind === 'advisor') {
    const a = await getAdvisor(id)
    phone = a.profile?.phone || id
    ownerKey = `advisor:${digits(id)}`
    label = a.profile?.name || 'مشاور'
  } else if (kind === 'item') {
    const it = await getItemById(id)
    if (!it) return NextResponse.json({ error: 'آگهی پیدا نشد' }, { status: 404 })
    phone = String(it.phone || it.meta?.__ownerPhone || '')
    ownerKey = `owner:${digits(it.meta?.__ownerPhone || it.phone || id)}`
    label = it.title || 'آگهی'
  } else return NextResponse.json({ error: 'نوع نامعتبر' }, { status: 400 })

  if (!phone) return NextResponse.json({ error: 'شماره‌ای ثبت نشده است' }, { status: 404 })

  // اگر بیننده خودِ صاحب نباشد، تماس را ثبت کن.
  if (digits(s.phone) !== digits(phone)) {
    await addContact(ownerKey, { viewerPhone: s.phone, viewerName: getAccount(s.phone)?.name, projectName: label, at: Date.now() })
  }
  return NextResponse.json({ ok: true, phone })
}
