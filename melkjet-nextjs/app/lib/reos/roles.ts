// REOS v2 · Multi-Role Intelligence Layer
// هر نقش «هدفِ» متفاوتی دارد؛ این ماژول همان primitiveهای هستهٔ REOS (embedding/demand/quality/
// freshness/price) را با تابعِ هدفِ نقش‌محور ترکیب می‌کند تا فیدِ هر نقش واقعاً متفاوت باشد
// (نه فیدِ خریدار که همه‌جا کپی شده). Backward-compatible: هستهٔ REOS دست‌نخورده می‌ماند.
import type { PropertyEntity } from './types'
import { demandScore, clamp01, parseFaNum } from './features'

export type RoleKind =
  | 'buyer' | 'owner' | 'pros' | 'agency' | 'builder' | 'materials'
  | 'architect' | 'contractor' | 'appraiser' | 'lawfirm' | 'finance' | 'notary'

export const ROLE_LABELS: Record<RoleKind, string> = {
  buyer: 'خریدار', owner: 'مالک/سرمایه‌گذار', pros: 'مشاور', agency: 'آژانس',
  builder: 'سازنده', materials: 'تأمین‌کنندهٔ مصالح', architect: 'معمار', contractor: 'پیمانکار',
  appraiser: 'کارشناسِ رسمی', lawfirm: 'دفترِ حقوقی', finance: 'بانک/بیمه', notary: 'دفترخانه',
}

// نگاشتِ مسیرِ داشبورد → نقش (کلاینت از pathname می‌سازد).
export function roleFromPath(path: string): RoleKind {
  const seg = (path || '').split('/').filter(Boolean)[0] || 'buyer'
  const map: Record<string, RoleKind> = {
    owner: 'owner', pros: 'pros', agency: 'agency', builder: 'builder', materials: 'materials',
    architect: 'architect', contractor: 'contractor', appraiser: 'appraiser', lawfirm: 'lawfirm',
    finance: 'finance', notary: 'notary', buyer: 'buyer',
  }
  return map[seg] || 'buyer'
}
export function isRoleKind(x: string): x is RoleKind { return x in ROLE_LABELS }

// ── سیگنال‌های مشترک (۰..۱) ──
function quality(p: PropertyEntity): number {
  let q = 0
  if (p.tokens?.length) q += 0.15
  if (p.area) q += 0.2; if (p.rooms) q += 0.15; if (p.price || p.rentMonthly) q += 0.2
  if (p.locationText) q += 0.15; if ((p.features || []).length) q += 0.15
  return clamp01(q)
}
function freshness(p: PropertyEntity): number {
  if (!p.createdAt) return 0.5
  return clamp01(1 - (Date.now() - p.createdAt) / 864e5 / 30)
}
// ارزشِ نسبی: قیمتِ هر مترِ ملک نسبت به میانهٔ بازار (زیرِ میانه = فرصت).
function valueVsMarket(p: PropertyEntity, medianPerM: number): number {
  if (!medianPerM || !p.area || !p.price) return 0.5
  const perM = p.price / p.area
  const ratio = perM / medianPerM              // <1 یعنی ارزان‌تر از بازار
  return clamp01(0.5 + (1 - ratio) / 0.8)      // مرکز ۰.۵؛ ۴۰٪ ارزان‌تر → ۱، ۴۰٪ گران‌تر → ۰ (تخفیفِ واقعی امتیاز می‌گیرد)
}
function landLike(p: PropertyEntity): boolean {
  const t = `${p.ptype || ''} ${(p.tokens || []).join(' ')}`
  return /کلنگ|زمین|مشارکت|ساخت|قدیمی‌ساز|قدیمی ساز/.test(t)
}
function priceBand(p: PropertyEntity, lo: number, hi: number): number {
  const price = p.deal === 'rent' ? (p.rentMonthly || 0) : (p.price || 0)
  if (!price) return 0.3
  if (price >= lo && price <= hi) return 1
  const d = price < lo ? (lo - price) / lo : (price - hi) / hi
  return clamp01(1 - d)
}

export interface RoleCtx { medianPerM?: number; loanBand?: [number, number] }
export interface RoleItem { id: string; score: number; matchPct: number; reasons: string[] }
export interface RoleSection { key: string; label: string; icon: string; items: RoleItem[] }
export interface RoleFeed { role: RoleKind; label: string; sections: RoleSection[] }

// یک بخش را بساز: امتیازده + مرتب‌سازی + برش.
function section(key: string, label: string, icon: string, props: PropertyEntity[], rank: (p: PropertyEntity) => { s: number; why: string[] }, filter: (p: PropertyEntity) => boolean, limit: number): RoleSection {
  const items = props.filter(filter).map(p => { const r = rank(p); return { id: p.id, score: Math.round(r.s * 1000) / 1000, matchPct: Math.round(clamp01(r.s) * 100), reasons: r.why } })
    .sort((a, b) => b.score - a.score).slice(0, limit)
  return { key, label, icon, items }
}

// میانهٔ قیمتِ هر متر از مجموعهٔ کاندیدا (برای ارزشِ نسبی) — self-contained.
export function medianPricePerM(props: PropertyEntity[]): number {
  const arr = props.filter(p => p.area && p.price && p.deal !== 'rent').map(p => p.price! / p.area!).sort((a, b) => a - b)
  return arr.length ? arr[Math.floor(arr.length / 2)] : 0
}

// ── قلبِ Multi-Role: فیدِ نقش‌محور ──
export function buildRoleFeed(role: RoleKind, props: PropertyEntity[], ctx: RoleCtx = {}, limit = 12): RoleFeed {
  const medianPerM = ctx.medianPerM || medianPricePerM(props)
  const label = ROLE_LABELS[role]
  const all = (_p: PropertyEntity) => true
  const S = (key: string, l: string, icon: string, rank: (p: PropertyEntity) => { s: number; why: string[] }, filter: (p: PropertyEntity) => boolean = all) => section(key, l, icon, props, rank, filter, limit)

  switch (role) {
    case 'owner': // مالک/سرمایه‌گذار: بازدهی + ارزشِ زیرِ بازار + تقاضا
      return { role, label, sections: [
        S('invest', 'فرصت‌های سرمایه‌گذاری', '💰', p => { const v = valueVsMarket(p, medianPerM), d = demandScore(p); return { s: 0.5 * v + 0.35 * d + 0.15 * freshness(p), why: [v > 0.6 ? 'قیمتِ زیرِ میانهٔ بازار' : 'قیمتِ بازار', d > 0.6 ? 'پرتقاضا' : ''].filter(Boolean) } }),
        S('hot', 'پرتقاضاهای منطقه', '🔥', p => ({ s: 0.7 * demandScore(p) + 0.3 * quality(p), why: ['تقاضای بالا'] })),
      ] }
    case 'pros': case 'agency': // مشاور/آژانس: فایل‌های داغ برای پیشنهاد به مشتری
      return { role, label, sections: [
        S('pitch', 'فایل‌های داغ برای مشتری', '🎯', p => { const d = demandScore(p), q = quality(p); return { s: 0.45 * d + 0.35 * q + 0.2 * freshness(p), why: [d > 0.6 ? 'تقاضای بالا' : '', q > 0.7 ? 'اطلاعاتِ کامل' : ''].filter(Boolean) } }),
        S('fresh', 'تازه‌ثبت‌شده‌ها', '🆕', p => ({ s: 0.7 * freshness(p) + 0.3 * quality(p), why: ['تازه ثبت شده'] }), p => freshness(p) > 0.6),
      ] }
    case 'builder': // سازنده: زمین/کلنگی/مشارکت در مناطقِ پرتقاضا
      return { role, label, sections: [
        S('land', 'زمین و کلنگیِ پرتقاضا', '🏗️', p => ({ s: 0.5 * demandScore(p) + 0.3 * valueVsMarket(p, medianPerM) + 0.2 * quality(p), why: ['مناسبِ ساخت‌وساز'] }), landLike),
        S('demandarea', 'مناطقِ پرتقاضا برای ساخت', '📈', p => ({ s: demandScore(p), why: ['تقاضای خرید بالا در این منطقه'] })),
      ] }
    case 'materials': case 'architect': case 'contractor': // خدماتِ ساخت: پروژه‌های در حال ساخت / سازنده‌های فعال
      return { role, label, sections: [
        S('projects', 'پروژه‌ها و کلنگی‌های فعال (مشتریانِ بالقوه)', '🧱', p => ({ s: 0.6 * demandScore(p) + 0.4 * freshness(p), why: ['فعال / نیازمندِ خدمات'] }), landLike),
        S('newareas', 'مناطقِ فعالِ ساخت‌وساز', '📍', p => ({ s: 0.5 * demandScore(p) + 0.5 * freshness(p), why: ['فعالیتِ بالا'] })),
      ] }
    case 'appraiser': // کارشناس: آگهی‌های جدید نیازمندِ ارزش‌گذاری
      return { role, label, sections: [
        S('tovalue', 'آگهی‌های جدید نیازمندِ ارزش‌گذاری', '📋', p => ({ s: 0.7 * freshness(p) + 0.3 * (p.price ? 0.2 : 1), why: ['تازه ثبت شده'] }), p => freshness(p) > 0.5),
        S('active', 'معاملاتِ فعالِ منطقه', '⚖️', p => ({ s: demandScore(p), why: ['فعالیتِ بالا'] })),
      ] }
    case 'lawfirm': case 'notary': // حقوقی/دفترخانه: معاملاتِ فعال (پروکسیِ نیازِ خدماتِ نقل‌وانتقال)
      return { role, label, sections: [
        S('deals', 'معاملاتِ فعالِ منطقه', '⚖️', p => ({ s: 0.6 * demandScore(p) + 0.4 * quality(p), why: ['احتمالِ معاملهٔ بالا'] })),
        S('fresh', 'تازه‌ثبت‌شده‌ها', '🆕', p => ({ s: freshness(p), why: ['تازه'] }), p => freshness(p) > 0.6),
      ] }
    case 'finance': { // بانک/بیمه: بازارِ وام‌پذیر (بندِ قیمتیِ مناسبِ تسهیلات)
      const [lo, hi] = ctx.loanBand || [2_000_000_000, 12_000_000_000]
      return { role, label, sections: [
        S('loanable', 'بازارِ وام‌پذیر (بندِ قیمتیِ تسهیلات)', '🏦', p => ({ s: 0.6 * priceBand(p, lo, hi) + 0.4 * demandScore(p), why: ['در بندِ قیمتیِ وام'] }), p => p.deal !== 'rent'),
        S('hot', 'پرتقاضاهای منطقه', '🔥', p => ({ s: demandScore(p), why: ['تقاضای بالا'] })),
      ] }
    }
    default: // buyer یا نقشِ ناشناخته → تقاضا+کیفیت (fallback؛ فیدِ شخصی از recommendations می‌آید)
      return { role, label, sections: [
        S('foryou', 'پیشنهادهای پرتقاضا', '✦', p => ({ s: 0.5 * demandScore(p) + 0.3 * quality(p) + 0.2 * freshness(p), why: ['محبوب'] })),
      ] }
  }
}

export { parseFaNum }
