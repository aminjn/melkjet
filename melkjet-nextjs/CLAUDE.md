@AGENTS.md

# MelkJet Project Notes

## Deploy Command (ALWAYS use this exact path)
```bash
cd /var/www/melkjet/melkjet-nextjs && git pull && npm run build && pm2 restart melkjet
```
After deploy, **purge the Arvan CDN cache** (panel → CDN → clear cache) — otherwise
the CDN serves stale HTML pointing at old CSS/JS chunks and the whole site looks
unstyled ("گرافیک ریخت"). next.config sets `no-cache` on HTML + `immutable` on
`/_next/static` to mitigate this, but a purge after deploy is the sure fix.
Quick check after deploy: Ctrl+Shift+R — if styling returns, it was the cache.

## Server
- VPS: 185.206.95.40 (Arvan Cloud)
- Path: /var/www/melkjet/melkjet-nextjs
- Process: pm2 process named "melkjet"
- Domain: melkjet.com (Arvan CDN handles HTTPS)

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
- **Divar (api.divar.ir)** → via HTTP proxy (`http://127.0.0.1:10809`), saved in
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

## Conventions
- **Persistence = file-based JSON stores** in `process.cwd()`, all gitignored (`.*-data.json`).
  Mirror the style of `app/lib/scraper-store.ts` / `crm-store.ts` for any new store.
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
