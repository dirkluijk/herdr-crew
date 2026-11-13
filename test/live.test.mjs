import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotKey, createHub, createScheduler, createJsonStream } from "../lib/live.mjs";

const snap = (status, updatedAt = "2026-11-13T12:00:00.000Z") => ({ updatedAt, workspace: "w1", agents: [{ id: "a", status }] });
const fakeRes = () => ({ frames: [], write(f) { this.frames.push(f); } });

test("snapshotKey ignores updatedAt and sees every other change", () => {
  assert.equal(snapshotKey(snap("idle", "2026-11-13T12:00:00Z")), snapshotKey(snap("idle", "2026-11-13T12:00:01Z")));
  assert.notEqual(snapshotKey(snap("idle")), snapshotKey(snap("working")));
  assert.notEqual(snapshotKey(snap("idle")), snapshotKey({ ...snap("idle"), workspace: "w2" }));
});

test("hub sends a new client the current snapshot right away", () => {
  const hub = createHub();
  const res = fakeRes();
  hub.add(res, snap("idle"));
  assert.equal(hub.size, 1);
  assert.deepEqual(JSON.parse(res.frames[0].replace(/^data: /, "")), snap("idle"));
  hub.delete(res);
  assert.equal(hub.size, 0);
});

test("hub only sends changed snapshots, with a heartbeat in between", () => {
  let t = 0;
  const hub = createHub({ heartbeatMs: 5000, now: () => t });
  const res = fakeRes();
  hub.add(res, snap("idle"));
  assert.equal(hub.publish(snap("idle", "a")), "snapshot");
  t = 1000;
  assert.equal(hub.publish(snap("idle", "b")), null);
  t = 4999;
  assert.equal(hub.publish(snap("idle", "c")), null);
  t = 5000;
  assert.equal(hub.publish(snap("idle", "d")), "alive");
  t = 6000;
  assert.equal(hub.publish(snap("working", "e")), "snapshot");
  t = 7000;
  assert.equal(hub.publish(snap("working", "f")), null);
  assert.equal(res.frames.length, 4);
  assert.equal(res.frames[2], 'event: alive\ndata: {"updatedAt":"d"}\n\n');
  assert.equal(JSON.parse(res.frames[3].replace(/^data: /, "")).agents[0].status, "working");
});

function fakeTimers() {
  const timers = new Map();
  let id = 0;
  return {
    timers,
    setTimer: (fn, ms) => (timers.set(++id, { fn, ms }), id),
    clearTimer: (k) => timers.delete(k),
    fire() { const [[k, { fn }]] = timers; timers.delete(k); return fn(); },
  };
}

test("scheduler waits the current interval after each run", async () => {
  const ft = fakeTimers();
  let runs = 0;
  let fast = false;
  const s = createScheduler({ run: async () => { runs++; }, interval: () => (fast ? 1000 : 4000), ...ft });
  await s.start();
  assert.equal(runs, 1);
  assert.deepEqual([...ft.timers.values()].map((x) => x.ms), [4000]);
  fast = true;
  await ft.fire();
  assert.equal(runs, 2);
  assert.deepEqual([...ft.timers.values()].map((x) => x.ms), [1000]);
  s.stop();
  assert.equal(ft.timers.size, 0);
});

test("scheduler kick runs now and cancels the pending timer", async () => {
  const ft = fakeTimers();
  let runs = 0;
  const s = createScheduler({ run: async () => { runs++; }, interval: () => 4000, ...ft });
  await s.start();
  await s.kick();
  assert.equal(runs, 2);
  assert.equal(ft.timers.size, 1);
});

test("scheduler coalesces kicks during a run into one extra run", async () => {
  const ft = fakeTimers();
  let runs = 0;
  let release;
  const s = createScheduler({
    run: () => { runs++; return runs === 1 ? new Promise((r) => { release = r; }) : Promise.resolve(); },
    interval: () => 4000, ...ft,
  });
  const first = s.start();
  s.kick();
  s.kick();
  s.kick();
  release();
  await first;
  assert.equal(runs, 2);
  assert.equal(ft.timers.size, 1);
});

test("scheduler keeps going after a failed run", async () => {
  const ft = fakeTimers();
  const errors = [];
  const s = createScheduler({ run: async () => { throw new Error("boom"); }, interval: () => 1000, onError: (e) => errors.push(e.message), ...ft });
  await s.start();
  assert.deepEqual(errors, ["boom"]);
  assert.equal(ft.timers.size, 1);
});

test("JSON stream splits concatenated pretty-printed values across chunks", () => {
  const values = [];
  const feed = createJsonStream((v) => values.push(v));
  const a = JSON.stringify({ tasks: [{ id: "X-1", title: "brace } and \"quote\" and [ in a string \\" }] }, null, 2);
  const b = JSON.stringify({ tasks: [] }, null, 2);
  const all = `${a}\n${b}\n[1,2]`;
  for (let i = 0; i < all.length; i += 7) feed(all.slice(i, i + 7));
  assert.deepEqual(values, [JSON.parse(a), JSON.parse(b), [1, 2]]);
});

test("JSON stream skips noise between values and reports broken ones", () => {
  const values = [];
  const errors = [];
  const feed = createJsonStream((v) => values.push(v), (e) => errors.push(e));
  feed('warning: "quoted" text\n{"a":1}\n{"b":tru}\n{"c":2}');
  assert.deepEqual(values, [{ a: 1 }, { c: 2 }]);
  assert.equal(errors.length, 1);
});

test("JSON stream drops a value that grows past the limit", () => {
  const values = [];
  const errors = [];
  const feed = createJsonStream((v) => values.push(v), (e) => errors.push(e), 20);
  feed('{"a":"' + "x".repeat(50));
  assert.equal(errors.length, 1);
  feed('{"ok":true}');
  assert.deepEqual(values, [{ ok: true }]);
});
