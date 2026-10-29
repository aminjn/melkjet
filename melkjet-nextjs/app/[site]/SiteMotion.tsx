'use client'
import { useEffect } from 'react'

// پوستهٔ نسلِ ۲ سایت‌ساز — موتورِ حرکت.
// پیش از این ظاهرشدنِ بخش‌ها با `animation-timeline: view()` بود که سافاریِ آیفون و فایرفاکس پشتیبانی
// نمی‌کنند؛ یعنی برای بیشترِ کاربرانِ موبایل سایت کاملاً بی‌حرکت بود («انیمیشن نداره»). این‌جا همه‌چیز
// با IntersectionObserver است که همه‌جا کار می‌کند. محتوا بدونِ جاوااسکریپت هم دیده می‌شود: حالتِ
// «پنهان پیش از ورود» فقط زیرِ کلاسِ html.mjs-js فعال است (سئو و خزنده‌ها محتوای کامل می‌بینند).
//   • ظاهرشدنِ پلکانیِ بخش‌ها/کارت‌ها/تیترها
//   • شمارشِ عددها (آمار) از صفر
//   • نوارِ پیشرفتِ اسکرول + حالتِ «اسکرول‌شده»ی هدر
//   • نورِ دنبال‌کنندهٔ نشانگر روی کارت‌ها (دسکتاپ) و پارالاکسِ نرمِ هیرو
//   • حذفِ لینک‌های نوارِ بخش‌ها که بخشِ مقصدشان (به‌خاطرِ خالی بودن) رندر نشده
export default function SiteMotion() {
  useEffect(() => {
    const root = document.documentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const main = document.querySelector('main.mjs-site-main') as HTMLElement | null
    if (!main) return

    // لینکِ مرده در نوارِ بخش‌ها (بخشِ خالی پنهان شده)
    main.querySelectorAll<HTMLAnchorElement>('.mjs-subnav a[href^="#"]').forEach(a => {
      const id = a.getAttribute('href')!.slice(1)
      if (id && !document.getElementById(id)) a.remove()
    })

    if (reduce) return
    root.classList.add('mjs-js')

    // ── برچسب‌گذاریِ خودکارِ عناصرِ متحرک (بدونِ نیاز به دست‌کاریِ تک‌تکِ بلوک‌ها) ──
    const tag = (el: Element, d = 0, kind = 'up') => {
      if (el.hasAttribute('data-r')) return
      el.setAttribute('data-r', kind)
      ;(el as HTMLElement).style.setProperty('--d', `${Math.min(d, 0.6).toFixed(2)}s`)
    }
    main.querySelectorAll(':scope > section:not(#hero)').forEach(sec => {
      sec.querySelectorAll('h2').forEach(h => tag(h, 0, 'mask'))
      // کارت‌های هر بخش پلکانی (هم‌نیاها با تأخیرِ افزایشی)
      const groups = new Map<Element, number>()
      sec.querySelectorAll('.mjs-card, .mjs-slide-card, .mjsl-card, .mjs-stat, .mjs-quote').forEach(c => {
        const parent = c.parentElement!
        const i = groups.get(parent) || 0
        groups.set(parent, i + 1)
        tag(c, i * 0.08)
      })
      sec.querySelectorAll('.mjs-about img, .mjs-about > div > p, .mjs-contact-grid > *, form').forEach((el, i) => tag(el, i * 0.06))
    })

    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('mjs-in')
        io.unobserve(e.target)
        const n = e.target.querySelector<HTMLElement>('[data-count]') || (e.target.hasAttribute('data-count') ? e.target as HTMLElement : null)
        if (n) countUp(n)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    main.querySelectorAll('[data-r]').forEach(el => io.observe(el))
    // عددهای بیرون از عناصرِ برچسب‌خورده
    const io2 = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { countUp(e.target as HTMLElement); io2.unobserve(e.target) }
    }, { threshold: 0.4 })
    main.querySelectorAll('[data-count]').forEach(el => { if (!el.closest('[data-r]')) io2.observe(el) })

    // ── فاز ۳۴۱ (لگِ اسکرول) — انیمیشن‌های بی‌پایان (شفق، لبهٔ چرخانِ CTA، نوارِ متحرک، نورِ شناور) فقط وقتی
    // در دیدند اجرا می‌شوند؛ بیرونِ دید data-off می‌گیرند و CSS متوقفشان می‌کند (قبلاً همیشه رنگ‌آمیزیِ دوباره).
    const loops = main.querySelectorAll<HTMLElement>('.mjs-aurora, .mjs-glow-border, .mjs-marquee, .mjs-hero-glow, .mjs-float, .mjs-float-2')
    const io3 = new IntersectionObserver(entries => {
      for (const e of entries) (e.target as HTMLElement).toggleAttribute('data-off', !e.isIntersecting)
    }, { rootMargin: '120px 0px 120px 0px' })
    loops.forEach(el => io3.observe(el))

    // ── اسکرول: نوارِ پیشرفت + هدرِ «اسکرول‌شده» + پارالاکسِ هیرو ──
    const bar = document.querySelector<HTMLElement>('.mjs-progress')
    // پارالاکس فقط روی دسکتاپ (نشانگرِ دقیق): روی گوشی جابه‌جاییِ لایهٔ بزرگِ هیرو در هر فریمِ اسکرول هزینهٔ بی‌ثمر بود.
    const hero = window.matchMedia('(pointer: fine) and (min-width: 900px)').matches ? main.querySelector<HTMLElement>('#hero .mjs-hero-par') : null
    let raf = 0, scrolled = false
    // ارتفاعِ سند فقط با تغییرِ اندازه دوباره خوانده می‌شود (خواندنِ scrollHeight در هر فریم = layoutِ اجباری)
    let docH = document.documentElement.scrollHeight - window.innerHeight
    const onResize = () => { docH = document.documentElement.scrollHeight - window.innerHeight }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        if (bar) bar.style.transform = `scaleX(${docH > 0 ? Math.min(1, y / docH) : 0})`
        const sc = y > 24
        if (sc !== scrolled) { scrolled = sc; main.classList.toggle('mjs-scrolled', sc) }
        if (hero && y < 1200) hero.style.transform = `translate3d(0, ${(y * 0.28).toFixed(1)}px, 0)`
      })
    }
    window.addEventListener('resize', onResize, { passive: true })
    const ro = new ResizeObserver(onResize); ro.observe(document.body)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    // ── نورِ دنبال‌کننده روی کارت‌ها (فقط نشانگرِ دقیق؛ لمس نه) ──
    const fine = window.matchMedia('(pointer: fine)').matches
    const onMove = (ev: PointerEvent) => {
      const c = (ev.target as Element)?.closest?.('.mjs-card, .mjs-slide-card, .mjsl-card') as HTMLElement | null
      if (!c) return
      const r = c.getBoundingClientRect()
      c.style.setProperty('--mx', `${ev.clientX - r.left}px`)
      c.style.setProperty('--my', `${ev.clientY - r.top}px`)
    }
    if (fine) main.addEventListener('pointermove', onMove, { passive: true })

    return () => {
      io.disconnect(); io2.disconnect(); io3.disconnect(); ro.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (fine) main.removeEventListener('pointermove', onMove)
    }
  }, [])
  return null
}

// «+۲,۰۰۰» / «۹۷٪» / «۱۲۰ هزار» → از صفر تا مقدار، با حفظِ پیشوند/پسوند و ارقامِ فارسی.
function countUp(el: HTMLElement) {
  if (el.dataset.counted) return
  el.dataset.counted = '1'
  const raw = el.textContent || ''
  const latin = raw.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٬,]/g, '')
  const m = latin.match(/\d+(?:\.\d+)?/)
  if (!m) return
  const target = parseFloat(m[0])
  if (!isFinite(target) || target <= 0) return
  const dec = (m[0].split('.')[1] || '').length
  const [pre, post] = [latin.slice(0, m.index!), latin.slice(m.index! + m[0].length)]
  const fa = (n: number) => n.toLocaleString('fa-IR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  const faTxt = (s: string) => s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
  const t0 = performance.now(), dur = 1400
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3)
    el.textContent = faTxt(pre) + fa(target * e) + faTxt(post)
    if (k < 1) requestAnimationFrame(step); else el.textContent = raw
  }
  requestAnimationFrame(step)
}
