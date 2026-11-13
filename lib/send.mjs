// Prompt guard: herdr agent prompt pastes text plus Enter, so a prompt sent while the user types in that pane
// is glued to the draft and submitted with it. Only send to an idle or done agent with an empty input box.
// A small race remains: the user can start typing between the check and the send.
import { inputDraft } from "./screen.mjs";

function firstLine(s) {
  const line = String(s ?? "").trim().split("\n")[0];
  try { return JSON.parse(line)?.error?.message ?? line.slice(0, 200); } catch { return line.slice(0, 200); }
}

// run(args) runs herdr with these args and resolves to { ok, stdout, stderr }.
export async function readiness(run, target, name = target) {
  const get = await run(["agent", "get", target]);
  if (!get.ok) return { ok: false, fatal: true, reason: `${name} not found: ${firstLine(get.stderr || get.stdout) || "herdr agent get failed"}` };
  let status = null;
  try { status = JSON.parse(get.stdout)?.result?.agent?.agent_status ?? null; } catch {}
  if (status !== "idle" && status !== "done") return { ok: false, status, reason: `${name} is ${status ?? "unknown"}; prompts only go to idle or done agents` };
  const read = await run(["agent", "read", target, "--source", "visible", "--format", "ansi"]);
  if (!read.ok) return { ok: false, status, reason: `cannot read the screen of ${name}` };
  let text = read.stdout;
  try { const j = JSON.parse(text); text = j?.result?.text ?? j?.result?.content ?? text; } catch {}
  const draft = inputDraft(text);
  if (draft === null) return { ok: false, status, reason: `no input box visible on ${name}` };
  if (draft) return { ok: false, status, draft: true, reason: `${name} has a draft in the input box; waiting until it is sent or cleared` };
  return { ok: true, status };
}

// Rechecks every interval until the agent is ready or the timeout runs out, then sends the prompt.
export async function promptWhenReady(run, target, text, { timeout = 100000, interval = 2000, sleep, now = Date.now, onWait } = {}) {
  sleep ??= (ms) => new Promise((r) => setTimeout(r, ms));
  const end = now() + timeout;
  let last = null;
  for (;;) {
    const r = await readiness(run, target);
    if (r.fatal) return r;
    if (r.ok) {
      const p = await run(["agent", "prompt", target, text]);
      return p.ok ? { ok: true } : { ok: false, reason: `prompt failed: ${firstLine(p.stderr || p.stdout) || "herdr agent prompt failed"}` };
    }
    if (r.reason !== last) onWait?.(r.reason);
    last = r.reason;
    if (now() + interval > end) return { ok: false, timeout: true, reason: `gave up after ${timeout / 1000} s: ${r.reason}` };
    await sleep(interval);
  }
}
