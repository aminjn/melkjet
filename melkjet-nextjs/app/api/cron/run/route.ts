import { NextResponse } from 'next/server'
import { runCronNow, ensureCronStarted } from '@/app/lib/cron-runner'

// تریگرِ دستی/خارجیِ یک چرخهٔ سینک (فقط مشاورانی که زمانشان رسیده پردازش می‌شوند).
export async function GET() {
  ensureCronStarted()
  const res = await runCronNow()
  return NextResponse.json({ ok: true, ...res }, { headers: { 'Cache-Control': 'no-store' } })
}
