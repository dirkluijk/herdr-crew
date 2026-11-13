import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, markdownPage } from "../lib/markdown.mjs";

const html = (src) => renderMarkdown(src).html;

test("frontmatter sets the title and is not rendered", () => {
  const r = renderMarkdown("---\ntitle: 'Release plan'\nauthor: x\n---\n# Heading\n\nBody");
  assert.equal(r.title, "Release plan");
  assert.doesNotMatch(r.html, /author/);
  assert.match(r.html, /<h1 id="heading">Heading<\/h1>/);
});

test("without frontmatter the first h1 is the title", () => {
  assert.equal(renderMarkdown("## Sub\n\n# Main\n\n# Second").title, "Main");
  assert.equal(renderMarkdown("plain text").title, null);
});

test("CRLF line endings are handled", () => {
  const r = renderMarkdown("---\r\ntitle: T\r\n---\r\n- a\r\n- b\r\n");
  assert.equal(r.title, "T");
  assert.equal(r.html, "<ul><li>a</li><li>b</li></ul>");
});

test("tables with header, rows, inline marks and escaped pipes", () => {
  const out = html("| Name | Note |\n|---|:--:|\n| **a** | x \\| y |\n| `b` | <i> |");
  assert.equal(
    out,
    "<table><thead><tr><th>Name</th><th>Note</th></tr></thead><tbody>" +
      "<tr><td><strong>a</strong></td><td>x | y</td></tr>" +
      "<tr><td><code>b</code></td><td>&lt;i&gt;</td></tr></tbody></table>",
  );
});

test("a pipe line without a separator row is a paragraph, not a table", () => {
  assert.equal(html("| a | b |"), "<p>| a | b |</p>");
});

test("unordered, ordered and nested lists", () => {
  assert.equal(html("- one\n- two\n  - nested\n- three"), "<ul><li>one</li><li>two<ul><li>nested</li></ul></li><li>three</li></ul>");
  assert.equal(html("1. first\n2. second"), "<ol><li>first</li><li>second</li></ol>");
  assert.equal(html("- item\n  continued"), "<ul><li>item continued</li></ul>");
});

test("headings, code blocks, quotes and rules", () => {
  assert.equal(html("### Title ###"), '<h3 id="title">Title</h3>');
  assert.equal(html("```js\nif (a < b) {}\n```"), "<pre><code>if (a &lt; b) {}</code></pre>");
  assert.equal(html("> quoted\n> more"), "<blockquote><p>quoted more</p></blockquote>");
  assert.equal(html("---"), "<hr>");
  assert.equal(html("text\n# Heading"), '<p>text</p>\n<h1 id="heading">Heading</h1>');
});

test("HTML in the source is escaped everywhere", () => {
  const out = html('<script>alert("x")</script>\n\n# <img src=x onerror=1>\n\n- <b>\n\n`<code>`');
  assert.doesNotMatch(out, /<script|<img|<b>/);
  assert.match(out, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(out, /<code>&lt;code&gt;<\/code>/);
});

test("links keep http, https, mailto and anchors", () => {
  assert.equal(html("[a](https://example.com/?x=1&y=2)"), '<p><a href="https://example.com/?x=1&amp;y=2" rel="noopener noreferrer" target="_blank">a</a></p>');
  assert.match(html("[a](http://example.com)"), /href="http:\/\/example.com"/);
  assert.match(html("[mail](mailto:a@b.nl)"), /href="mailto:a@b.nl"/);
  assert.match(html("[top](#top)"), /href="#top"/);
});

test("links with other schemes become plain text", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "vbscript:x", "JavaScript:alert(1)", "relative/path.md"]) {
    const out = html(`[click](${href})`);
    assert.doesNotMatch(out, /<a /, href);
    assert.match(out, /<span class="ref">/, href);
  }
});

test("a quote in a link cannot break out of the href attribute", () => {
  const out = html('[x](https://a.example/"onmouseover=alert(1))');
  assert.doesNotMatch(out, /href="[^"]*"onmouseover/);
});

test("inline emphasis and code", () => {
  assert.equal(html("**bold** and *em* and _em2_ and `a*b*c`"), "<p><strong>bold</strong> and <em>em</em> and <em>em2</em> and <code>a*b*c</code></p>");
  assert.equal(html("snake_case_name"), "<p>snake_case_name</p>");
});

test("emphasis markers inside a link URL leave the href intact", { todo: "bug: _x_ or *x* in a URL becomes <em> inside the href (see CREW-8 notes)" }, () => {
  assert.match(html("[a](https://example.com/_x_/y)"), /href="https:\/\/example.com\/_x_\/y"/);
});

test("markdownPage escapes title and source", () => {
  const page = markdownPage({ title: "<t>", html: "<p>x</p>", source: "docs/<s>.md" });
  assert.match(page, /<title>&lt;t&gt;<\/title>/);
  assert.match(page, /docs\/&lt;s&gt;\.md · read only/);
  assert.match(page, /<p>x<\/p>/);
});
