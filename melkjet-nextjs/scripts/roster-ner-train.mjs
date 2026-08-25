import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.production.local', 'utf-8').split('\n')) {
  const i = l.indexOf('='); if (i < 0) continue
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim()
  if (v.length > 1 && v[0] === v[v.length - 1] && (v[0] === "'" || v[0] === '"')) v = v.slice(1, -1)
  if (k && process.env[k] === undefined) process.env[k] = v
}
const { kvGet } = await import('../app/lib/db.ts')
const rs = await import('../app/lib/agency-roster-store.ts')
const M = await import('../app/lib/roster-name-model.ts')
const N = await import('../app/lib/roster-ner.ts')

if (!await M.primeNameModel()) { console.log('پیکره بارگذاری نشد'); process.exit(1) }
const corpus = M.getCorpus()

// ── برچسب‌گذاری از راه دور: مشاورِ فارغ‌التحصیل = نامِ تأییدشدهٔ مدیر ──────────
const docs = []
for (const sc of await rs.listScrapes()) {
  const full = await rs.getScrape(sc.id)
  const grads = (full?.advisors || []).filter(a => a.phone && a.name && a.tokens?.length)
  if (!grads.length) continue
  const rc = await kvGet('agency_roster_cache:' + sc.id, {})
  for (const a of grads) {
    const parts = new Set(M.norm(a.name).split(' ').filter(Boolean))
    for (const t of a.tokens) {
      const r = rc[t]
      if (r?.desc) docs.push({ title: r.title || '', desc: r.desc, name: M.norm(a.name), parts, src: 'grad' })
    }
  }
}

// TITLE_LABELS — منبعِ دومِ برچسب، کاملاً خودکار: لقب یا دونقطه پیش از نام.
// «مشاور و امین شما خانم رگبار» و «کارشناس فروش: محمدی» جوابِ قطعی‌اند.
// با هر اسکرپِ جدید این منبع خودش بزرگ‌تر می‌شود — بدونِ دخالتِ انسان.
{
  const { validName } = await import('../app/lib/agency-name-lexicon.ts')
  const TITLE = /(?:سرکار\s+)?(?:خانمِ?|آقای|اقای|جناب|مهندس|دکتر|حاج)\s+([\u0621-\u06cc]{3,15})(?:\s+([\u0621-\u06cc]{3,15}))?/
  const COLON = /(?:کارشناسِ?\s*فروش|مشاورِ?\s*فروش|کارشناس|مشاور|فروشنده)\s*[:：]\s*([\u0621-\u06cc]{3,15})(?:\s+([\u0621-\u06cc]{3,15}))?/
  const seen = new Set(docs.map(d => d.desc.slice(0, 120)))
  let added = 0
  for (const sc of await rs.listScrapes()) {
    const rc = await kvGet('agency_roster_cache:' + sc.id, {})
    const full = await rs.getScrape(sc.id)
    for (const r of Object.values(rc || {})) {
      if (!r?.desc) continue
      if (seen.has(String(r.desc).slice(0, 120))) continue
      const m = String(r.desc).match(TITLE) || String(r.desc).match(COLON)
      if (!m) continue
      const raw = (m[1] + ' ' + (m[2] || '')).trim()
      const nm = validName(raw, full?.agencyName || '')
      if (!nm || nm.length < 3) continue
      const parts = new Set(M.norm(nm).split(' ').filter(Boolean))
      docs.push({ title: r.title || '', desc: r.desc, name: M.norm(nm), parts, src: 'title' })
      added++
    }
  }
  console.log('برچسبِ خودکار از لقب/دونقطه:', added)
}

// PROPAGATE — لنگرگیری و انتشارِ درون‌آژانسی. سه منبعِ لنگر: لقب/دونقطه، معرفیِ خود
// («… هستم»)، و پایان‌بندی («با تشکر …»). سپس هر آگهیِ دیگرِ همان آژانس که آن نام را
// در ناحیهٔ امضا دارد، برچسب می‌گیرد. یک مشاور شاید فقط در ۳ آگهی از ۲۰تا لقب بنویسد.
{
  const { validName } = await import('../app/lib/agency-name-lexicon.ts')
  const PATS = [
    /(?:سرکار\s+)?(?:خانمِ?|آقای|اقای|جناب|مهندس|دکتر|حاج)\s+([\u0621-\u06cc]{3,15})(?:\s+([\u0621-\u06cc]{3,15}))?/,
    /(?:کارشناسِ?\s*فروش|مشاورِ?\s*فروش|کارشناس|مشاور|فروشنده)\s*[:：]\s*([\u0621-\u06cc]{3,15})(?:\s+([\u0621-\u06cc]{3,15}))?/,
    // SELF_REMOVED — «در ساعات کاری هستم» را «ساعات» برداشت می‌کرد و آن لنگرِ غلط
    // به ده‌ها آگهی سرایت می‌کرد. کم‌دقت‌ترین منبع بود؛ حذفش شد.

    // ROLE_AFTER — «گوهری | مشاور تخصصی…» و «رضایی - کارشناس فروش»: نام پیش از
    // واژهٔ نقش، با جداکنندهٔ صریح. بدونِ جداکننده اضافه نمی‌شود تا مبهم نباشد.
    /([\u0621-\u06cc]{3,15})(?:\s+([\u0621-\u06cc]{3,15}))?\s*[|\uff5c\u2013\u2014\u2015-]\s*(?:مشاور|کارشناس|املاک|مسکن)/,
    // «مشاور شما فرهنگ» / «کارشناس شما کریمیان» — نام پس از «شما».
    ...(process.env.NER_NO_PHRASE ? [] : [/(?:مشاورِ?|کارشناسِ?|همراهِ?)\s*شما\s*[:،.\-]?\s*(?:(?:خانم|خانوم|آقای|آقا|جناب|سرکار|مهندس|دکتر|بانو)\s+)?([\u0621-\u06cc]{3,15})(?:\s+([\u0621-\u06cc]{3,15}))?/]),
    /(?:با\s*تشکر|موفق\s*باشید|ارادتمند)[\s,،:]*([\u0621-\u06cc]{3,15})(?:\s+([\u0621-\u06cc]{3,15}))?/,
  ]
  // واژهٔ دوم را کورکورانه نچسبان. «زارع هستم» از همین می‌آمد و بعد به‌عنوانِ
  // حقیقتِ زمینی به مدل داده می‌شد. پیکره خودش می‌داند: هستم ag=69 b=949، در حالی
  // که نامِ واقعی ag یک‌رقمی و b کوچک دارد. معیار از داده می‌آید، نه از فهرستِ دستی.
  const CO = (() => { try { return M.getCorpus && M.getCorpus() } catch (e) { return null } })()
  const cstat = w => { try { return typeof CO?.get === 'function' ? CO.get(w) : CO?.[w] } catch (e) { return null } }
  const BARE_AG = Number(process.env.BARE_AG || 18)
  const nameLike = w => { const e = cstat(w); if (!e) return true; return e.b <= 200 && (e.s + 1) / (e.s + e.b + 1) >= 0.25 }
  const seen = new Set(docs.map(d => String(d.desc).slice(0, 120)))
  let anchored = 0, spread = 0, negs = 0, bare = 0
  // پیش‌پاس: شمارشِ واژه‌های ناحیهٔ امضا، هم به تفکیکِ آژانس هم سراسری
  const tailLocal = new Map(), tailGlobal = new Map()
  for (const sc of await rs.listScrapes()) {
    const rc = await kvGet('agency_roster_cache:' + sc.id, {})
    const local = new Map()
    for (const r of Object.values(rc || {})) {
      if (!r?.desc) continue
      const tail = String(r.desc).split(/[\n\r]+/).map(x => x.trim()).filter(Boolean).slice(-2).join(' ')
      for (const w of new Set(tail.split(/[^\u0621-\u06cc]+/).filter(x => x.length > 2 && validName(x))))
        local.set(w, (local.get(w) || 0) + 1)
    }
    tailLocal.set(sc.id, local)
    for (const [w, c] of local) tailGlobal.set(w, (tailGlobal.get(w) || 0) + c)
  }
  for (const sc of await rs.listScrapes()) {
    const rc = await kvGet('agency_roster_cache:' + sc.id, {})
    const full = await rs.getScrape(sc.id)
    const rows = Object.values(rc || {}).filter(r => r?.desc)
    const anchors = new Map()                       // نامِ نرمال → تعداد
    const labeled = []
    for (const r of rows) {
      let nm = ''
      for (const re of PATS) { const m = String(r.desc).match(re); if (m) { const two = (m[2] && nameLike(m[2])) ? ' ' + m[2] : ''; nm = validName((m[1] + two).trim(), full?.agencyName || ''); if (nm) break } }
      if (!nm || nm.length < 3) continue
      const k = M.norm(nm)
      anchors.set(k, (anchors.get(k) || 0) + 1)
      labeled.push({ r, nm: k })
    }
    // RATIO_MINER — لنگر بدونِ هیچ عبارتی: واژه‌ای که در ناحیهٔ امضای دستِ‌کم ۳ آگهیِ
    // همین آژانس بیاید و بیش از نیمی از کلِ ظهورهایش در همین آژانس باشد، نامِ مشاورِ
    // همین‌جاست. «گوناگون» و «واسه» در همهٔ آژانس‌ها پخش‌اند، پس سهمشان پایین می‌آید.
    // با این، هر جمله‌بندیِ تازه‌ای هم پوشش داده می‌شود چون معیار تکرار است نه عبارت.
    // خاموش. ممیزی نشان داد ~۴۰٪ لنگرهایش نام نیست: «گوناگون»، «واسه»،
    // «کارگزاری»، «ترافیک» و محله‌هایی مثل «الهیه» و «زعفرانیه». معیارِ نسبتی
    // نمی‌تواند «نامی که فقط این آژانس دارد» را از «واژه‌ای که فقط این آژانس
    // زیاد به کار می‌برد» جدا کند، و محلهٔ تخصصیِ هر آژانس ذاتاً همین رفتار را
    // دارد. با NER_RATIO=1 روشن می‌شود.
    if (process.env.NER_RATIO) for (const [w, c] of (tailLocal.get(sc.id) || new Map())) {
      if (c >= 3 && c / (tailGlobal.get(w) || c) >= 0.5) anchors.set(M.norm(w), Math.max(anchors.get(M.norm(w)) || 0, c))
    }
    // لنگرِ معتبر: دستِ‌کم دوبار در همین آژانس دیده شده (یک‌بار می‌تواند تصادفی باشد)
    for (const a of (full?.advisors || [])) if (a.phone) anchors.set(M.norm(a.name), 99)
    const solid = new Set([...anchors.entries()].filter(([, c]) => c >= 2).map(([k]) => k))
    for (const { r, nm } of labeled) {
      const key = String(r.desc).slice(0, 120)
      if (seen.has(key)) continue
      seen.add(key); anchored++
      docs.push({ title: r.title || '', desc: r.desc, name: nm, parts: new Set(nm.split(' ').filter(Boolean)), src: 'anchor' })
    }
    if (!solid.size) continue
    for (const r of rows) {
      const key = String(r.desc).slice(0, 120)
      if (seen.has(key)) continue
      const lines = String(r.desc).split(/[\n\r]+/).map(x => x.trim()).filter(Boolean)
      const tail = lines.slice(-4).join(' ')
      const hits = [...solid].filter(k => tail.includes(k))
      if (hits.length !== 1) continue                 // ابهام = برچسب نمی‌زنیم
      seen.add(key); spread++
      docs.push({ title: r.title || '', desc: r.desc, name: hits[0], parts: new Set(hits[0].split(' ').filter(Boolean)), src: 'spread' })
    }
    // امضای برهنه — نام تنها روی خطِ آخر، بدونِ هیچ کلیدواژه‌ای: «محمد امین»،
    // «کارن»، «مهدی». این خانواده نه‌تنها برچسبی نداشت، بلکه به‌عنوانِ سندِ منفی به
    // مدل داده می‌شد؛ یعنی صریحاً یادش می‌دادیم رویشان ساکت بماند. سه سنجه، هر سه
    // از داده: خطِ کوتاه (≤۲ توکن)، پراکندگیِ آژانسیِ پایین (واژهٔ عمومی مثل «هستم»
    // ag=69 و «توضیحات» ag=88 می‌افتد) و حذفِ کشیده که «شمـاره همـراه» را رد می‌کرد.
    // توکنِ پرپراکنش تنها حذف می‌شود نه کلِ خط، پس «پوریا هستم» می‌شود «پوریا».
    if (!process.env.NER_NO_BARE) {
      const bareOf = (desc) => {
        const lines = String(desc).replace(/\u0640/g, '').split(/[\n\r]+/).map(x => x.trim()).filter(Boolean)
        for (const ln of lines.slice(-3).reverse()) {
          const raw = ln.split(/[^\u0621-\u06cc]+/).filter(x => x.length > 2)
          if (!raw.length || raw.length > 2) continue
          if (raw.some(t => !validName(t, full?.agencyName || ''))) continue
          const keep = raw.filter(t => { const e = cstat(M.norm(t)); return !e || e.ag < BARE_AG })
          if (!keep.length) continue
          return M.norm(keep.join(' '))
        }
        return ''
      }
      const loc = new Map()
      for (const r of rows) { const nm = bareOf(r.desc); if (nm) loc.set(nm, (loc.get(nm) || 0) + 1) }
      for (const r of rows) {
        const key = String(r.desc).slice(0, 120)
        if (seen.has(key)) continue
        const nm = bareOf(r.desc)
        if (!nm || (loc.get(nm) || 0) < 2) continue
        seen.add(key); bare++
        docs.push({ title: r.title || '', desc: r.desc, name: nm, parts: new Set(nm.split(' ').filter(Boolean)), src: 'bare' })
      }
    }
    // NEG_V2 — منفیِ درست: آگهیِ همین آژانس که هیچ لنگری در ناحیهٔ امضا ندارد.
    // تعریفِ قبلی («کلیدواژهٔ امضا نداشته باشد») آگهی‌های «برای اطلاعات بیشتر … تماس
    // بگیرید» را کنار می‌گذاشت — دقیقاً همان‌هایی که مشاورِ جعلیِ «بیشتر» را ساختند.
    for (const r of rows) {
      const key = String(r.desc).slice(0, 120)
      if (seen.has(key)) continue
      const lines = String(r.desc).split(/[\n\r]+/).map(x => x.trim()).filter(Boolean)
      const tail = lines.slice(-4).join(' ')
      if ([...solid].some(k => tail.includes(k))) continue
      seen.add(key); negs++
      docs.push({ title: r.title || '', desc: r.desc, name: '', parts: new Set(), src: 'neg' })
    }
  }
  console.log('لنگر:', anchored, '| انتشار:', spread, '| امضای برهنه:', bare, '| سندِ منفی:', negs)
}

console.log('آگهیِ برچسب‌دار:', docs.length)
if (docs.length < 100) { console.log('کم است — آموزش انجام نشد'); process.exit(0) }

// تقسیم بر اساسِ *آگهی* نه توکن، وگرنه نشتِ داده رخ می‌دهد
// آزمون فقط روی برچسبِ مطمئن (حسابِ تأییدشده + لقب/دونقطه). آموزش روی همه.
// وگرنه برچسبِ نویزیِ تازه هم می‌شود «حقیقتِ زمینی» و عدد بی‌معنا می‌شود.
const tr = [], te = []
// عضویتِ آزمون تابعِ خودِ سند است، نه ترتیبِ پیمایش. وگرنه هر تغییری در استخراج،
// چیدمانِ آزمون را هم جابه‌جا می‌کند و دو اجرا قابلِ مقایسه نمی‌مانند.
const h5 = t => { let x = 2166136261; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619) } return (x >>> 0) % 5 }
for (const d of docs) {
  const gold = d.src === 'grad' || d.src === 'title' || d.src === 'neg'
  if (gold && h5(String(d.desc)) === 0) te.push(d); else tr.push(d)
}
const cnt = docs.reduce((m, d) => (m[d.src] = (m[d.src] || 0) + 1, m), {})
console.log('منابعِ برچسب:', JSON.stringify(cnt), '| آموزش:', tr.length, '| آزمونِ طلایی:', te.length)
const build = set => {
  const X = [], y = []
  for (const d of set) {
    const { toks, nLines, nDoc } = N.tokenize(d.desc)
    const ts = N.titleTokens(d.title)
    toks.forEach((t, i) => { X.push(N.featsOf(toks, i, nLines, nDoc, ts, corpus)); y.push(d.parts.has(M.norm(t.w)) ? 1 : 0) })
  }
  return [X, y]
}
const [Xtr, ytr] = build(tr), [Xte, yte] = build(te)
console.log('توکنِ آموزشی:', Xtr.length, '(مثبت', ytr.reduce((a, b) => a + b, 0) + ')',
            '| آزمون:', Xte.length, '(مثبت', yte.reduce((a, b) => a + b, 0) + ')')

const w = N.trainNer(Xtr, ytr, 600, 0.6, 0.01)
console.log('\n--- وزن‌ها ---')
N.NER_FEATURES.forEach((f, i) => console.log('  ', f.padEnd(12), w[i].toFixed(3)))

// سنجشِ توکنی
let tp = 0, fp = 0, fn = 0
for (let i = 0; i < Xte.length; i++) { const p = N.dot(Xte[i], w) >= 0.55 ? 1 : 0
  if (p && yte[i]) tp++; else if (p && !yte[i]) fp++; else if (!p && yte[i]) fn++ }
console.log('\nتوکنی → precision', (tp / (tp + fp || 1)).toFixed(3), 'recall', (tp / (tp + fn || 1)).toFixed(3))

// سنجشِ واقعی: در هر آگهیِ کنارگذاشته، نامِ پیش‌بینی‌شده با نامِ درست یکی است؟
let exact = 0, partial = 0, none = 0, wrong = 0
const misses = []
for (const d of te) {
  const { toks, nLines, nDoc } = N.tokenize(d.desc)
  if (!toks.length) { none++; continue }
  const ts = N.titleTokens(d.title)
  const sc = toks.map((_, i) => N.dot(N.featsOf(toks, i, nLines, nDoc, ts, corpus), w))
  let bi = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[bi]) bi = i
  if (sc[bi] < 0.55) { none++; continue }
  // مقایسهٔ بی‌فاصله: برچسبِ «محمدپرنده» و متنِ «محمد پرنده» یک چیزند.
  const sp = (x) => M.norm(x).replace(/\s+/g, '')
  const pred = M.norm(toks[bi].w)
  if (pred === d.name || sp(pred) === sp(d.name)) exact++
  else if (d.parts.has(pred) || sp(d.name).includes(sp(pred)) && sp(pred).length >= 4) partial++
  else { wrong++; if (misses.length < 12) misses.push(pred + ' ≠ ' + d.name) }
}
const tot = te.length
console.log('\nآگهی‌محور →  دقیق', exact, '| بخشی', partial, '| اشتباه', wrong, '| بی‌نام', none, '| کل', tot)
console.log('  نرخِ درست (دقیق+بخشی):', (((exact + partial) / tot) * 100).toFixed(1) + '%')
console.log('  نمونهٔ خطا:', misses.join(' · '))


// ── مدلِ خلوت: همان داده، همان تقسیم، ویژگی‌های واژه‌ای و زیرواژه‌ای ──────────
if (process.argv.includes('--sparse')) {
  const XS = [], ys = []
  for (const d of tr) {
    const { toks, nLines, nDoc } = N.tokenize(d.desc)
    const ts = N.titleTokens(d.title)
    toks.forEach((t, i) => { XS.push(N.sparseFeats(toks, i, nLines, nDoc, ts, corpus)); ys.push(d.parts.has(M.norm(t.w)) ? 1 : 0) })
  }
  console.log('\nنمونهٔ خلوت:', XS.length, '| بُعد:', N.SPARSE_DIM)
  const t0 = Date.now()
  const W = N.trainSparse(XS, ys, { epochs: 12, lr: 0.25, l2: 1e-6 })
  console.log('زمانِ آموزش:', ((Date.now() - t0) / 1000).toFixed(1), 'ثانیه')

  const spn = (x) => M.norm(x).replace(/\s+/g, '')
  let ex = 0, pa = 0, wr = 0, no = 0; const miss = []
  let gOk = 0, gBad = 0
  for (const d of te) {
    const { toks, nLines, nDoc } = N.tokenize(d.desc)
    const neg = d.src === 'neg'
    if (!toks.length) { if (neg) gOk++; else no++; continue }
    const ts = N.titleTokens(d.title)
    const sc2 = toks.map((_, i) => N.dotSparse(N.sparseFeats(toks, i, nLines, nDoc, ts, corpus), W))
    let bi = 0; for (let i = 1; i < sc2.length; i++) if (sc2[i] > sc2[bi]) bi = i
    if (sc2[bi] < 0.55) { if (neg) gOk++; else no++; continue }
    if (neg) { gBad++; if (miss.length < 12) miss.push('باید خالی می‌ماند: ' + M.norm(toks[bi].w)); continue }
    const pred = M.norm(toks[bi].w)
    if (pred === d.name || spn(pred) === spn(d.name)) ex++
    else if (d.parts.has(pred) || (spn(d.name).includes(spn(pred)) && spn(pred).length >= 4)) pa++
    else { wr++; if (miss.length < 12) miss.push(pred + ' ≠ ' + d.name) }
  }
  // دو معیارِ جدا. «نام» روی سندهای نام‌دار که تعدادشان با تغییرِ استخراج ثابت
  // می‌ماند، و «سکوت» روی منفی‌ها. عددِ درهم با نسبتِ منفی‌ها بالا و پایین می‌رفت
  // و در جهتِ عکسِ کیفیت حرکت می‌کرد — بینِ دو اجرا بی‌معنا بود.
  const nTot = ex + pa + wr + no, gTot = gOk + gBad, tot2 = te.length
  console.log('\n[نام]   دقیق', ex, '| بخشی', pa, '| اشتباه', wr, '| بی‌نام', no, '| کل', nTot)
  console.log('  نرخِ نام:', nTot ? (((ex + pa) / nTot) * 100).toFixed(1) + '%' : '—')
  console.log('[سکوت] درست', gOk, '| مثبتِ کاذب', gBad, '| کل', gTot)
  console.log('  نرخِ سکوت:', gTot ? ((gOk / gTot) * 100).toFixed(1) + '%' : '—')
  console.log('  نرخِ درهم (قدیمی):', (((ex + pa + gOk) / tot2) * 100).toFixed(1) + '%')
  console.log('  نمونهٔ خطا:', miss.join(' · '))
  if (process.argv.includes('--save')) {
    const nz = await N.saveSparse(W, { n: XS.length, metrics: { exact: ex, partial: pa, wrong: wr, none: no, total: tot2 } })
    console.log('SPARSE SAVED — وزنِ ناصفر:', nz)
  }
}

if (process.argv.includes('--save')) {
  await N.saveNer({ w, trainedAt: Date.now(), n: Xtr.length,
    metrics: { exact, partial, wrong, none, total: tot } })
  console.log('\nSAVED')
} else console.log('\n(ذخیره نشد — --save بده)')
process.exit(0)
