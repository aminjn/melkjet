import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  proStats, listRequests, listRecords,
  addRequest, updateRequest, deleteRequest,
  addRecord, updateRecord, deleteRecord,
} from '@/app/lib/prodesk-store'

// میزِ کارِ متخصص — دادهٔ هر پنل مخصوصِ کاربرِ واردشده و نقشِ آن (role=مسیرِ داشبورد).
// role از کوئری/بدنه می‌آید تا یک اندپوینت به هر شش داشبورد سرویس دهد.
const ROLES = ['/architect', '/contractor', '/appraiser', '/lawfirm', '/finance', '/notary', '/legal']
const roleOf = (v: string) => (ROLES.includes(v) ? v : '')

export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const role = roleOf(new URL(req.url).searchParams.get('role') || '')
  if (!role) return NextResponse.json({ error: 'نقشِ نامعتبر' }, { status: 400 })
  const owner = s.phone
  return NextResponse.json({
    stats: await proStats(owner, role),
    requests: await listRequests(owner, role),
    records: await listRecords(owner, role),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const owner = s.phone
  const b = await req.json().catch(() => ({} as any))
  const role = roleOf(String(b.role || ''))
  if (!role) return NextResponse.json({ error: 'نقشِ نامعتبر' }, { status: 400 })
  const action = String(b.action || '')

  switch (action) {
    case 'addRequest':
      if (!b.clientName) return NextResponse.json({ error: 'نامِ متقاضی الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, request: await addRequest(owner, role, b) })
    case 'updateRequest': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const r = await updateRequest(owner, role, String(b.id), b.patch || {})
      if (!r) return NextResponse.json({ error: 'درخواست یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, request: r })
    }
    case 'deleteRequest':
      return NextResponse.json({ ok: await deleteRequest(owner, role, String(b.id || '')) })
    case 'addRecord':
      if (!b.title) return NextResponse.json({ error: 'عنوان الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, record: await addRecord(owner, role, b) })
    case 'updateRecord': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const r = await updateRecord(owner, role, String(b.id), b.patch || {})
      if (!r) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, record: r })
    }
    case 'deleteRecord':
      return NextResponse.json({ ok: await deleteRecord(owner, role, String(b.id || '')) })
    default:
      return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
  }
}
