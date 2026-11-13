import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentControl, allowedCwd, labelFor } from "../lib/agents.mjs";

let root, project, worktree, file;
before(async () => {
  root = realpathSync(await mkdtemp(join(tmpdir(), "herdr-crew-agents-")));
  project = join(root, "project");
  worktree = join(root, "project-wt");
  await mkdir(join(project, "sub"), { recursive: true });
  await mkdir(join(worktree, "src"), { recursive: true });
  await mkdir(join(root, "elsewhere"));
  await symlink(join(root, "elsewhere"), join(project, "escape"));
  file = join(project, ".herdr-crew.json");
});
after(() => rm(root, { recursive: true, force: true }));

// A fake exec: answers by the joined arguments and records every call.
function fakeExec(answers = {}) {
  const calls = [];
  const exec = async (cmd, args) => {
    calls.push([cmd, ...args]);
    const key = [cmd, ...args].join(" ");
    const hit = Object.entries(answers).find(([k]) => key.startsWith(k));
    const v = hit ? (typeof hit[1] === "function" ? hit[1](args) : hit[1]) : { result: {} };
    if (v?.fail) return { ok: false, stdout: "", stderr: v.fail };
    return { ok: true, stdout: typeof v === "string" ? v : JSON.stringify(v), stderr: "" };
  };
  return { exec, calls, herdr: () => calls.filter((c) => c[0] === "herdr").map((c) => c.slice(1)) };
}

const agentInfo = (over = {}) => ({ result: { agent: {
  name: "m2-docs", pane_id: "w1:p4", tab_id: "w1:t3", agent: "opencode", agent_status: "idle",
  agent_session: { value: "ses_abc123" }, cwd: project, ...over,
} } });
const tabInfo = (panes = 1) => ({ result: { tab: { tab_id: "w1:t3", label: "m2-docs (Dora, she/her)", pane_count: panes } } });
const card = { id: "m2-docs", name: "Dora", pane: "w1:p4", live: true, registered: true };

async function setup(personas, answers) {
  await writeFile(file, JSON.stringify({ title: "t", personas }));
  const cfg = { file, personas: JSON.parse(await readFile(file, "utf8")).personas };
  const f = fakeExec(answers);
  const snapshot = { workspace: "w1", agents: [] };
  return { ...f, cfg, snapshot, control: createAgentControl({ project, cfg, exec: f.exec, getSnapshot: () => snapshot }) };
}
const dora = { agent: "m2-docs", name: "Dora", pronouns: "she/her", role: "docs", tasks: [] };
const saved = async () => JSON.parse(await readFile(file, "utf8")).personas;

test("close: stores session and cwd, then closes the tab", async () => {
  const s = await setup([dora], { "herdr agent get": agentInfo(), "herdr tab get": tabInfo() });
  const r = await s.control.close(card);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, stored: true });
  assert.deepEqual(s.herdr(), [["agent", "get", "w1:p4"], ["tab", "get", "w1:t3"], ["tab", "close", "w1:t3"]]);
  const [p] = await saved();
  assert.equal(p.session, "ses_abc123");
  assert.equal(p.cwd, project);
  assert.equal(p.role, "docs");
  assert.deepEqual(r.log, { tab: "w1:t3", label: "m2-docs (Dora, she/her)", session: "ses_abc123", cwd: project });
});

test("close: refused for the lead, busy agents, other panes and more than one pane", async () => {
  const cases = [
    [{ ...card, lead: true }, {}, /lead persona/],
    [card, { "herdr agent get": agentInfo({ agent_status: "working" }) }, /working; only idle or done/],
    [card, { "herdr agent get": agentInfo({ agent_status: "blocked" }) }, /blocked/],
    [card, { "herdr agent get": agentInfo({ pane_id: "w1:p5" }) }, /no longer in that pane/],
    [card, { "herdr agent get": agentInfo({ name: "other" }) }, /no longer in that pane/],
    [card, { "herdr agent get": { fail: "gone" } }, /no longer in that pane/],
    [card, { "herdr agent get": agentInfo(), "herdr tab get": tabInfo(2) }, /has 2 panes/],
    [card, { "herdr agent get": agentInfo(), "herdr tab get": { fail: "x" } }, /unknown number of panes/],
  ];
  for (const [c, answers, why] of cases) {
    const s = await setup([dora], answers);
    const r = await s.control.close(c);
    assert.equal(r.status, 409, String(why));
    assert.match(r.body.error, why);
    assert.ok(!s.herdr().some((a) => a[0] === "tab" && a[1] === "close"), String(why));
    assert.equal((await saved())[0].session, undefined);
  }
});

test("close: an unregistered agent or a non-OpenCode agent closes without storing a session", async () => {
  for (const [personas, info] of [[[], agentInfo()], [[dora], agentInfo({ agent: "claude" })], [[dora], agentInfo({ agent_session: { value: "not-a-session" } })]]) {
    const s = await setup(personas, { "herdr agent get": info, "herdr tab get": tabInfo() });
    const r = await s.control.close(card);
    assert.deepEqual(r.body, { ok: true, stored: false });
    assert.deepEqual(s.herdr().at(-1), ["tab", "close", "w1:t3"]);
  }
});

test("close: a failed tab close is reported", async () => {
  const s = await setup([dora], { "herdr agent get": agentInfo(), "herdr tab get": tabInfo(), "herdr tab close": { fail: "no such tab" } });
  const r = await s.control.close(card);
  assert.equal(r.status, 502);
  assert.match(r.body.error, /no such tab/);
});

const created = { result: { tab: { tab_id: "w1:t8" }, root_pane: { pane_id: "w1:p8" } } };
const stored = () => ({ ...dora, session: "ses_abc123", cwd: join(project, "sub") });

test("reopen: creates a tab with the same label in the crew workspace and starts the same session", async () => {
  const s = await setup([stored()], { "herdr agent list": { result: { agents: [{ name: "crew-orch" }] } }, "herdr tab create": created, "git ": { fail: "not a repo" } });
  s.snapshot.agents.push({ id: "m2-docs", live: false, label: "m2-docs (Dora, she/her) old" });
  const r = await s.control.reopen("m2-docs");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(s.herdr(), [
    ["agent", "list"],
    ["tab", "create", "--workspace", "w1", "--cwd", join(project, "sub"), "--label", "m2-docs (Dora, she/her) old", "--no-focus"],
    ["agent", "start", "m2-docs", "--kind", "opencode", "--pane", "w1:p8", "--timeout", "60000", "--", "--session", "ses_abc123"],
  ]);
  assert.equal(r.log.label, "m2-docs (Dora, she/her) old");
  assert.equal(r.log.session, "ses_abc123");
});

test("reopen: without a stored label the label is built from the persona, without a cwd the project is used", async () => {
  const s = await setup([{ ...dora, session: "ses_abc123" }], { "herdr agent list": { result: { agents: [] } }, "herdr tab create": created });
  const r = await s.control.reopen("m2-docs");
  assert.equal(r.status, 200);
  assert.deepEqual(s.herdr()[1].slice(5, 8), [project, "--label", "m2-docs (Dora, she/her)"]);
  assert.equal(labelFor({ agent: "x", name: "X" }), "x (X)");
});

test("reopen: refused without a session, when the name is live, for a cwd outside, or without a workspace", async () => {
  const list = (agents) => ({ "herdr agent list": { result: { agents } }, "herdr tab create": created, "git ": { fail: "no" } });
  const cases = [
    [[dora], list([]), 409, /no OpenCode session stored/],
    [[{ ...dora, session: "ses_bad-id" }], list([]), 409, /no OpenCode session stored/],
    [[], list([]), 404, /unknown persona/],
    [[stored()], list([{ name: "m2-docs", workspace_id: "w7" }]), 409, /already live in Herdr/],
    [[stored()], { "herdr agent list": { fail: "down" } }, 502, /agent list failed/],
    [[{ ...stored(), cwd: join(root, "elsewhere") }], list([]), 409, /not the project, inside it, or a git worktree/],
    [[{ ...stored(), cwd: join(project, "escape") }], list([]), 409, /not the project/],
    [[{ ...stored(), cwd: join(project, "missing") }], list([]), 409, /not the project/],
  ];
  for (const [personas, answers, status, why] of cases) {
    const s = await setup(personas, answers);
    const r = await s.control.reopen("m2-docs");
    assert.equal(r.status, status, String(why));
    assert.match(r.body.error, why);
    assert.ok(!s.herdr().some((a) => a[1] === "create" || a[1] === "start"), String(why));
  }
  const s = await setup([stored()], list([]));
  s.snapshot.workspace = null;
  assert.match((await s.control.reopen("m2-docs")).body.error, /workspace is unknown/);
});

test("reopen: a failed start closes the new tab again, a missing pane id stops before start", async () => {
  let s = await setup([stored()], { "herdr agent list": { result: { agents: [] } }, "herdr tab create": created, "herdr agent start": { fail: "timeout" } });
  let r = await s.control.reopen("m2-docs");
  assert.equal(r.status, 502);
  assert.match(r.body.error, /agent start failed: timeout/);
  assert.deepEqual(s.herdr().at(-1), ["tab", "close", "w1:t8"]);
  s = await setup([stored()], { "herdr agent list": { result: { agents: [] } }, "herdr tab create": { result: { tab: { tab_id: "w1:t8" } } } });
  r = await s.control.reopen("m2-docs");
  assert.equal(r.status, 502);
  assert.ok(!s.herdr().some((a) => a[1] === "start"));
});

test("one close or reopen per agent at a time", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const s = await setup([stored()], { "herdr agent list": { result: { agents: [] } }, "herdr tab create": created });
  const slow = createAgentControl({
    project, cfg: s.cfg, getSnapshot: () => s.snapshot,
    exec: async (cmd, args, ...rest) => { if (args[1] === "list") await gate; return s.exec(cmd, args, ...rest); },
  });
  const first = slow.reopen("m2-docs");
  const second = await slow.reopen("m2-docs");
  assert.equal(second.status, 409);
  assert.match(second.body.error, /already running/);
  release();
  assert.equal((await first).status, 200);
});

test("allowedCwd: the project, inside it, or a git worktree of it", async () => {
  const exec = async () => ({ ok: true, stdout: `worktree ${project}\nHEAD abc\n\nworktree ${worktree}\nbranch refs/heads/x\n`, stderr: "" });
  assert.equal(await allowedCwd(exec, project, project), project);
  assert.equal(await allowedCwd(exec, project, join(project, "sub")), join(project, "sub"));
  assert.equal(await allowedCwd(exec, project, join(worktree, "src")), join(worktree, "src"));
  assert.equal(await allowedCwd(exec, project, join(root, "elsewhere")), null);
  assert.equal(await allowedCwd(exec, project, join(project, "escape")), null);
  assert.equal(await allowedCwd(exec, project, `${project}-wt2`), null);
  const noGit = async () => ({ ok: false, stdout: "", stderr: "" });
  assert.equal(await allowedCwd(noGit, project, join(worktree, "src")), null);
});
