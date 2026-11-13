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

// Latest assistant text, current activity, last prompt and context use from a rendered OpenCode screen.
export function parseScreen(raw, shellActivity = "shell command running") {
  const lines = stripAnsi(raw).split("\n").map((l) => l.replace(/\s+$/, ""));
  const footer = lines.findLast((l) => /\d+(\.\d+)?[KM] \(\d+%\)/.test(l));
  const um = footer?.match(/(\d+(?:\.\d+)?)([KM]) \((\d+)%\)/);
  const usage = um ? { tokensK: Number(um[1]) * (um[2] === "M" ? 1000 : 1), pct: Number(um[3]) } : null;
  let i = lines.length - 1;
  const skip = (l) => !l.trim() || /^\s*[╹▀⬝]/.test(l) || /ctrl\+p commands/.test(l);
  while (i >= 0 && skip(lines[i])) i--;
  while (i >= 0 && /^\s*┃/.test(lines[i])) i--; // input box
  let activity = null;
  let prompt = null;
  const msg = [];
  while (i >= 0) {
    if (/^\s*┃/.test(lines[i])) {
      // A bordered block is either an earlier user prompt or an expanded tool call (starts with "$ ", a spinner or "# ").
      const block = [];
      for (; i >= 0 && /^\s*┃/.test(lines[i]); i--) block.unshift(lines[i].replace(/^\s*┃\s?/, "").trim());
      const first = block.find(Boolean) ?? "";
      if (!first) continue;
      if (/^(\$ |[⠀-⣿] |# )/.test(first)) {
        if (!activity && /^[⠀-⣿]/.test(first)) activity = shellActivity;
        if (msg.length) msg.push("");
        continue;
      }
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
