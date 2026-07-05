import { listAccounts } from './account-store'
import { getDivar } from './advisor-divar-store'
import { getProfile } from './profile-store'
import { fetchDivarProfileTokens, divarProfileSlug } from './divar-post'
import { getAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'
import { urlTypeForRole } from './provider-public'

// ── هوشِ آژانس ─────────────────────────────────────────────────────────────
// دو کار: (۱) خوشه‌بندیِ مشاورهای خودِ ملک‌جت بر اساسِ برندِ دیوارِ مشترک (فوری، بدون تماس با
// دیوار)؛ (۲) تحلیلِ یک برندِ دیوار: تعدادِ آگهی (دقیق) + تخمینِ تعدادِ مشاور از شماره‌های
// متمایز (نمونه‌گیریِ throttle‌شده؛ چون reveal گِیت‌شده است، «حدِ پایین» است نه عددِ قطعی).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface OwnCluster { slug: string; advisors: { phone: string; name: string; type: string }[] }

// همهٔ برند-slugهایِ متصلِ یک حساب (از searchUrlِ منبعِ اصلی + همهٔ منابع).
function slugsOfAccount(phone: string): string[] {
  const out = new Set<string>()
  try {
    const d = getDivar(phone)
    const urls = [d.searchUrl, ...((d.sources || []).map(s => s.searchUrl))].filter(Boolean)
    for (const u of urls) { const s = divarProfileSlug(u); if (s) out.add(s.toLowerCase()) }
  } catch {}
  return [...out]
}

// خوشه‌بندی: مشاورهایی که برندِ دیوارِ مشترک دارند = یک آژانس (روی سمتِ خودمان، بدونِ حدس).
export function ownAdvisorClusters(minAdvisors = 1): OwnCluster[] {
  const by = new Map<string, { phone: string; name: string; type: string }[]>()
  for (const a of listAccounts()) {
    const type = urlTypeForRole(a.role); if (!type) continue   // فقط عرضه‌کنندگانِ خدمت
    const slugs = slugsOfAccount(a.phone); if (!slugs.length) continue
    const gp = getProfile(a.phone)
    const name = (gp.businessName || gp.displayName || a.name || a.phone).trim()
    for (const slug of slugs) { let arr = by.get(slug); if (!arr) { arr = []; by.set(slug, arr) } arr.push({ phone: a.phone, name, type }) }
  }
  return [...by.entries()]
    .map(([slug, advisors]) => ({ slug, advisors }))
    .filter(c => c.advisors.length >= minAdvisors)
    .sort((a, b) => b.advisors.length - a.advisors.length)
}

function proxy(): string | undefined {
  return getAdminData().divar?.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || undefined
}

// شمارهٔ یک آگهی را (best-effort، گِیت‌شده) از دیوار می‌گیرد.
async function revealPhone(token: string): Promise<string | null> {
  const headers = { accept: 'application/json, text/plain, */*', 'user-agent': UA, origin: 'https://divar.ir', referer: 'https://divar.ir/', 'x-standard-divar-error': 'true' }
  for (const url of [`https://api.divar.ir/v8/postcontact/web/${token}`, `https://api.divar.ir/v8/posts-v2/web/${token}/contact`]) {
    try {
      const res = await proxiedRequest(url, { method: 'GET', headers, proxyUrl: proxy(), timeout: 12000 })
      if (res.status === 200) { const m = res.body.match(/(?:\+?98|0)9\d{9}/); if (m) { let p = m[0].replace(/^\+?98/, '0'); if (!p.startsWith('0')) p = '0' + p; return p } }
    } catch {}
  }
  return null
}

export interface BrandAnalysis {
  ok: boolean; error?: string
  slug: string; name?: string
  listings: number            // تعدادِ آگهیِ برند (دقیق)
  sampled: number             // چند آگهی برای reveal نمونه‌گیری شد
  revealed: number            // چند شماره واقعاً reveal شد (بقیه گِیت بودند)
  distinctPhones: number      // شماره‌های متمایز = تخمینِ حدِ پایینِ مشاور
  phones: string[]
}

// تحلیلِ یک برندِ دیوار (slug یا لینکِ pro). sample = چند آگهی برای شمارش‌شماره reveal شود.
export async function analyzeBrand(slugOrUrl: string, sample = 20): Promise<BrandAnalysis> {
  const slug = (divarProfileSlug(slugOrUrl) || String(slugOrUrl || '').trim()).toLowerCase()
  const base: BrandAnalysis = { ok: false, slug, listings: 0, sampled: 0, revealed: 0, distinctPhones: 0, phones: [] }
  if (!slug || !/^[a-z0-9_-]{2,}$/.test(slug)) return { ...base, error: 'slug/لینکِ برند نامعتبر است' }

  const { posts, name, reason } = await fetchDivarProfileTokens(slug)
  if (!posts.length) return { ...base, name, error: reason === 'unreachable' ? 'به دیوار نرسید (پروکسی؟)' : 'آگهی‌ای یافت نشد' }

  const cap = Math.max(0, Math.min(Number(sample) || 0, 40))   // سقفِ نمونه‌گیری (reveal کند و گِیت است)
  const phones = new Set<string>()
  let revealed = 0
  for (let i = 0; i < cap && i < posts.length; i++) {
    const ph = await revealPhone(posts[i].token)
    if (ph) { revealed++; phones.add(ph) }
    await sleep(500)   // throttle تا از دیوار بلاک نشویم
  }
  return { ok: true, slug, name, listings: posts.length, sampled: Math.min(cap, posts.length), revealed, distinctPhones: phones.size, phones: [...phones] }
}
