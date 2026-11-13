// Registering personas and onboarding new agents. Onboarding goes through the orchestrator when there is one.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { AGENT_NAME, CONFIG_FILE, lead, onboardingText } from "./config.mjs";

const clean = (v, max) => (typeof v === "string" ? v.replace(/[\x00-\x1f\x7f<>]/g, "").trim().slice(0, max) : "");

export function validPersona(input) {
  const p = {
    agent: clean(input.agent, 32),
    name: clean(input.name, 40),
    pronouns: clean(input.pronouns, 24),
    role: clean(input.role, 140),
  };
  if (!AGENT_NAME.test(p.agent) || !p.name) return null;
  const avatar = clean(input.avatar, 40);
  if (avatar && /^[a-z0-9-]+$/.test(avatar)) p.avatar = avatar;
  if (Array.isArray(input.traits)) p.traits = input.traits.map((t) => clean(t, 60)).filter(Boolean).slice(0, 5);
  if (input.lead === true) p.lead = true;
  return p;
}

// Adds or updates one persona in the config file, keeping all other keys as they are.
export async function registerPersona(file, input) {
  const p = validPersona(input);
  if (!p) return null;
  const raw = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
  const personas = Array.isArray(raw.personas) ? raw.personas : [];
  const i = personas.findIndex((x) => x.agent === p.agent);
  if (i >= 0) personas[i] = { ...personas[i], ...p };
  else personas.push({ ...p, tasks: [] });
  raw.personas = personas;
  await writeFile(file, JSON.stringify(raw, null, 2) + "\n");
  return i >= 0 ? personas[i] : p;
}

export function createOnboarding({ project, cfg, crew, cli }) {
  const nl = cfg.language === "nl";
  const regCmd = (a) => `${cli} register ${a.id} --project ${project} --name "${a.suggestion?.name ?? "<naam>"}" --pronouns "${a.suggestion?.pronouns ?? "<pronouns>"}" --role "<rol>"`;

  function toOrchestrator(agents) {
    const l = lead(cfg);
    const lines = agents.map((a) => `- ${a.id} (pane ${a.pane}${a.label ? `, tab ${a.label}` : ""})${a.registered ? "" : `: ${regCmd(a)}`}`);
    const prefix = nl ? "Via het crew-dashboard:" : "From the crew dashboard:";
    const ask = nl
      ? `deze agents zijn nieuw in de crew. Wil je ze onboarden volgens de herdr-crew skill: geef wie nog geen persona heeft een naam, voornaamwoorden en rol, registreer die met het commando erachter, en geef ze de crew-conventies door (eigen wolkje, prefixes).`
      : `these agents are new to the crew. Please onboard them following the herdr-crew skill: give the ones without a persona a name, pronouns and role, register it with the command shown, and pass on the crew conventions (own bubble, prefixes).`;
    return { via: "orchestrator", target: l.agent, targetName: l.name, text: `${prefix} ${ask}\n${lines.join("\n")}` };
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
