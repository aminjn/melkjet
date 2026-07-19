// ⚔️ فاز ۱۶۸ — تابلوی محله‌ها (رقابتِ قابلِ‌لمس): «فلان محله باید مالِ من باشد».
// همه از دادهٔ واقعی: دارایی‌های واقعیِ امپراتوری‌ها (آگهی‌های خریده‌شده) گروه‌بندی به محله؛
// «فرمانروای محله» = بیشترین دارایی (تساوی → شمارهٔ امپراتوریِ کوچک‌تر = قدیمی‌تر — قطعی).
// آگهی‌های در دسترسِ هر محله هم واقعی‌اند (candidateListings) تا CTA سرمایه‌گذاری به خریدِ واقعی برسد.

export interface HoodStat {
  hood: string
  total: number                                            // کلِ دارایی‌های بازیکنان در محله
  mine: number                                             // دارایی‌های خودِ کاربر
  owners: number                                           // چند امپراتوریِ متفاوت اینجا ملک دارند
  king: { userId: string; no: number; name: string; count: number; isMe: boolean } | null
  gap: number                                              // چند ملک تا رسیدن به فرمانروا (۰ = خودتی)
}

type EmpireLite = { userId: string; no: number; name: string; assets: Array<{ hood: string; demolishedAt?: number }> }

// هستهٔ خالص (تست‌پذیر): از فهرستِ امپراتوری‌ها تابلوی محله‌ها را بساز.
export function hoodBoardFrom(empires: EmpireLite[], meId: string): HoodStat[] {
  const byHood = new Map<string, Map<string, { no: number; name: string; count: number }>>()
  for (const e of empires) {
    for (const a of e.assets || []) {
      const h = String(a.hood || '').trim()
      if (!h || a.demolishedAt) continue
      let m = byHood.get(h)
      if (!m) { m = new Map(); byHood.set(h, m) }
      const o = m.get(e.userId) || { no: e.no, name: e.name, count: 0 }
      o.count++
      m.set(e.userId, o)
    }
  }
  const out: HoodStat[] = []
  for (const [hood, m] of byHood) {
    let king: HoodStat['king'] = null
    let total = 0, mine = 0
    for (const [uid, o] of m) {
      total += o.count
      if (uid === meId) mine = o.count
      if (!king || o.count > king.count || (o.count === king.count && o.no < king.no))
        king = { userId: uid, no: o.no, name: o.name, count: o.count, isMe: uid === meId }
    }
    if (king) king.isMe = king.userId === meId
    out.push({ hood, total, mine, owners: m.size, king, gap: king ? (king.isMe ? 0 : king.count - mine + 1) : 1 })
  }
  // ترتیبِ انگیزشی: اول جایی که خودم هستم ولی فرمانروا نیستم (نزدیک‌ترین فتح)، بعد قلمروِ خودم، بعد داغ‌ترین‌ها
  out.sort((a, b) => {
    const rank = (s: HoodStat) => (s.mine > 0 && !s.king?.isMe ? 0 : s.king?.isMe ? 1 : 2)
    return rank(a) - rank(b) || b.total - a.total || a.hood.localeCompare(b.hood, 'fa')
  })
  return out
}

// 🏰 فاز ۱۸۶ — اتحادِ حاکمِ هر محله (خالص و تست‌پذیر): جمعِ دارایی‌های واقعیِ اعضای هر اتحاد در محله؛
// بیشترین = اتحادِ حاکم (تساوی → نامِ مقدم به فارسی — قطعی). بی‌اتحاد = هیچ (نه دادهٔ ساختگی).
export function hoodClanKings(empires: EmpireLite[], clanOfUser: Record<string, string>): Record<string, { name: string; count: number }> {
  const byHood = new Map<string, Map<string, number>>()
  for (const e of empires) {
    const cn = clanOfUser[e.userId]
    if (!cn) continue
    for (const a of e.assets || []) {
      const h = String(a.hood || '').trim()
      if (!h || a.demolishedAt) continue
      let m = byHood.get(h)
      if (!m) { m = new Map(); byHood.set(h, m) }
      m.set(cn, (m.get(cn) || 0) + 1)
    }
  }
  const out: Record<string, { name: string; count: number }> = {}
  for (const [hood, m] of byHood) {
    let best: { name: string; count: number } | null = null
    for (const [name, count] of m)
      if (!best || count > best.count || (count === best.count && name.localeCompare(best.name, 'fa') < 0)) best = { name, count }
    if (best) out[hood] = best
  }
  return out
}

// فاز ۱۸۵ — تطبیقِ محله با «مرزِ واژه» به‌جای تساویِ کاملِ بخشِ ویرگولی: «سهروردی» بخشِ «سهروردی جنوبی» را
// می‌گیرد (فیدبک: «محله آگهی دارد ولی تابلو هیچی نشان نمی‌دهد») ولی «ونک» هرگز «پونک» را نمی‌گیرد (زیررشته ممنوع).
// نرمال‌سازی: نیم‌فاصله→حذف، ي/ك عربی→فارسی — «سعادت‌آباد» و «سعادت آباد» یکی‌اند.
const normTok = (s: string) => s.replace(/[‌‏‎]/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
export function hoodMatches(hood: string, location?: string): boolean {
  const hTok = String(hood || '').trim().split(/\s+/).filter(Boolean).map(normTok)
  if (!hTok.length) return false
  const joinedHood = hTok.join('')
  for (const part of String(location || '').split(/[،,]/)) {
    const tok = part.trim().split(/\s+/).filter(Boolean).map(normTok)
    for (let i = 0; i + hTok.length <= tok.length; i++)
      if (hTok.every((t, j) => tok[i + j] === t)) return true
    // «سعادت آباد» در نشانی، «سعادت‌آباد» در محله (و برعکس): مقایسهٔ چسبیده — مرزِ واژه حفظ می‌شود
    for (let i = 0; i + 2 <= tok.length; i++)
      if (tok[i] + tok[i + 1] === joinedHood) return true
    if (hTok.length >= 2) for (const t of tok) if (t === joinedHood) return true
  }
  return false
}

// نسخهٔ کامل برای API: تابلو از دادهٔ زندهٔ استور + آگهی‌های واقعیِ در دسترسِ هر محله (پلِ بازی→خریدِ واقعی).
export async function hoodBoardOf(meId: string, opts: { maxHoods: number; sampleListings: number }): Promise<Array<HoodStat & { clanKing: { name: string; count: number } | null; listings: number; samples: Array<{ id: string; title: string; price: string }> }>> {
  const { listEmpiresPublic, getEmpire } = await import('./empire-store')
  const { candidateListings } = await import('./scraper-store')
  const empires = await listEmpiresPublic(2000)
  const board = hoodBoardFrom(empires, meId)
  // محلهٔ خانهٔ کاربر همیشه در تابلوست — حتی اگر هنوز هیچ‌کس آن‌جا ملک نداشته باشد (دعوت به اولین فتح)
  const me = await getEmpire(meId).catch(() => null)
  const home = String(me?.homeHood || '').trim()
  if (home && !board.some(s => s.hood === home))
    board.unshift({ hood: home, total: 0, mine: 0, owners: 0, king: null, gap: 1 })
  const top = board.slice(0, Math.max(1, opts.maxHoods))
  const pool = await candidateListings(500).catch(() => [])
  // 🏰 فاز ۱۸۶ — اتحادِ حاکمِ هر محله از دارایی‌های واقعیِ اعضا (لایهٔ رقابتِ گروهی روی همان داده)
  const { clanUserMap } = await import('./empire-social')
  const kings186 = hoodClanKings(empires, await clanUserMap().catch(() => ({})))
  return top.map(s => {
    const here = pool.filter(it => hoodMatches(s.hood, it.location))
    return { ...s, clanKing: kings186[s.hood] || null, listings: here.length, samples: here.slice(0, Math.max(0, opts.sampleListings)).map(it => ({ id: it.id, title: it.title, price: it.price || '' })) }
  })
}
