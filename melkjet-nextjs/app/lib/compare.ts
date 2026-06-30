// انتخابِ موارد برای مقایسه — سمتِ کلاینت (localStorage). برای آگهی و پروژه و هر چیزی
// که بخواهیم کنارِ هم بگذاریم. کپِ ۴ مورد.
export interface CompareEntry { kind: 'project' | 'item'; id: string; title?: string; photo?: string; subtitle?: string }
const KEY = 'mj_compare'
export const COMPARE_MAX = 4
const EVENT = 'mj-compare-updated'

export function readCompare(): CompareEntry[] {
  if (typeof window === 'undefined') return []
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function write(list: CompareEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
  window.dispatchEvent(new CustomEvent(EVENT))
}
export function inCompare(kind: string, id: string): boolean {
  return readCompare().some(e => e.kind === kind && e.id === id)
}
// افزودن/حذف؛ خروجی: {list, added, full}
export function toggleCompare(entry: CompareEntry): { list: CompareEntry[]; added: boolean; full: boolean } {
  const list = readCompare()
  const i = list.findIndex(e => e.kind === entry.kind && e.id === entry.id)
  if (i >= 0) { list.splice(i, 1); write(list); return { list, added: false, full: false } }
  if (list.length >= COMPARE_MAX) return { list, added: false, full: true }
  list.push(entry); write(list); return { list, added: true, full: false }
}
export function removeCompare(kind: string, id: string) { write(readCompare().filter(e => !(e.kind === kind && e.id === id))) }
export function clearCompare() { write([]) }
export function onCompareChange(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}
