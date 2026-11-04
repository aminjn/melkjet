import { fetchDivarProfileTokens, fetchDivarPost, divarProfileSlug, type BrandPost } from './divar-post'
import { aiFor, resolveAgent, aiActive } from './gapgpt'
import { nameProbSync, NAME_THRESHOLD, corpusCount } from './roster-name-model'
import { bestName, hasSparse as hasSparseModel, isAreaName } from './roster-ner'
import { knownNames, learnName, pruneLearned } from './agency-roster-ml'
import { keyOf, deEmoji, addressTokens, contextNoiseTokens, validName, strictName, bareNameLine, TITLES, isNoiseWord, nameRuleWhitelistRaw, FIRST_NAMES, hardBanTokens, hitsBan, normFa, personLike } from './agency-name-lexicon'
import { isDivarMetaText } from './divar-text'
import { loadNameRules } from './roster-name-rules'
const { chatCompleteSafe } = aiFor('رصدِ مشاورانِ آژانس')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// ── خوشه‌بندیِ آگهی‌های یک آژانسِ دیوار به تفکیکِ مشاور، از روی «امضای» داخلِ آگهی ──
// ورودی: لینک/slugِ آژانس. خروجی: هر مشاورِ متمایز (بر اساسِ اسمِ امضاشده) + آگهی‌هایش،
// و سطلِ «بی‌نام» (آگهی‌های بدونِ امضا) که به خودِ آژانس نسبت داده می‌شود.
//
// نکته: شماره از API درنمی‌آید (گِیت است) و شناسهٔ پایدارِ مشاور هم عمومی نیست (contact_uuid
// per-آگهی است). تنها سیگنالِ per-مشاور، «اسمِ امضاشده در متنِ آگهی» است — که همین‌جا با
// heuristic + (اختیاری) AI استخراج و نرمال می‌شود. کلید فقط «برچسبِ گروه‌بندی» است، نه هویتِ جهانی؛
// چون دامنه به یک آژانس محدود است، تصادمِ نام («هزار شایان») بی‌اثر است.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let lexiconPruned = false   // پاک‌سازیِ یک‌بارهٔ واژه‌نامهٔ آموخته در هر پروسه (فاز ۲۷۵)

// حروفِ لاتینِ فاصله‌دار را جمع می‌کند: "S H A Y G A N" → "SHAYGAN".
function collapseSpacedLatin(t: string): string {
  return t.replace(/(?:[A-Za-z]\s){2,}[A-Za-z]/g, m => m.replace(/\s+/g, ''))
}

const DECOR = '\\u2728\\u2b50\\u2605\\u2733\\ufe0f\\u2734\\u2795\\u274c\\u2705\\u2666\\ud83d\\udd37\\ud83d\\udd36\\*\\u2022\\u25c6\\u25aa\\u066d'
// واژه‌نامه (نوفه/واژگانِ املاکی/القاب/نشانه‌های آدرس) به `agency-name-lexicon.ts` منتقل شد
// تا یادگیرنده (`agency-roster-ml.ts`) هم با همان تعریف کار کند. اینجا فقط re-export می‌شود
// چون فراخوان‌ها (تست‌ها، `roster-ml-report`) `validName` را از همین ماژول می‌گیرند.
export { validName, addressTokens } from './agency-name-lexicon'

// تطبیقِ لغوی با «نام‌های آموخته‌شده»: اگر یکی از نام‌های تأییدشدهٔ قبلی در متنِ آگهی باشد،
// همان را برمی‌گرداند — قطعی، رایگان، بدونِ AI. هستهٔ «یادگیریِ تدریجیِ ماشین».
// deEmoji (اموجی/نماد → فاصله؛ کلیدِ رفعِ «♀️محمدی») از واژه‌نامهٔ مشترک می‌آید.
const normTxt = (s: string) => (' ' + deEmoji(s).replace(/‌/g, '').replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک') + ' ')
// (exported برای scripts/roster-casestudy.mjs — کیس‌استادی باید «عینِ» منطقِ تولید را بسنجد)
export function lexiconMatch(text: string, learned: { name: string }[]): string {
  if (!learned.length) return ''
  const t = normTxt(text)
  let best = ''
  for (const { name } of learned) {
    const n = String(name || '').replace(/‌/g, '').replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
    if (n.length < 3) continue                                   // نامِ خیلی کوتاه ریسکِ تطبیقِ اشتباه دارد
    const multi = n.includes(' ')
    const hit = multi
      ? t.includes(' ' + n + ' ') || t.includes(' ' + n)          // نامِ چند-کلمه‌ای: عبارتِ کامل
      : new RegExp(`(?:^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(t)  // تک‌کلمه: مرزِ کلمه
    if (hit && n.length > best.length) best = name                // بلندترین (دقیق‌ترین) تطبیق
  }
  return best
}

// ── استخراجِ امضا: فقط از «بلوکِ امضا»، نه از هرجای متن (فاز ۲۷۵) ───────────
// ریشهٔ باگِ «نامِ آشغال»: الگوها روی کلِ متنِ صاف‌شده اجرا می‌شدند، پس یک کلیدواژه در
// انتهای یک خط، اولین کلمهٔ خطِ بعد (اغلب آدرس) را به‌عنوان اسم برمی‌داشت — نمونهٔ واقعی:
//   «▪ مصطفی هوشمند / ▪ مشاور تخصصی شهرک غرب»  ولی موتور «فلاحی» را از «بین فلاحی ۴۱ و ۴۳» گرفت.
// حالا متن «خط به خط» دیده می‌شود و اسم فقط از این جاها برداشته می‌شود:
//   (الف) خودِ خطِ امضا (خطی که کلیدواژهٔ مشاور/کارشناس/املاک/با احترام… دارد)،
//   (ب) خطِ بالا/پایینِ خطِ امضا، اگر «فقط یک نامِ ۱–۲کلمه‌ای» باشد (همان مثالِ بالا)،
//   (ج) بلوکِ تزئینیِ برند و نامِ چسبیده به اموجیِ شخص (این دو خودشان شکلِ امضا هستند)،
//   (د) خطی که به‌تنهایی یک نامِ دقیقاً ۲کلمه‌ای است (کم‌اولویت‌ترین).
// در همهٔ حالت‌ها، توکن‌های آدرسِ همان آگهی (پس از بین/خیابان/کوچه/بلوار/نبش/میدان/…) رد می‌شوند.
const SIG_LINE = /(کارشناسِ?\s*فروش|مشاورِ?\s*فروش|کارشناس|مشاورین|مشاوران|مشاور|فروشنده|املاک|مسکن|امضا|با\s*احترام|با\s*تشکر|جهتِ?\s*راهنمایی|جهتِ?\s*هماهنگی|هماهنگی|راهنمایی|جهتِ?\s*تماس)/
const RE_TITLED = /(?:سرکار\s+)?(?:خانم|آقای?|جناب|مهندس|دکتر|حاج|حاجی|استاد)\s+([ء-ی]{2,15}(?:\s+[ء-ی]{2,15})?)/g
const RE_AFTER_KEY = /(?:کارشناسِ?\s*فروش|مشاورِ?\s*فروش|کارشناس|مشاور|فروشنده|امضا|با\s*احترام)(?![ء-ی])\s*[:：.\-]*\s*([A-Za-zء-ی][A-Za-zء-ی]{1,15}(?:\s+[A-Za-zء-ی]{2,15})?)/g
const RE_TAIL = /(?:کارشناسِ?\s*فروش|مشاورِ?\s*فروش|جهتِ?\s*راهنمایی|جهتِ?\s*هماهنگی|هماهنگی|راهنمایی|جهتِ?\s*تماس|با\s*احترام|امضا)([ء-ی\s]{1,45})/g
// امضای «معرفیِ خود»: نام *پیش از* کلیدواژه می‌آید — «محمد پرنده هستم مشاور و امین شما عزیزان».
// بدونِ این الگو، امضای این سبک اصلاً دیده نمی‌شد (همهٔ الگوهای دیگر نامِ پس از کلیدواژه را می‌گیرند).
const RE_SELF = /([ء-ی]{2,15}(?:\s+[ء-ی]{2,15})?)\s+(?:هستم|هستیم|در\s*خدمتم|در\s*خدمتتونم)/g

// آیا نامِ استخراج‌شده از «سیگنالِ قطعیِ شخص» آمده؟ (عنوان «خانم/آقای X»، برچسبِ «نقش: X»،
// معرفیِ «X هستم»، یا گازِتیرِ trust — p≥۰.۹۷). چنین نامی حتی روی «یک» آگهی مشاورِ واقعی است و نباید
// با بانِ آدرس (مثلِ «منطقه خانم اسدی») یا گاردِ MIN_FILES بی‌نام شود. همان trustِ مسیرِ مدلِ extractSignature.
// فاز ۳۴۴ (پورت از خودروجت، فاز ۳۴۹–۳۵۰) — امضای قطعی = فهرستِ سفید، «لقب + نام» (در «هر» خط)، «نقش: نام»،
// «نام هستم»، و خطی که «فقط عبارتِ نقش + یک واژه» است. چنین آگهی‌ای با قاعده حل شده و اصلاً به AI نمی‌رود؛
// «نه»ِ AI هم آن را حذف نمی‌کند. (حدسِ ضعیفِ «منطقه X» عمداً بیرون است: در ملکی اغلب نامِ محله است.)
export function signatureTrusted(title: string, desc: string, agencyName = ''): boolean {
  if (whitelistHits(normFa(`${title || ''}\n${desc || ''}`)).length) return true
  const ner = bestName(normFa(title), normFa(desc))
  if (!ner || !ner.trust) return false
  const v = validName(ner.name, agencyName, undefined, { trustPerson: true })
  return !!v && !hitsBan(v, hardBanTokens(`${title || ''}\n${desc || ''}`))
}
// نام‌های فهرستِ سفیدِ مدیریتی که «دنبالهٔ واژه‌به‌واژه»شان در متن آمده.
// فاز ۳۴۴ط (اسکرین‌شاتِ مالک: امضا «مشاور فعال منطقه مجید شاکری» بود ولی ماشین «قدیمی» را «امضای صریح» گفت) — وقتی چند
// نامِ فهرستِ سفید در یک آگهی پیدا شود، قبلاً «ترتیبِ فهرست» برنده بود؛ یک ورودیِ اشتباه («قدیمی» از «قدیمی تا نوساز»)
// نامِ واقعیِ امضا را کنار می‌زد. حالا رتبه: (۱) در موضعِ امضا (پس از نقش/لقب، تنها روی خط، پیش از «هستم»)، (۲) شکلِ نامِ
// واقعی (validName — واژهٔ نوفه/ملکی مثلِ «قدیمی» آخر)، (۳) چندواژه‌ای، (۴) پایین‌تر در متن (امضا معمولاً آخرِ آگهی است).
export function whitelistHits(raw: string): string[] {
  const _wl = nameRuleWhitelistRaw()
  if (!_wl.length) return []
  const words = raw.split(/[^ء-یA-Za-z]+/).filter(Boolean).map(keyOf)
  const lines = textLines(raw)
  const hits: { name: string; sig: boolean; real: boolean; n: number; at: number }[] = []
  for (const wname of _wl) {
    const wk = wname.split(/\s+/).filter(Boolean).map(keyOf).filter(Boolean)
    if (!wk.length) continue
    for (let i = 0; i + wk.length <= words.length; i++) {
      if (wk.every((k, j) => k === words[i + j])) {
        const name = wname.replace(/\s+/g, ' ').trim()
        let sig = false
        try { sig = nameOccurrences(wk.map(k => k.toLowerCase()), lines).some(inSignaturePosition) } catch {}
        hits.push({ name, sig, real: !!validName(name, '', undefined, { trustPerson: true }), n: wk.length, at: i })
        break
      }
    }
  }
  hits.sort((x, y) => (+y.sig - +x.sig) || (+y.real - +x.real) || (y.n - x.n) || (y.at - x.at))
  return [...new Set(hits.map(h => h.name))]
}

// ── فاز ۳۴۴ (پورت از خودروجت، فازهای ۳۳۹/۳۴۵ج/۳۴۷/۳۴۸/۳۵۲) — دروازهٔ نامِ AI: «در متن» و «در موضعِ امضا» ──
// ملک‌جت تا امروز نامِ AI را بی‌شرط می‌پذیرفت («شمس» از عنوانِ «۱۶۵ متر / شمس آباد» همین‌طور آمد). حالا نامِ AI
// پذیرفته است اگر (۱) «واژه‌به‌واژه» در متن آمده باشد (نه چسباندنِ دو واژه، نه املای ساختگی) و (۲) یا با حدسِ
// ماشینِ همین آگهی یکی باشد (دو منبعِ مستقل)، یا در «موضعِ امضا» باشد: پس از نقش/لقب/تماس، کنارِ شماره، تنها روی
// خط، پیش از «هستم/در خدمت»، یا دوواژه‌ای با شکلِ نامِ آدم. شکلِ فامیلی شرط نیست («ستوده/شاکر/بیات» رد می‌شدند).
const SIG_KEYS = new Set(['مشاور', 'کارشناس', 'فروشنده', 'تماس', 'هماهنگی', 'راهنمایی', 'آقای', 'آقا', 'اقای', 'اقا', 'خانم',
  'جناب', 'سرکار', 'مهندس', 'دکتر', 'حاج', 'حاجی', 'امضا', 'احترام', 'تشکر', 'سپاس', 'ارادتمند', 'مدیر', 'مدیریت', 'ارتباط', 'پاسخگو', 'پاسخگویی',
  'مسئول', 'مشاورین', 'مشاوران', 'کارشناسان', 'نماینده', 'باتشکر', 'بااحترام', 'مشاورفروش', 'کارشناسفروش'].map(keyOf))
const SELF_NEXT = new Set(['هستم', 'هستیم', 'درخدمتم', 'درخدمتتونم', 'درخدمتتان'].map(keyOf))
const SURNAME_TAIL = new Set(['زاده', 'پور', 'نژاد', 'فر', 'نیا', 'راد', 'مهر', 'منش', 'کیا', 'وند'].map(keyOf))
const isPhoneTok = (t: string) => t.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '').length >= 8
// واژه‌بندی: جداکننده «هر نویسهٔ غیرِ حرف/رقم» (نیم‌فاصله جزوِ واژه). «⭕️____کارشناس خانم اسماعیلی____⭕️» زیرخط را
// به واژه می‌چسباند («اسماعیلی____») و نامِ درستِ AI «در متن نیست» حساب می‌شد (خودروجت فاز ۳۵۲).
export function textLines(text: string): string[][] {
  return deEmoji(normFa(String(text || ''))).split(/[\n\r]+/)
    .map(l => l.split(/[^\p{L}\p{N}\p{M}\u200c]+/u).filter(Boolean).map(w => keyOf(w).toLowerCase()).filter(Boolean))
    .filter(l => l.length)
}
// محلِ رخدادهای نام (به‌صورتِ واژه‌های کامل) در خطوطِ متن.
function nameOccurrences(nameKeys: string[], lines: string[][]): { line: string[]; i: number; n: number }[] {
  const out: { line: string[]; i: number; n: number }[] = []
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (nameKeys.every((k, j) => line[i + j] === k)) { out.push({ line, i, n: nameKeys.length }); continue }
      // «حسن زاده» در متن ↔ «حسن‌زاده/حسنزاده» از AI
      if (nameKeys.length === 1 && i + 1 < line.length && SURNAME_TAIL.has(line[i + 1]) && line[i] + line[i + 1] === nameKeys[0]) out.push({ line, i, n: 2 })
      // «حسن‌زاده» در متن (یک واژه پس از حذفِ نیم‌فاصله) ↔ «حسن زاده» از AI
      if (nameKeys.length === 2 && line[i] === nameKeys[0] + nameKeys[1]) out.push({ line, i, n: 1 })
    }
  }
  return out
}
export function inSignaturePosition(o: { line: string[]; i: number; n: number }): boolean {
  const { line, i, n } = o
  if (line.length === n) return true                                          // تنها روی خطِ خودش
  // «± لقب»: واژهٔ دیگرِ خطِ دوواژه‌ای باید لقب/نقش/شماره باشد («آقای رضایی»، «رضایی ۰۹۱۲…») — نه «کلید هوشمند».
  if (line.length === n + 1) { const other = i === 0 ? line[n] : line[0]; if (SIG_KEYS.has(other) || isPhoneTok(other)) return true }
  for (let j = Math.max(0, i - 3); j < i; j++) if (SIG_KEYS.has(line[j])) return true
  if (i + n < line.length && SELF_NEXT.has(line[i + n])) return true          // «… هستم»
  if (i + n + 1 < line.length && line[i + n] === 'در' && line[i + n + 1].startsWith('خدمت')) return true   // «رسولی در خدمتِ شما»
  for (const j of [i - 2, i - 1, i + n, i + n + 1]) if (j >= 0 && j < line.length && isPhoneTok(line[j])) return true
  return false
}
// فاز ۳۴۴ب (اسکرین‌شاتِ مالک: ۲۰ آگهیِ «مشاور و کارشناس منطقه فراهانی» — AI «فراهانی» گفت ولی رد شد) — «منطقه» نشانهٔ
// آدرس است و `validName(…, addr)` واژهٔ پس از آن را «نامِ معبر» حساب می‌کرد؛ هم جوابِ AI هم حدسِ ماشین می‌مُرد، درحالی‌که
// نام دقیقاً در موضعِ امضاست (پس از «کارشناس»، یا پیش از «هستم»). قاعده: نامی که در متن «در موضعِ امضا» آمده و خودش
// محلهٔ شناخته‌شده/واژهٔ مکانی نیست («پونک/ونک/…آباد»)، از بانِ آدرس معاف است. بانِ سخت (تکهٔ نامِ محله) سرِ جایش است.
export function acceptName(raw: string, agencyName: string, addr: Set<string>, descLines: string[][], opts?: { trustPerson?: boolean }): string {
  if (!raw) return ''
  const v = validName(raw, agencyName, addr, opts)
  if (v) return v
  const free = validName(raw, agencyName, undefined, opts)
  if (!free || isAreaName(free)) return ''
  const keys = free.split(/\s+/).filter(Boolean).map(w => keyOf(w).toLowerCase())
  return nameOccurrences(keys, descLines).some(inSignaturePosition) ? free : ''
}
export function gateAiName(ai: string, text: string, candKeys: Set<string>): string {
  if (!ai) return ''
  const nameKeys = ai.split(/\s+/).filter(Boolean).map(w => keyOf(w).toLowerCase())
  const occ = nameOccurrences(nameKeys, textLines(text))
  if (!occ.length) return ''                                  // نه واژه‌به‌واژه در متن → ساختگی/چسبانده
  if (candKeys.has(keyOf(ai))) return ai                      // توافقِ دو منبعِ مستقل
  if (occ.some(inSignaturePosition)) return ai                // در موضعِ امضا — هر شکلی داشته باشد
  if (nameKeys.length >= 2 && personLike(ai)) return ai       // «امیر رضایی» وسطِ جمله: شکلِ کاملِ نام
  return ''                                                   // تک‌واژهٔ وسطِ جمله = واژهٔ آگهی، نه نام
}

// خطی که پس از حذفِ اموجی/القاب «دقیقاً دو واژه» است و واژهٔ اول نامِ کوچکِ شناخته‌شده —
// یعنی «نامِ کوچک + نام‌خانوادگی»ِ تنها روی خطِ خودش. بسیار پراطمینان؛ بک‌استاپِ سکوتِ مدل.
function firstNameFullLine(raw: string, agencyName: string, banned: Set<string>): string {
  for (const line of deEmoji(raw).split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)) {
    const ws = line.split(/\s+/).filter(Boolean).filter(w => !TITLES.has(keyOf(w)))
    if (ws.length !== 2 || !FIRST_NAMES.has(keyOf(ws[0]))) continue
    const v = validName(ws.join(' '), agencyName, banned)
    if (v && v.split(/\s+/).filter(Boolean).length === 2) return v
  }
  return ''
}

// فاز ۳۴۴ (پورت از خودروجت، فاز ۳۵۲) — امضای مشاور در «متنِ آگهی» است؛ عنوانِ دیوار متراژ/محله/قیمت است. نامی که
// فقط در عنوان آمده پذیرفته نیست، مگر در خودِ عنوان در موضعِ امضا باشد یا در فهرستِ سفید — روی «همهٔ» مسیرها.
export function extractSignature(title: string, desc: string, agencyName = ''): string[] {
  const out = extractSignatureAny(title, desc, agencyName)
  if (!out.length) return out
  const dLines = textLines(desc || ''), tLines = textLines(title || '')
  const wl = new Set(whitelistHits(collapseSpacedLatin(normFa(`${title || ''}\n${desc || ''}`))))
  return out.filter(n => {
    if (wl.has(n)) return true
    const keys = n.split(/\s+/).filter(Boolean).map(w => keyOf(w).toLowerCase())
    return nameOccurrences(keys, dLines).length > 0 || nameOccurrences(keys, tLines).some(inSignaturePosition)
  })
}
function extractSignatureAny(title: string, desc: string, agencyName = ''): string[] {
  // مسیرِ اصلی: برچسب‌زنِ توکن (roster-ner). روی دادهٔ کنارگذاشته ۸۷.۹٪ درست بود.
  // الگوهای زیر فقط وقتی اجرا می‌شوند که مدل بارگذاری نشده باشد — پس در تولید
  // تصمیم با مدل است، نه با قاعده.
  // MODEL_AUTHORITATIVE — وقتی مدل بارگذاری شده، حرفِ آخر با اوست: چه نام بدهد چه
  // سکوت کند. تا امروز سکوتِ مدل باعث می‌شد الگوهای regexِ زیر اجرا شوند و برای
  // آگهیِ بی‌امضا نامِ جعلی بسازند («چت دیوار»، «درختان میوه»، «گیر کمد»).
  // همین یک بازگشت، همهٔ بهبودهای مدل را در آگهی‌های بی‌امضا خنثی می‌کرد.
  // «فلاحی» از «بین فلاحی ۴۱»، «کسری» از «کسری بودجه»، و «امین» از «مشاور امینِ شما» (صفت، نه نام)
  // هرگز اسم نمی‌شوند. فاز ۳۲۱ — این banned حالا به مسیرِ مدل هم اعمال می‌شود (قبلاً فقط در fallback
  // بود، ولی تولید همیشه مدل‌دار است؛ «مشاور امین شما» ⇒ «امین»ِ جعلی از همین‌جا می‌آمد).
  // فاز ۳۴۴ — متن پیش از همه‌چیز یکسان می‌شود («هماهنگیِ»/«هماهنگى» ⇒ «هماهنگی»).
  title = normFa(title || ''); desc = normFa(desc || '')
  if (isDivarMetaText(desc)) desc = ''   // «انتشار آگهی / آخرین نردبان» متنِ آگهی نیست
  const raw = collapseSpacedLatin(`${title || ''}\n${desc || ''}`)

  // ── وایت‌لیستِ مدیریتی: قاطع و مقدم بر همه‌چیز (حتی سکوتِ مدل) ──
  // ادمین صریحاً گفته این نام است؛ پس اگر عینِ نامِ وایت‌لیست (دنبالهٔ واژه‌ها، بی‌حساسیت به
  // فاصله/نیم‌فاصله) در متنِ آگهی بیاید، همان‌جا قطعی برمی‌گردد — پیش از مسیرِ مدل.
  const wlHits = whitelistHits(raw)
  if (wlHits.length) return wlHits

  const banned = new Set([...addressTokens(raw), ...contextNoiseTokens(raw)])
  // هر واژه‌ای که بلافاصله پیش از «شما» بنشیند در جایگاهِ صفت است، نه نام: «امینِ شما»، «همراهِ شما».
  for (const m of raw.matchAll(/([ء-ی]{3,15})\s*(?:ی|ِ)?\s*شما/g)) banned.add(keyOf(m[1]))

  const ner = bestName(title, desc)
  if (hasSparseModel() || ner) {
    // فاز ۲۹۸ی۳ — نامِ برآمده از سیگنالِ قطعیِ شخص (عنوان/برچسب/معرفیِ خود، ner.trust) از بانِ
    // «شهرِ تک‌کلمه‌ای» عبور می‌کند: «خانم شهریار»/«شهریار هستم» واقعاً شخص‌اند. فاز ۳۲۱: banned
    // (آدرس/«Xِ شما») فقط به حدسِ مدل (بی‌trust) اعمال می‌شود — نامِ قطعیِ شخص از آن هم معاف است.
    // فاز ۳۳۶ — حدسِ گازِتیر (trust قوی، یا ضعیفِ gaz) از بانِ آدرس معاف است: خودِ گازِتیر نشانهٔ
    // آدرس را در بافتِ نقش می‌شناسد و «منطقه فراهانی» را نامِ مشاور می‌گیرد (نه آدرس). ولی حدسِ ضعیف
    // trustPerson نمی‌گیرد (SOLO_NEVER سرِ جا) و چون p<0.97 است از دروازهٔ nameProb هم می‌گذرد.
    const banFree = !!(ner && (ner.trust || ner.gaz))
    const v0 = ner ? validName(ner.name, agencyName, banFree ? undefined : banned, { trustPerson: !!ner.trust }) : ''
    // فاز ۳۴۳ — بانِ سخت (مقدارِ مشخصه / تکهٔ نامِ محله) حتی برای trust/گازِتیر: «شمس» از «شمس آباد» هرگز.
    const v = v0 && !hitsBan(v0, hardBanTokens(raw)) ? v0 : ''
    if (!v) {
      // بک‌استاپِ دقتِ‌بالا وقتی مدل ساکت است: خطی که «دقیقاً <نامِ کوچکِ شناخته‌شده> <نامِ خانوادگی>»
      // است (مثلِ «✅ سالار عباسی» روی خطِ خودش) نامِ قطعی است و مدلِ ناقص نباید از دستش بدهد.
      // بسیار سخت‌گیر (توکنِ اول باید نامِ کوچکِ شناخته‌شده باشد) تا نوفه نسازد.
      const fn = firstNameFullLine(raw, agencyName, banned)
      if (fn) return [fn]
      return []
    }
    // فاز ۲۹۷ت — کیس‌استادیِ شاهان: حدسِ مدل («تمیز»، «سخت»، «همراهتان») بدونِ هیچ
    // دروازهٔ دومی پذیرفته می‌شد و با ۲ فایل مشاورِ جعلی می‌ساخت، درحالی‌که مسیرِ regex
    // همهٔ کاندیداها را از nameProbSync می‌گذرانْد. حالا حدسِ «خالصِ» مدل هم از همان
    // دروازه می‌گذرد؛ امضای برچسب‌دار/معرفیِ خود (p≥۰.۹۷ — شواهدِ قطعیِ متنی) مستثناست.
    if (ner!.p < 0.97) {
      const bp = nameProbSync(v)
      if (bp !== null && bp < NAME_THRESHOLD) return []
    }
    // فاز ۳۴۴ (پورت از خودروجت، فاز ۳۴۷) — حدسِ «تک‌کلمه‌ایِ» مدلِ آماری فقط در موضعِ امضا نام است — همان دروازهٔ
    // نامِ AI. «هوشمند» در «کلید هوشمند»، «تعاونی» در «سند تعاونی» واژهٔ آگهی‌اند، نه امضا.
    if (ner!.src === 'model' && !ner!.trust && !v.includes(' ')) {
      const occ = nameOccurrences([keyOf(v).toLowerCase()], textLines(raw))
      if (!occ.some(inSignaturePosition)) return []
    }
    return [v]
  }

  // raw/banned بالاتر (پیش از مسیرِ مدل) محاسبه شدند؛ خطِ زیر فقط برای مسیرِ fallback بی‌مدل است.
  for (const m of raw.matchAll(/([\u0621-\u06cc]{3,15})\s*(?:ی|ِ)?\s*شما/g)) banned.add(keyOf(m[1]))
  const out: string[] = []
  const scores = new Map<string, number>()
  const push = (s?: string) => {
    const v = validName(s || '', agencyName, banned)
    if (!v || out.includes(v)) return
    // دروازهٔ دوم: دسته‌بندِ خودمان. فهرستِ سیاه «غریب» و «متمدن» را می‌کشت و
    // «سالن اجتماعات» را رد می‌کرد؛ مدل هر دو را درست تشخیص می‌دهد.
    // null = مدل هنوز آموزش ندیده → رفتار دقیقاً مثلِ قبل می‌ماند.
    // VARIANT — «وامین» = «و امین» چسبیده. به‌جای فهرستِ سیاه، هر دو صورت را به مدل
    // می‌دهیم و بالاترین نمره برنده می‌شود. اگر نام واقعاً با «و» شروع شود (وحید،
    // وزیری) صورتِ کامل نمرهٔ بالاتری می‌گیرد و دست‌نخورده می‌ماند.
    let best = v, bp = nameProbSync(v)
    // «وامین» وقتی «امین» ممنوعِ همین آگهی است، خودش هم ممنوع است.
    if (/^و[\u0621-\u06cc]{4,}$/.test(v) && banned.has(keyOf(v.slice(1)))) return
    if (/^و[\u0621-\u06cc]{4,}$/.test(v)) {
      const alt = validName(v.slice(1), agencyName, banned)
      const ap = alt ? nameProbSync(alt) : null
      if (alt && ap !== null && bp !== null && ap > bp) { best = alt; bp = ap }
    }
    if (bp !== null && bp < NAME_THRESHOLD) return
    if (out.includes(best)) return
    scores.set(best, bp == null ? 0.5 : bp)
    out.push(best)
  }

  // خط‌ها روی متنِ بدونِ اموجی/بولت (▪ و ✅ به فاصله تبدیل می‌شوند، ولی مرزِ خط حفظ می‌شود).
  const lines = deEmoji(raw).split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  const isSig = lines.map(l => SIG_LINE.test(l))

  // (الف) نام روی خودِ خطِ امضا — هر سه الگوی امضا، ولی محدود به همان خط.
  lines.forEach((line, i) => {
    if (!isSig[i]) return
    for (const m of line.matchAll(RE_SELF)) push(m[1])       // «محمد پرنده هستم مشاور…» — اولویت با معرفیِ خود
    for (const m of line.matchAll(RE_TITLED)) push(m[1])
    for (const m of line.matchAll(RE_AFTER_KEY)) push(m[1])
    for (const m of line.matchAll(RE_TAIL)) {
      const ws = (m[1] || '').trim().split(/\s+/).filter(Boolean).filter(w => !TITLES.has(keyOf(w)) && !isNoiseWord(w))
      if (ws.length) push(ws.slice(0, 2).join(' '))
    }
  })

  // (ب) خطِ چسبیده به خطِ امضا که فقط یک نام است: «▪ مصطفی هوشمند» بالای «▪ مشاور تخصصی …».
  lines.forEach((_l, i) => {
    if (!isSig[i]) return
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= lines.length || isSig[j]) continue
      push(bareNameLine(lines[j], 1, agencyName, banned))
    }
  })

  // (ج۱) بلوکِ تزئینی: بین دو رشتهٔ نماد ( ✦✦✦ SHAYGAN ✦✦✦ / ✨ ملکی ✨ ) — روی متنِ اصلی (نمادها لازم‌اند).
  const deco = new RegExp(`[${DECOR}]{1,8}\\s*([A-Za-z\\u0622-\\u06cc][A-Za-z\\u0622-\\u06cc]{1,22})\\s*[${DECOR}]`, 'g')
  for (const m of raw.matchAll(deco)) push(m[1])

  // (ج۲) نامِ چسبیده به اموجیِ شخص («🙍‍♀️رضایی» / «👤کریمی») — روی متنِ اصلی، اموجیِ آدم فقط.
  const PERSON = '\\u{1F464}-\\u{1F469}\\u{1F481}\\u{1F482}\\u{1F470}\\u{1F935}\\u{1F64B}-\\u{1F64F}\\u{1F9D0}-\\u{1F9DF}\\u{1F471}\\u{1F474}\\u{1F475}'
  const CONNECT = '\\u{200D}\\u{FE0F}\\u{2640}\\u{2642}\\u{1F3FB}-\\u{1F3FF}\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}'
  const re5 = new RegExp(`[${PERSON}][${CONNECT}]*\\s*((?:سرکار\\s+)?(?:خانم|آقای?|جناب|مهندس|دکتر|حاج)?\\s*[ء-ی]{2,15}(?:\\s+[ء-ی]{2,15})?)`, 'gu')
  for (const m of raw.matchAll(re5)) push(m[1])

  // (د) خطی که به‌تنهایی دقیقاً یک نامِ ۲کلمه‌ای است (بدونِ هیچ واژهٔ نوفه/آدرس/رقم) — آخرین اولویت،
  //     چون بدونِ کلیدواژهٔ امضا کم‌اطمینان‌ترین سیگنال است. خطِ عنوان (i=0) شمرده نمی‌شود.
  lines.forEach((line, i) => { if (i > 0 && !isSig[i]) push(bareNameLine(line, 2, agencyName, banned)) })

  // FREE_CANDIDATES — الگوهای ثابت هر جمله‌بندیِ تازه را از دست می‌دهند:
  // «کارشناس املاک : مرادی» را هیچ‌کدام نگرفت، چون بینِ کلیدواژه و نام یک واژهٔ
  // دیگر بود. به‌جای افزودنِ الگوی تازه (که فردا هم می‌شکند)، همهٔ تک‌واژه‌ها و
  // دوواژه‌های خطِ امضا کاندیدا می‌شوند و انتخاب با مدل است.
  const free = new Set<string>()
  lines.forEach((line, i) => {
    if (!isSig[i] && i < lines.length - 3) return
    // SEG_BOUNDARY — «کارشناس املاک : مرادی» و «پونک ... حلمی»: دوواژه نباید از روی
    // نشانه‌گذاری رد شود، وگرنه «پونک حلمی» و «تهران مرداد» ساخته می‌شوند.
    for (const seg of line.split(/[:：،؛,\-–—|/()\[\]«»]+/)) {
      const ws = seg.split(/[^\u0621-\u06ccA-Za-z]+/).filter(w => w.length > 1)
      for (let j = 0; j < ws.length; j++) {
        free.add(ws[j])
        if (j + 1 < ws.length) free.add(ws[j] + ' ' + ws[j + 1])
      }
    }
  })
  for (const c of free) push(c)

  // بالاترین نمرهٔ مدل اول. کاندیداهای الگویی نمرهٔ پایهٔ ۰.۵ می‌گیرند وقتی مدل نیست،
  // پس در نبودِ مدل ترتیب دقیقاً مثلِ قبل می‌ماند.
  // زیرعبارت حذف می‌شود: اگر «رها زمانی» پذیرفته شده، «رها» نامِ جداگانه نیست.
  // انتخابِ بینِ دوواژه و تک‌واژه با پیکره، نه با نمرهٔ مدل: مدل به عبارتِ کمیاب
  // («پونک حلمی» که یک‌بار آمده) نمرهٔ بالا می‌دهد چون بسامدش صفر است.
  const sub = (a: string, b: string) => b !== a && b.split(' ').length > a.split(' ').length &&
    (b.startsWith(a + ' ') || b.endsWith(' ' + a))
  const full = out.filter(a => {
    // دوواژهٔ کمیاب که تک‌واژه‌اش هم کاندیداست → دوواژه کنار می‌رود
    if (a.includes(' ') && corpusCount(a) < 2 && out.some(x => sub(x, a))) return false
    // تک‌واژه‌ای که دوواژهٔ دیده‌شده‌ای شاملش است → تک‌واژه کنار می‌رود
    if (out.some(b => sub(a, b) && corpusCount(b) >= 2)) return false
    return true
  })
  return full.sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0))
}

// پالایشِ AI: نامِ مشاورِ هر آگهی را برمی‌گرداند (خالی اگر امضا نبود). اگر مدل نبود/خطا داد → map خالی.
// (exported برای اسکریپتِ کیس‌استادی scripts/roster-casestudy.mjs — فاز ۲۹۷ش)
// فاز ۳۴۴ — مدلِ نام‌گذاریِ روستر: اول «RosterAgent» (اختصاصی، از پنلِ «API و مدل‌های AI»)، بعد مدلِ محتوا/چت.
export const ROSTER_AGENT: [string, 'text'][] = [['roster', 'text'], ['content', 'text'], ['chat', 'text']]
// نسخهٔ پرامپتِ نام‌گذاری؛ با هر تغییرِ معنادارِ پرامپت بالا برود تا جواب‌های کش‌شدهٔ قدیمی دوباره پرسیده شوند.
// ۲ = حکمِ واقعیِ AI (فاز ۳۴۱)؛ ۳ = قواعدِ عنوان/محله/مشخصه (فاز ۳۴۳)؛ ۴ = پرامپتِ «بازخوانی»، تک‌آگهی، متنِ ویجت (فاز ۳۴۴).
// فاز ۳۴۶ه — بالا بردنِ نسخه یعنی «همهٔ» آگهی‌های «همهٔ» آژانس‌ها دوباره پرسیده شوند (صفِ سریالِ ساعت‌ها). بهبودهای پرامپتِ ۳۴۶ج
// فقط برای آگهی‌های تازه/نپرسیده و جواب‌های ردشده اعمال می‌شود؛ اشتباه‌های قبلی را ادمین با یک کلیک (تأیید/حذف) درست می‌کند.
// ۶ = فاز ۳۴۶و: قاعدهٔ اشتباهِ نسخهٔ ۵ («کارشناس … منطقه X ⇒ X نامِ مشاور است») محله‌ها را مشاور کرد (هروی/دروس/اختیاریه…).
// فقط جواب‌های «نسخهٔ ۵» دوباره پرسیده می‌شوند؛ جواب‌های نسخهٔ ۴ معتبر می‌مانند (بازپرسیِ کلِ ناوگان نه).
export const AI_PROMPT_V = 6
export const aiAnswerValid = (v?: number) => (v || 0) >= 4 && v !== 5
// فاز ۳۴۶ — کدهای خطای «AI-only» (agency-roster-store رفتارِ سینک را از روی همین‌ها تعیین می‌کند).
export const AI_OFF_ERROR = 'هوش مصنوعیِ نام‌گذاری روشن/تنظیم نیست — بدونِ AI هیچ نامی تعیین نمی‌شود (پنل → API و مدل‌های AI → بخشِ روستر)'
export async function aiCanonical(items: { i: number; title: string; desc: string; loc?: string }[], agencyName = '', notNames: string[] = []): Promise<{ map: Record<number, string>; raw: string; answered?: number[] }> {
  const { model, provider } = resolveAgent(ROSTER_AGENT)
  if (!model) return { map: {}, raw: '(هیچ مدلی تنظیم نشده)', answered: [] }
  // اموجی/نماد را به فاصله تبدیل می‌کنیم تا اسمِ چسبیده به اموجی («♀️محمدی») برای AI هم خوانا شود.
  // نام اغلب در «ابتدای» معرفی یا «انتهای» آگهی است؛ گاهی وسط (پیش از فهرستِ امکانات/آدرس) — برشِ بزرگ‌تر.
  const clip = (s: string) => { const d = deEmoji(s || '').replace(/\s+/g, ' ').trim(); return d.length > 1800 ? d.slice(0, 500) + ' … ' + d.slice(-1200) : d }
  const list = items.map(it => `${it.i}) ${deEmoji(it.title || '').slice(0, 80)}${it.loc ? ` [محل: ${deEmoji(it.loc).slice(0, 40)}]` : ''} :: ${clip(it.desc)}`).join('\n')
  // فاز ۳۴۴ (پورت از خودروجت، فاز ۳۴۹ — «AI ۸۳ آگهی را خواند ولی ۶ نام داد») — پرامپتِ قبلی با «کوچک‌ترین تردید =
  // خالی» مدل را به «بی‌نام» هل می‌داد، درحالی‌که امضای آژانس‌ها دقیقاً همان متنِ تکراری است («⭕️ کارشناس خانم
  // ستوده ⭕️» در همهٔ آگهی‌ها). حالا هدف «پیدا کردن» است، با نمونه‌های واقعی؛ و فهرستِ «چه چیزی نام نیست» (ملکی،
  // محله، مقدارِ مشخصه، تشکر، نامِ آژانس) سرِ جایش است. هر دروغِ مدل را دروازهٔ «در متن + موضعِ امضا» می‌گیرد.
  const sys = 'تو نامِ «مشاور/کارشناسِ فروش/فروشندهٔ» هر آگهیِ ملک را از متنِ توضیحات درمی‌آوری تا آگهی‌های یک آژانسِ املاک به تفکیکِ مشاور جدا شوند. ' +
    'هر آگهی را تا آخر بخوان؛ نامِ مشاور معمولاً کنارِ نقش («کارشناس/کارشناس فروش/مشاور/مشاور فروش/فروشنده/جهت هماهنگی/جهت بازدید/تماس با/با تشکر/ارادتمند شما»)، لقب («آقای/خانم/مهندس») یا شمارهٔ تلفن می‌آید — اغلب در انتها، گاهی اولِ متن یا وسطِ آن، و گاهی میانِ اموجی و نماد (⭕️ ✅ 👤 ▪). متنِ امضا در آگهی‌های یک آژانس معمولاً تکراری است؛ در هر آگهی که آمده، نام را برگردان. ' +
    (agencyName ? `نامِ این آژانس «${deEmoji(agencyName).replace(/\s+/g, ' ').trim().slice(0, 40)}» است؛ آن و هر بخشی از آن اسمِ مشاور نیست. ` : '') +
    'نمونه‌ها: «⭕️ کارشناس خانم ستوده ⭕️» → «ستوده». «کارشناس فروش جهت راهنمایی محمدی» → «محمدی». «مشاور فروش: خانم کامرانی» → «کامرانی». «جهت بازدید هماهنگی با آقای رادمهر» → «رادمهر». «✅ سالار عباسی ۰۹۱۲…» → «سالار عباسی». «حیدری هستم مشاور شما» → «حیدری». «جهت کسب اطلاعات بیشتر و هماهنگی بازدید تماس بگیرید» (بی‌نام) → خالی. ' +
    'قواعد: (۱) فقط نامِ واقعیِ یک «آدم» (فارسی، مثلِ «علی رضایی»، «محمدی»، «ستوده») یا امضای برندِ لاتین (مثلِ «SHAYGAN»). ' +
    '(۲) هرگز نوعِ ملک/واژهٔ ملکی را برنگردان (آپارتمان، ویلا، پنت‌هاوس، سوییت، کلنگی، متراژ، نوساز، لوکیشن، دوخواب، تک‌واحدی…). ' +
    '(۳) القاب را حذف کن: «خانم رضایی»→«رضایی». «خانم/آقا/مهندس» به‌تنهایی = خالی. ' +
    '(۴) عبارتِ تبلیغاتی/قید/صفت («فروش ویژه»، «فوری»، «فقط امروز»، «همین حالا»، «قطعی»، «مالک»، «مستاجر»، «موجود»، «رزرو»، «هماهنگی»، «عزیزان») اسم نیست. ' +
    // فاز ۲۷۵ — نامِ کوچه/خیابان («بین فلاحی ۴۱ و ۴۳» → «فلاحی»).
    // فاز ۳۴۶ج — «منطقه X» در امضای قالبیِ آژانس‌ها نامِ مشاور است («کارشناس ملکی منطقه امیر پاشا» را AI بی‌امضا گفته بود).
    '(۵) نامِ معبر/محله اسمِ مشاور نیست: واژهٔ پس از «بین/خیابان/کوچه/بلوار/نبش/میدان/شهرک/فاز/پلاک» آدرس است، و نامِ محله‌ها (سعادت‌آباد، جنت‌آباد، شهرک‌غرب، پونک، نارمک، تهرانپارس، ونک، نیاوران، پاسداران، هروی، جهانتاب/جهان تاب، گیشا، صادقیه، اکباتان، شمس‌آباد، یوسف‌آباد، امیرآباد…) هم. ' +
    // فاز ۳۴۶و — نسخهٔ ۵ اینجا گفته بود «پس از منطقه = نامِ مشاور» و AI محله‌ها را مشاور کرد. «منطقه X» معمولاً محله/خیابان است.
    'در «کارشناس/مشاور … منطقه X» تقریباً همیشه X نامِ محله یا خیابان است (دروس، هروی، اختیاریه، دیباجی، اندرزگو، ناطق نوری، وارسته، ذوالفقاری، نیلوفر…) → خالی. فقط وقتی X بی‌تردید نامِ خانوادگیِ یک آدم است و نامِ هیچ محله/خیابانی نیست (مثلِ «منطقه فخاری»، «منطقه امیر پاشا») آن را بده. محلِ خودِ آگهی (پس از «محل:») هرگز نامِ مشاور نیست. ' +
    '(۶) هر واژه‌ای که تکه‌ای از نامِ یک مکان است اسمِ آدم نیست: «شمس آباد» ⇒ «شمس» نه؛ «امیر آباد» ⇒ «امیر» نه؛ «برج X»/«شهرک X» ⇒ X نه. ' +
    '(۷) مقدارِ یک مشخصه اسم نیست: «وضعیت سند: تعاونی»، «سیستم سرمایش: فن کوئل»، «کف: سرامیک». ' +
    // فاز ۳۳۶و — «با سپاس» ⇒ «سپاس».
    '(۸) واژهٔ تشکر/خداحافظی («با سپاس»، «با تشکر»، «ارادتمند»، «درود») خودش اسم نیست — اسمِ پس از آن را بردار. ' +
    '(۹) عنوانِ آگهی (پیش از «::») فقط برای فهمِ موضوع است؛ نام را از توضیحات (پس از «::») بردار. اگر هیچ نامِ آدمی در توضیحات نیست، خالی بگذار — از عنوان یا مشخصاتِ ملک اسم نساز. ' +
    '(۱۰) نام را «دقیقاً با همان املای متن» بنویس؛ حرفی کم یا اضافه نکن. ' +
    // فاز ۳۴۶ج — اشتباه‌های زندهٔ AI که مالک گزارش کرد.
    '(۱۱) صفت/واژهٔ عادی که شبیهِ اسم است، اسم نیست: «مشاور خوب صادق مهمترین گزینه است» (صادق = درستکار) → خالی؛ «با صداقت»، «پیام دهید»، «تماس یا پیام»، «سند آزاد»، «بازدید= آزاد»، «جهان تاب ۵۷ متر» (نامِ محله)، «عرب» (قوم)، «آرامش/آرادم» → هیچ‌کدام اسم نیستند. ' +
    '(۱۲) جملهٔ خطاب به خریدار («آرشیتکت هستی؟»، «دنبالِ خانه هستید؟»، «سرمایه‌گذار هستی؟») معرفیِ مشاور نیست؛ فقط «<نامِ آدم> هستم» معرفی است. ' +
    (notNames.length ? `(۱۳) این واژه‌ها در این آژانس نامِ مشاور نیستند (مدیر رد کرده، یا نامِ محله‌هایی است که آگهی‌های این آژانس در آن‌هاست): ${notNames.map(n => `«${n}»`).join('، ')}. اگر نامِ واقعیِ دیگری در امضا هست همان را بده، وگرنه خالی. ` : '') +
    'خروجی فقط JSON برای «همهٔ» شماره‌ها، بدونِ توضیح: [{"i":<شماره>,"name":"<نام یا خالی>"}]'
  const out = await Promise.race([
    chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: list }], { temperature: 0, max_tokens: 1500 }, provider),
    // فاز ۳۴۴ — ۳۰ثانیه برای مدلِ ۲۷B روی آگهیِ بلند کم بود (تایم‌اوت ⇒ عملاً «ماشین» تصمیم می‌گرفت).
    new Promise<string>(r => setTimeout(() => r('(تایم‌اوت ۶۰ثانیه)'), 60000)),
  ])
  const map: Record<number, string> = {}
  // فاز ۳۴۱ — «answered» = ردیف‌هایی که AI واقعاً درباره‌شان حکم داد (حتی «خالی»). جوابِ خالیِ AI یعنی
  // «این آگهی امضای مشاور ندارد» و باید حرفِ آخر باشد؛ پاسخِ خراب/تایم‌اوت هیچ ردیفی را answered نمی‌کند.
  const answered: number[] = []
  try {
    const j = JSON.parse((out.match(/\[[\s\S]*\]/) || ['[]'])[0])
    for (const r of j) {
      if (!r || typeof r.i !== 'number') continue
      answered.push(r.i)
      if (typeof r.name === 'string' && r.name.trim()) map[r.i] = r.name.trim()
    }
  } catch {}
  return { map, raw: out, answered }
}

// فاز ۳۴۴ (پورت از خودروجت، فاز ۳۴۸/۳۵۰) — «چه کسی این نام را داد؟» برای هر مشاور: ai = خودِ هوش مصنوعی،
// sig = امضای صریح با قاعده (خانم/آقای X، «نقش: X»، «X هستم»، فهرستِ سفید)، machine = حدسِ ماشین چون AI این آگهی
// را نخواند/خاموش بود، claim = آگهیِ بی‌امضایی که به مشاورِ تثبیت‌شدهٔ همین آژانس چسبید.
export interface NameSrc { ai: number; sig: number; machine: number; claim: number }
export interface NameStats {
  aiOn: boolean          // AI برای نام‌گذاریِ روستر روشن بود؟
  model?: string         // مدلی که نام‌ها را خواند (RosterAgent یا مدلِ محتوا/چت)
  rows: number           // آگهی‌های بررسی‌شده
  aiAnswered: number     // آگهی‌هایی که AI واقعاً درباره‌شان حکم داد (نام یا «بی‌امضا»)
  aiNamed: number        // …که نامِ پذیرفته‌شده دادند
  aiRejected: number     // نامِ AI که در متن/موضعِ امضا نبود و رد شد
  byAI: number; bySig: number; byMachine: number; byClaim: number; unnamed: number
  skippedSig: number     // آگهی‌هایی که امضای قطعی داشتند و به AI نرفتند
  failedBatches: number  // آگهی‌هایی که AI به آن‌ها پاسخ نداد (تایم‌اوت/JSONِ خراب)
  gaveUp: boolean        // پس از شکست‌های پیاپی، بقیه بدونِ AI
  budgetHit: boolean     // سقفِ زمانیِ فازِ AI
  aiLeft?: number        // فاز ۳۴۶ه — آگهی‌هایی که AI در این پاس نرسید بخواند (با جوابِ قبلی ماندند؛ پاسِ بعد ادامه)
  aiAskedNow?: number    // آگهی‌هایی که AI همین پاس خواند
  metaText: number       // آگهی‌هایی که «متن»شان فقط متادیتای انتشارِ دیوار بود
  textMissing: number    // ⚠ آگهی‌هایی که متنشان پس از ۳ تلاش از دیوار خوانده نشد (throttle/تایم‌اوت) — سینکِ بعد دوباره
  unnamedSigLike: number // ⚠ آگهیِ بی‌نامی که «خطِ امضا» دارد (نقش/لقب + واژهٔ نام‌مانند) — باید ۰ باشد
}
// «خطِ امضا»ی ظاهری: نقش/لقب و پس از آن (تا ۳ واژه) یک واژهٔ غیرِنوفه. معیارِ کیفیتِ پنل: آگهیِ بی‌نامی که چنین
// خطی دارد، احتمالاً نامی را از دست داده‌ایم.
const SIGLIKE_KEYS = new Set(['کارشناس', 'مشاور', 'فروشنده', 'آقای', 'آقا', 'اقای', 'اقا', 'خانم', 'جناب', 'سرکار', 'نماینده'].map(keyOf))
export function signatureLikeLine(text: string): string {
  for (const line of deEmoji(normFa(text || '')).split(/[\n\r]+/)) {
    const toks = line.split(/[^ء-ی‌A-Za-z]+/).filter(Boolean)
    for (let i = 0; i < toks.length; i++) {
      if (!SIGLIKE_KEYS.has(keyOf(toks[i]))) continue
      for (let j = i + 1; j < toks.length && j <= i + 3; j++) {
        const w = toks[j]
        if (TITLES.has(keyOf(w)) || isNoiseWord(w)) continue
        if (keyOf(w).length >= 3) return line.trim()
        break
      }
    }
  }
  return ''
}
export interface RosterAdvisor { key: string; name: string; tokens: string[]; posts: BrandPost[]; src?: NameSrc; evidence?: string }   // evidence — فاز ۳۴۶ز: سطری از متن که نام از آن آمد
export interface AgencyRoster {
  ok: boolean; error?: string
  slug: string; agencyName?: string
  total: number; scanned: number
  advisors: RosterAdvisor[]
  unnamed: { tokens: string[]; posts: BrandPost[] }   // بدونِ امضا → به خودِ آژانس
  nameStats?: NameStats
}

// ساختِ رُسترِ کامل: همهٔ آگهی‌های آژانس → استخراجِ امضا → خوشه‌بندی.
// throttle‌شده؛ باید روی اینستنسِ ۰ اجرا شود (مثلِ بقیهٔ اسکرپ‌ها).
export async function buildAgencyRoster(
  slugOrUrl: string,
  opts: { useAI?: boolean; maxDetails?: number; onProgress?: (done: number, total: number) => void;
    cached?: Record<string, { title: string; desc: string; name?: string; aiv?: number; dv?: number; rjs?: string }>;   // توکن→متن + نامِ AI (ازسرگیری؛ dv=4: متن از ویجتِ توضیحات)
    confirmed?: string[];   // فاز ۳۴۶د — نام‌هایی که ادمین در همین آژانس تأیید کرده (آگهیِ بی‌نامِ AI که این نام را دارد به او می‌رود)
    rejected?: string[];   // فاز ۳۴۶ج — کلیدِ نام‌هایی که ادمین در همین آژانس حذف کرده (هرگز مشاور نمی‌شوند؛ به AI هم گفته می‌شود)
    manual?: Record<string, string>;   // فاز ۳۴۶ب — نامی که ادمین برای همان آگهی تأیید کرده (بر AI مقدم؛ '' = بی‌مشاور)
    pinnedKeys?: string[];   // فاز ۲۷۹ — کلیدِ مشاورهایی که حسابِ واقعی دارند: در ادغام همیشه میزبان می‌مانند
    onRow?: (token: string, r: { title: string; desc: string; name?: string; aiv?: number; dv?: number; rjs?: string }) => void;
    onCluster?: (done: number, total: number) => void;   // فاز ۱۹۴ — پیشرفتِ فازِ AI هم دیده شود
    f?: { profileTokens?: typeof fetchDivarProfileTokens; post?: typeof fetchDivarPost; ai?: typeof aiCanonical };   // فاز ۱۹۶ — تزریق برای تستِ کاملِ چرخه
    shouldStop?: () => Promise<boolean> } = {},   // فاز ۱۹۶ — دکمهٔ توقف
): Promise<AgencyRoster> {
  // توکنِ برندِ دیوار حساس به بزرگ/کوچکیِ حروف است — هرگز lowercase نکن.
  const slug = (divarProfileSlug(slugOrUrl) || String(slugOrUrl || '').trim())
  const base: AgencyRoster = { ok: false, slug, total: 0, scanned: 0, advisors: [], unnamed: { tokens: [], posts: [] } }
  if (!slug || !/^[A-Za-z0-9_-]{2,}$/.test(slug)) return { ...base, error: 'slug/لینکِ برند نامعتبر است' }

  // فاز ۳۴۶ — بدونِ AI هیچ نامی تعیین نمی‌شود؛ پیش از هر خواندنی از دیوار بایست تا فهرستِ فعلی دست‌نخورده بماند.
  const { model: _aiM, provider: _aiP } = resolveAgent(ROSTER_AGENT)
  const AI_NAMING = (!!_aiM && aiActive('roster', _aiP)) || !!opts.f?.ai
  if (!AI_NAMING || opts.useAI === false) return { ...base, error: AI_OFF_ERROR }

  const { posts, name, reason } = await (opts.f?.profileTokens || fetchDivarProfileTokens)(slug)
  if (!posts.length) return { ...base, agencyName: name, error: reason === 'unreachable' ? 'به دیوار نرسید (پروکسی؟)' : 'آگهی‌ای یافت نشد' }

  // فهرستِ سیاه/سفیدِ مدیریتی را از انبار بخوان و به کشِ واژه‌نامه هل بده — هر ویرایش در سوپرادمین
  // از این سینک اثر می‌کند، بدونِ دیپلوی. (ایزوله: واژه‌نامه خودش این ماژول را import نمی‌کند.)
  try { await loadNameRules() } catch {}

  // همهٔ آگهی‌ها پردازش می‌شوند (سقفِ ایمنی ۳۰۰۰). هر آگهی جزئیات + throttle دارد، پس سینکِ بزرگ
  // چند دقیقه طول می‌کشد — با ازسرگیری و heartbeat مشکلی نیست و در پنجرهٔ شبانه اجرا می‌شود.
  const maxDetails = Math.max(1, Math.min(opts.maxDetails ?? 3000, posts.length))
  // برای هر آگهی: عنوان + توضیحات را می‌گیریم و کاندیدای امضا را می‌سازیم.
  // `addr` = توکن‌های آدرسِ همین آگهی؛ هیچ منبعی (AI/lexicon/heuristic) اجازه ندارد از آنها اسم بسازد.
  const rows: { post: BrandPost; title: string; desc: string; descLines: string[][] }[] = []
  let metaText = 0, textMissing = 0
  // فاز ۳۴۴ (باگی که خودروجت هم داشت: «۱۰ آگهی، متنِ هیچ‌کدام خوانده نشده — سینک درست نمی‌کند») — وقتی خواندنِ متنِ
  // یک آگهی از دیوار شکست می‌خورد (throttle/۴۲۹/تایم‌اوت)، آگهی بی‌صدا «بی‌متن» می‌ماند و در همین سینک دیگر تلاش
  // نمی‌شد؛ اگر دیوار در سینکِ بعد هم کُند بود، همان آگهی‌ها برای همیشه بی‌نام می‌ماندند و هیچ‌جا دیده نمی‌شد.
  // حالا: خواندن‌های ناموفق در پایانِ همین پاس دو دورِ دیگر (با مکثِ بیشتر) تلاش می‌شوند، و هرچه باز ماند در
  // آمارِ پنل (textMissing) با رنگِ قرمز دیده می‌شود — و چون کش نمی‌شود، سینکِ بعد هم دوباره می‌خواندش.
  const texts: { title: string; desc: string; failed: boolean; meta?: boolean }[] = []
  const readText = async (p: BrandPost): Promise<{ title: string; desc: string; failed: boolean; meta?: boolean }> => {
    let title = p.title || '', desc = '', failed = false, meta = false
    try {
      const d = await (opts.f?.post || fetchDivarPost)(p.token)
      title = (d.title || title || '').trim(); desc = (d.description || '').trim()
      if (d.reason && !desc) failed = true   // http_429/unreachable/… — نه «آگهیِ واقعاً بی‌متن»
    } catch { failed = true }
    if (isDivarMetaText(desc)) { desc = ''; meta = true }   // «انتشار آگهی/آخرین نردبان: …» متنِ آگهی نیست
    if (!failed) { try { opts.onRow?.(p.token, { title, desc, dv: 4 }) } catch {} }   // چک‌پوینت (dv=4: ویجتِ توضیحات)
    return { title, desc, failed, meta }
  }
  for (let i = 0; i < maxDetails; i++) {
    if (i % 5 === 0 && opts.shouldStop && await opts.shouldStop()) return { ...base, agencyName: name, error: 'متوقف شد' }
    const p = posts[i]
    // ازسرگیری فقط اگر متنِ کامل کش شده باشد. کشِ desc-خالی (از دورهٔ پروکسیِ مرده) دوباره گرفته
    // می‌شود تا اسمِ آخرِ متن از دست نرود (باگِ «خانم هرمزی → بی‌نام»).
    const hit = opts.cached?.[p.token]
    // فاز ۳۴۴ — «انتشار آگهی/آخرین نردبان: …» متنِ آگهی نیست؛ نه از کش خوانده می‌شود، نه کش می‌شود، نه به AI می‌رود.
    if (hit && hit.desc && !isDivarMetaText(hit.desc)) texts.push({ title: (hit.title || p.title || '').trim(), desc: hit.desc.trim(), failed: false })
    else {
      texts.push(await readText(p))
      await sleep(600)   // نرخِ کندتر تا دیوار زیرِ فشار آگهی‌ها را رد نکند (fetchDivarPost خودش retry هم دارد)
    }
    try { opts.onProgress?.(i + 1, maxDetails) } catch {}
  }
  for (let round = 1; round <= 2; round++) {
    const again = texts.map((t, i) => (t.failed ? i : -1)).filter(i => i >= 0)
    if (!again.length) break
    console.log(`[roster] ${slug}: متنِ ${again.length} آگهی خوانده نشد — تلاشِ دوباره (دورِ ${round}/۲)`)
    await sleep(3000 * round)
    for (const i of again) {
      if (opts.shouldStop && await opts.shouldStop()) return { ...base, agencyName: name, error: 'متوقف شد' }
      const t = await readText(posts[i])
      if (!t.failed) texts[i] = t
      await sleep(1200 * round)
    }
  }
  for (let i = 0; i < texts.length; i++) {
    const p = posts[i]
    let { title, desc } = texts[i]
    if (texts[i].failed) textMissing++
    if (texts[i].meta) metaText++
    // فاز ۳۴۴ — متنِ یکسان‌شده برای همهٔ منابع (مدل، قاعده، AI، دروازه‌ها) و برای نامِ نمایشی.
    title = normFa(title); desc = normFa(desc)
    rows.push({ post: p, title, desc, descLines: textLines(desc) })
  }
  if (textMissing) console.error(`[roster] ${slug}: ⚠ متنِ ${textMissing} آگهی پس از ۳ تلاش هم از دیوار خوانده نشد — بی‌نام می‌مانند تا سینکِ بعد`)

  // ── فاز ۳۴۶ — نامِ مشاور «فقط» با هوش مصنوعی (دستورِ صریحِ مالک) ──
  // «صد تا چیز گذاشتی؛ همه را پاک کن، فقط هوش مصنوعی تشخیص بدهد. ماشین‌لرنینگ را پاک نکن، فقط یاد بگیرد و هیچ دخالتی
  // نداشته باشد.» ریشهٔ «هی بدتر می‌شود»: لایه‌های قاعده (فهرستِ سفید، گازِتیر، حدسِ مدلِ آماری، واژه‌نامهٔ آموخته، پاسِ
  // «چسبیده») هرکدام جای AI تصمیم می‌گرفتند — «آزاد» از «سند آزاد» با فهرستِ سفید، و آگهیِ «امضای قطعی» اصلاً به AI نمی‌رفت.
  // حالا: «هر» آگهیِ دارای متن به AI می‌رود و نامِ هر آگهی «فقط» جوابِ AI است. تنها بررسی، ضدِ توهم است: نامی که AI داد
  // باید واژه‌به‌واژه در متنِ همان آگهی آمده باشد (نامِ ساختگی/چسبانده پذیرفته نمی‌شود). ماشین‌لرنینگ فقط از جواب‌های AI
  // یاد می‌گیرد (learnName + بازآموزیِ شبانه) و در تصمیم هیچ نقشی ندارد.
  // AI خاموش/تنظیم‌نشده ⇒ سینک با خطای روشن می‌ایستد و فهرستِ فعلیِ مشاوران دست‌نخورده می‌ماند (نه این‌که ماشین جایش را بگیرد).
  // AI همهٔ آگهی‌ها را نخوانده (سقفِ زمان/خطا) ⇒ هیچ‌چیز بازنویسی نمی‌شود؛ جواب‌ها کش شده‌اند و سینکِ بعد از همان‌جا ادامه می‌دهد.
  const aiMap: Record<number, string> = {}
  const aiAsked = new Set<number>()   // ردیف‌هایی که AI حکم داده (نام یا «بی‌امضا»)
  const aiStats = { failedBatches: 0, budgetHit: false, gaveUp: false, skippedSig: 0 }
  const nameCounts = { aiNamed: 0, aiRejected: 0 }
  const pending: { idx: number; row: (typeof rows)[number] }[] = []
  const manualIdx = new Set<number>()
  const rejectedKeys = new Set((opts.rejected || []).map(k => keyOf(k)))
  const rejectedNames = [...new Map((opts.rejected || []).filter(k => k && !/^[A-Za-z0-9_:-]+$/.test(k)).map(k => [keyOf(k), k] as const)).values()].slice(-40)
  let rejectedByAdmin = 0
  // فاز ۳۴۶و (اسکرین‌شاتِ مالک: «هروی/دروس/اختیاریه دروس/نیلوفر سران/دیباجی» مشاور شده بودند) — مکان‌ها: محله‌های گازِتیرِ سایت
  // (geo-store) + «محل»ِ آگهی‌های همین آژانس (brand-landing) + واژه‌های نامِ آژانس. نامی که «کل»ش یا «یکی از واژه‌هایش» مکان است رد
  // می‌شود (تأییدِ ادمین معاف است — «هروی» اگر واقعاً نامِ مشاور باشد با یک کلیک تأیید می‌شود).
  const placeKeys = new Set<string>()
  try { const { getAll } = await import('./geo-store'); for (const p of getAll()) for (const c of p.cities || []) for (const d of c.districts || []) { for (const n of [d.name, ...(d.neighborhoods || [])]) { const k = keyOf(n); if (k.length >= 3) placeKeys.add(k) } } } catch {}
  const agencyPlaces = new Set<string>()
  for (const p of posts) for (const part of String(p.location || '').split(/[،,/|\-]+|\s+در\s+/)) { const k = keyOf(part.replace(/^.*?\sدر\s/, '')); if (k.length >= 3 && !/\d|[۰-۹]/.test(part)) { placeKeys.add(k); agencyPlaces.add(part.trim()) } }
  for (const w of String(name || '').split(/\s+/)) { const k = keyOf(w); if (k.length >= 3 && !/^(املاک|آژانس|مشاور|مشاورین|مشاوران|گروه|دفتر|مسکن|املاکِ|امللاک)$/.test(w)) placeKeys.add(k) }
  // فاز ۳۴۶ز (اسکرین‌شاتِ مالک: «شرقی/پاشا/… — کلی خیابان») — نامِ محله/خیابان تقریباً همیشه در «عنوانِ» آگهی‌های همان آژانس هست
  // («هروی/فروش/۱۲۴ متری»، «پاسداران شرقی …»)، ولی نامِ مشاور در عنوان نمی‌آید. پس نامی که (واژه‌به‌واژه) در عنوانِ هر آگهیِ همین آژانس
  // آمده، مکان/عبارتِ آگهی است نه مشاور. این سیگنال از دادهٔ خودِ آژانس است، نه فهرستِ دستی. تأییدِ ادمین معاف است.
  const titleLines = rows.flatMap(r => textLines(r.title))
  const inTitles = (n: string) => { const ks = String(n || '').split(/\s+/).filter(Boolean).map(w => keyOf(w).toLowerCase()); return ks.length > 0 && nameOccurrences(ks, titleLines).length > 0 }
  const isPlaceName = (n: string) => { const ws = String(n || '').split(/\s+/).filter(Boolean); return placeKeys.has(keyOf(n)) || ws.some(w => placeKeys.has(keyOf(w))) || inTitles(n) }
  const placeHints = [...agencyPlaces].slice(0, 25)
  let placeRejected = 0
  let aiLeft = 0, aiAskedNow = 0
  const rjSig = 'p2|' + [...rejectedKeys].sort().join('|')   // p1 = فاز ۳۴۶و: جوابِ «مکان» هم یک بار با راهنمای محل دوباره پرسیده می‌شود
  // فاز ۳۴۶د — نام‌های تأییدشدهٔ همین آژانس (بلندتر اول: «امیر پاشا» پیش از «امیر»)؛ ردشده‌ها کنار.
  const confirmedList = [...new Map((opts.confirmed || []).filter(n => n && !rejectedKeys.has(keyOf(n))).map(n => [keyOf(n), n.replace(/\s+/g, ' ').trim()] as const)).values()]
    .sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length)
  let byConfirmed = 0
  rows.forEach((r, idx) => {
    const hit = opts.cached?.[r.post.token]
    // فاز ۳۴۶ب — حکمِ ادمین برای همین آگهی بر AI مقدم است و آگهی دیگر پرسیده نمی‌شود.
    if (opts.manual && opts.manual[r.post.token] !== undefined) { aiMap[idx] = opts.manual[r.post.token]; aiAsked.add(idx); manualIdx.add(idx) }
    // جوابِ کش‌شدهٔ AI (همین نسخهٔ پرامپت) حکم است — حتی خالی. وگرنه دوباره پرسیده می‌شود.
    // فاز ۳۴۶ج — جوابی که ادمین «حذفش» کرده یک بار دیگر (با گفتنِ «این نام نیست») پرسیده می‌شود تا AI نامِ درستِ همان آگهی را پیدا کند؛
    // rjs = امضای فهرستِ حذف‌شده‌ها هنگامِ آن پرسش — تا همان آگهی در هر سینک دوباره پرسیده نشود.
    else if (hit?.name !== undefined && aiAnswerValid(hit.aiv) && !(hit.name && (rejectedKeys.has(keyOf(hit.name)) || isPlaceName(hit.name)) && hit.rjs !== rjSig)) { aiMap[idx] = hit.name; aiAsked.add(idx) }
    else if (!r.desc.trim()) { /* بی‌متن: چیزی برای خواندن نیست — بی‌نام */ }
    else pending.push({ idx, row: r })
  })
  {
    // «یک آگهی در هر درخواست»، ۳ درخواستِ هم‌زمان، بودجهٔ ۱۵ دقیقه در هر پاس؛ ۸ شکستِ پیاپی ⇒ توقفِ این پاس.
    const CONC = 3
    const chunksTotal = pending.length
    const aiDeadline = Date.now() + 15 * 60_000
    let failStreak = 0, doneCount = 0, next = 0, stopped = false
    const ask = async (item: (typeof pending)[number]): Promise<boolean> => {
      try {
        const res = await (opts.f?.ai || aiCanonical)([{ i: item.idx, title: item.row.title, desc: item.row.desc, loc: item.row.post.location }], name, [...rejectedNames, ...placeHints])
        const got = res.map
        const answered = new Set(res.answered ?? (Object.keys(got).length ? [item.idx] : []))
        if (!answered.has(item.idx)) return false
        if (got[item.idx]) aiMap[item.idx] = got[item.idx]
        aiAsked.add(item.idx)
        try { opts.onRow?.(item.row.post.token, { title: item.row.title, desc: item.row.desc, name: got[item.idx] ?? '', aiv: AI_PROMPT_V, rjs: rjSig }) } catch {}
        return true
      } catch { return false }
    }
    const worker = async () => {
      while (!stopped && next < pending.length) {
        if (Date.now() > aiDeadline) { if (!aiStats.budgetHit) console.log('[roster] AI phase budget hit — ادامه در پاسِ بعد'); aiStats.budgetHit = true; stopped = true; break }
        if (opts.shouldStop && await opts.shouldStop()) { stopped = true; break }
        // فاز ۳۴۴ح — برداشت «بعد از» همهٔ awaitها و با چکِ دوباره (مسابقهٔ کارگرها).
        if (next >= pending.length) break
        const item = pending[next++]
        if (!item) break
        const ok = await ask(item)
        if (!ok) { aiStats.failedBatches++; failStreak++ } else failStreak = 0
        doneCount++
        try { opts.onCluster?.(doneCount, chunksTotal) } catch {}
        if (failStreak >= 8) { if (!aiStats.gaveUp) console.log('[roster] AI failed 8 ads in a row — این پاس متوقف شد'); aiStats.gaveUp = true; stopped = true }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, pending.length) }, worker))
    if (opts.shouldStop && await opts.shouldStop()) return { ...base, agencyName: name, error: 'متوقف شد' }
    // فاز ۳۴۶ه (فیدبکِ مالک: «شفیعی را تأیید کردم، همگام‌سازی زدم، هیچ افاقه‌ای نمی‌کند — چیزی که درست کار می‌کرد را چرا خراب می‌کنی؟»)
    // — نسخهٔ ۳۴۶ تا وقتی AI «همهٔ» آگهی‌ها را نخوانده بود فهرست را اصلاً بازنویسی نمی‌کرد؛ پس هیچ تأیید/حذفی اثر نمی‌کرد. حالا فهرست
    // همیشه نوشته می‌شود: آگهیِ نپرسیده با «آخرین جوابِ قبلیِ AI» (از کش، هر نسخه) سرِ جایش می‌ماند و پاسِ بعد ادامهٔ پرسش را می‌دهد.
    aiLeft = pending.filter(p2 => !aiAsked.has(p2.idx)).length
    aiAskedNow = pending.length - aiLeft
    if (aiLeft > 0) {
      for (const p2 of pending) {
        if (aiAsked.has(p2.idx)) continue
        const old = opts.cached?.[p2.row.post.token]?.name
        if (old && !rejectedKeys.has(keyOf(old))) aiMap[p2.idx] = old
      }
      console.log(`[roster] ${slug}: AI ${aiAskedNow}/${pending.length} آگهی را در این پاس خواند — ${aiLeft} مانده (با جوابِ قبلی سرِ جا؛ پاسِ بعد ادامه)`)
    }
  }

  const clusters = new Map<string, RosterAdvisor>()
  const fileCount = new Map<string, number>()
  const unnamed: { tokens: string[]; posts: BrandPost[] } = { tokens: [], posts: [] }
  rows.forEach((r, idx) => {
    let raw = String(aiMap[idx] || '').replace(/\s+/g, ' ').trim()
    const occurs = (n: string) => nameOccurrences(n.split(' ').map(w => keyOf(w).toLowerCase()).filter(Boolean), r.descLines).length > 0
    // تنها بررسی (برای جوابِ AI): ضدِ توهم — نام باید واژه‌به‌واژه در متن باشد. حکمِ ادمین (manual) معاف است.
    let ok = !!raw && (manualIdx.has(idx) || occurs(raw))
    if (raw && !ok) nameCounts.aiRejected++
    // فاز ۳۴۶ج — نامی که ادمین در همین آژانس حذف کرده، دیگر هرگز مشاور نمی‌شود (جز با تأییدِ صریحِ همان آگهی).
    if (ok && !manualIdx.has(idx) && rejectedKeys.has(keyOf(raw))) { rejectedByAdmin++; ok = false }
    // فاز ۳۴۶و — نامِ محله (از گازِتیرِ محله‌های سایت + محلِ آگهی‌های همین آژانس) یا تکه‌ای از نامِ آژانس، نامِ مشاور نیست.
    if (ok && !manualIdx.has(idx) && isPlaceName(raw)) { placeRejected++; ok = false }
    // فاز ۳۴۶د (فیدبکِ مالک: «کلی امیر پاشا هست، باید دونه‌دونه بزنم؟ قبلاً با یک کلیک مشاور می‌ساخت یا ادغام می‌کرد») — نامی که ادمین
    // در همین آژانس «تأیید» کرده، هر آگهیِ همین آژانس را که AI برایش نامی نداد (یا نامش رد شد) و این نام در متنش هست می‌گیرد.
    // جوابِ نام‌دارِ AI را بازنویسی نمی‌کند، و فقط داخلِ همین آژانس است (نه فهرستِ سفیدِ سراسریِ قدیمی که «سند آزاد» را هم می‌گرفت).
    let viaConfirmed = false
    if (!ok && !manualIdx.has(idx)) { const hit = confirmedList.find(occurs); if (hit) { raw = hit; ok = true; viaConfirmed = true; byConfirmed++ } }
    if (!ok) { unnamed.tokens.push(r.post.token); unnamed.posts.push(r.post); return }
    nameCounts.aiNamed++
    const k = keyOf(raw)
    fileCount.set(k, (fileCount.get(k) || 0) + 1)
    let c = clusters.get(k)
    if (!c) { c = { key: k, name: raw, tokens: [], posts: [], src: { ai: 0, sig: 0, machine: 0, claim: 0 } }; clusters.set(k, c) }
    if (!c.evidence) { const ks = raw.split(' ').map(w => keyOf(w).toLowerCase()).filter(Boolean); const line = r.desc.split(/[\n\r]+/).find(l => nameOccurrences(ks, textLines(l)).length > 0); if (line) c.evidence = deEmoji(line).replace(/\s+/g, ' ').trim().slice(0, 90) }
    c.src![manualIdx.has(idx) || viaConfirmed ? 'sig' : 'ai']++   // sig = فاز ۳۴۶ب/د: تأییدِ ادمین (همین آگهی یا نامِ تأییدشدهٔ آژانس)
    c.tokens.push(r.post.token); c.posts.push(r.post)
  })

  // ادغامِ «نامِ کوتاه» در «نامِ کامل» («محمد» ↔ «محمد پرنده»، «حسنی‌منش» ↔ «وحید حسنی‌منش») — تشخیصِ نام نیست، فقط یکی‌کردنِ
  // دو صورتِ نامِ «همان» آدم که AI داده. فقط وقتی دقیقاً یک میزبان باشد؛ مشاورِ حساب‌دار (pinned) همیشه میزبان می‌ماند.
  const pinned = new Set(opts.pinnedKeys || [])
  const mergeInto = (small: RosterAdvisor, host: RosterAdvisor) => {
    if (small.src && host.src) for (const k2 of ['ai', 'sig', 'machine', 'claim'] as const) host.src[k2] += small.src[k2]
    host.tokens.push(...small.tokens); host.posts.push(...small.posts)
    fileCount.set(host.key, (fileCount.get(host.key) || 0) + (fileCount.get(small.key) || 0))
    clusters.delete(small.key)
    console.log(`[roster] merged «${small.name}» → «${host.name}» (${small.tokens.length} فایل)`)
  }
  for (const [k, c] of [...clusters]) {
    if (!clusters.has(k)) continue
    const hosts = [...clusters.values()].filter(m => {
      if (m.key === k || m.key.length <= k.length) return false
      const rest = m.key.startsWith(k) ? m.key.slice(k.length) : m.key.endsWith(k) ? m.key.slice(0, -k.length) : ''
      return rest.length >= 3
    })
    if (hosts.length !== 1) continue
    if (pinned.has(k) && !pinned.has(hosts[0].key)) mergeInto(hosts[0], c)
    else mergeInto(c, hosts[0])
  }

  // ماشین‌لرنینگ «فقط یاد می‌گیرد»: نام‌های AI با وزنِ تعدادِ فایل به واژه‌نامه می‌روند (برای آموزشِ شبانه/آمار)، ولی
  // واژه‌نامه دیگر در هیچ تصمیمی خوانده نمی‌شود.
  for (const c of clusters.values()) { try { await learnName(c.name, 'ai', fileCount.get(c.key) || 1) } catch {} }

  const advisors = [...clusters.values()].sort((a, b) => b.tokens.length - a.tokens.length)
  const byTok = new Map(rows.map(r => [r.post.token, r]))
  const nameStats: NameStats = {
    aiOn: true, model: _aiM || '', rows: rows.length, aiAnswered: aiAsked.size,
    aiNamed: nameCounts.aiNamed, aiRejected: nameCounts.aiRejected,
    byAI: advisors.reduce((t, a) => t + (a.src?.ai || 0), 0), bySig: advisors.reduce((t, a) => t + (a.src?.sig || 0), 0), byMachine: 0, byClaim: 0, unnamed: unnamed.tokens.length,
    skippedSig: 0, failedBatches: aiStats.failedBatches, gaveUp: aiStats.gaveUp, budgetHit: aiStats.budgetHit,
    metaText, textMissing, aiLeft, aiAskedNow,
    unnamedSigLike: unnamed.tokens.filter(t => { const r = byTok.get(t); return !!r && !!signatureLikeLine(r.desc) }).length,
  }
  console.log(`[roster] names (AI-only): model=${nameStats.model || '-'} answered=${nameStats.aiAnswered}/${nameStats.rows} named=${nameStats.byAI} rejected=${nameStats.aiRejected} adminRejected=${rejectedByAdmin} place=${placeRejected} byConfirmed=${byConfirmed} unnamed=${nameStats.unnamed} unnamedSigLike=${nameStats.unnamedSigLike} meta=${metaText} textMissing=${textMissing}`)
  return { ok: true, slug, agencyName: name, total: posts.length, scanned: rows.length, advisors, unnamed, nameStats }
}

// ── عیب‌یابی: n آگهیِ واقعی را اسکرپ می‌کند و می‌گوید چند تا «متنِ خالی» دارند (واکشیِ دیوار fail
//    شده؟) و چند تا با AI/heuristic اسم گرفتند و چند تا بی‌نام ماندند — با نمونهٔ کاملِ بی‌نام‌ها. ──
export async function debugRoster(slugOrUrl: string, n = 30): Promise<any> {
  const slug = (divarProfileSlug(slugOrUrl) || String(slugOrUrl || '').trim())
  let gapModel = ''
  try { const { model } = resolveAgent(ROSTER_AGENT); gapModel = model || '' } catch { /* بدونِ مدل */ }

  const { posts, name, reason } = await fetchDivarProfileTokens(slug)
  if (!posts.length) return { ok: false, error: reason || 'آگهی‌ای یافت نشد', gapModel }

  const learned = (await knownNames(1)).filter(l => !!strictName(l.name))
  const rows: { i: number; token: string; title: string; desc: string }[] = []
  for (let i = 0; i < Math.min(n, posts.length); i++) {
    const p = posts[i]; let title = p.title || '', desc = ''
    try { const d = await fetchDivarPost(p.token); title = (d.title || title || '').trim(); desc = (d.description || '').trim() } catch {}
    if (isDivarMetaText(desc)) desc = ''
    rows.push({ i, token: p.token, title, desc })
    await sleep(600)
  }

  // AI را دقیقاً مثلِ تولید، دسته‌ایِ ۱۲تایی صدا می‌زنیم و پاسخِ خامِ دستهٔ اول را نگه می‌داریم.
  let aiMap: Record<number, string> = {}, aiError = '', aiRaw = ''
  try {
    for (let i = 0; i < rows.length; i += 12) {
      const chunk = rows.slice(i, i + 12).map(r => ({ i: r.i, title: r.title, desc: r.desc }))
      const res = await aiCanonical(chunk, name)
      Object.assign(aiMap, res.map)
      if (!aiRaw) aiRaw = res.raw
    }
  } catch (e: any) { aiError = String(e?.message || e) }

  let emptyDesc = 0, byAI = 0, byHeur = 0, byLex = 0, unnamed = 0
  const evaluated = rows.map(r => {
    // دقیقاً همان دروازه‌های تولید (فاز ۲۷۵): توکنِ آدرسِ همین آگهی برای هر سه منبع ممنوع است،
    // و اولویت مثلِ خوشه‌بندیِ واقعی AI → lexicon → heuristic است (نه lexicon اول).
    const addr = addressTokens(`${r.title}\n${r.desc}`)
    const lex = validName(lexiconMatch(r.desc, learned), name, addr)
    const heur = extractSignature(r.title, r.desc, name)[0] || ''
    const ai = validName(aiMap[r.i] || '', name, addr)
    const chosen = ai || lex || heur
    if (!r.desc) emptyDesc++
    if (chosen) { if (ai) byAI++; else if (lex) byLex++; else byHeur++ } else unnamed++
    return { token: r.token, title: r.title.slice(0, 70), descLen: r.desc.length, desc: r.desc.replace(/\s+/g, ' '), ai, heuristic: heur, lexicon: lex, address: [...addr].slice(0, 8), chosen }
  })
  // نمونهٔ کاملِ بی‌نام‌ها (تا ۱۲ تا) — با متنِ کامل تا ببینیم چرا اسم پیدا نشد.
  const unnamedSamples = evaluated.filter(e => !e.chosen).slice(0, 12)
    .map(e => ({ token: e.token, descLen: e.descLen, desc: e.desc.slice(0, 900) }))
  return {
    ok: true, agencyName: name, totalAds: posts.length,
    gapModel: gapModel || '(هیچ مدلی برای AI تنظیم نشده)', learnedNames: learned.length, aiError,
    aiRawFirstBatch: (aiRaw || '').slice(0, 800),   // پاسخِ خامِ AI برای دستهٔ اول — تا ببینیم چه برمی‌گرداند
    summary: { sampled: rows.length, emptyDesc, namedByAI: byAI, namedByHeuristic: byHeur, namedByLexicon: byLex, unnamed },
    unnamedSamples,
  }
}
