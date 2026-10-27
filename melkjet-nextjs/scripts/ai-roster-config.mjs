#!/usr/bin/env node
// ── نام‌گذاریِ مشاورِ روستر با مدلِ متنیِ خودیِ مالک (qwen) ──────────────────────
// AI نام‌گذاری وقتی روشن می‌شود که (۱) اتصالِ AI روشن باشد (aiEnabled≠false و بخشِ «روستر»
// خاموش نباشد) و (۲) به ایجنتِ متنیِ content/chat مدلی تخصیص داده شده باشد با provider‌ِ
// کلیددار. گپ مُرده (سهمیه تمام)، پس مدلِ qwenِ رویِ سرورِ GPUِ خودت (سازگار با OpenAI،
// http:// روی تونل) وصل می‌شود. چون baseUrl با http:// شروع می‌شود، کد خودکار
// chat_template_kwargs:{enable_thinking:false} می‌فرستد (qwen3 reasoning است و بدونِ آن
// content خالی برمی‌گردد).
//
// ۱) فقط نمایشِ وضعیت (بدونِ تغییر):
//    cd /var/www/melkjet/melkjet-nextjs
//    sudo -E env "PATH=$PATH" node --import ./scripts/reos-loader.mjs scripts/ai-roster-config.mjs
//
// ۲) تنظیم + تستِ زنده (مقادیرِ سرورِ خودت را بگذار):
//    QWEN_BASE="http://127.0.0.1:8000/v1" QWEN_MODEL="Qwen/Qwen3-...-27B" QWEN_KEY="sk-local" \
//    sudo -E env "PATH=$PATH" QWEN_BASE="$QWEN_BASE" QWEN_MODEL="$QWEN_MODEL" QWEN_KEY="$QWEN_KEY" \
//      node --import ./scripts/reos-loader.mjs scripts/ai-roster-config.mjs --apply
//  (QWEN_KEY اختیاری است؛ vLLM معمولاً کلید نمی‌خواهد، ولی کد یک مقدارِ غیرخالی لازم دارد →
//   پیش‌فرض "sk-local". QWEN_BASE باید به ریشهٔ OpenAI برسد؛ کد خودش /chat/completions را اضافه می‌کند.)
//
// خاموش‌کردنِ دوباره: پنل → API و مدل‌های AI → بخشِ «نام‌گذاری مشاور (روستر)» را خاموش کن،
// یا تخصیصِ مدلِ content را بردار.
import { readFileSync, existsSync } from 'node:fs'

function loadEnv(f) {
  if (!existsSync(f)) return
  for (const l of readFileSync(f, 'utf-8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (v.length > 1 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnv('.env.production.local'); loadEnv('.env')

const apply = process.argv.includes('--apply')
const QWEN_BASE = (process.env.QWEN_BASE || '').trim().replace(/\/$/, '')
const QWEN_MODEL = (process.env.QWEN_MODEL || '').trim()
const QWEN_KEY = (process.env.QWEN_KEY || 'sk-local').trim()

const store = await import('../app/lib/admin-store.ts')
const a = store.getAdminData()

const red = (k) => (k ? k.slice(0, 4) + '…' + k.slice(-3) : '(خالی)')
console.log('── وضعیتِ فعلیِ AI ─────────────────────────────')
console.log('aiEnabled      :', a.aiEnabled === false ? 'خاموش ❌' : 'روشن ✅')
console.log('aiAreas.roster :', a.aiAreas?.roster === false ? 'خاموش ❌' : 'روشن ✅ (پیش‌فرض)')
console.log('گپ (پیش‌فرض)    :', a.gapgpt?.apiKey ? `baseUrl=${a.gapgpt.baseUrl || '(پیش‌فرض)'} key=${red(a.gapgpt.apiKey)}` : '(بی‌کلید)')
console.log('providers      :', a.providers ? Object.entries(a.providers).map(([id, p]) => `${id}{${p.baseUrl} ${red(p.apiKey)}}`).join('  ') : '(هیچ)')
console.log('agentModels    :', JSON.stringify(a.agentModels || {}, null, 0))
console.log('defaultModel   :', a.defaultModel || '(خالی)', ' defaultProvider:', a.defaultProvider || '(خالی)')
console.log('')

// پیش‌بینیِ تصمیمِ روستر با وضعیتِ فعلی
const am = a.agentModels || {}
const rosterModel = am.content?.text || am.chat?.text
const rosterProv = am.content?.text ? am.content?.textProvider : am.chat?.textProvider
console.log('→ مدلِ مؤثرِ نام‌گذاریِ روستر الان:', rosterModel ? `${rosterModel} (provider=${rosterProv || 'گپ'})` : '(هیچ — ML-only)')
console.log('')

if (!apply) {
  console.log('حالتِ فقط-نمایش. برای تنظیم، با --apply و متغیرهای QWEN_BASE/QWEN_MODEL[/QWEN_KEY] اجرا کن.')
  process.exit(0)
}

if (!QWEN_BASE || !QWEN_MODEL) {
  console.error('❌ برای --apply باید QWEN_BASE و QWEN_MODEL داده شوند (QWEN_KEY اختیاری).')
  process.exit(1)
}
// نگهبانِ مقادیرِ نمونه/نامعتبر (ریشهٔ یک خرابیِ واقعی: اجرا با PORT/«نامِ-دقیقِ-مدل»ِ نمونه،
// کانفیگِ سالم را رونویسی کرد). baseUrl باید URLِ واقعی باشد و هیچ‌کدام placeholder نباشند.
try { new URL(QWEN_BASE + '/chat/completions') } catch {
  console.error(`❌ QWEN_BASE یک URLِ معتبر نیست: ${QWEN_BASE} — مثال: http://127.0.0.1:8010/v1`)
  process.exit(1)
}
const bad = (s) => /PORT|نام|<|>|placeholder|example/i.test(s)
if (bad(QWEN_BASE) || bad(QWEN_MODEL)) {
  console.error('❌ به‌نظر مقدارِ نمونه داده‌ای (PORT/«نامِ-دقیقِ-مدل»/…). مقادیرِ واقعیِ سرورِ خودت را بگذار؛ هیچ تغییری اعمال نشد.')
  process.exit(1)
}

// ۱) provider «qwen» + تخصیصِ مدل به content + روشن‌کردنِ AI و بخشِ روستر
const next = { ...a }
next.providers = { ...(a.providers || {}), qwen: { label: 'qwen (سرورِ خودی)', baseUrl: QWEN_BASE, apiKey: QWEN_KEY } }
next.agentModels = { ...(a.agentModels || {}), content: { ...(a.agentModels?.content || {}), text: QWEN_MODEL, textProvider: 'qwen' } }
next.aiEnabled = true
next.aiAreas = { ...(a.aiAreas || {}), roster: true }
next.defaultModel = QWEN_MODEL
next.defaultProvider = 'qwen'
store.saveAdminData(next)
console.log(`✅ تنظیم شد: provider=qwen base=${QWEN_BASE} model=${QWEN_MODEL} → content.text + defaultModel؛ aiEnabled=روشن، روستر=روشن.`)
console.log('')

// ۲) تستِ زنده — عینِ مسیرِ تولید (chatCompleteSafe با enable_thinking:false برای http://)
console.log('── تستِ زندهٔ مدل (نام‌گذاریِ یک آگهیِ نمونه) ──')
try {
  const { aiCanonical } = await import('../app/lib/agency-roster.ts')
  const sample = [{ i: 0, title: 'فروش آپارتمان ۹۰ متری سعادت‌آباد', desc: 'نوساز، فول امکانات. جهت هماهنگی و بازدید: کارشناس فروش محمدی' }]
  const t = Date.now()
  const { map, raw } = await aiCanonical(sample)
  console.log('خروجیِ مدل:', JSON.stringify(map), ` (${Date.now() - t}ms)`)
  if (map[0]) console.log('✅ qwen کار می‌کند — نامِ نمونه:', map[0], '(انتظار: محمدی)')
  else { console.log('⚠️ مدل نامی برنگرداند. raw پاسخ (۳۰۰ نویسهٔ اول):'); console.log(String(raw).slice(0, 300)) }
} catch (e) {
  console.error('❌ تستِ زنده خطا داد:', String(e?.message || e).slice(0, 300))
  console.error('   (baseUrl/پورت/مدل را چک کن؛ باید به ریشهٔ OpenAI برسد و /models را بدهد.)')
}
process.exit(0)
