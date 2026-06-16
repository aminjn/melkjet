import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData, hashPassword } from '@/app/lib/admin-store'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  }

  const { newPassword } = await req.json()
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'رمز عبور باید حداقل ۸ کاراکتر باشد' }, { status: 400 })
  }

  const data = getAdminData()
  data.passwordHash = hashPassword(newPassword)
  saveAdminData(data)

  return NextResponse.json({ ok: true })
}
