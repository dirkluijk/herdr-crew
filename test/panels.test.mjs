import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PANEL_TYPES, entryId, validateEntry, addWidget, removeWidget, cleanPrompt, panelRequestText } from "../lib/panels.mjs";
import { validate as validateLinks } from "../widgets/links.mjs";
import { validate as validateDevServer } from "../widgets/dev-server.mjs";

let root, project, file;
before(async () => {
  root = realpathSync(await mkdtemp(join(tmpdir(), "herdr-crew-panels-")));
  project = join(root, "project");
  await mkdir(join(project, "docs"), { recursive: true });
  await writeFile(join(project, "PLAN.md"), "# Plan\n");
  await writeFile(join(root, "outside.md"), "# outside");
  await symlink(join(root, "outside.md"), join(project, "docs", "out.md"));
  file = join(project, ".herdr-crew.json");
});
after(() => rm(root, { recursive: true, force: true }));

test("only the four built-in types are known", () => {
  assert.deepEqual(Object.keys(PANEL_TYPES), ["backlog", "markdown", "links", "dev-server"]);
  for (const module of ["./my-widget.mjs", "/tmp/x.mjs", "constructor", "toString", "__proto__", "", undefined]) {
    assert.match(validateEntry({ module, options: {} }).join(), /module must be one of/, String(module));
  }
});

test("entries: shape, options and ids", () => {
  assert.match(validateEntry(null)[0], /JSON object/);
  assert.match(validateEntry({ module: "backlog", options: {}, html: "<b>" })[0], /unknown keys html/);
  assert.deepEqual(validateEntry({ module: "backlog" }), []);
  assert.match(validateEntry({ module: "backlog", options: { groupBy: "x" } }).join(), /groupBy/);
  assert.match(validateEntry({ module: "markdown", options: { file: "PLAN.md", script: "x" } }).join(), /option script is unknown/);
  assert.equal(entryId({ module: "backlog" }), "backlog");
  assert.equal(entryId({ module: "dev-server", options: { port: 5300 } }), "dev-5300");
  assert.equal(entryId({ module: "markdown", options: { id: "plan", file: "PLAN.md" } }), "plan");
  assert.equal(entryId({ module: "./x.mjs" }), null);
  const existing = [{ module: "backlog", options: {} }, { module: "links", options: { id: "docs", links: [] } }];
  assert.match(validateEntry({ module: "backlog", options: { title: "Again" } }, existing).join(), /id backlog already exists/);
  assert.match(validateEntry({ module: "markdown", options: { id: "docs", file: "PLAN.md" } }, existing).join(), /id docs already exists/);
  assert.deepEqual(validateEntry({ module: "markdown", options: { id: "plan", file: "PLAN.md" } }, existing), []);
});

test("entries: listed files must exist inside the project", () => {
  const md = (f) => validateEntry({ module: "markdown", options: { file: f } }, [], project);
  assert.deepEqual(md("PLAN.md"), []);
  assert.match(md("NOPE.md").join(), /NOPE.md: does not exist/);
  assert.match(md("docs/out.md").join(), /outside the project/);
  assert.match(md("../outside.md").join(), /inside the project/);
  const links = (l) => validateEntry({ module: "links", options: { links: l } }, [], project);
  assert.deepEqual(links([{ label: "Plan", file: "PLAN.md" }, { label: "RFC", url: "https://example.com/rfc" }]), []);
  assert.match(links([{ label: "Gone", file: "gone.md" }]).join(), /gone.md: does not exist/);
});

test("links validation", () => {
  assert.deepEqual(validateLinks({ id: "docs", title: "Docs", note: "n", links: [{ label: "A", url: "http://x.y/z", note: "n" }, { label: "B", file: "a.md", render: "text" }] }), []);
  for (const bad of [
    {}, { links: [] }, { links: Array.from({ length: 31 }, () => ({ label: "x", url: "https://x" })) }, { links: [{ url: "https://x" }] },
    { links: [{ label: "x" }] }, { links: [{ label: "x", url: "https://x", file: "a.md" }] }, { links: [{ label: "x", url: "javascript:alert(1)" }] },
    { links: [{ label: "x", file: "/etc/hosts" }] }, { links: [{ label: "x", file: "a.md", render: "exec" }] }, { links: [{ label: "x", url: "https://x", onclick: "y" }] },
  ]) assert.ok(validateLinks(bad).length, JSON.stringify(bad));
});

test("dev-server validation", () => {
  assert.deepEqual(validateDevServer({ port: 5300, command: ["npm", "run", "docs"], cwd: "docs", pages: [{ title: "Home", path: "/" }], startTimeoutMs: 10000 }), []);
  for (const bad of [
    {}, { port: 80 }, { port: 5300, command: "npm run dev" }, { port: 5300, command: [] }, { port: 5300, cwd: "../x" },
    { port: 5300, pages: [{ path: "/" }] }, { port: 5300, requireNodeModules: "no" }, { port: 5300, shell: true },
  ]) assert.ok(validateDevServer(bad).length, JSON.stringify(bad));
});

test("addWidget and removeWidget keep the rest of the config", async () => {
  await writeFile(file, JSON.stringify({ title: "t", personas: [{ agent: "a", name: "A" }] }));
  assert.deepEqual(await addWidget(file, project, { module: "markdown", options: { id: "plan", file: "PLAN.md" } }), { id: "plan" });
  assert.deepEqual(await addWidget(file, project, { module: "backlog" }), { id: "backlog" });
  assert.match((await addWidget(file, project, { module: "backlog", options: {} })).errors.join(), /already exists/);
  assert.match((await addWidget(file, project, { module: "markdown", options: { file: "NOPE.md" } })).errors.join(), /does not exist/);
  let raw = JSON.parse(await readFile(file, "utf8"));
  assert.deepEqual(raw.widgets, [{ module: "markdown", options: { id: "plan", file: "PLAN.md" } }, { module: "backlog", options: {} }]);
  assert.equal(raw.title, "t");
  assert.equal(raw.personas.length, 1);
  assert.deepEqual(await removeWidget(file, "plan"), { module: "markdown", options: { id: "plan", file: "PLAN.md" } });
  assert.equal(await removeWidget(file, "plan"), null);
  raw = JSON.parse(await readFile(file, "utf8"));
  assert.deepEqual(raw.widgets, [{ module: "backlog", options: {} }]);
});

test("the prompt stays plain text", () => {
  assert.equal(cleanPrompt("a\u0007b\r\nc\n\n\n\nd\u001b[2J"), "a b\nc\n\nd [2J");
  assert.equal(cleanPrompt(42), "");
});

test("the message to the lead quotes the request and gives the types and the exact command", () => {
  const text = panelRequestText({ language: "en", project: "/p", cli: "node /app/server.mjs", prompt: "a mini overview\nof all tasks" });
  const lines = text.split("\n");
  assert.match(lines[0], /^From the crew dashboard: the user asks for a new panel/);
  assert.deepEqual(lines.slice(1, 3), ["> a mini overview", "> of all tasks"]);
  for (const type of Object.keys(PANEL_TYPES)) assert.ok(lines.some((l) => l.startsWith(`- ${type}: `)), type);
  assert.ok(lines.includes(`node /app/server.mjs widget add --project /p --json '{"module":"backlog","options":{"id":"open","title":"Open work","filters":{"status":["To Do","In Progress"]}}}'`));
  assert.match(text, /No HTML or code of your own/);
  const nl = panelRequestText({ language: "nl", project: "/p", cli: "c", prompt: "x" });
  assert.match(nl, /^Via het crew-dashboard: de gebruiker vraagt een nieuw paneel/);
  assert.match(nl, /"title":"Open werk"/);
  assert.doesNotMatch(text + nl, /[\u2013\u2014]/);
});
