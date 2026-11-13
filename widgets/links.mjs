// Links widget: web links and local project files. Local files are served read only by the files origin
// (see server.mjs), and only the exact files listed here; nothing else in the project is reachable.
import { extname } from "node:path";
import { projectFile } from "../lib/project-file.mjs";

const RENDER = { ".html": "html", ".htm": "html", ".md": "markdown", ".markdown": "markdown" };

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
      problems.push(`${label}: ${l.file} ${e.code === "ENOENT" ? (language === "nl" ? "bestaat niet" : "does not exist") : e.message}`);
      return { title: label, note, url: null, file: String(l.file) };
    }
  });

  return {
    id,
    title: options.title ?? (language === "nl" ? "Links" : "Links"),
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
