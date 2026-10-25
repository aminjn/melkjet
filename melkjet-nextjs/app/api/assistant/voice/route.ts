import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { sttConfigured, selfHostTranscribe } from '@/app/lib/self-host'

export const runtime = 'nodejs'
export const maxDuration = 60

// پیامِ صوتیِ کاربر → متن (whisperِ خودِ مالک). عمومی؛ فقط وقتی سرورِ STT روشن باشد.
export async function POST(req: NextRequest) {
  if (getAdminData().assistant?.enabled === false) return NextResponse.json({ error: 'دستیار غیرفعال است' }, { status: 503 })
  if (!sttConfigured()) return NextResponse.json({ error: 'سرویسِ تبدیلِ گفتار به متن تنظیم نشده' }, { status: 503 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('audio')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'فایلِ صوتی لازم است' }, { status: 400 })
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'فایلِ صوتی بزرگ است' }, { status: 413 })
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const name = (file as any).name || 'voice.webm'
    const text = await selfHostTranscribe(buf, String(name).slice(0, 80))
    return NextResponse.json({ ok: true, text }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تبدیل' }, { status: 502 })
  }
}
