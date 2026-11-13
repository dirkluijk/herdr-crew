import { test } from "node:test";
import assert from "node:assert/strict";
import { taskView } from "../lib/task.mjs";

// Shape of `backlog task view <id> --json` in Backlog.md 1.53.0, trimmed to the fields that matter.
const sample = () => ({
  schemaVersion: 1,
  kind: "task-view",
  task: {
    id: "CREW-13", title: "Render tasks", status: "In Progress", priority: "medium",
    assignees: ["@m2-tests"], labels: ["ui", ""], dependencies: ["CREW-11", "bad id"],
    dependencyGraph: { root: "CREW-13", nodes: [{ id: "CREW-13", title: "Render tasks", status: "In Progress" }, { id: "CREW-11", title: "Faster dashboard", status: "Done" }], edges: [] },
    description: "Use **JSON**. <script>alert(1)</script> [x](javascript:alert(1))",
    acceptanceCriteria: [{ index: 1, text: "Shows `sections`", checked: true }, { index: 2, text: "Falls back", checked: false }],
    definitionOfDone: [],
    implementationPlan: "1. Map\n2. Render",
    implementationNotes: "",
    finalSummary: null,
  },
});

test("maps the plain fields and keeps them as text", () => {
  const v = taskView(sample());
  assert.equal(v.id, "CREW-13");
  assert.equal(v.title, "Render tasks");
  assert.equal(v.status, "In Progress");
  assert.equal(v.priority, "medium");
  assert.deepEqual(v.labels, ["ui"]);
  assert.deepEqual(v.assignees, ["@m2-tests"]);
});

test("dependencies get title and status from the graph, invalid ids are dropped", () => {
  assert.deepEqual(taskView(sample()).dependencies, [{ id: "CREW-11", title: "Faster dashboard", status: "Done" }]);
  const s = sample();
  delete s.task.dependencyGraph;
  assert.deepEqual(taskView(s).dependencies, [{ id: "CREW-11", title: "", status: "" }]);
});

test("acceptance criteria keep index and checked, with markdown text", () => {
  assert.deepEqual(taskView(sample()).acceptanceCriteria, [
    { index: 1, html: "<p>Shows <code>sections</code></p>", checked: true },
    { index: 2, html: "<p>Falls back</p>", checked: false },
  ]);
  const s = sample();
  s.task.acceptanceCriteria = [{ text: "no index", checked: "yes" }, { text: "  " }, null, "x"];
  assert.deepEqual(taskView(s).acceptanceCriteria, [{ index: 1, html: "<p>no index</p>", checked: false }]);
});

test("markdown sections are rendered safely and empty ones are left out", () => {
  const v = taskView(sample());
  assert.deepEqual(v.sections.map((s) => s.key), ["description", "implementationPlan"]);
  const desc = v.sections[0].html;
  assert.match(desc, /<strong>JSON<\/strong>/);
  assert.doesNotMatch(desc, /<script|href="javascript/);
  assert.match(desc, /&lt;script&gt;/);
  assert.equal(v.sections[1].html, "<ol><li>Map</li><li>Render</li></ol>");
});

test("plain fields that are not strings or arrays become empty", () => {
  const s = sample();
  Object.assign(s.task, { title: 42, status: null, priority: { x: 1 }, labels: "ui", assignees: null, dependencies: "CREW-11" });
  const v = taskView(s);
  assert.deepEqual([v.title, v.status, v.priority, v.labels, v.assignees, v.dependencies], ["", "", "", [], [], []]);
});

test("unknown or missing schema gives null, so the server falls back to plain text", () => {
  for (const patch of [{ schemaVersion: undefined }, { schemaVersion: 2 }, { schemaVersion: "1" }, { kind: "task-list" }, { task: null }, { task: { id: "not a task id" } }]) {
    assert.equal(taskView({ ...sample(), ...patch }), null, JSON.stringify(patch));
  }
  assert.equal(taskView(null), null);
  assert.equal(taskView([]), null);
});
