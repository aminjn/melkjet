import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { DEFAULT_GAP_BASE } from '@/app/lib/ai-agents'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const g = getAdminData().gapgpt
  return NextResponse.json({
    baseUrl: g?.baseUrl || DEFAULT_GAP_BASE,
    configured: !!g?.apiKey,
    masked: g?.apiKey ? '***' + g.apiKey.slice(-4) : '',
  })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { baseUrl, apiKey } = await req.json()
  const data = getAdminData()
  data.gapgpt = {
    baseUrl: (baseUrl && String(baseUrl).trim()) || DEFAULT_GAP_BASE,
    // keep existing key if the field is left blank
    apiKey: apiKey && String(apiKey).trim() ? String(apiKey).trim() : (data.gapgpt?.apiKey || ''),
  }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
