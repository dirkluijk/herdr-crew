import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWidgetSet, removeEntry, removeConfirm } from "../lib/widgets.mjs";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
let project, stateDir, disposed;

before(async () => {
  project = realpathSync(await mkdtemp(join(tmpdir(), "herdr-crew-widgets-")));
  stateDir = join(project, ".herdr-crew");
  await mkdir(stateDir);
  await writeFile(join(project, "notes.md"), "# Notes\n");
  await writeFile(join(project, "count.mjs"), `
    export default ({ options }) => ({
      id: options.id, title: options.title ?? options.id, async view() { return { state: "on" }; }, actions: {},
      dispose() { globalThis.__disposed.push(options.id); },
    });
  `);
  await writeFile(join(project, "throws.mjs"), "export default () => { throw new Error(\"bad options\"); };");
});
after(() => rm(project, { recursive: true, force: true }));

const make = () => {
  disposed = globalThis.__disposed = [];
  const said = [];
  const set = createWidgetSet({ app: APP, project, stateDir, fileUrl: (id, key) => `http://files/${id}/${key}`, say: (s) => said.push(s) });
  return { set, said };
};
const counter = (id, extra = {}) => ({ module: "./count.mjs", options: { id, ...extra } });

test("sync keeps unchanged instances, replaces changed ones and disposes removed ones", async () => {
  const { set } = make();
  assert.deepEqual(await set.sync([counter("a"), counter("b")], "en"), { added: 2, removed: 0, total: 2 });
  const [a, b] = set.list();
  assert.deepEqual(await set.sync([counter("a"), counter("b", { title: "B2" }), counter("c")], "en"), { added: 2, removed: 1, total: 3 });
  assert.equal(set.find("a"), a);
  assert.notEqual(set.find("b"), b);
  assert.equal(set.find("b").title, "B2");
  assert.deepEqual(disposed, ["b"]);
  assert.deepEqual(await set.sync([counter("c")], "en"), { added: 0, removed: 2, total: 1 });
  assert.deepEqual(disposed.sort(), ["a", "b", "b"]);
  assert.deepEqual(set.list().map((w) => w.id), ["c"]);
});

test("a language change gives fresh instances", async () => {
  const { set } = make();
  await set.sync([counter("a")], "en");
  const first = set.find("a");
  await set.sync([counter("a")], "nl");
  assert.notEqual(set.find("a"), first);
  assert.deepEqual(disposed, ["a"]);
});

test("a duplicate id is skipped and disposed", async () => {
  const { set, said } = make();
  await set.sync([counter("a"), counter("a", { title: "again" })], "en");
  assert.equal(set.list().length, 1);
  assert.equal(set.find("a").title, "a");
  assert.deepEqual(disposed, ["a"]);
  assert.ok(said.some((s) => /duplicate id/.test(s)));
});

test("a broken entry becomes an error panel that can still be found by id", async () => {
  const { set } = make();
  await set.sync([{ module: "./throws.mjs", options: { id: "oops", title: "Oops" } }, { module: "./missing.mjs" }, { nope: true }], "en");
  assert.deepEqual(set.list().map((w) => w.id), ["oops", "widget-2", "widget-3"]);
  const view = await set.find("oops").view();
  assert.equal(view.error, "bad options");
  assert.equal(view.state, "off");
});

test("files follow the widgets: new links widgets add files, removed ones drop them", async () => {
  const { set } = make();
  const links = { module: "links", options: { id: "docs", links: [{ label: "Notes", file: "notes.md" }] } };
  await set.sync([], "en");
  assert.equal(set.fileCount(), 0);
  await set.sync([links], "en");
  assert.equal(set.fileCount(), 1);
  assert.equal(set.file("docs", "0-notes.md").path, join(project, "notes.md"));
  assert.equal(set.file("docs", "constructor"), null);
  await set.sync([], "en");
  assert.equal(set.file("docs", "0-notes.md"), null);
});

test("sync calls run one after another", async () => {
  const { set } = make();
  const order = [];
  await Promise.all([
    set.sync([counter("a")], "en").then(() => order.push(set.list().map((w) => w.id).join())),
    set.sync([counter("b")], "en").then(() => order.push(set.list().map((w) => w.id).join())),
  ]);
  assert.deepEqual(order, ["a", "b"]);
});

test("removeEntry removes exactly one matching entry and keeps the other keys", async () => {
  const file = join(project, ".herdr-crew.json");
  const a = counter("a");
  await writeFile(file, JSON.stringify({ title: "t", widgets: [a, counter("b"), a] }));
  assert.deepEqual(await removeEntry(file, JSON.stringify(a)), [counter("b"), a]);
  const raw = JSON.parse(await readFile(file, "utf8"));
  assert.equal(raw.title, "t");
  assert.deepEqual(raw.widgets, [counter("b"), a]);
  assert.equal(await removeEntry(file, JSON.stringify(counter("zzz"))), null);
  assert.equal(await removeEntry(join(project, "missing.json"), JSON.stringify(a)), null);
});

test("the remove confirmation names the panel in the UI language", () => {
  assert.match(removeConfirm("nl", { id: "docs", title: "Docs" }), /^Verwijdert het paneel Docs \(docs\)/);
  assert.match(removeConfirm("xx", { id: "docs", title: "Docs" }), /^Removes the panel Docs \(docs\)/);
});
