// فاز ۳۰۰ — وب‌هوکِ رباتِ بله. همان هستهٔ پردازشِ تلگرام را روی «سکوی بله» اجرا می‌کند
// (Bot APIِ بله سازگار با تلگرام است). بله داخلی است، پس اتصال مستقیم و بدونِ پروکسی است.
// رمزِ وب‌هوک در query (?s=…) می‌آید — چون پشتیبانیِ بله از هدرِ secret قطعی نیست.
import { NextRequest, NextResponse } from 'next/server'
import { handleBotUpdate } from '@/app/api/telegram/webhook/route'
import { botALS, baleBotCtx } from '@/app/lib/bot-ctx'
import { getAdminData } from '@/app/lib/admin-store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = getAdminData().bale?.secret || process.env.BALE_WEBHOOK_SECRET || ''
  if (secret && req.nextUrl.searchParams.get('s') !== secret) return NextResponse.json({ ok: false }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = (await req.json().catch(() => null)) as any
  if (u) botALS.run(baleBotCtx(), () => handleBotUpdate(u)).catch(e => console.warn('[bale] handle:', (e as Error).message))
  return NextResponse.json({ ok: true })
}
export async function GET() { return NextResponse.json({ ok: true, service: 'bale-webhook' }) }
