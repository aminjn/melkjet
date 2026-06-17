import { NextRequest, NextResponse } from 'next/server'
import { analyzeListing } from '@/app/lib/analyze'

// Structured AI analysis for a property listing → fills the property page design.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const r = await analyzeListing(b)
  if (r.error && !r.analysis) {
    // 400 only for misconfig (no model); transient errors return 200 with message
    const status = r.error.includes('مدلی') ? 400 : 200
    return NextResponse.json({ error: r.error }, { status })
  }
  return NextResponse.json({ ok: true, analysis: r.analysis })
}
