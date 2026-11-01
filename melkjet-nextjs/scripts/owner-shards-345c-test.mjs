// فاز ۳۴۵ج — شاردِ «هر مالک ردیفِ خودش» برای خریدار/مالک/آژانس/مصالح/پنل‌های تخصصی.
// Run (روی PostgreSQLِ تمیز): DATABASE_URL=postgres://reos:reos@127.0.0.1:5432/reos_us node --import ./scripts/reos-loader.mjs scripts/owner-shards-345c-test.mjs
if (!process.env.DATABASE_URL) { console.log('DATABASE_URL لازم است (PG تمیز)'); process.exit(1) }
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }
const db = await import('../app/lib/db.ts')
const A = '09120000011', B = '09120000022', C = '09120000033'
// بلاب‌های قدیمی (شکلِ واقعیِ تولید)
await db.kvSet('buyer', { buyers: { [A]: { profile: { name: 'خریدارِ قدیمی' }, saved: [{ id: 's1', title: 'آپارتمان قدیمی' }], searches: [], viewings: [], offers: [], messages: [], conversations: [], aiChats: [], settings: {} } } })
await db.kvSet('owner', { owners: { [B]: { profile: { name: 'مالکِ قدیمی' }, properties: [{ id: 'pr1', title: 'ویلای شمال' }], inquiries: [{ id: 'q1', propertyId: 'pr1', name: 'آقای الف', customerPhone: A, status: 'new', createdAt: 1 }], viewings: [], offers: [] } } })
await db.kvSet('agency', { agencies: { [C]: { profile: { name: 'آژانسِ قدیمی', branches: '' }, agents: [], listings: [], leads: [{ id: 'l1', name: 'لیدِ قدیمی', stage: 'new', createdAt: 1 }], deals: [], monthlySales: [], createdAt: 1 } } })
await db.kvSet('materials', { shops: { [B]: { slug: 'shop-abc123', profile: { name: 'مصالحِ قدیمی', rating: 0 }, products: [], orders: [], inquiries: [{ id: 'mi1', customer: 'الف', customerPhone: A, product: 'سیمان', qty: '۱۰', createdAt: 2 }], createdAt: 1 } } })
await db.kvSet('prodesk', { requests: [{ id: 'r1', owner: C, role: '/architect', clientName: 'مشتری', customerPhone: A, status: 'new', createdAt: 3, updatedAt: 3 }], records: [{ id: 'rc1', owner: C, role: '/architect', title: 'نمونه‌کار', status: 'active', createdAt: 3, updatedAt: 3 }] })

const Bu = await import('../app/lib/buyer-store.ts')
const Ow = await import('../app/lib/owner-store.ts')
const Ag = await import('../app/lib/agency-store.ts')
const Ma = await import('../app/lib/materials-store.ts')
const Pd = await import('../app/lib/prodesk-store.ts')

// ── خریدار ──
const b = await Bu.getBuyer(A)
ok('خریدار: دادهٔ قدیمی مهاجرت کرد', b.profile?.name === 'خریدارِ قدیمی' && b.saved.length === 1)
ok('خریدار: ردیفِ جدا ساخته شد', !!(await db.kvGet('ush:buyer:' + A, null)))
await Bu.addSaved(A, { title: 'آپارتمان تازه', listingId: 'x1' })
ok('خریدار: نوشتن روی ردیفِ خودش', (await Bu.listSaved(A)).length === 2 && (await db.kvGet('buyer', {})).buyers[A].saved.length === 1)
ok('خریدار: کاربرِ تازه ⇒ رکوردِ خالی، نه خطا', Array.isArray((await Bu.getBuyer('09129990001')).saved))

// ── مالک ──
ok('مالک: املاکِ قدیمی', (await Ow.listProperties(B)).length === 1)
const mine = await Ow.listMyPropertyInquiries(A)
ok('مالک: «استعلام‌های من» از همهٔ مالکان (اسکنِ شاردها)', mine.length === 1 && mine[0].propertyTitle === 'ویلای شمال')
await Ow.addInquiry(B, { propertyId: 'pr1', name: 'آقای ب', customerPhone: A })
ok('مالک: استعلامِ تازه بلافاصله در «استعلام‌های من» (کشِ خودی باطل شد)', (await Ow.listMyPropertyInquiries(A)).length === 2)

// ── آژانس ──
ok('آژانس: لیدهای قدیمی', (await Ag.listLeads(C)).length === 1)
await Ag.addLead(C, { name: 'لیدِ تازه', stage: 'new' })
ok('آژانس: افزودنِ لید', (await Ag.listLeads(C)).length === 2)
ok('آژانس: خلاصهٔ کارِ همهٔ آژانس‌ها', ((await Ag.agencyWorkSummary())[C] || {}).leads === 2)

// ── مصالح ──
const found = await Ma.shopBySlug('shop-abc123')
ok('مصالح: یافتنِ فروشگاه با نامک (صفحهٔ عمومی)', found?.owner === B)
ok('مصالح: «استعلام‌های من» از همهٔ فروشگاه‌ها', (await Ma.listMyInquiries(A)).length === 1)
const q = await Ma.addPublicInquiry('shop-abc123', { customer: 'ج', customerPhone: A, product: 'گچ', qty: '۵' })
ok('مصالح: استعلامِ عمومی به فروشگاهِ درست رسید', !!q && (await Ma.listReceivedInquiries(B)).length === 2)
const shop2 = await Ma.getShop(C)
ok('مصالح: فروشگاهِ تازه نامکِ یکتا می‌گیرد', !!shop2.slug && shop2.slug !== 'shop-abc123')
ok('مصالح: حذفِ دادهٔ یک فروشنده فقط ردیفِ خودش', (await Ma.deleteMaterialsData(C)) === true && !!(await Ma.shopBySlug('shop-abc123')))

// ── پنل‌های تخصصی ──
ok('تخصصی: درخواست‌ها و رکوردهای قدیمی', (await Pd.listRequests(C, '/architect')).length === 1 && (await Pd.listRecords(C, '/architect')).length === 1)
await Pd.addRequest(C, '/architect', { clientName: 'مشتری دوم', customerPhone: A })
ok('تخصصی: افزودنِ درخواست + آمار', (await Pd.proStats(C, '/architect')).total === 2)
ok('تخصصی: «استعلام‌های من» (سمتِ مشتری، همهٔ متخصصان)', (await Pd.listMyProRequests(A)).length === 2)
ok('تخصصی: ردیفِ جدا، بلابِ قدیمی یخ‌زده', !!(await db.kvGet('ush:prodesk:' + C, null)) && (await db.kvGet('prodesk', {})).requests.length === 1)

// ── ایدمپوتنسیِ مهاجرت ──
const marks = await Promise.all(['buyer_shard_v1', 'owner_shard_v1', 'agency_shard_v1', 'materials_shard_v1', 'prodesk_shard_v1'].map(k => db.kvGet(k, {})))
ok('نشان‌های مهاجرت ثبت شد', marks.every(m => m.done === true))
// کشِ «همه» پس از نوشتنِ خودی باطل می‌شود (تخصصی): اول کش پر شود، بعد درخواستِ تازه
await Pd.listMyProRequests(A)
await Pd.addRequest(C, '/architect', { clientName: 'مشتری سوم', customerPhone: A })
ok('تخصصی: کشِ «استعلام‌های من» پس از ثبتِ تازه باطل می‌شود', (await Pd.listMyProRequests(A)).length === 3)
await Ma.listMyInquiries(A)
await Ma.addInquiry(B, { customer: 'د', customerPhone: A, product: 'آجر', qty: '۱' })
ok('مصالح: کشِ «استعلام‌های من» پس از ثبتِ تازه باطل می‌شود', (await Ma.listMyInquiries(A)).length === 3)
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
