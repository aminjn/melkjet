@AGENTS.md

# MelkJet Project Notes

## Deploy Command (ALWAYS use this exact path)
```bash
cd /var/www/melkjet/melkjet-nextjs && git pull && npm run build && pm2 reload ecosystem.config.js
```
Better: `sudo scripts/deploy.sh` — same steps but **health-checks localhost:3001-3003 after
reload**, so a broken deploy is caught immediately (not from the browser).

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
- VPS: 185.206.95.40 (Arvan Cloud) — **4 vCPU / 8 GB RAM / 25 GB SSD**
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

## Responsive System
CSS variables are used in inline styles. To make elements responsive:
1. Add `className="xyz"` to the JSX element
2. Add `@media(max-width:Npx){.xyz{property:value!important}}` to `app/globals.css`
The `!important` is REQUIRED to override inline styles.

---

# PROJECT STATE & CONTINUATION GUIDE
Read this to resume work in a fresh session. **Everything is committed to git** — the
repo + this file are the source of truth, no chat history needed.

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
- **NOT YET DONE: runtime plan-gating** — locking the paid % of each dashboard based on the
  user's plan/role permissions. Data model is ready; enforcement per-panel is pending.

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

## PENDING (next sessions) — the per-panel design-match work
The OTHER role dashboards are still mostly mock and need the SAME treatment the builder/materials
got (real backend + rebuild to match the user's Figma screenshots): **owner** (seller/investor),
**buyer**, **pros** (advisor), **agency**. (DONE: builder, materials.)
Process per panel: user sends a screenshot → build a file-store + `/api/<role>` → rebuild the page
to match the design with all sections functional → wire plan-gating for paid sections → build/commit.
Also pending: **payment gateway** (Zarinpal — config-gated like SMS, then unlock plans/roles on
purchase) and **runtime plan-gating enforcement** inside dashboards.

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
- **PENDING**: weekly cron auto-reveal (cron-runner) + create MelkJet سازنده accounts from revealed
  builders (name+phone) + region/phase name lookups (regionId-100=Tehran district for city 1).
