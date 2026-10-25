import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { ttsConfigured, selfHostSpeak } from '@/app/lib/self-host'

export const runtime = 'nodejs'
export const maxDuration = 60

// متنِ پاسخ → صوت (piperِ خودِ مالک). خروجی: URLِ صوتیِ /api/media/<id>. عمومی؛ فقط وقتی TTS روشن باشد.
export async function POST(req: NextRequest) {
  if (getAdminData().assistant?.enabled === false) return NextResponse.json({ error: 'دستیار غیرفعال است' }, { status: 503 })
  if (!ttsConfigured()) return NextResponse.json({ error: 'سرویسِ تبدیلِ متن به گفتار تنظیم نشده' }, { status: 503 })
  const b = await req.json().catch(() => ({} as any))
  const text = String(b?.text || '').trim().slice(0, 2000)
  if (!text) return NextResponse.json({ error: 'متن لازم است' }, { status: 400 })
  try {
    const url = await selfHostSpeak(text)
    return NextResponse.json({ ok: true, url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تولیدِ صدا' }, { status: 502 })
  }
}
