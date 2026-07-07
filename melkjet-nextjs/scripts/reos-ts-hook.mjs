// Zero-dependency ESM resolve hook: lets Node run the REOS .ts modules (which use
// extensionless relative imports) via built-in type-stripping. Appends .ts/.tsx/index.ts.
// Used only by the REOS test scripts — NOT part of the app runtime.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx']

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]sx?$/i.test(specifier) && !/\.json$/i.test(specifier)) {
    for (const ext of CANDIDATES) {
      try {
        const url = new URL(specifier + ext, context.parentURL)
        if (existsSync(fileURLToPath(url))) return next(specifier + ext, context)
      } catch { /* try next */ }
    }
  }
  return next(specifier, context)
}
