// Panels the orchestrator adds on request: only built-in declarative widget types, validated before they are
// written to .herdr-crew.json. The Add panel button sends the user's request as plain text to the lead persona.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { projectFile } from "./project-file.mjs";
import { isObject } from "./widget-options.mjs";
import { tr } from "./i18n.mjs";
import { validate as validateLinks } from "../widgets/links.mjs";
import { validate as validateBacklog } from "../widgets/backlog.mjs";
import { validate as validateMarkdown } from "../widgets/markdown.mjs";
import { validate as validateDevServer } from "../widgets/dev-server.mjs";

export const MAX_PROMPT = 500;

export const PANEL_TYPES = {
  backlog: {
    validate: validateBacklog, defaultId: () => "backlog",
    help: "backlog: read-only overview of Backlog.md tasks; rows open the task. Options: id, title, filters { status, labels, assignee, priority } (each text or a list), groupBy (status, priority, assignee, label or none), limit (1 to 200, default 20).",
  },
  markdown: {
    validate: validateMarkdown, defaultId: () => "markdown",
    help: "markdown: one project file, or one section of it, rendered in the panel. Options: id, title, file (required, relative to the project), section (heading text), maxHeight (100 to 2000 px).",
  },
  links: {
    validate: validateLinks, defaultId: () => "links",
    help: "links: a list of links. Options: id, title, note, links: [{ label, url (http or https) or file (relative to the project), note }].",
  },
  "dev-server": {
    validate: validateDevServer, defaultId: (o) => `dev-${o.port}`,
    help: "dev-server: start and stop a local dev server with confirmed buttons. Options: id, title, cwd, command (list of words, no shell), port, pages: [{ title, path }]. Only when the user asks for a dev server.",
  },
};

export function entryId(entry) {
  const o = isObject(entry?.options) ? entry.options : {};
  if (typeof o.id === "string") return o.id;
  return Object.hasOwn(PANEL_TYPES, entry?.module ?? "") ? PANEL_TYPES[entry.module].defaultId(o) : null;
}

// Problems with a new entry, given the entries that are already there. With a project, listed files must exist in it.
export function validateEntry(entry, existing = [], project = null) {
  if (!isObject(entry)) return ["the entry must be a JSON object like {\"module\":\"backlog\",\"options\":{...}}"];
  const extra = Object.keys(entry).filter((k) => k !== "module" && k !== "options");
  if (extra.length) return [`unknown keys ${extra.join(", ")}; an entry has only module and options`];
  const type = Object.hasOwn(PANEL_TYPES, entry.module) ? PANEL_TYPES[entry.module] : null;
  if (!type) return [`module must be one of ${Object.keys(PANEL_TYPES).join(", ")}; no other modules or code`];
  const options = entry.options ?? {};
  const errors = type.validate(options);
  if (errors.length) return errors;
  const id = entryId({ module: entry.module, options });
  if (existing.some((e) => entryId(e) === id)) errors.push(`a panel with id ${id} already exists; pick another id or remove that one first`);
  if (project) {
    const files = entry.module === "markdown" ? [options.file] : entry.module === "links" ? options.links.filter((l) => l.file).map((l) => l.file) : [];
    for (const f of files) {
      try { projectFile(project, f); } catch (e) { errors.push(`${f}: ${e.code === "ENOENT" ? "does not exist" : e.message}`); }
    }
  }
  return errors;
}

async function readRaw(file) {
  return existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
}
const write = (file, raw) => writeFile(file, JSON.stringify(raw, null, 2) + "\n");

// Appends the entry, keeping every other key as it is. Returns { id } or { errors }.
export async function addWidget(file, project, entry) {
  const raw = await readRaw(file);
  const widgets = Array.isArray(raw.widgets) ? raw.widgets : [];
  const errors = validateEntry(entry, widgets, project);
  if (errors.length) return { errors };
  raw.widgets = [...widgets, { module: entry.module, options: entry.options ?? {} }];
  await write(file, raw);
  return { id: entryId(entry) };
}

// Removes the first entry with this id. Returns the removed entry, or null.
export async function removeWidget(file, id) {
  const raw = await readRaw(file);
  const widgets = Array.isArray(raw.widgets) ? raw.widgets : [];
  const at = widgets.findIndex((e) => entryId(e) === id);
  if (at < 0) return null;
  const [removed] = widgets.splice(at, 1);
  raw.widgets = widgets;
  await write(file, raw);
  return removed;
}

// Plain text only: control characters go, the prompt is quoted and never run.
export function cleanPrompt(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\r\n?/g, "\n").replace(/[\x00-\x09\x0b-\x1f\x7f]/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function panelRequestText({ language, project, cli, prompt }) {
  const t = tr(language);
  const example = JSON.stringify({ module: "backlog", options: { id: "open", title: t("panels.exampleTitle"), filters: { status: ["To Do", "In Progress"] } } });
  return [
    t("panels.head"),
    ...cleanPrompt(prompt).split("\n").map((l) => `> ${l}`),
    t("panels.make"),
    ...Object.values(PANEL_TYPES).map((x) => `- ${x.help}`),
    t("panels.add"),
    `${cli} widget add --project ${project} --json '${example}'`,
    t("panels.end"),
  ].join("\n");
}
