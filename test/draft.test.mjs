import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inputDraft, stripAnsi } from "../lib/screen.mjs";

// Captured with `herdr agent read <pane> --source visible --format ansi` from a scratch OpenCode 2.2.5 pane
// (tokyonight), with the project path and MCP server name replaced.
const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "screens");
const capture = (name) => readFileSync(join(DIR, `${name}.ansi`), "utf8");
const BOX = "122;162;247";
const BG = "26;27;38";

const CASES = {
  "home-empty": "",
  "session-empty": "",
  "session-working": "",
  "home-draft1": "Kun je even kijken naar de tests voor de parser",
  "session-draft": "Nog een vraag: waarom faalt de build op main?",
  "home-draft2": "Kun je even kijken naar de tests voor de parser\nen daarna de README bijwerken",
  "home-wrap": "Kun je even kijken naar de tests voor de parser\nen daarna de README bijwerken en ook nog de changelog want die loopt\nachter sinds de vorige release van vorige week",
  question: null,
};

for (const [name, want] of Object.entries(CASES)) {
  test(`input box in ${name}`, () => {
    assert.equal(inputDraft(capture(name)), want);
    assert.equal(inputDraft(stripAnsi(capture(name))), want, "without colours");
  });
}

test("the placeholder of a new session counts as empty", () => {
  assert.match(stripAnsi(capture("home-empty")), /Ask anything/);
  assert.equal(inputDraft(capture("home-empty")), "");
});

test("a toast above the box and the wrapped agent line are not part of the draft", () => {
  const s = stripAnsi(capture("home-draft1"));
  assert.match(s, /MCP server needs authentication/);
  assert.match(s, /┃  d\s*$/m);
  assert.equal(inputDraft(capture("home-draft1")), CASES["home-draft1"]);
});

test("a tool block right above an empty box is not a draft", () => {
  const lines = capture("session-empty").split("\n");
  const top = lines.findLastIndex((l) => /╹/.test(l)) - 4;
  assert.equal(stripAnsi(lines[top]).trim(), "┃");
  const tool = lines[top].replace(`\x1b[38;2;${BOX}m\x1b[48;2;${BG}m┃`, `\x1b[38;2;${BG}m\x1b[48;2;${BG}m┃`);
  lines.splice(top, 0, tool.replace(/┃(\x1b\[0m\x1b\[[0-9;]*m\x1b\[[0-9;]*m) /, "┃$1 Red"), tool);
  assert.equal(inputDraft(lines.join("\n")), "");
  assert.equal(inputDraft(stripAnsi(lines.join("\n"))), "Red", "without colours it errs on the side of waiting");
});

test("no input box, no answer", () => {
  assert.equal(inputDraft(""), null);
  assert.equal(inputDraft(null), null);
  assert.equal(inputDraft("plain shell output\n$ "), null);
});
