// install, uninstall and doctor only ever see a temporary OpenCode config dir and stub binaries; HOME and
// XDG_CONFIG_HOME point into the temp dir as well, so a mistake cannot reach the real config.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readlink, rm, symlink, lstat, chmod, readdir } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { opencodeConfigDir, installPlan, uninstallPlan, BACKUP_DIR } from "../lib/install.mjs";
import { doctor, formatDoctor } from "../lib/doctor.mjs";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
let root;

before(async () => { root = realpathSync(await mkdtemp(join(tmpdir(), "herdr-crew-install-"))); });
after(() => rm(root, { recursive: true, force: true }));

async function freshDir(name) {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  return dir;
}

function cli(argv, { dir, bin = null, env = {} } = {}) {
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(ANTHROPIC|OPENAI|HERDR|OPENCODE|XDG)_/.test(k)));
  return new Promise((res) => {
    const p = spawn(process.execPath, [join(APP, "server.mjs"), ...argv], {
      env: { ...base, HOME: join(root, "home"), XDG_CONFIG_HOME: join(root, "xdg"), OPENCODE_CONFIG_DIR: dir, ...(bin ? { PATH: bin } : {}), ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (err += c));
    p.on("close", (code) => res({ code, out, err }));
  });
}

const linkOf = async (p) => ((await lstat(p)).isSymbolicLink() ? readlink(p) : null);

test("opencodeConfigDir: OPENCODE_CONFIG_DIR, then XDG_CONFIG_HOME, then ~/.config", () => {
  assert.equal(opencodeConfigDir({ OPENCODE_CONFIG_DIR: "/a/oc", XDG_CONFIG_HOME: "/x" }, "/h"), "/a/oc");
  assert.equal(opencodeConfigDir({ XDG_CONFIG_HOME: "/x" }, "/h"), "/x/opencode");
  assert.equal(opencodeConfigDir({}, "/h"), "/h/.config/opencode");
});

test("the plan covers both skills and the shipped commands", async () => {
  const plan = await installPlan({ app: APP, dir: join(root, "nothing") });
  const rels = plan.map((p) => p.rel);
  for (const r of ["skills/herdr-crew", "skills/herdr-orchestrator", "commands/orchestrate.md"]) assert.ok(rels.includes(r), r);
  assert.ok(plan.every((p) => p.state === "create"));
});

test("install shows the plan and changes nothing without a confirmation", async () => {
  const dir = await freshDir("unconfirmed");
  const r = await cli(["install"], { dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /create\s+skills\/herdr-orchestrator -> /);
  assert.match(r.err, /--yes/);
  assert.deepEqual(await readdir(dir), []);
  const dry = await cli(["install", "--dry-run", "--yes"], { dir });
  assert.equal(dry.code, 0);
  assert.deepEqual(await readdir(dir), []);
});

test("install --yes links into OPENCODE_CONFIG_DIR and is idempotent", async () => {
  const dir = await freshDir("fresh");
  const r = await cli(["install", "--yes"], { dir });
  assert.equal(r.code, 0, r.err);
  assert.equal(await linkOf(join(dir, "skills", "herdr-crew")), join(APP, "skills", "herdr-crew"));
  assert.equal(await linkOf(join(dir, "skills", "herdr-orchestrator")), join(APP, "skills", "herdr-orchestrator"));
  assert.equal(await linkOf(join(dir, "commands", "orchestrate.md")), join(APP, "commands", "orchestrate.md"));
  assert.ok(!existsSync(join(root, "home", ".config")) && !existsSync(join(root, "xdg")));
  const again = await cli(["install", "--yes"], { dir });
  assert.equal(again.code, 0);
  assert.match(again.out, /Nothing to do/);
});

test("--config-dir wins over OPENCODE_CONFIG_DIR", async () => {
  const dir = await freshDir("flag");
  const env = await freshDir("env-unused");
  assert.equal((await cli(["install", "--yes", "--config-dir", dir], { dir: env })).code, 0);
  assert.ok(existsSync(join(dir, "skills", "herdr-crew", "SKILL.md")));
  assert.deepEqual(await readdir(env), []);
});

test("install never replaces a real file or another link without --force", async () => {
  const dir = await freshDir("taken");
  await mkdir(join(dir, "skills", "herdr-orchestrator"), { recursive: true });
  await writeFile(join(dir, "skills", "herdr-orchestrator", "SKILL.md"), "my own copy");
  await mkdir(join(dir, "commands"));
  await symlink(join(root, "elsewhere.md"), join(dir, "commands", "orchestrate.md"));
  const r = await cli(["install", "--yes"], { dir });
  assert.equal(r.code, 1);
  assert.match(r.out, /exists\s+skills\/herdr-orchestrator is a real directory; not replaced/);
  assert.match(r.out, /other link\s+commands\/orchestrate.md is a link to /);
  assert.match(r.err, /Nothing changed/);
  assert.ok(!existsSync(join(dir, "skills", "herdr-crew")), "no partial install");
  assert.equal(await readFile(join(dir, "skills", "herdr-orchestrator", "SKILL.md"), "utf8"), "my own copy");

  const forced = await cli(["install", "--yes", "--force"], { dir });
  assert.equal(forced.code, 0, forced.err);
  assert.equal(await linkOf(join(dir, "skills", "herdr-orchestrator")), join(APP, "skills", "herdr-orchestrator"));
  assert.equal(await linkOf(join(dir, "commands", "orchestrate.md")), join(APP, "commands", "orchestrate.md"));
  // The backup sits outside skills/ and commands/, so OpenCode does not load it as a second skill or command.
  const [stamp] = await readdir(join(dir, BACKUP_DIR));
  assert.equal(await readFile(join(dir, BACKUP_DIR, stamp, "skills", "herdr-orchestrator", "SKILL.md"), "utf8"), "my own copy");
  assert.equal(await linkOf(join(dir, BACKUP_DIR, stamp, "commands", "orchestrate.md")), join(root, "elsewhere.md"));
  assert.deepEqual((await readdir(join(dir, "skills"))).sort(), ["herdr-crew", "herdr-orchestrator"]);
});

test("uninstall removes only links into this checkout", async () => {
  const dir = await freshDir("uninstall");
  assert.equal((await cli(["install", "--yes"], { dir })).code, 0);
  await symlink(join(root, "other-skill"), join(dir, "skills", "other"));
  await writeFile(join(dir, "commands", "mine.md"), "keep");
  await symlink(join(APP, "commands", "gone.md"), join(dir, "commands", "gone.md"));
  assert.equal((await uninstallPlan({ app: APP, dir })).length, 4);

  const unconfirmed = await cli(["uninstall"], { dir });
  assert.equal(unconfirmed.code, 1);
  assert.ok(existsSync(join(dir, "commands", "orchestrate.md")));

  const r = await cli(["uninstall", "--yes"], { dir });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(await readdir(join(dir, "skills")), ["other"]);
  assert.deepEqual(await readdir(join(dir, "commands")), ["mine.md"]);
  const again = await cli(["uninstall", "--yes"], { dir });
  assert.match(again.out, /Nothing to remove/);
});

const runner = (answers) => async (cmd, args) => {
  const a = answers[[cmd, ...args].join(" ")];
  return a === undefined ? { ok: false, stdout: "", stderr: "" } : { ok: true, stdout: a, stderr: "" };
};

test("doctor: everything present and linked", async () => {
  const dir = await freshDir("doctor-ok");
  assert.equal((await cli(["install", "--yes"], { dir })).code, 0);
  const items = await doctor({
    app: APP, dir, node: "22.3.0", env: { HERDR_ENV: "1" }, credentials: { model: true, image: true },
    run: runner({
      "herdr --version": "herdr 0.9.5\n", "herdr agent read --help": "--source\n--format <FORMAT>", "herdr pane report-metadata --help": "--token <K=V>",
      "opencode --version": "2.2.5\n", "backlog --version": "1.53.0\n", "backlog task list --help": "--json\n--watch",
    }),
  });
  assert.deepEqual(items.filter((i) => i.status !== "ok"), []);
  assert.ok(items.find((i) => i.name === "Herdr").detail === "0.9.5");
});

test("doctor: old or missing tools give warnings and missing items with hints", async () => {
  const dir = await freshDir("doctor-bad");
  const items = await doctor({
    app: APP, dir, node: "20.11.0", env: {}, credentials: {},
    run: runner({ "herdr --version": "herdr 0.4.0", "herdr agent read --help": "--source", "herdr pane report-metadata --help": "--source", "backlog --version": "1.2.0", "backlog task list --help": "--plain --json" }),
  });
  const by = Object.fromEntries(items.map((i) => [i.name, i]));
  assert.equal(by.Node.status, "missing");
  assert.equal(by["Herdr agent read --format ansi"].status, "warning");
  assert.equal(by["Herdr pane report-metadata --token"].status, "warning");
  assert.equal(by["Inside Herdr"].status, "warning");
  assert.equal(by.OpenCode.status, "warning");
  assert.match(by["Backlog.md"].detail, /no task list --watch/);
  assert.equal(by["Link skills/herdr-crew"].status, "missing");
  assert.match(by["Link skills/herdr-crew"].hint, /install/);
  assert.ok(items.filter((i) => i.status !== "ok").every((i) => i.hint));
  assert.match(formatDoctor(items, { app: APP, dir }), /missing\s+Node: 20\.11\.0\n\s+herdr-crew needs Node 22/);
});

test("doctor: no Herdr is missing, no Backlog.md is only a warning", async () => {
  const items = await doctor({ app: APP, dir: await freshDir("doctor-none"), run: runner({}), env: {}, credentials: {} });
  const by = Object.fromEntries(items.map((i) => [i.name, i]));
  assert.equal(by.Herdr.status, "missing");
  assert.equal(by["Backlog.md"].status, "warning");
  assert.ok(!by["Inside Herdr"], "no Herdr checks without Herdr");
});

test("doctor CLI: stub binaries, read only, exit 1 when something is missing", async () => {
  const dir = await freshDir("doctor-cli");
  const bin = await freshDir("bin");
  const stub = async (name, body) => {
    await writeFile(join(bin, name), `#!${process.execPath}\n${body}\n`);
    await chmod(join(bin, name), 0o755);
  };
  await stub("herdr", `const a = process.argv.slice(2).join(" "); console.log(a === "--version" ? "herdr 0.9.5" : "--format --token");`);
  await stub("backlog", `process.exit(1);`);
  const r = await cli(["doctor"], { dir, bin });
  assert.equal(r.code, 1);
  assert.match(r.out, /ok\s+Herdr: 0\.9\.5/);
  assert.match(r.out, /warning\s+OpenCode: not found/);
  assert.match(r.out, /missing\s+Link skills\/herdr-orchestrator: not installed/);
  assert.deepEqual(await readdir(dir), [], "doctor writes nothing");
  assert.equal((await cli(["install", "--yes"], { dir, bin })).code, 0);
  assert.equal((await cli(["doctor"], { dir, bin })).code, 0);
});
