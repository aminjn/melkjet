import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { shardList, sitemapConfig, snapshotMeta, checkNewShards, DEFAULT_MAX, BASE } from '@/app/lib/sitemap-store'
import { logAudit } from '@/app/lib/audit-store'

const SECTIONS = ['static', 'blog', 'listings', 'locations', 'projects', 'providers', 'builders', 'products', 'stores']

// مرکزِ سایت‌مپ (سوپرادمین): فهرستِ شاردها + تنظیماتِ سقف/بخش‌ها + هشدارِ شاردِ جدید.
export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const shards = await shardList()
  const total = shards.reduce((n, x) => n + x.count, 0)
  return NextResponse.json({
    ok: true, config: sitemapConfig(), sections: SECTIONS,
    indexUrl: `${BASE}/sitemap.xml`, robotsUrl: `${BASE}/robots.txt`,
    shards, total, snapshot: snapshotMeta(), defaultMax: DEFAULT_MAX,
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as Record<string, any>))
  const actor = (s as any).name || (s as any).phone || 'مدیر'

  // فاز ۸۹ (فیدبک: GSC همهٔ شاردها را «Couldn't fetch» می‌گوید): تستِ واکشیِ «عمومی» — از خودِ سرور،
  // با UA گوگل‌بات، ایندکس + شاردها از دامنهٔ عمومی (پشتِ Arvan) کشیده می‌شوند تا معلوم شود گوگل چه می‌بیند:
  // status/زمان/حجم/ریدایرکت/بوی صفحهٔ چالشِ WAF. مشکلِ لبه (CDN/WAF) از مشکلِ اپ تفکیک می‌شود.
  if (b.action === 'probe') {
    const shards = await shardList()
    const urls = [`${BASE}/sitemap.xml`, `${BASE}/robots.txt`, ...shards.slice(0, Math.min(15, shards.length)).map(x => `${BASE}/sitemaps/${x.name}.xml`)]
    const results: any[] = []
    for (const u of urls) {
      const t0 = Date.now()
      try {
        const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', accept: 'application/xml,text/xml,*/*' }, redirect: 'manual', signal: AbortSignal.timeout(20000), cache: 'no-store' })
        const body = await r.text().catch(() => '')
        const challenge = /arvan|captcha|challenge|access denied|cf-|ddos/i.test(body.slice(0, 800)) && !body.includes('<urlset') && !body.includes('<sitemapindex')
        results.push({
          url: u, status: r.status, ms: Date.now() - t0, bytes: body.length,
          redirect: r.status >= 300 && r.status < 400 ? (r.headers.get('location') || '') : '',
          xml: body.includes('<urlset') || body.includes('<sitemapindex') || u.endsWith('robots.txt'),
          challenge,
          contentType: r.headers.get('content-type') || '',
        })
      } catch (e: any) { results.push({ url: u, status: 0, ms: Date.now() - t0, bytes: 0, redirect: '', xml: false, challenge: false, error: String(e?.message || e).slice(0, 120) }) }
    }
    const bad = results.filter(r => r.status !== 200 || !r.xml)
    return NextResponse.json({ ok: true, probe: results, summary: bad.length === 0
      ? '✓ همهٔ نمونه‌ها از دامنهٔ عمومی با UA گوگل‌بات سالم برگشتند — اگر GSC هنوز Couldn\'t fetch می‌گوید، مشکل سمتِ مسدودسازیِ IPهای خارجی (WAF/DDoS آروان) است، نه اپ'
      : `⚠ ${bad.length.toLocaleString('fa-IR')} از ${results.length.toLocaleString('fa-IR')} نمونه مشکل دارد — جزئیات در جدول` })
  }

  // بازتولید + بررسیِ شاردِ جدید (هشدار می‌دهد)
  if (b.action === 'regenerate') {
    const r = await checkNewShards()
    logAudit(actor, 'بازتولیدِ سایت‌مپ', `${r.total} شارد` + (r.added.length ? ` (${r.added.length} جدید)` : ''))
    return NextResponse.json({ ok: true, ...r })
  }

  // Ping گوگل/بینگ (توجه: گوگل از ۲۰۲۳ endpointِ ping را حذف کرده؛ راهِ درست ثبت در سرچ‌کنسول است)
  if (b.action === 'ping') {
    const url = `${BASE}/sitemap.xml`
    const results: Record<string, string> = {}
    for (const [name, ep] of [['google', `https://www.google.com/ping?sitemap=${encodeURIComponent(url)}`], ['bing', `https://www.bing.com/ping?sitemap=${encodeURIComponent(url)}`]]) {
      try { const res = await fetch(ep, { method: 'GET' }); results[name] = `HTTP ${res.status}` } catch (e: any) { results[name] = e?.message || 'خطا' }
    }
    logAudit(actor, 'Ping سایت‌مپ', JSON.stringify(results))
    return NextResponse.json({ ok: true, results, note: 'گوگل endpointِ ping را حذف کرده؛ سایت‌مپ را در Google Search Console ثبت کن.' })
  }

  // ذخیرهٔ تنظیمات: سقفِ URL هر شارد + فعال/غیرفعالِ بخش‌ها
  const data = getAdminData() as Record<string, any>
  data.seo = data.seo || {}
  const cur = data.seo.sitemap || {}
  const next: Record<string, any> = { ...cur }
  if (b.maxUrls !== undefined) { const n = Number(b.maxUrls); next.maxUrls = Number.isFinite(n) ? Math.max(100, Math.min(50000, Math.round(n))) : DEFAULT_MAX }
  if (b.sections && typeof b.sections === 'object') {
    const sec: Record<string, boolean> = { ...(cur.sections || {}) }
    for (const k of SECTIONS) if (k in b.sections) sec[k] = !!b.sections[k]
    next.sections = sec
  }
  data.seo.sitemap = next
  saveAdminData(data as any)
  logAudit(actor, 'تنظیماتِ سایت‌مپ', `سقف=${next.maxUrls || DEFAULT_MAX}`)
  const shards = await shardList(true)   // force = بازتاب فوریِ تنظیماتِ جدید
  return NextResponse.json({ ok: true, config: sitemapConfig(), shards, total: shards.reduce((n, x) => n + x.count, 0) })
}
