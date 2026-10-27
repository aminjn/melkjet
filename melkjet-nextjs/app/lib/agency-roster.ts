import { fetchDivarProfileTokens, fetchDivarPost, divarProfileSlug, type BrandPost } from './divar-post'
import { aiFor, resolveAgent, aiActive } from './gapgpt'
import { nameProbSync, NAME_THRESHOLD, corpusCount } from './roster-name-model'
import { bestName, hasSparse as hasSparseModel } from './roster-ner'
import { knownNames, learnName, pruneLearned } from './agency-roster-ml'
import { keyOf, deEmoji, addressTokens, contextNoiseTokens, validName, strictName, bareNameLine, TITLES, isNoiseWord, nameRuleWhitelistRaw, FIRST_NAMES } from './agency-name-lexicon'
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
export function signatureTrusted(title: string, desc: string, agencyName = ''): boolean {
  const ner = bestName(title, desc)
  if (!ner || !ner.trust) return false
  return !!validName(ner.name, agencyName, undefined, { trustPerson: true })
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

export function extractSignature(title: string, desc: string, agencyName = ''): string[] {
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
  const raw = collapseSpacedLatin(`${title || ''}\n${desc || ''}`)

  // ── وایت‌لیستِ مدیریتی: قاطع و مقدم بر همه‌چیز (حتی سکوتِ مدل) ──
  // ادمین صریحاً گفته این نام است؛ پس اگر عینِ نامِ وایت‌لیست (دنبالهٔ واژه‌ها، بی‌حساسیت به
  // فاصله/نیم‌فاصله) در متنِ آگهی بیاید، همان‌جا قطعی برمی‌گردد — پیش از مسیرِ مدل.
  const _wl = nameRuleWhitelistRaw()
  if (_wl.length) {
    const words = raw.split(/[^ء-یA-Za-z]+/).filter(Boolean).map(keyOf)
    const hits: string[] = []
    for (const wname of _wl) {
      const wk = wname.split(/\s+/).filter(Boolean).map(keyOf).filter(Boolean)
      if (!wk.length) continue
      for (let i = 0; i + wk.length <= words.length; i++) {
        if (wk.every((k, j) => k === words[i + j])) { hits.push(wname.replace(/\s+/g, ' ').trim()); break }
      }
    }
    if (hits.length) return [...new Set(hits)]
  }

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
    const v = ner ? validName(ner.name, agencyName, banFree ? undefined : banned, { trustPerson: !!ner.trust }) : ''
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

// (اختیاری) پالایشِ AI: نامِ کانونیِ مشاورِ هر آگهی را برمی‌گرداند (فارسی؛ خالی اگر امضا نبود).
// دسته‌ای صدا زده می‌شود تا هزینهٔ AI کم بماند. اگر مدل نبود/خطا داد → [] (تکیه بر heuristic).
// (exported برای اسکریپتِ کیس‌استادی scripts/roster-casestudy.mjs — فاز ۲۹۷ش)
export async function aiCanonical(items: { i: number; title: string; desc: string }[]): Promise<{ map: Record<number, string>; raw: string }> {
  const { model, provider } = resolveAgent([['content', 'text'], ['chat', 'text']])
  if (!model) return { map: {}, raw: '(هیچ مدلی تنظیم نشده)' }
  // اموجی/نماد را به فاصله تبدیل می‌کنیم تا اسمِ چسبیده به اموجی («♀️محمدی») برای AI هم خوانا شود.
  const clip = (s: string) => { const d = deEmoji(s || '').replace(/\s+/g, ' ').trim(); return d.length > 1200 ? d.slice(0, 300) + ' … ' + d.slice(-800) : d }
  const list = items.map(it => `${it.i}) ${deEmoji(it.title || '').slice(0, 80)} :: ${clip(it.desc)}`).join('\n')
  const sys = 'تو نامِ «فروشنده/مشاور/کارشناسِ فروشِ» هر آگهیِ ملک را از متن درمی‌آوری تا آگهی‌های یک آژانسِ املاک به تفکیکِ مشاور جدا شوند. ' +
    'نکتهٔ مهم: نامِ فروشنده تقریباً همیشه در «انتهای» متن است، بعد از عبارت‌هایی مثلِ «کارشناس فروش»، «مشاور فروش»، «جهت راهنمایی»، «جهت هماهنگی»، «با تشکر». مثال: «کارشناس فروش جهت راهنمایی محمدی» → نام = «محمدی». «مشاور فروش: خانم کامرانی» → «کامرانی». ' +
    'قواعد: (۱) فقط نامِ واقعیِ شخص (فارسی، مثل «علی رضایی» یا «محمدی» یا «مهدی») یا امضای برند (مثل «SHAYGAN»). ' +
    '(۲) هرگز نوعِ ملک/واژهٔ ملکی را برنگردان (آپارتمان، ویلا، پنت‌هاوس، سوییت، کلنگی، متراژ، نوساز و…). ' +
    '(۳) نامِ خودِ آژانس (مثلِ «املاک سعادت») اسمِ مشاور نیست → خالی. ' +
    '(۴) القاب را حذف کن: «خانم رضایی»→«رضایی». «خانم/آقا» به‌تنهایی = خالی. ' +
    '(۵) عبارتِ تبلیغاتی یا قید/صفت («فروش ویژه»، «تضمین بهترین خرید»، «کارشناسی رایگان»، «جهت راهنمایی»، «همین حالا»، «فقط»، «واقعی»، «عکس‌ها تزئینی»، «قطعی»، «مستاجر»، «مالک»، «موجود»، «رزرو») هرگز اسم نیست → خالی. ' +
    '(۶) اگر اسمِ واقعیِ فروشنده در متن نبود، خالی بگذار (حدس نزن). فقط چیزی را برگردان که مطمئنی نامِ یک آدم است؛ کوچک‌ترین تردید = خالی. ' +
    // فاز ۲۷۵ — بزرگ‌ترین منبعِ اسمِ جعلی: نامِ کوچه/خیابان را اسمِ آدم می‌گرفت («بین فلاحی ۴۱ و ۴۳» → «فلاحی»).
    '(۷) نامِ معبر/محله هرگز اسمِ مشاور نیست: هر کلمه‌ای که بعدِ «بین/خیابان/کوچه/بلوار/نبش/میدان/شهرک/فاز/منطقه/پلاک» آمده آدرس است، نه آدم → خالی. مثال: «بین فلاحی ۴۱ و ۴۳» ⇒ «فلاحی» آدرس است. ' +
    '(۸) واژهٔ ملکی/موقعیتی مثلِ «لوکیشن، منطقه، دوخواب، قابل، آزاد، ایرانی، عزیزان، هماهنگی» اسم نیست → خالی. ' +
    'خروجی فقط JSON، بدونِ توضیح: [{"i":<شماره>,"name":"<نام یا خالی>"}]'
  const out = await Promise.race([
    chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: list }], { temperature: 0, max_tokens: 1500 }, provider),
    new Promise<string>(r => setTimeout(() => r('(تایم‌اوت ۳۰ثانیه)'), 30000)),
  ])
  const map: Record<number, string> = {}
  try {
    const j = JSON.parse((out.match(/\[[\s\S]*\]/) || ['[]'])[0])
    for (const r of j) if (r && typeof r.i === 'number' && typeof r.name === 'string' && r.name.trim()) map[r.i] = r.name.trim()
  } catch {}
  return { map, raw: out }
}

export interface RosterAdvisor { key: string; name: string; tokens: string[]; posts: BrandPost[] }
export interface AgencyRoster {
  ok: boolean; error?: string
  slug: string; agencyName?: string
  total: number; scanned: number
  advisors: RosterAdvisor[]
  unnamed: { tokens: string[]; posts: BrandPost[] }   // بدونِ امضا → به خودِ آژانس
}

// ساختِ رُسترِ کامل: همهٔ آگهی‌های آژانس → استخراجِ امضا → خوشه‌بندی.
// throttle‌شده؛ باید روی اینستنسِ ۰ اجرا شود (مثلِ بقیهٔ اسکرپ‌ها).
export async function buildAgencyRoster(
  slugOrUrl: string,
  opts: { useAI?: boolean; maxDetails?: number; onProgress?: (done: number, total: number) => void;
    cached?: Record<string, { title: string; desc: string; name?: string }>;   // توکن→متن + نامِ AI (ازسرگیری)
    pinnedKeys?: string[];   // فاز ۲۷۹ — کلیدِ مشاورهایی که حسابِ واقعی دارند: در ادغام همیشه میزبان می‌مانند
    onRow?: (token: string, r: { title: string; desc: string; name?: string }) => void;
    onCluster?: (done: number, total: number) => void;   // فاز ۱۹۴ — پیشرفتِ فازِ AI هم دیده شود
    f?: { profileTokens?: typeof fetchDivarProfileTokens; post?: typeof fetchDivarPost; ai?: typeof aiCanonical };   // فاز ۱۹۶ — تزریق برای تستِ کاملِ چرخه
    shouldStop?: () => Promise<boolean> } = {},   // فاز ۱۹۶ — دکمهٔ توقف
): Promise<AgencyRoster> {
  // توکنِ برندِ دیوار حساس به بزرگ/کوچکیِ حروف است — هرگز lowercase نکن.
  const slug = (divarProfileSlug(slugOrUrl) || String(slugOrUrl || '').trim())
  const base: AgencyRoster = { ok: false, slug, total: 0, scanned: 0, advisors: [], unnamed: { tokens: [], posts: [] } }
  if (!slug || !/^[A-Za-z0-9_-]{2,}$/.test(slug)) return { ...base, error: 'slug/لینکِ برند نامعتبر است' }

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
  const rows: { post: BrandPost; title: string; desc: string; cand: string[]; addr: Set<string>; trusted: boolean }[] = []
  for (let i = 0; i < maxDetails; i++) {
    if (i % 5 === 0 && opts.shouldStop && await opts.shouldStop()) return { ...base, agencyName: name, error: 'متوقف شد' }
    const p = posts[i]
    let title = p.title || '', desc = ''
    // ازسرگیری فقط اگر متنِ کامل کش شده باشد. کشِ desc-خالی (از دورهٔ پروکسیِ مرده) دوباره گرفته
    // می‌شود تا اسمِ آخرِ متن از دست نرود (باگِ «خانم هرمزی → بی‌نام»).
    const hit = opts.cached?.[p.token]
    if (hit && hit.desc) { title = (hit.title || title || '').trim(); desc = hit.desc.trim() }
    else {
      try { const d = await (opts.f?.post || fetchDivarPost)(p.token); title = (d.title || title || '').trim(); desc = (d.description || '').trim() } catch {}
      try { opts.onRow?.(p.token, { title, desc }) } catch {}   // چک‌پوینت برای ازسرگیری
      await sleep(600)   // نرخِ کندتر تا دیوار زیرِ فشار آگهی‌ها را رد نکند (fetchDivarPost خودش retry هم دارد)
    }
    const txt = `${title}\n${desc}`
    rows.push({ post: p, title, desc, cand: extractSignature(title, desc, name), addr: new Set([...addressTokens(txt), ...contextNoiseTokens(txt)]), trusted: signatureTrusted(title, desc, name) })
    try { opts.onProgress?.(i + 1, maxDetails) } catch {}
  }

  // ── ماشین‌لرنینگ (فلایویل): پیش از فازِ AI، نام‌های «مورد اعتماد» را همین‌جا نسبت بده ──
  // فاز ۲۷۴ (فیدبک: «چرا ماشین‌لرنینگ AI را کم نمی‌کند؟») — ریشه: lexicon فقط بعد از فازِ AI
  // مصرف می‌شد، پس هر آگهی حتی با نامِ آموخته باز به AI می‌رفت. حالا: نامِ تثبیت‌شده (وزن≥۲،
  // یعنی حداقل دوبار دیده/تأییدشده) که در متنِ آگهی باشد، آن آگهی را قطعی نسبت می‌دهد و از AI
  // حذف می‌کند. با هر اجرا مشاورهای پایدار تثبیت می‌شوند → فراخوانِ AI کم و کمتر می‌شود.
  // فاز ۲۷۵ — واژه‌نامهٔ آموخته یک‌بار در هر پروسه از اسم‌های آشغالِ گذشته پاک می‌شود (خودترمیمی؛
  // نسخهٔ زندهٔ تولید «لوکیشن/منطقه/دوخواب/…» را با وزنِ بالا یاد گرفته بود و هر اجرا بازتولید می‌کرد).
  // فاز ۳۲۳ — «ماشین‌لرنینگ از حلقه خارج می‌شود وقتی AIِ خودِ مالک روشن است».
  // فیدبکِ مالک: «دری‌وری‌ها را پاک می‌کنم، همگام می‌کنم، دوباره برمی‌گردند — ماشین‌لرنینگ هنوز
  // تو کار هست». ریشه: نامِ آشغال (چه از heuristic چه از AI) با learnName وزن می‌گرفت و سینکِ
  // بعد «پیش از» qwen از واژه‌نامهٔ آموخته (resolved) بازتولید می‌شد؛ حذفِ رکورد، وزنِ آموخته را
  // پاک نمی‌کرد. حالا با AI روشن: نه resolved، نه lex، نه یادگیری — qwen تنها مرجع است.
  const { model: _aiM, provider: _aiP } = resolveAgent([['content', 'text'], ['chat', 'text']])
  const AI_NAMING = !!_aiM && aiActive('roster', _aiP)
  if (!AI_NAMING && !lexiconPruned) { lexiconPruned = true; try { const p = await pruneLearned(); if (p.length) console.log(`[roster] ML lexicon pruned: ${p.length} junk names (${p.slice(0, 8).join('، ')})`) } catch {} }
  // نام‌های آموخته هم از همان دروازهٔ اعتبار رد می‌شوند (اگر prune به هر دلیل نرسیده باشد).
  // با AI روشن خالی می‌مانند تا واژه‌نامهٔ آلوده روی تصمیم اثر نگذارد.
  const learned = AI_NAMING ? [] : (await knownNames(1)).filter(l => !!strictName(l.name))   // تطبیقِ موضعِ امضا (گیت‌شده با candKeys)
  const trusted = AI_NAMING ? [] : learned.filter(l => l.weight >= 2)  // فقط تثبیت‌شده‌ها مجازند AI را short-circuit کنند
  const resolved: Record<number, string> = {}
  if (!AI_NAMING) rows.forEach((r, idx) => {
    // نامِ آموخته هرجای متن پذیرفته می‌شود جز آن‌جا که توکنِ آدرسِ همین آگهی است.
    const m = validName(lexiconMatch(`${r.title}\n${r.desc}`, trusted), name, r.addr)
    if (m) resolved[idx] = m
  })

  // پالایشِ AI (اختیاری) — نامِ کانونی جای بهترین کاندیدای heuristic را می‌گیرد.
  // فاز ۱۹۴ (فیدبک: «کلاً گیر کرده») — این فاز تا ۴۵ فراخوانِ AI دارد و قبلاً بی‌صدا بود؛ حالا:
  // پیشرفتِ per-chunk + اگر ۳ تکهٔ پیاپی هیچ نامی نداد (AI مرده/کلیدِ خراب) بقیه skip می‌شود
  // (heuristic + نام‌های آموخته‌شده کار را ادامه می‌دهند) + سقفِ ۸ دقیقه برای کلِ فاز.
  // فاز ۳۲۲ — AIِ نام‌گذاری دوباره «قابلِ روشن‌کردن از پنل» شد (بدونِ دیپلوی): مالک می‌تواند مدلِ
  // AIِ خودش را (رویِ سرورِ خودش، سازگار با OpenAI) وصل کند. روشن می‌شود اگر: (۱) اتصالِ AI روشن و
  // بخشِ «نام‌گذاریِ مشاور (روستر)» فعال باشد، (۲) به ایجنتِ محتوا/چت مدلی تخصیص داده شده باشد.
  // اگر هیچ‌کدام تنظیم نشده بود، دقیقاً مثلِ قبل ML-only می‌مانَد (aiCanonical خودش map خالی می‌دهد).
  // مسیر: پنل → API و مدل‌های AI → افزودنِ ارائه‌دهنده (baseUrl+کلید) + تخصیصِ مدل + روشن‌کردنِ بخشِ روستر.
  // (AI_NAMING بالاتر محاسبه شد — پیش از فازِ ML.)
  let aiMap: Record<number, string> = {}
  if (AI_NAMING && opts.useAI !== false) {
    // فاز ۱۹۶ (فیدبک: «شناساییِ AI را دوبار انجام داده، خواندنِ فهرست را ۴ بار») — نامِ AI هم مثلِ متن
    // در کشِ ازسرگیری می‌ماند؛ پاسِ بعدی فقط ردیف‌های نپرسیده را می‌پرسد، نه ۴۵ فراخوانِ تکراری.
    const pending: { idx: number; row: (typeof rows)[number] }[] = []
    rows.forEach((r, idx) => {
      const cachedName = opts.cached?.[r.post.token]?.name
      if (cachedName !== undefined) aiMap[idx] = cachedName
      // AIِ روشن = «حرفِ آخر»: همهٔ ادهای کش‌نشده به AI می‌روند، نه فقط resolvedنشده‌ها. چون
      // واژه‌نامهٔ آموخته (resolved) از پنجرهٔ خرابِ بی‌مدل آلوده شده بود («جهانگرد»ِ ۲۵فایلی)،
      // اگر resolvedها را از AI معاف کنیم آلودگی باقی می‌مانَد. qwen روی سرورِ خودِ مالک است (رایگان).
      else pending.push({ idx, row: r })
    })
    const chunksTotal = Math.ceil(pending.length / 12)
    const aiDeadline = Date.now() + 8 * 60_000
    let emptyStreak = 0, chunkNo = 0
    for (let i = 0; i < pending.length; i += 12) {
      chunkNo++
      if (Date.now() > aiDeadline) { console.log('[roster] AI phase budget hit — continuing without AI'); break }
      if (opts.shouldStop && await opts.shouldStop()) return { ...base, agencyName: name, error: 'متوقف شد' }
      const slice = pending.slice(i, i + 12)
      const chunk = slice.map(p2 => ({ i: p2.idx, title: p2.row.title, desc: p2.row.desc }))
      try {
        const got = (await (opts.f?.ai || aiCanonical)(chunk)).map
        Object.assign(aiMap, got)
        emptyStreak = Object.keys(got).length === 0 ? emptyStreak + 1 : 0
        // چک‌پوینتِ نام‌ها: پرسیده‌شده = ذخیره (نبودِ نام هم با '' ذخیره می‌شود تا دوباره پرسیده نشود)
        for (const p2 of slice) { try { opts.onRow?.(p2.row.post.token, { title: p2.row.title, desc: p2.row.desc, name: got[p2.idx] ?? '' }) } catch {} }
      } catch { emptyStreak++ }
      try { opts.onCluster?.(chunkNo, chunksTotal) } catch {}
      if (emptyStreak >= 3) { console.log('[roster] AI returned nothing 3 chunks in a row — skipping rest (heuristic continues)'); break }
    }
  }

  // خوشه‌بندی — اولویت: (۱) AI، (۲) نامِ مورد اعتمادِ ML (short-circuit)، (۳) lexiconِ موضعِ امضا، (۴) heuristic.
  const clusters = new Map<string, RosterAdvisor>()
  const strongKeys = new Set<string>()   // خوشه‌هایی با «سیگنالِ قویِ نام» — نه حدسِ تنها
  const freshKeys = new Set<string>()     // خوشه‌هایی که این اجرا واقعاً از متن استخراج شدند (نه پژواکِ lexicon)
  const fileCount = new Map<string, number>()   // برای وزن‌دهیِ یادگیری بر اساسِ تعدادِ فایل
  const unnamed: { tokens: string[]; posts: BrandPost[] } = { tokens: [], posts: [] }
  const unnamedIdx: number[] = []   // فاز ۲۸۰ — برای پاسِ دومِ «تعمیمِ کنترل‌شدهٔ واژه‌نامه»
  rows.forEach((r, idx) => {
    // کاندیداهای «موضعِ امضا»یِ همین آگهی (heuristic) — تنها جایی که یک اسم واقعاً امضای مشاور است.
    // نامِ trusted (سیگنالِ قطعیِ شخص) banned/آدرس را دور می‌زند — وگرنه «منطقه خانم اسدی» که
    // «اسدی» را به addr می‌برد، همین‌جا نامِ درست را می‌کُشت و آگهی بی‌نام می‌ماند.
    const cand = r.cand.map(c => validName(c, name, r.trusted ? undefined : r.addr, { trustPerson: r.trusted })).filter(Boolean)
    const candKeys = new Set(cand.map(c => keyOf(c)))
    const lexRaw = validName(lexiconMatch(`${r.title}\n${r.desc}`, learned), name, r.addr)
    // lexicon فقط وقتی معتبر است که نامِ آموخته‌شده در موضعِ امضایِ همین آگهی باشد (جزوِ cand)،
    // نه هر جای متن — وگرنه «ایران/ایرانی» در آدرس، آگهیِ مشاورِ دیگری («لشگری») را می‌دزدد.
    const lex = lexRaw && candKeys.has(keyOf(lexRaw)) ? lexRaw : ''
    // فاز ۲۸۰ — «قانونِ موضع» برای همهٔ منابع، بدونِ استثنا:
    // پیش‌تر دو درِ پشتی باز مانده بود که نامِ آموخته می‌توانست از هرجای متن آگهی را تصاحب کند:
    // (۱) `lexFull` (نامِ چندکلمه‌ای هرجای متن) و (۲) `resolved` (نامِ تثبیت‌شدهٔ ML، بدونِ هیچ
    // شرطِ موضعی). همین دومی باعث شد آگهیِ `gaHRMEeD` — که امضایش «محمد پرنده هستم مشاور» است
    // و کلمهٔ «فلاحی» فقط در **عنوان** («اپارتمان فلاحی 2شخصی ساز…») آمده — به مشاورِ جعلیِ
    // «فلاحی» برسد. یعنی همان باگِ اصلی (خواندن از هرجای متن) در مسیرِ ML زنده مانده بود.
    // حالا هر سه منبع فقط وقتی معتبرند که نام در **موضعِ امضای همین آگهی** باشد.
    // (تعمیمِ کنترل‌شدهٔ واژه‌نامه به آگهی‌های بی‌امضا، پس از خوشه‌بندی و فقط برای مشاورِ
    //  «تثبیت‌شده در همین آژانس» انجام می‌شود — پایین‌تر.)
    const ai = validName(aiMap[idx] || '', name, r.addr)
    const res = resolved[idx] && candKeys.has(keyOf(resolved[idx])) ? resolved[idx] : ''
    // اولویت: AIِ متن‌آگاه → نامِ تثبیت‌شدهٔ ML (در موضعِ امضا) → lexiconِ موضعِ امضا → heuristic.
    // ترتیب عوض شد: استخراجِ متن (که حالا برچسب‌زنِ توکن است) بر واژه‌نامهٔ آموخته
    // مقدم شد. تا امروز `res`/`lex` بالاتر بودند، پس مدل هرگز نوبتش نمی‌رسید و هر سینک
    // همان نام‌های آموختهٔ قدیمی («رگبار»، «کارگزاری») را دوباره می‌چسباند.
    // نقشِ درستِ واژه‌نامه پرکردنِ جای خالی است، نه نقضِ چیزی که از متن خوانده شده.
    // واژه‌نامه از تصمیمِ تک‌آگهی حذف شد. مدل حالا آموخته که در آگهیِ بی‌امضا سکوت
    // کند؛ ولی تا وقتی `res`/`lex` اینجا بودند، همان سکوت را با نامِ آموختهٔ قدیمی
    // («تهاتربااپارتمان»، «چت دیوار») پر می‌کردند و هر سینک آشغال را بازتولید می‌کرد.
    // تعمیمِ واژه‌نامه به آگهی‌های بی‌امضا همچنان پایین‌تر انجام می‌شود، ولی فقط
    // برای مشاورِ «تثبیت‌شده در همین آژانس» — که همان رفتارِ درست است.
    // فاز ۳۲۳ب — تعادل (فیدبک: «qwen خیلی‌ها را بی‌نام کرد و درصد افتاد؛ مدل انگار نمی‌فهمد»):
    // qwen3.8-27b در این استخراج ضعیف است و اغلب خالی برمی‌گرداند، پس «qwenِ تنها» پوشش را می‌کشت.
    // راهِ درست: qwen اولویت دارد، ولی heuristic (استخراجِ امضا) جای خالی را پر می‌کند تا پوشش بالا
    // بماند — دقیقاً مثلِ قبل. تفاوتِ کلیدی با قبل: «واژه‌نامهٔ آموختهٔ تاریخی» و «یادگیری» با AI روشن
    // خاموش‌اند (پایین‌تر)، و همین بود که آشغال را «چسبان» می‌کرد (حذفِ خوشه، وزنِ آموخته را پاک
    // نمی‌کرد و سینکِ بعد بازتولید می‌شد). پس پوشش حفظ می‌شود، بدونِ برگشتِ آشغالِ قدیمی.
    const chosen = ai || cand[0]
    if (!chosen) { unnamed.tokens.push(r.post.token); unnamed.posts.push(r.post); unnamedIdx.push(idx); return }
    const k = keyOf(chosen)
    // «سیگنالِ قوی» = نامِ آموختهٔ تثبیت‌شده در موضعِ امضا، یا توافقِ مستقلِ AI و heuristic.
    // نامِ trusted (امضای قطعیِ شخص) «سیگنالِ قوی» است → از تنزلِ MIN_FILES معاف؛ یک آگهیِ
    // صریحِ «خانم اسدی مشاور» مشاورِ واقعی است، نه نوفهٔ تک‌فایلی.
    if (res || lex || (ai && candKeys.has(keyOf(ai))) || r.trusted) strongKeys.add(k)
    // «تازه» = این اجرا از متن استخراج شد (AI یا heuristic)، نه صرفاً پژواکِ نامِ از قبل آموخته.
    if (ai || cand.length) freshKeys.add(k)
    fileCount.set(k, (fileCount.get(k) || 0) + 1)
    let c = clusters.get(k)
    if (!c) { c = { key: k, name: chosen, tokens: [], posts: [] }; clusters.set(k, c) }
    c.tokens.push(r.post.token); c.posts.push(r.post)
  })

  // ── ادغامِ «نامِ کوتاه» در «نامِ کامل» (فاز ۲۷۷ → بازنویسیِ ۲۷۹) ──
  // فیدبکِ واقعی: «محمد» و «محمدپرنده» دو مشاور شده بودند، «حسنی‌منش» و «وحید حسنی‌منش» هم.
  // علت (تشخیصِ خودِ کاربر): آگهی‌ها گاهی نام را با فاصله می‌نویسند و گاهی بی‌فاصله، و گاهی
  // فقط نامِ کوچک یا فقط فامیل را امضا می‌کنند. پس مقایسه باید روی **کلیدِ بی‌فاصله** باشد،
  // نه روی وجودِ فاصله در نام (نسخهٔ اولِ این ادغام همین اشتباه را داشت و «محمدپرنده»ی
  // بی‌فاصله را اصلاً میزبان حساب نمی‌کرد).
  // قاعده: کلیدِ کوتاه باید پیشوند یا پسوندِ کلیدِ بلند باشد و «باقی‌ماندهٔ» آن ≥۳ حرف —
  // تا «محمد» در «محمدپرنده» ادغام شود ولی در «محمدی» (باقی‌مانده = «ی») هرگز.
  // ایمنی: فقط وقتی **دقیقاً یک** میزبان کاندید باشد؛ و اگر یکی از دو طرف حسابِ واقعی دارد
  // (graduate شده) همان میزبان می‌ماند — وگرنه کلیدِ خوشه عوض می‌شد و فایل‌های مشاورِ واقعی
  // در سینکِ بعدی «غایب» حساب و پاک می‌شدند.
  const pinned = new Set(opts.pinnedKeys || [])
  const mergeInto = (small: RosterAdvisor, host: RosterAdvisor) => {
    host.tokens.push(...small.tokens); host.posts.push(...small.posts)
    fileCount.set(host.key, (fileCount.get(host.key) || 0) + (fileCount.get(small.key) || 0))
    if (strongKeys.has(small.key)) strongKeys.add(host.key)
    if (freshKeys.has(small.key)) freshKeys.add(host.key)
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
    // اگر خوشهٔ کوتاه حسابِ واقعی دارد، جهتِ ادغام برعکس می‌شود (نامِ بلند در کوتاه).
    if (pinned.has(k) && !pinned.has(hosts[0].key)) mergeInto(hosts[0], c)
    else mergeInto(c, hosts[0])
  }

  // ── چرت‌وپرت‌زدایی (فیدبک: «چرت و پرت زیاد میاره») ──
  // یک خوشه فقط وقتی «مشاورِ واقعی» است که یا ≥۲ آگهی امضا کرده باشد (مشاورِ واقعیِ آژانس چند
  // فایل دارد، نه یکی)، یا سیگنالِ قویِ نام داشته باشد. تک‌فایلی‌هایِ با نامِ حدسیِ تنها
  // (همین حالا / فقط / واقعی مستاجر / عکسها تزئینی / قطعی فایل …) → به سطلِ «بی‌نام/آژانس».
  const MIN_FILES = 2
  for (const [k, c] of [...clusters]) {
    if (c.tokens.length >= MIN_FILES || strongKeys.has(k)) continue
    unnamed.tokens.push(...c.tokens); unnamed.posts.push(...c.posts)
    clusters.delete(k)
  }

  // ── پاسِ دوم: تعمیمِ کنترل‌شدهٔ واژه‌نامه به آگهی‌های بی‌امضا (فاز ۲۸۰) ──
  // چرا لازم است: بعضی مشاورها در بعضی آگهی‌ها امضا نمی‌کنند و فقط وسطِ متن نامشان می‌آید
  // («این واحد را رضایی آماده کرده»). قانونِ موضع اینها را بی‌نام می‌کند، که ضرر است.
  // چرا امن است: این تعمیم فقط برای مشاوری مجاز است که **در همین آژانس و همین اجرا** دست‌کم
  // یک آگهیِ امضاشده دارد (خوشه‌اش با سیگنالِ موضعی ساخته شده). پس یک نامِ آموختهٔ خرابِ
  // گذشته («فلاحی») هرگز نمی‌تواند آگهی بگیرد، چون هیچ امضایی در این آژانس ندارد.
  // این جایگزینِ اصولیِ آن دو درِ پشتیِ حذف‌شده است: قدرتِ واژه‌نامه حفظ می‌شود، بی‌آنکه
  // بتواند از هیچ، مشاور بسازد.
  // فاز ۳۲۳ب — این پاس حتی با AI روشن اجرا می‌شود: فقط به خوشه‌های «همین اجرا» (qwen/trusted) تعمیم
  // می‌دهد، نه واژه‌نامهٔ تاریخیِ آلوده — پس آشغالِ قدیمی برنمی‌گردد ولی پوشش بالا می‌رود (آگهیِ بی‌امضای
  // مشاوری که در همین آژانس امضای دیگری دارد، به او می‌چسبد). درخواستِ مالک: «درصدِ تشخیص باید بالا باشد».
  if (unnamedIdx.length && clusters.size) {
    const established = [...clusters.values()].filter(c => strongKeys.has(c.key) || c.tokens.length >= 2)
    const claimed: number[] = []
    for (const idx of unnamedIdx) {
      const r = rows[idx]
      const hit = validName(lexiconMatch(`${r.title}\n${r.desc}`, established.map(c => ({ name: c.name }))), name, r.addr)
      if (!hit) continue
      const host = clusters.get(keyOf(hit))
      if (!host) continue
      host.tokens.push(r.post.token); host.posts.push(r.post)
      fileCount.set(host.key, (fileCount.get(host.key) || 0) + 1)
      claimed.push(idx)
    }
    if (claimed.length) {
      const drop = new Set(claimed.map(i => rows[i].post.token))
      unnamed.tokens = unnamed.tokens.filter(t => !drop.has(t))
      unnamed.posts = unnamed.posts.filter(p2 => !drop.has(p2.token))
      console.log(`[roster] lexicon claimed ${claimed.length} unsigned ads for established advisors`)
    }
  }

  // ── یادگیریِ تدریجی (موتورِ فلایویل) ──
  // فقط از خوشه‌های «بازمانده و تازه‌استخراج‌شدهٔ این اجرا» یاد بگیر، با وزنِ برابرِ تعدادِ فایل:
  // مشاورِ واقعی که چند آگهی امضا کرده سریع به آستانهٔ اعتماد (وزن≥۲) می‌رسد و دفعهٔ بعد بدونِ
  // AI شناخته می‌شود؛ حدسِ تک‌فایلیِ فیلترشده اصلاً یاد گرفته نمی‌شود (نه آلودگی، نه خودتقویتیِ lexicon).
  // با AI روشن اصلاً یاد نمی‌گیریم: qwen هر سینک از نو تصمیم می‌گیرد، و یادگیری همان حلقه‌ای بود
  // که نامِ آشغال را «چسبان» می‌کرد (وزن می‌گرفت و سینکِ بعد بازتولید می‌شد).
  if (!AI_NAMING) for (const c of clusters.values()) {
    if (!freshKeys.has(c.key)) continue   // پژواکِ صرفِ lexicon وزن نمی‌گیرد (از خودتقویتی جلوگیری می‌کند)
    try { await learnName(c.name, 'ai', fileCount.get(c.key) || 1) } catch {}
  }

  const advisors = [...clusters.values()].sort((a, b) => b.tokens.length - a.tokens.length)
  return { ok: true, slug, agencyName: name, total: posts.length, scanned: rows.length, advisors, unnamed }
}

// ── عیب‌یابی: n آگهیِ واقعی را اسکرپ می‌کند و می‌گوید چند تا «متنِ خالی» دارند (واکشیِ دیوار fail
//    شده؟) و چند تا با AI/heuristic اسم گرفتند و چند تا بی‌نام ماندند — با نمونهٔ کاملِ بی‌نام‌ها. ──
export async function debugRoster(slugOrUrl: string, n = 30): Promise<any> {
  const slug = (divarProfileSlug(slugOrUrl) || String(slugOrUrl || '').trim())
  let gapModel = ''
  try { const { model } = resolveAgent([['content', 'text'], ['chat', 'text']]); gapModel = model || '' } catch { /* بدونِ مدل */ }

  const { posts, name, reason } = await fetchDivarProfileTokens(slug)
  if (!posts.length) return { ok: false, error: reason || 'آگهی‌ای یافت نشد', gapModel }

  const learned = (await knownNames(1)).filter(l => !!strictName(l.name))
  const rows: { i: number; token: string; title: string; desc: string }[] = []
  for (let i = 0; i < Math.min(n, posts.length); i++) {
    const p = posts[i]; let title = p.title || '', desc = ''
    try { const d = await fetchDivarPost(p.token); title = (d.title || title || '').trim(); desc = (d.description || '').trim() } catch {}
    rows.push({ i, token: p.token, title, desc })
    await sleep(600)
  }

  // AI را دقیقاً مثلِ تولید، دسته‌ایِ ۱۲تایی صدا می‌زنیم و پاسخِ خامِ دستهٔ اول را نگه می‌داریم.
  let aiMap: Record<number, string> = {}, aiError = '', aiRaw = ''
  try {
    for (let i = 0; i < rows.length; i += 12) {
      const chunk = rows.slice(i, i + 12).map(r => ({ i: r.i, title: r.title, desc: r.desc }))
      const res = await aiCanonical(chunk)
      Object.assign(aiMap, res.map)
      if (!aiRaw) aiRaw = res.raw
    }
  } catch (e: any) { aiError = String(e?.message || e) }

  let emptyDesc = 0, byAI = 0, byHeur = 0, byLex = 0, unnamed = 0
  const evaluated = rows.map(r => {
    // دقیقاً همان دروازه‌های تولید (فاز ۲۷۵): توکنِ آدرسِ همین آگهی برای هر سه منبع ممنوع است،
    // و اولویت مثلِ خوشه‌بندیِ واقعی AI → lexicon → heuristic است (نه lexicon اول).
    const addr = addressTokens(`${r.title}\n${r.desc}`)
    const lex = validName(lexiconMatch(`${r.title}\n${r.desc}`, learned), name, addr)
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
