import { getAdvisor } from './advisor-store'
import { getAdvisorMembership, listAgencyMembers } from './agency-link-store'
import { aiFor, agentModel } from './gapgpt'
const { chatCompleteSafe } = aiFor('تشخیصِ آگهیِ تکراری')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// تشخیصِ «آگهیِ تکراری» — هنگامِ ثبت/ایمپورتِ آگهی توسط مشاور یا آژانس.
// ابتدا با heuristic (محله/متراژ/قیمت/اتاق/عنوان) نامزد پیدا می‌شود، سپس در صورتِ
// شکِ متوسط با هوش مصنوعی تأیید می‌شود. حوزهٔ بررسی: خودِ کاربر + هم‌آژانسی‌ها + آژانس.

export interface DupCand { deal: string; title: string; location?: string; neighborhood?: string; area?: number; price: number; rooms?: number }
export interface DupExisting extends DupCand { id: string; ownerName: string }
export interface DupResult { isDuplicate: boolean; match?: { id: string; title: string; ownerName: string }; confidence?: 'high' | 'medium' }

function norm(s?: string) { return (s || '').replace(/‌/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() }
function near(a: number, b: number, tol: number) { if (!a || !b) return false; return Math.abs(a - b) / Math.max(a, b) <= tol }
function toks(s?: string) { return new Set(norm(s).split(/[\s,،.\/\-+*]+/).filter(t => t.length > 2)) }
function overlap(a: Set<string>, b: Set<string>) { if (!a.size || !b.size) return 0; let c = 0; for (const t of a) if (b.has(t)) c++; return c / Math.min(a.size, b.size) }

function similarity(x: DupCand, y: DupCand): number {
  if (x.deal !== y.deal) return 0
  let s = 0, w = 0
  const xl = norm(x.neighborhood || x.location), yl = norm(y.neighborhood || y.location)
  if (xl && yl) { w += 0.3; if (xl === yl || xl.includes(yl) || yl.includes(xl)) s += 0.3 }
  if (x.area && y.area) { w += 0.3; if (near(x.area, y.area, 0.06)) s += 0.3 }
  if (x.price && y.price) { w += 0.25; if (near(x.price, y.price, 0.1)) s += 0.25 }
  if (x.rooms != null && y.rooms != null) { w += 0.1; if (x.rooms === y.rooms) s += 0.1 }
  const ov = overlap(toks(x.title), toks(y.title)); w += 0.2; s += 0.2 * ov
  return w ? s / w : 0
}

export async function checkDuplicate(scope: DupExisting[], cand: DupCand, excludeId?: string): Promise<DupResult> {
  const ranked = scope
    .filter(e => e.id !== excludeId)
    .map(e => ({ e, score: similarity(cand, e) }))
    .filter(x => x.score >= 0.6)
    .sort((a, b) => b.score - a.score)
  if (!ranked.length) return { isDuplicate: false }
  const top = ranked[0]
  if (top.score >= 0.85) return { isDuplicate: true, match: { id: top.e.id, title: top.e.title, ownerName: top.e.ownerName }, confidence: 'high' }

  // شکِ متوسط → تأییدِ هوش مصنوعی
  const model = agentModel('chat', 'text') || agentModel('content', 'text')
  if (model) {
    try {
      const out = await chatCompleteSafe(model, [
        { role: 'system', content: 'تو کارشناسِ املاکی. تشخیص بده آیا دو آگهیِ زیر «یک ملکِ واحد» هستند (تکراری) یا دو ملکِ متفاوت. فقط با yes یا no پاسخ بده.' },
        { role: 'user', content: `آگهی ۱: ${cand.title} | ${cand.neighborhood || cand.location || ''} | متراژ ${cand.area || '?'} | اتاق ${cand.rooms ?? '?'} | قیمت ${cand.price}\nآگهی ۲: ${top.e.title} | ${top.e.neighborhood || top.e.location || ''} | متراژ ${top.e.area || '?'} | اتاق ${top.e.rooms ?? '?'} | قیمت ${top.e.price}` },
      ], { temperature: 0, max_tokens: 5 })
      if (/yes|بله|تکرار/i.test(out || '')) return { isDuplicate: true, match: { id: top.e.id, title: top.e.title, ownerName: top.e.ownerName }, confidence: 'medium' }
      return { isDuplicate: false }
    } catch { /* fall through */ }
  }
  if (top.score >= 0.72) return { isDuplicate: true, match: { id: top.e.id, title: top.e.title, ownerName: top.e.ownerName }, confidence: 'medium' }
  return { isDuplicate: false }
}

// آگهی‌های هم‌حوزه برای یک مشاور: خودش + هم‌آژانسی‌ها + آژانس (همگی از advisor-store).
export async function advisorScope(o: string): Promise<DupExisting[]> {
  const out: DupExisting[] = []
  const push = async (phone: string, ownerName: string) => {
    for (const l of (await getAdvisor(phone)).listings) out.push({ id: l.id, ownerName, deal: l.deal, title: l.title, location: l.location, neighborhood: l.neighborhood, area: l.area, price: l.price, rooms: l.rooms })
  }
  await push(o, (await getAdvisor(o)).profile.name || 'شما')
  const m = await getAdvisorMembership(o)
  if (m) {
    for (const mem of await listAgencyMembers(m.agencyPhone)) if (mem.advisorPhone !== o) await push(mem.advisorPhone, mem.advisorName)
    await push(m.agencyPhone, m.agencyName)
  }
  return out
}
