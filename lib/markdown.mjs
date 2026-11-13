// Small Markdown to HTML renderer for read-only viewing: headings, paragraphs, lists, tables, code,
// quotes and inline marks. Everything is escaped first; links only keep http(s), mailto and #anchors.

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");

const emphasis = (s) => s
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
  .replace(/(^|[^\w])_([^_\s][^_]*)_(?=[^\w]|$)/g, "$1<em>$2</em>");

function inline(text) {
  const codes = [];
  const links = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  // Links are set aside before emphasis, so * and _ in a URL stay as they are.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = href.replace(/&amp;/g, "&");
    const html = /^(https?:|mailto:|#)/.test(url)
      ? `<a href="${esc(url)}" rel="noopener noreferrer" target="_blank">${emphasis(label)}</a>`
      : `${emphasis(label)} <span class="ref">(${href})</span>`;
    return `\u0001${links.push(html) - 1}\u0001`;
  });
  s = emphasis(s).replace(/\u0001(\d+)\u0001/g, (_, i) => links[i]);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function renderMarkdown(src) {
  let text = src.replace(/\r\n/g, "\n");
  let title = null;
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    title = fm[1].match(/^title:\s*['"]?(.*?)['"]?\s*$/m)?.[1] ?? null;
    text = text.slice(fm[0].length);
  }
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  const isBlockStart = (l) => /^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+\.)\s|\|.*\|\s*$|---+\s*$|\*\*\*+\s*$)/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) {
      const h = inline(m[2].replace(/\s+#+\s*$/, ""));
      out.push(`<h${m[1].length} id="${slug(h)}">${h}</h${m[1].length}>`);
      title ??= m[1].length === 1 ? m[2] : null;
      i++;
    } else if (l.startsWith("```")) {
      const body = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) body.push(lines[i]);
      i++;
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`);
    } else if (/^(---+|\*\*\*+)\s*$/.test(l)) {
      out.push("<hr>");
      i++;
    } else if (/^>\s?/.test(l)) {
      const body = [];
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) body.push(lines[i].replace(/^>\s?/, ""));
      out.push(`<blockquote>${renderMarkdown(body.join("\n")).html}</blockquote>`);
    } else if (/^\|.*\|\s*$/.test(l) && /^\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, "|")));
      const head = cells(l);
      i += 2;
      const rows = [];
      for (; i < lines.length && /^\|.*\|\s*$/.test(lines[i]); i++) rows.push(cells(lines[i]));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    } else if (/^\s*([-*+]|\d+\.)\s/.test(l)) {
      // One list block; deeper indentation becomes a nested list.
      const items = [];
      for (; i < lines.length; i++) {
        const li = lines[i];
        const im = li.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (im) items.push({ depth: Math.floor(im[1].length / 2), ordered: /\d/.test(im[2]), text: im[3] });
        else if (li.trim() && /^\s{2,}/.test(li) && items.length) items[items.length - 1].text += " " + li.trim();
        else break;
      }
      out.push(listHtml(items));
    } else {
      const body = [];
      for (; i < lines.length && lines[i].trim() && !(body.length && isBlockStart(lines[i])); i++) body.push(lines[i].trim());
      out.push(`<p>${inline(body.join(" "))}</p>`);
    }
  }
  return { title, html: out.join("\n") };
}

function listHtml(items) {
  let html = "";
  const stack = [];
  for (const it of items) {
    while (stack.length > it.depth + 1) html += `</li></${stack.pop()}>`;
    if (stack.length === it.depth + 1) html += "</li>";
    while (stack.length < it.depth + 1) {
      const tag = it.ordered ? "ol" : "ul";
      stack.push(tag);
      html += `<${tag}>`;
    }
    html += `<li>${inline(it.text)}`;
  }
  while (stack.length) html += `</li></${stack.pop()}>`;
  return html;
}

export function markdownPage({ title, html, source }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ?? source)}</title>
<style>
  body { margin: 0 auto; max-width: 860px; padding: 2rem 1.5rem 4rem; font: 16px/1.6 Inter, ui-sans-serif, system-ui, sans-serif; color: #1c2333; background: #fbfcfe; }
  h1, h2, h3 { line-height: 1.25; margin: 1.8em 0 0.6em; } h1 { margin-top: 0.4em; }
  code { font: 0.88em ui-monospace, monospace; background: #eef1f6; padding: 0.1em 0.35em; border-radius: 4px; }
  pre { background: #0f1729; color: #e6ebf5; padding: 1rem; border-radius: 10px; overflow: auto; } pre code { background: none; padding: 0; color: inherit; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.92em; } th, td { border: 1px solid #d5dbe6; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; } th { background: #eef1f6; }
  blockquote { margin: 1rem 0; padding: 0.2rem 1rem; border-left: 4px solid #5b9cf2; background: #f1f5fc; }
  a { color: #1d5be0; } .ref { color: #6b7385; font-size: 0.9em; } .src { color: #6b7385; font: 0.8rem ui-monospace, monospace; }
  @media (prefers-color-scheme: dark) { body { background: #0b0e17; color: #e6ebf5; } code, th { background: #1a2133; } th, td { border-color: #2a3247; } blockquote { background: #121a2c; } a { color: #7fb0f5; } }
</style></head><body><div class="src">${esc(source)} · read only</div>
${html}
</body></html>`;
}
