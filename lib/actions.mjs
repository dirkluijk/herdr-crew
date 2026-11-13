// Every action starts with a click in the browser. Safeguards: loopback only, Host and Origin checks,
// a custom header that forces a CORS preflight, a fixed herdr command map run through execFile, and a log.
import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { stripAnsi } from "./screen.mjs";
import { taskView, TASK_ID } from "./task.mjs";
import { readiness } from "./send.mjs";
import { cleanPrompt, MAX_PROMPT } from "./panels.mjs";
import { createAgentControl } from "./agents.mjs";

const HERDR = {
  get: (pane) => ["agent", "get", pane],
  read: (pane) => ["agent", "read", pane, "--source", "visible"],
  focus: (pane) => ["agent", "focus", pane],
  prompt: (pane, text) => ["agent", "prompt", pane, text],
  keys: (pane, keys) => ["agent", "send-keys", pane, ...keys],
  type: (pane, text) => ["pane", "send-text", pane, text],
};
const DIALOG_KEYS = new Set(["enter", "esc", "tab", "space", "up", "down", "left", "right", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const MAX_TEXT = 4000;
const AGENT_ACTIONS = new Set(["focus", "prompt", "onboard", "register", "close", "keys", "type"]);

export const exec = (cmd, args, cwd, timeout = 10000) =>
  new Promise((res) => {
    execFile(cmd, args, { cwd, timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) =>
      res({ ok: !err, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") }),
    );
  });

export function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new Error("body too large");
    chunks.push(c);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export function createGuard(port) {
  const hosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
  const origins = new Set([...hosts].map((h) => `http://${h}`));
  return {
    // Blocks DNS rebinding: a foreign page that resolves its own name to 127.0.0.1 still sends its own Host.
    hostOk: (req) => hosts.has(req.headers.host ?? ""),
    // A cross-site request cannot set X-Crew without a preflight, which this server never approves.
    originOk: (req) => origins.has(req.headers.origin ?? "") && req.headers["x-crew"] === "1",
  };
}

export function createActions({ project, stateDir, cfg, guard, getSnapshot, onPrompt, onboarding, panels }) {
  const logFile = join(stateDir, "actions.log");
  const herdr = (name, ...args) => exec("herdr", HERDR[name](...args), project);
  const liveAgent = (id) => getSnapshot().agents.find((a) => a.id === id && a.live && a.pane);
  const log = (target, action, text) => appendFile(logFile, `${new Date().toISOString()}\t${target}\t${action}\t${JSON.stringify(text)}\n`);
  const who = (a) => `${a.id} (${a.name}, ${a.pane})`;
  const control = createAgentControl({ project, cfg, exec, getSnapshot });

  async function currentStatus(pane) {
    const r = await herdr("get", pane);
    try { return JSON.parse(r.stdout)?.result?.agent?.agent_status ?? null; } catch { return null; }
  }

  // Sends a prompt only to an agent that is idle or done right now and has an empty input box.
  async function promptAgent(agent, text, action) {
    const ready = await readiness((args) => exec("herdr", args, project), agent.pane, agent.name);
    if (!ready.ok) return [ready.fatal ? 502 : 409, { error: ready.reason }];
    const r = await herdr("prompt", agent.pane, text);
    if (!r.ok) return [502, { error: r.stderr.slice(0, 300) || "prompt failed" }];
    await log(who(agent), action, text);
    onPrompt(agent.id, text);
    return [200, { ok: true }];
  }

  async function handle(req, res, url) {
    if (url.pathname === "/api/crew/onboard") {
      const plan = onboarding.previewAll();
      if (req.method === "GET") return send(res, 200, plan ?? { agents: [] }), true;
      if (req.method !== "POST") return send(res, 405, { error: "method not allowed" }), true;
      if (!guard.originOk(req)) return send(res, 403, { error: "origin not allowed" }), true;
      let body;
      try { body = await readBody(req); } catch { return send(res, 400, { error: "bad body" }), true; }
      if (body.confirmed !== true) return send(res, 400, { error: "not confirmed" }), true;
      if (!plan) return send(res, 409, { error: "nothing to onboard or no orchestrator in the config" }), true;
      const target = liveAgent(plan.target);
      if (!target) return send(res, 409, { error: "the orchestrator is not live" }), true;
      const [status, out] = await promptAgent(target, plan.text, `onboard ${plan.agents.join(",")}`);
      if (status === 200) for (const id of plan.agents) await onboarding.markInformed(id, "orchestrator");
      return send(res, status, out), true;
    }
    if (url.pathname === "/api/panels/request") {
      // The user's request goes to the lead as plain text inside a fixed template; nothing here runs it.
      const l = cfg.personas.find((p) => p.lead) ?? null;
      const target = l ? liveAgent(l.agent) : null;
      const info = { lead: l?.agent ?? null, leadName: l?.name ?? null, live: !!target, status: target?.status ?? null, max: MAX_PROMPT };
      if (req.method === "GET") {
        const prompt = cleanPrompt(url.searchParams.get("prompt") ?? "").slice(0, MAX_PROMPT);
        return send(res, 200, { ...info, text: prompt ? panels.text(prompt) : null }), true;
      }
      if (req.method !== "POST") return send(res, 405, { error: "method not allowed" }), true;
      if (!guard.originOk(req)) return send(res, 403, { error: "origin not allowed" }), true;
      let body;
      try { body = await readBody(req); } catch { return send(res, 400, { error: "bad body" }), true; }
      if (body.confirmed !== true) return send(res, 400, { error: "not confirmed" }), true;
      const prompt = cleanPrompt(body.prompt);
      if (!prompt || prompt.length > MAX_PROMPT) return send(res, 400, { error: `empty or longer than ${MAX_PROMPT} characters` }), true;
      if (!l) return send(res, 409, { error: "no lead persona in .herdr-crew.json" }), true;
      if (!target) return send(res, 409, { error: `${l.name} (${l.agent}) is not live` }), true;
      const [status, out] = await promptAgent(target, panels.text(prompt), "panel request");
      return send(res, status, out), true;
    }
    const m = url.pathname.match(/^\/api\/(agents|tasks)\/([^/]+)(?:\/([a-z-]+))?$/);
    if (!m) return false;
    const [, kind, rawId, action] = m;
    const id = decodeURIComponent(rawId);

    if (kind === "tasks") {
      if (!cfg.backlog || req.method !== "GET" || action || !TASK_ID.test(id)) return send(res, 400, { error: "bad task request" }), true;
      const j = await exec("backlog", ["task", "view", id, "--json"], project);
      let view = null;
      if (j.ok) try { view = taskView(JSON.parse(j.stdout)); } catch {}
      if (view) return send(res, 200, { id, view }), true;
      // Older Backlog.md versions without --json, or an unknown schema: plain text as before.
      const r = await exec("backlog", ["task", "view", id, "--plain"], project);
      return send(res, r.ok ? 200 : 404, r.ok ? { id, text: stripAnsi(r.stdout) } : { error: "task not found" }), true;
    }

    // Reopen is the one agent action for an agent that is not live.
    if (action === "reopen") {
      if (req.method !== "POST") return send(res, 405, { error: "method not allowed" }), true;
      if (!guard.originOk(req)) return send(res, 403, { error: "origin not allowed" }), true;
      let body;
      try { body = await readBody(req); } catch { return send(res, 400, { error: "bad body" }), true; }
      if (body.confirmed !== true) return send(res, 400, { error: "not confirmed" }), true;
      if (liveAgent(id)) return send(res, 409, { error: "the agent is live" }), true;
      const r = await control.reopen(id);
      if (r.log) await log(id, "reopen", r.log);
      return send(res, r.status, r.body), true;
    }

    const agent = liveAgent(id);
    if (!agent) return send(res, 404, { error: "agent is not live" }), true;

    if (req.method === "GET" && action === "screen") {
      const r = await herdr("read", agent.pane);
      let text = r.stdout;
      try { const j = JSON.parse(text); text = j?.result?.text ?? j?.result?.content ?? text; } catch {}
      return send(res, r.ok ? 200 : 502, r.ok ? { text: stripAnsi(text).replace(/\s+$/gm, "") } : { error: "read failed" }), true;
    }
    if (req.method === "GET" && action === "onboarding") return send(res, 200, onboarding.preview(agent)), true;

    if (!AGENT_ACTIONS.has(action)) return send(res, 404, { error: "unknown action" }), true;
    if (req.method !== "POST") return send(res, 405, { error: "method not allowed" }), true;
    if (!guard.originOk(req)) return send(res, 403, { error: "origin not allowed" }), true;
    let body;
    try { body = await readBody(req); } catch { return send(res, 400, { error: "bad body" }), true; }

    if (action === "focus") {
      const r = await herdr("focus", agent.pane);
      const terminalApp = cfg.terminalApp ?? null;
      // raised stays null when there is no terminal app to bring to the front.
      let raised = null;
      if (r.ok && terminalApp && process.platform === "darwin") raised = (await exec("open", ["-a", terminalApp], project)).ok;
      await log(who(agent), "focus", { ok: r.ok, terminalApp, raised });
      return send(res, r.ok ? 200 : 502, { ok: r.ok, terminalApp, raised }), true;
    }

    if (action === "prompt") {
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text || text.length > MAX_TEXT) return send(res, 400, { error: "empty or too long" }), true;
      if (cfg.confirm?.prompt && body.confirmed !== true) return send(res, 400, { error: "not confirmed" }), true;
      const [status, out] = await promptAgent(agent, text, "prompt");
      return send(res, status, out), true;
    }

    // Everything below changes something beyond a plain chat message, so it always needs a confirmation.
    if (body.confirmed !== true) return send(res, 400, { error: "not confirmed" }), true;

    if (action === "onboard") {
      const plan = onboarding.preview(agent);
      const target = plan.via === "orchestrator" ? liveAgent(plan.target) : agent;
      if (!target) return send(res, 409, { error: "the orchestrator is not live; switch onboarding.via to direct or start it" }), true;
      const [status, out] = await promptAgent(target, plan.text, `onboard ${agent.id}`);
      if (status === 200) await onboarding.markInformed(agent.id, plan.via);
      return send(res, status, out), true;
    }
    if (action === "register") {
      if (agent.registered) return send(res, 409, { error: "already registered; edit .herdr-crew.json or use herdr-crew register" }), true;
      const p = await onboarding.register(agent, body);
      if (!p) return send(res, 400, { error: "invalid persona" }), true;
      await log(who(agent), "register", p);
      return send(res, 200, { ok: true, persona: p }), true;
    }
    if (action === "close") {
      const r = await control.close(agent);
      if (r.log) await log(who(agent), "close", r.log);
      return send(res, r.status, r.body), true;
    }

    const status = await currentStatus(agent.pane);
    if (status !== "blocked") return send(res, 409, { error: `agent is ${status ?? "unknown"}; dialog answers only go to blocked agents` }), true;
    if (action === "keys") {
      const keys = Array.isArray(body.keys) ? body.keys : [];
      if (!keys.length || keys.length > 10 || !keys.every((k) => DIALOG_KEYS.has(k))) return send(res, 400, { error: "keys not allowed" }), true;
      const r = await herdr("keys", agent.pane, keys);
      if (r.ok) await log(who(agent), "dialog-keys", keys.join(" "));
      return send(res, r.ok ? 200 : 502, { ok: r.ok }), true;
    }
    if (action === "type") {
      const text = typeof body.text === "string" ? body.text : "";
      if (!text.trim() || text.length > MAX_TEXT || /[\x00-\x08\x0b-\x1f\x7f]/.test(text)) return send(res, 400, { error: "text not allowed" }), true;
      const r = await herdr("type", agent.pane, text);
      if (r.ok) await log(who(agent), "dialog-text", text);
      return send(res, r.ok ? 200 : 502, { ok: r.ok }), true;
    }
    return send(res, 404, { error: "unknown action" }), true;
  }

  return { handle, log };
}
