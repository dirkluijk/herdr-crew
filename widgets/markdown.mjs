// Markdown widget: one project file, or one section of it, rendered inside the panel. Same path rules as the links
// widget, checked again on every read. The file is read again when its mtime or size changes; no scripts, no HTML
// from the file (lib/markdown.mjs escapes everything).
import { statSync, readFileSync } from "node:fs";
import { projectFile } from "../lib/project-file.mjs";
import { renderMarkdown } from "../lib/markdown.mjs";
import { isObject, checkId, checkText, checkPath, checkKeys, collect } from "../lib/widget-options.mjs";

const MAX_BYTES = 512 * 1024;

const T = {
  nl: { missing: (f) => `${f} bestaat niet`, outside: (f) => `${f} ligt buiten het project of is geen bestand`, big: (f) => `${f} is groter dan 512 kB`, noSection: (s) => `Sectie ${s} niet gevonden.`, full: "Hele bestand" },
  en: { missing: (f) => `${f} does not exist`, outside: (f) => `${f} is outside the project or not a file`, big: (f) => `${f} is larger than 512 kB`, noSection: (s) => `Section ${s} not found.`, full: "Whole file" },
};

export function validate(options) {
  if (!isObject(options)) return ["options must be an object"];
  const errors = collect(checkKeys(options, ["id", "title", "file", "section", "maxHeight"]), checkPath("file", options.file), checkId(options.id), checkText("title", options.title, 80));
  if (options.section !== undefined && !(typeof options.section === "string" && options.section.trim() && options.section.length <= 120)) errors.push("section must be heading text of at most 120 characters");
  if (options.maxHeight !== undefined && !(Number.isInteger(options.maxHeight) && options.maxHeight >= 100 && options.maxHeight <= 2000)) errors.push("maxHeight must be a whole number of pixels from 100 to 2000");
  return errors;
}

// The lines under the first heading with this text, up to the next heading of the same or a higher level.
export function section(src, name) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const want = name.trim().toLowerCase();
  let fence = false;
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("```")) fence = !fence;
    const m = !fence && lines[i].match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    if (start < 0 && m[2].trim().toLowerCase() === want) { start = i; level = m[1].length; continue; }
    if (start >= 0 && m[1].length <= level) return lines.slice(start, i).join("\n");
  }
  return start < 0 ? null : lines.slice(start).join("\n");
}

export default function create({ project, options, language, fileUrl }) {
  const errors = validate(options);
  if (errors.length) throw new Error(errors.join("; "));
  const t = T[language] ?? T.en;
  const file = options.file;
  const id = options.id ?? "markdown";
  const files = {};
  // Listed once at creation, so the files origin can show the whole file; it checks the real path itself too.
  try { files.file = { path: projectFile(project, file), render: "markdown", source: file }; } catch {}
  let cache = { stamp: null, view: null };

  function read() {
    let path;
    try { path = projectFile(project, file); } catch (e) { return { error: e.code === "ENOENT" ? t.missing(file) : t.outside(file) }; }
    const st = statSync(path);
    if (st.size > MAX_BYTES) return { error: t.big(file) };
    const stamp = `${path}:${st.mtimeMs}:${st.size}`;
    if (cache.stamp === stamp) return cache.view;
    const src = readFileSync(path, "utf8");
    const part = options.section ? section(src, options.section) : src;
    const view = part === null ? { warning: t.noSection(options.section), html: "" } : { html: renderMarkdown(part).html };
    cache = { stamp, view };
    return view;
  }

  return {
    id,
    title: options.title ?? file.split("/").pop(),
    files,
    async view() {
      const r = read();
      return {
        state: r.error ? "off" : "on", list: true, text: "", info: [options.section ? `${file} · ${options.section}` : file],
        error: r.error ?? null, warning: r.warning ?? null, html: r.error ? null : r.html, maxHeight: options.maxHeight ?? 400,
        links: files.file && !r.error ? [{ title: t.full, url: fileUrl(id, "file"), enabled: true }] : [], buttons: [],
      };
    },
    actions: {},
  };
}
