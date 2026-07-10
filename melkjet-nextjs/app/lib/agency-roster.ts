import { fetchDivarProfileTokens, fetchDivarPost, divarProfileSlug, type BrandPost } from './divar-post'
import { resolveAgent, chatCompleteSafe } from './gapgpt'

// ── خوشه‌بندیِ آگهی‌های یک آژانسِ دیوار به تفکیکِ مشاور، از روی «امضای» داخلِ آگهی ──
// ورودی: لینک/slugِ آژانس. خروجی: هر مشاورِ متمایز (بر اساسِ اسمِ امضاشده) + آگهی‌هایش،
// و سطلِ «بی‌نام» (آگهی‌های بدونِ امضا) که به خودِ آژانس نسبت داده می‌شود.
//
// نکته: شماره از API درنمی‌آید (گِیت است) و شناسهٔ پایدارِ مشاور هم عمومی نیست (contact_uuid
// per-آگهی است). تنها سیگنالِ per-مشاور، «اسمِ امضاشده در متنِ آگهی» است — که همین‌جا با
// heuristic + (اختیاری) AI استخراج و نرمال می‌شود. کلید فقط «برچسبِ گروه‌بندی» است، نه هویتِ جهانی؛
// چون دامنه به یک آژانس محدود است، تصادمِ نام («هزار شایان») بی‌اثر است.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const ZWNJ = /‌/g
// نرمال‌سازیِ کلیدِ خوشه: فارسی → یکدست، لاتین → CAPS، فاصله/نیم‌فاصله حذف.
function keyOf(name: string): string {
  const s = String(name || '').replace(ZWNJ, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
  return /^[A-Za-z]+$/.test(s) ? s.toUpperCase() : s
}

// حروفِ لاتینِ فاصله‌دار را جمع می‌کند: "S H A Y G A N" → "SHAYGAN".
function collapseSpacedLatin(t: string): string {
  return t.replace(/(?:[A-Za-z]\s){2,}[A-Za-z]/g, m => m.replace(/\s+/g, ''))
}

const DECOR = '\\u2728\\u2b50\\u2605\\u2733\\ufe0f\\u2734\\u2795\\u274c\\u2705\\u2666\\ud83d\\udd37\\ud83d\\udd36\\*\\u2022\\u25c6\\u25aa\\u066d'
const STOPWORDS = new Set(['فروش', 'خرید', 'اجاره', 'رهن', 'ملک', 'املاک', 'مشاور', 'کارشناس', 'گروه', 'دپارتمان', 'تخصصی', 'آپارتمان', 'اداری', 'تجاری', 'ویلا', 'مسکونی', 'شما', 'واحد', 'کد', 'وضعیت', 'طبقه', 'سلام', 'احترام', 'قیمت'])

// استخراجِ heuristicِ «امضا» از عنوان + توضیحات. چند کاندیدا برمی‌گرداند (بهترین اول).
export function extractSignature(title: string, desc: string): string[] {
  const raw = collapseSpacedLatin(`${title || ''}\n${desc || ''}`)
  const out: string[] = []
  const push = (s?: string) => { const v = (s || '').trim(); if (v && v.length >= 2 && v.length <= 24 && !out.includes(v)) out.push(v) }

  // ۱) بلوکِ تزئینی: بین دو رشتهٔ نماد ( ✦✦✦ SHAYGAN ✦✦✦ / ✨ MALEKI ✨ / ✴️SHAYAN✴️ )
  const deco = new RegExp(`[${DECOR}]{1,8}\\s*([A-Za-z\\u0622-\\u06cc][A-Za-z\\u0622-\\u06cc]{1,22})\\s*[${DECOR}]`, 'g')
  for (const m of raw.matchAll(deco)) if (!STOPWORDS.has(m[1])) push(m[1])

  // ۲) کلمهٔ لاتینِ زیرخط‌دار/همه‌بزرگ (Mehdi_Abbasi / SHAYGAN)
  for (const m of raw.matchAll(/\b([A-Z][A-Za-z]{2,}(?:_[A-Za-z]{2,})?)\b/g)) push(m[1].replace(/_/g, ' '))

  // ۳) اسمِ فارسی پس از «مشاور/کارشناس/امضا/با شما»
  for (const m of raw.matchAll(/(?:مشاور|کارشناس|امضا|با\s*احترام)\s*[:：\-]?\s*([آ-ی]{2,15}(?:\s+[آ-ی]{2,15})?)/g)) {
    const w = m[1].split(/\s+/).filter(x => !STOPWORDS.has(x)).join(' '); push(w)
  }

  // ۴) اسمِ فارسیِ ابتدای متن (خطِ اول، دو کلمه) اگر stopword نباشد
  const first = (desc || '').split('\n').map(s => s.trim()).find(Boolean) || ''
  const fm = first.match(/^([آ-ی]{2,15})\s+([آ-ی]{2,15})/)
  if (fm && !STOPWORDS.has(fm[1]) && !STOPWORDS.has(fm[2])) push(`${fm[1]} ${fm[2]}`)

  return out
}

// (اختیاری) پالایشِ AI: نامِ کانونیِ مشاورِ هر آگهی را برمی‌گرداند (فارسی؛ خالی اگر امضا نبود).
// دسته‌ای صدا زده می‌شود تا هزینهٔ AI کم بماند. اگر مدل نبود/خطا داد → [] (تکیه بر heuristic).
async function aiCanonical(items: { i: number; title: string; desc: string }[]): Promise<Record<number, string>> {
  const { model, provider } = resolveAgent([['content', 'text'], ['chat', 'text']])
  if (!model) return {}
  const list = items.map(it => `${it.i}) ${(it.title || '').slice(0, 60)} :: ${(it.desc || '').replace(/\s+/g, ' ').slice(0, 180)}`).join('\n')
  const sys = 'تو نامِ «مشاور/آگهی‌کنندهٔ» هر آگهیِ ملکی را از متن درمی‌آوری. فقط نامِ شخص (فارسی، حداکثر ۲ کلمه) یا نامِ برندِ امضا. اگر امضایی نبود، خالی بگذار. خروجی فقط JSON: [{"i":<شماره>,"name":"<نام یا خالی>"}]'
  const out = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: list }], { temperature: 0, max_tokens: 700 }, provider)
  const map: Record<number, string> = {}
  try {
    const j = JSON.parse((out.match(/\[[\s\S]*\]/) || ['[]'])[0])
    for (const r of j) if (r && typeof r.i === 'number' && typeof r.name === 'string' && r.name.trim()) map[r.i] = r.name.trim()
  } catch {}
  return map
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
  opts: { useAI?: boolean; maxDetails?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<AgencyRoster> {
  // توکنِ برندِ دیوار حساس به بزرگ/کوچکیِ حروف است — هرگز lowercase نکن.
  const slug = (divarProfileSlug(slugOrUrl) || String(slugOrUrl || '').trim())
  const base: AgencyRoster = { ok: false, slug, total: 0, scanned: 0, advisors: [], unnamed: { tokens: [], posts: [] } }
  if (!slug || !/^[A-Za-z0-9_-]{2,}$/.test(slug)) return { ...base, error: 'slug/لینکِ برند نامعتبر است' }

  const { posts, name, reason } = await fetchDivarProfileTokens(slug)
  if (!posts.length) return { ...base, agencyName: name, error: reason === 'unreachable' ? 'به دیوار نرسید (پروکسی؟)' : 'آگهی‌ای یافت نشد' }

  const maxDetails = Math.max(1, Math.min(opts.maxDetails ?? 300, posts.length))
  // برای هر آگهی: عنوان + توضیحات را می‌گیریم و کاندیدای امضا را می‌سازیم.
  const rows: { post: BrandPost; title: string; desc: string; cand: string[] }[] = []
  for (let i = 0; i < maxDetails; i++) {
    const p = posts[i]
    let title = p.title || '', desc = ''
    try { const d = await fetchDivarPost(p.token); title = (d.title || title || '').trim(); desc = (d.description || '').trim() } catch {}
    rows.push({ post: p, title, desc, cand: extractSignature(title, desc) })
    try { opts.onProgress?.(i + 1, maxDetails) } catch {}
    await sleep(300)   // throttle تا از دیوار بلاک نشویم
  }

  // پالایشِ AI (اختیاری) — نامِ کانونی جای بهترین کاندیدای heuristic را می‌گیرد.
  let aiMap: Record<number, string> = {}
  if (opts.useAI !== false) {
    for (let i = 0; i < rows.length; i += 12) {
      const chunk = rows.slice(i, i + 12).map((r, k) => ({ i: i + k, title: r.title, desc: r.desc }))
      try { Object.assign(aiMap, await aiCanonical(chunk)) } catch {}
    }
  }

  // خوشه‌بندی
  const clusters = new Map<string, RosterAdvisor>()
  const unnamed: { tokens: string[]; posts: BrandPost[] } = { tokens: [], posts: [] }
  rows.forEach((r, idx) => {
    const chosen = (aiMap[idx] || r.cand[0] || '').trim()
    if (!chosen) { unnamed.tokens.push(r.post.token); unnamed.posts.push(r.post); return }
    const k = keyOf(chosen)
    let c = clusters.get(k)
    if (!c) { c = { key: k, name: chosen, tokens: [], posts: [] }; clusters.set(k, c) }
    c.tokens.push(r.post.token); c.posts.push(r.post)
  })

  const advisors = [...clusters.values()].sort((a, b) => b.tokens.length - a.tokens.length)
  return { ok: true, slug, agencyName: name, total: posts.length, scanned: rows.length, advisors, unnamed }
}
