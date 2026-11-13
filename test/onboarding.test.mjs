import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerPersona, validPersona } from "../lib/onboarding.mjs";

const dir = await mkdtemp(join(tmpdir(), "herdr-crew-test-"));
const file = join(dir, ".herdr-crew.json");
const read = async () => JSON.parse(await readFile(file, "utf8"));

beforeEach(async () => {
  await writeFile(file, JSON.stringify({
    title: "demo", port: 5999, theme: { name: "keep me" },
    personas: [{ agent: "m1-parser", name: "Pim", pronouns: "he/him", role: "parser", tasks: ["CREW-1"], quirk: "hums", lead: true }],
  }));
});
after(() => rm(dir, { recursive: true, force: true }));

test("adds a new persona with an empty task list and keeps the other keys", async () => {
  const p = await registerPersona(file, { agent: "m2-tests", name: "Tess", pronouns: "she/her", role: "tests", traits: ["thorough", "", "x".repeat(80)] });
  assert.deepEqual(p, { agent: "m2-tests", name: "Tess", pronouns: "she/her", role: "tests", traits: ["thorough", "x".repeat(60)] });
  const cfg = await read();
  assert.equal(cfg.title, "demo");
  assert.equal(cfg.port, 5999);
  assert.deepEqual(cfg.theme, { name: "keep me" });
  assert.equal(cfg.personas.length, 2);
  assert.deepEqual(cfg.personas[1], { ...p, tasks: [] });
});

test("creates the config file when it does not exist", async () => {
  const other = join(dir, "new.json");
  await registerPersona(other, { agent: "solo", name: "Solo" });
  assert.deepEqual(JSON.parse(await readFile(other, "utf8")).personas, [{ agent: "solo", name: "Solo", pronouns: "", role: "", tasks: [] }]);
});

test("updating one field keeps the rest of the persona", async () => {
  const p = await registerPersona(file, { agent: "m1-parser", avatar: "pim", name: undefined, pronouns: "", role: "" });
  const expected = { agent: "m1-parser", name: "Pim", pronouns: "he/him", role: "parser", tasks: ["CREW-1"], quirk: "hums", lead: true, avatar: "pim" };
  assert.deepEqual(p, expected);
  assert.deepEqual((await read()).personas, [expected]);
});

test("an update can change the name", async () => {
  await registerPersona(file, { agent: "m1-parser", name: "Pieter" });
  const [p] = (await read()).personas;
  assert.equal(p.name, "Pieter");
  assert.equal(p.role, "parser");
});

test("invalid personas are refused and leave the file untouched", async () => {
  const before = await readFile(file, "utf8");
  for (const input of [
    { agent: "Bad-Name", name: "X" },
    { agent: "1abc", name: "X" },
    { agent: "new-one" },
    { agent: "new-one", name: "   " },
    { agent: undefined, name: "X" },
  ]) assert.equal(await registerPersona(file, input), null, JSON.stringify(input));
  assert.equal(await readFile(file, "utf8"), before);
});

test("an agent name longer than 32 characters is refused, not cut", async () => {
  const before = await readFile(file, "utf8");
  assert.equal(await registerPersona(file, { agent: "a".repeat(33), name: "X" }), null);
  assert.equal(await readFile(file, "utf8"), before);
  assert.equal(validPersona({ agent: "a".repeat(32), name: "X" }).agent, "a".repeat(32));
  assert.equal(validPersona({ agent: " m2-tests ", name: "X" }).agent, "m2-tests");
  assert.equal(validPersona({ agent: "m2\u0007tests", name: "X" }), null);
});

test("validPersona strips control characters and angle brackets, and drops bad avatar keys", () => {
  assert.deepEqual(validPersona({ agent: "a", name: "<b>Tess</b>\u0007", role: "r".repeat(200), avatar: "../x", lead: "yes" }),
    { agent: "a", name: "bTess/b", pronouns: "", role: "r".repeat(140) });
  assert.equal(validPersona({ agent: "a", name: "A", avatar: "ok-key", lead: true }).avatar, "ok-key");
  assert.equal(validPersona({ agent: "a", name: "A", traits: ["1", "2", "3", "4", "5", "6"] }).traits.length, 5);
});
