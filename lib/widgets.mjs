// Widget instances for the `widgets` entries in .herdr-crew.json. Entries reload without a restart: an unchanged
// entry keeps its instance, a new or changed one gets a fresh instance and a removed one is disposed. Disposing
// never stops a process that a widget started; a dev server keeps running until its own Stop action is used.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tr } from "./i18n.mjs";

export const BUILT_IN = /^[a-z0-9-]+$/;

export const removeConfirm = (language, w) => tr(language)("widget.remove", { title: w.title, id: w.id });

// A broken entry still gets a panel, so it can be seen and removed from the dashboard.
function brokenWidget(entry, index, message) {
  const options = entry && typeof entry.options === "object" && entry.options ? entry.options : {};
  return {
    id: typeof options.id === "string" && /^[a-z0-9_-]+$/.test(options.id) ? options.id : `widget-${index + 1}`,
    title: String(options.title ?? entry?.module ?? "widget"),
    broken: true,
    async view() { return { state: "off", text: "", info: [], error: message, links: [], buttons: [] }; },
    actions: {},
  };
}

function dispose(w) {
  try { w.dispose?.(); } catch {}
}

// context holds shared read-only data for widgets, such as `backlog: { enabled, tasks() }`.
export function createWidgetSet({ app, project, stateDir, fileUrl, say = () => {}, context = {} }) {
  let items = [];
  let chain = Promise.resolve();

  async function load(entry, index, language) {
    try {
      if (!entry || typeof entry.module !== "string" || !entry.module) throw new Error("module is missing");
      const spec = BUILT_IN.test(entry.module) ? join(app, "widgets", `${entry.module}.mjs`) : resolve(project, entry.module);
      const mod = await import(pathToFileURL(spec).href);
      const w = mod.default({ ...context, project, stateDir, options: entry.options ?? {}, language, fileUrl });
      if (!w || typeof w.id !== "string" || typeof w.view !== "function") throw new Error("the module returned no widget");
      w.actions ??= {};
      return w;
    } catch (e) {
      say(`widget ${entry?.module ?? index + 1} not loaded: ${e.message}`);
      return brokenWidget(entry, index, e.message);
    }
  }

  async function apply(entries, language) {
    const old = new Map(items.map((i) => [i.key, i]));
    const next = [];
    const ids = new Set();
    let added = 0;
    for (const [index, entry] of (Array.isArray(entries) ? entries : []).entries()) {
      const json = JSON.stringify(entry);
      const key = `${language}\n${json}`;
      let item = old.get(key);
      if (item) old.delete(key);
      else { item = { key, json, widget: await load(entry, index, language) }; added++; }
      if (ids.has(item.widget.id)) {
        say(`widget ${item.widget.id} skipped: duplicate id`);
        dispose(item.widget);
        continue;
      }
      ids.add(item.widget.id);
      next.push(item);
    }
    for (const item of old.values()) dispose(item.widget);
    items = next;
    return { added, removed: old.size, total: next.length };
  }

  return {
    // Calls run one after another, so a reload and a remove from the page never interleave.
    sync(entries, language) {
      const run = chain.then(() => apply(entries, language));
      chain = run.catch(() => {});
      return run;
    },
    list: () => items.map((i) => i.widget),
    find: (id) => items.find((i) => i.widget.id === id)?.widget ?? null,
    entryJson: (id) => items.find((i) => i.widget.id === id)?.json ?? null,
    file(id, key) {
      const w = items.find((i) => i.widget.id === id)?.widget;
      return w?.files && Object.hasOwn(w.files, key) ? w.files[key] : null;
    },
    fileCount: () => items.reduce((n, i) => n + Object.keys(i.widget.files ?? {}).length, 0),
    disposeAll() { for (const i of items) dispose(i.widget); items = []; },
  };
}

// Removes the entry with exactly this JSON from the config file. Returns the remaining entries, or null when the
// file no longer has it (changed by hand in the meantime).
export async function removeEntry(file, json) {
  if (!existsSync(file)) return null;
  const raw = JSON.parse(await readFile(file, "utf8"));
  const list = Array.isArray(raw.widgets) ? raw.widgets : [];
  const at = list.findIndex((e) => JSON.stringify(e) === json);
  if (at < 0) return null;
  raw.widgets = list.filter((_, i) => i !== at);
  await writeFile(file, JSON.stringify(raw, null, 2) + "\n");
  return raw.widgets;
}
