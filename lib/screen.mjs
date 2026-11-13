// Text helpers and the OpenCode screen parser. All screen text passes through redact() before it leaves the server.

export const stripAnsi = (s) => String(s ?? "").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(\x07|\x1b\\)/g, "");

export function redact(s) {
  return String(s ?? "")
    .replace(/\b(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{10,}/g, "[redacted]")
    .replace(/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[redacted]")
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{12,}/g, "[redacted]")
    .replace(/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}/g, "[redacted]")
    .replace(/\b(password|passwd|secret|token|api[_-]?key|authorization)(\s*[:=]\s*)\S+/gi, "$1$2[redacted]")
    .replace(/\b[A-Za-z0-9+/]{40,}={0,2}/g, "[redacted]");
}

export const norm = (s) => String(s ?? "").replace(/\s+/g, "");

const META = [
  /^Build · /, /^Plan · /, /^\+ \d+ (command|thought|tool|edit|read)/, /^Press ctrl\+/, /esc interrupt/,
  /ctrl\+p commands/, /^[⠀-⣿]/, /^[╹▀]/, /^↓ /, /^Jump to latest/,
];

const TOOL_START = /^(\$ |[⠀-⣿] |# |Ask anything)/;
const OUTPUT_LINE = /^(✓|✔|✅|✗|✘|❌|⚠|ℹ|✨|\(no output\)$|Exited with code \d|(not )?ok \d+\b|# (tests|suites|pass|fail|duration_ms) \d|Stacks?:|Deployment time|Total time|npm (ERR|warn)|at \S.*:\d+:\d+\)?$)/;
const OUTPUT_FIRST = /^(Stacks?:|\(no output\)$|Exited with code \d|npm (ERR|warn)|TAP version)/;

// Text-only guess for screens without colour information and for values stored by older versions.
export function looksLikeToolOutput(text) {
  const lines = String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return false;
  if (/^\[[a-z][a-z0-9_-]*\]/.test(lines[0])) return false;
  if (TOOL_START.test(lines[0]) || OUTPUT_FIRST.test(lines[0])) return true;
  return lines.filter((l) => OUTPUT_LINE.test(l)).length >= 2;
}

const ESC = /\x1b\[([0-9;?]*)([ -/]*[@-~])|\x1b\][^\x07]*(?:\x07|\x1b\\)/y;

function applySgr(state, params) {
  const p = params === "" ? [0] : params.split(";").map(Number);
  for (let k = 0; k < p.length; k++) {
    const n = p[k];
    if (n === 0) state.fg = state.bg = "default";
    else if (n === 38 || n === 48) {
      const key = n === 38 ? "fg" : "bg";
      if (p[k + 1] === 2) { state[key] = p.slice(k + 2, k + 5).join(","); k += 4; }
      else if (p[k + 1] === 5) { state[key] = `256:${p[k + 2]}`; k += 2; }
    } else if (n === 39) state.fg = "default";
    else if (n === 49) state.bg = "default";
    else if ((n >= 30 && n <= 37) || (n >= 90 && n <= 97)) state.fg = `c${n}`;
    else if ((n >= 40 && n <= 47) || (n >= 100 && n <= 107)) state.bg = `c${n - 10}`;
  }
}

// OpenCode draws the left border of tool blocks in the screen background colour and the border of
// user prompts in the agent colour. true: tool block, false: prompt, null: no colour information.
export function borderIsTool(rawLine) {
  const state = { fg: "default", bg: "default" };
  let coloured = false;
  let lead = null;
  for (let k = 0; k < rawLine.length;) {
    ESC.lastIndex = k;
    const m = ESC.exec(rawLine);
    if (m) {
      if (m[2] === "m") { applySgr(state, m[1]); coloured = true; }
      k = ESC.lastIndex;
      continue;
    }
    const ch = rawLine[k];
    if (ch === "┃") return coloured && lead !== null ? state.fg === lead : null;
    if (!/\s/.test(ch)) return null;
    lead = state.bg;
    k++;
  }
  return null;
}

// Latest assistant text, current activity, last prompt and context use from a rendered OpenCode screen.
// raw may contain ANSI colours (herdr agent read --format ansi); without them tool blocks are guessed from text.
export function parseScreen(raw, shellActivity = "shell command running") {
  const rawLines = String(raw ?? "").split("\n");
  const lines = rawLines.map((l) => stripAnsi(l).replace(/\s+$/, ""));
  const footer = lines.findLast((l) => /\d+(\.\d+)?[KM] \(\d+%\)/.test(l));
  const um = footer?.match(/(\d+(?:\.\d+)?)([KM]) \((\d+)%\)/);
  const usage = um ? { tokensK: Number(um[1]) * (um[2] === "M" ? 1000 : 1), pct: Number(um[3]) } : null;
  let i = lines.length - 1;
  const skip = (l) => !l.trim() || /^\s*[╹▀⬝]/.test(l) || /ctrl\+p commands/.test(l);
  while (i >= 0 && skip(lines[i])) i--;
  // Input box; a tool block right above it has a different border colour.
  for (let box = null; i >= 0 && /^\s*┃/.test(lines[i]); i--) {
    const c = borderIsTool(rawLines[i]);
    if (c !== null && box !== null && c !== box) break;
    box ??= c;
  }
  let activity = null;
  let prompt = null;
  const msg = [];
  while (i >= 0) {
    if (/^\s*┃/.test(lines[i])) {
      // A bordered block is either an earlier user prompt or an expanded tool call (shell, question, tool output).
      const block = [];
      const colour = [];
      for (; i >= 0 && /^\s*┃/.test(lines[i]); i--) {
        const c = borderIsTool(rawLines[i]);
        // Adjacent blocks with a different border colour are separate blocks.
        if (c !== null && colour.some((k) => k !== null && k !== c)) break;
        block.unshift(lines[i].replace(/^\s*┃\s?/, "").trim());
        colour.unshift(c);
      }
      const first = block.find(Boolean) ?? "";
      if (!first) continue;
      // An empty input box (placeholder text plus the agent and model line) is not a message.
      if (/^Ask anything/.test(first) || block.every((l) => !l || /^Ask anything|^(Build|Plan) · /.test(l))) continue;
      const known = colour.filter((c) => c !== null);
      const tool = known.length ? known.filter(Boolean).length * 2 > known.length : looksLikeToolOutput(block.join("\n"));
      if (tool) {
        if (!activity && /^[⠀-⣿]/.test(first)) activity = shellActivity;
        if (msg.length) msg.push("");
        continue;
      }
      // Cut off at the top of the viewport: start and sender prefix are unknown, keep the stored value instead.
      if (i < 0 && block[0]) break;
      prompt = block.filter(Boolean).join("\n").trim() || null;
      break;
    }
    const t = lines[i--].trim();
    if (!t) { if (msg.length) msg.push(""); continue; }
    if (META.some((re) => re.test(t))) {
      if (!activity && /^[⠀-⣿]/.test(t)) activity = t.replace(/^[⠀-⣿]\s*/, "");
      continue;
    }
    msg.push(t);
    if (msg.filter(Boolean).length >= 30) break;
  }
  msg.reverse();
  while (msg.length && !msg[0]) msg.shift();
  const text = msg.filter((l, k) => l || (msg[k - 1] && msg[k + 1])).filter((l) => !/^[│┌└├─┬┴┼┐┘┤ ]+$/.test(l));
  let tail = text.filter(Boolean).slice(-5).join("\n").trim();
  if (tail.length > 500) tail = "…" + tail.slice(-500);
  const context = redact(text.filter(Boolean).slice(-60).join("\n")).slice(-5000);
  return {
    bubble: tail ? redact(tail) : null,
    context: tail ? context : null,
    activity: activity ? redact(activity).slice(0, 80) : null,
    prompt: prompt ? redact(prompt).slice(0, 600) : null,
    promptBeforeReply: !!tail,
    usage,
  };
}

// Foreground colour of the character at a column, or null when the line has no colour information.
function fgAt(rawLine, col) {
  const state = { fg: "default", bg: "default" };
  let coloured = false;
  let n = 0;
  for (let k = 0; k < rawLine.length;) {
    ESC.lastIndex = k;
    const m = ESC.exec(rawLine);
    if (m) {
      if (m[2] === "m") { applySgr(state, m[1]); coloured = true; }
      k = ESC.lastIndex;
      continue;
    }
    const ch = String.fromCodePoint(rawLine.codePointAt(k));
    if (n === col) return coloured ? state.fg : null;
    n++;
    k += ch.length;
  }
  return null;
}

// Text in the OpenCode input box: "" when it is empty or shows the placeholder, null when no input box is
// visible (a question or permission dialog, another view, another kind of agent). The box is the run of ┃ lines
// above the ╹▀ edge, in the same column and border colour; its last non-blank lines are the agent and model line,
// which OpenCode always separates from the typed text by a blank line. Without colours a tool block right above
// the box counts as typed text, which errs on the side of waiting.
export function inputDraft(raw) {
  const rawLines = String(raw ?? "").split("\n");
  const lines = rawLines.map((l) => [...stripAnsi(l).replace(/\s+$/, "")]);
  const end = lines.findLastIndex((l) => /^\s*╹▀/.test(l.join("")));
  if (end < 0) return null;
  const col = lines[end].indexOf("╹");
  const edge = fgAt(rawLines[end], col);
  const box = [];
  for (let i = end - 1; i >= 0 && lines[i][col] === "┃" && !lines[i].slice(0, col).join("").trim(); i--) {
    const c = edge === null ? null : fgAt(rawLines[i], col);
    if (c !== null && c !== edge) break;
    box.unshift(lines[i].slice(col + 1).join("").trim());
  }
  while (box.length && !box.at(-1)) box.pop();
  const gap = box.findLastIndex((l) => !l);
  if (!box.length || gap < 0) return null;
  const draft = box.slice(0, gap).join("\n").trim();
  return /^Ask anything/.test(draft) && !draft.includes("\n") ? "" : draft;
}

export function trimBubble(text) {
  const lines = String(text).split("\n").map((l) => l.trim()).filter((l) => l && !/^[|│┌└├─┬┴┼┐┘┤:\- ]+$/.test(l));
  let tail = lines.slice(-5).join("\n");
  if (tail.length > 500) tail = "…" + tail.slice(-500);
  return tail ? redact(stripAnsi(tail)) : null;
}

export function cleanSay(v, max = 400) {
  if (typeof v !== "string" || !v.trim()) return null;
  return redact(stripAnsi(v)).replace(/\\n/g, "\n").trim().slice(0, max);
}
