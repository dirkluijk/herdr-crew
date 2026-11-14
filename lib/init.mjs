// Builds a first .herdr-crew.json from a plan file, live Herdr tab labels and an optional personas.json import.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createServer } from "node:net";
import { exec } from "./actions.mjs";
import { AGENT_NAME } from "./config.mjs";

const PERSONA = /`([a-z][a-z0-9_-]{0,31})`\s*\(([^,()]+),\s*([^,()]+)(?:,([^)]*))?\)/g;
const LEAD = /`([a-z][a-z0-9_-]{0,31})`,?\s*persona\s+([^()]+?)\s*\(([^)]+)\)/i;

export function personasFromPlan(text) {
  const out = new Map();
  const lead = text.match(LEAD);
  if (lead) out.set(lead[1], { agent: lead[1], lead: true, name: lead[2].trim(), pronouns: lead[3].trim(), role: "Orchestrator" });
  for (const line of text.split("\n")) {
    for (const m of line.matchAll(PERSONA)) {
      // Pronouns look like "she/her" or "it"; this skips other back-ticked names with a parenthesis.
      if (out.has(m[1]) || !/\/|^(it|they|he|she|hij|zij|hen|die)$/i.test(m[3].trim())) continue;
      // Role: the clause right before the agent name when it ends with a colon, e.g. "Crew dashboard (STS-46): `x-crew`".
      const before = line.slice(0, m.index).split(/(?<=[.;])\s/).pop().trim();
      const role = before.endsWith(":") ? before.slice(0, -1).replace(/^[*_\s-]+/, "").trim() : "";
      out.set(m[1], { agent: m[1], name: m[2].trim(), pronouns: m[3].trim(), role });
    }
  }
  const prefixes = text.match(/start with "([^"]+)"(?:\s*\(or "([^"]+)"\))?/);
  const leadP = [...out.values()].find((p) => p.lead);
  if (leadP) leadP.messagePrefixes = prefixes ? [prefixes[1], prefixes[2]].filter(Boolean) : [`${leadP.name} here.`];
  return [...out.values()];
}

const BUNDLES = {
  "org.alacritty": "Alacritty", "com.apple.Terminal": "Terminal", "com.googlecode.iterm2": "iTerm",
  "net.kovidgoyal.kitty": "kitty", "com.github.wez.wezterm": "WezTerm", "com.mitchellh.ghostty": "Ghostty",
  "dev.warp.Warp-Stable": "Warp", "co.zeit.hyper": "Hyper", "com.raphaelamorim.rio": "Rio",
};
const MARKERS = [
  ["ALACRITTY_SOCKET", "Alacritty"], ["ALACRITTY_WINDOW_ID", "Alacritty"], ["KITTY_WINDOW_ID", "kitty"],
  ["WEZTERM_PANE", "WezTerm"], ["GHOSTTY_RESOURCES_DIR", "Ghostty"], ["ITERM_SESSION_ID", "iTerm"],
];
const PROGRAMS = { Apple_Terminal: "Terminal", "iTerm.app": "iTerm", WezTerm: "WezTerm", ghostty: "Ghostty", WarpTerminal: "Warp", Hyper: "Hyper", kitty: "kitty", alacritty: "Alacritty" };

// Inside Herdr TERM_PROGRAM is "herdr", but the variables of the terminal that started Herdr are inherited.
export function detectTerminalApp(env = process.env, platform = process.platform) {
  if (env.HERDR_CREW_TERMINAL) return env.HERDR_CREW_TERMINAL;
  if (platform !== "darwin") return null;
  return BUNDLES[env.__CFBundleIdentifier] ?? MARKERS.find(([k]) => env[k])?.[1] ?? PROGRAMS[env.TERM_PROGRAM] ?? null;
}

export const DEFAULT_PORT = 5190;

export function portFree(port, host = "127.0.0.1") {
  return new Promise((res) => {
    const s = createServer().once("error", () => res(false)).listen(port, host, () => s.close(() => res(true)));
  });
}

// The dashboard needs its port and the next one for the files origin, so ports go in pairs: 5190, 5192, ...
export async function firstFreePort({ start = DEFAULT_PORT, tries = 50, isFree = portFree } = {}) {
  for (let port = start; port < start + tries * 2; port += 2) {
    if (await isFree(port) && await isFree(port + 1)) return port;
  }
  return null;
}

// "Noor" with Dutch gives ["Noor hier.", "Noor here."], so the dashboard recognises both.
export function defaultPrefixes(name, language) {
  return language === "nl" ? [`${name} hier.`, `${name} here.`] : [`${name} here.`];
}

// The orchestrator from the init flags. It becomes the only lead and replaces a lead found in the plan.
export function leadPersona({ agent, name, pronouns, role, prefixes, language }) {
  if (!AGENT_NAME.test(agent ?? "")) throw new Error(`orchestrator name must match ${AGENT_NAME}`);
  const n = String(name ?? "").trim() || agent;
  return {
    agent, name: n, pronouns: String(pronouns ?? "").trim(), role: String(role ?? "").trim() || "orchestrator", tasks: [], lead: true,
    messagePrefixes: prefixes?.length ? prefixes : defaultPrefixes(n, language),
  };
}

export async function buildConfig({ project, plan, importFile, avatarDir, language, bubbleLanguage, port, title, lead }) {
  const personas = new Map();
  let planText = "";
  if (plan && existsSync(plan)) {
    planText = await readFile(plan, "utf8");
    for (const p of personasFromPlan(planText)) personas.set(p.agent, p);
  }
  if (lead) {
    for (const p of personas.values()) delete p.lead;
    const merged = { ...personas.get(lead.agent), ...lead };
    personas.delete(lead.agent);
    const rest = [...personas.entries()];
    personas.clear();
    personas.set(lead.agent, merged);
    for (const [k, v] of rest) personas.set(k, v);
  }

  // Live tabs labelled "<agent> (<Name>, <pronouns>)" in the workspace of this project. A new crew (with a lead from
  // the flags) skips them: its workspace may hold tabs of other projects, and its own agents do not exist yet.
  let live = [];
  if (!lead) {
    const list = await exec("herdr", ["agent", "list"], project);
    try { live = JSON.parse(list.stdout)?.result?.agents ?? []; } catch {}
  }
  const workspace = lead ? null : process.env.HERDR_WORKSPACE_ID ?? live.find((a) => a.cwd?.startsWith(project))?.workspace_id;
  if (workspace) {
    const tabs = await exec("herdr", ["tab", "list", "--workspace", workspace], project);
    let rows = [];
    try { rows = JSON.parse(tabs.stdout)?.result?.tabs ?? []; } catch {}
    for (const t of rows) {
      const m = (t.label ?? "").match(/^([a-z][a-z0-9_-]{0,31})\s*\(([^,]+),\s*([^)]+)\)/);
      if (m && !personas.has(m[1])) personas.set(m[1], { agent: m[1], name: m[2].trim(), pronouns: m[3].trim(), role: "" });
    }
  }

  if (importFile && existsSync(importFile)) {
    const imported = JSON.parse(await readFile(importFile, "utf8"));
    for (const src of Array.isArray(imported) ? imported : imported.personas ?? []) {
      if (!AGENT_NAME.test(src.agent ?? "")) continue;
      const p = personas.get(src.agent);
      if (!p) continue;
      for (const k of ["traits", "quirk", "session", "avatar", "mascot", "lines", "statuses", "tasks", "lead"]) if (src[k] !== undefined) p[k] = src[k];
      if (src.role) p.role = src.role;
      if (src.name && !p.name) p.name = src.name;
    }
  }

  const dir = avatarDir ? resolve(project, avatarDir) : null;
  for (const p of personas.values()) {
    p.tasks ??= [];
    if (dir && !p.avatar) {
      const key = [p.agent, p.name.toLowerCase().split(/\s+/)[0]].find((k) => existsSync(join(dir, `${k}.png`)));
      if (key) p.avatar = key;
    }
  }

  const dutch = /\bDutch\b|\bNederlands\b/.test(planText.match(/speech bubble[^\n]*|bubbles? are written[^\n]*/gi)?.join(" ") ?? "");
  return {
    title: title ?? project.split("/").pop(),
    language: language ?? (dutch ? "nl" : "en"),
    bubbleLanguage: bubbleLanguage ?? (dutch ? "nl" : language ?? "en"),
    port: port ?? DEFAULT_PORT,
    backlog: existsSync(join(project, "backlog")) || existsSync(join(project, ".backlog")),
    avatarDir: dir ? relative(project, dir) || "." : null,
    terminalApp: detectTerminalApp(),
    summaries: { lead: true, model: "claude-sonnet-5-5" },
    onboarding: { via: "orchestrator", message: null },
    personas: [...personas.values()],
    widgets: [],
    theme: null,
  };
}
