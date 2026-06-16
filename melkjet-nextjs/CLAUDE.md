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

## Responsive System
CSS variables are used in inline styles. To make elements responsive:
1. Add `className="xyz"` to the JSX element
2. Add `@media(max-width:Npx){.xyz{property:value!important}}` to `app/globals.css`
The `!important` is REQUIRED to override inline styles.
