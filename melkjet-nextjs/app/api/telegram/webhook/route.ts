// فاز ۲۵۳ج/۲۵۷ — وب‌هوکِ ربات: آلارم (معامله→شهر→منطقه→محله) + ثبتِ آگهی از تلگرام
// (وصلِ شماره→ معامله→شهر→محله→عنوان→قیمت→متراژ→عکس→ممیزی). پاسخِ فوری، پردازش در پس‌زمینه.
import { NextRequest, NextResponse } from 'next/server'
import { tgApi, tgSend, tgFileBuffer } from '@/app/lib/telegram'
import {
  getDraft, setDraft, clearDraft, addSub, listSubs, removeSub,
  getLink, setLink, getLDraft, setLDraft, clearLDraft, type LDraft,
  getSDraft, setSDraft, clearSDraft, type SDraft,
} from '@/app/lib/telegram-store'
import { sendTest, regionsForCity, hoodsForRegion, seedChannel, matchSub } from '@/app/lib/telegram-notify'
import { addUserListing, listItems, type Item } from '@/app/lib/scraper-store'
import { moderateOne, userSubmitModel } from '@/app/lib/moderation'
import { saveMedia } from '@/app/lib/media-store'
import { getAccount } from '@/app/lib/account-store'
import { generateListingCopy, type ListingFields } from '@/app/lib/listing-copy'

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
  [{ t: '🔎 جستجوی آگهی', d: 'srch' }],
  [{ t: '➕ آلارمِ جدید', d: 'new' }, { t: '🔔 آلارم‌های من', d: 'mine' }],
  [{ t: '🏠 ثبتِ آگهی', d: 'nl' }, { t: '📋 آگهی‌های من', d: 'myads' }],
])
const dealLabel = (d: string) => (d === 'همه' ? 'خرید/اجاره' : d)
const subLabel = (s: { deal: string; city: string; region: string; hood: string }) =>
  `${dealLabel(s.deal)} · ${s.city}${s.region ? ' · ' + s.region : ''}${s.hood ? ' · ' + s.hood : ''}`

// ── آلارم ──────────────────────────────────────────────────────────────────
async function startFlow(chatId: number, mid?: number) {
  await clearLDraft(chatId); await clearSDraft(chatId)
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

// ── فاز ۲۶۴: جستجوی درون‌ربات (معامله→شهر→محله → آگهی‌های تأییدشدهٔ منطبق) ──────
async function askSearchDeal(chatId: number) {
  await clearDraft(chatId); await clearLDraft(chatId)
  await setSDraft(chatId, { step: 'deal' })
  await tgSend(chatId, '🔎 جستجوی آگهی\nنوعِ معامله؟', { reply_markup: kb([[{ t: '🏠 اجاره', d: 'sd:اجاره' }, { t: '🔑 فروش', d: 'sd:فروش' }], [{ t: 'همه', d: 'sd:همه' }]]) })
}
async function askSearchCity(chatId: number) {
  const dr = await getSDraft(chatId); await setSDraft(chatId, { ...(dr || {}), step: 'city' })
  const rows: Btn[][] = []
  for (let i = 0; i < CITIES.length; i += 2) rows.push(CITIES.slice(i, i + 2).map(c => ({ t: c, d: 'sc:' + c })))
  rows.push([{ t: 'شهرِ دیگر ✍️', d: 'sc:__other' }])
  await tgSend(chatId, 'شهر؟', { reply_markup: kb(rows) })
}
async function askSearchHood(chatId: number, city: string) {
  const hoods = await hoodsForRegion(city, '', 12)
  const dr = await getSDraft(chatId)
  await setSDraft(chatId, { ...(dr || {}), city, hoods, step: 'hood' })
  const rows: Btn[][] = []
  for (let i = 0; i < hoods.length; i += 2) rows.push(hoods.slice(i, i + 2).map((h, k) => ({ t: h, d: 'sh:' + (i + k) })))
  rows.push([{ t: '📋 همهٔ محله‌ها', d: 'sh:__all' }, { t: 'محلهٔ دیگر ✍️', d: 'sh:__text' }])
  await tgSend(chatId, hoods.length ? `محله؟ (در ${city})` : 'محله را بنویس، یا «📋 همهٔ محله‌ها».', { reply_markup: kb(rows) })
}
async function sendListingCard(chatId: number, it: Item) {
  const m = (it.meta || {}) as Record<string, string>
  const cap = [`🏠 <b>${it.title || 'آگهی'}</b>`, it.price ? `💰 ${it.price}` : '', it.location ? `📍 ${it.location}` : '', m['متراژ'] ? `📐 ${m['متراژ']} متر` : ''].filter(Boolean).join('\n')
  const reply_markup = { inline_keyboard: [[{ text: '👁 مشاهده در ملک‌جت', url: `https://melkjet.com/property/${it.id}` }]] }
  const photo = it.image ? (it.image.startsWith('http') ? it.image : 'https://melkjet.com' + it.image) : ''
  if (photo) { const r = await tgApi('sendPhoto', { chat_id: chatId, photo, caption: cap, parse_mode: 'HTML', reply_markup }); if (r) return }
  return tgApi('sendMessage', { chat_id: chatId, text: cap, parse_mode: 'HTML', disable_web_page_preview: false, reply_markup })
}
const SEARCH_PAGE = 5
async function runSearch(chatId: number, offset = 0) {
  const sd = await getSDraft(chatId)
  if (!sd) { await tgSend(chatId, 'برای جستجو «🔎 جستجوی آگهی» را بزن.', { reply_markup: menu }); return }
  const items = await listItems('listing', { publicOnly: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pseudo: any = { deal: sd.deal || 'همه', city: sd.city || '', region: '', hood: sd.hood || '' }
  const matches = items.filter(it => matchSub(pseudo, it))
  if (!matches.length) { await tgSend(chatId, 'فعلاً آگهیِ منطبقی پیدا نشد 🤷‍♂️\nمی‌تونی 🔔 یک آلارم بسازی تا به‌محضِ ثبتِ آگهیِ منطبق خبرت کنم.', { reply_markup: menu }); return }
  const slice = matches.slice(offset, offset + SEARCH_PAGE)
  for (const it of slice) await sendListingCard(chatId, it)
  const more = matches.length > offset + SEARCH_PAGE
  await tgSend(chatId, `— ${offset + 1} تا ${offset + slice.length} از ${matches.length} آگهی —`, {
    reply_markup: more ? kb([[{ t: `➡️ ${SEARCH_PAGE} تای بعدی`, d: 'sn:' + (offset + SEARCH_PAGE) }], [{ t: '🏠 منو', d: 'smenu' }]]) : menu,
  })
}
async function handleSearchText(chatId: number, sd: SDraft, text: string) {
  if (sd.step === 'cityText') { await setSDraft(chatId, { ...sd, city: text.trim() }); await askSearchHood(chatId, text.trim()) }
  else if (sd.step === 'hoodText') { await setSDraft(chatId, { ...sd, hood: text.trim() }); await runSearch(chatId, 0) }
}

// ── فاز ۲۵۷/۲۵۹: ثبتِ آگهیِ هوشمند از تلگرام (گام‌به‌گام با دکمه + تولیدِ متن) ──
const PTYPES = ['آپارتمان', 'ویلا و خانه', 'زمین و کلنگی', 'مغازه و تجاری', 'دفتر و اداری']
const ynBtns = (cbYes: string, cbNo: string) => kb([[{ t: '✅ دارد', d: cbYes }, { t: '➖ ندارد', d: cbNo }]])
// عددِ تومانی را زیبا کن؛ اگر ورودی فقط رقم بود جداکنندهٔ هزارگان + «تومان»، وگرنه همان متن.
function faMoney(raw: string): string {
  const t = String(raw || '').trim()
  const en = t.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).replace(/[,٬،\s]/g, '')
  if (/^\d{4,}$/.test(en)) return Number(en).toLocaleString('fa-IR') + ' تومان'
  return t
}
const upd = async (chatId: number, patch: Partial<import('@/app/lib/telegram-store').LDraft>) => {
  const ld = (await getLDraft(chatId)) || { step: 'deal' as const }
  await setLDraft(chatId, { ...ld, ...patch }); return { ...ld, ...patch }
}

async function startListing(chatId: number) {
  await clearDraft(chatId); await clearSDraft(chatId)
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
  await tgSend(chatId, 'ثبتِ آگهیِ جدید 🏠\nمرحله‌به‌مرحله می‌پرسم؛ بیشترش فقط یک دکمه است. 👌\n\n۱) نوعِ معامله؟', { reply_markup: kb([[{ t: '🏠 اجاره', d: 'ld:اجاره' }, { t: '🔑 فروش', d: 'ld:فروش' }]]) })
}
async function askPtype(chatId: number) {
  await upd(chatId, { step: 'ptype' })
  const rows: Btn[][] = []
  for (let i = 0; i < PTYPES.length; i += 2) rows.push(PTYPES.slice(i, i + 2).map((p, k) => ({ t: p, d: 'lp:' + (i + k) })))
  await tgSend(chatId, '۲) نوعِ ملک؟', { reply_markup: kb(rows) })
}
async function askCityL(chatId: number) {
  await upd(chatId, { step: 'city' })
  const rows: Btn[][] = []
  for (let i = 0; i < CITIES.length; i += 2) rows.push(CITIES.slice(i, i + 2).map(c => ({ t: c, d: 'lc:' + c })))
  rows.push([{ t: 'شهرِ دیگر ✍️', d: 'lc:__other' }])
  await tgSend(chatId, '۳) شهر؟', { reply_markup: kb(rows) })
}
async function askHoodL(chatId: number, city: string) {
  const hoods = await hoodsForRegion(city, '', 12)
  if (!hoods.length) { await upd(chatId, { step: 'hoodText' }); await tgSend(chatId, '۴) محله؟ (نامِ محله را بنویس، مثلاً: جنت‌آباد)'); return }
  await upd(chatId, { step: 'hood', hoods })
  const rows: Btn[][] = []
  for (let i = 0; i < hoods.length; i += 2) rows.push(hoods.slice(i, i + 2).map((h, k) => ({ t: h, d: 'lh:' + (i + k) })))
  rows.push([{ t: 'محلهٔ دیگر ✍️', d: 'lh:__text' }])
  await tgSend(chatId, `۴) محله؟ (در ${city})`, { reply_markup: kb(rows) })
}
async function askArea(chatId: number) { await upd(chatId, { step: 'area' }); await tgSend(chatId, '۵) متراژ چند متر است؟ (فقط عدد)') }
async function askRooms(chatId: number) {
  await upd(chatId, { step: 'rooms' })
  await tgSend(chatId, '۶) تعدادِ اتاقِ خواب؟', { reply_markup: kb([
    [{ t: 'بدونِ خواب', d: 'lr:0' }, { t: '۱', d: 'lr:1' }, { t: '۲', d: 'lr:2' }],
    [{ t: '۳', d: 'lr:3' }, { t: '۴', d: 'lr:4' }, { t: '۵+', d: 'lr:5+' }],
  ]) })
}
async function askFloor(chatId: number) {
  await upd(chatId, { step: 'floor' })
  await tgSend(chatId, '۷) طبقه؟', { reply_markup: kb([
    [{ t: 'همکف', d: 'lf:همکف' }, { t: '۱', d: 'lf:۱' }, { t: '۲', d: 'lf:۲' }, { t: '۳', d: 'lf:۳' }],
    [{ t: '۴', d: 'lf:۴' }, { t: '۵', d: 'lf:۵' }, { t: '۶+', d: 'lf:۶+' }, { t: 'رد', d: 'lf:__skip' }],
  ]) })
}
async function askAge(chatId: number) { await upd(chatId, { step: 'age' }); await tgSend(chatId, '۸) سالِ ساخت؟ (عدد بنویس، مثلاً ۱۴۰۰ — یا بنویس «نوساز»)') }
async function askParking(chatId: number) { await upd(chatId, { step: 'parking' }); await tgSend(chatId, '۹) پارکینگ؟', { reply_markup: ynBtns('lpk:1', 'lpk:0') }) }
async function askElevator(chatId: number) { await upd(chatId, { step: 'elevator' }); await tgSend(chatId, '۱۰) آسانسور؟', { reply_markup: ynBtns('lev:1', 'lev:0') }) }
async function askStorage(chatId: number) { await upd(chatId, { step: 'storage' }); await tgSend(chatId, '۱۱) انباری؟', { reply_markup: ynBtns('lstg:1', 'lstg:0') }) }
// فروش: قیمتِ کلِ عددی. اجاره: ودیعه و اجاره را جدا و عددی می‌پرسیم.
async function askPriceL(chatId: number) { await upd(chatId, { step: 'price' }); await tgSend(chatId, '۱۲) قیمتِ کل چند تومان؟ (فقط عدد، مثلاً ۵۲۰۰۰۰۰۰۰۰)') }
async function askDeposit(chatId: number) { await upd(chatId, { step: 'deposit' }); await tgSend(chatId, '۱۲) ودیعه چند تومان؟ (فقط عدد، مثلاً ۵۰۰۰۰۰۰۰۰)') }
async function askRent(chatId: number) { await upd(chatId, { step: 'rent' }); await tgSend(chatId, '۱۳) اجارهٔ ماهانه چند تومان؟ (فقط عدد، مثلاً ۱۰۰۰۰۰۰۰)') }
async function askPhoto(chatId: number) {
  await upd(chatId, { step: 'photo' })
  await tgSend(chatId, '۱۳) یک عکس از ملک بفرست 📷 (یا «بدونِ عکس»)', { reply_markup: kb([[{ t: 'بدونِ عکس', d: 'lnophoto' }]]) })
}
function ldFields(ld: import('@/app/lib/telegram-store').LDraft, link: { name?: string } | undefined): ListingFields {
  return {
    deal: ld.deal, propertyType: ld.ptype, city: ld.city, hood: ld.hood, area: ld.area,
    rooms: ld.rooms, floor: ld.floor, age: ld.age, parking: ld.parking, elevator: ld.elevator,
    storage: ld.storage, price: ld.price, advisorName: link?.name,
  }
}
// تولیدِ عنوان+توضیحاتِ حرفه‌ای، بعد صفحهٔ تأیید
async function runGenerate(chatId: number) {
  const ld = await getLDraft(chatId); const link = await getLink(chatId)
  if (!ld) return
  await tgSend(chatId, '✍️ در حالِ نوشتنِ عنوان و توضیحاتِ حرفه‌ای برای آگهی‌ات…')
  const copy = await generateListingCopy(ldFields(ld, link || undefined))
  await setLDraft(chatId, { ...ld, title: copy.title, description: copy.description, step: 'confirm' })
  await confirmListing(chatId)
}
async function confirmListing(chatId: number) {
  const ld = await getLDraft(chatId); if (!ld) return
  const facts = [
    ld.price ? `💰 ${ld.price}` : '',
    `📍 ${[ld.city, ld.hood].filter(Boolean).join('، ') || '—'}`,
    ld.area ? `📐 ${ld.area} متر` : '',
    ld.rooms != null && ld.rooms !== '' ? `🛏 ${ld.rooms === '0' ? 'بدونِ خواب' : ld.rooms + ' خواب'}` : '',
    ld.floor ? `🏢 طبقهٔ ${ld.floor}` : '',
    ld.age ? `🗓 سالِ ساخت: ${ld.age}` : '',
    [ld.parking ? 'پارکینگ' : '', ld.elevator ? 'آسانسور' : '', ld.storage ? 'انباری' : ''].filter(Boolean).join(' · '),
    ld.image ? '🖼 عکس ✓' : '',
  ].filter(Boolean).join('\n')
  const body = `این آگهی ثبت شود؟\n\n🏠 <b>${ld.title || ''}</b>\n\n${ld.description || ''}\n\n────────\n${facts}`
  await tgSend(chatId, body.slice(0, 3900), { reply_markup: kb([
    [{ t: '✅ ثبت و انتشار', d: 'lok' }],
    [{ t: ld.image ? '📷 تغییرِ عکس' : '📷 افزودنِ عکس', d: 'lphoto' }, { t: '🔄 بازتولیدِ متن', d: 'lregen' }],
    [{ t: '✏️ ویرایشِ توضیحات', d: 'ledit' }, { t: '♻️ شروعِ دوباره', d: 'lrestart' }],
    [{ t: '✖️ لغو', d: 'lcancel' }],
  ]) })
}
async function submitListing(chatId: number) {
  const ld = await getLDraft(chatId); const link = await getLink(chatId)
  if (!ld || !ld.title) { await tgSend(chatId, 'اطلاعات ناقص است — دوباره «🏠 ثبتِ آگهی» را بزن.', { reply_markup: menu }); await clearLDraft(chatId); return }
  const meta: Record<string, string> = {}
  if (ld.deal) meta['نوع معامله'] = ld.deal
  if (ld.ptype) meta['نوع ملک'] = ld.ptype
  if (ld.city) meta['شهر'] = ld.city
  if (ld.hood) meta['محله'] = ld.hood
  if (ld.area) meta['متراژ'] = ld.area
  if (ld.rooms != null && ld.rooms !== '') meta['اتاق'] = ld.rooms
  if (ld.floor) meta['طبقه'] = ld.floor
  if (ld.age) meta['سن بنا'] = ld.age
  if (ld.parking != null) meta['پارکینگ'] = ld.parking ? 'دارد' : 'ندارد'
  if (ld.elevator != null) meta['آسانسور'] = ld.elevator ? 'دارد' : 'ندارد'
  if (ld.storage != null) meta['انباری'] = ld.storage ? 'دارد' : 'ندارد'
  const location = [ld.city, ld.hood].filter(Boolean).join('، ') || undefined
  const item = await addUserListing({ title: ld.title, price: ld.price, location, excerpt: ld.description, image: ld.image, phone: link?.phone, owner: link?.name, meta })
  await clearLDraft(chatId)
  if (item.status === 'duplicate') { await tgSend(chatId, '⚠️ این آگهی قبلاً در ملک‌جت ثبت شده (ملکِ مشابه).', { reply_markup: menu }); return }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let verdict: any = { status: 'pending', reason: 'در صفِ بررسی' }
  try { verdict = await moderateOne(item, userSubmitModel()) } catch { /* بماند در صف */ }
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
// متنِ کاربر در جریانِ ثبتِ آگهی (فقط جایی که تایپ لازم است: شهر/محلهٔ دلخواه، متراژ، قیمت، ویرایشِ متن)
async function handleListingText(chatId: number, ld: import('@/app/lib/telegram-store').LDraft, text: string) {
  if (ld.step === 'cityText' || ld.step === 'city') { const d = await upd(chatId, { city: text.trim() }); await tgSend(chatId, `شهر: ${text.trim()} ✅`); await askHoodL(chatId, d.city!) }
  else if (ld.step === 'hood' || ld.step === 'hoodText') { await upd(chatId, { hood: text.trim() }); await askArea(chatId) }
  else if (ld.step === 'area') { const a = text.replace(/[^\d۰-۹]/g, '') || text.trim(); await upd(chatId, { area: a }); await askRooms(chatId) }
  else if (ld.step === 'age') { await upd(chatId, { age: text.trim() }); await askParking(chatId) }
  else if (ld.step === 'price') { await upd(chatId, { price: faMoney(text) }); await askPhoto(chatId) }
  else if (ld.step === 'deposit') { await upd(chatId, { deposit: faMoney(text) }); await askRent(chatId) }
  else if (ld.step === 'rent') { const rent = faMoney(text); await upd(chatId, { rent, price: `ودیعه ${ld.deposit || '—'} · اجاره ${rent}` }); await askPhoto(chatId) }
  else if (ld.step === 'editdesc') { await upd(chatId, { description: text.trim(), step: 'confirm' }); await confirmListing(chatId) }
  else if (ld.step === 'photo') {
    if (/بدون|رد|skip/i.test(text)) { const cur = await getLDraft(chatId); if (cur?.title) await confirmListing(chatId); else await runGenerate(chatId) }
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
    // جستجوی درون‌ربات (فاز ۲۶۴)
    else if (data === 'srch') await askSearchDeal(chatId)
    else if (data === 'smenu') await tgSend(chatId, 'منوی اصلی:', { reply_markup: menu })
    else if (data.startsWith('sd:')) { const dr = await getSDraft(chatId); await setSDraft(chatId, { ...(dr || { step: 'deal' }), deal: data.slice(3) }); await askSearchCity(chatId) }
    else if (data.startsWith('sc:')) {
      const city = data.slice(3)
      if (city === '__other') { const dr = await getSDraft(chatId); await setSDraft(chatId, { ...(dr || { step: 'city' }), step: 'cityText' }); await tgSend(chatId, 'نامِ شهر را بنویس:') }
      else await askSearchHood(chatId, city)
    }
    else if (data.startsWith('sh:')) {
      const dr = await getSDraft(chatId); const v = data.slice(3)
      if (v === '__all') { await setSDraft(chatId, { ...(dr || { step: 'hood' }), hood: '' }); await runSearch(chatId, 0) }
      else if (v === '__text') { await setSDraft(chatId, { ...(dr || { step: 'hood' }), step: 'hoodText' }); await tgSend(chatId, 'نامِ محله را بنویس:') }
      else { const i = parseInt(v, 10); const h = (dr?.hoods && dr.hoods[i]) || ''; await setSDraft(chatId, { ...(dr || { step: 'hood' }), hood: h }); await runSearch(chatId, 0) }
    }
    else if (data.startsWith('sn:')) { await runSearch(chatId, parseInt(data.slice(3), 10) || 0) }
    // ثبتِ آگهیِ هوشمند (فاز ۲۵۹)
    else if (data === 'nl') await startListing(chatId)
    else if (data === 'myads') await showMyAds(chatId)
    else if (data.startsWith('ld:')) { await upd(chatId, { deal: data.slice(3) }); await askPtype(chatId) }
    else if (data.startsWith('lp:')) { const i = parseInt(data.slice(3), 10); await upd(chatId, { ptype: PTYPES[i] }); await askCityL(chatId) }
    else if (data.startsWith('lc:')) {
      const city = data.slice(3)
      if (city === '__other') { await upd(chatId, { step: 'cityText' }); await tgSend(chatId, '۳) نامِ شهر را بنویس:') }
      else { const d = await upd(chatId, { city }); await askHoodL(chatId, d.city!) }
    }
    else if (data.startsWith('lh:')) {
      if (data.slice(3) === '__text') { await upd(chatId, { step: 'hoodText' }); await tgSend(chatId, '۴) نامِ محله را بنویس:') }
      else { const dr = await getLDraft(chatId); const i = parseInt(data.slice(3), 10); const h = (dr?.hoods && dr.hoods[i]) || ''; await upd(chatId, { hood: h }); await askArea(chatId) }
    }
    else if (data.startsWith('lr:')) { await upd(chatId, { rooms: data.slice(3) }); await askFloor(chatId) }
    else if (data.startsWith('lf:')) { const v = data.slice(3); await upd(chatId, { floor: v === '__skip' ? undefined : v }); await askAge(chatId) }
    else if (data.startsWith('lpk:')) { await upd(chatId, { parking: data.slice(4) === '1' }); await askElevator(chatId) }
    else if (data.startsWith('lev:')) { await upd(chatId, { elevator: data.slice(4) === '1' }); await askStorage(chatId) }
    else if (data.startsWith('lstg:')) { const d = await upd(chatId, { storage: data.slice(5) === '1' }); if (d.deal === 'اجاره') await askDeposit(chatId); else await askPriceL(chatId) }
    else if (data === 'lnophoto') { const ld = await getLDraft(chatId); if (ld?.title) await confirmListing(chatId); else await runGenerate(chatId) }
    else if (data === 'lphoto') { await askPhoto(chatId) }
    else if (data === 'lrestart') { await askListingDeal(chatId) }
    else if (data === 'lregen') { await runGenerate(chatId) }
    else if (data === 'ledit') { await upd(chatId, { step: 'editdesc' }); await tgSend(chatId, '✏️ متنِ توضیحاتِ دلخواهت را بفرست:') }
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
      if (f) {
        const m = saveMedia(f.buffer, f.mime, 'tg-listing.jpg')
        const nd = { ...ld, image: `/api/media/${m.id}` }
        if (nd.title) { await setLDraft(chatId, { ...nd, step: 'confirm' }); await confirmListing(chatId) }   // افزودنِ عکس در مرحلهٔ تأیید → متن دست‌نخورده
        else { await setLDraft(chatId, nd); await runGenerate(chatId) }                                       // اولین‌بار → تولیدِ متن
      }
      else await tgSend(chatId, 'عکس دریافت نشد؛ دوباره بفرست یا «بدونِ عکس» را بزن.')
    }
    return
  }

  const text = String(msg.text || '').trim()
  const first = (msg.from?.first_name || 'دوست').toString()
  if (!text) return
  if (text === '/start') { await clearDraft(chatId); await clearLDraft(chatId); await clearSDraft(chatId); await tgSend(chatId, `سلام ${first} 👋\nبه رباتِ <b>ملک‌جت</b> خوش آمدی.\n\n🔔 <b>آلارم</b> بساز تا آگهیِ منطبق را همان لحظه برایت بفرستم.\n🏠 یا از همین‌جا <b>آگهی ثبت کن</b> تا در سایت منتشر شود.`, { reply_markup: menu }) }
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
    // اول جریانِ ثبتِ آگهی، بعد جستجو (ورودیِ متنی)، بعد آلارم
    const ld = await getLDraft(chatId)
    if (ld) { await handleListingText(chatId, ld, text); return }
    const sd = await getSDraft(chatId)
    if (sd && (sd.step === 'cityText' || sd.step === 'hoodText')) { await handleSearchText(chatId, sd, text); return }
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
