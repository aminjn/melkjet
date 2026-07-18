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

// نسخهٔ کامل برای API: تابلو از دادهٔ زندهٔ استور + آگهی‌های واقعیِ در دسترسِ هر محله (پلِ بازی→خریدِ واقعی).
export async function hoodBoardOf(meId: string, opts: { maxHoods: number; sampleListings: number }): Promise<Array<HoodStat & { listings: number; samples: Array<{ id: string; title: string; price: string }> }>> {
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
  return top.map(s => {
    const here = pool.filter(it => String(it.location || '').includes(s.hood))
    return { ...s, listings: here.length, samples: here.slice(0, Math.max(0, opts.sampleListings)).map(it => ({ id: it.id, title: it.title, price: it.price || '' })) }
  })
}
