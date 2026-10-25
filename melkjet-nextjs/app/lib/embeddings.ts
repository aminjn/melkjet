// امبدینگِ معناییِ آگهی‌ها — برای «مشابه‌ها/ضدتکراری». مدل: bge-m3 روی سرورِ خودِ مالک (Ollama).
// تنبل و کش‌شده: بدونِ بک‌فیلِ ۵۸هزارتایی؛ هر آگهی وقتی در استخرِ کاندیدا بیاید یک‌بار امبد و کش می‌شود.
// اگر امبدینگ تنظیم نشده بود، همه‌چیز graceful به رفتارِ قبلی (فیلتر+امتیازِ kind.ts) برمی‌گردد.
import { embedTexts, embeddingsConfigured } from './gapgpt'
import { kvGet, kvSet, pgEnabled } from './db'

export { embeddingsConfigured }

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

// هشِ متن: اگر آگهی عوض شد، امبدینگِ کش‌شده تازه می‌شود.
function h32(s: string): string { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return (h >>> 0).toString(36) }

// متنِ معناییِ یک آگهی (عنوان + مکان + نوع + متراژ/اتاق/منطقه/امکانات). سقفِ طول تا امبد سبک بماند.
export function listingEmbedText(it: any): string {
  const m = it?.meta || {}
  return [
    it?.title, it?.location, m['نوع ملک'] || it?.category,
    m['متراژ'] && `متراژ ${m['متراژ']}`, m['اتاق'] && `${m['اتاق']} خواب`,
    m['منطقه'] && `منطقه ${m['منطقه']}`, m['سن بنا'], m['طبقه'], m['امکانات'],
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 600)
}

// بردارِ کش‌شدهٔ چند آگهی. کلید kv: emb:{id} = {h, v}. فقط مسیرِ PG (در فایل‌مود کش نمی‌کنیم).
export async function embedListingsCached(items: { id: string; text: string }[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>()
  if (!embeddingsConfigured() || !pgEnabled() || !items.length) return out
  const need: { id: string; text: string; h: string }[] = []
  for (const it of items) {
    if (!it.text) continue
    const hh = h32(it.text)
    try {
      const c = await kvGet<{ h: string; v: number[] } | null>('emb:' + it.id, null)
      if (c && c.h === hh && Array.isArray(c.v) && c.v.length) { out.set(it.id, c.v); continue }
    } catch {}
    need.push({ ...it, h: hh })
  }
  if (need.length) {
    const vecs = await embedTexts(need.map(n => n.text))
    for (let i = 0; i < need.length; i++) {
      const v = vecs[i]
      if (v && v.length) { out.set(need[i].id, v); try { await kvSet('emb:' + need[i].id, { h: need[i].h, v }) } catch {} }
    }
  }
  return out
}
