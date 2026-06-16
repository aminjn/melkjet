// Minimal dependency-free HTML parser + CSS-selector subset.
// Supports: tag, .class, #id, [attr], [attr=v], [attr*=v], descendant (space) and child (>) combinators.

export interface El {
  type: 'el' | 'text'
  tag: string
  attrs: Record<string, string>
  children: El[]
  parent: El | null
  text: string
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const RAW = new Set(['script', 'style', 'textarea', 'noscript'])

function newEl(tag: string, attrs: Record<string, string>, parent: El | null): El {
  return { type: 'el', tag, attrs, children: [], parent, text: '' }
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const key = m[1].toLowerCase()
    const val = m[3] ?? m[4] ?? m[5] ?? ''
    attrs[key] = val
  }
  return attrs
}

export function parseHTML(html: string): El {
  const root = newEl('#root', {}, null)
  let cur = root
  let i = 0
  const n = html.length

  while (i < n) {
    const lt = html.indexOf('<', i)
    if (lt === -1) { addText(cur, html.slice(i)); break }
    if (lt > i) addText(cur, html.slice(i, lt))

    // comment / doctype
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      i = end === -1 ? n : end + 3
      continue
    }
    if (html[lt + 1] === '!') {
      const end = html.indexOf('>', lt)
      i = end === -1 ? n : end + 1
      continue
    }

    // closing tag
    if (html[lt + 1] === '/') {
      const end = html.indexOf('>', lt)
      const tag = html.slice(lt + 2, end).trim().toLowerCase()
      // climb up to matching open tag
      let node: El | null = cur
      while (node && node.tag !== tag) node = node.parent
      if (node && node.parent) cur = node.parent
      i = end === -1 ? n : end + 1
      continue
    }

    // opening tag
    const end = html.indexOf('>', lt)
    if (end === -1) { addText(cur, html.slice(lt)); break }
    let raw = html.slice(lt + 1, end)
    const selfClose = raw.endsWith('/')
    if (selfClose) raw = raw.slice(0, -1)
    const sp = raw.search(/\s/)
    const tag = (sp === -1 ? raw : raw.slice(0, sp)).toLowerCase()
    const attrs = sp === -1 ? {} : parseAttrs(raw.slice(sp + 1))
    const el = newEl(tag, attrs, cur)
    cur.children.push(el)

    if (RAW.has(tag)) {
      // skip raw content
      const closeRe = new RegExp(`</${tag}\\s*>`, 'i')
      const rest = html.slice(end + 1)
      const cm = rest.match(closeRe)
      i = cm && cm.index != null ? end + 1 + cm.index + cm[0].length : n
      continue
    }
    if (!VOID.has(tag) && !selfClose) cur = el
    i = end + 1
  }
  return root
}

function addText(parent: El, t: string) {
  if (!t) return
  parent.children.push({ type: 'text', tag: '#text', attrs: {}, children: [], parent, text: t })
}

export function textOf(el: El): string {
  if (el.type === 'text') return el.text
  return el.children.map(textOf).join(' ').replace(/\s+/g, ' ').trim()
}

// ── selector ──────────────────────────────────────────────────────────────
interface Simple { tag?: string; id?: string; classes: string[]; attrs: { name: string; op?: string; val?: string }[] }
interface Step { simple: Simple; combinator: ' ' | '>' }

function parseSimple(s: string): Simple {
  const out: Simple = { classes: [], attrs: [] }
  const re = /([.#]?[\w-]+|\[[^\]]+\])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const tok = m[1]
    if (tok.startsWith('.')) out.classes.push(tok.slice(1))
    else if (tok.startsWith('#')) out.id = tok.slice(1)
    else if (tok.startsWith('[')) {
      const inner = tok.slice(1, -1)
      const am = inner.match(/^([\w-]+)\s*(\*=|\^=|\$=|=)?\s*("([^"]*)"|'([^']*)'|([^\]]*))?$/)
      if (am) out.attrs.push({ name: am[1].toLowerCase(), op: am[2], val: (am[4] ?? am[5] ?? am[6] ?? '').trim() })
    } else out.tag = tok.toLowerCase()
  }
  return out
}

function parseSelector(sel: string): Step[] {
  const steps: Step[] = []
  const parts = sel.trim().split(/\s+/)
  let comb: ' ' | '>' = ' '
  for (const p of parts) {
    if (p === '>') { comb = '>'; continue }
    steps.push({ simple: parseSimple(p), combinator: comb })
    comb = ' '
  }
  return steps
}

function matchSimple(el: El, s: Simple): boolean {
  if (el.type !== 'el') return false
  if (s.tag && el.tag !== s.tag) return false
  if (s.id && el.attrs.id !== s.id) return false
  if (s.classes.length) {
    const cls = (el.attrs.class || '').split(/\s+/)
    if (!s.classes.every(c => cls.includes(c))) return false
  }
  for (const a of s.attrs) {
    const v = el.attrs[a.name]
    if (v == null) return false
    if (a.op === '=' && v !== a.val) return false
    if (a.op === '*=' && !v.includes(a.val!)) return false
    if (a.op === '^=' && !v.startsWith(a.val!)) return false
    if (a.op === '$=' && !v.endsWith(a.val!)) return false
  }
  return true
}

function descendants(el: El): El[] {
  const out: El[] = []
  const walk = (n: El) => {
    for (const c of n.children) {
      if (c.type === 'el') { out.push(c); walk(c) }
    }
  }
  walk(el)
  return out
}

export function queryAll(root: El, selector: string): El[] {
  const steps = parseSelector(selector)
  if (!steps.length) return []
  let current: El[] = [root]
  for (const step of steps) {
    const next: El[] = []
    const seen = new Set<El>()
    for (const ctx of current) {
      const pool = step.combinator === '>' ? ctx.children.filter(c => c.type === 'el') : descendants(ctx)
      for (const cand of pool) {
        if (matchSimple(cand, step.simple) && !seen.has(cand)) { seen.add(cand); next.push(cand) }
      }
    }
    current = next
  }
  return current
}

export function queryOne(root: El, selector: string): El | null {
  return queryAll(root, selector)[0] || null
}
