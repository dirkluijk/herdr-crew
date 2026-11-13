import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readiness, promptWhenReady } from "../lib/send.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "screens");
const SCREEN = Object.fromEntries(["session-empty", "session-draft", "question"].map((n) => [n, readFileSync(join(DIR, `${n}.ansi`), "utf8")]));

// A fake herdr: each check reads the next state from the list, the last one repeats.
function fakeHerdr(states) {
  const calls = [];
  let k = -1;
  const run = async (args) => {
    calls.push(args);
    if (args[1] === "get") {
      k = Math.min(k + 1, states.length - 1);
      const s = states[k];
      return s.missing ? { ok: false, stdout: "", stderr: "agent not found: nobody\n" } : { ok: true, stdout: JSON.stringify({ result: { agent: { agent_status: s.status } } }) };
    }
    if (args[1] === "read") return { ok: true, stdout: SCREEN[states[k].screen] };
    if (args[1] === "prompt") return { ok: true, stdout: "{}" };
    return { ok: false, stderr: "unexpected" };
  };
  return { run, calls, prompts: () => calls.filter((a) => a[1] === "prompt") };
}

const clock = () => {
  let t = 0;
  return { now: () => t, sleep: async (ms) => { t += ms; } };
};

test("ready: idle with an empty input box", async () => {
  const h = fakeHerdr([{ status: "idle", screen: "session-empty" }]);
  assert.deepEqual(await readiness(h.run, "crew-orch"), { ok: true, status: "idle" });
  assert.deepEqual(h.calls[1], ["agent", "read", "crew-orch", "--source", "visible", "--format", "ansi"]);
});

test("not ready: a draft, a dialog, a working agent", async () => {
  const draft = await readiness(fakeHerdr([{ status: "done", screen: "session-draft" }]).run, "crew-orch");
  assert.equal(draft.ok, false);
  assert.equal(draft.draft, true);
  assert.match(draft.reason, /draft in the input box/);
  assert.doesNotMatch(draft.reason, /waarom/, "the draft itself stays out of messages and logs");
  assert.match((await readiness(fakeHerdr([{ status: "idle", screen: "question" }]).run, "x")).reason, /no input box/);
  const busy = fakeHerdr([{ status: "working", screen: "session-empty" }]);
  assert.match((await readiness(busy.run, "x")).reason, /x is working/);
  assert.equal(busy.calls.length, 1, "no screen read for a busy agent");
});

test("send waits for the draft to go, then prompts once", async () => {
  const h = fakeHerdr([
    { status: "working", screen: "session-empty" },
    { status: "idle", screen: "session-draft" },
    { status: "idle", screen: "session-draft" },
    { status: "idle", screen: "session-empty" },
  ]);
  const waits = [];
  const r = await promptWhenReady(h.run, "crew-orch", "[m3-skill] CREW-10: done.", { ...clock(), onWait: (w) => waits.push(w) });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(h.prompts(), [["agent", "prompt", "crew-orch", "[m3-skill] CREW-10: done."]]);
  assert.equal(waits.length, 2, "each new reason is reported once");
});

test("send gives up after the timeout without prompting", async () => {
  const h = fakeHerdr([{ status: "idle", screen: "session-draft" }]);
  const r = await promptWhenReady(h.run, "crew-orch", "hello", { ...clock(), timeout: 10000, interval: 2000 });
  assert.equal(r.ok, false);
  assert.equal(r.timeout, true);
  assert.match(r.reason, /gave up after 10 s: crew-orch has a draft/);
  assert.deepEqual(h.prompts(), []);
  assert.equal(h.calls.filter((a) => a[1] === "get").length, 6);
});

test("send stops at once for an unknown agent", async () => {
  const h = fakeHerdr([{ missing: true }]);
  const r = await promptWhenReady(h.run, "nobody", "hello", clock());
  assert.equal(r.ok, false);
  assert.equal(r.timeout, undefined);
  assert.match(r.reason, /nobody not found: agent not found/);
  assert.equal(h.calls.length, 1);
});
