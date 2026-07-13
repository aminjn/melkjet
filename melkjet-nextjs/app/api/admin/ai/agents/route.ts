import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

async function guard() {
  const s = await getSession()
  return s && (s.role === 'super_admin' || (s.staff || []).length > 0)
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ agentModels: getAdminData().agentModels || {} })
}

// POST { agentId, text?, image? }  — assign models to one agent
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { agentId, text, image, textProvider, imageProvider } = await req.json()
  if (!agentId) return NextResponse.json({ error: 'شناسهٔ ایجنت الزامی است' }, { status: 400 })
  const data = getAdminData()
  data.agentModels = data.agentModels || {}
  const cur = data.agentModels[agentId] || {}
  data.agentModels[agentId] = {
    text: text != null ? String(text) : cur.text,
    image: image != null ? String(image) : cur.image,
    textProvider: textProvider != null ? (String(textProvider) || undefined) : cur.textProvider,
    imageProvider: imageProvider != null ? (String(imageProvider) || undefined) : cur.imageProvider,
  }
  saveAdminData(data)
  return NextResponse.json({ ok: true, agentModels: data.agentModels })
}
