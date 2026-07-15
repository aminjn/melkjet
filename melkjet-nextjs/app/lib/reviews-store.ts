import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// نظراتِ واقعیِ مشتریان برای هر کسب‌وکار (per-owner phone). بازدیدکنندگانِ سایت ثبت می‌کنند،
// در بلوکِ «نظرات مشتریان» نمایش داده می‌شوند. مالک می‌تواند مدیریت/حذف کند.
const FILE = join(process.cwd(), '.reviews-data.json')

export interface Review {
  id: string
  ownerPhone: string
  name: string
  text: string
  rating: number        // ۱..۵
  createdAt: number
  approved: boolean      // نمایش روی سایت
  moderated?: boolean    // آیا هوش مصنوعی بررسی کرده
  reason?: string        // علتِ تأیید/رد
}
type DB = { reviews: Review[] }

function load(): DB { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { reviews: Array.isArray(d.reviews) ? d.reviews : [] } } catch {} } return { reviews: [] } }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db, null, 2)) }

function clampRating(v: any): number { const n = Math.round(Number(v) || 5); return Math.max(1, Math.min(5, n)) }

// ثبتِ نظرِ جدید توسطِ بازدیدکننده — به‌صورتِ پیش‌فرض نمایش داده می‌شود (مالک می‌تواند حذف کند).
export function addReview(ownerPhone: string, input: { name?: string; text?: string; rating?: any }): { ok: boolean; error?: string; review?: Review } {
  const phone = String(ownerPhone || '').replace(/\D/g, '')
  if (!/^09\d{9}$/.test(phone)) return { ok: false, error: 'صاحبِ سایت نامعتبر است' }
  const name = String(input.name || '').trim().slice(0, 60)
  const text = String(input.text || '').trim().slice(0, 600)
  if (name.length < 2) return { ok: false, error: 'نام را وارد کنید' }
  if (text.length < 5) return { ok: false, error: 'متنِ نظر خیلی کوتاه است' }
  const db = load()
  // ضدِ اسپامِ ساده: یک نظر با همان نام و متن تکراری نباشد
  if (db.reviews.some(r => r.ownerPhone === phone && r.name === name && r.text === text)) return { ok: false, error: 'این نظر قبلاً ثبت شده است' }
  // پیش‌فرض: در انتظارِ ممیزی (approved=false) تا هوش مصنوعی/مالک تأیید کند.
  const review: Review = { id: 'rv_' + randomBytes(5).toString('hex'), ownerPhone: phone, name, text, rating: clampRating(input.rating), createdAt: Date.now(), approved: false }
  db.reviews.unshift(review); save(db)
  return { ok: true, review }
}

// نتیجهٔ ممیزیِ هوش مصنوعی را روی نظر اعمال می‌کند.
export function applyReviewModeration(id: string, approved: boolean, reason: string) {
  const db = load(); const r = db.reviews.find(x => x.id === id); if (r) { r.approved = approved; r.moderated = true; r.reason = reason; save(db) }
}

// نظراتِ یک کسب‌وکار (پیش‌فرض: فقط تأییدشده‌ها).
// فاز ۱۳۲ (پرفِ دایرکتوری): همهٔ نظراتِ تأییدشده با یک بار خواندنِ فایل — گروه‌بندی سمتِ مصرف‌کننده.
export function allApprovedReviews(): Review[] { return load().reviews.filter(r => r.approved) }

export function listReviews(ownerPhone: string, opts?: { all?: boolean }): Review[] {
  const phone = String(ownerPhone || '').replace(/\D/g, '')
  if (!phone) return []
  return load().reviews.filter(r => r.ownerPhone === phone && (opts?.all || r.approved)).sort((a, b) => b.createdAt - a.createdAt)
}

export function setReviewApproved(ownerPhone: string, id: string, approved: boolean) {
  const db = load(); const r = db.reviews.find(x => x.id === id && x.ownerPhone === ownerPhone); if (r) { r.approved = approved; save(db) }
}
export function deleteReview(ownerPhone: string, id: string) {
  const db = load(); db.reviews = db.reviews.filter(r => !(r.id === id && r.ownerPhone === ownerPhone)); save(db)
}
