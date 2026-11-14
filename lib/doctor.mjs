// Read-only checks of everything herdr-crew relies on: only --version and --help calls, and the links in the
// OpenCode config dir.
import { join } from "node:path";
import { installPlan } from "./install.mjs";

const firstLine = (s) => String(s ?? "").trim().split("\n")[0].trim();
const version = (s) => firstLine(s).match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? firstLine(s);

// run(cmd, args) resolves to { ok, stdout, stderr }.
export async function doctor({ app, dir, run, env = process.env, node = process.versions.node, credentials = {} }) {
  const items = [];
  const add = (status, name, detail, hint) => items.push({ status, name, detail, hint: hint ?? null });
  const help = async (cmd, args) => { const r = await run(cmd, args); return r.ok ? r.stdout + r.stderr : ""; };

  const major = Number(node.split(".")[0]);
  if (major >= 22) add("ok", "Node", node);
  else add("missing", "Node", node, "herdr-crew needs Node 22 or later.");

  const herdr = await run("herdr", ["--version"]);
  if (!herdr.ok) add("missing", "Herdr", "not found", "Install Herdr (https://herdr.dev) and make sure herdr is on PATH.");
  else {
    add("ok", "Herdr", version(herdr.stdout));
    if ((await help("herdr", ["agent", "read", "--help"])).includes("--format")) add("ok", "Herdr agent read --format ansi", "supported");
    else add("warning", "Herdr agent read --format ansi", "not supported", "Update Herdr. Cards fall back to plain text and tell prompts from tool output less well.");
    if ((await help("herdr", ["pane", "report-metadata", "--help"])).includes("--token")) add("ok", "Herdr pane report-metadata --token", "supported");
    else add("warning", "Herdr pane report-metadata --token", "not supported", "Update Herdr. Agents cannot set their own bubble.");
    if (env.HERDR_ENV === "1") add("ok", "Inside Herdr", "HERDR_ENV=1");
    else add("warning", "Inside Herdr", "no", "Start OpenCode in a Herdr pane, so the skills can start and reach other agents.");
  }

  const oc = await run("opencode", ["--version"]);
  if (oc.ok) add("ok", "OpenCode", version(oc.stdout));
  else add("warning", "OpenCode", "not found", "OpenCode is the best supported agent: skills, commands, session history and reopen. Other agents get cards, bubbles and prompts.");

  const bl = await run("backlog", ["--version"]);
  if (!bl.ok) add("warning", "Backlog.md", "not found (optional)", "Install Backlog.md for task cards and task panels: https://backlog.md");
  else {
    const h = await help("backlog", ["task", "list", "--help"]);
    if (h.includes("--json") && h.includes("--watch")) add("ok", "Backlog.md", `${version(bl.stdout)}, task list --json --watch`);
    else if (h.includes("--json")) add("warning", "Backlog.md", `${version(bl.stdout)}, no task list --watch`, "Update Backlog.md for live task updates; until then the dashboard polls every 15 seconds.");
    else add("warning", "Backlog.md", `${version(bl.stdout)}, no task list --json`, "Update Backlog.md; task cards and panels need task list --json.");
  }

  if (credentials.model) add("ok", "Model credentials", "found");
  else add("warning", "Model credentials", "none (optional)", "Set ANTHROPIC_API_KEY (or ANTHROPIC_FOUNDRY_*) for the lead summary and generated themes.");
  if (credentials.image) add("ok", "Image credentials", "found");
  else add("warning", "Image credentials", "none (optional)", "Set OPENAI_API_KEY (or OPENAI_FOUNDRY_*) for theme avatars.");

  for (const p of await installPlan({ app, dir })) {
    const name = `Link ${p.rel}`;
    if (p.state === "ok") add("ok", name, "linked");
    else if (p.state === "create") add("missing", name, "not installed", `Run: node ${join(app, "server.mjs")} install`);
    else if (p.state === "link") add("warning", name, `links to ${p.to}`, "Another checkout is installed. Run install --force here to switch to this one.");
    else add("warning", name, `a real ${p.isDir ? "directory" : "file"}`, "An older copy is in place. Run install --force to move it to a backup and link this checkout.");
  }
  return items;
}

const MARK = { ok: "ok", warning: "warning", missing: "missing" };

export function formatDoctor(items, { app, dir }) {
  const lines = [`herdr-crew doctor: checkout ${app}, OpenCode config ${dir}`];
  for (const i of items) {
    lines.push(`  ${MARK[i.status].padEnd(8)} ${i.name}: ${i.detail}`);
    if (i.hint && i.status !== "ok") lines.push(`           ${i.hint}`);
  }
  const n = (s) => items.filter((i) => i.status === s).length;
  lines.push(`${n("ok")} ok, ${n("warning")} warning${n("warning") === 1 ? "" : "s"}, ${n("missing")} missing.`);
  return lines.join("\n");
}
