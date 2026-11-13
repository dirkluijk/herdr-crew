// Keeps the browser close to Herdr without waste: a poll scheduler that runs faster while someone watches,
// an SSE hub that only sends snapshots that changed, and a reader for `backlog task list --json --watch`.
import { createHash } from "node:crypto";

// updatedAt changes on every poll, so it is not part of the content.
export function snapshotKey(snap) {
  const { updatedAt, ...rest } = snap ?? {};
  return createHash("sha1").update(JSON.stringify(rest)).digest("base64url");
}

export function createHub({ heartbeatMs = 5000, now = Date.now } = {}) {
  const clients = new Set();
  let key = null;
  let lastWrite = 0;
  const write = (frame) => {
    for (const res of clients) res.write(frame);
    lastWrite = now();
  };
  return {
    get size() { return clients.size; },
    add(res, snap) {
      clients.add(res);
      res.write(`data: ${JSON.stringify(snap)}\n\n`);
    },
    delete(res) { clients.delete(res); },
    // "snapshot" when the content changed, "alive" for a small heartbeat so the page can tell a quiet crew
    // from a dead server, null when nothing was sent.
    publish(snap) {
      const k = snapshotKey(snap);
      if (k !== key) {
        key = k;
        write(`data: ${JSON.stringify(snap)}\n\n`);
        return "snapshot";
      }
      if (now() - lastWrite >= heartbeatMs) {
        write(`event: alive\ndata: ${JSON.stringify({ updatedAt: snap.updatedAt ?? null })}\n\n`);
        return "alive";
      }
      return null;
    },
  };
}

// Runs fn, waits interval() after it finished, and repeats. kick() runs it right away; a kick during a run
// queues exactly one extra run, so a burst of actions costs at most two polls.
export function createScheduler({ run, interval, onError = console.error, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  let running = null;
  let again = false;
  let stopped = false;
  async function tick() {
    if (stopped) return;
    if (timer) { clearTimer(timer); timer = null; }
    if (running) { again = true; return running; }
    running = (async () => { try { await run(); } catch (e) { onError(e); } })();
    await running;
    running = null;
    if (stopped) return;
    if (again) { again = false; return tick(); }
    timer = setTimer(tick, interval());
    timer?.unref?.();
  }
  return {
    start: tick,
    kick: tick,
    stop() { stopped = true; if (timer) clearTimer(timer); timer = null; },
  };
}

// Splits a stream of concatenated JSON values (objects or arrays) and calls onValue for each complete one.
export function createJsonStream(onValue, onError = () => {}, maxBytes = 32 * 1024 * 1024) {
  let buf = "";
  let i = 0;
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  const reset = () => { buf = ""; i = 0; depth = 0; start = -1; inString = false; escaped = false; };
  return (chunk) => {
    buf += chunk;
    for (; i < buf.length; i++) {
      const c = buf[i];
      if (depth === 0) {
        if (c === "{" || c === "[") { depth = 1; start = i; }
        continue;
      }
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === "{" || c === "[") depth++;
      else if ((c === "}" || c === "]") && --depth === 0) {
        const text = buf.slice(start, i + 1);
        buf = buf.slice(i + 1);
        i = -1;
        start = -1;
        let value;
        try { value = JSON.parse(text); } catch (e) { onError(e); continue; }
        onValue(value);
      }
    }
    if (depth === 0) { buf = ""; i = 0; }
    else if (buf.length > maxBytes) { reset(); onError(new Error("JSON value too large")); }
  };
}
