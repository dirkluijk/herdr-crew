import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink, utimes } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import createBacklog, { validate as validateBacklog, matches, overview } from "../widgets/backlog.mjs";
import createMarkdown, { validate as validateMarkdown, section } from "../widgets/markdown.mjs";

const TASKS = [
  { id: "CREW-10", title: "Ten", status: "To Do", priority: "low", labels: ["ui"], assignees: [], ordinal: 10000 },
  { id: "CREW-2", title: "Two", status: "In Progress", priority: "high", labels: ["ui", "widgets"], assignees: ["@m5-panels"], ordinal: 2000 },
  { id: "CREW-3", title: "Three", status: "Done", priority: "medium", labels: ["docs"], assignees: ["@m1-parser"], ordinal: 3000 },
  { id: "CREW-4", title: "Four", status: "To Do", priority: "high", labels: [], assignees: ["@m5-panels"], ordinal: 4000 },
  { id: "CREW-5", title: "Five", status: "Review", priority: null, labels: ["ui"], assignees: [], ordinal: null },
];
const ids = (o) => o.groups.map((g) => [g.title, g.tasks.map((t) => t.id)]);

test("backlog: options validation", () => {
  assert.deepEqual(validateBacklog({}), []);
  assert.deepEqual(validateBacklog({ id: "open", title: "Open", filters: { status: "To Do", labels: ["ui"], assignee: "@m5-panels", priority: ["high"] }, groupBy: "label", limit: 5 }), []);
  for (const bad of [
    null, [], { id: "Bad Id" }, { title: "" }, { filters: [] }, { filters: { owner: "x" } }, { filters: { status: [] } },
    { filters: { labels: [1] } }, { groupBy: "colour" }, { limit: 0 }, { limit: 201 }, { limit: 2.5 },
  ]) assert.ok(validateBacklog(bad).length, JSON.stringify(bad));
  assert.throws(() => createBacklog({ options: { groupBy: "x" }, language: "en", backlog: null }), /groupBy must be one of/);
});

test("backlog: filters are case insensitive, labels match any, assignee with or without @", () => {
  assert.ok(matches(TASKS[1], { status: "in progress", labels: ["WIDGETS", "nope"], assignee: "m5-panels", priority: "HIGH" }));
  assert.ok(matches(TASKS[1], { assignee: ["@m5-panels"] }));
  assert.ok(!matches(TASKS[1], { status: ["To Do"] }));
  assert.ok(!matches(TASKS[3], { labels: "ui" }));
  assert.ok(!matches(TASKS[4], { priority: "low" }));
  assert.ok(matches(TASKS[4], {}));
});

test("backlog: grouped by status in Backlog.md order, other statuses after, sorted by priority then ordinal", () => {
  assert.deepEqual(ids(overview(TASKS)), [
    ["To Do", ["CREW-4", "CREW-10"]], ["In Progress", ["CREW-2"]], ["Done", ["CREW-3"]], ["Review", ["CREW-5"]],
  ]);
  assert.deepEqual(ids(overview(TASKS, { filters: { status: ["Done", "To Do"] } })), [["Done", ["CREW-3"]], ["To Do", ["CREW-4", "CREW-10"]]]);
});

test("backlog: other groupings and the limit", () => {
  assert.deepEqual(ids(overview(TASKS, { groupBy: "priority" })), [["high", ["CREW-2", "CREW-4"]], ["medium", ["CREW-3"]], ["low", ["CREW-10"]], ["no priority", ["CREW-5"]]]);
  assert.deepEqual(ids(overview(TASKS, { groupBy: "assignee", filters: { status: "To Do" } })), [["@m5-panels", ["CREW-4"]], ["nobody", ["CREW-10"]]]);
  assert.deepEqual(ids(overview(TASKS, { groupBy: "none", limit: 2 })), [["All tasks", ["CREW-2", "CREW-4"]]]);
  assert.deepEqual(ids(overview(TASKS, { groupBy: "label", filters: { labels: ["UI"] } })), [["ui", ["CREW-2", "CREW-10", "CREW-5"]]]);
  assert.deepEqual(ids(overview(TASKS, { groupBy: "label", filters: { status: "Done" } })), [["docs", ["CREW-3"]]]);
  const o = overview(TASKS, { limit: 3 });
  assert.deepEqual(ids(o), [["To Do", ["CREW-4", "CREW-10"]], ["In Progress", ["CREW-2"]]]);
  assert.equal(o.hidden, 2);
  assert.equal(o.groups[0].count, 2);
});

test("backlog: the view follows the current task list and says when Backlog.md is off", async () => {
  let tasks = TASKS.slice(0, 2);
  let enabled = true;
  const w = createBacklog({ options: { filters: { labels: "ui" } }, language: "nl", backlog: { enabled: () => enabled, tasks: () => tasks } });
  assert.equal(w.id, "backlog");
  let v = await w.view();
  assert.deepEqual(v.groups.map((g) => g.tasks.map((t) => t.id)), [["CREW-10"], ["CREW-2"]]);
  assert.deepEqual(v.info, ["labels: ui"]);
  tasks = [{ ...TASKS[0], status: "Done" }];
  v = await w.view();
  assert.deepEqual(v.groups.map((g) => g.title), ["Done"]);
  tasks = [];
  assert.equal((await w.view()).text, "Geen taken voor dit filter.");
  enabled = false;
  assert.match((await w.view()).warning, /Backlog.md staat uit/);
  assert.deepEqual(Object.keys(w.actions), []);
});

let project, root;
before(async () => {
  root = realpathSync(await mkdtemp(join(tmpdir(), "herdr-crew-md-")));
  project = join(root, "project");
  await mkdir(join(project, "docs"), { recursive: true });
  await writeFile(join(project, "PLAN.md"), "# Plan\n\nIntro\n\n## Goals\n\n- one <img src=x onerror=alert(1)>\n\n```\n## not a heading\n```\n\n### Sub\n\nkept\n\n## Later\n\nnot shown\n");
  await writeFile(join(root, "outside.md"), "# secret");
  await symlink(join(root, "outside.md"), join(project, "docs", "link.md"));
  await writeFile(join(project, "big.md"), "x".repeat(600 * 1024));
});
after(() => rm(root, { recursive: true, force: true }));

const md = (options, language = "en") => createMarkdown({ project, options, language, fileUrl: (id, key) => `http://files/${id}/${key}` });

test("markdown: options validation", () => {
  assert.deepEqual(validateMarkdown({ file: "PLAN.md" }), []);
  assert.deepEqual(validateMarkdown({ file: "docs/a.md", id: "plan", title: "Plan", section: "Goals", maxHeight: 300 }), []);
  for (const bad of [
    null, {}, { file: "" }, { file: "/etc/passwd" }, { file: "../outside.md" }, { file: "docs/../../x.md" }, { file: "~/x.md" },
    { file: "a.md", id: "A" }, { file: "a.md", maxHeight: 50 }, { file: "a.md", maxHeight: "300px" }, { file: "a.md", section: "" },
  ]) assert.ok(validateMarkdown(bad).length, JSON.stringify(bad));
  assert.throws(() => md({ file: "../outside.md" }), /inside the project/);
});

test("markdown: section picks the heading up to the next one of the same level, ignoring code blocks", () => {
  const src = "# A\n\n## Goals\n\nx\n\n```\n## fake\n```\n\n### Sub\n\ny\n\n## Later\n\nz\n";
  assert.equal(section(src, "goals"), "## Goals\n\nx\n\n```\n## fake\n```\n\n### Sub\n\ny\n");
  assert.equal(section(src, "Later"), "## Later\n\nz\n");
  assert.equal(section(src, "Missing"), null);
});

test("markdown: renders a section safely, with a link to the whole file", async () => {
  const w = md({ id: "goals", file: "PLAN.md", section: "Goals", maxHeight: 300 });
  assert.equal(w.title, "PLAN.md");
  assert.equal(w.files.file.path, join(project, "PLAN.md"));
  const v = await w.view();
  assert.equal(v.state, "on");
  assert.equal(v.maxHeight, 300);
  assert.match(v.html, /<h2 id="goals">Goals<\/h2>/);
  assert.match(v.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(v.html, /<img|not shown|<h1/);
  assert.deepEqual(v.links, [{ title: "Whole file", url: "http://files/goals/file", enabled: true }]);
  assert.match((await md({ file: "PLAN.md", section: "Nope" }).view()).warning, /Section Nope not found/);
});

test("markdown: a changed file shows on the next view", async () => {
  const file = join(project, "docs", "live.md");
  await writeFile(file, "first");
  const w = md({ file: "docs/live.md" });
  assert.match((await w.view()).html, /first/);
  await writeFile(file, "second version");
  await utimes(file, new Date(), new Date(Date.now() + 5000));
  assert.match((await w.view()).html, /second version/);
});

test("markdown: symlinks out of the project, missing and big files are refused", async () => {
  const out = await md({ file: "docs/link.md" }).view();
  assert.equal(out.html, null);
  assert.match(out.error, /outside the project/);
  assert.deepEqual(out.links, []);
  assert.match((await md({ file: "docs/none.md" }, "nl").view()).error, /bestaat niet/);
  assert.match((await md({ file: "big.md" }).view()).error, /larger than 512 kB/);
  // A file that becomes a symlink out of the project later is refused too.
  const file = join(project, "docs", "swap.md");
  await writeFile(file, "fine");
  const w = md({ file: "docs/swap.md" });
  assert.match((await w.view()).html, /fine/);
  await rm(file);
  await symlink(join(root, "outside.md"), file);
  assert.match((await w.view()).error, /outside the project/);
});
