// فاز ۳۲۸ — پارسِ مقاومِ JSONِ خروجیِ مدل. مدل‌های محلی (qwen) گاهی JSON را با حصارِ ```json،
// کامای انتهایی، یا متنِ اضافه برمی‌گردانند؛ JSON.parseِ خام می‌شکند («Expected ',' or ']'»).
// این تابع تا جای ممکن تمیز می‌کند و در صورتِ شکست null می‌دهد (به‌جای throw).
export function looseJson<T = any>(raw: string): T | null {
  if (!raw) return null
  let s = String(raw).trim()
  // حذفِ حصارِ markdown
  s = s.replace(/^```(?:json|javascript|js)?\s*/i, '').replace(/```\s*$/i, '').trim()
  // اولین بلاکِ {…} یا […] را جدا کن (از اولین { یا [ تا آخرین } یا ])
  const firstObj = s.indexOf('{'), firstArr = s.indexOf('[')
  let start = -1, open = '{', close = '}'
  if (firstObj >= 0 && (firstArr < 0 || firstObj < firstArr)) { start = firstObj; open = '{'; close = '}' }
  else if (firstArr >= 0) { start = firstArr; open = '['; close = ']' }
  if (start >= 0) { const end = s.lastIndexOf(close); if (end > start) s = s.slice(start, end + 1) }
  const attempts = [
    s,
    s.replace(/,\s*([}\]])/g, '$1'),                         // کامای انتهایی پیش از } یا ]
    s.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''), // + کاراکترهای کنترلی
  ]
  for (const a of attempts) { try { return JSON.parse(a) as T } catch { /* تلاشِ بعدی */ } }
  return null
}
