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
    HERDR_CREW_TEST_LOG: herdrLog, HERDR_CREW_TEST_PROJECT: project, HERDR_CREW_TEST_SCREEN: screenFile,
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
