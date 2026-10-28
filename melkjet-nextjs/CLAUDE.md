@AGENTS.md

# MelkJet Project Notes

## ⚠️ مشخصاتِ قطعیِ سرور (نامِ هاست گمراه‌کننده است!)
**۴ vCPU · ۸ GB RAM · ۳۵ GB Disk.** نامِ هاستِ لینوکس `ubuntu---1-vcpu---2-gb-ram` است و
**دروغ** می‌گوید — این عدد را هرگز مبنا نگیر. سرور ۴ هسته و ۸ گیگ است، نه ۱ هسته/۲ گیگ.
نتیجه‌ها: (۱) بیلد باید از چند هسته استفاده کند (CPUQuota=۳۰۰٪، نه ۷۰٪ که ۰.۷ هسته است)؛
(۲) «مرگِ سرور با دیپلوی» از رمِ ۸گیگ بود که بودجهٔ اینستنس‌ها (۲۶۰۰M+۳×۱۳۰۰M≈۶.۵G)+پستگرس
آن را پر می‌کرد — نه ضعفِ CPU؛ (۳) اشباعِ استخرِ پستگرس (connect/statement timeout) دربارهٔ
«تعدادِ اتصال و قفل» بود نه CPU، پس acquire-retry + statement۴۵s راه‌حلِ درست بود، ولی conc=1
شاید لازم نباشد (با ۴ هسته می‌شود ROSTER_SYNCS=2 را دوباره امتحان کرد پس از پایدارشدن).

# MelkJet Project Notes

## Deploy Command (ALWAYS use this exact path)
```bash
cd /var/www/melkjet/melkjet-nextjs && git pull && npm run build && pm2 reload ecosystem.config.js
```
Better: `sudo scripts/deploy.sh` — same steps but **health-checks localhost:3001-3003 after
reload**, so a broken deploy is caught immediately (not from the browser).

### دیپلوی خودکار — «پوش به main = رفتن روی سرور» (فاز ۲۷۵)
سه مسیر وجود دارد و هر سه به یک `deploy.sh`/`auto-deploy.sh` می‌رسند:
1. **کرونِ سرور (فعالِ اصلی):** `scripts/auto-deploy.sh` هر ۲ دقیقه `origin/main` را چک می‌کند و
   اگر پوشِ جدیدی بود pull+build+reload+هلث‌چک می‌کند. نصب (یک‌بار، روی سرور، کاربرِ root):
   `*/2 * * * * /var/www/melkjet/melkjet-nextjs/scripts/auto-deploy.sh >> /var/log/melkjet-deploy.log 2>&1`
   به هیچ سکرت/کلیدِ SSH نیاز ندارد. لاگ: `tail -f /var/log/melkjet-deploy.log`.
2. **دکمهٔ گیت‌هاب:** تبِ Actions → «Deploy to server» → Run workflow (SSH → `sudo scripts/deploy.sh`).
   سکرت‌های لازم: `DEPLOY_HOST/USER/PORT/SSH_KEY`. ⚠️ ورک‌فلو باید در **ریشهٔ ریپو** بماند
   (`melkjet/.github/workflows/`) — قبلاً داخلِ `melkjet-nextjs/.github/` بود و برای همین گیت‌هاب
   هرگز نمی‌دیدش و یک‌بار هم اجرا نشد.
3. **دستی:** `sudo scripts/deploy.sh`.
**قفلِ مشترک:** هر دو اسکریپت روی `/tmp/melkjet-deploy.lock` قفل می‌گیرند — کرون اگر قفل گرفته باشد
رد می‌شود، دستی/دکمه‌ای منتظر می‌ماند. دو build هم‌زمان `.next` را خراب می‌کند (همان کرش‌لوپِ بالا).
**نکته:** `auto-deploy.sh` اگر `git fetch` شکست بخورد (پروکسیِ گیت‌هاب در کرون نیست) دیگر بی‌صدا
نمی‌میرد — در لاگ فریاد می‌زند (قانونِ شمارهٔ یک).
**buildِ شکسته دیگر دیپلوی را نمی‌کُشد:** ENOTEMPTY (گلیچِ `.next`ِ کهنهٔ توربوپک) خودکار با
`rm -rf .next` + buildِ دوباره درمان می‌شود. و چون بعدِ `git pull` مقدارِ HEAD با origin یکی می‌شود،
یک buildِ شکسته باعث می‌شد کرون تا ابد بی‌صدا رد شود و سرور روی نسخهٔ نیمه‌کاره بماند — حالا مارکرِ
`.deploy-failed` (gitignore) این حالت را زنده نگه می‌دارد تا دورِ بعدِ کرون همان کامیت را دوباره
build کند. مارکر فقط پس از `pm2 reload`ِ موفق پاک می‌شود.

## Why deploys used to break ("This page couldn't load" / crash-loops) — FIXED, keep it fixed
Two independent root causes, both now closed:
1. **Missing `app/not-found.tsx`** → Next 16 + Turbopack failed to emit
   `_not-found/page_client-reference-manifest.js`, so EVERY 404 (bots, old links, a
   missing chunk) threw `InvariantError: client reference manifest … does not exist` and
   crash-looped the instance (saw ↺ 76). **NEVER delete `app/not-found.tsx`.** If the
   invariant ever returns, `rm -rf .next && npm run build` and confirm that manifest file exists.
2. **`auto-deploy.sh` had `pm2 restart melkjet`** — wrong name (procs are `melkjet-3000..3003`),
   so on cron it built (overwriting `.next`, deleting old chunks) then died at the restart via
   `set -e`, leaving old instances pointed at deleted chunks → 500s until a manual reload. Fixed
   to `pm2 reload ecosystem.config.js --update-env` + health check.
3. **Arvan CDN** must cache ONLY `/_next/static/*` (immutable, versioned) and **NEVER HTML or
   /api**. next.config already sends `no-cache` on HTML + `no-store` on /api, but confirm the
   Arvan panel's cache rules don't override and cache HTML. If HTML is never edge-cached, a
   deploy can't serve stale markup and you never need to purge. (If it does cache HTML: purge
   after every deploy — panel → CDN → clear cache.)
After deploy, **purge the Arvan CDN cache** (panel → CDN → clear cache) — otherwise
the CDN serves stale HTML pointing at old CSS/JS chunks and the whole site looks
unstyled ("گرافیک ریخت"). next.config sets `no-cache` on HTML + `immutable` on
`/_next/static` to mitigate this, but a purge after deploy is the sure fix.
Quick check after deploy: Ctrl+Shift+R — if styling returns, it was the cache.

## Server
- VPS: 94.101.176.251 (Arvan Cloud — IP changed 1405/04, old: 185.206.95.40) — **4 vCPU / 8 GB RAM / 25 GB SSD**
  (the hostname `1-vcpu-2-gb` is stale/misleading; `free -h && nproc` confirm 4/8).
- Path: /var/www/melkjet/melkjet-nextjs
- Process: **4 pm2 fork instances** named "melkjet" on ports 3000–3003, behind
  nginx load-balancer (`docs/nginx-loadbalance.conf`). Config: `ecosystem.config.js`.
  Start once: `pm2 start ecosystem.config.js && pm2 save`. Deploy: `pm2 reload ecosystem.config.js`.
  **Instance 0 (port 3000) is the cron/Chrome worker** (NODE_APP_INSTANCE=0 runs the
  persiansaze scrape via headless Chrome, which blocks its event loop for seconds) — so
  nginx marks 3000 as `backup` (out of the user rotation). User traffic → 3001/3002/3003.
  Instance 0 warms the other three (WARM_PORTS env) so they never serve cold.
- Domain: melkjet.com (Arvan CDN handles HTTPS)

### ⚠️ NEVER use pm2 cluster mode with `next start`
`next start` binds the PORT itself instead of using pm2's shared cluster socket,
so all cluster workers fight over port 3000 → `EADDRINUSE` → infinite crash-loop
(↺ in the hundreds of thousands, 100% CPU, static chunks return 500 `ERR_ABORTED`).
Use **fork mode, one port per instance** (ecosystem.config.js) + nginx upstream.
Only NODE_APP_INSTANCE=0 runs cron/Chrome (cron-runner.ts) so scraping stays single.
If you ever see chunk 500s + huge ↺: `pm2 delete melkjet; pm2 kill; pkill -9 -f next-server;`
then `pm2 start ecosystem.config.js`.

## Scrape architecture (scale — user-facing instances do ZERO heavy work)
The Divar scrape/import is a **queue processed only on instance 0** (the cron worker):
- **User request → enqueue only.** `startBackgroundSync()` (called from `/api/advisor/divar`
  on a user-facing instance 3001-3003) just sets the job to `queued` and returns instantly —
  NO prepareSync/runBatch in-process. So user traffic is never slowed by scrapes.
- **Instance 0 cron drives the queue** (`cron-runner.ts` → `queueTick` every 45s):
  `driveJob()` picks up `queued`/`paused` jobs up to `MAX_ACTIVE_SYNCS=2` (global concurrency
  cap). 1000 advisors syncing = one orderly queue, not 1000 parallel loops.
- **Moderation is BATCHED** (`moderatePending` in queueTick), NOT per-listing during import —
  avoids one AI call per listing (was 100k+ AI calls at scale). Enrichment stays "at scrape
  time" but via the throttled warm-queue (`WARM_CONCURRENCY=2`), on instance 0.
- Job model: `advisor-divar-job.ts` (`queued`/`cfg`/`queuedAt`, `listQueuedJobs`,
  `countActiveJobs`). `driveJob` sets `running:true` synchronously before the first await so the
  concurrency cap is race-free.
- NEVER run scrape/enrich/moderate on user-facing instances again. If throughput needs to grow,
  raise `MAX_ACTIVE_SYNCS` or move the job queue to PG — do not move work back onto the request path.

## Stack
- Next.js 16.2.9 (App Router) — use `proxy.ts` not `middleware.ts`, function named `proxy` not `middleware`
- Auth: JWT via `jose`, cookie `mj_session`, 30-day expiry
- Super admin phone: 09122862184
- Admin email: naeiniamini@gmail.com

## Networking (CRITICAL — this caused long debugging)
The VPS egress is restricted. Each external service has a different path:
- **GapGPT (AI, api.gapgpt.app)** → DIRECT, never via proxy. It's domestic but
  `.app` needs Shecan DNS to resolve. The foreign proxy EMPTIES its responses.
  `app/lib/gapgpt.ts` is direct-only.
- **Divar (api.divar.ir)** → via HTTP proxy (`http://127.0.0.1:1080`), saved in
  admin → «پروکسی دیوار». Direct is DNS/filter-blocked.
- **github / foreign** → need `proxy-on` for manual git.
- **Shecan DNS**: GapGPT now resolves DNS via Shecan *inside the app*
  (`app/lib/shecan-https.ts` — custom `lookup` on the https request, independent
  of `/etc/resolv.conf`), so a reset resolv.conf no longer breaks AI. Still good
  to keep `/etc/resolv.conf` on Shecan (178.22.122.100 + 185.51.200.2, `chattr +i`)
  for Divar/Neshan. Neshan errors are usually key-permission (485 "services not
  match" → enable Search + Distance-Matrix on that service key), not DNS.
- Test AI from server: `node -e 'fetch("https://api.gapgpt.app/v1/chat/completions",{...})'`
  should return STATUS 200.

### فیلترشکنِ داخلیِ v2ray/Xray (فاز ۲۹۹) — پراکسیِ خروجیِ خارجی
به‌جای عوض‌کردنِ دستیِ لینکِ پروکسیِ HTTP (که مدام قطع می‌شد)، سوپرادمین → اتصال‌ها →
«v2ray (فیلترشکن داخلی)» یک لینکِ کانفیگ (vmess/vless/trojan/ss) یا لینکِ اشتراک می‌گیرد.
- **`app/lib/v2ray.ts`**: لینک را به outboundهای Xray پارس می‌کند (`buildOutbounds`)، کانفیگ
  با **inboundِ HTTP محلی (127.0.0.1:10809)** + **observatory + balancer(leastPing)** می‌سازد،
  و Xray را **فقط روی اینستنسِ ۰** اجرا می‌کند. خودِ Xray سریع‌ترین سرورِ سالم را انتخاب و
  failover می‌کند — نیازی به ping/swapِ دستی نیست.
- چون Xray روی `127.0.0.1` همان میزبان است، همهٔ اینستنس‌ها به پروکسی دسترسی دارند؛ ولی
  پروسه/وضعیت فقط روی کارگر است → `.v2ray/status.json` پلِ اشتراکیِ وضعیت است (کارگر هر ۴۵ث
  در `queueTick` با `syncV2ray()` می‌نویسد؛ freshness < ۱۲۰ث).
- مصرف: `outboundProxyUrl()` = v2ray → divar.proxyUrl → env. `telegram.ts` از همین اول v2ray
  را امتحان می‌کند. برای هر مصرف‌کنندهٔ خارجیِ جدید هم از `outboundProxyUrl()` استفاده کن.
- **نصبِ باینری (یک‌بار روی سرور):** `sudo bash scripts/install-xray.sh` → `bin/xray`. اگر نبود،
  کارت وضعیتِ «نصب نیست» را با همین دستور نشان می‌دهد. کاملاً opt-in: تا روشن نشود، هیچ پروسه‌ای
  بالا نمی‌آید و رفتارِ فعلی عوض نمی‌شود. `.v2ray/` و `bin/xray` در gitignore (شاملِ کلیدِ سرورها).
- تست: `node --import ./scripts/reos-loader.mjs scripts/v2ray-parse-test.mjs` (۲۶ تستِ پارس/کانفیگ).

### رباتِ چندسکویی تلگرام + بله (فاز ۳۰۰)
Bot APIِ بله (`tapi.bale.ai`) سازگار با تلگرام است، پس همان هستهٔ ۴۴۴خطیِ ربات (جستجو/آلارم/
ثبتِ آگهی) برای هر دو کار می‌کند — بدونِ کپیِ منطق.
- **`app/lib/bot-ctx.ts`**: `AsyncLocalStorage` «سکوی جاری» را نگه می‌دارد. `tgBotCtx()` (تلگرام،
  با پروکسی/v2ray) و `baleBotCtx()` (بله، **مستقیم — داخلی، بدونِ تونل**). پیش‌فرضِ بدونِ ctx = تلگرام
  → همهٔ مصرف‌کننده‌های قبلی بی‌تغییر.
- `telegram.ts` (ترنسپورت) و `telegram-store.ts` (انبار) از سکوی جاری می‌خوانند: کلیدها با
  پیشوندِ `bale:` جدا می‌شوند تا chatIdهای دو پلتفرم قاطی نشوند (tg بدونِ پیشوند = سازگاریِ عقب‌رو).
  Sub/Link فیلدِ `platform` دارند؛ `notifyNewListings` هر آلارم را از ترنسپورتِ سکوی خودش می‌فرستد.
- هسته: `handleBotUpdate` از `app/api/telegram/webhook/route.ts` export می‌شود؛ `app/api/bale/webhook`
  همان را در `botALS.run(baleBotCtx(), …)` اجرا می‌کند. رمزِ وب‌هوکِ بله در query (`?s=…`) است
  (پشتیبانیِ بله از هدرِ secret قطعی نیست).
- راه‌اندازی: سوپرادمین → اتصال‌ها → «بله (ربات پیام‌رسان)» → توکن از @botfatherِ بله → «ذخیره و روشن»
  (setWebhook خودکار به `PUBLIC_BASE_URL||melkjet.com/api/bale/webhook`). کاملاً opt-in.
- تست: `node --import ./scripts/reos-loader.mjs scripts/bot-multiplatform-test.mjs` (۱۱ تستِ جداسازی).
- **فاز ۳۰۳د — لوکیشنِ دقیق + دسترسی‌های واقعیِ نقشه در ثبتِ آگهیِ ربات:** مرحلهٔ اختیاریِ
  «📍 ارسالِ موقعیت» (دکمهٔ `request_location` — در بله و تلگرام) مختصات را می‌گیرد؛ سرور با
  `reverseGeocode` آدرس/محله را تأیید و با `computeNearby` دسترسی‌های واقعی (مترو/پارک/مدرسه…
  با زمانِ پیاده) را از NexaMap می‌کشد. این‌ها به‌شکلِ «گراندشده» (با قیدِ «طبقِ نقشه») واردِ
  متنِ آگهی می‌شوند — جایگزینِ ادعای جعلیِ «۵ دقیقه تا مترو». مختصات در meta `__lat/__lng`
  می‌نشیند (نقشهٔ صفحهٔ آگهی). هر دو فراخوانِ نقشه با سقفِ زمان (۵/۹ث) تا وب‌هوک معطل نماند؛
  مرحله کاملاً اختیاری و رد‌شدنی است (اگر بله location ندهد، جریان بی‌وقفه ادامه دارد).

## Responsive System
CSS variables are used in inline styles. To make elements responsive:
1. Add `className="xyz"` to the JSX element
2. Add `@media(max-width:Npx){.xyz{property:value!important}}` to `app/globals.css`
The `!important` is REQUIRED to override inline styles.

---

# PROJECT STATE & CONTINUATION GUIDE
Read this to resume work in a fresh session. **Everything is committed to git** — the
repo + this file are the source of truth, no chat history needed.

## ⚙️ زیرساختِ دیتابیس — pgbouncer + تیونِ PG + ممیزیِ ML-only (۱۸ اکتبر ۲۰۲۶، بحرانِ یک‌روزه)
یک روزِ کامل «اتصال/تایم‌اوت storm» (connect/statement timeout) که سایت/ممیزی/تلگرام را می‌خواباند.
ریشه: PostgreSQL روی **همان باکسِ ۸گیگِ مشترک با ۴ اینستنسِ اپ**، و همهٔ نوشتن‌ها از یک قفلِ
`scraper_meta FOR UPDATE` سریال می‌شدند؛ یک «همگام‌سازیِ همهٔ بک‌لاگ» (runRequested روی هر ۱۳۲
آژانس) وسطِ روز دیتابیس را قُرق کرد. راه‌حلِ لایه‌ای که **حالا فعال است**:
- **pgbouncer (transaction pooling) فعال است** — `DATABASE_URL` روی **پورت 6432** (نه 5432).
  نصب/کانفیگ: `scripts/ops/setup-pgbouncer.sh` (+ `pgbouncer-smoketest.mjs` که عینِ اپ تست می‌کند).
  ریپو برای transaction-mode امن است (نه LISTEN/NOTIFY، نه prepared stmt، نه advisory lockِ نشستی).
  برگشت: `DATABASE_URL` را به 5432 برگردان + `pm2 reload --update-env`. رانبوک: `docs/INFRA-DB.md`.
- **تیونِ PG:** `scripts/ops/pg-tune.sh` → `conf.d/melkjet-tuning.conf` (چک‌پوینتِ هموار ریشهٔ PANIC،
  `max_wal_size=3GB`، `shared_buffers=512MB`، autovacuum تهاجمی‌تر). همه reloadی جز shared_buffers.
- **قفلِ `scraper_meta` هنوز هست** — «نوشتنِ بدونِ‌قفلِ ممیزی» کارِ بازِ بعدی است (اگر دوباره
  روستر ممیزی را خفه کرد). پایدارترین گام: PG روی سرورِ جدا (با pgbouncer فقط host عوض می‌شود).
- **ممیزیِ خودکار «فقط ML» (فاز ۳۱۱):** smartVerdict دیگر AIِ گپِ مرده را صدا نمی‌زند (ریشهٔ «خودش
  اتومات تأیید نمی‌کرد» — آگهی در pendingِ unsettled گیر می‌کرد). نامطمئن که از گیت‌های قطعی گذشت →
  طبقِ pendingPolicy (پیش‌فرض approve) حکمِ قطعی. کشِ ایندکسِ تکرار (فاز ۳۱۰، TTL ۳د) هم ممیزی را سبک کرد.
- **تأییدِ دستیِ تکی → تلگرام (فاز ۳۰۹ن):** با `force` گاردِ ۶ساعته را رد می‌کند؛ گروهی عمداً ساکت.
- **شفافیتِ تکرار (فاز ۳۱۲):** دلیلِ «تکراری» حالا عنوان+کد+متراژِ آگهیِ مرجع را نشان می‌دهد.
- **توقفِ اضطراریِ روستر:** `scripts/roster-pause.mjs` روی همهٔ روسترها requestStop می‌زند.
- **«همگام‌سازیِ همه» پله‌ای شد (فاز ۳۱۳):** فقط N کهنه‌ترین (cap=۸) الان، بقیه در پنجرهٔ شب.
- **ROSTER_SYNCS=1** در `.env.production.local` (سریال — ضدِ اشباعِ استخر).

## PostgreSQL migration (IN PROGRESS — gated by DATABASE_URL)
- **`app/lib/db.ts`** = pg Pool + `kv(key jsonb)` layer: `kvGet`/`kvSet`/`kvMutate`
  (kvMutate = atomic read-modify-write with `FOR UPDATE` row lock → no lost concurrent writes).
- **Dual-mode**: every migrated store checks `pgEnabled()` (=`!!process.env.DATABASE_URL`).
  No DATABASE_URL → behaves exactly like the old file store. So production is unchanged until enabled.
- **LIVE ON SERVER (DATABASE_URL is set in `.env.production.local`).** Enable was:
  create DB+user, `node scripts/migrate-to-pg.mjs` (copies .*-data.json → kv), put
  `DATABASE_URL` in `.env.production.local` (gitignored, Next auto-loads at runtime),
  `pm2 reload --update-env`. Kill-switch: remove that env line + reload. **Password `@` MUST be
  URL-encoded as `%40`** in the URL (e.g. `AMin1535%4012`) — a raw `@` breaks URL parsing.
- **Migrated to async+PG (28 stores):** messages, leads, crm, workflow, pros, sites, buyer,
  contacts, advisor, agency, owner, materials, user, listing-stats, comm, builder, ticket,
  outreach, contact-log, saved-search, assistant, floorplan, tracker, tracker-links +
  **scraper-store** (listings/articles/sources — kv blob + 2.5s read-cache on the PG path;
  items hard-capped at 1000 so the blob stays small) + async lib helpers (agency-link-store,
  duplicate-check, agency-team). All call sites `await`; the async cascade reaches
  compare-normalize/market-stats/price-forecast/promotion/listing-dedupe and their callers.
- **STILL ON FILES (intentional — config/read-mostly, single-writer, no concurrent-write risk):**
  account, role, admin, geo, category, plan, cost, sms-cost, payment; and heavy read-only caches
  enrich (~7MB), persiansaze (~6MB), moderation-ml, market-data. Migrating these adds risk for no
  scale benefit. (Small stores reviews/push/audit/pending-reg also still on files — low-traffic.)
- **BACKUP:** `scripts/backup.sh` dumps BOTH PostgreSQL (`pg_dump`) AND the on-disk `.*-data.json`
  files (config still lives there), gzips, rotates (KEEP_DAYS=14), logs. Install as root cron:
  `30 3 * * * /var/www/melkjet/melkjet-nextjs/scripts/backup.sh >> /var/log/melkjet-backup.log 2>&1`.
  Restore steps are in the script header. Backups → `/var/backups/melkjet`.
- **Health panel** (admin → «سلامت سیستم») now shows live PostgreSQL status (connected? kv rows?
  db size? top keys?) via `pgStats()` in db.ts — the on-disk record counts above it are stale
  post-migration (files are frozen snapshots; live data is in PG).

### scraper-store LISTINGS NORMALIZED (permanent 504 fix — `listings` table, not a kv blob)
Root cause of recurring 504s + slowness: **every listing lived in ONE `kv('scraper')` jsonb blob**
(~1 MB, up to 1000 items). Each public page read pulled the whole blob; each write rewrote it under
a global `FOR UPDATE` lock → the pg pool (max 10) saturated → `Error: timeout exceeded when trying
to connect` (db.ts) → nginx 504. It was NOT CPU/RAM/Arvan (load avg was ~0.5).
- **Fix (db.ts + scraper-store.ts):** items now live in a normalized **`listings` table** (one row
  per item, indexed on `scraped_at`/`type`). Reads come from the table, **cached 15 s** (`PG_TTL`),
  lock-free, and **serve the stale cache on a transient DB error** instead of 500/504. Writes take a
  small **`FOR UPDATE` lock on the tiny `scraper_meta` row** and **sync only the changed rows** (diff)
  — the big blob is never rewritten. `mutate(fn)` still runs the exact same in-memory logic (zero
  rewrite of the ~20 store functions → low risk).
- **Metadata split:** small config (sources/categories/owners) lives in **`kv('scraper_meta')`**;
  the original **`kv('scraper')` blob is left FROZEN as a rollback backup** (never touched after
  migration). So reverting to old code still finds listings in the old blob — the site won't go empty.
- **Auto-migration:** first load/mutate copies the old blob's items → `listings` and creates
  `scraper_meta`; idempotent + race-safe across the 4 instances (serialized via the FOR UPDATE lock +
  a `scraper_meta` existence re-check). No manual script needed.
- **pool:** `max` 10 → 15 per instance (4×15=60 < 100) + `statement_timeout: 15s` (db.ts).
- **nearby.ts:** «دسترسی‌های اطراف» now cached 6 h per rounded lat/lng — each property view used to
  fire up to 8 Neshan searches + a slow AI path, holding a request 10–30 s (also in the 504 log).
- **Verified:** 21-test integration suite on a real local PostgreSQL 16 (migration, CRUD, dedup,
  owner-phone propagation, article uniqueness, cascade delete, rollback-safety, 3-way concurrency).
- If listings ever look empty after deploy: check `SELECT count(*) FROM listings;` and that
  `kv('scraper_meta')` exists. To force a clean re-migrate: `DELETE FROM kv WHERE key='scraper_meta';
  TRUNCATE listings;` then reload (old `scraper` blob re-seeds them).

### scraper-store — بازخوانیِ افزایشی و نوشتنِ هدفمند (۲۰ سپتامبر ۲۰۲۶)
«همه جای سایت کند شده» — ریشه با اندازه‌گیری پیدا شد، نه حدس. `listings` الان
**۴۶٬۴۰۹ ردیف / ۱۶۶ MB** است و یک `SELECT data FROM listings` کامل **۲٫۵–۴٫۳ ثانیه** می‌گیرد.
این هزینه دو جا پرداخت می‌شد (ممیزی: `scripts/users-page-check.mjs` → ۲۱٫۵ ثانیه برای یک صفحه،
۹۸٪اش یک فراخوان):
- **نوشتن:** `mutate` همان SELECT کامل را داخلِ تراکنش می‌زد و همه را stringify می‌کرد،
  با قفلِ `FOR UPDATE` روی متاداتا در دست — برای هر ۲۸ صدازننده‌اش.
- **خواندن:** هر تغییرِ rev (و هر نوشتنی rev را بالا می‌برد) کلِ جدول را در هر چهار
  اینستنس دوباره می‌خواند؛ کفِ ۱۵ ثانیه‌ای و خواندنِ ۳ثانیه‌ای = عملاً همیشه در حالِ بارگزاری.

**دو نیمهٔ راهِ حل:**
1. `mutateMeta` (جدید) برای نوشتنِ فقط-متاداتا — جدول را اصلاً نمی‌خواند. به آن منتقل شدند:
   addSource / updateSource / addCategory / deleteOwner / markError. و `setItemCoords` و
   `setItemStatus` به `mutateSome` رفتند (اولی داغ‌ترین نویسندهٔ سایت است: غنی‌سازی
   برای هر آگهیِ دارای مختصات). **۲۲ → ۱۵** مسیرِ نوشتنِ کلِ جدول.
2. **لاگِ تغییر در متاداتا (`__log`)**: هر نویسنده می‌نویسد کدام شناسه‌ها را upsert/حذف
   کرده؛ `applyDelta` در `load()` فقط همان‌ها را می‌کشد. **بدونِ تغییرِ اسکیما.**
   سقف‌ها: `LOG_MAX=120` ورودی، `LOG_IDS_MAX=200` شناسه در هر rev (بیشتر → مارکرِ `full`)،
   `LOG_IDS_BUDGET=2000` در کل — وگرنه خودِ لاگ همان بلابِ زیرِ قفلِ قبلی می‌شد.

**دو پلِ ایمنی که نباید برداشته شوند:** (الف) اگر لاگ تمامِ فاصلهٔ rev را پوشش ندهد
(مانندِ اسکریپتی که مستقیم SQL می‌نویسد)، دلتا رد می‌شود و بازخوانیِ کامل انجام می‌شود؛
(ب) هر `FULL_RESYNC_MS=10min` یک بازخوانیِ کامل حتی اگر لاگ سالم باشد.

**تست:** `scripts/scraper-delta-test.mjs` روی PostgreSQLِ واقعی (۱۳ تست). نوشتنِ
«اینستنسِ دیگر» را با SQL خام شبیه‌سازی می‌کند — چون نویسندهٔ خودی `pgCache` را null
می‌کند و مسیرِ دلتا را نمی‌آزماید. **دادهٔ تست باید واقعاً متمایز باشد**؛ بارِ اول
۱۲ درج به ۱ ردیف رسید چون گیتِ تکراری همه را یکی دید.

**ابزارِ اندازه‌گیری (همه فقط-خواندن، بدونِ دیپلوی):** `users-page-check.mjs` (مرحله‌به‌مرحلهٔ
یک صفحه + حجمِ پاسخ)، `listings-load-check.mjs` (کامل در برابرِ دلتا)،
`load-profile.mjs` (تفکیکِ مراحل: ensureSchema در برابرِ خودِ بارگزاری).

### advisor-store PER-OWNER SHARD (فاز ۲۵۹ — permanent fix for statement-timeout / slow graduate / instance-0 death)
Root cause of the roster-scrape meltdown (46s/token, 633s graduate, `statement timeout`, instance-0
crash-loop): **the whole `kv('advisor')` blob was ONE row holding ALL owners** — it had grown to
**58 MB / 3708 owners / 27k listings**. EVERY advisor write (a lead stage change, a Divar import,
a graduate move) rewrote all 58 MB under a single global `FOR UPDATE` lock. With 3 concurrent syncs
the pool serialized on that one row → `canceling statement due to statement timeout` → cascading fail.
- **Fix (advisor-store.ts + db.ts):** each owner is now its own kv key **`advisor:{owner}`** (~16 KB
  each). `getAdvisor`/`mutate` lock only that owner's row → two owners never contend, and a write
  copies ~16 KB not 58 MB. The 3 cross-owner readers (`allAdvisorProfiles`, `advisorWorkSummary`,
  `mergeAdvisorData`) use a **prefix scan** via new `db.ts` helpers **`kvGetPrefix(prefix)`** +
  **`kvDelete(key)`**. Every exported signature is unchanged → callers untouched. File-mode path
  (no DATABASE_URL) is unchanged; only the PG path shards.
- **Auto-migration:** one-time, idempotent, race-safe across the 4 instances (marker
  `kv('advisor_migrated_v2')` locked via pgTx `FOR UPDATE`; `INSERT … ON CONFLICT DO NOTHING` per
  owner). The old `kv('advisor')` blob is left **FROZEN** as rollback backup (never written again).
- **Marker/keys note:** owner keys are `advisor:%` (colon); the migration marker is `advisor_migrated_v2`
  (NO colon) and the legacy blob is bare `advisor` — so neither is caught by the `advisor:%` prefix scan.
  No other store uses an `advisor:`-prefixed kv key (verified).
- Committed `e3dd760`. Verified live: migration ran (3717 owners), sampled owners intact, graduate
  completes `ok=true` with no timeout. **After this, per-token time is Divar-bound, not DB-bound** (below).

### Divar scrape: per-IP throttle + rotating proxy pool (فاز ۲۶۰)
After the advisor shard, the remaining ~40s/token is **Divar's anti-scrape throttle, per source-IP**
(proven: a SOLO `fetchDivarPost` is <1 s, but under ~9 concurrent requests from one IP Divar delays
each response to 30–50 s; log shows thousands of `[roster] divar کند/محدود` backoff messages). This is
NOT our code — Divar rate-limits scraping by IP. Kenar (kenar.divar.dev, Divar's official OAuth API)
was rejected by the user (consent-per-ad model + they say it's down) → **direct scrape stays the way**.
- **Rotating proxy pool (`app/lib/divar-proxy-pool.ts`, committed `b56afe8`):** `pickDivarProxy()`
  round-robins requests across multiple proxies (distinct IPs) so each IP stays under Divar's ceiling;
  `reportDivarProxy()` puts a failing/429/timeout proxy into exponential cooldown (5s→5min). Wired into
  `fetchDivarProfileTokens` (per page), `fetchDivarPost` (per retry attempt), and `scrapeDivar` (per page).
- **Config source is SEPARATE from the single `divar.proxyUrl`** (which telegram/web-push/search-console/…
  read as one URL and would break if made multi-value). Pool reads, in order: env **`DIVAR_PROXIES`**
  (comma/newline-separated) → optional admin field `divar.proxyPool` → fallback the single `divar.proxyUrl`.
  **Empty `DIVAR_PROXIES` = exact previous behavior (one proxy).** IPs must be **Iranian** (Divar filters
  foreign IPs). Activate with zero code:
  `DIVAR_PROXIES=http://127.0.0.1:1080,http://user:pass@<ir-ip2>:<port>,http://<ir-ip3>:<port>` in
  `.env.production.local` + `pm2 reload ecosystem.config.js --update-env`. `divarProxyStatus()` reports pool health.
- **Concurrency tuning (env, on instance 0):** `ROSTER_SYNCS` = agencies synced in parallel,
  `ROSTER_CONCURRENCY` = token fetches per agency. Total concurrent Divar requests = SYNCS × CONCURRENCY.
  On ONE IP, keep total ≈ 4 (throttle-free; 9 throttled hard). Current: **`ROSTER_SYNCS=4`,
  `ROSTER_CONCURRENCY=1`** (4 agencies parallel, throttle-safe) — drains the one-time 155-agency backlog
  fastest without throttling. With N proxies you can raise total to ~4×N. NOTE: the first sync of all
  agencies is a one-time multi-hour backlog; daily updates are incremental+cached (fast).
- **`advisor-divar-store` is still a single 3.3 MB file** (`.advisor-divar-data.json`, all owners' import
  records, rewritten per `recordImport`). NOT the bottleneck (single-process on instance 0, no lock
  contention, ~30 ms/write). A future per-owner shard (same pattern as advisor-store) is optional hygiene, not urgent.
- **`.next` ENOTEMPTY on build** (`rmdir … not empty`) is a Turbopack stale-`.next` glitch, unrelated to
  code — fix with `rm -rf .next && npm run build`. A build killed mid-way (Ctrl-C) corrupts `.next` and the
  NEXT instance restart fails with "Could not find a production build" → crash-loop; always let `npm run build`
  finish, then `pm2 reload`.

## ⛔ قانونِ شمارهٔ یک — هیچ کاری نباید بی‌صدا بمیرد (NEVER LET WORK STALL)
**بزرگ‌ترین وظیفهٔ دستیار در این پروژه.** بارها یک ماژول/ورک‌فلو/جابِ پس‌زمینه وسطِ کار
متوقف شده و چون **نوتیفیکیشنی نمی‌آید**، ساعت‌ها بی‌توجه مانده (ورک‌فلوی لوگو ۴ ساعت؛
دیپلوی نیمه‌کاره که `.next` را خراب کرد و instance 0 را در کرش‌لوپ نگه داشت).
- **هرگز منفعلانه منتظرِ نوتیفیکیشن نمان** — کارِ مرده سیگنال نمی‌فرستد.
- **فعالانه چک کن** (mtime و محتوای فایلِ واقعی، نه حدس):
  ورک‌فلو → `ls -la <wf>/journal.jsonl` + `grep -c '"type":"result"'`؛
  جابِ پس‌زمینه → mtime فایلِ `.output`؛ سرور → `pm2 status` (↺/status) و `/root/.pm2/logs/*-out.log`؛
  سینکِ روستر → `progress.done/total` + خطوطِ `[roster] import N/M`.
- **دیده‌بان:** اسکریپتِ ثبت‌محور با ابزارِ Monitor؛ هر ۲ دقیقه اسکن، هشدار پس از ۸ دقیقه بی‌پیشرفتی.
  (فقط کارهای ثبت‌شده را بپاید — وگرنه برای تسک‌های تمام‌شده هشدارِ کاذب می‌دهد.)
- **وقتی گیر کرد: از همان نقطه ادامه بده، نه از صفر** — ورک‌فلو `resumeFromRunId`؛
  سینکِ روستر از RowCache؛ دیپلوی با `rm -rf .next && npm run build`.
- **گزارشِ صادق** — همان لحظه به کاربر بگو و نجاتش بده، نه سکوت.


---

## 📍 وضعیتِ جاری (آخرین سشن) — از این‌جا ادامه بده

### نامِ مشاورانِ رُستر آشغال درمی‌آمد — DONE (فاز ۲۷۵)
بود: «لوکیشن، منطقه، دوخواب، قابل، عزیزان، باهماهنگی، آزاد، ایرانی»؛ و در نمونهٔ واقعی امضا
`▪ مصطفی هوشمند` / `▪ مشاور تخصصی شهرک غرب` بود ولی موتور «فلاحی» را از **آدرس**
(«بین فلاحی ۴۱ و ۴۳») برمی‌داشت. هر دو ریشه بسته شد:
- **`app/lib/agency-name-lexicon.ts` (جدید)** = واژه‌نامهٔ **مشترکِ** استخراج و یادگیرنده (اگر
  یادگیرنده از roster ایمپورت کند importِ حلقوی می‌شود، پس واژه‌نامه ماژولِ سوم شد). شاملِ
  نوفه/القاب/**واژگانِ املاکی** (لوکیشن، ویو، دوخواب، سند، جهت‌ها…) + **نشانه‌های آدرس**.
- **ردِ توکنِ آدرس:** `addressTokens(text)` تا **۲ کلمه** پس از هر نشانه (بین/خیابان/کوچه/بلوار/
  نبش/میدان/شهرک/فاز/منطقه/پلاک/…) را «نامِ معبر» علامت می‌زند؛ رقم یا مرزِ قطعه (`،:—|`) زنجیره را
  می‌بندد تا «منطقه ۲: رضایی» اسمِ سالم را نخورد. این مجموعه **برای هر سه منبع** (AI، lexicon،
  heuristic) در `validName(s, agency, banned)` اعمال می‌شود — نه فقط heuristic.
- **استخراج فقط از بلوکِ امضا:** `extractSignature` دیگر روی متنِ صافِ کلِ آگهی regex نمی‌زند
  (ریشهٔ واقعیِ باگ: کلیدواژهٔ آخرِ یک خط، اولین کلمهٔ خطِ بعد را که آدرس بود برمی‌داشت). حالا
  خط‌به‌خط: (الف) خودِ خطِ امضا، (ب) خطِ بالا/پایینِ آن اگر «فقط یک نامِ ۱–۲کلمه‌ای» باشد ← همان
  «مصطفی هوشمند»، (ج) بلوکِ تزئینیِ برند + نامِ چسبیده به اموجیِ شخص، (د) خطی که به‌تنهایی دقیقاً
  یک نامِ ۲کلمه‌ای است (کم‌اولویت‌ترین).
- **دروازهٔ یادگیری + خودترمیمی:** `learnName` نامی را که از واژه‌نامه رد شود **نمی‌آموزد**
  (قبلاً یک حدسِ خرابِ AI وزن می‌گرفت و برای همیشه قطعی بازتولید می‌شد)؛ تأییدِ ادمین استثناست.
  `pruneLearned()` واژه‌نامهٔ آلودهٔ موجود را پاک می‌کند و **یک‌بار در هر پروسه** ابتدای
  `buildAgencyRoster` خودکار اجرا می‌شود → نیازی به اسکریپتِ دستی روی سرور نیست.
  (رکوردهای مشاورِ آشغالِ ذخیره‌شده هم در سینکِ بعدی با هرسِ خودکارِ موجود پاک می‌شوند.)
- بندهای (۷) و (۸) به پرامپتِ AI اضافه شد (نامِ معبر و واژهٔ ملکی هرگز اسم نیست).
- **فاز ۲۷۵b (سه ایرادی که دادهٔ زندهٔ سرور لو داد، بعد از دیپلویِ ۲۷۵):**
  (۱) **`pruneLearned` سست بود** — شرطش `if (validName(x))` بود، ولی `validName` نام را *پاک‌سازی*
  می‌کند و باقی‌مانده را برمی‌گرداند؛ پس «قدیمی منطقه» → «قدیمی» (غیرخالی) و در واژه‌نامه ماند
  (وزنِ ۵۸۸ در تولید! «نزدیک مترو» وزنِ ۴۰۰). حالا `strictName()` = «فقط اگر هیچ کلمه‌ای حذف
  نشد»، و همین دروازه در `learnName` و فیلترِ `knownNames` هم به‌کار می‌رود.
  (۲) **«کلمه + عددِ کوچک» = نامِ معبر** حتی بدونِ نشانهٔ آدرس: «(فلاحی 38)» مشاورِ جعلیِ «فلاحی»
  می‌ساخت. عددِ بلند (موبایل) این قاعده را فعال نمی‌کند.
  (۳) **امضای «نام + هستم»** (`RE_SELF`): «محمد پرنده هستم مشاور و امین شما» — نام *پیش از*
  کلیدواژه؛ بدونِ این الگو کلِ آگهی‌های این سبک بی‌نام می‌ماندند. + صفت‌های «قبلی/حضوری/اختصاصی…»
  به نوفه اضافه شد (وگرنه «با هماهنگی قبلی» ⇒ مشاورِ «قبلی»).
### فازهای ۲۷۶–۲۷۸ — چیزهایی که «دیدنِ دادهٔ زنده» لو داد (همان روز، بعد از دیپلویِ ۲۷۵)
هر چهارتا با شواهدِ سرور پیدا شدند نه حدس؛ ترتیبشان درس‌آموز است:
- **۲۷۶ — `removeConsole` لاگِ سرور را هم می‌خورد.** `next.config` در پروداکشن همهٔ
  `console.log` را حذف می‌کرد و SWC این را روی **کدِ سرور هم** اعمال می‌کند. یعنی
  `[roster] import N/M`، `graduate job start/end`، `[cron] …` هیچ‌وقت نوشته نمی‌شدند و یک ساعت
  کورکورانه دنبالِ کارِ گیرکرده گشتیم. **خاموش ماند و باید خاموش بماند** — ابزارِ تشخیصِ
  «قانونِ شمارهٔ یک» را نباید برای چند کیلوبایت باندل قربانی کرد.
- **۲۷۶ — ارقامِ فارسی همه‌جا حذف می‌شدند.** ۱۴۹ نقطه در ۶۶ فایل ورودیِ عددی را با
  `replace(/\D/g,'')` تمیز می‌کردند؛ `\D` یعنی «غیرِ رقمِ لاتین»، پس «۰۹۱۵۵۵۵۷۴۸۲»ی که کاربر از
  دیوار کپی می‌کرد **کاملاً پاک** می‌شد. حالا `app/lib/digits.ts` (فارسی + عربیِ هندی + `٬٫`)
  پیش از هر پاک‌سازی ترجمه می‌کند. **الگوی مصرف: `value.replace(FA_DIGITS, faDigit).replace(/\D/g,'')`
  یا `digitsOnly(value)` — هر ورودیِ عددیِ جدید باید از این عبور کند.**
- **۲۷۷ — ساختِ حساب آنی شد و انتقال ایدمپوتنت.** لاگ نشان داد حساب <۱ ثانیه ساخته می‌شود و
  آنچه ساعت‌ها طول می‌کشد انتقالِ فایل‌هاست. سه فیکس: رکورد بلافاصله graduate می‌شود
  (`transferFrom` مبدأ را برای ازسرگیری نگه می‌دارد)؛ انتقال per-فایل اتمی شد (قبلاً حذفِ مبدأ در
  پایان بود، پس هر مرگِ وسطِ کار فایل‌ها را **دوباره** کپی می‌کرد)؛ و غنی‌سازیِ آگهیِ قبلی روی
  شناسهٔ عمومیِ جدید کپی می‌شود تا `warmEnrichment` **هیچ درخواستِ تازه‌ای به دیوار نزند**
  («یک‌بار بگیر، نگه دار» — فیدبکِ «فایل‌ها را ده بار می‌گیرد»). + ضربانِ claim هر ۲ دقیقه تا کارِ
  زندهٔ کُند دوباره برداشته نشود.
- **۲۷۷b — دو باگِ نامی از نگاهِ کاربر به پنل:** «محمد» و «محمد پرنده» دو خوشه می‌شدند (حالا
  خوشهٔ تک‌کلمه‌ای در چندکلمه‌ای ادغام می‌شود، فقط وقتی **دقیقاً یک** میزبان کاندید باشد)؛ و
  «کسری» از «کسری بودجه» مشاور شده بود — چون «کسری» نامِ واقعی هم هست، ملاک **بافت** شد:
  `contextNoiseTokens` کلمهٔ پیش از بودجه/تومان/میلیون/متری/طبقه را رد می‌کند.
- **۲۷۸ — آگهی‌های یتیم.** خوشهٔ آشغالِ هرس‌شده رکوردش حذف می‌شد ولی ownerِ موقتش هرگز تخلیه
  نمی‌شد: روی سرور **۱۱۸۳ خوشه / ۵۴۰۰ فایلِ بی‌صاحب** جا مانده بود (`adv:pQRgYEXa:لوکیشن`=۵۷۰).
  حالا هرس با فهرستِ توکنِ خالی تخلیه هم می‌کند. پاک‌سازیِ انباشتهٔ گذشته:
  `node --import ./scripts/reos-loader.mjs scripts/roster-orphans.mjs` (گزارش) و `--apply` (حذف).
- **درسِ عملیاتی:** هر `pm2 reload` (یعنی هر دیپلوی) کارِ در حالِ اجرای اینستنسِ ۰ را می‌کُشد.
  وسطِ سینک/انتقالِ زنده دیپلوی نکن؛ اول صف را خالی کن.
### فازهای ۲۸۳–۲۸۴ — DONE (ورک‌فلوی چندعاملی + بازبینیِ خصمانه)
هر پنج کارِ باز با ۱۲ عامل (شناخت→پیاده‌سازی→تست→راستی‌آزمایی→۲ بازبینِ خصمانه) بسته شد:
- **عکسِ کارت‌ها فوری شد:** `CardImg.tsx` آدرسِ remote (divarcdn) را دیگر از `/_next/image`
  نمی‌گذراند (resizeِ بارِ اول روی همان سرورِ اسکرپ/AI گلوگاه بود)؛ مسیرهای محلی (/api/media)
  همچنان از بهینه‌ساز می‌گذرند. OPT_OFF_KEY و fallbackِ onError حفظ شد. next.config بخشِ images
  عمداً ماند (بنرها/URLهای کش‌شده) — حذف نشود.
- **گالریِ موبایل:** نوارِ scroll-snap + چیپِ «۲/۸ 📷» (ارقامِ فارسی) + نقطه‌ها (سقفِ ۸)؛
  ایندکس با `galleryIndexFromScroll` (RTL-safe با Math.abs). LCP حفظ شد (عکسِ ۰ eager).
- **نشانِ «دیده‌اید 👁»:** `app/lib/seen-listings.ts` لایهٔ خواندنیِ SSR-safe روی seen-storeِ
  فاز ۲۵۵ (کلیدِ mj_seen_v1 — استورِ دوم نساختیم)؛ در SearchClient بعد از mount (ضدِ hydration
  mismatch). نصب در هابِ سئو (app/listings) هنوز اختیاری/انجام‌نشده.
- **موتورِ «آگهی‌های مشابه» (kind.ts جدید):** فیلترِ سختِ لایه‌ای — dealِ چهارگانه (dealOf)،
  kindOf (land/villa/shop/office/apartment)، وتوی شهر، باندِ متراژ ±۴۰٪→±۷۰٪ — سپس امتیازِ
  ترکیبی. کمتر از k → باند شل می‌شود ولی نوع/معامله/شهر هرگز. simPct حالا واقعی و پخش است.
- **انتشارِ دسته‌ای (فاز ۲۸۴):** هسته‌های in-db مشترک (addUserListingCore/updateUserListingCore)
  + `publishUserListingsBatch` (یک mutate per chunk ~۱۵) + `advisor-store.publishListingsBatch`؛
  reassignListings حلقهٔ copy→delete اتمی را نگه داشت و فقط publish جمع شد + مسیرِ ترمیمِ
  «فعال بدونِ publicId از همین sourceId». انتقالِ ۲۹ فایل: از ~۲.۵ دقیقه به چند ثانیه.
- **یافته‌های بازبینِ خصمانه که بسته شد:** (۱) **major:** faToEnِ listing-similarity «٬» را
  ترجمه نمی‌کرد → «۱۲٬۵۰۰٬۰۰۰٬۰۰۰» به ۵۰۰ خوانده می‌شد (قیمتِ مشابه‌ها + twin آلوده). (۲) وتوی
  شهر با هر دو ترتیبِ سگمنتِ location (mapRow «محله، شهر» می‌سازد، fieldsOf برعکس فرض می‌کرد).
  (۳) `unpublishedAt` روی Listing تا ترمیمِ graduate، unpublishِ عمدیِ مشاور را دوباره منتشر
  نکند. (۴) `TwinIndex.remove` تا اسنپ‌شاتِ کهنه در چانکِ batch آیتمِ بعدی را گمراه نکند.
- تست‌ها: +۴۲ (عامل) +۴ (رگرسیونِ بازبینی) → ۱۰۶۸ پاس؛ tsc/build سبز؛ فلایویلِ ML سبز.

### فاز ۲۸۶ — حادثهٔ ۲۸ سپتامبر: رم، «دیپلویِ دروغین»، و صفِ ساخت حساب
سه مشکلِ درهم‌تنیده که با هم «ساخت حسابِ خیلی کند» را می‌ساختند:
- **نشتِ حافظه:** ۴ اینستنسِ next-server طی ۸ روز به ۱٫۱–۱٫۶GB رسیدند → رم پر، سواپ پر،
  load ۱۵ → بیلدِ توربوپک ۴۱ دقیقه طول کشید و با panic (postcss worker timeout) مُرد؛ **پستگرسِ
  همین ماشین هم خفه بود** → `statement timeout` و `timeout exceeded when trying to connect` روی
  هر graduate. درمانِ فوری: `sudo pm2 restart ecosystem.config.js --update-env`. پیشگیری: کرونِ
  ری‌استارتِ شبانهٔ ۴:۳۰ نصب شد. (سقفِ `max_memory_restart` قبلاً توسطِ سشنِ دیگری عمداً به
  ۳۰۰۰M/۲۵۰۰M بالا رفته بود — چون ۱۲۰۰M اینستنس‌های سالم را می‌کشت — پس فایر نشدنش درست بود.)
- **دیپلویِ دروغین (بدترین باگِ روز):** `ecosystem.config.js` پوشهٔ سِرو را از `.next-current`
  (اسلاتِ .next-a/.next-b — سیستمِ deploy.sh) می‌خواند، ولی `auto-deploy.sh` هنوز در `.next`ِ
  قدیمی بیلد می‌کرد و اشاره‌گر را عوض نمی‌کرد → بیلدِ سالم تمام می‌شد، «✓ دیپلوی انجام شد» چاپ
  می‌شد، ولی pm2 دوباره اسلاتِ کهنه را بالا می‌آورد و **کدِ جدید هرگز زنده نمی‌شد**. تشخیص از روی
  لاگ: پیام‌ها فرمتِ قدیمی داشتند. فیکس: auto-deploy حالا مثلِ deploy.sh در اسلاتِ خاموش بیلد
  می‌کند، `BUILD_ID` را چک می‌کند، `.next-current` را جابه‌جا می‌کند، `pm2 reload` (نه restart)،
  و بعد از چکِ سلامت اسلاتِ قدیمی را پاک می‌کند. **قاعده: هر تغییری در مکانیزمِ دیپلوی باید در
  هر دو اسکریپت هم‌زمان اعمال شود؛ و «دیپلوی شد» فقط وقتی یعنی شد که رفتارِ جدید در لاگ دیده شود.**
- **صفِ graduate (کامیت 74c71e0):** خطای گذرا (timeout/connect/pool) دیگر claim را ۱۰ دقیقه
  نگه نمی‌دارد — همان لحظه آزاد می‌شود و دورِ بعدیِ ۴۵ثانیه‌ای دوباره برمی‌دارد؛ `attempts` تا سقفِ
  ۸، بعد FAILED واقعی. لاگِ سالم: `end ok=true ms=…` یا `transient-fail (retry ~45s, attempt n/8)`.
- **فاز ۲۸۷ — جداییِ کاملِ انتقال از انتشار (پیشنهادِ خودِ کاربر: «اول بیاید، نمایش نده؛ بعد
  صفِ جداگانه تکراری‌نبودن را چک و منتشر کند»).** reassignListings حالا فقط کپی می‌کند (شاردهای
  کوچکِ advisor/divar — سریع)؛ انتشار + ضدتکراری کارِ «جارویِ انتشار» است (repairOrphanPublishes،
  هر تیکِ ۴۵ث چندتا-چندتا، فقط وقتی سینک نیست). publicIdِ قبلی در `enrichFrom` روی فایل می‌ماند و
  جارو غنی‌سازی را از آن کپی می‌کند (دیوار دوباره خوانده نمی‌شود). خطای دیتابیسیِ انتشار دیگر
  «ساخت حساب» را گروگان نمی‌گیرد. + انتشارِ دسته‌ای دیگر کلِ جدول را زیرِ قفل نمی‌خواند
  (ایندکسِ twin بیرونِ تراکنش + mutateSome فقط ردیف‌های prev/twin) و تراکنش‌های سنگینِ
  kvMutate/اسکرپر `SET LOCAL statement_timeout=45s` دارند (انتظارِ صفِ قفل ≠ کوئریِ سرکش).
- **صفِ graduate ۲ (کامیت 9b24073):** لاگِ زنده نشان داد تایم‌اوت‌ها دقیقاً وسطِ سینکِ رُستر
  می‌آیند (رقابت سرِ استخرِ ۱۵ اتصاله و قفل‌ها — درسِ ۳۰ اوت). حالا وسطِ سینک صف فقط «بخشِ آنی»
  را برای **همهٔ** کارهای منتظر اجرا می‌کند (حساب + شماره → پنل فوراً ✅؛ `prepared` روی کار) و
  انتقالِ سنگینِ فایل‌ها تا پایانِ سینک عقب می‌افتد (`deferTransfer`؛ transferFrom ادامه را تضمین
  می‌کند). لاگ: `[roster] graduate: N حسابِ آنی ساخته شد — انتقالِ فایل‌ها بعد از پایانِ سینک`.

### فاز ۲۹۱ — شاردِ رُستر: «هر آژانس ردیفِ خودش» (پایانِ خشکیِ استخر)
ریشهٔ دو روز مرگِ همهٔ کارهای پس‌زمینه با «timeout exceeded when trying to connect»: کلِ
رُستر (همهٔ آژانس‌ها + صفِ ساخت حساب + تنظیمات) «یک» ردیفِ kv بود؛ ده‌ها نویسندهٔ هم‌زمان
پشتِ یک FOR UPDATE اتصال‌های استخر را پارک می‌کردند تا خشک شود. حالا (الگوی فاز ۲۵۹):
- `roster:s:{id}` هر آژانس، `roster:q` صفِ حساب (ردیفِ کوچکِ مستقل)، `roster:meta` تنظیمات.
- primitiveها: loadAll/getScrapeRow/mutateScrape/putScrape/mutateQueue/anyScrapeRunning
  (running با kvGetPrefixField — بدونِ کشیدنِ سندها). مهاجرتِ تنبلِ یک‌باره از بلابِ
  `agency_roster` با «کپی فقط اگر ردیف غایب است» (ضدِ مسابقهٔ چنداینستنسی)؛ بلابِ قدیمی
  به‌عنوانِ پشتیبان دست‌نخورده می‌ماند. حالتِ فایل (تست/dev) همان تک‌فایل است.
- هم‌زمان: استخرِ PG نقش‌محور شد (اینستنسِ ۰: ۳۰ اتصال، سرویس‌ده‌ها: ۱۲) و سقفِ pm2 به
  بودجهٔ واقعیِ ماشین برگشت (۱۸۰۰M/۱۳۰۰M — اینستنسِ نشتی تک‌نفره ری‌استارت می‌شود، نه ۵۰۴ِ
  سراسری). ردیابِ [mem] (instrumentation.ts، فاز ۲۹۰) نشان داد وزن heapِ JSِ خودمان است
  (~۸۰۰MB: کشِ کاملِ آگهی‌ها + پایگاهِ غنی‌سازی در هر اینستنس) — کوچک‌سازیِ این دو، کارِ باز.
- **۲۹۱ب:** بدنهٔ queueTick فقط try/finally داشت و فراخوان‌ها `catch(() => {})` — هر throwِ
  بی‌محافظ (heartbeat/import/درینِ صف) ادامهٔ تیک را هر ۴۵ ثانیه بی‌صدا می‌کُشت و آژانس‌ها
  ابدی «در صف» می‌ماندند بدونِ هیچ لاگی. حالا catchِ سراسریِ تیک + catchِ راه‌اندازِ رُستر
  خطا را با `[cron] queueTick failed:` / `[cron] roster launcher failed:` فریاد می‌زنند.
- **ریشهٔ اصلیِ «کلا گیر کرده»:** ensureCronStarted فقط از ۳ مسیرِ API صدا زده می‌شد و nginx به
  پورتِ ۳۰۰۰ ترافیک نمی‌دهد — بعد از هر ری‌استارتِ اینستنسِ ۰، کرون تا رسیدنِ یک درخواستِ
  شانسی خاموش می‌ماند. حالا instrumentation.register در بوت روشنش می‌کند و «scheduler armed»
  در لاگ می‌آید. anyScrapeRunning هم رانِ مرده (stale) را دیگر «در جریان» حساب نمی‌کند.
  لاگ‌های pm2 تاریخ دارند (log_date_format — اعمال فقط با pm2 startOrRestart).

### فاز ۲۹۶ — سایت‌سازِ خودکار برای همهٔ اهالیِ دایرکتوری
هر حسابِ «نقش‌دار» (مشاور/آژانس/معمار/مصالح/… — اسکرپی یا ثبت‌نامی، قدیمی یا جدید) خودکار
یک سایتِ اختصاصی می‌گیرد + یک پیامکِ خوش‌آمد با لینک. `app/lib/auto-site.ts`:
- جاروِ کرونِ اینستنسِ ۰ (هر تیک ≤۸ سایت، ≤۴ پیامک؛ پیامک حداکثر ۳ تلاش) — چون جارو همیشگی
  است حسابِ تازه (graduate/معمار/ثبت‌نام) هم ظرفِ چند دقیقه سایت می‌گیرد؛ هیچ قلابِ دستی.
- متا در kv `autosite_meta` (یک ردیفِ کوچک، تک‌نویسنده)؛ کانفیگ `autosite_cfg`
  {enabled,sms} برای خاموش‌کردن. سایتِ «دست‌ساز» هرگز بازنویسی/پیامک نمی‌شود.
- بدنه از دادهٔ واقعیِ خودِ شخص (hero/about/services/listings|catalog/contact/footer —
  بی‌نام سایت نمی‌گیرد؛ هیچ عددِ ساختگی). buildAutoSitePayload خالص و تست‌دار است.
- **سئو**: اسلاگِ «فارسیِ نامِ شخص» (sanitizeSlug حالا فارسی‌پذیر — melkjet.com/علی-رضایی)،
  عنوانِ متا با نامِ شخص شروع می‌شود، توضیح از واقعیت‌ها، canonical+OG، JSON-LD
  RealEstateAgent، و شاردِ `sites` در سایت‌مپ. هدف: جست‌وجوی نامِ شخص → صفحهٔ خودش.
- بدهیِ شناخته: store سایت‌ها یک بلابِ kv واحد است؛ اگر از چند هزار سایت گذشت باید مثلِ
  فاز ۲۵۹/۲۹۱ شارد شود. ← **انجام شد (فاز ۲۹۷، پایین)**

### فاز ۲۹۵ — امضای برچسب‌دارِ NER («کارشناس منطقه:رها» را نمی‌فهمید)
`roster-ner.ts` → `labeledName()`: الگوی قطعیِ «مشاور/کارشناس…: نام» روی ۶ خطِ آخرِ آگهی،
با ردِ واژه‌های نقشی/ملکی (LABELED_REJECT). `bestName` قبل از مدل این را با p=0.98 برمی‌گرداند —
امضای صریح هرگز نباید به حدسِ مدل برسد. ۶ تست در reos-test.

### فاز ۲۹۸ی۳ — «خانم شهریار»/«شهریار هستم» بی‌نام می‌ماند (شهرِ هم‌نام با شخص)
کیس‌استادیِ زندهٔ PMKbXmwY (پروبِ `roster-name-probe`) ریشه را قطعی نشان داد: `bestName`
درست «شهریار» را برمی‌گرداند (p=0.97، از عنوانِ «خانم شهریار» یا معرفیِ «شهریار هستم») ولی
`extractSignature` آن را دور می‌انداخت چون `validName` → `isBadName` واژهٔ تک‌کلمه‌ای را که در
`SOLO_NEVER_NAME` است (شهرها: شهریار/تهران/کرج/…) بی‌قید بَن می‌کرد (فاز ۲۹۷ش، برای کشتنِ
«طلایی/منطقه طلایی»). ریشه‌ای درست شد: بانِ شهرِ تک‌کلمه‌ای فقط وقتی اعمال می‌شود که نام از
«حدسِ مدل» آمده باشد؛ وقتی از **سیگنالِ قطعیِ شخص** بیاید (برچسب «نقش: نام»، معرفیِ «نام هستم»،
یا عنوانِ «خانم/آقای نام» — همان سه مسیرِ p≥۰.۹۷) دیگر بَن نمی‌شود — «خانم شهریار» واقعاً شخص
است، ولی «منطقه طلایی»/«کارشناس تهران»ِ حدسِ مدل همچنان بی‌نام می‌ماند. پیاده‌سازی: `bestName`
این سه مسیر را با `trust:true` برمی‌گرداند؛ `isBadName(v, trustPerson)`/`validName(s,…,{trustPerson})`
فقط بانِ SOLO را رد می‌کنند (نوفه/ملکی/آدرس/شکلِ نام سرِ جا). «طلایی» هرگز trust نمی‌گیرد
(نه برچسب، نه «هستم»، نه عنوان؛ و surnameStrong هم نیست). ۵ تست در reos-test. **درسِ روش:**
دروازهٔ دوم (extractSignature→validName) باید سیگنالِ مسیرِ اول را بشناسد، وگرنه تصمیمِ درستِ
لایهٔ بالا را لایهٔ پایین خنثی می‌کند — همان الگوی «سه لایه روی هم» (۲۵ اوت).

### فاز ۳۱۵ — «کارشناس … منطقه <نام>» بی‌نام می‌ماند (۶۵۶ از ۹۷۰ آگهیِ یک آژانس)
گزارشِ کاربر: تشخیصِ نام «یکی‌درمیان» کار می‌کند؛ خوشهٔ «بی‌نام (خودِ آژانس)» ۶۵۶ فایل داشت،
با امضاهای کاملاً واضحِ «کارشناس تخصصی امور ملکی منطقه رامتین» و «کارشناس امور ملکی منطقه
فراهانی». ریشه (با اجرای عینِ `extractSignature`/`gazetteerName` روی همین متن‌ها تأیید شد): نام
پس از «منطقه» می‌آید و **«منطقه» یک `ADDR_MARKER` است** — پس تا امروز توکنِ پس از آن «نامِ معبر»
فرض می‌شد، و مدلِ آماری هم عمداً آنجا سکوت می‌کرد (چون پس از «منطقه» معمولاً نامِ محله است —
جلوگیری از مشاورِ جعلیِ هم‌نامِ محله، بابِ دردسرِ قبلی). `رامتین` حتی در `FIRST_NAMES` بود و فقط
چون قانونِ گازِتیرِ (ب) نام‌خانوادگیِ پس از نامِ کوچک می‌خواست، تنها رد می‌شد. درمان: یک قانونِ
دقتِ‌بالای تازه در `gazetteerName` (شاخهٔ ب۳): روی خطِ امضا با کلیدواژهٔ نقش، اگر `منطقه/محله/
ناحیه/محدوده` پس از نقش بیاید، توکنِ بلافاصله‌بعدش نام است — به‌شرطِ `surnameOk` (ردِ نوفه/ملکی/
فعل + `PLACE_WORDS`/`PLACE_SUFFIX`) و نبودن در `KNOWN_AREAS` (فهرستِ محله‌های تهران: نارمک/
تهرانپارس/پیروزی/فرشته/… — فقط دروازهٔ همین قانون، نه سراسری، تا «آقای فرشته»/«فرشته هستم»
دست‌نخورده بماند). نامِ دوبخشی وقتی ساخته می‌شود که توکنِ اول نامِ کوچکِ شناخته‌شده باشد. چون از
گازِتیر می‌آید `trust:true` (p=0.97) می‌گیرد و از دروازهٔ `nameProbSync` رد می‌شود (همان مدلی که
اینجا کم آورده بود). **ریسکِ باقی‌مانده (صریح به کاربر گفته شد):** محله‌ای که در `KNOWN_AREAS`
نباشد و پس از «منطقه» تنها بیاید، ممکن است نامِ جعلی بسازد — جداکردنیِ قطعی از متن نیست؛ کاربر
در پنل merge/rename می‌کند. ۱۲ تستِ مثبت/منفی (رامتین/فراهانی ✓ و ونک/نیاوران/تهرانپارس/نارمک/
سعادت‌آباد/۵/فرشته/پیروزی → خالی ✓) پیش از دیپلوی سبز شد.

### فاز ۳۱۶ — «سینکِ آژانسِ بزرگ ساعت‌ها طول می‌کشد / timeout» — رفعِ O(N²)
ریشه (از لاگِ زنده: `token=… fetch=150ms db=54000ms`): دیوار سریع بود، ولی **هر نوشتنِ یک
آگهی ۳۰–۵۷ ثانیه** طول می‌کشید و از `statement_timeout=45s` رد می‌شد — حتی با `ROSTER_SYNCS=1`
و `ROSTER_CONCURRENCY=1` (پس مشکل «رقابت» نبود، خودِ «کار» بود). علت: `importClusterTokens`
برای **هر** آگهی `updateListing`/`setListingStatus` (بلابِ AdvisorDataِ هزاران‌آگهیِ مالک، زیرِ
`FOR UPDATE`) **و** `recordImport` (`writeJsonCached` + fsyncِ کلِ `.advisor-divar-data.json` —
تاریخچهٔ *همهٔ* آژانس‌ها) می‌زد. N نوشتن × O(N) = **O(N²)** → آژانسِ ۱۵۰۰آگهی هرگز تمام نمی‌شد،
کوچک‌ها می‌شدند («نصفِ آژانس‌ها آپدیت نشدند = بزرگ‌ها»). **درمان — نشستِ دسته‌ای:** بلابِ هر مالک
یک‌بار در حافظه بار می‌شود (`beginAdvisorBatch`)، همهٔ نوشتن‌ها رویش اعمال، و فقط **یک‌بار** در
پایانِ همان خوشه فلاش می‌شود (`flushAdvisorBatch`)؛ فایلِ دیوار هم با `beginDivarBatch`/
`endDivarBatch` (شمارندهٔ عمق) یک‌بار برای **کلِ** سینک نوشته می‌شود. چک‌پوینتِ هر ۳۰۰ آگهی
(تک‌کارگر) برای ایمنیِ کرش. نتیجه: ~۱۰۷۰ نوشتنِ per-آگهی → ~۴۱ نوشتنِ per-خوشه + ۱ نوشتِ فایل؛
سینکِ آژانسِ بزرگ از «شکست/ساعت‌ها» به **چند ثانیه**. امن چون خوشه‌ها سریالی ایمپورت می‌شوند
(یک مالکِ فعال در لحظه)؛ و اگر `ROSTER_SYNCS>1` شود، نشست فقط به مسیرِ per-آگهیِ عادی تنزل می‌کند
(کندتر، نه خراب — بدونِ گم‌شدنِ نوشتن). پیاده‌سازی در `advisor-store.ts` (نشستِ مالک)،
`advisor-divar-store.ts` (معوق‌سازیِ save)، `agency-roster-store.ts` (begin/flush دورِ حلقهٔ خوشه +
چک‌پوینت در worker). `next build` سبز.

### فاز ۳۱۷ — قفلِ سراسریِ `scraper_meta`: کوتاه‌کردنِ ناحیهٔ بحرانی (ریشهٔ همهٔ آتش‌ها)
با `pg_stat_activity` (زنده) ثابت شد: تقریباً همهٔ اتصال‌های گیرکرده منتظرِ `SELECT data FROM kv
WHERE key=$1 FOR UPDATE` روی **یک ردیفِ `scraper_meta`** بودند (۲۲ ثانیه). یعنی **هر نوشتنِ هر
آگهی در سایت** (ممیزی، ایمپورتِ تلگرام، publish، refreshِ رُستر) اول این قفلِ سراسری را می‌گرفت →
کلِ نوشتن‌ها سریال → صفِ عمیق → اشباعِ استخرِ اتصال → «timeout exceeded when trying to connect».
ریشهٔ مشترکِ تلگرام/منتظرها/رُسترِ این چند ماه. **درمان:** در `mutateSome` (مسیرِ داغ: ممیزی/
ویرایش/وضعیت/مهرِ معامله) قفلِ `scraper_meta` «آخر» گرفته می‌شود و فقط برای ~۱ms بالابردنِ `__rev`؛
کارِ آگهی‌ها پیش از آن زیرِ قفلِ ردیفیِ ریزدانه (`SELECT … id=ANY ORDER BY id FOR UPDATE`) انجام
می‌شود. ناحیهٔ بحرانیِ سراسری از «خواندن/نوشتنِ N آگهی» به «یک UPDATEِ متادیتا» کوتاه شد →
صف سریع خالی می‌شود. مکانیزمِ کش (`__rev`/`__log`/دلتا) **دست‌نخورده** است؛ فقط «زمانِ گرفتنِ قفل»
عوض شد. امنیت: (۱) `opts.metaDirty` برای تنها صدازنندهٔ متانویس (`publishUserListingsBatch` که اونر
اضافه می‌کند) مسیرِ قدیمیِ meta-first را نگه می‌دارد؛ گاردِ بلند اگر مسیرِ meta-late متادیتا را عوض
کند. (۲) ترتیبِ قفلِ ردیف با `ORDER BY id` قطعی است. (۳) بن‌بستِ متقابلِ نادر (meta-late در برابر
meta-first روی یک آگهی) به ۴۰P01 منجر می‌شود؛ **retry نمی‌زنیم** (fnها side-effectِ بیرونی دارند و
اجرای دوباره خراب می‌کند — code-review این را گرفت)؛ حلقه‌های بیرونی (ممیزیِ هر تیک، اسکرپ، publish-
sweep) خودشان دوباره تلاش می‌کنند. بدونِ فساد؛ فقط یک چرخهٔ نادرِ هدررفته. `mutate`ِ کامل (ایمپورت/
publish، meta-first، نادر) دست‌نخورده. `next build` سبز + code-review. **سنجه:** بعد از دیپلوی همان
کوئریِ `pg_stat_activity` باید دیگر صفِ `FOR UPDATE` نداشته باشد (تأییدِ دیتامحور، نه ادعا).

### فازهای ۲۹۶ب-و — تکمیلِ سایت‌سازِ خودکار (همه از فیدبکِ زندهٔ کاربر)
- **۲۹۶ب — پنلِ «سایت‌سازها»** (admin → کاربران و CRM): هر کاربر + لینکِ سایت + آمارِ بازدید/جستجو
  (`/api/admin/sites` + site-stats-store: kv `sstat:{slug}`، بیکنِ `/api/sites/hit` از مرورگرِ
  بازدیدکننده — view در SiteShell، search با debounce از SiteListings) + آخرین ورودِ صاحبِ سایت.
- **۲۹۶ج — ۴۰۴ِ همگانیِ اسلاگ‌های فارسی:** پارامترهای Next **درصد-کدشده** می‌رسند (AGENTS.md) ولی
  getSite دیکد نمی‌کرد → `safeDecode` داخلِ getSite/getSitePage. و `[site]` صفحات
  `revalidate = 300` گرفتند — بدونش HTML تا دیپلویِ بعدی کش می‌ماند و «هیچ تغییری نکرد» دیده می‌شد.
- **۲۹۶د/هـ — چیدمانِ کامل + ارتقای نسخه‌دار:** «سایتِ خالی جذابیت ندارد» → بدنهٔ غنی (searchlist،
  نظرات، CTA، و کلِ دادهٔ طرح‌۲طرحِ معمار: نمونه‌کارها/آمار/تحصیلات/مهارت‌ها/دفتر؛ بَجِ hero از
  roleLabel نه متنِ ثابتِ «املاک و مستغلات»). `AUTO_SITE_V` بالا برود → جاروِ بعدی سایت‌های
  خودکارِ «دست‌نخورده» را بازمی‌سازد (سایتی که صاحبش ویرایش کرده هرگز دست نمی‌خورد).
- **۲۹۷ — شاردِ سایت‌ها (پیش‌دستانه، «در صف: ۲۹۷۴»):** هر سایت ردیفِ `site:{slug}`، ایندکسِ سبکِ
  `sites_idx` (تخصیصِ اتمیِ slug زیرِ kvMutate)، مهاجرتِ تنبلِ copy-if-absent، `listSiteHeads()`
  برای جارو/سایت‌مپ/پنل/تیم. حالتِ فایل (تست) دست‌نخورده.
- **۲۹۷ب — پترنِ اختصاصیِ پیامکِ سایت‌ساز:** کاربر پرسید «پترنِ سایت‌ساز کجاست؟» — فیلدهای
  `autositePattern`/`autositeVar` در پنلِ «پیامک و الگوها» + `sendAutoSiteSms` (لینکِ کوتاه‌شده در
  `linkVar`؛ بدونِ پترن → متنِ آزاد). خطای هر پیامک در `autosite_meta.done[phone].lastErr` فریاد
  می‌زند و پنل دکمهٔ «🔁 تلاشِ دوباره» دارد.

### فاز ۲۹۷ج — سه خواستهٔ صریحِ کاربر (چندصفحه‌ای/تیمِ آژانس/فیلترِ پنل)
- **سایتِ خودکار چندصفحه‌ای شد** («کلی صفحه داریم تو سایت‌ساز چرا ندارند»): خانه (hero/درباره/آمار/
  خدمات/اسلایدرِ ۹ آگهی/تیم/نظرات/CTA/تماس) + صفحه‌های منو: «آگهی‌ها» (searchlist با سقفِ ۱۵۰)،
  «محصولات» (مصالح)، «نمونه‌کارها» (گالریِ کاملِ معمار ≤۲۴)، «درباره»، «نظرات»، «تماس».
  AUTO_SITE_V=3 → بازسازیِ خودکارِ همهٔ سایت‌های دست‌نخورده. شناسهٔ بلوک‌ها در «کلِ سایت» یکتاست.
- **تیمِ خالیِ آژانس‌های اسکرپی** («چرا پنل آژانس مشاورین رو نشون نمیده؟»): ریشه — `getTeamMembers`
  فقط از agency-link-store (رابطهٔ رسمی) می‌خواند و مشاورانِ graduateشدهٔ رُستر آنجا نیستند. حالا
  وقتی رابطهٔ رسمی خالی است، از `listScrapes()` مشاورانِ phone‌دارِ اسکرپی که `agencyOwner/agencyPhone`ش
  شمارهٔ همین آژانس است می‌آیند (کشِ TTL ۱۲۰ث تا رندرِ هر سایتِ آژانس کلِ رُستر را نخواند).
- **فیلترهای پنلِ سایت‌سازها** («بهت گفتم فیلتر بزار نزاشتی»): چیپ‌های نوع (خودکار/دست‌ساز)،
  پیامک (رفته/نرفته)، ورودِ کاربر (وارد شده/هرگز)، بازدید (دارد/صفر) + سلکتِ نقش + پاک‌کردنِ همه.
- **پیامک به شمارهٔ ثابت = ناموفقِ قطعی:** ۱٬۰۶۴ «شمارهٔ نامعتبر» از حساب‌های ۰۲۱دارِ آژانس‌ها بود که
  هرگز پیامک نمی‌گیرند و صفِ retry را ابدی می‌چرخاندند. جارو شمارهٔ غیرِ `09…` را بدونِ تلاش قطعی
  می‌کند، `resetFailedSms` بازنشانی‌شان نمی‌کند، و `smsStatus` آن‌ها را جدا (`invalid`) می‌شمارد
  (پنل: کاشیِ «شمارهٔ ثابت (پیامک‌ناپذیر)»).

### فاز ۲۹۷د — صفحهٔ آگهیِ سایت‌ساز = «خودِ» موتورِ صفحهٔ اصلی (نه کپیِ موازی)
فیدبک: «امکاناتِ سایت‌ساز باید دقیقاً مثلِ سایتِ اصلی باشه و سئو رو حواست باشه». ریشه:
`app/[site]/listing/[slug]` یک کپیِ فقیر (ListingDetail.tsx) بود — بدونِ JSON-LD، بدونِ سئوی
بازساختهٔ فاز ۲۲۸، بدونِ enrich سرورساید، بدونِ امتیازِ تحلیلی/اصالت/روندِ قیمت/مشابه‌ها/چت.
راهِ ریشه‌ای: **یک موتور، دو پوسته** —
- `app/lib/listing-detail-data.ts` (جدید): کلِ منطقِ سرورسایدِ صفحهٔ آگهی (listingSeoText،
  buildListingDetailData: سه JSON-LD، امتیازِ اصالتِ ۲۲۶، پروموت، ensureAnalysisNow + initialEnrich
  در HTMLِ اولیه) — عیناً از `app/listing/[slug]/page.tsx` منتقل شد و هر دو صفحه از آن می‌خوانند.
- `PropertyClient` پراپِ اختیاریِ `site` گرفت: بدونِ `<Nav/>`ِ ملک‌جت، بردکرامبِ داخلیِ همان سایت
  (خانه/آگهی‌ها → صفحه‌های خودِ سایت). باقیِ صفحه (گالری+لایت‌باکس، فکت‌ها، خلاصهٔ هوشمند،
  امتیازها، امکانات، روند و پیش‌بینی، دسترسی‌ها، نقشه، وام، مشابه‌ها، چت با صاحب، پرسش از AI،
  اصالت، ذخیره/مقایسه، نوارِ اکشنِ موبایل) عیناً یکی است — امکانِ تازهٔ صفحهٔ اصلی خودکار
  به سایت‌سازها هم می‌رسد.
- صفحهٔ سایت‌ساز داخلِ `SiteChrome` (NavBar/فوتر/تمِ خودش) رندر می‌شود؛ `themeVars` پالتِ روشنِ
  سایتِ اصلی را با طلاییِ برندِ همان سایت پین می‌کند — استثنای عمدیِ قاعدهٔ فاز ۲۹۴ (مثلِ empRoot)
  چون سایتِ منتشرشده تمِ ثابتِ خودش را دارد. canonical همچنان به صفحهٔ اصلی اشاره می‌کند
  (ضدِ محتوای تکراری) و Beacon آمارِ بازدیدِ صفحه‌های آگهی را هم به پنلِ «سایت‌سازها» می‌شمارد.
- `ListingDetail.tsx` حذف شد (کدِ مرده). قاعده: برای صفحهٔ آگهی هیچ‌وقت نسخهٔ موازی نساز —
  پوسته را پارامتری کن.

### فاز ۲۹۷هـ — سایتِ خودکار = «خودِ» قالبِ کاملِ سایت‌ساز (همهٔ صفحات + تمِ حرفه‌ای)
فیدبک: «فقط منو خانه رو گذاشتی؛ کلی صفحه داریم تو هر پنل — سایتِ خودکار باید همهٔ صفحات را
با حرفه‌ای‌ترین گرافیکِ خودِ سایت‌ساز بسازد». ریشه: buildAutoSitePayload چیدمانِ دستیِ من بود،
نه قالب‌های واقعیِ ابزار — دوباره همان الگویِ «نسخهٔ موازیِ فقیر».
- **`app/lib/site-templates.ts` (جدید)** = موتورِ قالبِ سایت‌ساز، عیناً از WebsiteBuilderTool
  منتقل شد (۴۶۴ خط): BLOCK_DEFAULTS، SITE_PALETTES/templatePalette، PROFILE_HERO_COPY،
  PROFILE_PRESETS (محتوای صنفیِ ۱۲ پروفایل)، STARTER_TEMPLATES (۱۳۰ قالب)، profilePageSpec
  (صفحاتِ کاملِ هر پروفایل) + **buildProfileSite(profile, tpl?)**: همان ترکیبی که loadTemplate
  می‌ساخت (خانهٔ کامل + درباره/فایل‌ها|نمونه‌کارها|محصولات|فرصت‌ها/خدمات/تیم/وبلاگ/تماس، با تم).
  WebsiteBuilderTool حالا این‌ها را import می‌کند و loadTemplateاش به buildProfileSite delegate
  می‌کند (شناسه‌ها با nextId خودِ ابزار نو می‌شوند) — **یک منبعِ حقیقت؛ قالبِ تازه خودکار به
  سایت‌های خودکار هم می‌رسد.**
- **auto-site (AUTO_SITE_V=4):** قالبِ هر شخص از بینِ ۱۰ قالبِ صنفش «قطعی از هَشِ شماره‌اش»
  انتخاب می‌شود (تنوع + پایداری در بازسازی) و بعد با دادهٔ واقعی شخصی‌سازی: هیروی خانه =
  نام/نقش/شهر، خدمات = تخصص‌های واقعی (وگرنه خدماتِ صنفیِ قالب)، آمار/گالری فقط واقعی وگرنه
  **حذف** (قانونِ آهنین: عدد/عکسِ نمونهٔ قالب روی شخصِ واقعی جعل است)، ایمیلِ example.com
  پاک، تلفن/آدرس/برندِ فوتر واقعی، CTA → پروفایلِ دایرکتوری، تحصیلاتِ معمار روی صفحهٔ
  «درباره»، و صفحه‌ای که پس از حذفِ محتوای بی‌سند خالی مانده از منو حذف می‌شود. سئو همان
  نام-اولِ فاز ۲۹۶ می‌ماند (نه seoTitleِ عمومیِ قالب).
- themeVars صفحهٔ آگهیِ داخلِ سایت (۲۹۷د) تاریکی‌سنج شد — قالب‌های تیره (مشکی لوکس/سرمه‌ای
  شب/زمرد تیره) متنِ تیره-روی-تیره نمی‌گیرند.
- قاعده: هر تغییری در قالب‌ها/صفحات/پیش‌فرض‌ها فقط در site-templates.ts — نه در ابزار، نه در auto-site.

### فاز ۲۹۷و — محتوای هر صنف مالِ همان صنف («سازنده اصلا ربطی به سازنده نداره»)
دو ریشه، هر دو در خودِ سایت‌ساز (نه فقط خودکار):
1. **PROFILE_PRESETS فقط ۶ صنف داشت** (معمار/پیمانکار/کارشناس/دفتر حقوقی/بانک و بیمه/دفترخانه) —
   مشاور/آژانس/**سازنده**/فروشگاه/سرمایه‌گذار/حقوقی به BLOCK_DEFAULTSِ عمومیِ «مشاور املاک»
   می‌افتادند: سایتِ سازنده متنِ «خرید، فروش و اجاره» می‌گرفت. هر ۱۲ صنف حالا preset کامل دارند
   (خدمات/درباره/آمارِ نمونه/eyebrow/سئو) — تستِ «هر ۱۲ صنف preset صنفی دارند» نگهبان است.
2. **بَجِ هیرو:** سایت‌ساز نشان را در `eyebrow` می‌نویسد ولی رندرِ سایتِ منتشرشده فقط `badge` را
   می‌خواند → همهٔ سایت‌ها (دست‌ساز و خودکار) «املاک و مستغلات» می‌گرفتند. ترتیبِ رندر حالا
   eyebrow → badge → پیش‌فرض.
AUTO_SITE_V=5 → بازسازیِ همهٔ سایت‌های خودکارِ دست‌نخورده با محتوای صنفیِ درست.

### فاز ۲۹۷ز — پروژه‌های واقعیِ سازنده روی سایتش («پروژه‌ها رو نشون نمیده تو سازنده‌ها»)
- `seedOf` برای نقشِ builder حالا دادهٔ کاملِ پرشین‌سازه را می‌کشد: `builderIdForPhone` →
  پروفایل → ۲۴ پروژهٔ برتر (عنوان=آدرس، توضیح=منطقه/فاز/طبقات/واحد/متراژ، عکسِ photo/photos/
  projMeta، لینک به `/projects/{slug}` با ensureProjectSlug) + پروژه‌های دستی و about/tagline از
  builder-public-store. آمارِ واقعی: تعدادِ پروژه/مناطق/جمعِ واحد/جمعِ متراژِ زمین.
- `ServicesSlider` آیتم‌هایش `image`/`href` اختیاری گرفت — همان اسلایدر، کارتِ پروژه (عکس +
  «مشاهدهٔ پروژه ←») هم می‌شود؛ آیتمِ بدونِ این دو عینِ قبل است (سایت‌های موجود دست نمی‌خورند).
- بلوکِ «پروژه‌های ما» بعد از هیروی خانه و روی صفحهٔ «پروژه‌ها» می‌نشیند؛ گالریِ سازنده از
  عکسِ واقعیِ پروژه‌ها پر می‌شود؛ سازندهٔ بی‌داده هیچ کارت/آمارِ جعلی نمی‌گیرد. AUTO_SITE_V=6.

### فاز ۲۹۷ن — پنلِ سایت‌سازها: ردیفِ «در صفِ ساخت» + وضعیتِ پیامکِ ردیف‌به‌ردیف
«حسابِ جدید می‌سازم، هیچ‌جوره نمی‌فهمم سایت/پیامکش چه شد» — ریشه: جدول فقط سایت‌دارها را
نشان می‌داد؛ حسابِ تازه تا ساختِ سایت اصلاً ردیف نداشت.
- API `/api/admin/sites`: حساب‌های نقش‌دارِ «بدونِ سایت» (تا ۱۰۰۰تای جدیدتر) هم ردیف می‌شوند
  (`pending:true`) + هر ردیف `smsState` (sent/waiting/queued/failed/invalid/manual) و
  `smsTries`/`smsErr`/`siteAt`. totals.pending = کلِ در صف.
- پنل: کاشیِ «در صفِ ساخت»، ستونِ «پیامک» با چیپِ رنگی، فیلترِ «سایت: ساخته/در صف» و
  فیلترِ پیامکِ ۵حالته؛ ردیفِ باز خطای کاملِ پیامک و زمان‌ها را نشان می‌دهد. جستجو
  حساب‌های در صف را هم می‌گیرد — حسابِ تازه‌graduate بلافاصله قابلِ‌رهگیری است.
- `sendAutoSiteSms`: بدنهٔ پاسخِ IPPanel (علتِ دقیقِ 400: پترن تاییدنشده/متغیر غلط…) دیگر
  دور ریخته نمی‌شود — در خطای ردیف می‌نشیند (lastErr تا ۲۲۰ نویسه).

### فاز ۲۹۷ف — هیچ دکمه‌ای به انکرِ مرده نرود + CTAی صنفی («سوتیِ تماس با ما»)
دکمهٔ هیروی صفحه‌های داخلی از BLOCK_DEFAULTS لینکِ `#listings` می‌گرفت که روی آن صفحه وجود
ندارد — دکمهٔ مرده. حالا:
- رندر: سکشنِ gallery و services انکر (`id`) گرفتند (قبلاً «مشاهدهٔ پروژه‌ها» جایی نمی‌رفت).
- auto-site (پاسِ لینک‌ها، AUTO_SITE_V=9): هیروی خانه → سکشنِ «آنچه ارائه می‌دهد»
  (#listings/#gallery/#catalog/#services)؛ هیروی صفحه‌های داخلی → صفحهٔ واقعیِ `{base}/contact`؛
  CTAی صفحهٔ بدونِ بلوکِ تماس هم → صفحهٔ تماس (CTAی providerUrl دست‌نخورده).
- `ProfilePreset.contactCta` (۱۲ صنف): برچسبِ دکمهٔ صنفی — معمار «درخواستِ مشاورهٔ طراحی»،
  سازنده «درخواستِ همکاری و پیش‌فروش»، دفترخانه «رزروِ نوبت»… در هیروی صفحه‌های داخلی و CTAها
  (سایت‌سازِ دستی هم از همین preset می‌گیرد). ۵ تستِ نگهبان.

### فاز ۲۹۷ق — پوستهٔ «پروفایلیِ» حرفه‌ای برای سایت‌های منتشرشده («انگار بچه ۵ ساله طراحی کرده»)
مقایسه با پلتفرم‌های تخصصی (پروفایلِ tarh2tarh): چیزی که آن‌ها را حرفه‌ای می‌کند هیروی
پروفایلی + کارتِ آمار + ناوبریِ سکشن + «نمایشِ شماره» است، نه صرفِ رنگ. همه در «رندر»
(app/[site]/page.tsx) ساخته شد → روی کلِ ناوگان (دست‌ساز و خودکار) بدونِ بازسازی و بدونِ
AUTO_SITE_V زنده می‌شود:
- **هیروی پروفایلی**: آواتارِ واقعی (عکسِ بلوکِ درباره)، نشانِ «✓ تاییدشده در ملک‌جت»،
  دکمهٔ دومِ «☎ تماس» (وقتی CTAی اصلی به تماس نمی‌رود)، دو هالهٔ رنگِ تم برای عمق، و
  **کارتِ اعتمادِ شیشه‌ایِ شناور** فقط با اعدادِ واقعی: بازدیدِ کل (sstat)، میانگین+تعدادِ
  نظراتِ تاییدشده، سالِ عضویت — فقط صفحهٔ خانه؛ سلولِ بی‌داده حذف (قانونِ آهنین).
- **نوارِ چسبانِ سکشن‌ها** (SectionNav) زیرِ هدر: از بلوک‌های همان صفحه؛ ≥۳ سکشن تا رندر
  شود؛ اسکرولِ نرم + scroll-margin برای دو هدرِ چسبان. testimonials انکرِ `#reviews` گرفت.
- **آمار → کاشی‌های کارتیِ آیکن‌دار** (آیکن از کلیدواژهٔ برچسب: پروژه/واحد/متراژ/سال…).
- **تماس → دوستونه** («ارتباط با ما» + فرم) با `RevealPhone` («نمایشِ شماره» با ماسک —
  شماره در HTML خام لو نمی‌رود) و «تماسِ مستقیم».
- فنی: `getSiteStats(slug)` تک‌ردیفی (allSiteStats برای هر رندر سنگین است)؛ SiteShell
  async شد (هر دو مسیرِ خانه/زیرصفحه از همین می‌گذرند)؛ شکستِ آمار/نظرات صفحه را نمی‌اندازد
  ولی console.error دارد.

### فاز ۲۹۷ق۲ — مدرن‌سازیِ زبانِ بصریِ کلِ رندر («کل طراحی زشته، مدرن نیست»)
دو ریشهٔ «آماتور» بودن: (۱) حاشیه/خاکستری‌های «بژِ هاردکد» (#efe9df، #e6ddcd، #9b9285…)
در ۷ فایلِ رندر که با پالت‌های تیره می‌جنگید؛ (۲) صفر حرکت/عمق. همه chrome-سطح:
- همهٔ بژها → توکن‌های تم‌آگاه با `color-mix(var(--mjs-text))` (BORDER/BORDER_SOFT/
  BORDER_DASHED/INPUT_BORDER در page.tsx + جایگزینیِ مستقیم در ۶ کامپوننتِ اسلایدر/فرم).
- دکمه‌ها → قرصِ گرادیانی `btnBg(primary)` (گرادیانِ primary→secondary + درخشش).
- حرکت: ورودِ نرمِ هیرو (badge/h1/کارتِ اعتماد پلکانی)، شناوریِ ۱۱ثانیه‌ایِ هاله‌ها،
  و **ظهورِ سکشن‌ها هنگامِ اسکرول** با `animation-timeline: view()` داخلِ
  `@supports` + `prefers-reduced-motion` (کروم/اج متحرک؛ بقیه ثابتِ سالم).
  ⚠️ اسکرین‌شاتِ fullPage سکشن‌های پایین را opacity:0 نشان می‌دهد — artifactِ ابزار است،
  با اسکرولِ واقعی ظاهر می‌شوند (با Playwright + اسکرولِ چرخی تایید شد).
- CTA → پنلِ شیشه‌ای (بلور + حاشیهٔ روشن + هاله)؛ متنِ دکمهٔ سفیدش ثابت تیره (روی تمِ
  تیره INK روشن بود = نامرئی). فوتر خطِ گرادیانیِ جداکننده گرفت. NavBar لوگومارکِ
  مربعِ گرادیانی با حرفِ اولِ برند. SectionHeading خطِ گرادیانی + درخشش.
- ابزارِ تاییدِ بصری: سایتِ دموی محلی (seed با buildProfileSite + saveSite + آمار/نظرات)
  + `next dev` + Playwright (chromium در /opt/pw-browsers) — قبل از هر دیپلویِ طراحی
  اسکرین‌شاتِ دسکتاپ/موبایل بگیر و خودت ببین.

### فاز ۲۹۷ظ — سینکِ سریال + سقفِ کوئریِ بیشتر (سرورِ کم‌توان)
فاز ط۲ (acquire-retry + conc=2) کافی نبود: روی سرورِ ۱ vCPU با پستگرسِ همان‌ماشین، حتی ۲
سینکِ هم‌زمان هم statement/connect timeout می‌داد و ۳۰ آژانس گیر می‌کردند. دو تغییرِ قطعی:
- MAX_ROSTER_SYNCS پیش‌فرض ۲→۱ (سریال): هر رقابتِ پایگاه‌داده بینِ سینک‌ها حذف شد — هر سینک
  کامل می‌شود بعد نوبتِ بعدی. چون افزایشی‌اند اغلب چنددقیقه‌ای‌اند و سریال هم به صف می‌رسد.
- statement_timeout سراسری ۱۵s→۳۰s: خواندنِ بلابِ بزرگِ آژانس (۵۵ مشاور، چند مگابایت) زیرِ
  بار >۱۵s می‌شد و کلِ سینک را می‌انداخت؛ ۳۰s فضا می‌دهد (kvMutate از قبل ۴۵s دارد).
نکتهٔ عملیاتی: lastErrorِ «خطای گذرای زیرساخت — …» (پیامِ قدیمی) نشانهٔ این است که پروسهٔ
pm2 هنوز به کدِ ض/ط۲ reload نشده؛ کدِ تازه پیامِ «خطای گذرا (تلاشِ n/۸): <علتِ واقعی>» می‌نویسد.
درمانِ بنیادیِ بعدی (اگر سریال هم کند بود): کوچک‌سازیِ بلابِ per-owner (آرایهٔ آگهی‌های چندمگابایتی).

### فاز ۲۹۷ط۲ — علتِ ریشه‌ایِ گیرکردنِ سینک‌ها: اشباعِ استخرِ پستگرس
لاگ (بعد از فاز ۲۹۷ض که علت را حفظ کرد) دو خطای واقعی داد:
`timeout exceeded when trying to connect` (استخرِ اتصال پر) و `canceling statement due to
statement timeout`. یعنی پستگرسِ اینستنسِ ۰ زیرِ فشار بود: ۳ سینکِ هم‌زمان + صفِ حساب +
کرون روی استخرِ ۳۰تایی. دو فیکسِ ریشه‌ای:
- `acquire()` در db.ts: گرفتنِ اتصال حالا ۳ بار با backoff (۶۰۰ms/۱.۲s/۱.۸s) تلاش می‌کند و
  فقط خطای «پرشدنِ استخر/too many clients/terminated» را retry می‌کند (نه خطای واقعیِ کوئری).
  همهٔ ۹ فراخوانِ connect() به acquire() رفتند. یک فشارِ گذرا دیگر کلِ ایمپورت را نمی‌کُشد.
- MAX_ROSTER_SYNCS پیش‌فرض ۳→۲: ۲ سینک + کارهای پس‌زمینه زیرِ سقفِ استخر می‌مانَد.
  (kvMutate از قبل statement_timeout=۴۵s داخلِ تراکنش دارد؛ مشکل «گرفتنِ اتصال» بود نه خودِ mutate.)
انتظار: آژانس‌های گیرکرده (شاهان و…) حالا سینک را «کامل» می‌کنند. اگر باز گیر کردند، ROSTER_SYNCS=1.

### فاز ۲۹۷ض — «۱۴ ساعت در صف، هرگز کامل نمی‌شود» (۳۸ آژانس گیرکرده)
فیدبکِ درستِ کاربر: شاهان (و ۳۸ آژانس) «در صف/خطای گذرا» می‌مانند و هرگز سینکِ موفق
نمی‌کنند؛ گزارش دروغ می‌گفت «۲ ساعت پیش سینک شد». ریشه (در syncRoster):
- **حلقهٔ بی‌پایانِ خاموش**: `runAttempts` «پیش از» فازِ ایمپورت صفر می‌شد (خط ۵۶۸، بخششِ
  «پیشرفتِ اسکرپ»). اگر ایمپورت هر بار خطای گذرا می‌داد، شمارنده هرگز بالا نمی‌رفت و سقفِ
  ۸ هرگز فعال نمی‌شد → ابدی. بخشش به مسیرِ «بودجه تمام شد» منتقل شد (آن‌جا واقعاً بخشی
  ایمپورت شده)؛ خطای گذرای ایمپورت حالا می‌شمارد و بعد از ۸ بار «با علتِ واقعی» تسلیم می‌شود.
- **علتِ واقعی دور ریخته می‌شد** (نقضِ قانون شمارهٔ یک): پیامِ «خطای گذرای زیرساخت» جای
  msgِ واقعی را می‌گرفت. حالا lastError = `خطای گذرا (تلاشِ n/۸): <msgِ واقعی>` و پیامِ
  تسلیم هم علت را نگه می‌دارد — تا بفهمیم «چه چیزی» تایم‌اوت می‌خورد (PG/دیوار/سوکت).
- **زمانِ دروغین**: `lastRun` آخرین «تلاش» است (حتی ناموفق). فیلدِ جدیدِ `lastOkAt` فقط روی
  سینکِ موفقِ کامل ست می‌شود؛ گزارش حالا «سینکِ موفق» و ستونِ «⚠️ گیرکرده» را نشان می‌دهد.
کارِ باقی: علتِ واقعیِ خطای گذرای ایمپورت را از لاگ/پنل بخوان و خودِ ایمپورت را در برابرش
مقاوم کن (مثلِ retry-per-page که در fetchDivarProfileTokens فاز ۲۹۷ش اضافه شد).

### فاز ۲۹۷خ — شناساییِ نامِ مشاور «کاملاً ML-only» (به‌دستورِ صریحِ مالک)
کیس‌استادیِ شاهان ثابت کرد AI (اولویتِ اولِ خوشه‌بندی) مدت‌هاست مرده است: گپ
«insufficient user quota ＄-0.006» — هر سینک ۴۵ خطای ۴۰۳ تولید و کُند می‌کرد. مالک:
«فقط ماشین‌لرنینگ فعلاً». در buildAgencyRoster فازِ AI پشتِ `const AI_NAMING = false`
کاملاً خاموش شد (مثلِ ممیزیِ نظرات، فاز ۲۹۷ک). نام‌گذاری حالا فقط: مدلِ خلوتِ NER (۹۵٪)
+ قواعدِ امضا (labeledName/selfIntro/extractSignature با دروازهٔ nameProb) + واژه‌نامهٔ
آموخته (موضعِ امضا). برگرداندن = AI_NAMING=true + شارژِ گپ؛ flagِ per-scrapeِ useAI
دست‌نخورده ماند. تستِ ۱۹۶ به «AI هرگز پرسیده نشد» به‌روز شد (مشاورها همچنان از امضا ساخته می‌شوند).

### فاز ۲۹۷ث۲ — اصلاحِ فازِ ث: deEmoji جداکننده را می‌کُشت (فیکسِ ۲۹۷ث واقعاً کار نمی‌کرد)
فازِ ث فقط LABELED_SEP را گسترد ولی `labeledName` «اول deEmoji می‌کند» و مجموعهٔ مجازِ
deEmoji (`[^ء-ی‌\sA-Za-z0-9۰-۹:：.\-،_]`) کاراکترهای ~ – — | و تطویل را «به فاصله» تبدیل
می‌کند — پس جداکننده قبل از regex نابود می‌شد و «علیرضا فلاحی» هنوز بی‌نام می‌ماند (در
کیس‌استادیِ زنده ۱۸+۲+۱+۱ آگهیِ فلاحی). درسِ تلخ: تستِ فازِ ث را با grepِ فیلترشده «سبز»
گزارش کردم درحالی‌که واقعاً قرمز بود — **هرگز نتیجهٔ تست را از grepِ فیلتر نخوان؛ خطِ ✓/✗ را مستقیم ببین.**
- فیکس: در labeledName جداکننده‌های ~ ـ – — | «پیش از» deEmoji به «:» نرمال می‌شوند.
- باگِ دومِ لو رفته: جداکنندهٔ ضعیف پیش از نامِ مکان هم می‌آید («منطقه ~ سعادت‌آباد»)؛ چون
  برچسب‌دار p=0.98 می‌گیرد و از دروازهٔ nameProb رد نمی‌شود، پسوندِ آباد/شهر/پارک + فهرستِ
  PLACE_WORDS (نواحیِ تهران) در labeledName رد می‌شوند تا مشاورِ جعلیِ «سعادت آباد» نسازد.
- ۴ تستِ فازِ ث حالا واقعاً سبز (خط‌به‌خط دیده شد)؛ کلِ سوئیت ۱۱۳۲/۱۱.

### فاز ۲۹۷ث — دورِ سومِ کیس‌استادی: AI مُرده، مدلِ primeنشده، جداکنندهٔ ~
سه کشفِ اجرای صادقانهٔ اسکریپت:
1. **AI (اولویتِ اولِ خوشه‌بندی) مدت‌هاست مرده**: گپ «insufficient user quota ＄-0.006» —
   علتِ بزرگِ حجمِ بی‌نام‌ها در همهٔ آژانس‌ها. (کاربر باید شارژ کند، یا مسیرِ ML-only.)
2. فهرستِ آشغالِ وحشتناکِ دورِ ۳ («تردد ×۴»…) artifact خودِ اسکریپت بود: سینکِ تولید اولِ
   کار `primeNameModel()+loadNer()` می‌کند (agency-roster-store:۴۷۷) ولی اسکریپت نمی‌کرد →
   مدلِ خلوت غایب + nameProbSync=null → مسیرِ regexِ بی‌دروازه. اسکریپت حالا primes می‌کند
   و وضعیتِ مدل‌ها را چاپ. **درسِ ابزارسازی: هر مسیرِ جانبی باید دقیقاً همان initialize تولید را اجرا کند.**
3. «⚜️ مشاور تخصصی منطقه ~ علیرضا فلاحی» ×۲ بی‌نام بود: LABELED_RE فقط دونقطه را
   جداکننده می‌دانست. حالا ~ ـ – — | و تیره هم جداکننده‌اند، با «مرزِ کلمهٔ فارسی» روی
   کلیدواژه (حروفِ پایه؛ اعراب آزاد تا «کارشناسِ فروش» بماند) و جمع‌های صریح — وگرنه
   «کارشناسی شده - تک برگ» نامِ جعلیِ p=0.98 می‌ساخت. ۴ تستِ نگهبان.

### فاز ۲۹۷ت — دورِ دومِ کیس‌استادی: درِ بی‌نگهبانِ «حدسِ مدل» + مسموم‌های زندهٔ واژه‌نامه
اجرای اسکریپت با lexiconMatch/اولویتِ «واقعیِ» تولید دو چیز را لو داد:
1. **مسیرِ مدل در extractSignature دروازهٔ دوم نداشت**: مسیرِ regex همهٔ کاندیداها را از
   nameProbSync≥NAME_THRESHOLD می‌گذرانْد ولی خروجیِ مدل (خط ۸۰) مستقیم پذیرفته می‌شد —
   «تمیز/سخت/غیر/انبار/همراهتان» حدسِ مدل بودند و با قانونِ MIN_FILES=2 مشاورِ جعلی
   می‌ساختند (شاهدِ زنده: «همراهتان» با ۲ فایل در پنلِ شاهان). حالا حدسِ خالصِ مدل
   (p<۰.۹۷) هم از همان دروازه می‌گذرد؛ امضای برچسب‌دار/معرفیِ خود (p≥۰.۹۷) مستثنا.
2. واژه‌نامهٔ زندهٔ تولید مدخل‌های مسمومِ قدیمی دارد («یکپارچه/نگهبانی/اطلاعات بیش/باقی
   میماند» از وسطِ متن: «سند یکپارچه»، «نگهبانی ۲۴ساعته»). این‌ها در تولید آگهی تصاحب
   «نمی‌کنند» (قانونِ موضعِ ۲۸۰ + فیلترِ strictName روی learned) ولی به STOPWORDS رفتند
   تا nameProb/learning هم آلوده نشود؛ pruneLearned خود-هرسشان می‌کند.
   («باقی میماند»: validName طبقِ طراحی به «باقی» پاک‌سازی می‌کند — دروازهٔ یادگیری strictName است.)
- اسکریپتِ کیس‌استادی حالا «عینِ» تصمیمِ تولید را شبیه‌سازی می‌کند (chosen = مدل/heuristic؛
  واژه‌نامه فقط اطلاع) و خروجی را بر اساسِ نام گروه می‌کند تا خوشهٔ جعلیِ ×۲ فوراً دیده شود.
- درسِ روش: شبیه‌سازِ سست در ابزارِ تشخیص = نتیجهٔ گمراه‌کننده (۴۸ِ دورِ اول خوش‌بینانه بود).

### فاز ۲۹۷ش — کیس‌استادیِ آژانس شاهان: ۳ ریشهٔ «۴۰۶ آگهیِ بی‌نام»
روش: scripts/roster-casestudy.mjs توکن‌های بی‌نامِ ذخیره‌شده را با «عینِ» دروازه‌های تولید
(lexiconMatch exported + validName + extractSignature) روی دیوارِ واقعی سنجید. یافته‌ها:
1. **۴۸ از ۶۰ با کدِ فعلی حل است** (اثرِ فازهای ل/م + واژه‌نامه: فلاح/لک/محدودی/معین) —
   سینکِ بعدی خودکار درست می‌شوند. ۱۲ باقی همه «متنِ خالی» بودند (آگهیِ حذف‌شده/واکشی).
2. **ریشهٔ بزرگ، «پوشش» بود نه NER**: دیوار ۱۱۴۲ آگهیِ فعال، اسکن فقط ۲۶۱. در
   fetchDivarProfileTokens هر صفحه «یک» پروکسیِ تصادفی می‌گرفت و اولین صفحهٔ غیر۲۰۰
   کلِ خزش را بی‌صدا قطع می‌کرد؛ صفحهٔ تماماً تکراریِ دیوار هم قطعِ فوری بود. حالا: هر
   صفحه تا ۳ تلاش با پروکسیِ تازه، تحملِ یک صفحهٔ بی‌پیشرفت، و قطعِ ناقص با
   `[divar] ⚠ اسکن ... قطع شد` فریاد می‌زند (قانونِ شمارهٔ یک).
3. **واژه‌نامهٔ مسموم**: «خانه» به‌عنوان مشاور یاد گرفته شده بود و validName رد نمی‌کرد.
   خانه/منزل/ساختمان/پروژه/فرصت → REALTY_TOKENS؛ و `SOLO_NEVER_NAME` (طلایی + شهرها)
   فقط «نامِ تک‌کلمه‌ای» را رد می‌کند — چون REALTY per-word و با قاعدهٔ صرفیِ «ی» اعمال
   می‌شود و «رضا طلایی»/«تهرانی» را می‌کُشت. strictName('خانه')='' → pruneLearned
   خود-هرس می‌کند. ۵ تستِ نگهبان. (نمونهٔ کاربر: «کارشناس تخصصی منطقه طلایی» → طلایی تنها اسم نمی‌شود.)

### فاز ۲۹۷ر — «با هر دیپلوی سرور می‌میرد» (SSH هم از دست می‌رفت) — سه حصارِ ریشه‌ای
شواهد (۳ اکتبر): free=۷.۸G با ۶.۱G مصرف، load=۱۵.۹ روی تک‌هسته، build تمام‌شده، SSH وصل
نمی‌شد. ریشه: بودجهٔ رمِ خودِ ناوگان (max_memory_restart: ۲۶۰۰M + ۳×۱۳۰۰M + پستگرس) ≈ کلِ
رمِ ماشین است؛ **برای build (~۲GB) هیچ رمی تعریف نشده**. هر دیپلوی → سواپ‌ترش → لودِ دورقمی.
nice/ionice فقط CPU/IO بود؛ «فشارِ رم» حصار نداشت. در auto-deploy.sh و deploy.sh:
1. **گاردِ پیش‌پرواز** (فقط کرون): MemAvailable<۱۱۰۰MB یا load1>۶ → بیلد با پیامِ بلند به
   دورِ بعد موکول (مارکرِ ناتمام می‌مانَد، پس خودش ادامه می‌دهد).
2. **پنجرهٔ بیلد = ۱.۳GB رمِ آزاد**: melkjet-3003 فقط در طولِ بیلد stop می‌شود (nginx با
   ۳۰۰۱/۳۰۰۲ می‌مانَد) و با `trap … EXIT` در «هر» خروجی برمی‌گردد — حتی اگر build بمیرد.
3. **حصارِ cgroup**: build داخلِ `systemd-run --scope` با CPUQuota=70%، MemoryMax=2600M،
   MemorySwapMax=512M — در بدترین حالت فقط «بیلد» کشته می‌شود و دورِ بعد دوباره تلاش می‌شود؛
   سرور و SSH همیشه زنده می‌مانند. بدونِ systemd-run → همان nice/ionice.
- نکتهٔ عملیاتی: git pull فایل را با rename عوض می‌کند → اسکریپتِ در حالِ اجرا fd قدیمی را
  می‌خوانَد؛ یعنی «این» دیپلویِ حامل، هنوز با اسکریپتِ قدیمی اجرا می‌شود و حصارها از دیپلویِ
  بعدی فعال‌اند. pm2 واقعی زیرِ root است — `pm2 status` با کاربرِ ubuntu دیمنِ خالیِ تازه می‌سازد
  (pm2 kill با همان کاربر پاکش می‌کند). درمانِ بنیادیِ بعدی: کوچک‌سازیِ پیکره‌ها (backlog).

### فاز ۳۳۹ — پوستهٔ نسلِ ۲ سایت‌ساز («گرافیک افتضاح، انیمیشن ندارد، حسِ سایتِ پیش‌ساخته»)
همه در لایهٔ رندر (`app/[site]/page.tsx` + `SiteMotion.tsx`) → کلِ ناوگان (دست‌ساز و خودکار) بدونِ بازسازی.
- **ریشهٔ «انیمیشن ندارد»:** ظاهرشدنِ بخش‌ها با `animation-timeline: view()` بود که **سافاریِ آیفون و فایرفاکس
  ندارند** — یعنی بیشترِ کاربرانِ موبایل سایتِ کاملاً بی‌حرکت می‌دیدند. `SiteMotion` (کلاینت) با IntersectionObserver
  کلاسِ `mjs-in` می‌دهد؛ برچسب‌گذاری خودکار است (h2 ← mask، کارت‌ها ← پلکانی). حالتِ پنهانِ پیش از ورود فقط
  زیرِ `html.mjs-js` (بدونِ JS/خزنده محتوا کامل است). ورود با animation و `fill: backwards` تا transformِ هاورِ
  کارت بعدِ ورود آزاد بماند. + شمارشِ عددها (`data-count`)، نوارِ پیشرفتِ اسکرول، هدرِ فشرده با اسکرول، نورِ
  دنبال‌کنندهٔ نشانگر روی کارت‌ها، پارالاکسِ هیرو. `prefers-reduced-motion` محترم است.
- **هیرو:** چیدمانِ دوستونهٔ ادیتوریال (متن از راست + پرترهٔ واقعیِ عکسِ «درباره» یا کارتِ شیشه‌ایِ سه‌بعدی از
  خدماتِ واقعیِ سایت)، پس‌زمینهٔ «شفقِ» متحرک از رنگ‌های برند به‌جای گرادیانِ تخت، تیترِ کلمه‌به‌کلمه با واژهٔ
  آخرِ گرادیانی. قالب‌ها `align:'center'` ذخیره کرده‌اند → در چیدمانِ دوستونه متن همیشه راست‌چین.
- **بخشِ خالی رندر نمی‌شود** (آگهی/مقاله/تیم/محصول/گالریِ بی‌عکس) — جعبهٔ «هنوز … نداریم» امضای قالب بود.
  لینک‌های مردهٔ نوارِ بخش‌ها را SiteMotion حذف می‌کند. پیش‌نمایشِ ویرایشگر جداست (iframe نیست).
- آمار: باندِ تیره با عددهای بزرگِ گرادیانی (بی‌ایموجی)؛ خدمات: کارتِ راست‌چین با شمارهٔ توخالی و پرشدنِ هاور؛
  نوارِ متحرکِ خدمات زیرِ هیرو؛ CTA با لبهٔ درخشانِ چرخان (`@property --mjs-a`)؛ فوتر با نامِ برندِ غول‌پیکرِ
  توخالی؛ منو: خطِ زیرینِ برند به‌جای قرصِ توپُر + «تماس» به‌شکلِ دکمه. دستیارِ ✦ِ ملک‌جت روی سایتِ شخصی پنهان.
- ابزارِ تست: اسکرین‌شاتِ fullPage باید `[data-r]{opacity:1}` تزریق کند (وگرنه بخش‌های اسکرول‌نشده خالی‌اند).

### فاز ۳۳۹ب — ویرایشگرِ سایت‌ساز: «پیش‌نمایشِ واقعی» (WYSIWYG) + صفحه‌های داخلی
- **ریشه:** بومِ ویرایشگر (`BlockBody` در WebsiteBuilderTool، ~۵۰۰ خط) رندرکنندهٔ جدا و قدیمی است → کاربر هنگامِ
  ویرایش ظاهرِ قالبیِ قدیمی می‌دید و بعدِ انتشار چیزِ دیگری. حالا دکمهٔ «👁 پیش‌نمایشِ واقعی»: پیش‌نویس (debounce
  ۶۵۰ms) به `POST /api/sites/draft` → `site-draft-store` (kv `site_draft:{phone}`؛ بی‌PG در `globalThis` — چون Next
  مسیرِ API و صفحه را در بسته‌های جدا بار می‌کند و Mapِ ماژول‌سطح مشترک نیست) → `/site-preview?page=` با **همان**
  `SiteShell` (پرچمِ `preview` = بی‌Beacon، noindex) در iframe با عرضِ دستگاه؛ اسکرولِ iframe بینِ بارگذاری‌ها حفظ.
  `buildPreviewSite` در sites-store همان نرمال‌سازیِ ذخیره است. بومِ قدیمی برای انتخاب/جابه‌جاییِ بلوک ماند.
- صفحه‌های داخلی: `InnerHero` (سربرگِ کوتاه + مسیرِ «خانه / عنوان»)؛ نوارِ متحرک فقط خانه؛ دکمهٔ تماس روی صفحهٔ تماس نه.
- باگ‌ها: gridِ فوتر `1.5fr repeat(auto-fit,…)` نامعتبر بود (یک‌ستونه)؛ نامِ برندِ منو کلِ عنوانِ سئو بود (`brandOf`
  پیش از «|»)؛ شبکهٔ پالتِ ویرایشگر با `1fr` سرریز می‌کرد (`minmax(0,1fr)`)؛ پیش‌نمایشِ کوچکِ قالب‌ها هم‌زبانِ نسلِ ۲ شد.

### فاز ۲۹۷ق۳ — هیروی سینماییِ عکس‌محور + کارتِ محصولی (الگوی قالب‌های Shopify)
«چرا مثلِ Shopify نمی‌شه؟» — چون قالب‌های Shopify عکس‌محورند و هیروی ما همیشه گرادیانِ
خالی بود، درحالی‌که خیلی از سایت‌ها عکسِ «واقعی» دارند (پروژه‌های سازنده، گالری):
- SiteShell عکس‌های واقعیِ خودِ سایت (گالری + کارت‌های services با image) را جمع می‌کند و
  هیرویِ بی‌عکس با ≥۲ عکسِ واقعی، **اسلایدشوی تمام‌صفحه** از همان‌ها می‌شود (HeroSlider
  موجود + روکشِ تیره). سایتِ بی‌عکس همان گرادیانِ ق۲ می‌ماند — هیچ عکسِ ساختگی (قانونِ آهنین).
- کارت‌های آگهی (ListingsSlider/SiteListings): چیپِ شیشه‌ایِ دسته/معامله «روی» عکس +
  گرادیانِ پایینِ عکس + زومِ نرم هنگامِ هاورِ کارت — کارتِ محصولِ فروشگاهی.
- تاییدِ بصری با دموی سازنده + ۳ SVG موقت در public (بعدِ تست پاک شدند).

### فاز ۲۹۷ص — لینکِ کوتاهِ «الزامی» در پیامکِ سایت‌ساز (لینکِ غول‌پیکر ممنوع)
پیامکِ رسیده لینکِ خامِ درصد-encoded داشت (`melkjet.com/%D8%B2%D9%87%D8%B1%D8%A7-…`) به‌جای
لینکِ کوتاهِ nxal. ریشه: «شکستِ بی‌صدا» — `shortenUrl` هر خطایی (کلید نامعتبر، ردِ URL توسطِ
nxal، خطای شبکه) را `return null` می‌کرد و `shortenLinksInText` بی‌خبر لینکِ بلند را نگه
می‌داشت؛ پیامک با لینکِ چندصفحه‌ایِ زشت می‌رفت و هیچ‌جا هیچ ردی نبود (نقضِ قانون شمارهٔ یک).
- `shortenUrlDetailed`: علتِ دقیقِ شکست (پیکربندی‌نشده / HTTP+بدنهٔ nxal / خطای شبکه) را
  برمی‌گرداند؛ `shortenUrl` قدیمی به آن delegate می‌کند و شکست را در لاگ فریاد می‌زند
  (`[shortener] کوتاه‌کردن شکست خورد: …`) — کانال‌های قدیمی (کمپین/هشدار/ترکر) رفتارشان
  عوض نشد ولی دیگر بی‌صدا نیستند.
- `mustShortenUrl` (کانال‌هایی که لینکِ بلند برایشان قابل‌قبول نیست): کوتاه + ثبتِ ترکر؛
  شکست = خطا، نه fallback. `sendAutoSiteSms` (مسیرِ پترن) از آن استفاده می‌کند — شکستِ
  کوتاه‌کننده یعنی «ارسال متوقف» و خطای `کوتاه‌کننده: …` در lastErr/پنلِ سایت‌سازها، تا علت
  دیده و رفع شود؛ نه این‌که لینکِ غول‌پیکر برود.
- تشخیص روی سرور: `node --import ./scripts/reos-loader.mjs scripts/shortener-check.mjs [slug]`
  — پیکربندیِ nxal را نشان می‌دهد و همان URLِ واقعیِ سایت‌ساز را آزمایشی کوتاه می‌کند.
- قاعده: fallbackِ بی‌صدا روی مسیرِ روبه‌کاربر ممنوع — یا نتیجهٔ درست، یا خطای بلند. ۳ تست.

### فاز ۲۹۷س — ارسالِ دستیِ پیامکِ سایت از پنل (تکی/دسته‌ای)
چک‌باکس کنار هر ردیفِ پنلِ سایت‌سازها + «انتخابِ همهٔ نمایش‌داده‌شده‌ها» + دکمهٔ
«📩 ارسالِ پیامک به N کاربر». `sendSmsManual(phones)` در auto-site: همین حالا می‌فرستد،
بدونِ سقفِ ۳تلاش و برای سایتِ دست‌ساز هم (ارادهٔ صریحِ ادمین)؛ بدونِ سایت → خطای روشن
«در صفِ ساخت»؛ شمارهٔ ثابت → «پیامک‌ناپذیر». نتیجهٔ تک‌تک در رکوردِ هر نفر (smsAt/lastErr)
می‌نشیند و پنل بعد از ارسال تازه می‌شود. سقفِ هر درخواست ۱۰۰ شماره.

### فازهای ۲۹۷ل/۲۹۷م — دو باگِ نامِ مشاور از دادهٔ زنده
- **۲۹۷ل:** «جهت احترام به وقت شما و خودمان…» (متنِ کلیشه‌ایِ آژانس) مشاورِ خیالیِ «خودمان»
  با ۱۱ فایل ساخت — خانوادهٔ کاملِ ضمیرِ «خود» + وقت/ماست/عهده به STOPWORDS رفت؛ سینکِ بعدی
  خوشهٔ خیالی را خودکار هرس می‌کند.
- **۲۹۷م:** «خوشبین هستم در خدمت شما عزیزان» بی‌نام می‌ماند — مدل «خوشبین» را صفت می‌دید و
  سکوت می‌کرد و الگوی «نام+هستم»ِ ۲۷۵ب فقط بدونِ مدل اجرا می‌شد. `selfIntroName()` در
  roster-ner (قرینهٔ labeledNameِ ۲۹۵): خطِ آخرها که «با نام شروع و به هستم/هستیم ختم شود»
  قطعی و مقدم بر مدل است (p=0.97)؛ صفت‌های حسی (مفتخر/خوشحال/آماده…) جدا رد می‌شوند.
  ⚠️ درسِ فنی: `\b` در regexِ JS با حروفِ فارسی مرزِ کلمه نیست — lookahead `(?![ء-ی])` به‌جایش.

### فاز ۲۹۷ک — ممیزیِ نظرات: ماشین‌لرنینگِ خودی به‌جای AIِ پولی
خواستِ صریح: «قرار بود همه رو ماشین‌لرنینگ انجام بده نه هوش مصنوعی». ممیزیِ نظرات
(moderateReview) دیگر «هیچ» فراخوانِ AI ندارد → `app/lib/review-ml.ts`:
- **قواعدِ قطعی** (مدرکِ عینی): شمارهٔ تلفن در متن/لینک/آیدیِ تبلیغاتی → رد؛ واژهٔ تند
  («کلاهبردار»…) → داوریِ انسانی (شاید شکایتِ واقعی باشد)؛ متنِ کوتاه/بی‌ساختار → در انتظار.
- **یادگیرنده** (نایو بیزِ هش‌شده، kv `review_ml`؛ فایل در تست): هر تایید/ردِ ادمین
  (پنلِ نظرات) و مالکِ سایت (PATCH /api/reviews) یک نمونهٔ آموزشی است؛ از ۴۰ داوری به بعد
  با حاشیهٔ اطمینان حکم می‌دهد. اعتبارِ گپ دیگر هیچ اثری روی نظرات ندارد.
- برچسبِ پنل «پیشنهادِ خودکار» شد. ممیزیِ «آگهی‌ها» دست‌نخورده (فلایویلِ AI+MLِ خودش را از
  فازهای قبل دارد). ۷ تست در reos-test؛ `.review-ml.json` در gitignore و پاک‌سازیِ تست.

### فاز ۲۹۷ط — منوی ثابتِ پایینِ موبایل در پوستهٔ سایت‌ها
«منو زیر نیومده» = منوی موبایلیِ پایینِ صفحه. `BottomNav` در SiteChrome: خانه + ۴ صفحهٔ اولِ
منو، ثابت پایین (<720px)، آیکن از اسلاگ، های‌لایتِ صفحهٔ فعال، safe-area. چون در «پوسته» است
روی همهٔ سایت‌ها (دست‌ساز هم) بدونِ بازسازی زنده می‌شود؛ صفحهٔ آگهیِ داخلِ سایت `bottomNav={false}`
می‌گیرد (نوارِ چت/تماسِ خودش را دارد). تیترِ گالریِ سازنده هم «گالریِ پروژه‌ها» شد تا با کارت‌های
«پروژه‌های ما» تکراری نشود (AUTO_SITE_V=8).

### فاز ۲۹۷ح — منو در فوتر + سه‌برابرشدنِ سرعتِ بازسازی
- ستونِ «دسترسی سریع»ِ فوترِ سایت‌های خودکار حالا منویِ واقعیِ همان سایت است (خانه +
  صفحه‌های inMenu با اسلاگِ encodeشدهٔ خودِ سایت) — قبلاً انکرهای مردهٔ قالب (#listings…) بود.
  منوی همبرگریِ موبایلِ NavBar از قبل سالم بود.
- `sweepAutoSites(maxCreate=8, maxSms=4, maxUpgrade=24)`: سقفِ «ارتقا» از سقفِ «ساخت» جدا و
  ۳× شد — بازسازیِ کلِ ناوگان از ~۲ ساعت به ~۴۰ دقیقه رسید (ارتقا سبک است؛ ساخت پیامک/slug دارد).
- AUTO_SITE_V=7.

### فاز ۲۹۳ج — پایانِ بازخوانی‌های کاملِ ۵۲هزارتایی (ریشهٔ طوفانِ تایم‌اوت)
لاگِ [mem] نشان داد وسطِ سینک هر ۱۵-۳۰ ثانیه کلِ پیکرهٔ آگهی‌ها از PG بازخوانی می‌شود: عمل‌های
دسته‌ای >۲۰۰ شناسه مارکرِ full در __log می‌گرفتند → دلتا همیشه جا می‌زد → هر بازخوانی چند ثانیه
event loop را فریز می‌کرد و بقیهٔ کوئری‌ها «timeout exceeded when trying to connect» می‌خوردند.
سقف‌ها: LOG_MAX=240 / LOG_IDS_MAX=600 / بودجه=4000؛ پلِ ایمنیِ کامل ۱۰د→۱س؛ کفِ بازخوانی
۱۵ث→۳۰ث؛ هر بازخوانیِ کامل علتش را لاگ می‌کند: `[scraper-store] full reload (علت)`.
سقفِ حافظهٔ اینستنسِ ۰ هم طبقِ اندازه‌گیری ۲۶۰۰M شد (پیکِ عادیِ سینک ۱۷۵۶MB بود و ۱۸۰۰M
وسطِ پاس می‌کُشتش). وزنِ پیکره‌ها برای جراحیِ آینده ثبت شد: آگهی‌ها ۵۲k و enrich ۲۴k ورودی،
هرکدام بارشان heap را به ~۱GB می‌رساند.

### فاز ۲۹۸ — «هر ۵ دقیقه باید ری‌استارت کنم» = طوفانِ `SELECT data FROM listings` (۴ اکتبر)
ریشه با داده پیدا شد نه حدس (۷-بخشیِ تشخیص روی سرور): CPUِ سرور ۹۹.۸٪ ولی **هر ۴ پراسسِ
node صفر** — یعنی node نبود، **postgres** بود. لوپ‌بک ۳۰مگ/ثانیه و eth0 خالی = بارِ داخلی.
بخشِ قطعی: ۸ کوئریِ هم‌زمانِ `SELECT data FROM listings ORDER BY scraped_at DESC` هرکدام ۱۰+
ثانیه، + خطای `57014` (statement timeout) از market-stats. این کوئری کلِ جدولِ ۵۴٬۸۱۲ ردیفی
(۱۶۶ مگ) را می‌خواند و parallel scan + sort می‌کند. سه ریشهٔ هم‌افزا:
- **رمهٔ ری‌استارتِ سرد:** هر ۴ اینستنس هم‌زمان کلِ ۱۶۶مگ را می‌خواندند و هیچ dedup‌ای نبود.
  کاربر هر ۵ دقیقه ری‌استارت می‌کرد → هر بار رمهٔ تازه → **چرخهٔ معیوبِ خودتقویت‌شونده**.
- **`pgCache = null` بعد از هر نوشتن** (mutate/mutateSome/mutateMeta): خواندنِ بعدی روی همان
  اینستنس را به بازخوانیِ کاملِ ۱۶۶مگ مجبور می‌کرد — وسطِ سینکِ رُستر که مدام می‌نویسد، یعنی
  بازخوانیِ کاملِ مداوم روی اینستنسِ ۰.
- parallel scan + sort = CPUِ pg ۹۹.۸٪ (نه node).
**دو فیکسِ امن (scraper-store.ts):** (۱) **singleflight** روی بارگذاریِ کامل — چند خواننده
همزمان روی یک اینستنس یک کوئری را share می‌کنند (`fullLoadInflight`). (۲) **کش بعد از نوشتن
گرم می‌ماند به‌جای null**: `mutate` چون جدول را کامل خوانده و با `fn` به‌روز کرده، db مرجعِ
حالتِ جدید است → کش با آن ست می‌شود (read-your-writes فوری، بدونِ بازخوانی)؛ `mutateSome`
ردیف‌های تغییرکرده را روی کش upsert می‌کند و `mutateMeta` فقط متادیتا را — **فقط وقتی کش
دقیقاً روی revِ پیش از نوشتن بود** (قفلِ FOR UPDATE + شمارندهٔ revِ سراسری این را تضمین می‌کند؛
پلِ ۱ساعتهٔ FULL_RESYNC نوشتِ مستقیمِ SQL از بیرون را پوشش می‌دهد). تست: `scraper-delta-test.mjs`
۱۳→۱۶ (۳ نگهبانِ «بعد از نوشتن full نمی‌زند» برای هر سه مسیر). اجرا روی PG تمیز، همه سبز.
**کارِ ریشه‌ایِ بعدی (هنوز باز):** خودِ `mutate` هنوز در هر فراخوان کلِ ۱۶۶مگ را می‌خواند (برای
dedup/diff لازم دارد) — با کشِ گرم دیگر هر چند دقیقه یک‌بار است نه طوفان، ولی جراحیِ واقعی
کوچک‌کردنِ همین بلابِ در-حافظه است (آگهی‌ها نباید همگی در heapِ هر اینستنس باشند).

### فاز ۲۹۴ — دارک/لایت روی همهٔ صفحات
ProjectView، BuilderProfileView، LegacyProfile و compare در ریشه‌شان متغیرهای تم را inline با
پالتِ تیرهٔ ثابت بازتعریف کرده بودند («دارک و لایت می‌کنیم هیچی تغییر نمی‌کنه») — چون inline var
روی html.light اولویت دارد. پین‌ها حذف شدند؛ تنها استثنای عمدی empRoot (بازی، فاز ۶۱) است.
قانون: هیچ صفحه‌ای حق ندارد `'--bg':` و امثالش را inline پین کند — تم فقط از globals.css.

### فاز ۲۹۲ — نظراتِ دایرکتوری با تاییدِ ادمین + تیکِ آبیِ پولی
- **نظرات روی صفحاتِ متخصصان** (`/{type}/{slug}` — ProviderProfilePage): فهرستِ تاییدشده سمتِ
  سرور رندر می‌شود (سئو + AggregateRating در JSON-LD) و فرمِ ثبت (ProviderReviews.tsx) با
  `{ptype, pslug}` به `/api/reviews` می‌زند — شمارهٔ مالک سمتِ سرور از slug حل می‌شود و لو نمی‌رود.
- **انتشار فقط با تاییدِ ادمین**: نظرِ مسیرِ دایرکتوری همیشه approved=false ثبت می‌شود؛ AI فقط
  «پیشنهاد» را در reason می‌گذارد. مسیرِ قدیمیِ سایتِ شخصی (`slug`) دست‌نخورده ماند (AI خودکار).
- **پنلِ ادمین «نظرات و تیک آبی»** (dirReviews / `/api/admin/reviews`): صفِ تایید (تایید/رد)،
  و مدیریتِ تیکِ آبی. reviews-store: pendingReviews/adminSetApproved/adminDeleteReview.
- **تیکِ آبی**: `BusinessProfile.verified` — فقط با `setVerified` از پنل (saveProfile عمداً به آن
  دست نمی‌زند تا کاربر به خودش تیک ندهد). نمایش: کنارِ نام در کارتِ دایرکتوری (آبی #2f81f7،
  جدا از ✓ سبزِ «پروفایلِ کامل») و هدرِ صفحهٔ متخصص. پرداخت دستی است؛ ادمین بعد از دریافتِ
  وجه شماره را در پنل فعال می‌کند.
- **مرتب‌سازیِ دایرکتوری**: چیپ‌های «برترین‌ها / پرنظرترین‌ها / جدیدترین‌ها» — پروموت‌شده‌ها
  همیشه اول (تعهدِ فروش)، بعد معیارِ انتخابی. امتیازِ کارت‌ها از نظراتِ تاییدشدهٔ واقعی است.
- **پوششِ کامل (فیدبک: «همهٔ پنل‌های دایرکتوری باید داشته باشه»)**: سازنده‌ها هم admin-gated
  شدند (builder-public-store: approved روی Review — رکوردِ قدیمیِ بدونِ فیلد «تاییدشده» حساب
  می‌شود تا نظراتِ موجود ناپدید نشوند)؛ صفحهٔ پروژه (`/projects/{slug}` — ProjectView) بخشِ
  «نظراتِ کاربران» با BuilderReviews.tsx گرفت (projectName ثبت می‌شود)؛ وکلای اسکرپ‌شده
  (`/lawyers/{slug}`، بدونِ حساب) با کلیدِ عمومیِ `lw:{slug}` در همان reviews-store؛ کارتِ
  سازنده در دایرکتوری امتیاز/تعدادِ نظر گرفت (allBuilderReviewStats — یک خواندنِ فایل، نه per-builder).
  صفِ پنلِ ادمین هر دو منبع را دارد (چیپِ «🏗 سازنده»؛ approve/reject با source+ownerPhone).
- **سیاستِ قطعی (خواستِ صریح)**: ثبتِ نظر «همه‌جا» نیازمندِ ورود است (ضدِ اسپم؛ فرم روی 401
  به /auth می‌برد)، شمارهٔ ثبت‌کننده (byPhone) ذخیره و در صفِ ادمین با 👤 دیده می‌شود، از هر
  کاربر برای هر کسب‌وکار فقط یک نظرِ در انتظارِ تایید، و آگهی‌های ملک هرگز نظر/امتیاز ندارند.

### فاز ۲۸۸ — معماران (طرح‌۲طرح)
دستهٔ «معماران و طراحان» دایرکتوری از بانکِ ۱۴هزارتاییِ tarh2tarh.com پر می‌شود. سایتِ مبدأ
server-rendered است (HTML، بدونِ React/JSON-LD) → فقط fetch + regex، بدونِ Chrome.
- `app/lib/tarh2tarh-store.ts`: کانفیگ (کوکیِ نشست برای شماره‌ها — ورودِ مبدأ پیامکی است)،
  ذخیرهٔ هر پروفایل در `t2t:p:{handle}`، تیکِ تدریجیِ اسکرپ (چند صفحهٔ فهرست + چند پروفایل
  در هر تیکِ کرون، با مکث) — ازسرگیرنده و مؤدب. پارسر: h1/p، آمارها با numNear، بخش‌ها با
  `id="section-…"`، مختصاتِ پروژه‌ها از `"lat":…,"lng":…`، شماره فقط از لینکِ tel:.
- سئو: بیو از واقعیت‌های ساخت‌یافته با جمله‌بندیِ خودِ ملک‌جت تولید می‌شود (`seoBio`)؛ متنِ
  «دربارهٔ» مبدأ فقط raw می‌ماند و هرگز منتشر نمی‌شود.
- `createArchitectAccounts`: برای شماره‌دارها حساب با نقشِ داشبورد `/architect` + saveProfile
  (displayName/tagline/about/logo/specialties) → در `/architect/[slug]` و دایرکتوری دیده می‌شوند.
- پنل: «معماران (طرح‌۲طرح)» — کانفیگ/وضعیت/فهرست؛ API: `/api/admin/tarh2tarh`.
- **شماره‌ها (تاییدشده با پروبِ زنده):** همان درخواستِ دکمهٔ «نمایش شماره»ی مبدأ —
  `POST /user/contact_number` با `{uuid, contact_type}` (+کوکی و X-XSRF-TOKEN) → `{data:{phone}}`.
  uuid از `const modelUuid`ِ صفحه. کوکی خودکار با Set-Cookieهای پاسخ تازه می‌ماند.
  ⚠️ درسِ روزِ اول: «اولین tel:ِ صفحه» شمارهٔ فوترِ خودِ سایت بود، نه معمار.
- **دادهٔ کامل (فاز ۲۸۸ب):** پروژه‌ها با پنجرهٔ برچسب‌محور دورِ «متراژ زیربنا» (عنوان/عکس/شهر/
  سال/متراژها/دسته) + مختصات از `const lat_lngs`؛ امتیازِ بازخورد/تعدادِ دیدگاه/NPS/نقاطِ قوت؛
  دفتر از `currnetUserJobLocation`؛ جوایز از `get_honours_route` (JSON). نمایش در
  ProviderProfilePage (فقط معمار): آمار/افتخارات/جوایز/تحصیلات/پروژه‌ها + «نقشهٔ پروژه‌ها» با
  ProjectsMap (NeshanMap چندپینه، lazy). ایندکسِ `t2t:byphone:{phone}`→handle پلِ حساب↔داده.
- **مقیاسِ ۱۴هزار:** هیچ مسیری «همهٔ ردیف‌ها» را نمی‌خواند — وضعیتِ هر هندل در `meta.state`
  («e/o/p»+epoch) است؛ tick/stats/فهرستِ پنل/ساختِ حساب همه از state + kvGetِ تک‌ردیف.

### آرشیو — تشخیصِ اولیهٔ فاز ۲۸۳ (انجام شد، برای تاریخچه)
۱. **عکس‌های جست‌وجو دقیقه‌ها طول می‌کشند.** ریشه: `CardImg.tsx` تصویر را از `previewSrc()` یعنی
   **`/_next/image`** می‌گیرد → بهینه‌سازِ سمتِ سرور هر عکس را از divarcdn می‌گیرد، resize و روی دیسک
   کش می‌کند. این کار روی همان سرورِ ۴هسته‌ای انجام می‌شود که سینکِ رُستر/ایمپورت/AI رویش می‌دود، و
   بارِ اولِ هر عکس گران است. **راهِ حلِ پیشنهادی:** برای کارت‌ها مستقیم آدرسِ CDN دیوار سرو شود
   (مکانیزمِ بازگشتِ `OPT_OFF_KEY` از قبل هست، فقط پیش‌فرضش باید برعکس شود)، یا پیش‌گرمِ عکس‌ها به
   جاروی غنی‌سازی اضافه شود. **قبل از تغییر اندازه بگیر** (زمانِ بارگذاریِ اولین کارت، قبل/بعد).
۲. **تعدادِ عکس‌های آگهی روی موبایل معلوم نیست** — کاربر نمی‌داند عکسِ بیشتری هست مگر کلیک کند.
   نشانِ «۱/۸ 📷» روی گالری + نقطه‌های اسلاید لازم است. دادهٔ تعداد در کشِ غنی‌سازی (`gallery`) هست.
۳. **نشانِ «دیده‌شده» (چشم) روی کارت‌ها نیست** — با اینکه در کامیتِ `c8488ce` («seen-badge») ادعا
   شده بود. الان در `PropertyCard.tsx` و صفحهٔ جست‌وجو هیچ ردی از آن نیست؛ یا هرگز کامل نشده یا در
   بازنویسی‌ها گم شده. پیاده‌سازی: شناسه‌های دیده‌شده در `localStorage` + نشانِ چشم روی کارت.

### ⏭ کارِ بعدی: «آگهی‌های مشابهِ» REOS بی‌ربط است (عکس درست شد، شباهت نه)
فیدبکِ کاربر روی صفحهٔ ملک: «اعداد درست است، ولی عکس‌ها نمی‌آید و ارتباطش با آگهیِ بازشده صفر است».
- **عکس — حل شد (فاز ۲۸۲):** `/api/reos/similar` فقط `it.image` را می‌فرستاد، ولی عکسِ آگهی‌های
  دیوار روی آیتم نیست؛ در کشِ غنی‌سازی (`gallery`) است. حالا fallback به `gallery[0]` دارد.
- **شباهت — باز است:** کارت‌ها همه ~۸۴–۸۸٪ «مشابه» نشان می‌دهند ولی محله/نوع/متراژشان بی‌ربط است
  (آپارتمانِ ۲۶۴متریِ جنت‌آباد ↔ کلنگیِ ۵۲۰متریِ سعادت‌آباد). یعنی بردارِ شباهت
  (`similarProperties` در `app/lib/reos/data.ts`) یا خالی/یکنواخت است یا ویژگی‌های تعیین‌کننده
  (محله، نوعِ ملک، متراژ، بازهٔ قیمت) در آن وزن ندارند. **قدمِ اول: ببین embedding واقعاً ساخته
  می‌شود یا همه صفر/یکسان‌اند؛ اگر ساخته می‌شود، محله/نوع را به‌صورتِ فیلترِ سخت اعمال کن (نه وزن)
  و متراژ را باند بگذار (±۴۰٪).** معیارِ پذیرش: در صفحهٔ یک آپارتمانِ ۱۲۰متری، هر ۶ کارت آپارتمانِ
  هم‌محله با متراژِ نزدیک باشند.
- **نکتهٔ مهم:** ارزش‌گذاریِ AVM (اعدادِ Digital Twin) طبقِ تأییدِ کاربر **درست است** — دست نزن.
  (یک بار اشتباهاً سراغش رفتم و برگرداندم.)

### ⏭ کارِ بعدی (تشخیص کامل است، فقط پیاده‌سازی مانده): انتشارِ دسته‌ای
**علتِ دقیقِ «انتقالِ هر فایل ~۵ ثانیه»** (اندازه‌گیری‌شده، نه حدس): هر `mutate` در
`scraper-store.ts` (خط ~۲۳۱) این کارها را می‌کند: قفلِ `FOR UPDATE` روی متادیتا →
**`SELECT data FROM listings` یعنی خواندنِ کلِ ~۲۸هزار آگهی** → `JSON.stringify` روی
**تک‌تکِ** آنها برای ساختِ نقشهٔ diff → اجرای fn → نوشتنِ ردیف‌های تغییرکرده.
یعنی انتقالِ هر **یک** فایلِ مشاور، یک‌بار کلِ جدول را می‌خواند و سریالایز می‌کند.
`reassignListings` برای N فایل، N بار `publishListing` می‌زند ⇒ N × (۲۸هزار خواندن + stringify).
- **راه‌حل:** یک API دسته‌ای (`addUserListings(payloads[])`) که همهٔ فایل‌های یک مشاور را در
  **یک** `mutate` منتشر کند؛ `reassignListings` هم اول همهٔ رکوردهای مشاور را بسازد، بعد یک‌بار
  دسته‌ای منتشر کند و publicIdها را در یک نوشتنِ advisor برگرداند.
- **⚠️ احتیاط:** `publishListing` مسیرِ مشترکِ کلِ سایت است (ایمپورتِ دیوار، ثبتِ دستی، ادمین) و
  منطقِ همتایابی (`findPublicListingTwin`) + حکمِ ممیزی + `remoderate` را دارد. نسخهٔ دسته‌ای باید
  دقیقاً همان‌ها را حفظ کند، وگرنه به‌جای کندی، «آگهیِ گم‌شده/تکراری» می‌گیریم. با تست انجام شود.
- **سنجهٔ موفقیت:** در لاگ، `[roster] reassign done files=N totalMs=…` باید برای ۲۹ فایل از
  چند دقیقه به چند ثانیه برسد.

- **تست:** ۱۲ تستِ جدید در `scripts/reos-test.mjs` (بازتولیدِ دقیقِ آگهیِ گزارش‌شده + لیستِ سیاه +
  مرزِ زنجیرهٔ آدرس + آگهیِ تک‌خطی + دروازه/پاک‌سازیِ ML). `roster-ml-test.mjs` هم هنوز
  فلایویل را اثبات می‌کند (AI: ۱۲→۳، پوششِ بدونِ AI سالم).

### برند — ری‌برندِ ۲۹۸ی۴ (لوگومارکِ «M»؛ جایگزینِ «مُهر»)
**به‌دستورِ صریحِ کاربر** (آپلودِ `melkkhodro.zip`) لوگوی برند از نشانِ «مُهر/SEAL» به
**لوگومارکِ «M» با دو شِورونِ طلایی** عوض شد: نیمهٔ چپ طلاییِ روشن، نیمهٔ راست برنزیِ تیره‌تر.
کامپوننتِ واحد: `app/components/Logo.tsx` — **SVGِ وکتور** (از پیکسل‌های فایلِ طراحی تریس شد،
viewBox `0 0 118 103`، قرینه حولِ x=59؛ `useId` برای idِ گرادیان = SSR-safe)، در Nav و Footer.
فاوآیکون/PWA: `public/icon.svg` + `icon-192/512.png` (از همان SVG با کرومیومِ محلی رندر شد).
نام‌واره همچنان **«ملک‌جت» با Vazirmatn** (قاعدهٔ قدیمی پابرجا: هرگز حروفِ فارسیِ دست‌کشیده).
پالت دست‌نخورده: `#F7DE92 / #D9AD3E / #A9761D` روی `#0E1218`.
**هیروی صفحهٔ اصلی** (`HomeClient.tsx`) به سبکِ سینماییِ موکاپ بازطراحی شد: پس‌زمینهٔ
«همیشه‌تیره» (گرادیانِ غروب — جای عکسِ ویلا که کاربر بعداً می‌فرستد)، چیدمانِ دوستونه
(متن سمتِ راست، پنلِ شیشه‌ایِ `HeroSearch glass` سمتِ چپ)، چیپ‌های شیشه‌ای. تاییدِ بصری با
Playwright (دسکتاپ + موبایل). **فاز ۱ از ری‌دیزاین؛ بقیهٔ صفحات هنوز سبکِ قبلی‌اند** — طبقِ
توافق صفحه‌به‌صفحه پیش می‌رود. خودروجت **همان طلا**، فقط نام و موتیف فرق دارد.

### اپِ اندروید
پروژهٔ کاملِ `melkjet-android/` (۲۳۹۴ خط، ۲۲ فایل) به‌صورتِ zip تحویل شده ولی
**شاید هنوز در ریپو نباشد** — چک کن؛ اگر نیست از کاربر بخواه zip را اضافه کند.
**هیچ‌گاه کامپایل نشده** (محیطِ وب به `dl.google.com` دسترسی ندارد).
اولین کار: بیلد با GitHub Actions یا Android Studio و بستنِ خطاهای کامپایل.



### ⚠️ کرش‌لوپِ اینستنسِ ۰ — حل شد (ریشه‌ای)
**نشانه:** هر ۱–۲ ساعت همهٔ اسکرپ‌ها/تلگرام می‌ایستاد و ریلودِ دستی لازم بود. `pm2 jlist`
نشان می‌داد `status=waiting restart`, `restarts=4414`, `mem=0MB`.
**ریشه:** `max_memory_restart: 1200M` برای **همهٔ** اینستنس‌ها یکسان بود، ولی اینستنسِ ۰
کارگرِ دسته‌ای است (آموزشِ ۳ مدلِ ML + `syncGraphFromEvents(5000)` +
`dedupeListings` که **O(n²)** روی ۲۷هزار آگهی است + اسنپ‌شات‌ها + سایت‌مپ، همه در یک تیک).
اوجِ مصرفش ۱.۳۵–۱.۵۵GB بود → pm2 هر ۱ دقیقه می‌کشتش
(`pm2.log`: `restarted because it exceeds --max-memory-restart`) → کار هرگز تمام نمی‌شد →
بک‌لاگ رشد می‌کرد → تیکِ بعدی سنگین‌تر → **مارپیچِ مرگ**. `max_restarts: 15` هم بی‌اثر بود
چون پروسه بیش از `min_uptime: 10s` زنده می‌ماند و «ناپایدار» شمرده نمی‌شد.
**فیکس:** در `ecosystem.config.js` → `max_memory_restart: idx === 0 ? '2200M' : '1200M'`.
**تأیید با داده:** restarts ثابت ماند و بک‌لاگِ enrich شروع کرد به **کم‌شدن**
(۷۰۸۲ → ۶۵۲۷ در ۲۰ دقیقه) — قبلاً زیاد می‌شد.
**پایش:** `/usr/local/bin/melkjet-trend.sh` (هر ۵ دقیقه → `/var/log/melkjet-trend.log`)
و `/usr/local/bin/melkjet-heal.sh` (اگر غیرonline شد ری‌استارت، اگر کارِ گیرکرده بود reload).
**ریسکِ باقی‌مانده:** `dedupeListings` با O(n²) با رشدِ آگهی‌ها دوباره خطرناک می‌شود —
باید تکه‌تکه/ایندکس‌محور شود. سقف را قبل از آن پایین نیاور.
**سه کشِ بی‌سقف** (`_fileCache`/`_derivedCache` در persiansaze-store و `cache` در json-file)
پایهٔ ~۵۵۰MB می‌سازند — نشتی نیست، هزینهٔ عمدیِ سرعت است؛ در سقف لحاظش کن.


### تاییدِ بصریِ UIِ کلاینتی در این سندباکس: `next start`، نه `next dev` (۸ اکتبر)
وب‌سوکتِ HMRِ `next dev` در این محیط بسته است (`ERR_INVALID_HTTP_RESPONSE`)، و بدونِ آن
React **هرگز hydrate نمی‌شود** — یعنی هیچ `useEffect`ی اجرا نمی‌شود، هیچ fetchی نمی‌رود، و
کامپوننت فقط HTMLِ SSR را نشان می‌دهد. چند دور وقت رفت تا معلوم شود «پنل خالی است» باگِ من
نبود. درمان: `npm run build && npx next start -p 3100` — بدونِ HMR، هیدریشن سالم کار می‌کند و
`page.route()` پلی‌رایت هم می‌تواند APIها را stub کند. برای پنلِ ادمین: کوکیِ `mj_session` را
خودت با `jose` امضا کن (`JWT_SECRET` محلی تعریف نشده، پس کلیدِ پیش‌فرضِ session.ts کار می‌کند)
و چون `?view=` در عمل روی `active` اثر نمی‌گذارد، مقدارِ اولیهٔ `useState<View>` را موقتاً عوض
کن و بعد برگردان.

## Conventions
- **Persistence = file-based JSON stores** in `process.cwd()`, all gitignored (`.*-data.json`).
  Mirror the style of `app/lib/scraper-store.ts` / `crm-store.ts` for any new store.
  NEW stores that hold user data should follow the async dual-mode pattern of `leads-store.ts`.
- **No new npm deps** unless unavoidable (dependency-free patterns: `app/lib/html-select.ts`
  parser, `app/lib/proxy-fetch.ts` CONNECT tunnel, `app/lib/shecan-https.ts` DNS, `app/lib/smtp.ts`).
- **Inline styles + CSS vars** everywhere (--bg2,--surface,--line,--line2,--text,--muted,--faint,--gold,--goldDim). Persian digits via `toLocaleString('fa-IR')`. RTL.
- **Big UI rewrites**: delegate to sub-agents with the API shapes; never let two agents edit the same file (esp. the huge `app/admin/page.tsx`) at once. Build + commit after each batch.
- Always `npx tsc --noEmit -p tsconfig.json` then `npm run build` before committing.

## Data stores (app/lib/*-store.ts → .*-data.json)
scraper (items: listings/directory/product/article/price + owners + categories+addArticle/updateArticle CMS),
market, enrich (per-listing AI cache), crm (tasks), leads, pros (tasks+clients), user (favorites/saved-searches),
sites (website-builder pages), workflow, promo (discount codes), banner (ads), plan (subscription plans),
category (per-type CRUD), promotion (featured/boost slots), audit (admin action log), builder (projects/units/
investors/milestones), account (users: phone/name/role/plan/onboarded), role (roles: dashboard/planId/permissions),
admin-data (super-admin creds + integration keys: gapgpt, neshan{serviceKey,mapKey}, ippanel{apiKey,sender,pattern,patternVar}, smtp, divar.proxyUrl, agentModels).
media files in `.media/` + `.media-index.json`.

## Auth & roles
- OTP login (`/api/auth/send-otp` → `verify-otp`) creates an **account**; NEW users get an
  onboarding step (name + role) on `/auth`; after login they route to their **role's dashboard**
  (role-store `dashboard`). Super admin (09122862184) → `/admin`.
- Roles are **dynamic** (role-store, 8 builtin seeds): each has a default dashboard, a `planId`
  that unlocks it, and a `permissions[]` list. Managed in admin → «نقش‌ها و دسترسی».
- Users managed in admin → «کاربران» (search/filter by role+plan, inline assign, bulk).
  **Timed plan gift (فاز ۵۶):** UserDrawer card «🎁 هدیهٔ پلنِ زمان‌دار» → PATCH /api/admin/users
  `{phone, grantPlan: planId, days}` = setPlan with expiry + grantCredit of the plan's aiCredits +
  logAudit; `grantPlan: ''` revokes. Header chip shows expiry/remaining days (planExpiresAt).
- **Runtime plan-gating (فاز ۵۱ — DONE v1):** `app/lib/plan-gate.ts` = the single access gate.
  Effective permissions come ONLY from the user's **active plan** (`activePlan` — expiry-aware);
  no plan → the free plan of their role's dashboard; no free plan → no module permissions.
  Enforced in 17 tool APIs (`requireModule(s, '<perm>')` → 403 `{code:'plan', upgrade:'/pricing'}`):
  crm/* → 'crm', workflow → 'automation', sites → 'website', comm → 'marketing',
  advisor(+divar)/agency/prodesk → 'crm', builder → 'units', materials → 'store', ai/studio → 'ai_studio'.
  UI: `/api/auth/profile` returns `access` summary; PanelReturnBar shows a full-page 🔒 upgrade
  overlay on /crm /marketing /workflow /website-builder when the module is missing.
  **Kill-switch (فاز ۵۵):** enforcement is ON BY DEFAULT (`planEnforcement()` = `enforce !== false`);
  admin → پلن‌ها → «اعمالِ پلن‌ها» toggle is now only the emergency OFF switch. Super admin always exempt.
  **Dashboard-level lock (فاز ۵۵→۵۸ «see first, pay later»):** `panelLockOf(userPerms, dashPlans)`
  in plan-gate — universe = union of permissions across the dashboard's active plans; a user
  holding NONE of them gets `access.dashLocked`. فاز ۵۸ per user feedback: NO full-page lock —
  **GET (viewing) is free everywhere; only mutating handlers (POST/PATCH/DELETE) keep
  `requireModule`**. `PlanLock.tsx` (root layout, fetches profile only on dashboard paths) shows a
  dismissible bottom «حالتِ مشاهده» banner + /pricing CTA; PanelReturnBar shows the same style
  banner on tool pages instead of an overlay. Dashboards whose plans define no permissions
  (e.g. /buyer — quota-only) never even banner. Fully dynamic: an admin adding a free plan with
  modules unlocks. Dashboard loaders (pros/agency/materials/buyer/owner) treat non-ok API
  responses as no-data instead of crashing («iT is not iterable» bug).
  **Quota enforcement (فاز ۵۲ — DONE):** `requireQuota(s, key, currentCount)` for stock caps
  (count read live from the owning store — no parallel counters): leads (crm+advisor+agency),
  files (advisor+agency listings), agents, products, projects/units/investors (builder),
  sitePages, savedSearches, contacts, crmCustomers (pros clients). Monthly consumables via
  `app/lib/plan-usage.ts` (dual-mode kv `plan_usage`, YYYY-MM buckets, atomic
  `requireAndBumpUsage`): sms/email (per recipient), divarImports, aiRequests (crm/ai + ai/run),
  contactReveals. Semantics: quota >0 = cap; −1/0/undefined = unlimited (plan-store contract).
  All caps come from the plan record — zero hardcoded numbers. Same enforce toggle governs both.
  **Plan/coin purchase (فاز ۵۳ — card-to-card everywhere, per user's request):** the default
  checkout site-wide is کارت‌به‌کارت (gateway seeded enabled in payment-store; admin fills card/شبا
  in پرداخت settings). Flow: buy → API returns `card2card:true` + card info → user submits receipt
  (کد رهگیری) → pending CommOrder (kind 'plan' with period, or new kind 'coins') → admin approves
  in سفارش‌های شارژ → auto-activation: plan via setPlan(+duration,+aiCredits) / coins via
  creditCoinPurchase (idempotent authority=orderId) + recordRealRevenue → reward pool.
  Zarinpal stays available only when explicitly chosen (`gateway:'zarinpal'`) and configured.
  UIs: /pricing checkout modal + empire coin-shop inline card panel.

## Integrations (exact, hard-won)
- **IPPanel SMS** (domestic, via shecan-https):
  - bulk: `POST api2.ippanel.com/api/v1/sms/send/webservice/single`, header `apikey`,
    body `{sender, recipient:[...], message, description:{summary,count_recipient}}`.
  - OTP pattern: `POST .../api/v1/sms/pattern/normal/send`, body `{code:<patternCode>, sender,
    recipient, variable:{<patternVar>: otp}}`. patternVar default `code` (configurable in admin).
    User must create the pattern in IPPanel and put its code + variable name in admin.
- **SMTP email**: `app/lib/smtp.ts` dependency-free (465 implicit TLS / 587 STARTTLS, AUTH LOGIN).
  Config in admin → «اتصال‌ها و سرویس‌ها». `/api/email/send`.
- **Neshan**: service key (search/reverse/distance-matrix) + map key (static map). nearby uses
  search→geocoding fallback (`app/lib/nearby.ts`). Needs Search/Distance-Matrix enabled on key.
- **GapGPT**: `app/lib/gapgpt.ts`, agent→model mapping in admin → «API و مدل‌های AI».
  Article/FAQ/cover tools need ContentAgent text + image models assigned.

## What's REAL & DONE
- Admin panel: scraper, listings(+create), products, moderation(auto AI), articles(WordPress-like
  CMS w/ rich editor+image/video upload+AI tools: write/FAQ/expand/TOC/cover/SEO/tags/improve,
  configurable length), categories CRUD, studio(plan/3D), users, roles, crm, geo, connections
  (neshan/ippanel/smtp/divar), API+models, plans, promos(promote/feature slots), discounts,
  ads(banners), reports/BigData, health/servers/queue/audit (real system stats). Menu regrouped.
- Public: home, search, directory, store, blog(+article slug pages), neighborhood, property
  (cached enrich), project/[id] & profile/[id] (real, data-driven), pricing(live plans), about/
  contact/terms, auth(onboarding). Nav/Footer fixed. Promotions show on public pages. BannerSlot.
- Communications: SMS (IPPanel) + Email (SMTP) campaigns real, with AI compose.
- **Builder dashboard `/builder`**: fully rebuilt to match the design — real backend
  (builder-store/API): project switcher, KPIs, inventory donut, sales bars, milestone timeline,
  units/sales/investors/reports all functional.
- **Materials dashboard `/materials`** («بازار مصالح» seller): fully rebuilt to match the
  Figma — real per-profile backend (materials-store/API): products CRUD, orders + status,
  inquiries + reply, low-stock «تأمین»/restock, KPIs, top-category bars, 6-month sales chart,
  recent orders. Standalone shell like /builder; cross-tool sidebar items link to /crm /marketing
  /workflow /website-builder.
- **Per-profile data isolation**: crm-store/leads-store/workflow-store/materials-store are all
  scoped by owner (session.phone) — every account (incl. super-admin) sees only its own data.
  CRM/leads/workflow API GETs now require a session.
- **PanelReturnBar** (`app/components/PanelReturnBar.tsx`): floating profile-aware «بازگشت به
  پنل» bar on /crm /marketing /workflow /website-builder so users never get stranded; links to
  the user's own dashboard from /api/auth/profile.
- **Nav login state**: Nav shows «پنل من/…» + «خروج» when logged in (was always «ورود»).
- **Cookie/CDN fix**: /api/* served `no-store, private` (next.config + verify-otp/login-email)
  so Arvan doesn't strip Set-Cookie → login persists across refresh. NEEDS deploy + CDN purge.
- **Website-builder**: template picker is now a responsive popup («قالب‌ها» button) with real
  mini-mockup previews, locked to the user's profile (10/profile, ~70 total).

## PENDING — updated (فاز ۶۹ audit; older notes here were stale)
All role dashboards are REAL now (owner/buyer/pros/agency/builder/materials + 7 prodesk roles —
Sales OS, per-owner isolation, plan gating). Payments are DONE: card-to-card default site-wide +
Zarinpal as second option when its gateway toggle (admin → پرداخت) AND keys are set — both for
plans (/pricing modal) and coins (empire shop); plan-gating enforcement is live (فاز ۵۱–۵۸).
Persiansaze weekly reveal cron + auto account creation are wired (persiansaze-cron.ts).
Actually pending (فاز ۱۰۹ audit): Business Club / CEO Pass (pricing decisions), full AI Live
Director (deliberately kept suggest-only), Node 22 on server (`sudo bash scripts/upgrade-node22.sh`),
population-gated items (real-time WebSocket auction, global chat). DONE since the last audit:
consortium (فاز ۱۰۲), VIP «حساب حرفه‌ای» (فاز ۱۰۶ — admin creates a plan with the `vip`
permission and sets its own price), Creator Store (فاز ۱۰۷ — admin approval queue in the
Empire rewards tab, creator share knob), Visual Bible Pass 2 v1 (فاز ۱۰۹ — living skyline),
mobile perf (فازهای ۹۵–۹۹، ۱۰۸ — SSR search + image optimizer + DeferredShell).

## How to continue across context limits
1. All work is pushed to git (`origin/main`). A fresh session starts from the repo + this file.
2. Resume by: pick the next pending panel, ask the user for its screenshot, then follow the
   per-panel process above. Keep committing after each batch so nothing is ever lost.

---

## پرشین سازه (اسکرپِ سازنده‌ها) — DONE & how it works
External builder database (my.persiansaze.com). **Login is Blazor SPA + OIDC + reCAPTCHA-less
mobile/password.** We drive it with **headless Google Chrome (Playwright)** — the only path that
works (VPS can't download playwright/snap chromium; installed via `dl.google.com` .deb →
`google-chrome-stable`, launched with `channel:'chrome'`). API calls run **inside the page
context** (`page.evaluate(fetch)`) so HTTP/2 + token + did headers are automatic (Node fetch =
HTTP/1.1 → WAF 401; only HTTP/2 works).
- **Account**: 09122862184 (password login; subscription scope = city 1 / phases 2005,2006,2016).
- **Endpoints**: list = `POST /rest/api/user/v1/Project/Filter?limit=20&offset=N` body
  `{term:"",searchType:"Project",type:"All",onlyWithConstructor:true,cityIds:[],...}` (limit>20 → 400).
  reveal/phone = `POST /rest/api/user/v1/Project/{hashId}/Constructor` body `{}` →
  `{constructor:{id,name,mobileNumbers[]}, updatedAccess.viewCounter.availableCount, hasVisitedProjectsFromSameConstructor, status}`.
- **Quota**: 500 reveals/week (per subscription tier). Re-revealing an already-revealed project is
  FREE. constructor.id only known AFTER reveal (no free builder lookup — can't bypass the cap).
  AccessDenied = project out of subscription scope (city/phase), NOT quota → skip, don't stop.
- **Scripts** (run on server, creds via `.persiansaze-config.json` or env PS_USER/PS_PASS/PS_CHANNEL=chrome):
  `ps-lib.mjs` (shared login+api), `persiansaze-scrape.mjs` (full project list → `.persiansaze-data.json`),
  `persiansaze-reveal.mjs` (phones, quota+scope aware → `.persiansaze-reveals.json` + builds
  `.persiansaze-profiles.json` keyed by constructor.id). Probes: persiansaze-probe/project/quota-test/discover-reveal.
- **Store**: `app/lib/persiansaze-store.ts` (config, data, reveals, profiles-by-constructorId, stats+quota).
- **API**: `app/api/admin/persiansaze/route.ts` (GET status/profiles/profile; POST save-config/scrape/reveal/rebuild-profiles — scrape & reveal spawn the scripts in background with lock files).
- **Admin UI**: `PersianSazeView` in `app/admin/page.tsx`, nav id `persiansaze` («سازنده‌ها (پرشین سازه)»).
  Current data: 19,879 projects, 16,150 unique receptors. Profiles built per real constructor.id with name+phone+projects.
- **DONE (was pending)**: weekly cron auto-reveal + auto account creation (`persiansaze-cron.ts` —
  maybeRunReveal/maybeCreateAccounts on instance-0 cron) + region/phase labels (regionLabel/phaseLabel).

---

## 🏛 Empire (بازی «امپراتوری») — READ docs/EMPIRE-TRACKER.md FIRST
The real-data game layer (Empire Bible, 7 docs so far) is tracked in
**`docs/EMPIRE-TRACKER.md`** — the single source of truth for: unbreakable rules
(no fake data; assistant is «ملک‌جت» never «نورا»; never say «بازی» in user UI;
every knob live in super-admin; no P2W; deterministic hash mechanics), the code
map (empire-store/api/page/EmpireAdminPanel/empire-brief/cron), completed phases
1–8 with commit hashes, per-volume implementation status for ALL uploaded Bible
docs, the pending queue (NPC Civilization → Quest/Season Studio → Crowdfunding →
Zarinpal → Prestige), and the per-new-doc workflow. **Any session that touches
the game MUST read that file first and update it in the same commit as the code.**
Tests: `node --import ./scripts/reos-loader.mjs scripts/reos-test.mjs` (unit) and
`DATABASE_URL=postgres://reos:reos@127.0.0.1:5432/reos_test node --import
./scripts/reos-loader.mjs scripts/reos-store-test.mjs` (PG; start postgres first).
Admin menus smoke test: `node scripts/admin-smoke.mjs` — uses a real browser when
playwright is available (all 46 views, JS errors); otherwise auto-falls back to HTTP
mode (admin page + every /_next/static chunk locally AND via https://melkjet.com to
detect stale Arvan CDN chunks + 26 admin APIs for 5xx). On the server run it as-is;
`PUBLIC=0` skips the CDN check, `HTTP_ONLY=1` forces HTTP mode.

## دیپلوی — قوانینِ اجباری (۲۱ آگوست ۲۰۲۶، بعد از دو بار افتادنِ سایت در یک روز)

هر دو قطعی از سازوکارِ دیپلوی آمد، نه از کدِ محصول. سه قانون:

۱. **هر بیلدِ دستی باید قفل بگیرد** — `auto-deploy.sh` هر ۲ دقیقه با کرون اجرا می‌شود و
   در مسیرِ شکستش `rm -rf .next` دارد. بیلدِ بی‌قفل وسطِ راه `.next/static/<buildId>/` را
   از دست می‌دهد و با `ENOENT: _buildManifest.js.tmp` یا `pages-manifest.json` می‌میرد —
   هر بار یک فایلِ متفاوت، که تشخیص را گمراه می‌کند.

       flock /tmp/melkjet-deploy.lock -c 'cd /var/www/melkjet/melkjet-nextjs && npm run build && pm2 restart all --update-env'

۲. **`pm2 restart` نه `pm2 reload`** — سرورِ زندهٔ Next فایل‌های `.next` را باز نگه می‌دارد.
   بعد از جایگزینیِ بیلد، `reload` خطای `Invariant: The client reference manifest for
   route "/admin" does not exist` می‌دهد و صفحه‌ها ۵۰۰ می‌شوند.

۳. **هرگز `mv .next .next.old` نزن.** اگر بیلد شکست بخورد سرویس بی‌`.next` می‌ماند و سایت
   ۵۰۲ می‌دهد. Next خودش خروجی را جایگزین می‌کند.

**تله‌ای که دو ساعت وقت گرفت:** شرطِ قدیمیِ `auto-deploy.sh` این بود که اگر
`HEAD != origin/main` باشد دیپلوی کند. کامیتِ محلیِ **پوش‌نشده** این شرط را برای همیشه
درست نگه می‌داشت → هر ۲ دقیقه یک بیلدِ کامل → حلقهٔ خودتخریبی. حالا شرط
`git merge-base --is-ancestor "$REMOTE" "$LOCAL"` است (فقط وقتی ریموت جلوتر است).
با این حال: **بعد از هر کامیتِ محلی، پوش کن.**

`.deploy-failed` یعنی کرون تا ابد هر ۲ دقیقه بیلد می‌زند. بعد از دیپلویِ دستیِ موفق پاکش کن.
خاموشیِ موقتِ کرون: `crontab -l > /tmp/cron.bak; crontab -l | grep -v melkjet | crontab -`

## REOS — بازنویسیِ پنلِ پیشنهادها و تحلیلِ محله (۲۱ آگوست)

**چرا موتورِ رتبه‌بندیِ رفتاری کنار گذاشته شد:** `buildRoleFeed` روی `demand`/`engagement`
می‌چید، ولی کلِ `listing-stats` سی رکورد با میانهٔ یک بازدید دارد. مرتب‌کردنِ ۸۶۰۰ آگهی
با کلیدی که برای همه صفر است ترتیب را دست‌نخورده برمی‌گرداند — برای همین «داغ» و
«تازه‌ثبت‌شده» یک لیستِ یکسان بودند. تا وقتی ترافیکِ واقعی نداریم، هر عددِ تقاضا جعلی است.

اکنون `app/api/reos/role-feed/route.ts` استخرِ کاندید را به محله‌های خودِ کاربر محدود
می‌کند (`app/lib/reos/my-area.ts` — مرجعِ واحد)، `ownerId === خودش` را حذف می‌کند، و
رتبه را از فاصلهٔ قیمتِ متری تا میانهٔ همان سلولِ (شهر|محله|معامله|نوع) می‌گیرد.

**مرجعِ واحدِ استخراجِ قیمت:** `itemCell()` در `area-stats.ts` و `rowOf()` در
`area-insight.ts`. این منطق را جای دیگری بازنویسی نکن — دو بار همین کار باگ ساخت:
چسباندنِ ودیعه به اجاره (متری ۶۳۶ میلیون) و قاطی‌شدنِ «شهرک غرب»ِ تهران و مشهد.

**`RENT_CONVERT = 0.03`** (هر ۱۰۰ میلیون ودیعه ≈ ۳ میلیون اجاره). بدونِ آن، از ۱۷۵۱ فایلِ
اجاره ۶۴۲ تا (بدونِ اجارهٔ ماهانه) کلاً از آمار می‌افتادند و ۸۸ تای «رهنِ کامل» با اجارهٔ
اسمیِ ۱۰ هزار تومان بَجِ «۱۰۰٪ زیرِ میانه» می‌گرفتند.

**`firstSeenAt`** از حالا در `scraper-store.ts` هنگامِ ساختِ آیتم مهر می‌خورد. `scrapedAt`
در هر به‌روزرسانی ریست می‌شود، پس مبنای «تازگی» و «رَوندِ قیمت» نیست و نباید باشد.
سبدِ «تازه‌ثبت‌شده» تا پرشدنِ این فیلد خالی می‌ماند — عمدی، نه باگ.

**دادهٔ موجود برای تحلیل (از ۸۶۱۹ آگهی):** متراژ ۹۲٪ · امکانات ۹۰٪ · سال ساخت ۸۲٪ ·
طبقه ۷۲٪ · اتاق خواب فقط ۹٪ (روی آن تکیه نکن). اثرِ سن و امکانات فقط وقتی نمایش داده
می‌شود که هر طرفِ مقایسه دستِ‌کم ۴ تا ۵ نمونه داشته باشد.

## روستر — برچسب‌زنِ توکنِ نام (۲۱ آگوست، بازنویسیِ کامل)

**مسئله‌ای که دو ماه با فهرست درمان می‌شد:** نامِ مشاور از متنِ آگهی استخراج می‌شد و
خروجی‌اش «کلید نخورده»، «مشخصات ملک:»، «تک واحدی» بود — مشاورانِ خیالی که فایل هم
می‌بلعیدند. هر بار یک واژه به فهرستِ سیاه اضافه می‌شد و آگهیِ بعدی واژهٔ تازه می‌آورد.

**ریشه‌ای که دیر پیدا شد:** `aiCanonical` هیچ‌وقت اجرا نمی‌شد چون هیچ مدلی به
`agentModels.content/chat` تخصیص نداشت. ترتیبِ انتخاب `ai || lex || heur` است، پس
همه‌چیز به heuristic می‌افتاد — و کلِ آن آشغال محصولِ تورِ ایمنی بود، نه موتورِ اصلی.

**سه مسیری که با داده رد شدند (قبل از نوشتنِ کد سنجیده شدند):**
- `owner` از دیوار = نامِ **آژانس** است، نه مشاور. برای تفکیکِ ۵۰ مشاورِ یک آژانس بی‌فایده.
- شمارهٔ تماس از دیوار گرفته نمی‌شود، و در متنِ آگهی هم **۰٪** است (دیوار حذفش می‌کند).
- سبکِ نوشتار خوشه می‌سازد ولی یک‌سومِ آگهی‌ها در قالبِ پیش‌فرضِ مشترک‌اند.

**راهِ درست — `app/lib/roster-ner.ts`:** به‌جای «آیا رشتهٔ X نام است؟»، سؤال شد «در این
متن کدام توکن نامِ مشاور است؟». بیست ویژگیِ بافتاری: فاصلهٔ توکنی تا کلیدواژه، موقعیت
در متن و خط، آمارِ پیکرهٔ توکنِ قبل و بعد، شکل و پسوند، و `isNoiseWord` **به‌عنوان یک
ویژگی** نه دروازه.

**برچسب‌ها از دادهٔ خودمان (نظارتِ از راه دور):** ۲۲۳ مشاورِ فارغ‌التحصیل = نامِ
تأییدشدهٔ مدیر + فهرستِ توکنِ آگهی‌هایش. در هر آگهی، توکنِ برابر با آن نام مثبت و بقیهٔ
ناحیهٔ امضا منفی → **۱۶۴۸ آگهی، ۲۴۴۶۷ توکنِ برچسب‌دار**، بدونِ یک ساعت کارِ دستی.

**نتیجه روی دادهٔ کنارگذاشته: ۸۷.۹٪** (تقسیم بر اساسِ *آگهی* نه توکن، وگرنه نشتِ داده).
یک آژانس از ۱۱۲ آگهیِ نام‌دار به ۱۸۵ از ۱۹۳ رسید، با نام‌های واقعی.

**وزن‌های آموخته — هیچ‌کدام دستی نیستند:** `noiseWord −۲.۰۱` · `agSpread −۱.۸۶` ·
`suffix +۱.۲۸` · `nextB −۱.۱۰` (خلافِ حدسِ من، و داده حق داشت) · `prevSig +۰.۹۱`.

**بازآموزیِ شبانه (کرون ۴:۱۵):** `roster-name-train.mjs --save` پیکره را بازمی‌سازد و
`roster-ner-train.mjs --save` مدل را دوباره آموزش می‌دهد. هر مشاوری که مدیر امروز
تأیید کند، فردا با ۶ تا ۳۸ آگهیِ برچسب‌دارش در مدل هست. سیستم خودش بهتر می‌شود.

**قاعده‌های قدیمی حذف نشدند، فقط از مسیرِ تصمیم بیرون رفتند** — الگوهای regex فقط وقتی
اجرا می‌شوند که مدل بارگذاری نشده باشد. پاک‌کردنشان بعد از چند روز پایداری.

**درسِ کلی:** فهرستِ سیاه در برابرِ متنِ آزاد همیشه می‌بازد، و فهرستِ سفید همان اشتباه
از سمتِ مقابل است. وقتی برای هر حالتِ تازه یک قاعده اضافه می‌کنی، یعنی یک **ویژگی**
کم داری. ویژگی را اضافه کن و بگذار مدل وزنش را یاد بگیرد.

### کامیت را با `&&` به بیلد زنجیر کن، نه با `;`

امروز دو بار کامیتِ خراب پوش شد چون `git commit` با `;` از بیلد جدا بود و مستقل از
شکستش اجرا شد. کامیتِ خراب روی `origin/main` یعنی `auto-deploy.sh` هر ۲ دقیقه سعی
می‌کند بسازدش و شکست می‌خورد — و مسیرِ شکستش `rm -rf .next` دارد.

    flock /tmp/melkjet-deploy.lock -c '… npm run build && pm2 restart …' \
      && git add -A && git commit -m "…" && git push origin main

و پیش از استفاده از هر کمکیِ محلی (`fa`، `post`، `load`) در `app/admin/page.tsx`
اسکوپش را گرپ کن: این فایل چند کامپوننتِ مستقل دارد و هرکدام کمکی‌های خودش را.

### ویرایشِ شمارهٔ حساب (۲۱ آگوست)

شمارهٔ حساب کلیدِ ورود است، پس ویرایش = مهاجرت: حسابِ مقصد ساخته می‌شود و همه‌چیز با
`mergeUserAccounts(new, old)` منتقل و حسابِ قدیمی تعلیق می‌شود (حذف نه — تاریخچه می‌ماند).
اگر شمارهٔ مقصد از قبل حساب دارد، عملیات **متوقف** می‌شود و به «ادغامِ دو حساب» ارجاع
می‌دهد؛ اینجا برخلافِ روستر هیچ `force`ی وجود ندارد، چون رونویسیِ دو حساب روی هم هیچ
حالتِ مشروعی ندارد.

در روستر اما `force` هست، چون ۱۲ مورد از ۱۷ تخصیصِ تکراری مشروع بودند (یک نفر با دو
صورتِ نام). معیارِ تفکیک `nameCompatible` است: توکن‌های نامِ کوتاه‌تر زیرمجموعهٔ بلندتر.

## روستر — مدلِ خلوت با درهم‌سازیِ ویژگی (۹۵.۲٪)

`app/lib/roster-ner.ts` دو مدل دارد. مرجع **خلوت** است؛ چگال تورِ ایمنی.

| مرحله | دقتِ آگهی‌محور روی دادهٔ طلایی |
|---|---|
| ۲۱ ویژگیِ دست‌ساز (چگال) | ۸۹.۴٪ |
| + مقایسهٔ بی‌فاصله در ارزیابی | ۹۰.۴٪ |
| **خلوت: هویتِ واژه + سه/چهارنگارهٔ نویسه‌ای** | **۹۵.۲٪** |

**چرا جهش کرد:** با ویژگیِ دست‌ساز، هر الگو را باید از قبل حدس می‌زدیم («پسوندِ
نام‌خانوادگی»، «صورتِ فعلی»). با درهم‌سازی، فضای ویژگی ۳۲۷۸۹ بُعد می‌شود و مدل از
۱۶۶ هزار توکنِ برچسب‌دار خودش یاد می‌گیرد که `ـزاده`/`ـیان` نام‌اند، `ـید` فعل است،
و `لوکیشن`/`هماهنگی` هرگز نام نیستند. هیچ‌کدام دستی نوشته نشده.

**منابعِ برچسب (همه خودکار، بدونِ کارِ انسانی):**
- `grad` — ۲۲۳ مشاورِ فارغ‌التحصیل (نامِ تأییدشدهٔ مدیر + توکنِ آگهی‌هایش)
- `title` — «خانم رگبار» · «کارشناس فروش: محمدی» → ۵۲۲۶ آگهی
- `anchor` — «… هستم» · «با تشکر …»
- `spread` — انتشارِ درون‌آژانسی: نامی که در همان آژانس دوبار لنگر شده، در بقیهٔ
  آگهی‌های همان آژانس هم برچسب می‌زند (ابهام = برچسب نمی‌خورد)

**قانونِ ارزیابی:** مجموعهٔ آزمون **فقط** از `grad` و `title` است. یک‌بار برچسب‌های
نویزی را هم در آزمون گذاشتم و عدد از ۸۹.۴٪ به ۷۷.۶٪ افتاد — افتی که تماماً توهمِ
اندازه‌گیری بود. مجموعهٔ آزمون هرگز نباید با دادهٔ مشکوک آلوده شود.

**بازآموزیِ شبانه (کرون ۴:۱۵، با `--sparse --save` و `--max-old-space-size=6144`):**
هر آژانسِ جدید چند صد آگهیِ برچسب‌دار اضافه می‌کند، پس دقت خودش بالا می‌رود.

**درسِ اصلی:** وقتی برای هر حالتِ تازه یک قاعده اضافه می‌کنی، یعنی یک **ویژگی** کم
داری. و وقتی ویژگی‌ها به سقف خوردند، یعنی باید بگذاری مدل خودِ داده را ببیند
(هویتِ واژه و زیرواژه) به‌جای خلاصه‌ای که تو از آن ساخته‌ای.

## چرا «هیچ تغییری نمی‌کرد» — سه لایه روی هم (۲۵ آگوست)

هفت روز روی نامِ مشاور کار شد و هر اصلاحی بی‌اثر به‌نظر می‌رسید. علت سه لایهٔ مستقل
بود که هرکدام دیگری را پنهان می‌کرد. **همیشه از پایین‌ترین لایه شروع کن: آیا اصلاً
دادهٔ تازه وارد می‌شود؟**

**لایهٔ ۱ — ورودیِ داده بسته بود.** `importClusterTokens` با `FRESH_MS=20h` هر شب همان
۲۵۰ آگهیِ تکراریِ هر آژانس را کامل دوباره دانلود می‌کرد. با ۴ آژانسِ موازی × ۳ کارگر
= ۱۲ درخواستِ همزمان ساعت‌ها → دیوار `http_429` می‌داد → **هیچ آگهیِ تازه‌ای وارد
نمی‌شد** (`live=0`). آزمونِ `curl` از همان سرور ۲۰۰ می‌داد، پس نه آی‌پی بسته بود نه
هدرها غلط؛ فقط حجم.
اصلاح: `FRESH_MS = ROSTER_FRESH_H (پیش‌فرض ۱۶۸ ساعت)` + `ROSTER_CONCURRENCY=1`.
قیمت/عنوان/تصویرِ آگهیِ موجود از پاسخِ `brand-landing` به‌روز می‌شود (بدونِ درخواستِ
اضافه)، پس کهنه هم نمی‌ماند. آگهیِ غایب از فهرستِ پروفایل = فروخته/اجاره‌رفته.

**لایهٔ ۲ — `extractSignature` بازگشتِ پنهان داشت.** وقتی مدل سکوت می‌کرد، الگوهای
regexِ قدیمی اجرا می‌شدند و برای آگهیِ بی‌امضا نام می‌ساختند («چت دیوار»، «درختان
میوه»). آزمون‌های من `bestName` را صدا می‌زدند (تمیز) ولی سینک `extractSignature` را
(کثیف). **همیشه همان تابعی را بسنج که مسیرِ تولید صدا می‌زند.**
اصلاح: اگر مدل بارگذاری شده، سکوتش هم تصمیم است — `return []`.

**لایهٔ ۳ — واژه‌نامه سکوت را پر می‌کرد.** `chosen = ai || cand[0] || res || lex` —
`res`/`lex` از واژه‌نامهٔ آموخته می‌آمدند و آشغالِ قدیمی را بازتولید می‌کردند.
اصلاح: `chosen = ai || cand[0]`.

**و یک کشِ فراموش‌شده:** `loadSparse` مدل را برای همیشه در حافظه نگه می‌داشت، پس هر
بازآموزی تا ری‌استارتِ پروسه بی‌اثر بود — یعنی بازآموزیِ شبانه هم هرگز اثر نمی‌کرد.
اصلاح: TTL پنج‌دقیقه‌ای.

**قاعده برای دفعهٔ بعد:** وقتی کاربر می‌گوید «هیچ فرقی نکرد» و آزمونِ تو می‌گوید درست
شده، یکی از این دو درست است و معمولاً او: یعنی داری چیزی را می‌سنجی که در مسیرِ واقعی
نیست، یا لایه‌ای پایین‌تر خروجی را بازنویسی می‌کند.

## زنجیرهٔ ۲۹ اوت ۲۰۲۶ — دیسکِ پر، و نابودیِ ۲۹۲۹ حساب

یک خرابیِ بی‌ربط شش نقصِ خفته را پشتِ سرِ هم فعال کرد: خزندهٔ ربات روی /locations
در یک روز ۵۳۳٬۷۲۰ فایلِ کشِ ISR ساخت (۷ گیگ) و دیسک صد درصد شد. بعد writeFileSync
فایلِ حساب‌ها را خالی کرد و نتوانست بنویسد؛ readJsonCached با catch{} آن را «خالی»
خواند؛ اولین ورودِ کاربر {} به‌علاوهٔ یک حساب را ذخیره کرد و ۲۹۲۹ حساب رفت. هم‌زمان
postgres نتوانست checkpoint بنویسد و در حلقهٔ PANIC کلِ سایت را خواباند، و backup.sh
با set -e روی شکستِ pg_dump مُرد پس پشتیبانِ فایل‌ها هم دو شب ساخته نشد.

بازگردانی از melkjet-files-20260827.tar.gz انجام شد. اگر چرخشِ پشتیبان کورکورانه
پاک کرده بود، داده واقعاً از دست رفته بود.

قواعدی که از این بیرون آمد:

1. هر نوشتنِ فایلِ داده باید اتمی باشد — tmp، سپس fsync، سپس rename. نوشتنِ مستقیم
   اول فایل را خالی می‌کند؛ اگر آنجا شکست بخورد، دادهٔ قبلی هم رفته.
2. خطای parse روی فایلِ ناتهی یعنی خرابی، نه خالی. الگوی catch { return fallback }
   روی دادهٔ ماندگار، یک خطای موقت را به نابودیِ دائمی تبدیل می‌کند.
3. نگهبانِ آب‌رفتن: اگر نوشتهٔ تازه کمتر از نصفِ فایلِ روی دیسک باشد، این
   به‌روزرسانی نیست، اشتباه است.
4. مسیرهای پشتیبان باید مستقل شکست بخورند. set -e یعنی خرابیِ یک بخش، پشتیبانِ
   بخشِ سالم را هم از بین می‌برد — دقیقاً وقتی بیشترین نیاز به آن هست.
5. چرخشِ پشتیبان باید کف داشته باشد؛ آخرین نسخه‌های سالم هرگز حذف نمی‌شوند.
6. کشِ ISR سقف ندارد. scripts/ops/melkjet-diskguard.sh ساعتی بالای ۸۰٪ هرس می‌کند.
   توجه: find -delete پوشه‌های خالی را جا می‌گذارد و بیلدِ بعدیِ Next را با خطای
   rmdir می‌شکند، پس -depth -type d -empty -delete هم لازم است.
7. پنجرهٔ ۲۴ ساعتهٔ پشتیبان برای دادهٔ هویتی زیاد است. scripts/ops/melkjet-snap.sh
   هر نیم‌ساعت عکس می‌گیرد و فایلِ خراب را هرگز عکس نمی‌گیرد.

کارِ باقی‌مانده: writeJsonCached اتمی شد، ولی هنوز ۸۸ فراخوانیِ مستقیمِ
writeFileSync در ۷۵ ماژولِ app/lib هست که همان آسیب‌پذیری را دارند و چند تایشان
با catch {} خطا را هم می‌بلعند. باید به کمکیِ اتمی منتقل شوند.
