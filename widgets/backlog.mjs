// Backlog widget: a read-only mini overview of Backlog.md tasks, from the task list the dashboard already follows
// (`backlog task list --json --watch`). Rows open the task modal; the widget never changes a task.
import { isObject, checkId, checkText, checkKeys, collect } from "../lib/widget-options.mjs";

const GROUPS = ["status", "priority", "assignee", "label", "none"];
const FILTERS = ["status", "labels", "assignee", "priority"];
const STATUS_ORDER = ["to do", "in progress", "done"];
const PRIORITY_ORDER = ["high", "medium", "low"];

const T = {
  nl: { title: "Backlog", none: "Geen taken voor dit filter.", more: (n) => `en nog ${n}`, off: "Backlog.md staat uit voor dit project (backlog in .herdr-crew.json).", noPriority: "geen prioriteit", nobody: "niemand", noLabel: "geen label", all: "Alle taken" },
  en: { title: "Backlog", none: "No tasks for this filter.", more: (n) => `and ${n} more`, off: "Backlog.md is off for this project (backlog in .herdr-crew.json).", noPriority: "no priority", nobody: "nobody", noLabel: "no label", all: "All tasks" },
};

const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const lower = (s) => String(s ?? "").trim().toLowerCase();
const at = (order, v) => { const i = order.indexOf(lower(v)); return i < 0 ? order.length : i; };

// Returns a list of problems; empty means valid. Also used by the CLI before it writes an entry.
export function validate(options) {
  if (!isObject(options)) return ["options must be an object"];
  const errors = collect(checkKeys(options, ["id", "title", "filters", "groupBy", "limit"]), checkId(options.id), checkText("title", options.title, 80));
  if (options.filters !== undefined) {
    if (!options.filters || typeof options.filters !== "object" || Array.isArray(options.filters)) errors.push("filters must be an object");
    else for (const [k, v] of Object.entries(options.filters)) {
      if (!FILTERS.includes(k)) errors.push(`filters.${k} is unknown; use ${FILTERS.join(", ")}`);
      else if (!list(v).length || !list(v).every((x) => typeof x === "string" && x.trim())) errors.push(`filters.${k} must be text or a list of text`);
    }
  }
  if (options.groupBy !== undefined && !GROUPS.includes(options.groupBy)) errors.push(`groupBy must be one of ${GROUPS.join(", ")}`);
  if (options.limit !== undefined && !(Number.isInteger(options.limit) && options.limit >= 1 && options.limit <= 200)) errors.push("limit must be a whole number from 1 to 200");
  return errors;
}

export function matches(task, filters = {}) {
  const want = (k) => list(filters[k]).map(lower);
  const status = want("status");
  if (status.length && !status.includes(lower(task.status))) return false;
  const priority = want("priority");
  if (priority.length && !priority.includes(lower(task.priority))) return false;
  const labels = want("labels");
  if (labels.length && !(task.labels ?? []).some((l) => labels.includes(lower(l)))) return false;
  const assignee = want("assignee").map((a) => a.replace(/^@/, ""));
  if (assignee.length && !(task.assignees ?? []).some((a) => assignee.includes(lower(a).replace(/^@/, "")))) return false;
  return true;
}

const idNumber = (id) => Number(String(id).match(/(\d+)$/)?.[1] ?? Infinity);
const byTask = (a, b) => at(PRIORITY_ORDER, a.priority) - at(PRIORITY_ORDER, b.priority)
  || (a.ordinal ?? Infinity) - (b.ordinal ?? Infinity) || idNumber(a.id) - idNumber(b.id) || String(a.id).localeCompare(String(b.id));

export function overview(tasks, { filters = {}, groupBy = "status", limit = 20 } = {}, t = T.en) {
  const hits = tasks.filter((x) => matches(x, filters)).sort(byTask);
  const keysOf = {
    status: (x) => [x.status || "?"],
    priority: (x) => [x.priority || t.noPriority],
    assignee: (x) => (x.assignees?.length ? x.assignees : [t.nobody]),
    // With a labels filter, a task only shows under the labels that were asked for.
    label: (x) => {
      const asked = list(filters.labels).map(lower);
      const own = (x.labels ?? []).filter((l) => !asked.length || asked.includes(lower(l)));
      return own.length ? own : [t.noLabel];
    },
    none: () => [t.all],
  }[groupBy];
  const groups = new Map();
  for (const x of hits) for (const k of keysOf(x)) {
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  }
  // Statuses follow the filter order when there is one, otherwise the Backlog.md defaults; the rest by name.
  const statusOrder = list(filters.status).length ? list(filters.status).map(lower) : STATUS_ORDER;
  const rank = groupBy === "status" ? (k) => at(statusOrder, k) : groupBy === "priority" ? (k) => at(PRIORITY_ORDER, k) : () => 0;
  const sorted = [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  let left = limit;
  const out = [];
  for (const [title, rows] of sorted) {
    if (left <= 0) break;
    const shown = rows.slice(0, left);
    left -= shown.length;
    out.push({ title, count: rows.length, tasks: shown.map((x) => ({ id: x.id, title: x.title, status: x.status, priority: x.priority ?? null })) });
  }
  const shownCount = out.reduce((n, g) => n + g.tasks.length, 0);
  const rowCount = [...groups.values()].reduce((n, r) => n + r.length, 0);
  return { groups: out, total: hits.length, hidden: rowCount - shownCount };
}

export default function create({ options, language, backlog }) {
  const errors = validate(options);
  if (errors.length) throw new Error(errors.join("; "));
  const t = T[language] ?? T.en;
  const settings = { filters: options.filters ?? {}, groupBy: options.groupBy ?? "status", limit: options.limit ?? 20 };
  const filterText = Object.entries(settings.filters).map(([k, v]) => `${k}: ${list(v).join(", ")}`).join(" · ");
  return {
    id: options.id ?? "backlog",
    title: options.title ?? t.title,
    async view() {
      if (!backlog?.enabled()) return { state: "off", list: true, text: "", info: [], warning: t.off, links: [], buttons: [] };
      const o = overview(backlog.tasks(), settings, t);
      return {
        state: "on", list: true, text: o.total ? "" : t.none, info: filterText ? [filterText] : [], links: [], buttons: [],
        groups: o.groups, more: o.hidden ? t.more(o.hidden) : null,
      };
    },
    actions: {},
  };
}
