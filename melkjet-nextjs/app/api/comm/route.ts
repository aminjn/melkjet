import { NextRequest, NextResponse } from 'next/server'
import { requireModule } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import { listPackages, setPackages, getCredit, grantCredit, createOrder, createPlanOrder, createPromoOrder, createBundleOrder, createPromoCreditOrder, getPromoWallet, listOrders, approveOrder, rejectOrder, getTokenUsage } from '@/app/lib/comm-store'
import { listActive, getPlan } from '@/app/lib/plan-store'
import { promoTierOf, promoDiscountForPlanName, bundlesAll, tiersForRole, bundleOf, creditPacks, slotOf, myActivePromotions, hasActivePromoInSlot, maxAreasPerPromo } from '@/app/lib/promotion-store'
import { ensurePromoPricing } from '@/app/lib/promo-pricing-store'
import { getProfile } from '@/app/lib/profile-store'
import { getAccount, dashForRole, activePlan } from '@/app/lib/account-store'
import { listNotifs, unreadCount, markAllRead } from '@/app/lib/notif-store'

// تخفیفِ پروموتِ کاربر از روی پلنِ اشتراکِ حسابش.
const discountFor = (phone: string) => { try { return promoDiscountForPlanName(getPlan(getAccount(phone)?.plan || '')?.name) } catch { return 0 } }
// داشبوردِ نقشِ کاربر (super_admin → /pros تا کاتالوگِ کامل ببیند).
const dashFor = (phone: string, role?: string) => role === 'super_admin' ? '/pros' : dashForRole(getAccount(phone)?.role)

// ارتباطات: پکیج‌های شارژ + اعتبارِ کاربر + سفارش‌ها.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'marketing'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  await ensurePromoPricing()
  const sp = new URL(req.url).searchParams
  // نمای سوپرادمین: همهٔ پکیج‌ها + همهٔ سفارش‌ها
  if (sp.get('admin') === '1') {
    if (s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    return NextResponse.json({ packages: await listPackages(false), orders: await listOrders() }, { headers: { 'Cache-Control': 'no-store' } })
  }
  // نمای کاربر: پکیج‌های فعال + اعتبارِ خودش + سفارش‌های خودش + کاتالوگِ پروموتِ نقش‌محور
  const dash = dashFor(s.phone, s.role)
  // نشانِ «کجا نمایش داده می‌شود» را به هر بسته اضافه کن تا کاربر بداند پروموت دقیقاً کجا می‌آید.
  const withWhere = <T extends { slot: string }>(t: T) => ({ ...t, where: slotOf(t.slot)?.where || '', slotLabel: slotOf(t.slot)?.label || '' })
  const tiers = tiersForRole(dash).map(withWhere)
  const bundles = bundlesAll().filter(b => b.forRoles.includes(dash)).map(b => ({ ...b, where: Array.from(new Set(b.tierIds.map(id => { const t = promoTierOf(id); return t ? (slotOf(t.slot)?.where || '') : '' }).filter(Boolean))).join(' + ') }))
  return NextResponse.json({ packages: await listPackages(true), credit: await getCredit(s.phone), orders: await listOrders(s.phone), tokenUsed: await getTokenUsage(s.phone), promoTiers: tiers, promoBundles: bundles, promoDiscount: discountFor(s.phone), promoWallet: await getPromoWallet(s.phone), promoCreditPacks: creditPacks(), myPromotions: await myActivePromotions(s.phone), activePlan: activePlan(s.phone), maxAreas: maxAreasPerPromo(), notifs: await listNotifs(s.phone, 20), unreadNotifs: await unreadCount(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'marketing'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  await ensurePromoPricing()
  const b = await req.json().catch(() => ({} as any))
  const act = String(b.action || '')
  const isAdmin = s.role === 'super_admin'

  // عملیاتِ کاربری
  if (act === 'order') {
    if (!b.packageId) return NextResponse.json({ error: 'پکیج را انتخاب کنید' }, { status: 400 })
    const r = await createOrder(s.phone, String(b.packageId), { gateway: b.gateway ? String(b.gateway) : undefined, receipt: b.receipt ? String(b.receipt).slice(0, 120) : undefined })
    return r.ok ? NextResponse.json({ ok: true, order: r.order }) : NextResponse.json({ error: r.error }, { status: 400 })
  }
  if (act === 'orderPlan') {
    const pl = listActive().find(p => p.id === String(b.planId || ''))
    if (!pl) return NextResponse.json({ error: 'پلن یافت نشد' }, { status: 400 })
    // گِیتِ خریدِ دوباره: تا پایانِ پلنِ فعال، خریدِ دوباره مجاز نیست.
    const ap = activePlan(s.phone)
    if (ap) { const d = ap.expiresAt ? Math.max(1, Math.ceil((ap.expiresAt - Date.now()) / 86400000)) : 0; return NextResponse.json({ error: `شما پلنِ فعال دارید${d ? ` (${d.toLocaleString('fa-IR')} روز باقی‌مانده)` : ''}. پس از پایانِ آن می‌توانید دوباره تهیه کنید.` }, { status: 400 }) }
    const period = ['monthly', '3m', '6m', 'yearly'].includes(String(b.period)) ? String(b.period) : 'monthly'
    const priceMap: Record<string, number> = { monthly: pl.priceMonthly, '3m': (pl as any).price3m || pl.priceMonthly * 3, '6m': (pl as any).price6m || pl.priceMonthly * 6, yearly: pl.priceYearly }
    const labelMap: Record<string, string> = { monthly: '', '3m': ' (۳ماهه)', '6m': ' (۶ماهه)', yearly: ' (سالانه)' }
    const r = await createPlanOrder(s.phone, pl.id, `${pl.name}${labelMap[period]}`, priceMap[period], { gateway: b.gateway ? String(b.gateway) : undefined, receipt: b.receipt ? String(b.receipt).slice(0, 120) : undefined, period })
    return NextResponse.json({ ok: true, order: r.order })
  }

  if (act === 'orderPromo') {
    const t = promoTierOf(String(b.tierId || ''))
    if (!t) return NextResponse.json({ error: 'بستهٔ پروموت یافت نشد' }, { status: 400 })
    let targetId = String(b.targetId || ''), targetName: string | undefined = b.targetName ? String(b.targetName) : undefined
    if (t.target === 'profile') {
      // پروموتِ پروفایل: همیشه پروفایلِ خودِ کاربر (شمارهٔ نشست) — نامش را سرور برمی‌دارد.
      targetId = s.phone
      const p = getProfile(s.phone); targetName = (p.businessName || p.displayName || '').trim() || undefined
    }
    if (!targetId) return NextResponse.json({ error: 'موردِ پروموت مشخص نیست' }, { status: 400 })
    if (t.target === 'listing') {
      // پروموتِ آگهی: آگهی باید منتشرشده و متعلق به خودِ کاربر باشد (جلوگیری از پروموتِ آگهیِ دیگران).
      const { getItemById } = await import('@/app/lib/scraper-store')
      const it = await getItemById(targetId)
      if (!it) return NextResponse.json({ error: 'آگهیِ منتشرشده‌ای با این شناسه یافت نشد' }, { status: 400 })
      if (String((it as any).meta?.__ownerPhone || '') !== s.phone) return NextResponse.json({ error: 'فقط آگهی‌های خودتان را می‌توانید پروموت کنید' }, { status: 403 })
      if (!targetName) targetName = it.title
    }
    // گِیتِ خریدِ دوباره: اگر همین مورد در همین جایگاه پروموتِ فعال دارد، تا پایانِ آن دوباره مجاز نیست.
    const mine = await myActivePromotions(s.phone)
    const dup = mine.find(m => m.slot === t.slot && (t.target === 'profile' ? true : m.targetId === targetId))
    if (dup) { const d = dup.expiresAt ? Math.max(1, Math.ceil((dup.expiresAt - Date.now()) / 86400000)) : 0; return NextResponse.json({ error: `این ${t.target === 'profile' ? 'جایگاه برای کسب‌وکارِ شما' : 'آگهی در این جایگاه'} پروموتِ فعال دارد${d ? ` (${d.toLocaleString('fa-IR')} روز باقی‌مانده)` : ''}. پس از پایانِ آن دوباره تهیه کنید.` }, { status: 400 }) }
    const areas = Array.isArray(b.areas) ? b.areas.map((a: any) => String(a).trim()).filter(Boolean).slice(0, maxAreasPerPromo()) : []
    const r = await createPromoOrder(s.phone, { tierId: t.id, targetId, targetName, discountPct: discountFor(s.phone), payFromWallet: !!b.payFromWallet, areas }, { gateway: b.gateway ? String(b.gateway) : undefined, receipt: b.receipt ? String(b.receipt).slice(0, 120) : undefined })
    return r.ok ? NextResponse.json({ ok: true, order: r.order, walletPaid: r.walletPaid }) : NextResponse.json({ error: r.error }, { status: 400 })
  }

  if (act === 'orderBundle') {
    const bundle = bundleOf(String(b.bundleId || ''))
    if (!bundle) return NextResponse.json({ error: 'باندلِ پروموت یافت نشد' }, { status: 400 })
    // باندل همیشه روی پروفایلِ خودِ کاربر فعال می‌شود؛ نامش را سرور برمی‌دارد.
    const p = getProfile(s.phone); const targetName = (p.businessName || p.displayName || '').trim() || undefined
    // گِیتِ خریدِ دوباره: اگر یکی از جایگاه‌های باندل پروموتِ فعال دارد، تا پایانِ آن مجاز نیست.
    const bundleSlots = new Set(bundle.tierIds.map(id => promoTierOf(id)?.slot).filter(Boolean) as string[])
    const mineB = await myActivePromotions(s.phone)
    if (mineB.some(m => bundleSlots.has(m.slot))) return NextResponse.json({ error: 'یکی از جایگاه‌های این باندل هم‌اکنون پروموتِ فعال دارد. پس از پایانِ آن دوباره تهیه کنید.' }, { status: 400 })
    const r = await createBundleOrder(s.phone, { bundleId: bundle.id, discountPct: discountFor(s.phone), targetName, payFromWallet: !!b.payFromWallet }, { gateway: b.gateway ? String(b.gateway) : undefined, receipt: b.receipt ? String(b.receipt).slice(0, 120) : undefined })
    return r.ok ? NextResponse.json({ ok: true, order: r.order, walletPaid: r.walletPaid }) : NextResponse.json({ error: r.error }, { status: 400 })
  }

  if (act === 'markNotifsRead') { await markAllRead(s.phone); return NextResponse.json({ ok: true }) }

  if (act === 'orderCredit') {
    const r = await createPromoCreditOrder(s.phone, String(b.packId || ''), { gateway: b.gateway ? String(b.gateway) : undefined, receipt: b.receipt ? String(b.receipt).slice(0, 120) : undefined })
    return r.ok ? NextResponse.json({ ok: true, order: r.order }) : NextResponse.json({ error: r.error }, { status: 400 })
  }

  // عملیاتِ سوپرادمین
  if (!isAdmin) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  switch (act) {
    case 'savePackages': return NextResponse.json({ ok: true, packages: await setPackages(Array.isArray(b.packages) ? b.packages : []) })
    case 'approveOrder': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const r = await approveOrder(String(b.id)); return r.ok ? NextResponse.json({ ok: true, orders: await listOrders() }) : NextResponse.json({ error: r.error }, { status: 400 }) }
    case 'rejectOrder': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await rejectOrder(String(b.id)); return NextResponse.json({ ok: true, orders: await listOrders() })
    case 'grantCredit': { if (!b.owner || !b.channel) return NextResponse.json({ error: 'گیرنده و کانال الزامی است' }, { status: 400 }); const c = await grantCredit(String(b.owner), b.channel === 'email' ? 'email' : 'sms', Number(b.amount) || 0); return NextResponse.json({ ok: true, credit: c }) }
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
