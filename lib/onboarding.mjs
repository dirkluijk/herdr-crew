// Registering personas and onboarding new agents. Onboarding goes through the orchestrator when there is one.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { AGENT_NAME, CONFIG_FILE, lead, onboardingText } from "./config.mjs";
import { tr } from "./i18n.mjs";

export const SESSION_ID = /^ses_[A-Za-z0-9]{1,64}$/;
const clean = (v, max) => (typeof v === "string" ? v.replace(/[\x00-\x1f\x7f<>]/g, "").trim().slice(0, max) : "");

export function validPersona(input) {
  const p = {
    agent: clean(input.agent, 32),
    name: clean(input.name, 40),
    pronouns: clean(input.pronouns, 24),
    role: clean(input.role, 140),
  };
  // Checked before cleaning: a cut name would never match the Herdr agent.
  if (typeof input.agent !== "string" || !AGENT_NAME.test(input.agent.trim()) || !p.name) return null;
  const avatar = clean(input.avatar, 40);
  if (avatar && /^[a-z0-9-]+$/.test(avatar)) p.avatar = avatar;
  if (Array.isArray(input.traits)) p.traits = input.traits.map((t) => clean(t, 60)).filter(Boolean).slice(0, 5);
  if (input.lead === true) p.lead = true;
  // Stored when the dashboard closes an agent, so Reopen can resume the same OpenCode session in the same place.
  if (typeof input.session === "string" && SESSION_ID.test(input.session)) p.session = input.session;
  if (typeof input.cwd === "string" && input.cwd.startsWith("/") && input.cwd.length <= 500 && !/[\x00-\x1f\x7f]/.test(input.cwd)) p.cwd = input.cwd;
  return p;
}

// Adds or updates one persona in the config file, keeping all other keys as they are.
export async function registerPersona(file, input) {
  const raw = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
  const personas = Array.isArray(raw.personas) ? raw.personas : [];
  const i = personas.findIndex((x) => x.agent === input.agent);
  // Updating an existing persona only needs the fields that change, e.g. --avatar alone.
  const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== ""));
  const p = validPersona(i >= 0 ? { ...personas[i], ...given } : given);
  if (!p) return null;
  if (i >= 0) personas[i] = { ...personas[i], ...p };
  else personas.push({ ...p, tasks: [] });
  raw.personas = personas;
  await writeFile(file, JSON.stringify(raw, null, 2) + "\n");
  return i >= 0 ? personas[i] : p;
}

export function createOnboarding({ project, cfg, crew, cli }) {
  const regCmd = (a, t) => `${cli} register ${a.id} --project ${project} --name "${a.suggestion?.name ?? t("onboarding.namePh")}" --pronouns "${a.suggestion?.pronouns ?? t("onboarding.pronounsPh")}" --role "${t("onboarding.rolePh")}"`;

  function toOrchestrator(agents) {
    const l = lead(cfg);
    const t = tr(cfg.language);
    const lines = agents.map((a) => `- ${a.id} (pane ${a.pane}${a.label ? `, tab ${a.label}` : ""})${a.registered ? "" : `: ${regCmd(a, t)}`}`);
    return { via: "orchestrator", target: l.agent, targetName: l.name, text: `${t("onboarding.prefix")} ${t("onboarding.ask")}\n${lines.join("\n")}` };
  }

  function preview(agent) {
    const l = lead(cfg);
    if (cfg.onboarding.via === "orchestrator" && l && l.agent !== agent.id) return toOrchestrator([agent]);
    return { via: "direct", target: agent.id, targetName: agent.name, text: onboardingText(cfg, agent.id, agent.registered ? agent : null) };
  }

  function previewAll() {
    const fresh = crew.getSnapshot().agents.filter((a) => a.live && a.isNew && !a.lead);
    const l = lead(cfg);
    if (!fresh.length || !l) return null;
    return { ...toOrchestrator(fresh), agents: fresh.map((a) => a.id) };
  }

  return {
    preview,
    previewAll,
    markInformed: crew.markInformed,
    register: (agent, body) => registerPersona(cfg.file, { ...body, agent: agent.id }),
  };
}

export { CONFIG_FILE };
