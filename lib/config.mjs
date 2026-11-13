import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { i18n, tr, LOCALE_CODE } from "./i18n.mjs";

export const CONFIG_FILE = ".herdr-crew.json";
export const AGENT_NAME = /^[a-z][a-z0-9_-]{0,31}$/;

// The name of a language in the UI language, for example English in Dutch: Engels.
export function languageName(code, inLanguage) {
  try { return new Intl.DisplayNames([inLanguage, "en"], { type: "language" }).of(code) ?? code; } catch { return code; }
}

export function defaults(project) {
  return {
    title: project.split("/").pop(),
    language: "en",
    bubbleLanguage: null,
    port: 5190,
    workspace: null,
    backlog: existsSync(join(project, "backlog")) || existsSync(join(project, ".backlog")),
    avatarDir: null,
    terminalApp: null,
    summaries: { lead: true, model: "claude-sonnet-5-5" },
    onboarding: { via: "orchestrator", message: null },
    personas: [],
    widgets: [],
    theme: null,
  };
}

export async function loadConfig(project) {
  const file = join(project, CONFIG_FILE);
  const raw = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
  const base = defaults(project);
  const cfg = {
    ...base, ...raw,
    summaries: { ...base.summaries, ...raw.summaries },
    onboarding: { ...base.onboarding, ...raw.onboarding },
  };
  // Any locale code is kept, so a language added later still works; texts fall back to English (lib/i18n.mjs).
  cfg.language = typeof cfg.language === "string" && LOCALE_CODE.test(cfg.language) ? cfg.language : "en";
  cfg.bubbleLanguage ??= cfg.language;
  cfg.personas = (cfg.personas ?? []).filter((p) => p && AGENT_NAME.test(p.agent ?? ""));
  cfg.exists = existsSync(file);
  cfg.file = file;
  return cfg;
}

// Writes only the user-facing keys back, so runtime fields never end up in the file.
export async function saveConfig(cfg, patch = {}) {
  const raw = existsSync(cfg.file) ? JSON.parse(await readFile(cfg.file, "utf8")) : {};
  const next = { ...raw, ...patch };
  await writeFile(cfg.file, JSON.stringify(next, null, 2) + "\n");
  Object.assign(cfg, patch);
}

export async function stateDir(project) {
  const dir = resolve(project, ".herdr-crew");
  await mkdir(join(dir, "avatars"), { recursive: true });
  return dir;
}

export function lead(cfg) {
  return cfg.personas.find((p) => p.lead) ?? null;
}

export function onboardingText(cfg, agentId, persona) {
  const l = lead(cfg);
  const t = tr(cfg.language);
  const tpl = cfg.onboarding.message ?? t("onboarding.message");
  const who = persona?.name ? ` (${persona.name}${persona.pronouns ? `, ${persona.pronouns}` : ""})` : "";
  return tpl
    .replaceAll("{project}", cfg.title)
    .replaceAll("{agent}", agentId)
    .replaceAll("{persona}", who)
    .replaceAll("{language}", languageName(cfg.bubbleLanguage, i18n.resolve(cfg.language)))
    .replaceAll("{lead}", l?.name ?? t("onboarding.leadFallback"))
    .replaceAll("{prefix}", JSON.stringify(l?.messagePrefixes?.[0] ?? (l ? `${l.name} here.` : "-")));
}
