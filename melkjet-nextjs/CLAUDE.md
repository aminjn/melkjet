@AGENTS.md

# MelkJet Project Notes

## Deploy Command (ALWAYS use this exact path)
```bash
cd /var/www/melkjet/melkjet-nextjs && git pull && npm run build && pm2 restart melkjet
```

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
- **Shecan DNS is required** in `/etc/resolv.conf` (made immutable):
  `nameserver 178.22.122.100` + `185.51.200.2`, then `chattr +i /etc/resolv.conf`.
  Without it, gapgpt.app / divar.ir don't resolve → "fetch failed".
- Test AI from server: `node -e 'fetch("https://api.gapgpt.app/v1/chat/completions",{...})'`
  should return STATUS 200.

## Responsive System
CSS variables are used in inline styles. To make elements responsive:
1. Add `className="xyz"` to the JSX element
2. Add `@media(max-width:Npx){.xyz{property:value!important}}` to `app/globals.css`
The `!important` is REQUIRED to override inline styles.
