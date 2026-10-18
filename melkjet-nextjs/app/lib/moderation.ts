import { pendingForModeration, setModeration, setModerationBatch, listItems, type Item, type ItemStatus } from './scraper-store'
import { aiFor, agentModel } from './gapgpt'
const { chatCompleteSafe } = aiFor('بازبینیِ خودکارِ آگهی')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI
import { predict, learn, learnBatch, noteDecision, explainPrediction, rejectEvidenceOf, contactEvidenceOf, correctFromAdmin, recentAccuracy, type MLabel } from './moderation-ml'
import { getAdminData } from './admin-store'
import { buildDupIndex, dupMasterInIndex, type DupIndex } from './listing-dedupe'
import { FA_DIGITS, faDigit } from './digits'

export type ModVia = 'ml' | 'ai' | 'dup' | 'rule' | 'none'

const DUP_REASON = 'آگهیِ تکراری — مشابهِ یک آگهیِ منتشرشدهٔ دیگر (تشخیصِ خودکار)'

// فاز ۳۰۰د — چکِ منطقیِ مقدار (قطعی، پیش از ML/AI): آگهیِ با مقادیرِ نامعقول هرگز نباید خودکار
// تأیید شود (متراژِ ۵متری، ودیعهٔ نجومی، سالِ ساختِ آینده). خروجی = فهرستِ ایرادها (خالی = سالم).
export function listingSanityIssues(it: Item): string[] {
  if (it.type !== 'listing') return []
  const issues: string[] = []
  const m = (it.meta || {}) as Record<string, string>
  const toEn = (s?: string) => String(s || '').replace(FA_DIGITS, faDigit)
  const deal = String(m['نوع معامله'] || '')
  if (m['متراژ']) { const area = parseInt(toEn(m['متراژ']).replace(/\D/g, ''), 10); if (Number.isFinite(area) && (area < 8 || area > 100000)) issues.push(`متراژِ نامعقول (${m['متراژ']})`) }
  if (!/پیش/.test(deal)) {   // پیش‌فروش می‌تواند سالِ تحویلِ آینده داشته باشد
    const yr = parseInt(toEn(m['سن بنا'] || m['سال ساخت'] || '').replace(/\D/g, ''), 10)
    const curY = new Date().getFullYear() - 621   // تقریبِ سالِ شمسی
    if (Number.isFinite(yr) && yr >= 1300 && yr <= 1600 && yr > curY) issues.push(`سالِ ساختِ آینده (${m['سن بنا'] || m['سال ساخت']})`)
  }
  // هر عددِ ≥ ۱۰۰۰ میلیارد تومان در قیمت/ودیعه/اجاره تقریباً همیشه غلط/اسپم است.
  // جداکننده‌های هزارگان (، ٬ ,) اول پاک می‌شوند وگرنه هر گروهِ ۳رقمی جدا دیده می‌شد.
  const nums = (toEn(String(it.price || '')).replace(/[,٬،]/g, '').match(/\d{4,}/g) || []).map(n => Number(n))
  if (nums.some(n => Number.isFinite(n) && n >= 1e12)) issues.push('قیمتِ نجومی/غیرواقعی')
  return issues
}

// معیارهای پیش‌فرض (اگر ادمین چیزی تعریف نکرده باشد).
export const DEFAULT_CRITERIA = `- آگهیِ معتبر: عنوانِ روشن، قیمتِ مشخص و واقعی، موقعیت و توضیحاتِ کافی → امتیازِ بالا.
- رد: آگهیِ تکراری، اسپم/تبلیغ، قیمتِ به‌وضوح غیرواقعی، اطلاعاتِ خیلی ناقص، محتوای نامرتبط → امتیازِ پایین.
- امتیاز (۰ تا ۱۰۰): هرچه آگهی کامل‌تر، معتبرتر و باکیفیت‌تر باشد، امتیازِ بالاتر بده.`

export interface ModConfig {
  criteria: string; approveMin: number; rejectMax: number; requirePrice: boolean; priceMissing: 'reject' | 'review'; autoMl: boolean; autoRejectContact: boolean
  // فاز ۱۴۹ — اختیارِ اکتسابیِ ردِ ML: 'off' هرگز | 'cautious' فقط با نشانهٔ ساختاری | 'full' هر وقت مطمئن بود
  mlRejectMode: 'off' | 'cautious' | 'full'
  mlRejectMin: number          // حداقلِ اطمینانِ مدل برای ردِ خودکار (٪)
  mlRejectAgreeMin: number     // حداقلِ دقتِ اخیرِ اندازه‌گیری‌شده روی داوریِ ادمین (٪)
  mlRejectReviewedMin: number  // حداقل تعدادِ بازبینیِ انسانی که دقت رویش سنجیده شده
  // فاز ۳۰۳هـ — سرنوشتِ «آگهیِ نامطمئن» (از گِیت‌های سلامت/تکرار/تماس گذشت، ولی مدل به تصمیمِ
  // قطعی نرسید): 'approve' = تأییدِ خودکار (پیش‌فرض — دیگر هیچ «منتظرِ» ابدی نمی‌ماند؛ آشغال را
  // جداگانه گِیتِ سلامت رد می‌کند)، 'review' = صفِ بازبینیِ انسانی (رفتارِ قبلی).
  pendingPolicy: 'approve' | 'review'
}

// خواندنِ معیارها از تنظیماتِ ادمین (با پیش‌فرض‌های امن).
export function modConfig(): ModConfig {
  const m = getAdminData().moderation || {}
  return {
    criteria: (m.criteria && m.criteria.trim()) ? m.criteria : DEFAULT_CRITERIA,
    approveMin: typeof m.approveMin === 'number' ? m.approveMin : 70,
    rejectMax: typeof m.rejectMax === 'number' ? m.rejectMax : 40,
    requirePrice: !!m.requirePrice,
    priceMissing: m.priceMissing === 'review' ? 'review' : 'reject',
    autoMl: m.autoMl !== false,
    // فاز ۱۳۸: ردِ خودکارِ شماره/لینک/آیدیِ تماس در متن (مدرکِ قطعی با نقلِ تکه) — knobِ زندهٔ ادمین
    autoRejectContact: (m as any).autoRejectContact !== false,
    // فاز ۱۴۹ — اختیارِ اکتسابیِ ردِ ML (پیش‌فرض: محتاط)
    mlRejectMode: (['off', 'cautious', 'full'].includes((m as any).mlRejectMode) ? (m as any).mlRejectMode : 'cautious') as 'off' | 'cautious' | 'full',
    mlRejectMin: typeof (m as any).mlRejectMin === 'number' ? (m as any).mlRejectMin : 97,
    mlRejectAgreeMin: typeof (m as any).mlRejectAgreeMin === 'number' ? (m as any).mlRejectAgreeMin : 85,
    mlRejectReviewedMin: typeof (m as any).mlRejectReviewedMin === 'number' ? (m as any).mlRejectReviewedMin : 20,
    pendingPolicy: (m as any).pendingPolicy === 'review' ? 'review' : 'approve',
  }
}

function buildSys(criteria: string): string {
  return `تو ناظر آگهی‌های املاک در ملک‌جت هستی. بر اساسِ «معیارها» هر آگهی را بررسی کن و فقط یک JSON معتبر برگردان:
{"verdict":"approve|reject|review","score":0-100,"reason":"علت کوتاه فارسی (یک جمله)"}
معیارها:
${criteria}
توجهِ مهم: عبارت‌های بازاریابیِ رایجِ آگهی‌های واقعی مثل «گولِ آگهی‌های فیک را نخورید»، «قیمتِ واقعی»، «بدونِ واسطه» ادعای اصالتِ خودِ آگهی‌اند، نه نشانهٔ تقلب — به‌خاطرِ خودِ این عبارت‌ها reject نده. reject فقط با نشانهٔ واقعی: تناقضِ جدیِ قیمت/مشخصات، شماره/لینکِ تماس داخلِ متن برای دورزدنِ سایت، یا محتوای نامرتبط با املاک. اگر مطمئن نیستی review بده، نه reject.
همیشه reason را پر کن و امتیاز را دقیق و منصفانه بده.`
}

// تبدیلِ پاسخِ مدل به تصمیم — تصمیم بر اساسِ «آستانه‌های امتیازِ» قابلِ‌تنظیمِ ادمین گرفته می‌شود.
// فاز ۱۳۸: settled = این pending یک «تصمیمِ آگاهانهٔ ارجاع به بازبینیِ انسانی» است (با دلیل، ماندگار می‌شود
// و از صفِ خودکار خارج) — نه خطای گذرا که باید تیکِ بعدی دوباره امتحان شود.
function judge(text: string, cfg: ModConfig, hasPrice: boolean): { status: ItemStatus; reason: string; score: number; settled: boolean } {
  let t = text
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0]
  try {
    const d = JSON.parse(t)
    const score = Math.max(0, Math.min(100, Number(d.score) || 0))
    const reason = String(d.reason || '').slice(0, 200)
    // قانونِ سختِ «قیمت الزامی است»
    if (cfg.requirePrice && !hasPrice) {
      return { status: cfg.priceMissing === 'review' ? 'pending' : 'rejected', reason: reason || 'قیمت مشخص نیست', score, settled: true }
    }
    // آستانه: امتیاز ≥ approveMin → تأیید، ≤ rejectMax → رد، بین این‌دو → بسته به سیاستِ «نامطمئن».
    let status: ItemStatus = score >= cfg.approveMin ? 'approved' : score <= cfg.rejectMax ? 'rejected' : 'pending'
    // فاز ۳۰۳هـ — «نامطمئنِ» بینِ دو آستانه هم با سیاستِ approve تأیید می‌شود (نه pendingِ ابدی).
    if (status === 'pending' && cfg.pendingPolicy === 'approve') {
      return { status: 'approved', reason: `تأییدِ خودکار — امتیازِ AI بینِ دو آستانه (${score})${reason ? `: ${reason}` : ''}`, score, settled: true }
    }
    return { status, reason: status === 'pending' ? `در صفِ بازبینیِ انسانی — امتیازِ AI بینِ دو آستانه (${score})${reason ? `: ${reason}` : ''}` : reason, score, settled: true }
  } catch { return { status: 'pending', reason: 'پاسخ نامعتبر مدل', score: 0, settled: false } }
}

export function moderationModel(): string | null {
  return agentModel('moderation', 'text') || agentModel('chat', 'text') || agentModel('pricing', 'text') || null
}
// فاز ۲۶۶ — آگهیِ ثبت‌شدهٔ کاربر باید «واقعاً» توسطِ AI ممیزی شود (تأیید/رد)، نه اینکه چون مدلی
// تخصیص داده نشده در صفِ pending گیر کند. اگر مدلی ست نشده، از مدلِ مطمئنِ پیش‌فرض استفاده می‌شود.
// (برخلافِ ممیزیِ دسته‌ایِ آگهی‌های اسکرپ‌شده که برای صرفه‌جویی به AI تکیه نمی‌کند.)
export function userSubmitModel(): string { return moderationModel() || 'gpt-4o-mini' }

// AI verdict for one item (read-only — does NOT persist).
async function getVerdict(it: Item, model: string, cfg: ModConfig) {
  const info = `عنوان: ${it.title}\nقیمت: ${it.price || '-'}\nموقعیت: ${it.location || '-'}\nتوضیحات: ${(it.excerpt || '').slice(0, 600)}`
  try {
    const out = await chatCompleteSafe(model, [{ role: 'system', content: buildSys(cfg.criteria) }, { role: 'user', content: info }], { temperature: 0.2, max_tokens: 120 })
    return { id: it.id, title: it.title, ...judge(out, cfg, !!(it.price && String(it.price).trim())) }
  } catch (e: any) {
    return { id: it.id, title: it.title, status: 'pending' as ItemStatus, reason: e?.message || 'خطا', score: 0, settled: false }
  }
}

// تصمیمِ هوشمند برای یک آگهی: اول مدلِ یادگیرنده؛ اگر آماده و مطمئن بود خودش تصمیم می‌گیرد
// (بدونِ AI). وگرنه AI تصمیم می‌گیرد و مدل از تصمیمش یاد می‌گیرد. (persist نمی‌کند.)
async function smartVerdict(it: Item, model: string | null, dupIndex?: DupIndex): Promise<{ id: string; title: string; status: ItemStatus; reason: string; score: number; via: ModVia; settled?: boolean }> {
  const cfg = modConfig()
  // گِیتِ تکرار (قطعی، پیش از ML/AI): آگهیِ تکراری هرگز منتشر نشود.
  if (it.type === 'listing') {
    const idx = dupIndex || await buildDupIndex()
    const master = dupMasterInIndex(it, idx)
    if (master) return { id: it.id, title: it.title, status: 'duplicate', score: 100, via: 'dup', reason: DUP_REASON, settled: true }
  }
  // فاز ۱۳۸ (فیدبک: «به‌خاطرِ واژه‌هایی که مشکل نیست رد می‌کند») — ردِ خودکار حالا «فقط» با مدرکِ
  // قطعی و قابلِ‌نمایش انجام می‌شود: شماره/لینک/آیدیِ تماسِ واقعی داخلِ متن، با نقلِ همان تکه در دلیل،
  // تا ادمین دقیقاً ببیند چه چیزی رد را رقم زد. قاعدهٔ قطعی است، نه احتمالِ واژه‌محورِ مدل.
  if (cfg.autoRejectContact) {
    const contact = contactEvidenceOf(it)
    if (contact.length) {
      return { id: it.id, title: it.title, status: 'rejected', score: 100, via: 'rule', settled: true,
        reason: `ردِ خودکار (قاعدهٔ تماس در متن): ${contact.join(' · ')} — تماس باید از طریقِ خودِ سایت انجام شود` }
    }
  }
  // فاز ۳۰۳ — گِیتِ منطقِ مقدار: مقادیرِ به‌وضوح نامعقول (متراژِ ۵متری، قیمتِ نجومی، سالِ آینده)
  // «ردِ قطعیِ آنی» می‌گیرند، نه «pendingِ بی‌پایان». درسِ باگ: pending یعنی «منتظرِ انسان»، و
  // چون moderatedAt مهر می‌خورد دیگر از صفِ دسته‌ای هم برنمی‌گردد → ۲ ساعت بی‌حکم می‌ماند. آگهیِ
  // آشغال باید زیرِ ۱ دقیقه حکمِ قطعی بگیرد و صاحبش خبر شود (moderateOne → notifyListingDecision).
  const sane = listingSanityIssues(it)
  if (sane.length) return { id: it.id, title: it.title, status: 'rejected', score: 0, via: 'rule', settled: true, reason: `ردِ خودکار — مقادیرِ نامعقول: ${sane.join('، ')}. اصلاحش کن و دوباره ثبت کن.` }
  const p = predict(it)
  if (p.confident && cfg.autoMl) {
    // فاز ۱۴۹ (فیدبک: «می‌خواهم ML خودش تأیید و رد کند») — «اختیارِ اکتسابیِ رد»: مدل وقتی حقِ ردِ
    // بی‌انسان دارد که (۱) دقتِ اندازه‌گیری‌شده‌اش روی بازبینی‌های انسانیِ اخیر از آستانه بالاتر باشد،
    // (۲) به‌قدرِ کافی بازبینیِ انسانی سنجیده شده باشد، (۳) اطمینانش از آستانهٔ سخت‌گیرانه‌ترِ رد بگذرد؛
    // در حالتِ «محتاط» نشانهٔ ساختاری (نه صرفاً واژه‌ای) هم لازم است. همه knobِ زندهٔ ادمین.
    if (p.label === 'rejected') {
      const ev = rejectEvidenceOf(it)
      const acc = recentAccuracy()
      const conf100 = Math.round(p.prob * 100)
      const trusted = acc.pct != null && acc.reviewed >= cfg.mlRejectReviewedMin && acc.pct >= cfg.mlRejectAgreeMin && conf100 >= cfg.mlRejectMin
      const allowed = cfg.mlRejectMode === 'full' ? trusted : cfg.mlRejectMode === 'cautious' ? (trusted && ev.hard.length > 0) : false
      if (allowed) {
        noteDecision('ml')
        const ex = explainPrediction(it)
        const fa9 = (n: number) => n.toLocaleString('fa-IR')
        return { id: it.id, title: it.title, status: 'rejected', score: conf100, via: 'ml', settled: true,
          reason: `ردِ خودکارِ مدل (اطمینان ${fa9(Math.min(99, conf100))}٪ · دقتِ اخیر روی داوریِ شما ${fa9(acc.pct!)}٪ از ${fa9(acc.reviewed)} بازبینی): ${ex.reasons.length ? ex.reasons.join(' · ') : 'الگوی آگهی‌های ردشدهٔ قبلی'}` }
      }
      const why = cfg.mlRejectMode === 'off' ? 'ردِ خودکارِ مدل خاموش است'
        : acc.pct == null || acc.reviewed < cfg.mlRejectReviewedMin ? `مدل هنوز مجوزِ ردِ خودکار نگرفته (${acc.reviewed.toLocaleString('fa-IR')} از ${cfg.mlRejectReviewedMin.toLocaleString('fa-IR')} بازبینیِ انسانیِ لازم)`
        : acc.pct < cfg.mlRejectAgreeMin ? `دقتِ اخیرِ مدل (${acc.pct.toLocaleString('fa-IR')}٪) زیرِ آستانهٔ ${cfg.mlRejectAgreeMin.toLocaleString('fa-IR')}٪ است`
        : Math.round(p.prob * 100) < cfg.mlRejectMin ? 'اطمینانِ مدل زیرِ آستانهٔ رد است'
        : 'در حالتِ محتاط، نشانهٔ ساختاری (نه صرفاً واژه‌ای) لازم است'
      // فاز ۳۰۳هـ — سیاستِ «نامطمئن»: پیش‌فرض تأییدِ خودکار (نه pendingِ ابدی). آگهی از گِیت‌های
      // سلامت/تکرار/تماس گذشته و مدل به ردِ قطعی نرسیده؛ انباشتِ «منتظرِ» بی‌پایان بدتر از تأیید است.
      if (cfg.pendingPolicy === 'approve') {
        noteDecision('ml')
        return { id: it.id, title: it.title, status: 'approved', score: Math.round(p.prob * 100), via: 'ml', settled: true,
          reason: `تأییدِ خودکار — مدل به ردِ قطعی نرسید و آگهی از گِیت‌های سلامت/تکرار/تماس گذشت (${ev.wordsOnly ? 'شواهدِ ردِ مدل فقط واژه‌ای بود' : ev.hardFa.join('، ')})` }
      }
      return { id: it.id, title: it.title, status: 'pending', score: Math.round(p.prob * 100), via: 'ml', settled: true, reason: ev.wordsOnly
        ? `در صفِ بازبینیِ انسانی — مدل به رد مشکوک است ولی ${why}؛ شواهدش هم فقط واژه‌ای است`
        : `در صفِ بازبینیِ انسانی — نشانهٔ کیفیت/قیمت (${ev.hardFa.join('، ')})؛ ${why}` }
    }
    noteDecision('ml')
    // دلیلِ قابل‌فهم از خودِ محاسبهٔ مدل (توضیح‌پذیری) — هم برای ادمین، هم برای پنلِ کاربر.
    const ex = explainPrediction(it)
    const conf = Math.min(99, Math.round(p.prob * 100)).toLocaleString('fa-IR')
    const reason = `تأییدِ خودکار — ${ex.reasons.length ? ex.reasons.join(' · ') : 'مشابهِ آگهی‌های سالمِ تأییدشده'} (اطمینان ${conf}٪)`
    return { id: it.id, title: it.title, status: 'approved', score: Math.round(p.prob * 100), via: 'ml', reason, settled: true }
  }
  // فاز ۳۱۱ — ممیزیِ خودکار «فقط ML» (خواستِ صریحِ مالک + AIِ گپ مدت‌هاست بی‌اعتبار/مرده).
  // ریشهٔ «خودش اتومات تأیید نمی‌کند»: وقتی مدل به تصمیمِ قطعی نمی‌رسید، getVerdict (AIِ گپ) صدا
  // می‌خورد، شکست می‌خورد (quota) و آگهی را در limboی «pendingِ settled=false» نگه می‌داشت —
  // هر تیک دوباره امتحان و هرگز خالی نمی‌شد. حالا AI از مسیرِ خودکار حذف شد: آگهیِ نامطمئن که
  // از گیت‌های قطعی (تکرار/تماس/سلامت/ردِ مطمئنِ مدل) گذشته، طبقِ pendingPolicy حکمِ «قطعی»
  // می‌گیرد — پیش‌فرض تأییدِ خودکار (settled=true، پس دیگر بی‌پایان در صف نمی‌ماند).
  noteDecision('ml')
  const mlScore = Math.round((p.prob || 0.5) * 100)
  if (cfg.pendingPolicy !== 'review') {
    return { id: it.id, title: it.title, status: 'approved', score: mlScore, via: 'ml', settled: true,
      reason: 'تأییدِ خودکار — از گیت‌های سلامت/تکرار/تماس گذشت و مدل به ردِ قطعی نرسید (فقط ML)' }
  }
  return { id: it.id, title: it.title, status: 'pending', score: mlScore, via: 'ml', settled: true,
    reason: 'در صفِ بازبینیِ انسانی — مدل به تصمیمِ قطعی نرسید (فقط ML)' }
}

// Moderate a single item now (persists immediately). Used for one-off (user submit / single id).
export async function moderateOne(it: Item, model: string | null) {
  const prevStatus = it.status
  const v = await smartVerdict(it, model)
  await setModeration(it.id, v.status, v.reason, v.score)
  // فاز ۳۰۰ج — تأیید/ردِ خودکارِ آگهیِ کاربرساخته → پیامکِ خبر (ربات خودش پیامِ درون‌خطی می‌دهد، پس bot:false).
  if ((v.status === 'approved' || v.status === 'rejected') && it.sourceId === 'user')
    import('./listing-approve-notify').then(m => m.notifyListingDecision({ ...it, status: v.status }, v.status as 'approved' | 'rejected', prevStatus, { sms: true, bot: false })).catch(() => {})
  return v
}

// ممیزیِ «قبل از انتشار» روی فیلدهای خام (بدونِ آیتمِ ذخیره‌شده) — برای آگهیِ مشاور/آژانس.
// excludeId = شناسهٔ آگهیِ عمومیِ فعلیِ همین آگهی (در بازانتشار) تا با نسخهٔ قبلیِ خودش «تکراری» شمرده نشود.
export async function moderateFields(
  fields: { title: string; price?: string; location?: string; excerpt?: string; meta?: Record<string, string> },
  opts?: { excludeId?: string },
): Promise<{ status: ItemStatus; reason: string; score: number; via: ModVia }> {
  // type='listing' تا گِیتِ تکرار فعال شود؛ id=excludeId تا آگهیِ قبلیِ خودِ کاربر رد شود.
  const pseudo = { id: opts?.excludeId || '__prepublish__', type: 'listing', title: fields.title, price: fields.price, location: fields.location, excerpt: fields.excerpt, meta: fields.meta } as Item
  const v = await smartVerdict(pseudo, moderationModel())
  return { status: v.status, reason: v.reason, score: v.score, via: v.via }
}

// دلیلِ قابل‌نمایش: آگهی‌هایی که قبلاً با متنِ عمومیِ «ممیزیِ خودکارِ یادگیری‌شده» ذخیره شده‌اند،
// موقعِ خواندن دلیلِ واقعی‌شان از خودِ مدل بازتولید می‌شود (هم پنلِ ادمین، هم پنلِ کاربر).
export function displayReason(it: Pick<Item, 'title' | 'excerpt' | 'location' | 'price' | 'meta' | 'status' | 'aiReason'>): string {
  const r = it.aiReason || ''
  if (!/ممیزیِ خودکارِ یادگیری/.test(r)) return r
  try {
    // فاز ۱۳۸: برای ردی‌ها «شباهتِ واژه‌ای» هرگز به‌عنوانِ دلیل نمایش داده نمی‌شود — یا مدرکِ قطعیِ
    // تماس را نقل می‌کنیم، یا صادقانه می‌گوییم مدرکِ ساختاری ثبت نشده و قابلِ بازبینیِ دستی است.
    if (it.status === 'rejected') {
      const contact = contactEvidenceOf(it)
      if (contact.length) return `ردِ خودکار (قاعدهٔ تماس در متن): ${contact.join(' · ')}`
      const ex = explainPrediction(it)
      const structural = ex.reasons.filter(x => !x.includes('شباهت به آگهی'))
      return structural.length
        ? `ردشده در ممیزیِ خودکارِ قبلی — نشانه‌ها: ${structural.join(' · ')} (با قانونِ جدید چنین موردی رد نمی‌شود؛ قابلِ بازبینی/تأییدِ دستی)`
        : 'ردشده در ممیزیِ خودکارِ قبلی بدونِ مدرکِ ساختاری — با قانونِ جدید چنین موردی رد نمی‌شود؛ قابلِ بازبینی/تأییدِ دستی'
    }
    const ex = explainPrediction(it)
    if (!ex.reasons.length) return r
    const conf = Math.round(ex.prob * 100).toLocaleString('fa-IR')
    return `تأییدِ خودکار — ${ex.reasons.join(' · ')} (اطمینان ${conf}٪)`
  } catch { return r }
}

// فاز ۱۴۹ (فیدبک: «چطور بهتر آموزش ببیند؟») — آموزشِ یک‌جا از آرشیوِ همهٔ تصمیم‌های موجود:
// هر آگهیِ تأیید/ردشدهٔ فعلیِ سایت (حکمِ ادمین یا AI) در یک نوشتِ دسته‌ای به مدل آموزش داده می‌شود.
export async function trainFromArchive(): Promise<{ approved: number; rejected: number }> {
  const items = await listItems('listing')
  const batch: { it: Item; label: MLabel }[] = []
  let approved = 0, rejected = 0
  for (const it of items) {
    if (it.status === 'approved') { batch.push({ it, label: 'approved' }); approved++ }
    else if (it.status === 'rejected') { batch.push({ it, label: 'rejected' }); rejected++ }
  }
  learnBatch(batch)
  return { approved, rejected }
}

// آموزشِ مدل از تصمیمِ دستیِ ادمین (تأیید/رد) — قوی‌ترین سیگنالِ یادگیری.
// فاز ۷۷: اگر حکمِ قبلیِ سیستم برعکس بود، «یادگیریِ اصلاحی» می‌شود: از کلاسِ غلط unlearn + آموزشِ پروزنِ
// کلاسِ درست + ثبت در پنجرهٔ ارزیابی — تا اصلاحِ دستیِ ادمین واقعاً مدل را برگرداند و قابلِ‌اندازه‌گیری باشد.
export function teachFromAdmin(it: Item, status: ItemStatus, prev?: ItemStatus) {
  if (status !== 'approved' && status !== 'rejected') return
  let prevLabel = prev === 'approved' || prev === 'rejected' ? prev : undefined
  // فاز ۱۴۸ (فیدبک: «با واژهٔ تمیز رد می‌کند، تأیید می‌کنم، باز یاد نمی‌گیرد») — آیتم‌های صفِ بازبینی
  // وضعیتِ pending دارند، پس «برگشتِ تصمیم» تشخیص داده نمی‌شد و unlearn هرگز اجرا نمی‌شد.
  // مبنای درست، اختلافِ «پیش‌بینیِ فعلیِ مدل» با حکمِ ادمین است: مدل رد می‌گفت و ادمین تأیید کرد
  // → اصلاح؛ ویژگی‌های مسموم (مثل «تمیز») از کلاسِ رد unlearn می‌شوند.
  if (!prevLabel) { try { const p = predict(it); if (p.ready && p.label !== status) prevLabel = p.label } catch {} }
  try { correctFromAdmin(it, status, prevLabel) } catch { try { learn(it, status, 'admin') } catch {} }
}

// Run AI calls with limited concurrency (verdicts are read-only; one atomic write at the end).
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]) }
  })
  await Promise.all(workers)
  return out
}

// Moderate all pending items quickly (concurrent verdicts, batched write). Returns total + results.
// مدلِ یادگیرنده اول تلاش می‌کند؛ اگر آماده نبود از AI کمک می‌گیرد و یاد می‌گیرد.
export async function moderatePending(max = 300): Promise<{ moderated: number; results: any[]; error?: string }> {
  const model = moderationModel()   // ممکن است null باشد — مدلِ یادگیرنده می‌تواند بدونِ AI تصمیم بگیرد

  const queue = await pendingForModeration(max)
  // فاز ۳۰۳ز — خود-ترمیمِ انباشتِ «منتظر»: آگهی‌هایی که قبلاً «pending» مهر خورده‌اند (moderatedAt
  // دارند، پس pendingForModeration نادیده‌شان می‌گیرد) هرگز نباید بی‌حکم بمانند. هر تیک تا `max` تا
  // از آن‌ها دوباره حکم می‌گیرند — با سیاستِ جاری (pendingPolicy=approve → نامطمئن تأیید، آشغال رد).
  // این انباشتِ ۸٬۲۵۷تایی را طیِ چند تیک به‌طورِ خودکار و امن تخلیه می‌کند (گِیتِ سلامت همچنان فعال).
  // خود-محدودکننده: پس از تخلیه، آگهیِ pendingِ باقی‌مانده تقریباً صفر است (سیاست فوری تصمیم می‌گیرد).
  // فاز ۳۰۳ی — تخلیهٔ انباشت «به روستر باج می‌دهد»: هر دو روی همان قفلِ FOR UPDATEِ scraper_meta
  // می‌نشینند؛ اگر روستر وسطِ ایمپورت باشد، درینِ بزرگ قفل را نمی‌گیرد و statement_timeout می‌خورد و
  // روستر را هم کندتر می‌کند. پس وقتی روستر در جریان است، انباشت را دست نمی‌زنیم (فقط صفِ freshِ کوچک)؛
  // و در حالتِ آزاد هم فقط ۶۰تا در هر تیک تا قفل را طولانی نگیریم. انباشت در دقایقِ خلوت آرام تخلیه می‌شود.
  let stuck: Item[] = []
  try {
    let rosterBusy = false
    try { const { anyScrapeRunning } = await import('./agency-roster-store'); rosterBusy = await anyScrapeRunning() } catch { /* بی‌خطر */ }
    if (!rosterBusy) {
      const seen = new Set(queue.map(q => q.id))
      stuck = (await listItems('listing')).filter(i => i.type === 'listing' && i.status === 'pending' && !seen.has(i.id)).slice(0, 60)
    }
  } catch { /* اختیاری */ }
  const work = [...queue, ...stuck]
  if (!work.length) return { moderated: 0, results: [] }

  // ایندکسِ تکرار یک‌بار ساخته می‌شود (نه در هر آیتم) — گِیتِ خودکارِ تکرار برای کلِ صف.
  const dupIndex = await buildDupIndex()
  const results = await pool(work, 5, (it) => smartVerdict(it, model, dupIndex))
  // فاز ۱۳۸: علاوه بر تصمیم‌ها (تأیید/رد/تکراری)، «ارجاعِ آگاهانه به بازبینیِ انسانی» (settled pending)
  // هم با دلیلش ذخیره می‌شود — تا (۱) ادمین بداند چرا در صف است و (۲) هر تیکِ کرون دوباره AI خرجش نکند.
  // pendingِ گذرا (خطای مدل/مدلِ تنظیم‌نشده) ذخیره نمی‌شود تا تیکِ بعدی دوباره امتحان شود.
  const decided = results.filter(r => r.status === 'approved' || r.status === 'rejected' || r.status === 'duplicate' || (r.status === 'pending' && r.settled))
  // فاز ۱۵۶ (B2): ممیزیِ خودکار هرگز حکمِ تازهٔ ادمین را بازنویسی نمی‌کند (فقط pendingها).
  // فاز ۳۰۳ز: آلارمِ «آگهیِ تازه» فقط برای صفِ fresh؛ تخلیهٔ انباشتِ قدیمی بی‌صدا (ضدِ سیلِ آلارم).
  const freshSet = new Set(queue.map(q => q.id))
  const v = decided.map(r => ({ id: r.id, status: r.status, reason: r.reason, score: r.score }))
  const freshV = v.filter(x => freshSet.has(x.id)), stuckV = v.filter(x => !freshSet.has(x.id))
  if (freshV.length) await setModerationBatch(freshV, { onlyPending: true })
  if (stuckV.length) await setModerationBatch(stuckV, { onlyPending: true, notifyNew: false })
  // فاز ۲۱۱ (فیدبک: «کاربر نباید آگهیِ بدونِ تحلیل ببیند»): لحظهٔ عمومی‌شدنِ آگهی همین تأیید است —
  // همان لحظه گرم می‌شود (روی اینستنسِ کرون) تا تا اولین بازدید، تحلیل حاضر باشد؛ گرمِ لحظهٔ ثبت
  // ممکن است با دیپلوی مرده باشد.
  // گرم‌کردن فقط برای تأییدِ تازه؛ تخلیهٔ انباشت را گرم نمی‌کنیم تا صفِ غنی‌سازی (و دیوار) سیل نشود —
  // آن‌ها در اولین بازدید تنبل‌وار گرم می‌شوند.
  const approvedIds = decided.filter(r => r.status === 'approved' && freshSet.has(r.id)).map(r => r.id)
  if (approvedIds.length) import('./enrich-warm').then(m => m.warmMany(approvedIds)).catch(() => {})
  // فاز ۳۰۳ — خبرِ تصمیم به صاحبِ آگهیِ کاربرساخته در مسیرِ دسته‌ای هم (نه فقط moderateOne): قبلاً
  // تأیید/ردِ دسته‌ای هیچ پیامک/پیامی به مالک نمی‌فرستاد (فیدبک: «نه پیامک اومد نه ربات گفت»).
  // فاز ۳۰۳ز — خبر فقط برای «ثبتِ تازه» (صفِ fresh)؛ نه برای تخلیهٔ انباشتِ قدیمی. وگرنه درینِ
  // ۸٬۲۵۷تایی که همه از یک شماره‌اند، ۸هزار پیامک/پیام به همان یک شماره می‌فرستد (اسپم + هزینه).
  const ownerDecisions = decided.filter(r => (r.status === 'approved' || r.status === 'rejected') && freshSet.has(r.id))
  if (ownerDecisions.length) {
    const byId = new Map(queue.map(w => [w.id, w]))
    import('./listing-approve-notify').then(m => {
      for (const r of ownerDecisions) {
        const it = byId.get(r.id)
        if (it && it.sourceId === 'user') m.notifyListingDecision({ ...it, status: r.status }, r.status as 'approved' | 'rejected', 'pending', { sms: true, bot: true })
      }
    }).catch(() => {})
  }
  const err = (!model && decided.length === 0) ? 'مدلِ AI تنظیم نشده و دادهٔ یادگیری هنوز کافی نیست' : undefined
  return { moderated: decided.length, results, error: err }
}

// ── ممیزیِ هوش مصنوعیِ نظراتِ مشتریان ───────────────────────────────────────────
const REVIEW_SYS = `تو ناظرِ نظراتِ کاربران در یک سایتِ املاک هستی. نظرِ ثبت‌شده را بررسی کن و فقط یک JSON معتبر برگردان:
{"verdict":"approve|reject","reason":"علتِ کوتاهِ فارسی (یک جمله)"}
approve = نظرِ واقعی، محترمانه و مرتبط با کسب‌وکار/خدمات.
reject = توهین/فحاشی، تبلیغ یا اسپم، شمارهٔ تماس یا لینک، محتوای نامرتبط، یا متنِ بی‌معنی/تکراری.
همیشه reason را پر کن.`

// نتیجهٔ ممیزیِ یک نظر. اگر مدلی تنظیم نشده باشد → 'review' (در انتظارِ تأییدِ دستی).
// فاز ۲۹۷ک — ممیزیِ نظرات دیگر «هیچ» فراخوانِ AI ندارد («قرار بود همه رو ماشین‌لرنینگ انجام
// بده»): قواعدِ قطعی (شماره/لینک/الفاظ) + یادگیرنده‌ای که از داوری‌های واقعیِ ادمین/مالک
// می‌آموزد (review-ml.ts). رایگان، آنی، و مستقل از اعتبارِ گپ.
export async function moderateReview(name: string, text: string): Promise<{ verdict: 'approve' | 'reject' | 'review'; reason: string }> {
  const { classifyReview } = await import('./review-ml')
  return classifyReview(name, text)
}
