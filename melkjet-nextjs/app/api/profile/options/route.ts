import { NextResponse } from 'next/server'
import { getProfileOptions } from '@/app/lib/profile-options-store'

// گزینه‌های استانداردِ پروفایل (تخصص‌ها/خدمات) برای دراپ‌داونِ پنل‌ها — مدیریت در سوپرادمین.
export async function GET() {
  return NextResponse.json(getProfileOptions(), { headers: { 'Cache-Control': 'public, max-age=120' } })
}
