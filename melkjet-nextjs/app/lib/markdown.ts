// رندر سادهٔ Markdown به HTML بدون وابستگی (برای بدنهٔ مقالات CMS).
export function mdToHtml(md: string): string {
  if (!md) return ''
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')

  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let para: string[] = []
  let list: string[] | null = null
  let listType: 'ul' | 'ol' = 'ul'

  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = [] } }
  const flushList = () => { if (list) { out.push(`<${listType}>${list.map(li => `<li>${inline(li)}</li>`).join('')}</${listType}>`); list = null } }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    const uli = line.match(/^[-*]\s+(.*)$/)
    const oli = line.match(/^\d+[.)]\s+(.*)$/)
    if (h) { flushPara(); flushList(); const lvl = h[1].length + 1; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue }
    if (uli) { flushPara(); if (!list || listType !== 'ul') { flushList(); list = []; listType = 'ul' } list.push(uli[1]); continue }
    if (oli) { flushPara(); if (!list || listType !== 'ol') { flushList(); list = []; listType = 'ol' } list.push(oli[1]); continue }
    if (!line.trim()) { flushPara(); flushList(); continue }
    if (/^>\s?/.test(line)) { flushPara(); flushList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue }
    para.push(line)
  }
  flushPara(); flushList()
  return out.join('\n')
}
