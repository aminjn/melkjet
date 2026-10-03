import { NextRequest, NextResponse } from 'next/server'
import { resetFailedSms, sendSmsManual, smsStatus } from '@/app/lib/auto-site'
import { getSession } from '@/app/lib/session'
import { listSiteHeads } from '@/app/lib/sites-store'
import { allSiteStats, summarize } from '@/app/lib/site-stats-store'
import { getProfile } from '@/app/lib/profile-store'
import { getAccount, listAccounts } from '@/app/lib/account-store'
import { urlTypeForRole } from '@/app/lib/provider-public'
import { kvGet, pgEnabled } from '@/app/lib/db'
import { listRoles } from '@/app/lib/role-store'

export const runtime = 'nodejs'

// فاز ۲۹۶ب — پنلِ «سایت‌سازها»: نام/پنلِ کاربر + لینکِ سایت + آمارِ بازدید و جستجو.
// فاز ۲۹۷ن — «حسابِ تازه ساختم، هیچ‌جوره نمی‌فهمم سایت/پیامکش چه شد»: حسابِ نقش‌دارِ
// «بدونِ سایت» هم ردیف می‌شود (در صفِ ساخت) و وضعیتِ پیامکِ هر ردیف با علتِ خطا می‌آید.
async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) }

interface DoneRec { at: number; slug?: string; smsAt?: number; smsTries?: number; manual?: boolean; lastErr?: string }
// وضعیتِ پیامکِ یک صاحبِ سایت — همان منطقِ جاروِ auto-site، برای نمایشِ ردیف‌به‌ردیف.
function smsStateOf(owner: string, rec: DoneRec | undefined, hasSite: boolean): string {
  if (rec?.manual) return 'manual'            // دست‌ساز — پیامکِ خودکار ندارد
  if (rec?.smsAt) return 'sent'
  if (!/^09\d{9}$/.test(owner)) return 'invalid'   // شمارهٔ ثابت — پیامک‌ناپذیر
  if ((rec?.smsTries || 0) >= 3) return 'failed'
  return hasSite ? 'waiting' : 'queued'       // سایت ساخته → در صفِ پیامک؛ وگرنه هنوز در صفِ ساخت
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const [sites, stats] = await Promise.all([listSiteHeads(), allSiteStats()])
  const autoMeta = pgEnabled() ? await kvGet<{ done?: Record<string, DoneRec> }>('autosite_meta', {}) : {}
  const done = autoMeta.done || {}
  const roles = listRoles()
  const roleName = (rid?: string) => { if (!rid) return ''; const r = roles.find(x => x.id === rid || x.name === rid); return r?.name || rid }

  const rows = sites.map(st => {
    const owner = String(st.owner || '')
    const p = owner ? getProfile(owner) : null
    const acc = owner ? getAccount(owner) : null
    const rec = owner ? done[owner] : undefined
    const sm = summarize(stats.get(st.slug))
    return {
      slug: st.slug,
      title: st.title,
      owner,
      ownerName: (p?.businessName || p?.displayName || acc?.name || '').trim() || owner,
      role: roleName(acc?.role),
      auto: !!rec && !rec.manual,
      pending: false,
      smsState: smsStateOf(owner, rec, true),
      smsAt: rec?.smsAt || 0,
      smsTries: rec?.smsTries || 0,
      smsErr: rec?.lastErr || '',
      siteAt: rec?.at || st.createdAt,
      lastLogin: acc?.lastLogin || 0,   // فاز ۲۹۶ب — آخرین ورودِ صاحبِ سایت به پنلش
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
      today: sm.today, d7v: sm.d7v, d7s: sm.d7s, totalV: sm.totalV, totalS: sm.totalS, lastAt: sm.lastAt,
      topQueries: (stats.get(st.slug)?.queries || []).slice(0, 5).map(x => x.q),
    }
  }).sort((a, b) => (b.d7v - a.d7v) || (b.updatedAt - a.updatedAt))

  // فاز ۲۹۷ن — حساب‌های نقش‌دارِ «هنوز بدونِ سایت» (در صفِ جاروِ خودکار): جدیدترین‌ها اول،
  // تا حسابی که همین الان ساخته شد بلافاصله اینجا با وضعیتِ «در صفِ ساخت» دیده شود.
  const siteOwners = new Set(rows.map(r => r.owner))
  const pendingAll = listAccounts().filter(a => !siteOwners.has(a.phone) && urlTypeForRole(a.role))
  const pendingRows = pendingAll
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 1000)
    .map(a => {
      const p = getProfile(a.phone)
      const rec = done[a.phone]
      return {
        slug: '', title: '', owner: a.phone,
        ownerName: (p?.businessName || p?.displayName || a.name || '').trim() || a.phone,
        role: roleName(a.role),
        auto: true, pending: true,
        smsState: smsStateOf(a.phone, rec, false),
        smsAt: rec?.smsAt || 0, smsTries: rec?.smsTries || 0, smsErr: rec?.lastErr || '',
        siteAt: 0, lastLogin: a.lastLogin || 0, createdAt: a.createdAt || 0, updatedAt: 0,
        today: 0, d7v: 0, d7s: 0, totalV: 0, totalS: 0, lastAt: 0, topQueries: [] as string[],
      }
    })

  const totals = {
    sites: rows.length,
    pending: pendingAll.length,   // کلِ در صفِ ساخت (نه فقط ۱۰۰۰تای نمایشی)
    auto: rows.filter(r => r.auto).length,
    manual: rows.filter(r => !r.auto).length,
    smsSent: rows.filter(r => r.smsAt).length,
    viewsToday: rows.reduce((s, r) => s + r.today, 0),
    views7d: rows.reduce((s, r) => s + r.d7v, 0),
    searches7d: rows.reduce((s, r) => s + r.d7s, 0),
    // فاز ۲۹۶ب — فعالیتِ صاحبانِ سایت: چندتا اصلاً وارد شده‌اند و چندتا در ۷ روزِ اخیر
    loggedInEver: rows.filter(r => r.lastLogin).length,
    loggedIn7d: rows.filter(r => r.lastLogin && Date.now() - r.lastLogin < 7 * 864e5).length,
  }
  // فاز ۲۹۶د — وضعیتِ پیامک‌های سایت‌ساز: ناموفقِ قطعی + نمونهٔ خطا (تا علت در پنل دیده شود).
  const smsSt = await smsStatus()
  return NextResponse.json({ rows: [...rows, ...pendingRows], totals: { ...totals, smsFailed: smsSt.failed, smsInvalid: smsSt.invalid, smsWaiting: smsSt.waiting, smsSampleErr: smsSt.sampleErr } }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  if (b.action === 'resetSms') {
    const n = await resetFailedSms()
    return NextResponse.json({ ok: true, reset: n })
  }
  // فاز ۲۹۷س — ارسالِ دستیِ پیامک به کاربر(های) انتخاب‌شده از پنل.
  if (b.action === 'sendSms') {
    const phones = Array.isArray(b.phones) ? b.phones.map(String) : []
    if (!phones.length) return NextResponse.json({ error: 'هیچ کاربری انتخاب نشده' }, { status: 400 })
    const r = await sendSmsManual(phones)
    return NextResponse.json({ ok: true, ...r })
  }
  return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
}
