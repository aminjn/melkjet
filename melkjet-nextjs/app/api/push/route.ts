import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getVapid } from '@/app/lib/web-push'
import { saveSub, removeByEndpoint } from '@/app/lib/push-store'

// GET → کلیدِ عمومیِ VAPID (برای subscribe در مرورگر)
export async function GET() {
  return NextResponse.json({ key: getVapid().publicKey }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}

// POST { action:'subscribe', subscription } یا { action:'unsubscribe', endpoint }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const s = await getSession()
  const vid = req.cookies.get('mj_vid')?.value || undefined
  if (b.action === 'unsubscribe') {
    if (b.endpoint) removeByEndpoint(String(b.endpoint))
    return NextResponse.json({ ok: true })
  }
  const sub = b.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: 'subscription نامعتبر' }, { status: 400 })
  saveSub({ endpoint: String(sub.endpoint), keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } }, s?.phone, vid)
  return NextResponse.json({ ok: true })
}
