#!/usr/bin/env node
// herdr-crew: a crew dashboard for any project with Herdr agents. Reads Herdr read only; actions only on a click.
import { createServer } from "node:http";
import { readFile, writeFile, stat } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { createHash } from "node:crypto";
import { loadConfig, saveConfig, stateDir as makeStateDir, CONFIG_FILE } from "./lib/config.mjs";
import { createCrew } from "./lib/crew.mjs";
import { createActions, createGuard, send, readBody, exec } from "./lib/actions.mjs";
import { promptWhenReady } from "./lib/send.mjs";
import { createOnboarding, registerPersona } from "./lib/onboarding.mjs";
import { generateTheme, generateAvatars, imageEndpoint, flavourTheme } from "./lib/theme.mjs";
import { i18n, tr } from "./lib/i18n.mjs";
import { projectLocaleDir, checkLocaleFile, addLocale, languageRequestText, EN_FILE } from "./lib/languages.mjs";
import { modelEndpoint } from "./lib/summary.mjs";
import { buildConfig } from "./lib/init.mjs";
import { renderMarkdown, markdownPage } from "./lib/markdown.mjs";
import { createHub, createScheduler } from "./lib/live.mjs";
import { createWidgetSet, removeEntry, removeConfirm } from "./lib/widgets.mjs";
import { PANEL_TYPES, addWidget, removeWidget, entryId, panelRequestText } from "./lib/panels.mjs";
import { opencodeConfigDir, runInstall } from "./lib/install.mjs";
import { doctor, formatDoctor } from "./lib/doctor.mjs";

const APP = dirname(fileURLToPath(import.meta.url));
const CLI = `node ${join(APP, "server.mjs")}`;
const VERSION = JSON.parse(await readFile(join(APP, "package.json"), "utf8")).version;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { args._.push(a); continue; }
    const [k, v] = a.slice(2).split("=", 2);
    if (v !== undefined) args[k] = v;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) args[k] = argv[++i];
    else args[k] = true;
  }
  return args;
}

const HELP = `herdr-crew ${VERSION}

Usage:
  herdr-crew [serve] [--project DIR] [--port N] [--theme ["free text"]] [--reset-theme] [--theme-avatars] [--no-prompt]
  herdr-crew init [--project DIR] [--plan PLAN.md] [--import personas.json] [--avatars DIR] [--language nl|en] [--port N] [--force]
  herdr-crew register <agent> --name NAME [--pronouns P] [--role ROLE] [--avatar KEY] [--project DIR]
  herdr-crew widget add --json '<entry>' [--project DIR]
  herdr-crew widget remove <id> [--project DIR]
  herdr-crew widget list [--project DIR]
      Adds, removes or lists panels in .herdr-crew.json. Only built-in types: ${Object.keys(PANEL_TYPES).join(", ")}.
  herdr-crew locale list [--project DIR]
  herdr-crew locale check <file>
  herdr-crew locale add <code> --file <file> [--project DIR]
      Lists, checks or adds a dashboard language. A file must have the keys and placeholders of locales/en.json;
      add stores it in <project>/.herdr-crew/locales/<code>.json.
  herdr-crew send <agent> <text> [--timeout MS] [--interval MS]
      Waits until the agent is idle or done and its input box is empty, then sends the prompt.
      Exit 0 sent, 2 timeout (default 100000 ms), 1 other errors.
  herdr-crew install [--yes] [--force] [--dry-run] [--config-dir DIR]
      Links skills/* and commands/*.md of this checkout into the OpenCode config dir (--config-dir, else
      OPENCODE_CONFIG_DIR, else $XDG_CONFIG_HOME/opencode, else ~/.config/opencode). Shows the plan and asks first.
      Never replaces a real file or another link; --force moves it to <config dir>/herdr-crew-backup/ first.
  herdr-crew uninstall [--yes] [--dry-run] [--config-dir DIR]
      Removes only the links in skills/ and commands/ that point into this checkout.
  herdr-crew doctor [--config-dir DIR]
      Read-only check of Node, Herdr, OpenCode, Backlog.md, credentials and the links. Exit 1 when something is missing.

Config: <project>/${CONFIG_FILE}. State (memory, actions.log, theme avatars): <project>/.herdr-crew/.
Model features (lead summary, prompted theme) use ANTHROPIC_FOUNDRY_* or ANTHROPIC_API_KEY;
theme avatars use OPENAI_FOUNDRY_* or OPENAI_API_KEY. Without them everything degrades to defaults.`;

const args = parseArgs(process.argv.slice(2));
const command = ["init", "register", "send", "widget", "locale", "install", "uninstall", "doctor", "serve", "help"].includes(args._[0]) ? args._.shift() : "serve";
const project = resolve(args.project ?? process.cwd());

if (command === "help" || args.help) {
  console.log(HELP);
  process.exit(0);
}

if (command === "init") {
  const file = join(project, CONFIG_FILE);
  if (existsSync(file) && !args.force) {
    console.error(`${file} exists; use --force to overwrite`);
    process.exit(1);
  }
  const plan = args.plan ? resolve(project, args.plan) : ["PLAN.md", "AGENTS.md"].map((f) => join(project, f)).find(existsSync);
  const cfg = await buildConfig({
    project, plan, importFile: args.import ? resolve(project, args.import) : null,
    avatarDir: args.avatars ?? null, language: args.language, port: args.port ? Number(args.port) : undefined, title: args.title,
  });
  await writeFile(file, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`Wrote ${file} with ${cfg.personas.length} personas${plan ? ` from ${plan}` : ""}.`);
  process.exit(0);
}

if (command === "register") {
  const agent = args._[0];
  const p = await registerPersona(join(project, CONFIG_FILE), {
    agent, name: args.name, pronouns: args.pronouns ?? "", role: args.role ?? "", avatar: args.avatar,
    traits: typeof args.traits === "string" ? args.traits.split(",") : undefined,
  });
  if (!p) {
    console.error("Usage: herdr-crew register <agent> --name NAME [--pronouns P] [--role ROLE]  (agent: lowercase Herdr name)");
    process.exit(1);
  }
  console.log(`Registered ${p.agent} as ${p.name}${p.pronouns ? ` (${p.pronouns})` : ""} in ${join(project, CONFIG_FILE)}.`);
  process.exit(0);
}

const WIDGET_USAGE = "Usage: herdr-crew widget add --json '{\"module\":\"backlog\",\"options\":{...}}' | widget remove <id> | widget list  [--project DIR]";
if (command === "widget") {
  const [sub, id] = args._;
  const file = join(project, CONFIG_FILE);
  if (!existsSync(file)) {
    console.error(`No ${CONFIG_FILE} in ${project}; run herdr-crew init first.`);
    process.exit(1);
  }
  if (sub === "add" && typeof args.json === "string") {
    let entry;
    try { entry = JSON.parse(args.json); } catch (e) {
      console.error(`--json is not valid JSON: ${e.message}`);
      process.exit(1);
    }
    const r = await addWidget(file, project, entry);
    if (r.errors) {
      console.error(`Panel not added:\n- ${r.errors.join("\n- ")}`);
      process.exit(1);
    }
    console.log(`Added panel ${r.id} to ${file}. A running dashboard shows it within a few seconds.`);
    process.exit(0);
  }
  if (sub === "remove" && id) {
    const removed = await removeWidget(file, id);
    if (!removed) {
      console.error(`No panel with id ${id} in ${file}.`);
      process.exit(1);
    }
    console.log(`Removed panel ${id} (${removed.module}) from ${file}.`);
    process.exit(0);
  }
  if (sub === "list") {
    const { widgets = [] } = JSON.parse(await readFile(file, "utf8"));
    for (const w of widgets) console.log(`${entryId(w) ?? "?"}\t${w.module}\t${w.options?.title ?? ""}`);
    process.exit(0);
  }
  console.error(WIDGET_USAGE);
  process.exit(1);
}

if (command === "locale") {
  const [sub, arg] = args._;
  i18n.addDir(projectLocaleDir(project));
  if (sub === "list") {
    for (const l of i18n.languages()) console.log(`${l.code}\t${l.name}\t${l.englishName}\t${l.project ? projectLocaleDir(project) : "built-in"}`);
    process.exit(0);
  }
  if (sub === "check" && arg) {
    const { errors } = await checkLocaleFile(resolve(arg));
    if (errors.length) {
      console.error(`${arg} has ${errors.length} problem${errors.length === 1 ? "" : "s"}:\n- ${errors.slice(0, 50).join("\n- ")}${errors.length > 50 ? `\n- and ${errors.length - 50} more` : ""}`);
      process.exit(1);
    }
    console.log(`${arg} is a valid locale: same keys and placeholders as ${EN_FILE}.`);
    process.exit(0);
  }
  if (sub === "add" && arg && typeof args.file === "string") {
    if (!existsSync(join(project, CONFIG_FILE))) {
      console.error(`No ${CONFIG_FILE} in ${project}; run herdr-crew init first.`);
      process.exit(1);
    }
    const r = await addLocale({ project, code: arg, file: resolve(args.file) });
    if (r.errors) {
      console.error(`Language not added:\n- ${r.errors.slice(0, 50).join("\n- ")}${r.errors.length > 50 ? `\n- and ${r.errors.length - 50} more` : ""}`);
      process.exit(1);
    }
    console.log(`${r.updated ? "Updated" : "Added"} ${arg} in ${r.path}. A running dashboard offers it in the language list right away.`);
    process.exit(0);
  }
  console.error("Usage: herdr-crew locale list | locale check <file> | locale add <code> --file <file>  [--project DIR]");
  process.exit(1);
}

if (command === "send") {
  const [agent, ...words] = args._;
  const text = words.join(" ").trim();
  const ms = (v, d) => (v === undefined ? d : Number(v));
  const timeout = ms(args.timeout, 100000);
  const interval = ms(args.interval, 2000);
  if (!agent || !text || !(timeout >= 0) || !(interval > 0)) {
    console.error("Usage: herdr-crew send <agent> <text> [--timeout MS] [--interval MS]");
    process.exit(1);
  }
  const r = await promptWhenReady((a) => exec("herdr", a, process.cwd(), 30000), agent, text, {
    timeout, interval, onWait: (reason) => console.error(`[herdr-crew] ${reason}`),
  });
  if (r.ok) console.log(`Sent to ${agent}.`);
  else console.error(`[herdr-crew] not sent: ${r.reason}`);
  process.exit(r.ok ? 0 : r.timeout ? 2 : 1);
}

if (command === "install" || command === "uninstall") {
  const dir = typeof args["config-dir"] === "string" ? resolve(args["config-dir"]) : opencodeConfigDir();
  const ask = async (question) => {
    if (!process.stdin.isTTY) {
      console.error("No terminal to confirm in; run again with --yes.");
      return false;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(question);
    rl.close();
    return /^y(es)?$/i.test(answer.trim());
  };
  process.exit(await runInstall({
    app: APP, dir, uninstall: command === "uninstall", yes: !!args.yes, force: !!args.force, dryRun: !!args["dry-run"], ask,
  }));
}

if (command === "doctor") {
  const dir = typeof args["config-dir"] === "string" ? resolve(args["config-dir"]) : opencodeConfigDir();
  const items = await doctor({
    app: APP, dir, run: (cmd, a) => exec(cmd, a, process.cwd(), 15000),
    credentials: { model: !!modelEndpoint(), image: !!imageEndpoint() },
  });
  console.log(formatDoctor(items, { app: APP, dir }));
  process.exit(items.some((i) => i.status === "missing") ? 1 : 0);
}

// serve
const cfg = await loadConfig(project);
if (!cfg.exists) console.log(`No ${CONFIG_FILE} in ${project}; running with defaults. Try: herdr-crew init`);
const PORT = Number(args.port ?? process.env.PORT ?? cfg.port);
const stateDir = await makeStateDir(project);
i18n.addDir(projectLocaleDir(project));
const say = (s) => console.log(`[herdr-crew] ${s}`);

// Theme: --reset-theme, --theme "text", --theme (ask), or ask once on the first interactive start.
async function askTheme() {
  if (!process.stdin.isTTY || args["no-prompt"]) return null;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(tr(cfg.language)("server.askTheme"));
  rl.close();
  return answer.trim() || null;
}

async function applyThemePrompt(prompt) {
  say(`generating theme: ${prompt}`);
  const { theme, uiLanguage } = await generateTheme({ prompt, language: cfg.language, project: cfg.title, model: args["theme-model"] ?? cfg.summaries.model });
  await saveConfig(cfg, { theme, themeAsked: true });
  say(`theme saved in ${CONFIG_FILE}: ${theme.name}`);
  // A theme prompt such as "UI in English" may ask for a dashboard language; only an existing locale is applied.
  let language = null;
  if (uiLanguage && uiLanguage !== cfg.language) {
    language = i18n.has(uiLanguage) ? { set: uiLanguage } : { missing: uiLanguage };
    if (language.set) await setLanguage(uiLanguage);
  }
  return { theme, language };
}

// Writes the UI language. bubbleLanguage defaults to language, so pin it first: agents keep their bubble language.
async function setLanguage(code) {
  const raw = existsSync(cfg.file) ? JSON.parse(await readFile(cfg.file, "utf8")) : {};
  await saveConfig(cfg, raw.bubbleLanguage ? { language: code } : { language: code, bubbleLanguage: cfg.bubbleLanguage });
}

if (args["reset-theme"]) {
  await saveConfig(cfg, { theme: null, themeAsked: true });
  say("theme reset to the default");
}
const wantsTheme = typeof args.theme === "string" ? args.theme : args.theme === true || (!cfg.theme && !cfg.themeAsked && !args["reset-theme"]) ? await askTheme() : null;
if (wantsTheme) {
  if (!modelEndpoint()) say("no model credentials; keeping the default theme");
  else await applyThemePrompt(wantsTheme).catch((e) => say(`theme failed, keeping the current one: ${e.message}`));
} else if (args.theme === true || (!cfg.theme && !cfg.themeAsked && process.stdin.isTTY && !args["no-prompt"])) {
  await saveConfig(cfg, { themeAsked: true });
}

let avatarJob = null;
function startThemeAvatars() {
  if (!cfg.theme || avatarJob) return false;
  if (!imageEndpoint()) { say("no image API credentials; theme avatars skipped"); return false; }
  const theme = cfg.theme;
  avatarJob = generateAvatars({
    theme, personas: cfg.personas, dir: stateDir, model: process.env.HERDR_CREW_IMAGE_MODEL ?? "gpt-image-1", log: say,
    onAvatar: async (agent, file) => {
      if (cfg.theme !== theme) return;
      theme.avatars = { ...theme.avatars, [agent]: file };
      await saveConfig(cfg, { theme });
    },
  }).finally(() => { avatarJob = null; });
  return true;
}
if (args["theme-avatars"]) startThemeAvatars();

const avatarUrl = (p) => {
  const themed = cfg.theme?.avatars?.[p.agent];
  if (themed && existsSync(join(stateDir, "avatars", themed))) return `theme-avatars/${themed}`;
  if (p.avatar && cfg.avatarDir && existsSync(join(resolve(project, cfg.avatarDir), `${p.avatar}.png`))) return `avatars/${p.avatar}.png`;
  return null;
};

const crew = await createCrew({ project, stateDir, cfg, avatarUrl });
const guard = createGuard(PORT);
const cli = process.env.HERDR_CREW_CLI ?? CLI;
const onboarding = createOnboarding({ project, cfg, crew, cli });
const panels = { text: (prompt) => panelRequestText({ language: cfg.language, project, cli, prompt }) };
const languages = { text: (name) => languageRequestText({ language: cfg.language, project, cli, name }) };
const actions = createActions({ project, stateDir, cfg, guard, getSnapshot: crew.getSnapshot, onPrompt: crew.notePrompt, onboarding, panels, languages });

// Widgets: "dev-server" loads widgets/dev-server.mjs from this app, a path loads a module relative to the project.
const FILES_PORT = Number(args["files-port"] ?? cfg.filesPort ?? PORT + 1);
const fileUrl = (widgetId, key) => `http://localhost:${FILES_PORT}/files/${encodeURIComponent(widgetId)}/${encodeURIComponent(key)}`;
const widgets = createWidgetSet({
  app: APP, project, stateDir, fileUrl, say,
  context: { backlog: { enabled: () => !!cfg.backlog, tasks: crew.getTasks } },
});
let filesServer = null;
async function syncWidgets() {
  const r = await widgets.sync(cfg.widgets ?? [], cfg.language);
  ensureFilesServer();
  return r;
}
await syncWidgets();

// Picks up personas and widgets added with `herdr-crew register` or by hand, without a restart.
let configMtime = existsSync(cfg.file) ? (await stat(cfg.file)).mtimeMs : 0;
async function reloadConfig() {
  if (!existsSync(cfg.file)) return;
  const m = (await stat(cfg.file)).mtimeMs;
  if (m === configMtime) return;
  configMtime = m;
  try {
    const next = await loadConfig(project);
    for (const k of ["title", "language", "bubbleLanguage", "personas", "theme", "onboarding", "summaries", "terminalApp", "avatarDir", "confirm", "widgets"]) cfg[k] = next[k];
    const w = await syncWidgets();
    say(`config reloaded${w.added || w.removed ? `; widgets: ${w.added} new, ${w.removed} removed` : ""}`);
  } catch (e) {
    say(`config not reloaded: ${e.message}`);
  }
}

// Herdr calls are a few ms each, so poll every second while a browser watches and every 4 s otherwise.
const hub = createHub();
crew.onSnapshot((snap) => hub.publish(snap));
const poller = createScheduler({
  run: async () => { await reloadConfig(); await crew.poll(); },
  interval: () => (hub.size ? 1000 : 4000),
});

// Layout in the browser is stored per dashboard instance: project (id or real path) plus port.
const LAYOUT_KEY = `${typeof cfg.id === "string" && /^[\w.-]{1,64}$/.test(cfg.id) ? cfg.id : createHash("sha1").update(realpathSync(project)).digest("hex").slice(0, 12)}:${PORT}`;

function publicConfig() {
  return {
    version: VERSION, title: cfg.title, layoutKey: LAYOUT_KEY, bubbleLanguage: cfg.bubbleLanguage, backlog: cfg.backlog,
    lead: cfg.personas.find((p) => p.lead)?.name ?? null, onboardingVia: cfg.onboarding.via, confirmPrompt: !!cfg.confirm?.prompt,
    language: i18n.resolve(cfg.language), languageSetting: cfg.language, locale: i18n.dict(cfg.language), languages: i18n.languages(),
    theme: flavourTheme(cfg.theme), themeModel: !!modelEndpoint(), themeAvatars: !!imageEndpoint(), avatarJob: !!avatarJob,
    widgets: widgets.list().map((w) => ({ id: w.id, title: w.title })),
  };
}

async function handleWidgets(req, res, url) {
  const m = url.pathname.match(/^\/api\/widgets(?:\/([a-z0-9_-]+)(?:\/([a-z]+))?)?$/);
  if (!m) return false;
  const [, id, action] = m;
  if (!id) {
    if (req.method !== "GET") return send(res, 405, { error: "method not allowed" }), true;
    const views = await Promise.all(widgets.list().map(async (w) => {
      const view = await Promise.resolve().then(() => w.view()).catch((e) => ({ state: "off", error: e.message }));
      return { id: w.id, title: w.title, hasLog: !!w.log, ...view };
    }));
    return send(res, 200, views), true;
  }
  const w = widgets.find(id);
  if (!w) return send(res, 404, { error: "unknown widget" }), true;
  // "remove" is reserved for the dashboard: it removes the entry from .herdr-crew.json, whatever the widget is.
  const isRemove = action === "remove";
  const act = action && Object.hasOwn(w.actions, action) ? w.actions[action] : null;
  if (req.method === "GET" && action === "log") return send(res, 200, { text: await w.log?.() ?? "" }), true;
  if (req.method === "GET" && isRemove) return send(res, 200, { confirm: removeConfirm(cfg.language, w) }), true;
  if (req.method === "GET" && act) return send(res, 200, { confirm: act.confirm() }), true;
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" }), true;
  if (!guard.originOk(req)) return send(res, 403, { error: "origin not allowed" }), true;
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "bad body" }), true; }
  if (!isRemove && !act) return send(res, 404, { error: "unknown action" }), true;
  if (body.confirmed !== true) return send(res, 400, { error: "not confirmed" }), true;
  if (isRemove) {
    const json = widgets.entryJson(id);
    const left = json && await removeEntry(cfg.file, json);
    if (!left) return send(res, 409, { error: `${CONFIG_FILE} changed; reload and try again` }), true;
    cfg.widgets = left;
    await syncWidgets();
    await actions.log(`widget ${w.id}`, "remove", JSON.parse(json));
    return send(res, 200, { ok: true }), true;
  }
  try { await act.run(); } catch (e) { return send(res, 409, { error: e.message }), true; }
  await actions.log(`widget ${w.id}`, action, act.confirm());
  return send(res, 202, { ok: true }), true;
}

async function handleLanguage(req, res, url) {
  if (url.pathname !== "/api/language") return false;
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" }), true;
  if (!guard.originOk(req)) return send(res, 403, { error: "origin not allowed" }), true;
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "bad body" }), true; }
  if (body.confirmed !== true) return send(res, 400, { error: "not confirmed" }), true;
  const code = typeof body.language === "string" ? body.language : "";
  if (!i18n.has(code)) return send(res, 400, { error: "unknown language" }), true;
  await setLanguage(code);
  await actions.log("language", "set", { language: code, via: "dashboard" });
  return send(res, 200, { ok: true, language: code }), true;
}

async function handleTheme(req, res, url) {
  if (url.pathname !== "/api/theme") return false;
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" }), true;
  if (!guard.originOk(req)) return send(res, 403, { error: "origin not allowed" }), true;
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "bad body" }), true; }
  if (body.confirmed !== true) return send(res, 400, { error: "not confirmed" }), true;
  if (body.reset === true) {
    await saveConfig(cfg, { theme: null, themeAsked: true });
    await actions.log("theme", "reset", "default");
    return send(res, 200, { theme: null }), true;
  }
  if (body.avatars === true) {
    const started = startThemeAvatars();
    if (started) await actions.log("theme", "avatars", cfg.theme?.name ?? "");
    return send(res, started ? 202 : 409, started ? { ok: true } : { error: "no theme, no image API, or a job is running" }), true;
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 300) : "";
  if (!prompt) return send(res, 400, { error: "empty theme" }), true;
  if (!modelEndpoint()) return send(res, 409, { error: "no model credentials on the server" }), true;
  try {
    const { theme, language } = await applyThemePrompt(prompt);
    await actions.log("theme", "generate", prompt);
    if (language?.set) await actions.log("language", "set", { language: language.set, via: "theme" });
    return send(res, 200, { theme, language }), true;
  } catch (e) {
    return send(res, 502, { error: e.message }), true;
  }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".css": "text/css", ".js": "text/javascript" };

createServer(async (req, res) => {
  if (!guard.hostOk(req)) {
    res.writeHead(421);
    return res.end("wrong host");
  }
  const url = new URL(req.url, "http://localhost");
  try {
    const handled = await handleLanguage(req, res, url) || await handleTheme(req, res, url) || await handleWidgets(req, res, url) || await actions.handle(req, res, url);
    // An action usually changes a status, so show it now instead of on the next tick.
    if (handled && req.method === "POST") poller.kick();
    if (handled) return;
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    return res.end();
  }
  if (url.pathname === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    hub.add(res, crew.getSnapshot());
    req.on("close", () => hub.delete(res));
    poller.kick();
    return;
  }
  if (url.pathname === "/api/agents") return send(res, 200, crew.getSnapshot());
  if (url.pathname === "/api/config") return send(res, 200, publicConfig());

  // Static files: the page, project avatars and generated theme avatars. Nothing else from disk.
  let file = null;
  const p = url.pathname;
  if (p === "/" || p === "/index.html") file = join(APP, "public", "index.html");
  else if (/^\/avatars\/[a-z0-9-]+\.png$/.test(p) && cfg.avatarDir) file = join(resolve(project, cfg.avatarDir), p.slice("/avatars/".length));
  else if (/^\/theme-avatars\/[a-z0-9-]+\/[a-z0-9_-]+\.png$/.test(p)) file = join(stateDir, "avatars", p.slice("/theme-avatars/".length));
  if (!file || !existsSync(file)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  res.end(await readFile(file));
}).listen(PORT, "127.0.0.1", () => say(`crew dashboard for ${cfg.title} on http://localhost:${PORT}`));

// Files origin: a second listener on its own port, so served pages (which may run scripts, like a slide deck)
// cannot call the dashboard API and keep their own localStorage. Only the files that widgets list right now are
// reachable. It starts once the first widget lists a file and keeps running after that.
function ensureFilesServer() {
  if (filesServer || !widgets.fileCount()) return;
  const filesHosts = new Set([`localhost:${FILES_PORT}`, `127.0.0.1:${FILES_PORT}`]);
  const projectReal = realpathSync(project);
  filesServer = createServer(async (req, res) => {
    const deny = (code, text) => { res.writeHead(code, { "content-type": "text/plain" }); res.end(text); };
    if (!filesHosts.has(req.headers.host ?? "")) return deny(421, "wrong host");
    if (req.method !== "GET" && req.method !== "HEAD") return deny(405, "read only");
    // Navigation from the dashboard or a typed URL is fine; fetches from other sites are not.
    if (req.headers["sec-fetch-site"] === "cross-site") return deny(403, "cross-site");
    const m = new URL(req.url, "http://localhost").pathname.match(/^\/files\/([^/]+)\/([^/]+)$/);
    let f = null;
    try { f = m && widgets.file(decodeURIComponent(m[1]), decodeURIComponent(m[2])); } catch {}
    if (!f) return deny(404, "not found");
    let real;
    try { real = realpathSync(f.path); } catch { return deny(404, "not found"); }
    if (real !== f.path || !real.startsWith(projectReal + "/")) return deny(404, "not found");
    const body = await readFile(real, "utf8");
    const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-frame-options": "DENY" };
    if (f.render === "html") {
      res.writeHead(200, { ...headers, "content-type": "text/html; charset=utf-8" });
      return res.end(req.method === "HEAD" ? undefined : body);
    }
    if (f.render === "markdown") {
      const { title, html } = renderMarkdown(body);
      res.writeHead(200, { ...headers, "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:" });
      return res.end(req.method === "HEAD" ? undefined : markdownPage({ title, html, source: f.source }));
    }
    res.writeHead(200, { ...headers, "content-type": "text/plain; charset=utf-8" });
    res.end(req.method === "HEAD" ? undefined : body);
  });
  filesServer.on("error", (e) => say(`files origin on port ${FILES_PORT} not started: ${e.message}`));
  filesServer.listen(FILES_PORT, "127.0.0.1", () => say(`files for widgets on http://localhost:${FILES_PORT}/files/ (${widgets.fileCount()} files)`));
}

function loop(fn, ms) {
  const tick = async () => { try { await fn(); } catch (e) { console.error(e); } setTimeout(tick, ms); };
  tick();
}
const stopBacklog = crew.watchBacklog({
  onChange: () => poller.kick(),
  onUnsupported: () => {
    say("backlog task list --watch not available; polling Backlog.md every 15 s");
    loop(crew.pollBacklog, 15000);
  },
});
process.on("exit", stopBacklog);
for (const sig of ["SIGINT", "SIGTERM"]) process.once(sig, () => process.exit(sig === "SIGINT" ? 130 : 143));
loop(crew.pollHistory, 5 * 60 * 1000);
poller.start();

