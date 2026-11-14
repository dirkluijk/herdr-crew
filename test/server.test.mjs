// Starts its own dashboard on free ports (never 5190 to 5193) against a temporary project, with stub herdr
// and backlog commands on PATH, so the tests never reach a live Herdr server or a real project.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { createServer } from "node:net";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, unlink, copyFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESERVED = new Set([5190, 5191, 5192, 5193]);

async function freePort(taken) {
  for (;;) {
    const port = await new Promise((res, rej) => {
      const s = createServer().once("error", rej).listen(0, "127.0.0.1", () => {
        const { port } = s.address();
        s.close(() => res(port));
      });
    });
    if (!RESERVED.has(port) && !taken.includes(port)) return port;
  }
}

function http(port, path, { method = "GET", headers = {}, body, host = `localhost:${port}` } = {}) {
  return new Promise((res, rej) => {
    const data = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
    const opts = host === null ? { setHost: false, headers } : { headers: { host, ...headers } };
    const req = request({ host: "127.0.0.1", port, path, method, ...opts }, (r) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => res({ status: r.statusCode, headers: r.headers, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", rej);
    req.end(data);
  });
}

let root, project, port, filesPort, server, herdrLog, screenFile, stubEnv;
const output = [];
const ok = () => ({ origin: `http://localhost:${port}`, "x-crew": "1", "content-type": "application/json" });
const api = (path, opts) => http(port, path, opts);
const files = (path, opts) => http(filesPort, path, opts);
const herdrCalls = async () => (existsSync(herdrLog) ? (await readFile(herdrLog, "utf8")).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

before(async () => {
  root = realpathSync(await mkdtemp(join(tmpdir(), "herdr-crew-http-")));
  project = join(root, "project");
  herdrLog = join(root, "herdr.log");
  screenFile = join(root, "screen.ansi");
  await mkdir(join(project, "docs"), { recursive: true });
  await writeFile(join(project, "docs", "notes.md"), "# Notes\n\n<script>alert(1)</script>\n");
  await writeFile(join(project, "page.html"), "<h1>page</h1>");
  await writeFile(join(root, "tasks.json"), JSON.stringify({ tasks: [
    { id: "CREW-2", title: "Second", status: "To Do", priority: "low", labels: ["ui"], assignees: [] },
    { id: "CREW-1", title: "First <b>one</b>", status: "In Progress", priority: "high", labels: ["ui", "widgets"], assignees: ["@m2-tests"] },
    { id: "CREW-3", title: "Third", status: "Done", priority: "medium", labels: ["docs"], assignees: [] },
  ] }));
  await writeFile(join(project, "PLAN.md"), "# Plan\n\n## Goals\n\nShip <script>x</script> panels.\n\n## Later\n\nNot shown.\n");
  await writeFile(join(project, "secret.txt"), "not listed");
  await writeFile(join(root, "outside.md"), "# outside the project");
  await symlink(join(root, "outside.md"), join(project, "link-out.md"));
  await writeFile(join(project, "probe-widget.mjs"), `
    import { writeFile } from "node:fs/promises";
    import { join } from "node:path";
    export default ({ project }) => ({
      id: "probe", title: "Probe", async view() { return { state: "on" }; },
      actions: { poke: { confirm: () => "Pokes the probe", run: () => writeFile(join(project, "poked"), "1") } },
    });
  `);
  await writeFile(join(project, ".herdr-crew.json"), JSON.stringify({
    title: "http-test", workspace: "w99", backlog: true, themeAsked: true, theme: { name: "keep" }, terminalApp: "FakeTerm",
    personas: [{ agent: "m9-probe", name: "Probe", pronouns: "it", role: "test", tasks: [] }],
    widgets: [
      { module: "links", options: { links: [
        { label: "notes", file: "docs/notes.md" },
        { label: "page", file: "page.html" },
        { label: "outside", file: "../outside.md" },
        { label: "symlink", file: "link-out.md" },
        { label: "script", url: "javascript:alert(1)" },
      ] } },
      { module: "./probe-widget.mjs" },
    ],
  }));

  port = await freePort([]);
  filesPort = await freePort([port]);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(ANTHROPIC|OPENAI|HERDR)_|^PORT$/.test(k)));
  Object.assign(env, {
    PATH: [join(APP, "test", "fixtures", "bin"), process.env.PATH].join(delimiter),
    HERDR_CREW_TEST_LOG: herdrLog, HERDR_CREW_TEST_PROJECT: project, HERDR_CREW_TEST_SCREEN: screenFile, HERDR_CREW_TEST_TASKS: join(root, "tasks.json"), HERDR_CREW_TEST_STATE: join(root, "herdr-state.json"),
  });
  stubEnv = env;
  server = spawn(process.execPath, [join(APP, "server.mjs"), "--project", project, "--port", String(port), "--files-port", String(filesPort), "--no-prompt"], { env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (c) => output.push(String(c)));
  server.stderr.on("data", (c) => output.push(String(c)));

  const until = Date.now() + 15000;
  for (;;) {
    const log = output.join("");
    if (log.includes(`http://localhost:${port}`) && log.includes(`http://localhost:${filesPort}/files/`)) {
      const snap = JSON.parse((await api("/api/agents")).text);
      if (snap.agents?.some((a) => a.id === "m9-probe" && a.live)) break;
    }
    if (server.exitCode !== null || Date.now() > until) throw new Error(`server did not start:\n${output.join("")}`);
    await new Promise((r) => setTimeout(r, 100));
  }
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise((r) => server.once("exit", r));
    server.kill();
    await exited;
  }
  if (root) await rm(root, { recursive: true, force: true });
});

test("uses its own ports, outside the range of live dashboards", () => {
  for (const p of [port, filesPort]) assert.ok(!RESERVED.has(p), String(p));
});

test("dashboard: a wrong Host gets 421", async () => {
  for (const host of ["evil.example", `evil.example:${port}`, `localhost:${port + 1}`, "localhost"]) {
    const r = await api("/api/config", { host });
    assert.equal(r.status, 421, host);
  }
  // Node itself answers 400 to an HTTP/1.1 request without Host, before the guard runs.
  assert.equal((await api("/api/config", { host: null })).status, 400);
  assert.equal((await api("/api/config", { host: `127.0.0.1:${port}` })).status, 200);
  assert.equal((await api("/api/config")).status, 200);
});

test("dashboard: a wrong Host gets 421 before any action", async () => {
  const r = await api("/api/theme", { method: "POST", host: "evil.example", headers: ok(), body: { confirmed: true, reset: true } });
  assert.equal(r.status, 421);
  assert.deepEqual(JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8")).theme, { name: "keep" });
});

const POSTS = [
  ["/api/theme", { confirmed: true, reset: true }],
  ["/api/crew/onboard", { confirmed: true }],
  ["/api/agents/m9-probe/prompt", { text: "hello", confirmed: true }],
  ["/api/agents/m9-probe/register", { name: "X", confirmed: true }],
  ["/api/agents/m9-probe/keys", { keys: ["enter"], confirmed: true }],
  ["/api/agents/m9-probe/close", { confirmed: true }],
  ["/api/agents/m9-gone/reopen", { confirmed: true }],
  ["/api/widgets/probe/poke", { confirmed: true }],
];

test("dashboard: POST without a matching Origin or without X-Crew gets 403", async () => {
  const cases = {
    "no origin": { "x-crew": "1" },
    "no x-crew": { origin: `http://localhost:${port}` },
    "x-crew not 1": { origin: `http://localhost:${port}`, "x-crew": "true" },
    "foreign origin": { origin: "http://evil.example", "x-crew": "1" },
    "other port": { origin: `http://localhost:${port + 1}`, "x-crew": "1" },
    "https origin": { origin: `https://localhost:${port}`, "x-crew": "1" },
    "null origin": { origin: "null", "x-crew": "1" },
  };
  for (const [path, body] of POSTS) {
    for (const [name, headers] of Object.entries(cases)) {
      const r = await api(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
      assert.equal(r.status, 403, `${path} ${name}`);
    }
  }
  assert.ok(!existsSync(join(project, "poked")));
});

test("dashboard: actions without confirmed: true get 400", async () => {
  const cases = [
    ["/api/theme", { reset: true }],
    ["/api/theme", { reset: true, confirmed: "true" }],
    ["/api/crew/onboard", {}],
    ["/api/agents/m9-probe/register", { name: "X" }],
    ["/api/agents/m9-probe/onboard", {}],
    ["/api/agents/m9-probe/keys", { keys: ["enter"], confirmed: 1 }],
    ["/api/agents/m9-probe/type", { text: "y" }],
    ["/api/widgets/probe/poke", {}],
    ["/api/widgets/probe/poke", { confirmed: "yes" }],
    ["/api/agents/m9-probe/close", {}],
    ["/api/agents/m9-gone/reopen", { confirmed: 1 }],
  ];
  for (const [path, body] of cases) {
    const r = await api(path, { method: "POST", headers: ok(), body });
    assert.equal(r.status, 400, `${path} ${JSON.stringify(body)}`);
    assert.match(r.text, /not confirmed/, path);
  }
  assert.ok(!existsSync(join(project, "poked")));
  assert.deepEqual(JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8")).theme, { name: "keep" });
});

test("dashboard: a bad body gets 400", async () => {
  const r = await api("/api/theme", { method: "POST", headers: ok(), body: "{not json" });
  assert.equal(r.status, 400);
});

test("dashboard: no blocked prompts, keys or text reached herdr", async () => {
  const sent = (await herdrCalls()).filter((a) => ["prompt", "send-keys", "send-text", "focus", "zoom"].includes(a[1]));
  assert.deepEqual(sent, []);
});

const SCREENS = join(APP, "test", "fixtures", "screens");
const prompts = async () => (await herdrCalls()).filter((a) => a[1] === "prompt");

test("dashboard: a prompt waits for the draft in the input box", async () => {
  const send = () => api("/api/agents/m9-probe/prompt", { method: "POST", headers: ok(), body: { text: "hello", confirmed: true } });
  await rm(screenFile, { force: true });
  let r = await send();
  assert.equal(r.status, 409);
  assert.match(r.text, /no input box visible/);
  await copyFile(join(SCREENS, "session-draft.ansi"), screenFile);
  r = await send();
  assert.equal(r.status, 409);
  assert.match(r.text, /draft in the input box/);
  assert.deepEqual(await prompts(), []);
  await copyFile(join(SCREENS, "session-empty.ansi"), screenFile);
  r = await send();
  assert.equal(r.status, 200);
  assert.deepEqual(await prompts(), [["agent", "prompt", "w99:p1", "hello"]]);
});

function cli(...argv) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [join(APP, "server.mjs"), "send", ...argv], { env: stubEnv, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (out += c));
    p.on("exit", (code) => res({ code, out }));
  });
}

test("send: times out on a draft with exit 2, sends to an empty box", async () => {
  const before = (await prompts()).length;
  await copyFile(join(SCREENS, "home-draft2.ansi"), screenFile);
  let r = await cli("m9-probe", "[m3-skill]", "CREW-10: done.", "--timeout", "300", "--interval", "100");
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /not sent: gave up after 0.3 s: m9-probe has a draft in the input box/);
  assert.equal((await prompts()).length, before);
  await copyFile(join(SCREENS, "home-empty.ansi"), screenFile);
  r = await cli("m9-probe", "[m3-skill] CREW-10: done.", "--timeout", "300");
  assert.equal(r.code, 0, r.out);
  assert.deepEqual((await prompts()).at(-1), ["agent", "prompt", "m9-probe", "[m3-skill] CREW-10: done."]);
  assert.equal((await cli("m9-probe")).code, 1);
});

const actionLog = async () => (await readFile(join(project, ".herdr-crew", "actions.log"), "utf8")).trim().split("\n").map((l) => l.split("\t"));

test("dashboard: Go to focuses the pane, raises the terminal app on macOS and is logged", async () => {
  const r = await api("/api/agents/m9-probe/focus", { method: "POST", headers: ok(), body: {} });
  assert.equal(r.status, 200);
  const mac = process.platform === "darwin";
  assert.deepEqual(JSON.parse(r.text), { ok: true, terminalApp: "FakeTerm", raised: mac ? true : null });
  const calls = await herdrCalls();
  assert.deepEqual(calls.filter((a) => a[1] === "focus"), [["agent", "focus", "w99:p1"]]);
  assert.deepEqual(calls.filter((a) => a[0] === "open"), mac ? [["open", "-a", "FakeTerm"]] : []);
  const last = (await actionLog()).at(-1);
  assert.equal(last[1], "m9-probe (Probe, w99:p1)");
  assert.equal(last[2], "focus");
  assert.deepEqual(JSON.parse(last[3]), { ok: true, terminalApp: "FakeTerm", raised: mac ? true : null });
});

test("dashboard: Go to without terminalApp says so in the response and the log", async () => {
  const file = join(project, ".herdr-crew.json");
  const cfg = JSON.parse(await readFile(file, "utf8"));
  delete cfg.terminalApp;
  await writeFile(file, JSON.stringify(cfg));
  let body;
  for (const until = Date.now() + 10000; Date.now() < until; await new Promise((res) => setTimeout(res, 250))) {
    body = JSON.parse((await api("/api/agents/m9-probe/focus", { method: "POST", headers: ok(), body: {} })).text);
    if (body.terminalApp === null) break;
  }
  assert.deepEqual(body, { ok: true, terminalApp: null, raised: null });
  assert.deepEqual(JSON.parse((await actionLog()).at(-1)[3]), { ok: true, terminalApp: null, raised: null });
});

test("dashboard: a confirmed widget action with the right headers runs", async () => {
  const r = await api("/api/widgets/probe/poke", { method: "POST", headers: ok(), body: { confirmed: true } });
  assert.equal(r.status, 202);
  assert.ok(existsSync(join(project, "poked")));
  await unlink(join(project, "poked"));
});

test("dashboard: serves no project files", async () => {
  for (const path of ["/files/links/0-notes.md", "/secret.txt", "/.herdr-crew.json", "/docs/notes.md", "/avatars/../secret.txt"]) {
    assert.equal((await api(path)).status, 404, path);
  }
});

test("links widget: outside files, symlinks out and non-http links are reported and get no URL", async () => {
  const views = JSON.parse((await api("/api/widgets")).text);
  const links = views.find((v) => v.id === "links");
  const by = Object.fromEntries(links.links.map((l) => [l.title, l]));
  assert.equal(by.notes.url, `http://localhost:${filesPort}/files/links/0-notes.md`);
  assert.equal(by.page.url, `http://localhost:${filesPort}/files/links/1-page.html`);
  for (const t of ["outside", "symlink", "script"]) {
    assert.equal(by[t].enabled, false, t);
    assert.equal(by[t].url, "#", t);
  }
  assert.match(links.warning, /outside:/);
  assert.match(links.warning, /symlink:/);
  assert.match(links.warning, /script: only http and https links/);
});

test("files origin: serves configured files only", async () => {
  const md = await files("/files/links/0-notes.md");
  assert.equal(md.status, 200);
  assert.match(md.headers["content-type"], /^text\/html/);
  assert.match(md.headers["content-security-policy"], /default-src 'none'/);
  assert.equal(md.headers["x-content-type-options"], "nosniff");
  assert.match(md.text, /<h1 id="notes">Notes<\/h1>/);
  assert.doesNotMatch(md.text, /<script>/);
  const page = await files("/files/links/1-page.html");
  assert.equal(page.status, 200);
  assert.equal(page.text, "<h1>page</h1>");

  for (const path of [
    "/files/links/2-outside.md", "/files/links/3-link-out.md", "/files/links/9-secret.txt", "/files/links/secret.txt",
    "/files/probe/0-notes.md", "/files/links/..%2Fsecret.txt", "/files/links%2F0-notes.md/x", "/files/links/../../secret.txt",
    "/files/links/0-notes.md/", "/secret.txt", "/.herdr-crew.json", "/api/config", "/",
  ]) {
    assert.equal((await files(path)).status, 404, path);
  }
});

test("files origin: wrong Host 421, writes 405, cross-site fetches 403", async () => {
  assert.equal((await files("/files/links/0-notes.md", { host: `localhost:${port}` })).status, 421);
  assert.equal((await files("/files/links/0-notes.md", { host: "evil.example" })).status, 421);
  for (const method of ["POST", "PUT", "DELETE"]) assert.equal((await files("/files/links/0-notes.md", { method })).status, 405, method);
  assert.equal((await files("/files/links/0-notes.md", { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await files("/files/links/0-notes.md", { headers: { "sec-fetch-site": "same-site" } })).status, 200);
  const head = await files("/files/links/0-notes.md", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.text, "");
});

// Collects SSE frames from /events until stop() is called.
function events() {
  const frames = [];
  let buf = "";
  let req;
  const opened = new Promise((res, rej) => {
    req = request({ host: "127.0.0.1", port, path: "/events", headers: { host: `localhost:${port}` } }, (r) => {
      r.setEncoding("utf8");
      r.on("data", (c) => {
        buf += c;
        let at;
        while ((at = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, at);
          buf = buf.slice(at + 2);
          const event = raw.match(/^event: (.*)$/m)?.[1] ?? "message";
          frames.push({ event, data: JSON.parse(raw.match(/^data: (.*)$/m)[1]), at: Date.now() });
        }
      });
      res();
    });
    req.on("error", rej);
    req.end();
  });
  return { frames, opened, stop: () => req.destroy() };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snapshots = (frames) => frames.filter((f) => f.event === "message");

test("events: an unchanged snapshot is not sent again", async () => {
  const sse = events();
  await sse.opened;
  // At least two fast polls (1 s while a browser watches) with the same Herdr state.
  await sleep(2500);
  sse.stop();
  assert.equal(snapshots(sse.frames).length, 1);
  assert.ok(sse.frames[0].data.agents.some((a) => a.id === "m9-probe" && a.live));
});

test("events: a dashboard action shows up without waiting for the next tick", async () => {
  const sse = events();
  await sse.opened;
  await sleep(200);
  const r = await api("/api/agents/m9-probe/prompt", { method: "POST", headers: ok(), body: { text: "hello snappy" } });
  assert.equal(r.status, 200);
  const until = Date.now() + 3000;
  let frame;
  while (!(frame = snapshots(sse.frames).find((f) => f.data.agents.find((a) => a.id === "m9-probe")?.lastIn?.text === "hello snappy")) && Date.now() < until) await sleep(20);
  sse.stop();
  assert.ok(frame, "no snapshot with the new message");
  assert.equal(frame.data.agents.find((a) => a.id === "m9-probe").lastIn.via, "dashboard");
});

test("files origin: a listed file replaced by a symlink out of the project is refused", async () => {
  const target = join(project, "page.html");
  await unlink(target);
  await symlink(join(root, "outside.md"), target);
  assert.equal((await files("/files/links/1-page.html")).status, 404);
});

test("tasks: JSON output becomes a rendered view", async () => {
  const r = await api("/api/tasks/NEW-1");
  assert.equal(r.status, 200);
  const { id, view, text } = JSON.parse(r.text);
  assert.equal(id, "NEW-1");
  assert.equal(text, undefined);
  assert.equal(view.title, "New <b>task</b>");
  assert.equal(view.status, "In Progress");
  assert.deepEqual(view.dependencies, [{ id: "OLD-1", title: "Old task", status: "Done" }]);
  assert.deepEqual(view.acceptanceCriteria.map((c) => c.checked), [true, false]);
  assert.match(view.sections[0].html, /<strong>bold<\/strong>/);
  assert.doesNotMatch(view.sections[0].html, /<script/);
});

test("tasks: without --json or with an unknown schema the plain text comes back", async () => {
  for (const id of ["OLD-1", "ODD-1"]) {
    const body = JSON.parse((await api(`/api/tasks/${id}`)).text);
    assert.equal(body.view, undefined, id);
    assert.equal(body.text, `Task ${id} - plain\nStatus: Done\n`, id);
  }
});

test("tasks: unknown ids 404, bad ids and other methods 400", async () => {
  assert.equal((await api("/api/tasks/NOPE-1")).status, 404);
  for (const path of ["/api/tasks/not-a-task", "/api/tasks/..%2Fx", "/api/tasks/NEW-1/edit"]) assert.equal((await api(path)).status, 400, path);
  assert.equal((await api("/api/tasks/NEW-1", { method: "POST", headers: ok(), body: { confirmed: true } })).status, 400);
});

const writeConfig = async (patch) => {
  const file = join(project, ".herdr-crew.json");
  await writeFile(file, JSON.stringify({ ...JSON.parse(await readFile(file, "utf8")), ...patch }));
};
const widgetViews = async () => JSON.parse((await api("/api/widgets")).text);
async function until(check, ms = 10000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) if (await check()) return true;
  return false;
}

test("widgets: adding, changing and removing an entry shows up without restart", async () => {
  const cfg = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  const docs = { module: "links", options: { id: "docs", title: "Docs", links: [{ label: "Secret", file: "secret.txt" }] } };
  await writeConfig({ widgets: [...cfg.widgets, docs] });
  assert.ok(await until(async () => (await widgetViews()).some((v) => v.id === "docs")), "docs widget not added");
  assert.equal((await files("/files/docs/0-secret.txt")).text, "not listed");
  assert.ok(JSON.parse((await api("/api/config")).text).widgets.some((w) => w.id === "docs"));

  await writeConfig({ widgets: [...cfg.widgets, { ...docs, options: { ...docs.options, title: "Docs 2" } }] });
  assert.ok(await until(async () => (await widgetViews()).find((v) => v.id === "docs")?.title === "Docs 2"), "docs widget not changed");

  await writeConfig({ widgets: cfg.widgets });
  assert.ok(await until(async () => !(await widgetViews()).some((v) => v.id === "docs")), "docs widget not removed");
  assert.equal((await files("/files/docs/0-secret.txt")).status, 404);
  assert.equal((await files("/files/links/0-notes.md")).status, 200);
});

test("widgets: a panel is removed from the dashboard only after confirmation, and logged", async () => {
  const cfg = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  const extra = { module: "links", options: { id: "extra", title: "Extra", links: [{ label: "Notes", file: "docs/notes.md" }] } };
  await writeConfig({ widgets: [...cfg.widgets, extra] });
  assert.ok(await until(async () => (await widgetViews()).some((v) => v.id === "extra")));

  const confirm = JSON.parse((await api("/api/widgets/extra/remove")).text).confirm;
  assert.match(confirm, /Removes the panel Extra \(extra\) from \.herdr-crew\.json/);
  assert.equal((await api("/api/widgets/extra/remove", { method: "POST", headers: { "content-type": "application/json", "x-crew": "1" }, body: { confirmed: true } })).status, 403);
  assert.equal((await api("/api/widgets/extra/remove", { method: "POST", headers: ok(), body: {} })).status, 400);
  assert.equal((await api("/api/widgets/extra/remove", { method: "GET", host: "evil.example" })).status, 421);
  assert.ok((await widgetViews()).some((v) => v.id === "extra"));

  const r = await api("/api/widgets/extra/remove", { method: "POST", headers: ok(), body: { confirmed: true } });
  assert.equal(r.status, 200);
  assert.ok(!(await widgetViews()).some((v) => v.id === "extra"));
  assert.deepEqual(JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8")).widgets, cfg.widgets);
  assert.equal((await files("/files/extra/0-notes.md")).status, 404);
  const last = (await actionLog()).at(-1);
  assert.deepEqual(last.slice(1, 3), ["widget extra", "remove"]);
  assert.deepEqual(JSON.parse(last[3]), extra);
  assert.equal((await api("/api/widgets/extra/remove", { method: "POST", headers: ok(), body: { confirmed: true } })).status, 404);
});

test("widgets: inherited property names are no actions", async () => {
  for (const action of ["constructor", "tostring"]) {
    assert.equal((await api(`/api/widgets/probe/${action}`)).status, 405, action);
    assert.equal((await api(`/api/widgets/probe/${action}`, { method: "POST", headers: ok(), body: { confirmed: true } })).status, 404, action);
  }
});

test("widgets: backlog and markdown panels render from the config", async () => {
  const cfg = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  await writeConfig({ widgets: [...cfg.widgets,
    { module: "backlog", options: { id: "open", title: "Open", filters: { status: ["In Progress", "To Do"] } } },
    { module: "markdown", options: { id: "goals", file: "PLAN.md", section: "Goals" } },
    { module: "markdown", options: { id: "escape", file: "../outside.md" } },
  ] });
  let views;
  assert.ok(await until(async () => (views = await widgetViews()).some((v) => v.id === "goals") && views.find((v) => v.id === "open")?.groups?.length));
  const open = views.find((v) => v.id === "open");
  assert.deepEqual(open.groups.map((g) => [g.title, g.tasks.map((t) => t.id)]), [["In Progress", ["CREW-1"]], ["To Do", ["CREW-2"]]]);
  assert.equal(open.groups[0].tasks[0].title, "First <b>one</b>");
  const goals = views.find((v) => v.id === "goals");
  assert.match(goals.html, /<h2 id="goals">Goals<\/h2>/);
  assert.match(goals.html, /&lt;script&gt;/);
  assert.doesNotMatch(goals.html, /<script|Not shown/);
  assert.equal(goals.links[0].url, `http://localhost:${filesPort}/files/goals/file`);
  assert.equal((await files("/files/goals/file")).status, 200);
  const escape = views.find((v) => v.id === "escape");
  assert.equal(escape.html, undefined);
  assert.match(escape.error, /file must be a path inside the project/);

  await writeFile(join(project, "PLAN.md"), "# Plan\n\n## Goals\n\nChanged.\n");
  assert.ok(await until(async () => /Changed\./.test((await widgetViews()).find((v) => v.id === "goals").html)), "markdown not refreshed");
  await writeConfig({ widgets: cfg.widgets });
});

function crewCli(...argv) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [join(APP, "server.mjs"), ...argv], { env: stubEnv, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (out += c));
    p.on("exit", (code) => res({ code, out }));
  });
}

test("widget CLI: add validates and writes, the running dashboard shows it, remove takes it out", async () => {
  const before = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8")).widgets;
  for (const [json, why] of [
    ["{not json", /--json is not valid JSON/],
    ['{"module":"./probe-widget.mjs"}', /module must be one of backlog, markdown, links, dev-server/],
    ['{"module":"markdown","options":{"file":"../outside.md"}}', /inside the project/],
    ['{"module":"links","options":{"links":[{"label":"x","file":"page.html"}]}}', /id links already exists/],
  ]) {
    const r = await crewCli("widget", "add", "--project", project, "--json", json);
    assert.equal(r.code, 1, json);
    assert.match(r.out, why, json);
  }
  assert.deepEqual(JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8")).widgets, before);

  let r = await crewCli("widget", "add", "--project", project, "--json", '{"module":"markdown","options":{"id":"notes","title":"Notes","file":"docs/notes.md"}}');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Added panel notes/);
  assert.ok(await until(async () => (await widgetViews()).find((v) => v.id === "notes")?.html?.includes("Notes")), "panel not shown");
  r = await crewCli("widget", "list", "--project", project);
  assert.match(r.out, /^notes\tmarkdown\tNotes$/m);

  r = await crewCli("widget", "remove", "notes", "--project", project);
  assert.equal(r.code, 0, r.out);
  assert.equal((await crewCli("widget", "remove", "notes", "--project", project)).code, 1);
  assert.deepEqual(JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8")).widgets, before);
  assert.ok(await until(async () => !(await widgetViews()).some((v) => v.id === "notes")), "panel not removed");
  assert.equal((await crewCli("widget", "add", "--project", join(root, "nowhere"), "--json", "{}")).code, 1);
});

test("panel request: guards, no lead, then a quoted message through the draft guard to the lead", async () => {
  const post = (body, headers = ok()) => api("/api/panels/request", { method: "POST", headers, body });
  let info = JSON.parse((await api("/api/panels/request")).text);
  assert.deepEqual({ lead: info.lead, live: info.live, text: info.text }, { lead: null, live: false, text: null });
  assert.equal((await post({ confirmed: true, prompt: "x" }, { "content-type": "application/json", origin: `http://localhost:${port}` })).status, 403);
  assert.equal((await post({ prompt: "x" })).status, 400);
  assert.equal((await post({ confirmed: true, prompt: " \u0007 " })).status, 400);
  assert.equal((await post({ confirmed: true, prompt: "x".repeat(501) })).status, 400);
  let r = await post({ confirmed: true, prompt: "a backlog overview" });
  assert.equal(r.status, 409);
  assert.match(r.text, /no lead persona/);

  const cfg = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  await writeConfig({ personas: cfg.personas.map((p) => ({ ...p, lead: true })) });
  assert.ok(await until(async () => JSON.parse((await api("/api/panels/request")).text).live));
  info = JSON.parse((await api(`/api/panels/request?prompt=${encodeURIComponent("a backlog overview; rm -rf /")}`)).text);
  assert.equal(info.lead, "m9-probe");
  assert.match(info.text, /^From the crew dashboard: the user asks for a new panel/);
  assert.match(info.text, /\n> a backlog overview; rm -rf \/\n/);

  await copyFile(join(SCREENS, "session-draft.ansi"), screenFile);
  const sent = (await prompts()).length;
  r = await post({ confirmed: true, prompt: "a backlog overview; rm -rf /" });
  assert.equal(r.status, 409);
  assert.match(r.text, /draft in the input box/);
  assert.equal((await prompts()).length, sent);
  await copyFile(join(SCREENS, "session-empty.ansi"), screenFile);
  r = await post({ confirmed: true, prompt: "a backlog overview; rm -rf /" });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual((await prompts()).at(-1), ["agent", "prompt", "w99:p1", info.text]);
  const last = (await actionLog()).at(-1);
  assert.deepEqual(last.slice(1, 3), ["m9-probe (Probe, w99:p1)", "panel request"]);
  await writeConfig({ personas: cfg.personas });
});

const herdrState = (s) => writeFile(join(root, "herdr-state.json"), JSON.stringify(s));
const closeCalls = async () => (await herdrCalls()).filter((a) => a[0] === "tab" && a[1] === "close");

test("close: refused while working or with more panes, then closes the tab and stores the session", async () => {
  assert.ok(await until(async () => !JSON.parse((await api("/api/agents")).text).agents.find((a) => a.id === "m9-probe")?.lead));
  const cfg = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  const close = () => api("/api/agents/m9-probe/close", { method: "POST", headers: ok(), body: { confirmed: true } });
  const before = (await closeCalls()).length;
  await herdrState({ status: "working" });
  let r = await close();
  assert.equal(r.status, 409);
  assert.match(r.text, /working; only idle or done/);
  await herdrState({ panes: 2 });
  r = await close();
  assert.equal(r.status, 409);
  assert.match(r.text, /has 2 panes/);
  assert.equal((await closeCalls()).length, before);

  await herdrState({});
  r = await close();
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(JSON.parse(r.text), { ok: true, stored: true });
  assert.deepEqual((await closeCalls()).at(-1), ["tab", "close", "w99:t1"]);
  const probe = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8")).personas.find((p) => p.agent === "m9-probe");
  assert.equal(probe.session, "ses_probe123");
  assert.equal(probe.cwd, project);
  const last = (await actionLog()).at(-1);
  assert.deepEqual(last.slice(1, 3), ["m9-probe (Probe, w99:p1)", "close"]);
  assert.equal(JSON.parse(last[3]).session, "ses_probe123");
  await writeConfig({ personas: cfg.personas });
});

test("close: the lead persona has no close", async () => {
  const cfg = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  await writeConfig({ personas: cfg.personas.map((p) => ({ ...p, lead: true })) });
  assert.ok(await until(async () => JSON.parse((await api("/api/agents")).text).agents.find((a) => a.id === "m9-probe")?.lead));
  const r = await api("/api/agents/m9-probe/close", { method: "POST", headers: ok(), body: { confirmed: true } });
  assert.equal(r.status, 409);
  assert.match(r.text, /lead persona/);
  await writeConfig({ personas: cfg.personas });
});

test("reopen: refused for a live agent, then starts the stored session in a new tab", async () => {
  const cfg = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  const reopen = (id) => api(`/api/agents/${id}/reopen`, { method: "POST", headers: ok(), body: { confirmed: true } });
  let r = await reopen("m9-probe");
  assert.equal(r.status, 409);
  assert.match(r.text, /the agent is live/);

  await writeConfig({ personas: [...cfg.personas,
    { agent: "m9-gone", name: "Gone", pronouns: "it", role: "test", tasks: [], session: "ses_gone1", cwd: join(project, "docs") },
    { agent: "m9-nosess", name: "None", pronouns: "it", role: "test", tasks: [] },
  ] });
  let snap;
  assert.ok(await until(async () => (snap = JSON.parse((await api("/api/agents")).text)).agents.some((a) => a.id === "m9-nosess")));
  assert.equal(snap.agents.find((a) => a.id === "m9-gone").canReopen, true);
  assert.equal(snap.agents.find((a) => a.id === "m9-nosess").canReopen, false);
  r = await reopen("m9-nosess");
  assert.equal(r.status, 409);
  assert.match(r.text, /no OpenCode session stored/);

  await herdrState({ extraAgents: [{ name: "m9-gone", pane_id: "w5:p1", workspace_id: "w5" }] });
  assert.ok(await until(async () => JSON.parse((await api("/api/agents")).text).agents.find((a) => a.id === "m9-gone").live));
  const calls = (await herdrCalls()).length;
  r = await reopen("m9-gone");
  assert.equal(r.status, 409);
  assert.match(r.text, /the agent is live/);
  assert.ok(!(await herdrCalls()).slice(calls).some((a) => a[0] === "tab" && a[1] === "create"));
  await herdrState({});
  assert.ok(await until(async () => !JSON.parse((await api("/api/agents")).text).agents.find((a) => a.id === "m9-gone").live));

  const from = (await herdrCalls()).length;
  r = await reopen("m9-gone");
  assert.equal(r.status, 200, r.text);
  const seq = (await herdrCalls()).slice(from).filter((a) => ["create", "start"].includes(a[1]));
  assert.deepEqual(seq, [
    ["tab", "create", "--workspace", "w99", "--cwd", join(project, "docs"), "--label", "m9-gone (Gone, it)", "--no-focus"],
    ["agent", "start", "m9-gone", "--kind", "opencode", "--pane", "w99:p9", "--timeout", "60000", "--", "--session", "ses_gone1"],
  ]);
  const last = (await actionLog()).at(-1);
  assert.deepEqual(last.slice(1, 3), ["m9-gone", "reopen"]);

  await herdrState({ startFail: true });
  r = await reopen("m9-gone");
  assert.equal(r.status, 502, r.text);
  assert.deepEqual((await closeCalls()).at(-1), ["tab", "close", "w99:t9"]);
  await herdrState({});
  await writeConfig({ personas: cfg.personas });
});

test("agents: Zoom and Screen are gone, the Answer dialog still reads the screen", async () => {
  for (const action of ["zoom", "screen", "nope"]) {
    const r = await api(`/api/agents/m9-probe/${action}`, { method: "POST", headers: ok(), body: { confirmed: true } });
    assert.equal(r.status, 404, action);
  }
  assert.deepEqual((await herdrCalls()).filter((a) => a[0] === "pane" && a[1] === "zoom"), []);
  await writeFile(screenFile, "line one\nline two\n");
  const r = await api("/api/agents/m9-probe/screen");
  assert.equal(r.status, 200);
  assert.match(JSON.parse(r.text).text, /line two/);
  const page = (await api("/")).text;
  assert.doesNotMatch(page, /data-act="zoom"|data-act="screen"|openScreens|⤢ Zoom|▤ Scherm|▤ Screen/);
  assert.match(page, /api\/agents\/\$\{encodeURIComponent\(a\.id\)\}\/screen/);
});

test("language: the page gets the locale; the picker writes language after confirmation and keeps the bubble language", async () => {
  let c = JSON.parse((await api("/api/config")).text);
  assert.equal(c.language, "en");
  assert.equal(c.locale["ui.cancel"], "Cancel");
  assert.deepEqual(c.languages.map((l) => l.code), ["en", "nl"]);
  const post = (body, headers = ok()) => api("/api/language", { method: "POST", headers, body });
  assert.equal((await post({ language: "nl" }, { "content-type": "application/json", "x-crew": "1" })).status, 403);
  assert.equal((await post({ language: "nl" })).status, 400);
  assert.match((await post({ confirmed: true, language: "xx" })).text, /unknown language/);
  const r = await post({ confirmed: true, language: "nl" });
  assert.equal(r.status, 200, r.text);
  const raw = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  assert.equal(raw.language, "nl");
  assert.equal(raw.bubbleLanguage, "en");
  c = JSON.parse((await api("/api/config")).text);
  assert.equal(c.language, "nl");
  assert.equal(c.locale["ui.cancel"], "Annuleren");
  assert.deepEqual((await actionLog()).at(-1).slice(1, 3), ["language", "set"]);
  assert.ok(await until(async () => (await widgetViews()).find((v) => v.id === "links")?.title === "Links"));

  await writeConfig({ language: "zz" });
  assert.ok(await until(async () => JSON.parse((await api("/api/config")).text).languageSetting === "zz"));
  c = JSON.parse((await api("/api/config")).text);
  assert.equal(c.language, "en");
  assert.equal(c.locale["ui.cancel"], "Cancel");
  const { language, bubbleLanguage, ...rest } = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  await writeFile(join(project, ".herdr-crew.json"), JSON.stringify(rest));
});

test("theme: a saved theme only reaches the page with flavour texts", async () => {
  await writeConfig({ theme: { name: "keep", colors: { bg: "#000", ink: "#fff", panel: "#111" }, labels: { working: "busy", serverCheck: "x" }, texts: { "ui.serverCheck": "nothing" } } });
  let c;
  assert.ok(await until(async () => (c = JSON.parse((await api("/api/config")).text)).theme?.labels?.working === "busy"));
  assert.deepEqual(c.theme.labels, { working: "busy" });
  assert.equal(c.theme.texts, undefined);
  await writeConfig({ theme: { name: "keep" } });
});

test("languages: locale add makes a new language selectable without restart, the request goes to the lead", async () => {
  const en = JSON.parse(await readFile(join(APP, "locales", "en.json"), "utf8"));
  const file = join(root, "de.json");
  await writeFile(file, JSON.stringify({ ...en, "meta.name": "Deutsch", "meta.englishName": "German", "ui.cancel": "Abbrechen" }));
  let r = await crewCli("locale", "check", file);
  assert.equal(r.code, 0, r.out);
  await writeFile(join(root, "bad.json"), JSON.stringify({ ...en, "ui.min": "x" }));
  r = await crewCli("locale", "check", join(root, "bad.json"));
  assert.equal(r.code, 1);
  assert.match(r.out, /ui\.min must have the placeholders \{n\}, has none/);
  assert.equal((await crewCli("locale", "add", "de", "--file", join(root, "bad.json"), "--project", project)).code, 1);
  assert.equal((await crewCli("locale", "add", "en", "--file", file, "--project", project)).code, 1);
  r = await crewCli("locale", "add", "de", "--file", file, "--project", project);
  assert.equal(r.code, 0, r.out);
  assert.match((await crewCli("locale", "list", "--project", project)).out, /^de\tDeutsch\tGerman\t/m);

  const langs = JSON.parse((await api("/api/config")).text).languages;
  assert.deepEqual(langs.find((l) => l.code === "de"), { code: "de", name: "Deutsch", englishName: "German", project: true });
  assert.equal((await api("/api/language", { method: "POST", headers: ok(), body: { confirmed: true, language: "de" } })).status, 200);
  assert.equal(JSON.parse((await api("/api/config")).text).locale["ui.cancel"], "Abbrechen");

  const post = (body) => api("/api/languages/request", { method: "POST", headers: ok(), body });
  assert.equal((await api("/api/languages/request", { method: "POST", headers: { "content-type": "application/json" }, body: { confirmed: true, name: "Frans" } })).status, 403);
  assert.equal((await post({ name: "Frans" })).status, 400);
  assert.equal((await post({ confirmed: true, name: "x".repeat(61) })).status, 400);
  assert.match((await post({ confirmed: true, name: "Frans" })).text, /no lead persona/);
  const cfg = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  await writeConfig({ personas: cfg.personas.map((p) => ({ ...p, lead: true })) });
  assert.ok(await until(async () => JSON.parse((await api("/api/languages/request")).text).live));
  const preview = JSON.parse((await api(`/api/languages/request?name=${encodeURIComponent("Frans")}`)).text).text;
  assert.match(preview, /\n> Frans\n/);
  assert.match(preview, /locale add <code> --file .*locale-draft\.json --project /);
  await copyFile(join(SCREENS, "session-empty.ansi"), screenFile);
  r = await post({ confirmed: true, name: "Frans" });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual((await prompts()).at(-1), ["agent", "prompt", "w99:p1", preview]);
  assert.deepEqual((await actionLog()).at(-1).slice(2, 3), ["language request"]);
  const { language, bubbleLanguage, ...rest } = JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8"));
  await writeFile(join(project, ".herdr-crew.json"), JSON.stringify({ ...rest, personas: cfg.personas }));
});

test("other projects: agents outside the project are shown with only Go to, own unregistered agents can be closed", async () => {
  await mkdir(join(root, "other"), { recursive: true });
  await herdrState({ extraAgents: [
    { name: "x-other", pane_id: "w99:p7", tab_id: "w99:t7", workspace_id: "w99", agent: "opencode", agent_status: "idle", cwd: join(root, "other"), agent_session: { value: "ses_other1" } },
    { name: "x-own", pane_id: "w99:p8", tab_id: "w99:t8", workspace_id: "w99", agent: "opencode", agent_status: "idle", cwd: join(project, "docs"), agent_session: { value: "ses_own1" } },
  ] });
  let snap;
  assert.ok(await until(async () => (snap = JSON.parse((await api("/api/agents")).text)).agents.some((a) => a.id === "x-own")));
  const other = snap.agents.find((a) => a.id === "x-other");
  const own = snap.agents.find((a) => a.id === "x-own");
  assert.deepEqual([other.otherProject, other.canClose, other.isNew], [true, false, false]);
  assert.deepEqual([own.otherProject, own.canClose, own.isNew], [false, true, true]);
  assert.ok(await until(async () => JSON.parse((await api("/api/agents")).text).agents.find((a) => a.id === "m9-probe").canClose));

  const post = (id, action, body = { confirmed: true }) => api(`/api/agents/${id}/${action}`, { method: "POST", headers: ok(), body });
  const before = (await closeCalls()).length;
  for (const [action, body] of [["close", { confirmed: true }], ["prompt", { text: "hi" }], ["register", { confirmed: true, name: "X" }], ["onboard", { confirmed: true }]]) {
    const r = await post("x-other", action, body);
    assert.equal(r.status, 409, action);
    assert.match(r.text, /another project/, action);
  }
  assert.equal((await post("x-other", "focus", {})).status, 200);
  assert.equal((await closeCalls()).length, before);
  assert.ok(!JSON.parse(await readFile(join(project, ".herdr-crew.json"), "utf8")).personas.some((p) => p.agent === "x-other"));

  const r = await post("x-own", "close");
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(JSON.parse(r.text), { ok: true, stored: false });
  assert.deepEqual((await closeCalls()).at(-1), ["tab", "close", "w99:t8"]);
  await herdrState({});
});
