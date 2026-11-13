// Example widget: start and stop a local dev server (for example a docs site) from the dashboard.
// It only touches its own cwd and port: stop refuses when the port belongs to a process outside cwd.
import { execFile, spawn } from "node:child_process";
import { openSync, closeSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isObject, checkId, checkText, checkPath, checkKeys, collect } from "../lib/widget-options.mjs";

const exec = (cmd, args, cwd, timeout = 10000) =>
  new Promise((res) => execFile(cmd, args, { cwd, timeout }, (err, stdout) => res(err ? "" : String(stdout).trim())));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = {
  nl: { running: "draait op", stopped: "gestopt", starting: "starten…", stopping: "stoppen…", start: "▶ Start", stop: "■ Stop",
    foreign: (p, c) => `Poort ${p} is bezet door een proces buiten ${c}; de widget laat dat met rust.`,
    confirmStart: (c, cmd, p) => `Start ${cmd} in ${c} op poort ${p}.`, confirmStop: (c, p) => `Stopt het proces op poort ${p} in ${c}.`,
    busy: (p) => `poort ${p} is al in gebruik`, timeout: "de server kwam niet op binnen de wachttijd", noDeps: "geen node_modules; de widget installeert niets" },
  en: { running: "running on", stopped: "stopped", starting: "starting…", stopping: "stopping…", start: "▶ Start", stop: "■ Stop",
    foreign: (p, c) => `Port ${p} belongs to a process outside ${c}; the widget leaves it alone.`,
    confirmStart: (c, cmd, p) => `Runs ${cmd} in ${c} on port ${p}.`, confirmStop: (c, p) => `Stops the process on port ${p} in ${c}.`,
    busy: (p) => `port ${p} is already in use`, timeout: "the server did not come up in time", noDeps: "no node_modules; the widget installs nothing" },
};

// Used by the CLI before it writes an entry; create itself stays as lenient as before.
export function validate(options) {
  if (!isObject(options)) return ["options must be an object"];
  const errors = collect(
    checkKeys(options, ["id", "title", "cwd", "command", "port", "pages", "requireNodeModules", "startTimeoutMs"]),
    checkId(options.id), checkText("title", options.title, 80), checkPath("cwd", options.cwd, false),
  );
  if (!(Number.isInteger(options.port) && options.port >= 1024 && options.port <= 65535)) errors.push("port must be a whole number from 1024 to 65535");
  if (options.command !== undefined && !(Array.isArray(options.command) && options.command.length && options.command.length <= 20 && options.command.every((c) => typeof c === "string" && c && c.length <= 200))) errors.push("command must be a list of 1 to 20 words, without a shell");
  if (options.pages !== undefined && !(Array.isArray(options.pages) && options.pages.length <= 20 && options.pages.every((p) => isObject(p) && !checkText("title", p.title, 80, true) && typeof p.path === "string" && p.path.length <= 200))) errors.push("pages must be a list of { title, path }");
  if (options.requireNodeModules !== undefined && typeof options.requireNodeModules !== "boolean") errors.push("requireNodeModules must be true or false");
  if (options.startTimeoutMs !== undefined && !(Number.isInteger(options.startTimeoutMs) && options.startTimeoutMs >= 1000 && options.startTimeoutMs <= 600000)) errors.push("startTimeoutMs must be from 1000 to 600000");
  return errors;
}

export default function create({ project, stateDir, options, language }) {
  const t = T[language] ?? T.en;
  const id = options.id ?? `dev-${options.port}`;
  const cwd = resolve(project, options.cwd ?? ".");
  const shownCwd = options.cwd ?? ".";
  const port = Number(options.port);
  const command = Array.isArray(options.command) && options.command.length ? options.command.map(String) : ["npm", "run", "dev"];
  const startTimeout = Number(options.startTimeoutMs ?? 300000);
  const logFile = join(stateDir, `widget-${id}.log`);
  const base = `http://localhost:${port}`;
  let phase = null;
  let lastError = null;

  if (!Number.isInteger(port) || port < 1024) throw new Error(`widget ${id}: port must be 1024 or higher`);

  async function listener() {
    const pid = Number((await exec("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], project)).split("\n")[0]);
    if (!pid) return null;
    const pcwd = (await exec("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], project)).split("\n").find((l) => l.startsWith("n"))?.slice(1) ?? null;
    return { pid, ours: !!pcwd && (pcwd === cwd || pcwd.startsWith(cwd + "/")) };
  }

  async function waitFor(check, ms) {
    for (const until = Date.now() + ms; Date.now() < until; await sleep(1500)) if (await check()) return true;
    return false;
  }

  async function start() {
    if (await listener()) throw new Error(t.busy(port));
    if (existsSync(join(cwd, "package.json")) && options.requireNodeModules !== false && !existsSync(join(cwd, "node_modules")) && !existsSync(join(project, "node_modules"))) throw new Error(t.noDeps);
    const out = openSync(logFile, "a");
    const env = { ...process.env, PORT: String(port) };
    const child = spawn(command[0], command.slice(1), { cwd, env, detached: true, stdio: ["ignore", out, out] });
    child.unref();
    closeSync(out);
    if (!(await waitFor(async () => !!(await listener()), startTimeout))) throw new Error(t.timeout);
  }

  async function stop() {
    const l = await listener();
    if (!l) return;
    if (!l.ours) throw new Error(t.foreign(port, shownCwd));
    // Stop an npm parent too, so no child process stays behind.
    const ppid = Number((await exec("ps", ["-o", "ppid=", "-p", String(l.pid)], project)).trim());
    const pcmd = ppid > 1 ? await exec("ps", ["-o", "command=", "-p", String(ppid)], project) : "";
    try { process.kill(l.pid, "SIGTERM"); } catch {}
    if (ppid > 1 && /(^|\/)(npm|pnpm|yarn|bun)\b|npm-cli/.test(pcmd)) try { process.kill(ppid, "SIGTERM"); } catch {}
    if (!(await waitFor(async () => !(await listener()), 20000))) try { process.kill(l.pid, "SIGKILL"); } catch {}
  }

  function run(name, fn) {
    if (phase) throw new Error(phase);
    phase = name;
    lastError = null;
    fn().catch((e) => { lastError = e.message; }).finally(() => { phase = null; });
  }

  return {
    id,
    title: options.title ?? `Dev server :${port}`,
    async view() {
      const l = await listener();
      return {
        state: phase ? "busy" : l ? "on" : "off",
        text: phase ? t[phase] : l ? `${t.running} ${base}/` : t.stopped,
        url: l && !phase ? `${base}/` : null,
        info: [`${command.join(" ")} · ${shownCwd} · :${port}`],
        warning: l && !l.ours ? t.foreign(port, shownCwd) : null,
        error: lastError,
        links: (options.pages ?? []).map((p) => ({ title: String(p.title), url: `${base}/${String(p.path).replace(/^\//, "")}`, enabled: !!l && !phase })),
        buttons: [
          { action: "start", label: t.start, disabled: !!phase || !!l },
          { action: "stop", label: t.stop, disabled: !!phase || !l || !l.ours },
        ],
        busy: !!phase,
      };
    },
    actions: {
      start: { confirm: () => t.confirmStart(shownCwd, command.join(" "), port), run: () => run("starting", start) },
      stop: { confirm: () => t.confirmStop(shownCwd, port), run: () => run("stopping", stop) },
    },
    log: async () => (await readFile(logFile, "utf8").catch(() => "")).split("\n").slice(-40).join("\n"),
  };
}
