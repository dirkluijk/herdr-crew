import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const CONFIG_FILE = ".herdr-crew.json";
export const AGENT_NAME = /^[a-z][a-z0-9_-]{0,31}$/;

export const DEFAULT_ONBOARDING = {
  nl: [
    "Welkom in de crew van {project}. Je bent {agent}{persona}.",
    "Zet aan het eind van elke beurt je eigen tekstwolkje: één korte zin in het {language} van hooguit 80 tekens over waar je mee bezig bent of wat je net afrondde, zonder geheimen:",
    "herdr pane report-metadata \"$HERDR_PANE_ID\" --source crew --token say=\"<tekst>\"",
    "Berichten van {lead} beginnen met {prefix}, berichten van andere agents met [agent-naam].",
  ].join("\n"),
  en: [
    "Welcome to the {project} crew. You are {agent}{persona}.",
    "At the end of every turn, set your own speech bubble: one short sentence in {language}, at most 80 characters, about what you are doing or just finished, no secrets:",
    "herdr pane report-metadata \"$HERDR_PANE_ID\" --source crew --token say=\"<text>\"",
    "Messages from {lead} start with {prefix}, messages from other agents with [agent-name].",
  ].join("\n"),
};

const LANGUAGE_NAMES = { nl: { nl: "Nederlands", en: "Engels" }, en: { nl: "Dutch", en: "English" } };

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
  cfg.language = cfg.language === "nl" ? "nl" : "en";
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
  const tpl = cfg.onboarding.message ?? DEFAULT_ONBOARDING[cfg.language];
  const who = persona?.name ? ` (${persona.name}${persona.pronouns ? `, ${persona.pronouns}` : ""})` : "";
  return tpl
    .replaceAll("{project}", cfg.title)
    .replaceAll("{agent}", agentId)
    .replaceAll("{persona}", who)
    .replaceAll("{language}", LANGUAGE_NAMES[cfg.language][cfg.bubbleLanguage] ?? cfg.bubbleLanguage)
    .replaceAll("{lead}", l?.name ?? "the orchestrator")
    .replaceAll("{prefix}", JSON.stringify(l?.messagePrefixes?.[0] ?? (l ? `${l.name} here.` : "-")));
}
