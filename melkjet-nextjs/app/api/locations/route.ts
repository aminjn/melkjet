import { NextRequest, NextResponse } from 'next/server'
import { locationTree, resolveLocationPath, flatNeighborhoods } from '@/app/lib/locations-store'

// عمومی: درختِ مکان (اسلاگ‌دار) + resolveِ مسیر + فهرستِ محله‌ها.
//   GET                → درختِ کامل (province→city→district→neighborhood)
//   GET ?path=tehran/district-2/saadat-abad  → گرهٔ آن مسیر + trail (breadcrumb)
//   GET ?flat=1        → همهٔ محله‌ها به‌صورتِ تخت (برای انتخابگر/Programmatic)
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  if (sp.get('flat') === '1') return NextResponse.json({ neighborhoods: flatNeighborhoods() }, { headers: { 'Cache-Control': 'public, max-age=300' } })
  const path = sp.get('path')
  if (path) {
    const r = resolveLocationPath(path.split('/').filter(Boolean))
    if (!r) return NextResponse.json({ node: null }, { status: 404 })
    return NextResponse.json({ node: { type: r.node.type, slug: r.node.slug, nameFa: r.node.nameFa, path: r.node.path, children: r.node.children.map(c => ({ type: c.type, slug: c.slug, nameFa: c.nameFa, path: c.path })) }, trail: r.trail.map(t => ({ type: t.type, slug: t.slug, nameFa: t.nameFa, path: t.path })) }, { headers: { 'Cache-Control': 'public, max-age=300' } })
  }
  // درختِ کامل ولی سبک (بدونِ فرزندانِ محله تا حجمِ پاسخ کم بماند).
  const tree = locationTree().map(p => ({ slug: p.slug, nameFa: p.nameFa, cities: p.children.map(c => ({ slug: c.slug, nameFa: c.nameFa, districts: c.children.map(d => ({ slug: d.slug, nameFa: d.nameFa, neighborhoods: d.children.length })) })) }))
  return NextResponse.json({ provinces: tree }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
