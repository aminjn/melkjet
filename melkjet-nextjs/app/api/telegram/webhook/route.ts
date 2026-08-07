// فاز ۲۵۳ج/۲۵۷ — وب‌هوکِ ربات: آلارم (معامله→شهر→منطقه→محله) + ثبتِ آگهی از تلگرام
// (وصلِ شماره→ معامله→شهر→محله→عنوان→قیمت→متراژ→عکس→ممیزی). پاسخِ فوری، پردازش در پس‌زمینه.
import { NextRequest, NextResponse } from 'next/server'
import { tgApi, tgSend, tgFileBuffer } from '@/app/lib/telegram'
import {
  getDraft, setDraft, clearDraft, addSub, listSubs, removeSub,
  getLink, setLink, getLDraft, setLDraft, clearLDraft,
} from '@/app/lib/telegram-store'
import { sendTest, regionsForCity, hoodsForRegion, seedChannel } from '@/app/lib/telegram-notify'
import { addUserListing, listItems } from '@/app/lib/scraper-store'
import { moderateOne, moderationModel } from '@/app/lib/moderation'
import { saveMedia } from '@/app/lib/media-store'
import { getAccount } from '@/app/lib/account-store'

export const dynamic = 'force-dynamic'

const CITIES = ['تهران', 'مشهد', 'کرج', 'اصفهان', 'شیراز', 'تبریز']
// فاز ۲۵۵ — چتِ ادمین برای دستورهای مدیریتی (chat id در env). خالی = هیچ ادمینی.
const isAdmin = (chatId: number) => !!process.env.TELEGRAM_ADMIN_CHAT && String(chatId) === process.env.TELEGRAM_ADMIN_CHAT
// شمارهٔ تلگرام (989…/+989…/09…) → 09xxxxxxxxx
function normPhone(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('98')) d = '0' + d.slice(2)
  else if (d.startsWith('9') && d.length === 10) d = '0' + d
  return d
}
type Btn = { t: string; d: string }
function kb(rows: Btn[][]) { return { inline_keyboard: rows.map(r => r.map(b => ({ text: b.t, callback_data: b.d }))) } }
const menu = kb([
  [{ t: '➕ آلارمِ جدید', d: 'new' }, { t: '🔔 آلارم‌های من', d: 'mine' }],
  [{ t: '🏠 ثبتِ آگهی', d: 'nl' }, { t: '📋 آگهی‌های من', d: 'myads' }],
])
const dealLabel = (d: string) => (d === 'همه' ? 'خرید/اجاره' : d)
const subLabel = (s: { deal: string; city: string; region: string; hood: string }) =>
  `${dealLabel(s.deal)} · ${s.city}${s.region ? ' · ' + s.region : ''}${s.hood ? ' · ' + s.hood : ''}`

// ── آلارم ──────────────────────────────────────────────────────────────────
async function startFlow(chatId: number, mid?: number) {
  await clearLDraft(chatId)
  await setDraft(chatId, { step: 'deal' })
  const rm = kb([[{ t: '🏠 اجاره', d: 'd:اجاره' }, { t: '🔑 فروش', d: 'd:فروش' }], [{ t: 'همه', d: 'd:همه' }]])
  const text = 'یک آلارمِ جدید بسازیم 🔔\nنوعِ معامله؟'
  if (mid) await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text, reply_markup: rm })
  else await tgSend(chatId, text, { reply_markup: rm })
}
async function askCity(chatId: number, mid: number) {
  const rows: Btn[][] = []
  for (let i = 0; i < CITIES.length; i += 2) rows.push(CITIES.slice(i, i + 2).map(c => ({ t: c, d: 'c:' + c })))
  rows.push([{ t: 'سایر شهرها ✍️', d: 'c:__other' }])
  await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: 'شهر؟', reply_markup: kb(rows) })
}
async function presentRegions(chatId: number, deal: string | undefined, city: string) {
  const regions = await regionsForCity(city, 18)
  await setDraft(chatId, { step: 'region', deal, city, regions })
  if (!regions.length) { await presentHoods(chatId, deal, city, ''); return }
  const rows: Btn[][] = []
  for (let i = 0; i < regions.length; i += 2) rows.push(regions.slice(i, i + 2).map((r, k) => ({ t: r, d: 'r:' + (i + k) })))
  rows.push([{ t: 'همهٔ مناطق', d: 'r:__all' }, { t: 'منطقهٔ دیگر ✍️', d: 'r:__text' }])
  await tgSend(chatId, `منطقه را انتخاب کن (${city}):`, { reply_markup: kb(rows) })
}
async function presentHoods(chatId: number, deal: string | undefined, city: string, region: string) {
  const hoods = await hoodsForRegion(city, region, 14)
  await setDraft(chatId, { step: 'hood', deal, city, region, hoods })
  if (!hoods.length) { await tgSend(chatId, 'محلهٔ موردنظرت را بنویس، یا «همهٔ محله‌ها».', { reply_markup: kb([[{ t: 'همهٔ محله‌ها', d: 'h:__all' }]]) }); return }
  const rows: Btn[][] = []
  for (let i = 0; i < hoods.length; i += 2) rows.push(hoods.slice(i, i + 2).map((h, k) => ({ t: h, d: 'h:' + (i + k) })))
  rows.push([{ t: 'همهٔ محله‌ها', d: 'h:__all' }, { t: 'محلهٔ دیگر ✍️', d: 'h:__text' }])
  await tgSend(chatId, region ? `محله را در «${region}» انتخاب کن؛ یا نامش را بنویس:` : 'محله را انتخاب کن؛ یا نامش را بنویس:', { reply_markup: kb(rows) })
}
async function saveSub(chatId: number, deal: string, city: string, region: string, hood: string) {
  await addSub({ chatId, deal, city, region, hood }); await clearDraft(chatId)
  await tgSend(chatId, `✅ آلارم ذخیره شد:\n<b>${subLabel({ deal, city, region, hood })}</b>\n\nبه‌محضِ آگهیِ منطبقِ جدید، همین‌جا خبرت می‌کنم.`, { reply_markup: menu })
}
async function showMine(chatId: number) {
  const subs = await listSubs(chatId)
  if (!subs.length) { await tgSend(chatId, 'هنوز آلارمی نداری. «➕ آلارمِ جدید» را بزن.', { reply_markup: menu }); return }
  for (const s of subs) await tgSend(chatId, `🔔 ${subLabel(s)}`, { reply_markup: kb([[{ t: '🗑 حذف', d: 'del:' + s.id }]]) })
}

// ── فاز ۲۵۷: ثبتِ آگهی از تلگرام ────────────────────────────────────────────
async function startListing(chatId: number) {
  await clearDraft(chatId)
  const link = await getLink(chatId)
  if (!link) {
    await setLDraft(chatId, { step: 'deal' })   // منتظرِ اشتراکِ شماره؛ بعدش ادامه
    await tgSend(chatId, 'برای ثبتِ آگهی اول شماره‌ات را تأیید کن 👇 (تلگرام خودش تأییدش می‌کند)', {
      reply_markup: { keyboard: [[{ text: '📱 اشتراکِ شمارهٔ من', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    })
    return
  }
  await askListingDeal(chatId)
}
async function askListingDeal(chatId: number) {
  await setLDraft(chatId, { step: 'deal' })
  await tgSend(chatId, 'ثبتِ آگهیِ جدید 🏠\nنوعِ معامله؟', { reply_markup: kb([[{ t: '🏠 اجاره', d: 'ld:اجاره' }, { t: '🔑 فروش', d: 'ld:فروش' }]]) })
}
async function askListingCity(chatId: number, deal: string) {
  await setLDraft(chatId, { step: 'city', deal })
  const rows: Btn[][] = []
  for (let i = 0; i < CITIES.length; i += 2) rows.push(CITIES.slice(i, i + 2).map(c => ({ t: c, d: 'lc:' + c })))
  await tgSend(chatId, 'شهر؟ (یا نامش را بنویس)', { reply_markup: kb(rows) })
}
async function askPhoto(chatId: number) {
  await tgSend(chatId, 'یک عکس از ملک بفرست 📷 (یا «بدونِ عکس»)', { reply_markup: kb([[{ t: 'بدونِ عکس', d: 'lnophoto' }]]) })
}
async function confirmListing(chatId: number) {
  const ld = await getLDraft(chatId); if (!ld) return
  const summary = [
    `🏠 <b>${ld.title || ''}</b>`, ld.price ? `💰 ${ld.price}` : '',
    `📍 ${ld.city || ''}${ld.hood ? '، ' + ld.hood : ''}`, ld.area ? `📐 ${ld.area} متر` : '',
    `🔖 ${ld.deal || ''}`, ld.image ? '🖼 عکس ✓' : '🖼 بدونِ عکس',
  ].filter(Boolean).join('\n')
  await tgSend(chatId, `این آگهی ثبت شود؟\n\n${summary}`, { reply_markup: kb([[{ t: '✅ ثبت', d: 'lok' }, { t: '✖️ لغو', d: 'lcancel' }]]) })
}
async function submitListing(chatId: number) {
  const ld = await getLDraft(chatId); const link = await getLink(chatId)
  if (!ld || !ld.title) { await tgSend(chatId, 'اطلاعات ناقص است — دوباره «🏠 ثبتِ آگهی» را بزن.', { reply_markup: menu }); await clearLDraft(chatId); return }
  const meta: Record<string, string> = {}
  if (ld.deal) meta['نوع معامله'] = ld.deal
  if (ld.city) meta['شهر'] = ld.city
  if (ld.hood) meta['محله'] = ld.hood
  if (ld.area) meta['متراژ'] = ld.area
  const location = [ld.city, ld.hood].filter(Boolean).join('، ') || undefined
  const item = await addUserListing({ title: ld.title, price: ld.price, location, image: ld.image, phone: link?.phone, owner: link?.name, meta })
  await clearLDraft(chatId)
  if (item.status === 'duplicate') { await tgSend(chatId, '⚠️ این آگهی قبلاً در ملک‌جت ثبت شده (ملکِ مشابه).', { reply_markup: menu }); return }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let verdict: any = { status: 'pending', reason: 'در صفِ بررسی' }
  try { verdict = await moderateOne(item, moderationModel()) } catch { /* بماند در صف */ }
  if (verdict.status === 'approved') await tgSend(chatId, `✅ آگهی ثبت و تأیید شد و در سایت منتشر شد!\nhttps://melkjet.com/property/${item.id}`, { reply_markup: menu })
  else if (verdict.status === 'rejected') await tgSend(chatId, `❌ آگهی تأیید نشد: ${verdict.reason || 'مغایر با قوانین'}\nمی‌تونی اصلاحش کنی و دوباره ثبت کنی.`, { reply_markup: menu })
  else await tgSend(chatId, '🕒 آگهی ثبت شد و در صفِ بررسی است؛ پس از تأیید در سایت منتشر می‌شود.', { reply_markup: menu })
}
async function showMyAds(chatId: number) {
  const link = await getLink(chatId)
  if (!link) { await tgSend(chatId, 'اول با «🏠 ثبتِ آگهی» شماره‌ات را تأیید کن.', { reply_markup: menu }); return }
  const items = await listItems('listing')
  const mine = items.filter(i => i.phone && normPhone(i.phone) === link.phone).slice(0, 10)
  if (!mine.length) { await tgSend(chatId, 'هنوز آگهی‌ای ثبت نکردی. «🏠 ثبتِ آگهی» را بزن.', { reply_markup: menu }); return }
  for (const it of mine) {
    const st = it.status === 'approved' ? '✅ منتشرشده' : it.status === 'rejected' ? '❌ ردشده' : it.status === 'duplicate' ? '♻️ تکراری' : '🕒 در بررسی'
    const link2 = it.status === 'approved' ? `\nhttps://melkjet.com/property/${it.id}` : ''
    await tgSend(chatId, `${st} — ${it.title}${link2}`)
  }
}
// متنِ کاربر در جریانِ ثبتِ آگهی (بسته به step)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleListingText(chatId: number, ld: any, text: string) {
  if (ld.step === 'city') { await setLDraft(chatId, { ...ld, city: text, step: 'hood' }); await tgSend(chatId, 'محله؟ (مثلاً: جنت‌آباد)') }
  else if (ld.step === 'hood') { await setLDraft(chatId, { ...ld, hood: text, step: 'title' }); await tgSend(chatId, 'عنوانِ آگهی؟ (مثلاً: آپارتمان ۹۰ متری جنت‌آباد شمالی)') }
  else if (ld.step === 'title') { await setLDraft(chatId, { ...ld, title: text, step: 'price' }); await tgSend(chatId, ld.deal === 'اجاره' ? 'قیمت؟ (مثلاً: ودیعه ۵۰۰م، اجاره ۱۰م)' : 'قیمت؟ (مثلاً: ۵ میلیارد و ۲۰۰)') }
  else if (ld.step === 'price') { await setLDraft(chatId, { ...ld, price: text, step: 'area' }); await tgSend(chatId, 'متراژ؟ (فقط عدد، یا بنویس «رد»)') }
  else if (ld.step === 'area') { const area = /^(رد|بیخیال|بی‌خیال|skip|-)$/i.test(text.trim()) ? '' : text; await setLDraft(chatId, { ...ld, area, step: 'photo' }); await askPhoto(chatId) }
  else if (ld.step === 'photo') {
    if (/بدون|رد|skip/i.test(text)) { await setLDraft(chatId, { ...ld, step: 'confirm' }); await confirmListing(chatId) }
    else await tgSend(chatId, 'یک عکس بفرست 📷 یا دکمهٔ «بدونِ عکس» را بزن.')
  }
  else await tgSend(chatId, 'برای شروع «🏠 ثبتِ آگهی» را بزن.', { reply_markup: menu })
}

// ── هستهٔ پردازش ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handle(u: any) {
  const cq = u?.callback_query
  if (cq) {
    const chatId = cq.message?.chat?.id; const mid = cq.message?.message_id; const data = String(cq.data || '')
    await tgApi('answerCallbackQuery', { callback_query_id: cq.id })
    if (!chatId) return
    // آلارم
    if (data === 'new') await startFlow(chatId, mid)
    else if (data === 'mine') await showMine(chatId)
    else if (data.startsWith('d:')) { await setDraft(chatId, { step: 'city', deal: data.slice(2) }); await askCity(chatId, mid) }
    else if (data.startsWith('c:')) {
      const city = data.slice(2); const dr = await getDraft(chatId)
      if (city === '__other') { await setDraft(chatId, { step: 'cityText', deal: dr?.deal }); await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: 'نامِ شهر را بنویس:' }) }
      else { await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: `شهر: ${city} ✅` }); await presentRegions(chatId, dr?.deal, city) }
    }
    else if (data === 'r:__all') { const dr = await getDraft(chatId); if (dr?.deal && dr.city) await saveSub(chatId, dr.deal, dr.city, '', '') }
    else if (data === 'r:__text') { const dr = await getDraft(chatId); await setDraft(chatId, { step: 'regionText', deal: dr?.deal, city: dr?.city }); await tgSend(chatId, 'نامِ منطقه را بنویس:') }
    else if (data.startsWith('r:')) { const dr = await getDraft(chatId); const i = parseInt(data.slice(2), 10); const region = (dr?.regions && dr.regions[i]) || ''; await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: `منطقه: ${region} ✅` }); await presentHoods(chatId, dr?.deal, dr?.city || '', region) }
    else if (data === 'h:__all') { const dr = await getDraft(chatId); if (dr?.deal && dr.city) await saveSub(chatId, dr.deal, dr.city, dr.region || '', '') }
    else if (data === 'h:__text') { const dr = await getDraft(chatId); await setDraft(chatId, { step: 'hood', deal: dr?.deal, city: dr?.city, region: dr?.region }); await tgSend(chatId, 'نامِ محله را بنویس:') }
    else if (data.startsWith('h:')) { const dr = await getDraft(chatId); const i = parseInt(data.slice(2), 10); const h = (dr?.hoods && dr.hoods[i]) || ''; if (dr?.deal && dr.city) await saveSub(chatId, dr.deal, dr.city, dr.region || '', h) }
    else if (data.startsWith('del:')) { await removeSub(chatId, data.slice(4)); await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: '🗑 حذف شد.' }) }
    // ثبتِ آگهی
    else if (data === 'nl') await startListing(chatId)
    else if (data === 'myads') await showMyAds(chatId)
    else if (data.startsWith('ld:')) { await askListingCity(chatId, data.slice(3)) }
    else if (data.startsWith('lc:')) { const dr = await getLDraft(chatId); await setLDraft(chatId, { ...(dr || {}), city: data.slice(3), step: 'hood' }); await tgSend(chatId, `شهر: ${data.slice(3)} ✅\nمحله؟ (مثلاً: جنت‌آباد)`) }
    else if (data === 'lnophoto') { const dr = await getLDraft(chatId); await setLDraft(chatId, { ...(dr || {}), step: 'confirm' }); await confirmListing(chatId) }
    else if (data === 'lok') { await submitListing(chatId) }
    else if (data === 'lcancel') { await clearLDraft(chatId); await tgSend(chatId, 'ثبتِ آگهی لغو شد.', { reply_markup: menu }) }
    return
  }

  const msg = u?.message; const chatId = msg?.chat?.id
  if (!chatId) return

  // اشتراکِ شماره (وصلِ حساب) — فاز ۲۵۷
  if (msg.contact) {
    const c = msg.contact
    if (c.user_id && msg.from?.id && c.user_id !== msg.from.id) { await tgSend(chatId, 'لطفاً شمارهٔ «خودت» را به اشتراک بگذار.'); return }
    const phone = normPhone(c.phone_number)
    const acc = getAccount(phone)
    await setLink({ chatId, phone, name: acc?.name || msg.from?.first_name, role: acc?.role, linkedAt: Date.now() })
    await tgSend(chatId, `✅ شماره تأیید شد: <code>${phone}</code>`, { reply_markup: { remove_keyboard: true } })
    if (await getLDraft(chatId)) await askListingDeal(chatId)
    else await tgSend(chatId, 'حالا می‌تونی از «🏠 ثبتِ آگهی» استفاده کنی.', { reply_markup: menu })
    return
  }

  // عکس (در جریانِ ثبتِ آگهی) — فاز ۲۵۷
  if (Array.isArray(msg.photo) && msg.photo.length) {
    const ld = await getLDraft(chatId)
    if (ld && ld.step === 'photo') {
      const fileId = msg.photo[msg.photo.length - 1].file_id
      await tgSend(chatId, '⏳ در حالِ دریافتِ عکس…')
      const f = await tgFileBuffer(fileId)
      if (f) { const m = saveMedia(f.buffer, f.mime, 'tg-listing.jpg'); await setLDraft(chatId, { ...ld, image: `/api/media/${m.id}`, step: 'confirm' }); await confirmListing(chatId) }
      else await tgSend(chatId, 'عکس دریافت نشد؛ دوباره بفرست یا «بدونِ عکس» را بزن.')
    }
    return
  }

  const text = String(msg.text || '').trim()
  const first = (msg.from?.first_name || 'دوست').toString()
  if (!text) return
  if (text === '/start') { await clearDraft(chatId); await clearLDraft(chatId); await tgSend(chatId, `سلام ${first} 👋\nبه رباتِ <b>ملک‌جت</b> خوش آمدی.\n\n🔔 <b>آلارم</b> بساز تا آگهیِ منطبق را همان لحظه برایت بفرستم.\n🏠 یا از همین‌جا <b>آگهی ثبت کن</b> تا در سایت منتشر شود.`, { reply_markup: menu }) }
  else if (text === '/ping') { await tgSend(chatId, '🏓 pong') }
  else if (text === '/newlisting') { await startListing(chatId) }
  else if (text === '/myads') { await showMyAds(chatId) }
  else if (text === '/testalert') { const ok = await sendTest(chatId); if (!ok) await tgSend(chatId, 'فعلاً آگهیِ منطبقی نیست — اول یک آلارم بساز.') }
  else if (text === '/whoami') { await tgSend(chatId, `chat id شما: <code>${chatId}</code>`) }
  else if (text.startsWith('/pushchannel')) {
    if (!isAdmin(chatId)) { await tgSend(chatId, '⛔ فقط ادمین.') }
    else { const n = parseInt(text.split(/\s+/)[1] || '5', 10) || 5; const c = await seedChannel(n); await tgSend(chatId, c ? `✅ ${c} آگهی به کانال پست شد.` : '⚠️ کانال تنظیم نشده (TELEGRAM_CHANNEL) یا آگهیِ عمومی‌ای نیست.') }
  }
  else {
    // اول جریانِ ثبتِ آگهی (اگر فعال است)، بعد آلارم
    const ld = await getLDraft(chatId)
    if (ld) { await handleListingText(chatId, ld, text); return }
    const dr = await getDraft(chatId)
    if (dr?.step === 'cityText') { await tgSend(chatId, `شهر: ${text} ✅`); await presentRegions(chatId, dr.deal, text) }
    else if (dr?.step === 'regionText') { await tgSend(chatId, `منطقه: ${text} ✅`); await presentHoods(chatId, dr.deal, dr.city || '', text) }
    else if (dr?.step === 'hood' && dr.deal && dr.city) { await saveSub(chatId, dr.deal, dr.city, dr.region || '', text) }
    else { await tgSend(chatId, 'از منوی زیر انتخاب کن یا /start.', { reply_markup: menu }) }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) return NextResponse.json({ ok: false }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = (await req.json().catch(() => null)) as any
  if (u) handle(u).catch(e => console.warn('[tg] handle:', (e as Error).message))   // پس‌زمینه
  return NextResponse.json({ ok: true })                                            // پاسخِ فوری
}
export async function GET() { return NextResponse.json({ ok: true, service: 'telegram-webhook' }) }
