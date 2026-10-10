import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { botALS, baleBotCtx } from '@/app/lib/bot-ctx'
import { tgGetMe, tgSetWebhook, tgApi } from '@/app/lib/telegram'
import { randomBytes } from 'crypto'

async function guard() {
  const s = await getSession()
  return s && (s.role === 'super_admin' || (s.staff || []).length > 0)
}
const BASE = () => process.env.PUBLIC_BASE_URL || 'https://melkjet.com'

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = getAdminData().bale || {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bot: any = null
  if (b.token) { try { bot = await botALS.run(baleBotCtx(), () => tgGetMe()) } catch {} }
  return NextResponse.json({ enabled: !!b.enabled, configured: !!b.token, masked: b.token ? '***' + b.token.slice(-6) : '', bot, webhook: `${BASE()}/api/bale/webhook` })
}

// POST { token?, enabled?, action? }  action: 'apply' (setWebhook) | 'test' (getMe) | 'delete-webhook'
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = await req.json().catch(() => ({} as any))
  const data = getAdminData(); data.bale = data.bale || {}
  if (typeof body.token === 'string' && body.token.trim()) data.bale.token = body.token.trim()
  if (typeof body.enabled === 'boolean') data.bale.enabled = body.enabled
  if (!data.bale.secret) data.bale.secret = randomBytes(12).toString('hex')
  saveAdminData(data)

  if (body.action === 'test') {
    const bot = await botALS.run(baleBotCtx(), () => tgGetMe())
    return NextResponse.json({ ok: !!bot, bot })
  }
  if (body.action === 'delete-webhook') {
    const r = await botALS.run(baleBotCtx(), () => tgApi('deleteWebhook', { drop_pending_updates: true }))
    return NextResponse.json({ ok: !!r })
  }
  if (body.action === 'apply') {
    if (!data.bale.token) return NextResponse.json({ ok: false, error: 'no-token' })
    if (!data.bale.enabled) {
      await botALS.run(baleBotCtx(), () => tgApi('deleteWebhook', { drop_pending_updates: false }))
      return NextResponse.json({ ok: true, disabled: true })
    }
    const url = `${BASE()}/api/bale/webhook?s=${data.bale.secret}`
    const r = await botALS.run(baleBotCtx(), () => tgSetWebhook(url))   // رمز در query است، نه هدر
    const bot = await botALS.run(baleBotCtx(), () => tgGetMe())
    return NextResponse.json({ ok: !!r, webhookSet: !!r, bot, url })
  }
  return NextResponse.json({ ok: true })
}
