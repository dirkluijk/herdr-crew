// The non interactive init flags and serve --open used by the New crew flow. Everything runs in a temporary
// project with stub binaries on PATH, on ports outside 5190 to 5193.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod, copyFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { firstFreePort, portFree, leadPersona, defaultPrefixes, buildConfig } from "../lib/init.mjs";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
let root, bin, log;

before(async () => {
  root = realpathSync(await mkdtemp(join(tmpdir(), "herdr-crew-new-")));
  bin = join(root, "bin");
  log = join(root, "calls.log");
  await mkdir(bin);
  for (const f of ["herdr", "backlog", "opencode"]) await copyFile(join(APP, "test", "fixtures", "bin", f), join(bin, f));
  for (const f of ["open", "xdg-open"]) {
    await writeFile(join(bin, f), `#!${process.execPath}\nimport { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(log)}, JSON.stringify([${JSON.stringify(f)}, ...process.argv.slice(2)]) + "\\n");\n`);
  }
  for (const f of ["herdr", "backlog", "opencode", "open", "xdg-open"]) await chmod(join(bin, f), 0o755);
  await writeFile(join(bin, "package.json"), JSON.stringify({ type: "module" }));
});
after(() => rm(root, { recursive: true, force: true }));

const env = () => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(ANTHROPIC|OPENAI|HERDR)_|^PORT$/.test(k))),
  PATH: [bin, process.env.PATH].join(delimiter), HERDR_CREW_TEST_LOG: log,
});

function cli(argv) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [join(APP, "server.mjs"), ...argv], { env: env(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (err += c));
    p.on("close", (code) => res({ code, out, err }));
  });
}

async function project(name) {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  return dir;
}

test("firstFreePort takes the first pair where both ports are free", async () => {
  const busy = new Set([5190, 5193, 5195]);
  const isFree = async (p) => !busy.has(p);
  assert.equal(await firstFreePort({ isFree }), 5196);
  assert.equal(await firstFreePort({ isFree: async () => true }), 5190);
  assert.equal(await firstFreePort({ isFree: async () => false, tries: 3 }), null);
});

test("portFree sees a port in use", async () => {
  const s = createServer().listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const { port } = s.address();
  assert.equal(await portFree(port), false);
  await new Promise((r) => s.close(r));
  assert.equal(await portFree(port), true);
});

test("leadPersona: prefixes follow the language, names are checked", () => {
  assert.deepEqual(defaultPrefixes("Vera", "nl"), ["Vera hier.", "Vera here."]);
  assert.deepEqual(defaultPrefixes("Vera", "en"), ["Vera here."]);
  assert.deepEqual(leadPersona({ agent: "shop-orch", name: "Vera", pronouns: "she/her", language: "en" }), {
    agent: "shop-orch", name: "Vera", pronouns: "she/her", role: "orchestrator", tasks: [], lead: true, messagePrefixes: ["Vera here."],
  });
  assert.deepEqual(leadPersona({ agent: "o", name: "Vera", prefixes: ["Vera:"] }).messagePrefixes, ["Vera:"]);
  assert.throws(() => leadPersona({ agent: "Shop Orch", name: "Vera" }), /orchestrator name/);
});

test("buildConfig: the lead from the flags replaces the lead from the plan and comes first", async () => {
  const dir = await project("plan-lead");
  await writeFile(join(dir, "PLAN.md"), "The orchestrator is `old-orch`, persona Olga (she/her).\n\n- Work: `m1-work` (Wim, he/him).\n");
  const cfg = await buildConfig({ project: dir, plan: join(dir, "PLAN.md"), lead: leadPersona({ agent: "new-orch", name: "Vera", language: "en" }) });
  assert.deepEqual(cfg.personas.map((p) => [p.agent, !!p.lead]), [["new-orch", true], ["old-orch", false], ["m1-work", false]]);
});

test("init with the New crew flags writes a complete config without asking", async () => {
  const dir = await project("flags");
  const r = await cli([
    "init", "--project", dir, "--orchestrator", "test-orch", "--persona-name", "Vera", "--pronouns", "she/her",
    "--language", "en", "--bubble-language", "nl", "--theme", "default", "--port", "auto", "--avatars", "art", "--title", "Shop",
  ]);
  assert.equal(r.code, 0, r.err);
  const cfg = JSON.parse(await readFile(join(dir, ".herdr-crew.json"), "utf8"));
  assert.equal(cfg.title, "Shop");
  assert.equal(cfg.language, "en");
  assert.equal(cfg.bubbleLanguage, "nl");
  assert.equal(cfg.themeAsked, true);
  assert.equal(cfg.theme, null);
  assert.equal(cfg.avatarDir, "art");
  assert.ok(existsSync(join(dir, "art")));
  assert.ok(cfg.port >= 5190 && cfg.port % 2 === 0);
  assert.deepEqual(cfg.personas, [{ agent: "test-orch", name: "Vera", pronouns: "she/her", role: "orchestrator", tasks: [], lead: true, messagePrefixes: ["Vera hier.", "Vera here."] }]);
  assert.match(r.out, new RegExp(`dashboard URL http://localhost:${cfg.port}`));
  assert.match(r.out, /add \.herdr-crew\/ to \.gitignore/);
  // A new crew does not read live tab labels: the workspace may belong to another project.
  const calls = existsSync(log) ? await readFile(log, "utf8") : "";
  assert.ok(!calls.includes('"tab","list"'));
});

test("init refuses a bad orchestrator name, a bad port and a missing value", async () => {
  const dir = await project("bad");
  assert.match((await cli(["init", "--project", dir, "--orchestrator", "Bad Name"])).err, /orchestrator name/);
  assert.match((await cli(["init", "--project", dir, "--port", "80"])).err, /--port must be/);
  assert.match((await cli(["init", "--project", dir, "--orchestrator"])).err, /--orchestrator needs a value/);
  assert.ok(!existsSync(join(dir, ".herdr-crew.json")));
});

test("init --theme without model credentials keeps the default theme, and no gitignore tip when ignored", async () => {
  const dir = await project("theme");
  await writeFile(join(dir, ".gitignore"), "node_modules/\n.herdr-crew/\n");
  const r = await cli(["init", "--project", dir, "--theme", "a cosy bakery", "--port", "6123"]);
  assert.equal(r.code, 0, r.err);
  assert.match(r.err, /No model credentials/);
  assert.doesNotMatch(r.out, /gitignore/);
  const cfg = JSON.parse(await readFile(join(dir, ".herdr-crew.json"), "utf8"));
  assert.equal(cfg.port, 6123);
  assert.equal(cfg.themeAsked, true);
});

test("serve --no-prompt --open opens the dashboard URL once it listens", async () => {
  const dir = await project("serve");
  await writeFile(join(dir, ".herdr-crew.json"), JSON.stringify({ title: "serve-test", themeAsked: true, backlog: false, personas: [] }));
  let port;
  do port = await firstFreePort({ start: 20000 + Math.floor(Math.random() * 20000) }); while (port === null);
  const p = spawn(process.execPath, [join(APP, "server.mjs"), "--project", dir, "--port", String(port), "--no-prompt", "--open"], { env: env(), stdio: ["pipe", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (c) => (out += c));
  try {
    const url = `http://localhost:${port}`;
    for (let i = 0; i < 100; i++) {
      const calls = existsSync(log) ? await readFile(log, "utf8") : "";
      if (calls.includes(url)) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const opened = (await readFile(log, "utf8")).trim().split("\n").map((l) => JSON.parse(l)).filter((c) => c[0] === "open" || c[0] === "xdg-open");
    assert.deepEqual(opened, [[process.platform === "darwin" ? "open" : "xdg-open", url]]);
    assert.match(out, new RegExp(`on ${url}`));
    assert.doesNotMatch(out, /theme/i, "no theme question in the pane");
  } finally {
    p.kill();
  }
});
