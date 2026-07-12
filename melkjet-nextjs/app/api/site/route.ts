import { NextResponse } from 'next/server'
import { siteConfig } from '@/app/lib/site-store'

// عمومی — فوترِ کلاینتی و صفحهٔ تماس از این می‌خوانند (بدونِ اطلاعاتِ حساس)
export async function GET() {
  const cfg = siteConfig()
  return NextResponse.json({ footer: cfg.footer, contact: cfg.contact })
}
