// دودآزمای سوپرادمین: با مرورگرِ واقعی تک‌تکِ منوها (view=…) را باز می‌کند و
// خطای JS / placeholder «در حال توسعه» / خطای شبکه را گزارش می‌دهد.
// روی سرور:  node scripts/admin-smoke.mjs            (BASE پیش‌فرض: http://127.0.0.1:3001)
// لوکال:     BASE=http://127.0.0.1:3100 node scripts/admin-smoke.mjs
// توکن با JWT_SECRET همان محیط امضا می‌شود (env یا پیش‌فرضِ session.ts).
import { SignJWT } from 'jose'

const BASE = process.env.BASE || 'http://127.0.0.1:3001'
const VIEWS = ('overview,reos,reports,empire,empirePlayers,empireEconomy,empireMissions,empireWorld,empireLiveops,empireAccess,'
  + 'listings,moderation,products,catalog,articles,categories,studio,scraper,persiansaze,'
  + 'users,profiles,agencyintel,crm,roles,suspension,support,'
  + 'plans,payment,promos,discounts,ads,tracker,sms,aicost,smscost,'
  + 'api,connections,geo,sitemap,settings,health,servers,queue,audit,flags').split(',')

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'melkjet-default-secret-change-in-prod')
const token = await new SignJWT({ phone: '09122862184', role: 'super_admin' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret)

// playwright: اول پکیجِ لوکال، بعد گلوبال؛ مرورگر: کرومیومِ playwright یا کرومِ سیستم (سرور).
let chromium
try { ({ chromium } = await import('playwright')) }
catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => ({}))) }
if (!chromium) { console.error('playwright یافت نشد — npm i -D playwright یا نصبِ گلوبال'); process.exit(2) }
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined }).catch(() => chromium.launch({ channel: 'chrome' }))

const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
const host = new URL(BASE).hostname
await ctx.addCookies([{ name: 'mj_session', value: token, domain: host, path: '/' }])
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 200)))
page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('response', r => { if (r.status() >= 500 && r.url().includes('/api/')) errs.push(`API ${r.status()}: ` + r.url().replace(BASE, '').slice(0, 120)) })

let bad = 0
for (const v of VIEWS) {
  errs.length = 0
  try {
    await page.goto(`${BASE}/admin?view=${v}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2500)
    const stub = await page.getByText('این بخش در حال توسعه است').count().catch(() => 0)
    const uniq = [...new Set(errs)]
    if (uniq.length || stub) { bad++; console.log(`${stub ? '⚠️ STUB' : '❌'} ${v}${uniq.length ? ' | ' + uniq.slice(0, 3).join(' ; ') : ''}`) }
    else console.log(`✓ ${v}`)
  } catch (e) { bad++; console.log(`❌ ${v} NAV-FAIL ${e.message.slice(0, 100)}`) }
}
await browser.close()
console.log(bad ? `\n❌ ${bad} منوی مشکل‌دار` : '\n✅ همهٔ منوهای سوپرادمین سالم')
process.exit(bad ? 1 : 0)
