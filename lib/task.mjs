// Read-only view of a Backlog.md task from `backlog task view <id> --json`. Markdown fields are rendered here with
// lib/markdown.mjs (escaped, safe link schemes); plain fields stay text and are escaped by the page.
import { renderMarkdown } from "./markdown.mjs";

export const TASK_ID = /^[A-Za-z]+-\d+(\.\d+)*$/;
const SCHEMA_VERSION = 1;

const str = (v) => (typeof v === "string" ? v : "");
const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : []);
const md = (v) => (str(v).trim() ? renderMarkdown(str(v)).html : "");

function checklist(items) {
  return (Array.isArray(items) ? items : [])
    .filter((c) => c && typeof c.text === "string" && c.text.trim())
    .map((c, i) => ({ index: Number.isInteger(c.index) ? c.index : i + 1, html: md(c.text), checked: c.checked === true }));
}

// Returns null for any shape this version does not know, so the caller can fall back to plain text.
export function taskView(data) {
  if (!data || data.schemaVersion !== SCHEMA_VERSION || data.kind !== "task-view") return null;
  const t = data.task;
  if (!t || typeof t !== "object" || !TASK_ID.test(str(t.id))) return null;
  const nodes = Object.fromEntries((t.dependencyGraph?.nodes ?? []).filter((n) => n && typeof n.id === "string").map((n) => [n.id, n]));
  const sections = [
    ["description", t.description],
    ["implementationPlan", t.implementationPlan],
    ["implementationNotes", t.implementationNotes],
    ["finalSummary", t.finalSummary],
  ].map(([key, v]) => ({ key, html: md(v) })).filter((s) => s.html);
  return {
    id: t.id,
    title: str(t.title),
    status: str(t.status),
    priority: str(t.priority),
    labels: list(t.labels),
    assignees: list(t.assignees),
    dependencies: list(t.dependencies).filter((d) => TASK_ID.test(d)).map((d) => ({ id: d, title: str(nodes[d]?.title), status: str(nodes[d]?.status) })),
    acceptanceCriteria: checklist(t.acceptanceCriteria),
    definitionOfDone: checklist(t.definitionOfDone),
    sections,
  };
}
