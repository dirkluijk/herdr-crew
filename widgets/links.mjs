// Links widget: web links and local project files. Local files are served read only by the files origin
// (see server.mjs), and only the exact files listed here; nothing else in the project is reachable.
import { extname } from "node:path";
import { projectFile } from "../lib/project-file.mjs";
import { isObject, checkId, checkText, checkPath, checkKeys, collect } from "../lib/widget-options.mjs";
import { tr } from "../lib/i18n.mjs";

const RENDER = { ".html": "html", ".htm": "html", ".md": "markdown", ".markdown": "markdown" };

// Stricter than create, which only reports bad links in the panel: used by the CLI before it writes an entry.
export function validate(options) {
  if (!isObject(options)) return ["options must be an object"];
  const errors = collect(checkKeys(options, ["id", "title", "note", "links"]), checkId(options.id), checkText("title", options.title, 80), checkText("note", options.note, 300));
  if (!Array.isArray(options.links) || !options.links.length || options.links.length > 30) return [...errors, "links must be a list of 1 to 30 links"];
  options.links.forEach((l, i) => {
    const at = `links[${i}]`;
    if (!isObject(l)) return errors.push(`${at} must be an object`);
    errors.push(...collect(checkKeys(l, ["label", "url", "file", "note", "render"]).map((e) => `${at}: ${e}`), checkText(`${at}.label`, l.label, 80, true), checkText(`${at}.note`, l.note, 300)));
    if ((l.url === undefined) === (l.file === undefined)) errors.push(`${at} needs exactly one of url or file`);
    if (l.url !== undefined && !(typeof l.url === "string" && /^https?:\/\/\S+$/i.test(l.url))) errors.push(`${at}.url must be an http or https URL`);
    if (l.file !== undefined) errors.push(...collect(checkPath(`${at}.file`, l.file)));
    if (l.render !== undefined && !["html", "markdown", "text"].includes(l.render)) errors.push(`${at}.render must be html, markdown or text`);
  });
  return errors;
}

export default function create({ project, options, language, fileUrl }) {
  const id = options.id ?? "links";
  const files = {};
  const problems = [];
  const links = (options.links ?? []).map((l, i) => {
    const label = String(l.label ?? l.url ?? l.file ?? `link ${i + 1}`);
    const note = l.note ? String(l.note) : null;
    if (l.url) {
      const ok = /^https?:\/\//i.test(String(l.url));
      if (!ok) problems.push(`${label}: only http and https links`);
      return { title: label, note, url: ok ? String(l.url) : null };
    }
    try {
      const path = projectFile(project, l.file);
      const key = `${i}-${String(l.file).split("/").pop().toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "")}`.slice(0, 80);
      files[key] = { path, render: ["html", "markdown", "text"].includes(l.render) ? l.render : RENDER[extname(path).toLowerCase()] ?? "text", source: String(l.file) };
      return { title: label, note, url: fileUrl(id, key), file: String(l.file) };
    } catch (e) {
      problems.push(`${label}: ${l.file} ${e.code === "ENOENT" ? tr(language)("widget.links.missing") : e.message}`);
      return { title: label, note, url: null, file: String(l.file) };
    }
  });

  return {
    id,
    title: options.title ?? tr(language)("widget.links.title"),
    files,
    async view() {
      return {
        state: "on",
        text: options.note ?? "",
        info: [],
        warning: problems.length ? problems.join("; ") : null,
        links: links.map((l) => ({ title: l.title, url: l.url ?? "#", enabled: !!l.url, note: l.note, file: l.file ?? null })),
        buttons: [],
        list: true,
      };
    },
    actions: {},
  };
}
