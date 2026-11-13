// Read-only polling of Herdr, Backlog.md and OpenCode session history into one snapshot.
import { readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { exec } from "./actions.mjs";
import { parseScreen, trimBubble, cleanSay, redact, stripAnsi, norm, looksLikeToolOutput } from "./screen.mjs";
import { summarizeLead, modelEndpoint } from "./summary.mjs";

const SELF_GRACE_MS = 60000;
const PROMPT_VERSION = "crew-1";

export async function createCrew({ project, stateDir, cfg, avatarUrl }) {
  const STATE_FILE = join(stateDir, "memory.json");
  const memory = existsSync(STATE_FILE) ? JSON.parse(await readFile(STATE_FILE, "utf8")) : {};
  const T = cfg.language === "nl"
    ? { you: "Jij", shell: "shell-commando loopt", unknownRole: "Nog niet geregistreerd" }
    : { you: "You", shell: "shell command running", unknownRole: "Not registered yet" };
  let tasks = {};
  let snapshot = { updatedAt: null, agents: [] };
  const history = {};
  const listeners = new Set();
  const summaries = cfg.summaries.lead && modelEndpoint();
  // Sender detection may have improved since the message was stored.
  for (const m of Object.values(memory)) {
    if (m.lastIn?.via !== "screen") continue;
    const from = incoming(m.lastIn.text).from;
    if (from === T.you && looksLikeToolOutput(m.lastIn.text)) {
      delete m.lastIn;
      delete m.promptSeen;
    } else m.lastIn.from = from;
  }

  const run = async (cmd, args, timeout = 8000) => {
    const r = await exec(cmd, args, project, timeout);
    return r.ok ? r.stdout : null;
  };
  const json = async (cmd, args) => {
    const out = await run(cmd, args);
    try { return out ? JSON.parse(out) : null; } catch { return null; }
  };

  async function readAgent(pane) {
    // Only the rendered viewport: deeper reads make Herdr scroll the TUI to collect history, visible to the user.
    // ANSI colours tell prompt blocks from tool blocks; plain text is the fallback for older Herdr versions.
    const out = await run("herdr", ["agent", "read", pane, "--source", "visible", "--format", "ansi"])
      ?? await run("herdr", ["agent", "read", pane, "--source", "visible"]);
    if (!out) return {};
    let text = out;
    try { const j = JSON.parse(out); text = j?.result?.text ?? j?.result?.content ?? out; } catch {}
    return parseScreen(text, T.shell);
  }

  async function pollBacklog() {
    if (!cfg.backlog) return;
    const j = await json("backlog", ["task", "list", "--json"]);
    if (!j?.tasks) return;
    tasks = Object.fromEntries(j.tasks.map((t) => [t.id, { id: t.id, title: t.title, status: t.status, assignees: t.assignees ?? (t.assignee ? [t.assignee] : []) }]));
  }

  // Closed personas with a session id: last assistant text from the OpenCode export.
  async function pollHistory() {
    await Promise.all(cfg.personas.filter((p) => /^ses_[A-Za-z0-9]+$/.test(p.session ?? "")).map(async (p) => {
      // opencode truncates export output on a pipe, so go through a temp file.
      const tmp = join(tmpdir(), `herdr-crew-${p.session}.json`);
      const ok = await run("sh", ["-c", 'opencode session export "$1" > "$2" 2>/dev/null', "sh", p.session, tmp], 90000);
      const out = ok === null ? null : await readFile(tmp, "utf8").catch(() => null);
      unlink(tmp).catch(() => {});
      if (!out) return;
      let data;
      try { data = JSON.parse(out); } catch { return; }
      const msgs = (data.messages ?? []).filter((m) => (m.type ?? m.info?.role) === "assistant");
      for (let k = msgs.length - 1; k >= 0; k--) {
        const m = msgs[k];
        const text = (m.content ?? m.parts ?? []).filter((c) => c.type === "text" && c.text).map((c) => c.text).join("\n");
        if (!text.trim()) continue;
        const t = m.time?.completed ?? m.time?.created ?? data.info?.time?.updated;
        history[p.agent] = { bubble: trimBubble(text), at: t ? new Date(t).toISOString() : null, title: data.info?.title ?? null };
        break;
      }
    }));
  }

  // Only the lead gets a model summary: two paragraphs do not fit in an 80 character token.
  let summarizing = false;
  async function wantSummary(p, context, status) {
    if (!summaries || !context || summarizing) return;
    const m = (memory[p.agent] ??= {});
    const h = createHash("sha1").update(PROMPT_VERSION + context).digest("hex").slice(0, 12);
    if (m.summaryOf === h || (m.summaryAt && Date.now() - Date.parse(m.summaryAt) < 25000)) return;
    summarizing = true;
    m.summaryAt = new Date().toISOString();
    try {
      const line = await summarizeLead({ model: cfg.summaries.model, language: cfg.bubbleLanguage, persona: p, context, status });
      if (line) Object.assign(m, { summary: line, summaryOf: h });
    } catch {} finally { summarizing = false; }
  }

  function mascotCard(p) {
    const tick = Math.floor(Date.now() / 30000);
    const lines = p.lines?.length ? p.lines : ["…"];
    const statuses = p.statuses?.length ? p.statuses : ["mascot"];
    return {
      say: lines[tick % lines.length], mascotStatus: statuses[Math.floor(tick / 6) % statuses.length],
      since: new Date(tick * 30000).toISOString(),
    };
  }

  function incoming(text) {
    const tag = text.match(/^\[([a-z][a-z0-9_-]*)\]/);
    const fromAgent = tag && cfg.personas.find((p) => p.agent === tag[1]);
    // "Vera hier." also matches "Vera hier:" and "vera hier,", but not "Vera hiernaast".
    const starts = (pre) => {
      const base = String(pre ?? "").replace(/[\s.:,;!]+$/, "").toLowerCase();
      return base && text.toLowerCase().startsWith(base) && !/[\p{L}\p{N}]/u.test(text.charAt(base.length));
    };
    const byPrefix = cfg.personas.find((p) => (p.messagePrefixes ?? []).some(starts));
    const from = fromAgent?.name ?? byPrefix?.name ?? T.you;
    return { from, text: redact(text).slice(0, 600), via: "screen" };
  }

  function notePrompt(agentId, text) {
    const m = (memory[agentId] ??= {});
    m.lastIn = { from: T.you, text: redact(text).slice(0, 600), via: "dashboard", at: new Date().toISOString() };
  }

  async function poll() {
    const list = await json("herdr", ["agent", "list"]);
    const live = list?.result?.agents ?? [];
    const workspace = cfg.workspace ?? process.env.HERDR_WORKSPACE_ID ?? mostCommonWorkspace(live, project);
    const tabs = workspace ? (await json("herdr", ["tab", "list", "--workspace", workspace]))?.result?.tabs ?? [] : [];
    const labelOf = Object.fromEntries(tabs.map((t) => [t.tab_id, t.label]));
    const isAgent = (a) => a.name || a.agent_session || /^OC \|/.test(a.terminal_title ?? "");
    const agentFor = (p) =>
      live.find((a) => a.name === p.agent) ??
      live.find((a) => a.workspace_id === workspace && isAgent(a) && (labelOf[a.tab_id] ?? "").split(" ")[0] === p.agent);

    const cards = [];
    const seen = new Set();
    for (const p of cfg.personas) {
      const a = agentFor(p);
      if (a) seen.add(a.pane_id);
      cards.push({ persona: p, agent: a, registered: true });
    }
    for (const a of live) {
      if (seen.has(a.pane_id) || a.workspace_id !== workspace || !isAgent(a)) continue;
      const label = labelOf[a.tab_id] ?? "";
      const m = label.match(/^(\S+)\s*\(([^,]+),\s*([^)]+)\)/);
      const id = a.name ?? m?.[1] ?? a.pane_id;
      cards.push({
        persona: { agent: id, name: m?.[2]?.trim() ?? a.name ?? id, pronouns: m?.[3]?.trim() ?? "", role: T.unknownRole, tasks: [] },
        agent: a, registered: false, suggestion: m ? { name: m[2].trim(), pronouns: m[3].trim() } : null,
      });
    }

    const agents = await Promise.all(cards.map(async ({ persona: p, agent: a, registered, suggestion }) => {
      const key = p.agent;
      const myTasks = Object.values(tasks).filter((t) => p.tasks?.includes(t.id) || t.assignees?.includes(`@${p.agent}`));
      const base = {
        id: key, lead: !!p.lead, mascot: !!p.mascot, registered, suggestion: suggestion ?? null,
        name: p.name, pronouns: p.pronouns ?? "", role: p.role ?? "", traits: p.traits ?? [], quirk: p.quirk ?? null,
        avatar: avatarUrl(p), tasks: myTasks.map(({ id, title, status }) => ({ id, title, status })),
      };
      const mem = (memory[key] ??= {});
      if (!a) {
        if (p.mascot) {
          const mc = mascotCard(p);
          return { ...base, live: false, status: "mascot", mascotStatus: mc.mascotStatus, say: mc.say, sayBy: "mascot", since: mc.since };
        }
        const h = history[key] ?? {};
        const useH = h.bubble && (!mem.at || (h.at && h.at >= mem.at));
        const detail = useH ? h.bubble : mem.bubble ?? h.bubble ?? null;
        const since = useH ? h.at : mem.at ?? h.at ?? null;
        const selfFresh = mem.selfSay && (!since || Date.parse(mem.selfAt) >= Date.parse(since) - SELF_GRACE_MS);
        return {
          ...base, live: false, status: "closed", label: mem.label ?? null, title: h.title ?? null,
          detail, say: selfFresh ? mem.selfSay : mem.summary ?? null, sayBy: selfFresh ? "self" : mem.summary ? "summary" : null,
          since: selfFresh ? mem.selfAt : since, lastIn: mem.lastIn ?? null,
        };
      }

      const { bubble, context, activity, prompt, promptBeforeReply, usage } = await readAgent(a.pane_id);
      const now = new Date().toISOString();
      const token = cleanSay(a.tokens?.say, p.lead ? 900 : 400);
      Object.assign(mem, {
        bubble: bubble ?? mem.bubble ?? null,
        context: context ?? mem.context ?? null,
        label: labelOf[a.tab_id] ?? null,
        at: bubble && bubble !== mem.bubble ? now : mem.at ?? now,
        statusAt: a.agent_status !== mem.status ? now : mem.statusAt ?? now,
        status: a.agent_status,
        usage: usage ?? mem.usage ?? null,
        firstSeen: mem.firstSeen ?? now,
        ...(token && token !== mem.selfSay ? { selfSay: token, selfAt: now } : {}),
        ...(token ? { everSaid: true } : {}),
      });
      if (prompt && norm(prompt) !== mem.promptSeen) {
        mem.promptSeen = norm(prompt);
        if (mem.lastIn?.via !== "dashboard" || norm(mem.lastIn.text) !== mem.promptSeen) mem.lastIn = { ...incoming(prompt), at: now };
      }
      const selfAtOk = mem.selfSay && mem.selfAt && Date.parse(mem.selfAt) >= Date.parse(mem.statusAt ?? 0) - SELF_GRACE_MS ? mem.selfAt : null;
      const replyAt = selfAtOk ?? mem.at;
      // A prompt that sits above the visible reply on screen was sent before that reply.
      if (prompt && promptBeforeReply && mem.lastIn && norm(mem.lastIn.text) === norm(prompt) && Date.parse(mem.lastIn.at) >= Date.parse(replyAt)) {
        mem.lastIn.at = new Date(Date.parse(replyAt) - 1000).toISOString();
      }
      const selfFresh = !!mem.selfSay && a.agent_status !== "working" && Date.parse(mem.at) <= Date.parse(mem.selfAt) + SELF_GRACE_MS;
      const liveBase = {
        ...base, live: true, status: a.agent_status, pane: a.pane_id, label: labelOf[a.tab_id] ?? null,
        title: (a.terminal_title ?? "").replace(/^OC \| /, ""), activity, usage: mem.usage ?? null, lastIn: mem.lastIn ?? null,
        // New: not in the config, or never set a bubble and not informed yet.
        isNew: !p.lead && !p.mascot && !mem.informedAt && (!registered || !mem.everSaid),
        informedAt: mem.informedAt ?? null, informedVia: mem.informedVia ?? null,
      };
      if (p.mascot) {
        const mc = mascotCard(p);
        return {
          ...liveBase, mascotStatus: mc.mascotStatus, detail: mem.bubble ?? null,
          ...(selfFresh ? { say: mem.selfSay, sayBy: "self", since: mem.selfAt } : { say: mc.say, sayBy: "mascot", since: mc.since }),
        };
      }
      if (p.lead) {
        wantSummary(p, mem.context, a.agent_status);
        return {
          ...liveBase, detail: mem.bubble, say: mem.summary ?? null, sayBy: mem.summary ? "summary" : null,
          ...(selfFresh ? { headline: mem.selfSay, sayBy: "self" } : {}), since: selfFresh ? mem.selfAt : mem.at,
        };
      }
      return {
        ...liveBase, detail: mem.bubble ?? null,
        ...(mem.selfSay ? { say: mem.selfSay, sayBy: "self", stale: !selfFresh } : { say: null, sayBy: "screen" }),
        since: mem.selfSay ? mem.selfAt : mem.at,
      };
    }));

    snapshot = { updatedAt: new Date().toISOString(), workspace, agents };
    for (const fn of listeners) fn(snapshot);
    await writeFile(STATE_FILE, JSON.stringify(memory, null, 2)).catch(() => {});
  }

  return {
    poll, pollBacklog, pollHistory, notePrompt,
    getSnapshot: () => snapshot,
    onSnapshot: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    markInformed: async (id, via) => {
      Object.assign((memory[id] ??= {}), { informedAt: new Date().toISOString(), informedVia: via });
      await writeFile(STATE_FILE, JSON.stringify(memory, null, 2)).catch(() => {});
    },
  };
}

function mostCommonWorkspace(live, project) {
  const counts = {};
  for (const a of live) if (a.cwd === project || a.cwd?.startsWith(project + "/")) counts[a.workspace_id] = (counts[a.workspace_id] ?? 0) + 1;
  return Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
}

export { stripAnsi };
