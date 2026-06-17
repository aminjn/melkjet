import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const m = getAdminData().smtp
  return NextResponse.json({
    configured: !!m?.host,
    host: m?.host || '', port: m?.port || 465, user: m?.user || '', from: m?.from || '',
    pass: m?.pass ? '****' : '',
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  const host = String(b.host || '').trim()
  const port = parseInt(b.port) || 465
  const user = String(b.user || '').trim()
  const from = String(b.from || user).trim()
  if (!host || !user) return NextResponse.json({ error: 'هاست و نام کاربری الزامی است' }, { status: 400 })
  const data = getAdminData()
  // رمز فقط وقتی عوض می‌شود که مقدار جدید (غیر ماسک) بدهند
  const pass = b.pass && b.pass !== '****' ? String(b.pass) : (data.smtp?.pass || '')
  if (!pass) return NextResponse.json({ error: 'رمز عبور الزامی است' }, { status: 400 })
  data.smtp = { host, port, user, pass, from }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
