import { test } from "node:test";
import assert from "node:assert/strict";
import { personasFromPlan, detectTerminalApp } from "../lib/init.mjs";

const PLAN = `# Plan

The orchestrator is \`crew-orch\`, persona Noor (she/her). Messages from Noor start with "Noor hier." (or "Noor here.").

## Milestones

- Parser: \`m1-parser\` (Pim, he/him, curious and precise).
- Tests: \`m2-tests\` (Tess, she/her). Docs: \`m3-docs\` (Dex, they/them)
- Mascot \`bertus\` (Bertus, it) keeps watch.
- Run \`npm test\` (once, before a commit) to check.
- Helper \`m4-misc\` (Mo, backend) has no pronouns.
- Duplicate \`m1-parser\` (Other, she/her) is ignored.
`;

test("finds the lead with prefixes and the personas with pronouns", () => {
  const out = personasFromPlan(PLAN);
  const by = Object.fromEntries(out.map((p) => [p.agent, p]));
  assert.deepEqual(Object.keys(by), ["crew-orch", "m1-parser", "m2-tests", "m3-docs", "bertus"]);
  assert.deepEqual(by["crew-orch"], { agent: "crew-orch", lead: true, name: "Noor", pronouns: "she/her", role: "Orchestrator", messagePrefixes: ["Noor hier.", "Noor here."] });
  assert.deepEqual(by["m1-parser"], { agent: "m1-parser", name: "Pim", pronouns: "he/him", role: "Parser" });
  assert.equal(by["m2-tests"].role, "Tests");
  assert.equal(by["m3-docs"].role, "Docs");
  assert.equal(by["m3-docs"].pronouns, "they/them");
  assert.equal(by.bertus.pronouns, "it");
  assert.equal(by.bertus.role, "");
});

test("skips back-ticked names with a parenthesis that are not personas", () => {
  const agents = personasFromPlan(PLAN).map((p) => p.agent);
  assert.ok(!agents.includes("npm"));
  assert.ok(!agents.includes("m4-misc"));
});

test("the first mention of an agent wins", () => {
  assert.equal(personasFromPlan(PLAN).find((p) => p.agent === "m1-parser").name, "Pim");
});

test("a lead without prefixes gets a default prefix", () => {
  const [p] = personasFromPlan("Orchestrator `boss`, persona Vera (she/her).");
  assert.deepEqual(p.messagePrefixes, ["Vera here."]);
});

test("an empty plan gives no personas", () => {
  assert.deepEqual(personasFromPlan(""), []);
});

test("detectTerminalApp: the outer terminal is found inside Herdr on macOS", () => {
  const herdr = { TERM_PROGRAM: "herdr", TERM: "xterm-256color" };
  assert.equal(detectTerminalApp({ ...herdr, __CFBundleIdentifier: "org.alacritty", ALACRITTY_SOCKET: "/tmp/s" }, "darwin"), "Alacritty");
  assert.equal(detectTerminalApp({ ...herdr, __CFBundleIdentifier: "com.googlecode.iterm2" }, "darwin"), "iTerm");
  assert.equal(detectTerminalApp({ ...herdr, ALACRITTY_WINDOW_ID: "1" }, "darwin"), "Alacritty");
  assert.equal(detectTerminalApp({ ...herdr, KITTY_WINDOW_ID: "1" }, "darwin"), "kitty");
  assert.equal(detectTerminalApp({ ...herdr, GHOSTTY_RESOURCES_DIR: "/x" }, "darwin"), "Ghostty");
  assert.equal(detectTerminalApp({ TERM_PROGRAM: "Apple_Terminal" }, "darwin"), "Terminal");
  assert.equal(detectTerminalApp({ TERM_PROGRAM: "WezTerm" }, "darwin"), "WezTerm");
});

test("detectTerminalApp: HERDR_CREW_TERMINAL wins, unknown terminals and other platforms give null", () => {
  assert.equal(detectTerminalApp({ HERDR_CREW_TERMINAL: "Ghostty", __CFBundleIdentifier: "org.alacritty" }, "darwin"), "Ghostty");
  assert.equal(detectTerminalApp({ HERDR_CREW_TERMINAL: "Ghostty" }, "linux"), "Ghostty");
  assert.equal(detectTerminalApp({ TERM_PROGRAM: "herdr" }, "darwin"), null);
  assert.equal(detectTerminalApp({ TERM_PROGRAM: "tmux", __CFBundleIdentifier: "com.example.unknown" }, "darwin"), null);
  assert.equal(detectTerminalApp({ TERM_PROGRAM: "vscode" }, "darwin"), null);
  assert.equal(detectTerminalApp({ __CFBundleIdentifier: "org.alacritty", ALACRITTY_SOCKET: "/tmp/s" }, "linux"), null);
});
