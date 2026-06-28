import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  }
  const data = getAdminData()
  return NextResponse.json({
    apiKey: data.ippanel?.apiKey ? '***' + data.ippanel.apiKey.slice(-4) : '',
    sender: data.ippanel?.sender || '',
    pattern: data.ippanel?.pattern || '',
    patternVar: data.ippanel?.patternVar || 'code',
    automationPattern: data.ippanel?.automationPattern || '',
    automationVar: data.ippanel?.automationVar || 'name',
    outreachPattern: data.ippanel?.outreachPattern || '',
    outreachVar: data.ippanel?.outreachVar || 'name',
    linkVar: data.ippanel?.linkVar || '',
    configured: !!data.ippanel?.apiKey,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  }

  const b = await req.json()
  const data = getAdminData()
  const cur = data.ippanel || { apiKey: '', sender: '', pattern: '' }
  // اگر کلید ماسک‌شده آمد، همان قبلی را نگه دار
  const apiKey = (b.apiKey && !String(b.apiKey).startsWith('***')) ? String(b.apiKey) : cur.apiKey
  const sender = b.sender !== undefined ? String(b.sender) : cur.sender
  const pattern = b.pattern !== undefined ? String(b.pattern) : cur.pattern
  const patternVar = (b.patternVar ? String(b.patternVar) : (cur.patternVar || 'code')).trim() || 'code'
  const automationPattern = b.automationPattern !== undefined ? String(b.automationPattern) : (cur.automationPattern || '')
  const automationVar = (b.automationVar ? String(b.automationVar) : (cur.automationVar || 'name')).trim() || 'name'
  const outreachPattern = b.outreachPattern !== undefined ? String(b.outreachPattern) : (cur.outreachPattern || '')
  const outreachVar = (b.outreachVar ? String(b.outreachVar) : (cur.outreachVar || 'name')).trim() || 'name'
  const linkVar = (b.linkVar !== undefined ? String(b.linkVar) : (cur.linkVar || '')).trim()

  if (!apiKey || !sender) {
    return NextResponse.json({ error: 'کلید API و خط ارسال الزامی است' }, { status: 400 })
  }

  data.ippanel = { apiKey, sender, pattern, patternVar, automationPattern, automationVar, outreachPattern, outreachVar, linkVar }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
