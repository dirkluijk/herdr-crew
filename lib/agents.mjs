// Close and reopen agents from the dashboard. Close closes the agent's Herdr tab (OpenCode stops, its session stays
// on disk) and remembers the session and cwd in the persona; Reopen starts that same session in a new tab with the
// same label and agent name. Every Herdr call goes through a fixed command map; pane and tab ids only come from Herdr.
import { realpathSync, statSync } from "node:fs";
import { sep } from "node:path";
import { registerPersona, SESSION_ID } from "./onboarding.mjs";

const ID = /^[A-Za-z0-9_:-]{1,64}$/;
const START_TIMEOUT = 60000;

const HERDR = {
  get: (pane) => ["agent", "get", pane],
  list: () => ["agent", "list"],
  tabGet: (tab) => ["tab", "get", tab],
  tabClose: (tab) => ["tab", "close", tab],
  tabCreate: (workspace, cwd, label) => ["tab", "create", "--workspace", workspace, "--cwd", cwd, "--label", label, "--no-focus"],
  start: (agent, pane, session) => ["agent", "start", agent, "--kind", "opencode", "--pane", pane, "--timeout", String(START_TIMEOUT), "--", "--session", session],
};

const parse = (r) => { try { return r.ok ? JSON.parse(r.stdout)?.result ?? null : null; } catch { return null; } };
const fail = (status, error) => ({ status, body: { error } });

function real(path) {
  try { return realpathSync(path); } catch { return null; }
}

// The places an agent may be reopened in: the project itself, anything inside it, and the git worktrees of the
// project (a milestone agent often works in its own worktree next to the main checkout).
export async function allowedCwd(exec, project, cwd) {
  const r = real(cwd);
  if (!r) return null;
  try { if (!statSync(r).isDirectory()) return null; } catch { return null; }
  const roots = [real(project)];
  const wt = await exec("git", ["-C", project, "worktree", "list", "--porcelain"]);
  if (wt.ok) for (const line of wt.stdout.split("\n")) if (line.startsWith("worktree ")) roots.push(real(line.slice(9)));
  return roots.some((root) => root && (r === root || r.startsWith(root + sep))) ? r : null;
}

export const labelFor = (p) => `${p.agent} (${p.name}${p.pronouns ? `, ${p.pronouns}` : ""})`;

export function createAgentControl({ project, cfg, exec, getSnapshot }) {
  const herdr = (name, ...args) => exec("herdr", HERDR[name](...args), project, name === "start" ? START_TIMEOUT + 10000 : 10000);
  const busy = new Set();

  async function once(id, fn) {
    if (busy.has(id)) return fail(409, `a close or reopen of ${id} is already running`);
    busy.add(id);
    try { return await fn(); } finally { busy.delete(id); }
  }

  // card: the live snapshot card of the agent.
  function close(card) {
    return once(card.id, async () => {
      if (card.lead) return fail(409, "the lead persona cannot be closed from the dashboard");
      const info = parse(await herdr("get", card.pane))?.agent;
      if (!info || info.pane_id !== card.pane || (info.name && info.name !== card.id)) return fail(409, "the agent is no longer in that pane");
      if (!["idle", "done"].includes(info.agent_status)) return fail(409, `${card.name} is ${info.agent_status ?? "unknown"}; only idle or done agents can be closed`);
      if (!ID.test(info.tab_id ?? "")) return fail(502, "no tab id from herdr");
      const tab = parse(await herdr("tabGet", info.tab_id))?.tab;
      if (tab?.pane_count !== 1) return fail(409, `the tab of ${card.name} has ${tab?.pane_count ?? "an unknown number of"} panes; only a tab with just the agent is closed`);
      const session = info.agent === "opencode" ? info.agent_session?.value : null;
      const persona = cfg.personas.find((p) => p.agent === card.id);
      let stored = null;
      if (persona && typeof session === "string" && SESSION_ID.test(session)) {
        await registerPersona(cfg.file, { agent: card.id, session, cwd: typeof info.cwd === "string" ? info.cwd : undefined });
        stored = { session, cwd: info.cwd ?? null };
      }
      const r = await herdr("tabClose", info.tab_id);
      if (!r.ok) return fail(502, r.stderr.slice(0, 300) || "tab close failed");
      return { status: 200, body: { ok: true, stored: !!stored }, log: { tab: info.tab_id, label: tab.label ?? null, ...stored } };
    });
  }

  function reopen(id) {
    return once(id, async () => {
      const persona = cfg.personas.find((p) => p.agent === id);
      if (!persona) return fail(404, "unknown persona");
      if (!SESSION_ID.test(persona.session ?? "")) return fail(409, `no OpenCode session stored for ${id}`);
      const live = parse(await herdr("list"))?.agents;
      if (!Array.isArray(live)) return fail(502, "herdr agent list failed");
      if (live.some((a) => a.name === id)) return fail(409, `an agent named ${id} is already live in Herdr`);
      const cwd = await allowedCwd(exec, project, persona.cwd ?? project);
      if (!cwd) return fail(409, `${persona.cwd ?? project} is not the project, inside it, or a git worktree of it`);
      const workspace = getSnapshot().workspace;
      if (!ID.test(workspace ?? "")) return fail(409, "the crew workspace is unknown; set workspace in .herdr-crew.json");
      const closed = getSnapshot().agents.find((a) => a.id === id);
      const label = closed?.label ?? labelFor(persona);
      const created = parse(await herdr("tabCreate", workspace, cwd, label));
      const tab = created?.tab?.tab_id;
      const pane = created?.root_pane?.pane_id;
      if (!ID.test(pane ?? "")) return fail(502, "herdr tab create gave no pane id");
      const started = await herdr("start", id, pane, persona.session);
      if (!started.ok) {
        if (ID.test(tab ?? "")) await herdr("tabClose", tab);
        return fail(502, `agent start failed: ${started.stderr.slice(0, 300) || "no output"}`);
      }
      return { status: 200, body: { ok: true, pane }, log: { workspace, tab: tab ?? null, pane, label, cwd, session: persona.session } };
    });
  }

  return { close, reopen };
}
