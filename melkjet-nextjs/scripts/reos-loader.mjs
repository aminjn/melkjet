// Registers the REOS TS resolve hook so `node --import ./scripts/reos-loader.mjs foo.mjs`
// can import the app's TypeScript modules directly (Node type-stripping + extension resolution).
import { register } from 'node:module'
register('./reos-ts-hook.mjs', import.meta.url)
