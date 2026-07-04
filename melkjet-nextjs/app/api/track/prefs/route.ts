import { NextRequest, NextResponse } from 'next/server'
import { getVisitor } from '@/app/lib/tracker-store'
import { NEIGHBORHOODS, CITIES } from '@/app/lib/taxonomy'

// سوابقِ کاربر: از عناوینِ صفحاتی که این بازدیدکننده دیده، پرتکرارترین محله و شهر را حدس می‌زند.
const ALL_NEIGHBORHOODS = Array.from(new Set(Object.values(NEIGHBORHOODS).flat()))
const ALL_CITIES = Array.from(new Set(Object.values(CITIES).flat()))
const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '')

function topMatch(text: string, list: string[]): string {
  const hay = norm(text)
  let best = '', bestC = 0
  for (const item of list) {
    const n = norm(item)
    if (n.length < 2) continue
    let c = 0, i = 0
    while ((i = hay.indexOf(n, i)) !== -1) { c++; i += n.length }
    if (c > bestC) { bestC = c; best = item }
  }
  return best
}

export async function GET(req: NextRequest) {
  const vid = req.cookies.get('mj_vid')?.value || ''
  const v = vid ? await getVisitor(vid) : null
  if (!v || !v.events?.length) return NextResponse.json({ city: '', neighborhood: '' }, { headers: { 'Cache-Control': 'no-store' } })
  const text = v.events.map(e => `${e.title || ''} ${e.url || ''}`).join(' ')
  return NextResponse.json(
    { city: topMatch(text, ALL_CITIES), neighborhood: topMatch(text, ALL_NEIGHBORHOODS) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
