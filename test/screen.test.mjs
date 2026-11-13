import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseScreen, borderIsTool, looksLikeToolOutput, stripAnsi } from "../lib/screen.mjs";
import { createCrew } from "../lib/crew.mjs";

// Screens rebuilt from `herdr agent read --source visible --format ansi` captures of OpenCode (tokyonight),
// with the same escape sequences per segment and made-up text.
const BG = "26;27;38";
const PANEL = "30;32;48";
const INPUT = "34;36;54";
const BUILD = "122;162;247";
const PLAN = "187;154;247";
const WHITE = "255;255;255";
const TEXT = "200;211;245";
const MUTED = "130;139;184";
const W = 100;

const seg = (fg, bg, s) => `\x1b[0m\x1b[38;2;${fg}m\x1b[48;2;${bg}m${s}`;
const pad = (used, bg) => seg(WHITE, bg, " ".repeat(Math.max(1, W - used))) + "\x1b[0m";
const blank = () => seg(WHITE, BG, " ".repeat(W)) + "\x1b[0m";
const say = (t, fg = TEXT) => seg(WHITE, BG, "    ") + seg(fg, BG, t) + pad(4 + t.length, BG);
const bordered = (border, t) => seg(WHITE, BG, "  ") + seg(border, PANEL, "┃") + seg(WHITE, PANEL, "  ") +
  (t ? seg(TEXT, PANEL, t) : "") + pad(5 + t.length, PANEL);
const block = (border, rows) => [bordered(border, ""), ...rows.map((t) => bordered(border, t)), bordered(border, "")];
const prompt = (rows, colour = BUILD) => block(colour, rows);
const tool = (rows) => block(BG, rows);
const footer = () => [
  ...["", "", ""].map(() => seg(WHITE, BG, "  ") + seg(BUILD, BG, "┃") + seg(WHITE, INPUT, " ".repeat(W - 3)) + "\x1b[0m"),
  seg(WHITE, BG, "  ") + seg(BUILD, BG, "┃") + seg(WHITE, INPUT, "  ") + seg(BUILD, INPUT, "Build") + seg(MUTED, INPUT, " · ") +
    seg(TEXT, INPUT, "Claude Opus 5.5") + pad(30, INPUT),
  seg(WHITE, BG, "  ") + seg(BUILD, BG, "╹") + seg(INPUT, BG, "▀".repeat(W - 3)) + "\x1b[0m",
  seg(WHITE, BG, "  ") + seg(MUTED, BG, "~/workspace/demo:main") + seg(WHITE, BG, "   ") + seg(MUTED, BG, "20.3K (2%)") +
    seg(WHITE, BG, "   ") + seg(TEXT, BG, "ctrl+p ") + seg(MUTED, BG, "commands") + "\x1b[0m",
  blank(),
];
const screen = (...parts) => parts.flat().join("\n");

const CDK = [
  "$ npx cdk deploy --all --require-approval never",
  "",
  "✨  Synthesis time: 12.4s",
  "demo-service-main-service-stack: deploying... [1/1]",
  "✅  demo-service-main-service-stack",
  "✨  Deployment time: 98.1s",
  "Stacks:",
  "demo-service-main-service-stack",
  "✨  Total time: 110.5s",
];
const NODE_TEST = ["✔ parses a prompt (1.1ms)", "✔ skips tool output (0.4ms)", "ℹ tests 2", "ℹ pass 2", "ℹ fail 0"];

test("CDK deploy output in a tool block is not the prompt", () => {
  const s = screen(blank(), prompt(["Deploy de main stack opnieuw"]), say("+ 1 command", MUTED), tool(CDK), say("Deploy is klaar."), footer());
  const r = parseScreen(s);
  assert.equal(r.prompt, "Deploy de main stack opnieuw");
  assert.match(r.bubble, /Deploy is klaar/);
  assert.deepEqual(r.usage, { tokensK: 20.3, pct: 2 });
});

test("tool output cut off at the top of the viewport is not the prompt", () => {
  const cut = tool(CDK).slice(4);
  assert.equal(stripAnsi(cut[0]).trim(), "┃  demo-service-main-service-stack: deploying... [1/1]");
  const s = screen(cut, say("Deploy is klaar."), footer());
  assert.equal(parseScreen(s).prompt, null);
  assert.equal(parseScreen(stripAnsi(s)).prompt, null);
});

test("test runner output without a shell line is recognised by colour", () => {
  const s = screen(blank(), prompt(["Draai de tests"]), tool(NODE_TEST), say("Alles groen."), footer());
  assert.equal(parseScreen(s).prompt, "Draai de tests");
});

test("a tool block right below a prompt, that only looks like a prompt, is split off and skipped by colour", () => {
  const s = screen(blank(), prompt(["Echte vraag"]), tool(["Kies een optie", "Force-push en retarget"]), say("Gedaan."), footer());
  assert.equal(parseScreen(s).prompt, "Echte vraag");
});

test("question tool block is skipped", () => {
  const s = screen(blank(), prompt(["Moet deze niet tegen main?"]), tool(["# Questions", "", "Hoe zet ik de PR om?"]), footer());
  assert.equal(parseScreen(s).prompt, "Moet deze niet tegen main?");
});

test("a running shell block sets the activity", () => {
  const s = screen(blank(), prompt(["Bouw het project"]), tool(["⠋ npm run build"]), footer());
  const r = parseScreen(s, "shell bezig");
  assert.equal(r.activity, "shell bezig");
  assert.equal(r.prompt, "Bouw het project");
});

test("prompts from the user, an agent and the orchestrator are detected", () => {
  for (const rows of [
    ["Hahaha mafkees"],
    ["[m2-tests] CREW-8: done. Suite staat. See task notes."],
    ["Noor hier. Start met CREW-1 en lees de taak eerst.", "Daarna rapporteren."],
  ]) {
    const s = screen(blank(), prompt(rows), say("Antwoord."), footer());
    assert.equal(parseScreen(s).prompt, rows.join("\n"));
    assert.equal(parseScreen(stripAnsi(s)).prompt, rows.join("\n"));
  }
});

test("a prompt sent in another agent mode (other border colour) is detected", () => {
  const s = screen(blank(), prompt(["Maak eerst een plan"], PLAN), say("Plan volgt."), footer());
  assert.equal(parseScreen(s).prompt, "Maak eerst een plan");
});

test("a prompt with its top padding on the first row is complete", () => {
  const s = screen(prompt(["Kort verzoek"]), say("Oké."), footer());
  assert.equal(parseScreen(s).prompt, "Kort verzoek");
});

test("a prompt cut off at the top is not used", () => {
  const s = screen(prompt(["Vera hier. Lange briefing", "tweede regel", "derde regel"]).slice(2), say("Oké."), footer());
  assert.equal(parseScreen(s).prompt, null);
});

test("an empty input box is not a message", () => {
  const s = screen(blank(), say("Welkom."), footer());
  assert.equal(parseScreen(s).prompt, null);
  const placeholder = screen(blank(), seg(WHITE, BG, "  ") + seg(BUILD, BG, "┃") + seg(MUTED, INPUT, "  Ask anything... \"Fix a TODO\""), footer());
  assert.equal(parseScreen(placeholder).prompt, null);
});

test("plain text screens fall back to text heuristics", () => {
  const plain = (...p) => stripAnsi(screen(...p));
  const step = say("+ 1 command", MUTED);
  assert.equal(parseScreen(plain(blank(), prompt(["Deploy"]), step, tool(CDK), say("Klaar."), footer())).prompt, "Deploy");
  assert.equal(parseScreen(plain(blank(), prompt(["Deploy"]), step, tool(CDK.slice(6)), say("Klaar."), footer())).prompt, "Deploy");
  assert.equal(parseScreen(plain(blank(), prompt(["Test"]), step, tool(NODE_TEST), say("Klaar."), footer())).prompt, "Test");
  assert.equal(parseScreen(plain(blank(), prompt(["Doe het"]), step, tool(["$ ls", "", "README.md"]), footer())).prompt, "Doe het");
});

test("borderIsTool compares the border colour with the background before it", () => {
  assert.equal(borderIsTool(tool(["x"])[1]), true);
  assert.equal(borderIsTool(prompt(["x"])[1]), false);
  assert.equal(borderIsTool("  ┃  geen kleuren"), null);
  assert.equal(borderIsTool(say("geen rand")), null);
  assert.equal(borderIsTool("\x1b[48;5;235m  \x1b[38;5;235m┃\x1b[0m out"), true);
  assert.equal(borderIsTool("\x1b[48;5;235m  \x1b[38;5;75m┃\x1b[0m prompt"), false);
});

test("looksLikeToolOutput flags stored tool output and keeps prompts", () => {
  for (const t of [CDK.slice(4).join("\n"), NODE_TEST.join("\n"), "$ npm test", "Ask anything...", "Stacks:\ndemo-stack", "(no output)"]) {
    assert.equal(looksLikeToolOutput(t), true, t);
  }
  for (const t of ["henkfrenk", "Vera hier. Push nu maar.", "[m1-parser] CREW-1: done. ✔ ✔", "→ doe dit eerst", "Kijk of ✅ werkt", ""]) {
    assert.equal(looksLikeToolOutput(t), false, t);
  }
});

test("startup removes stored tool output and keeps real prompts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "herdr-crew-screen-"));
  try {
    const at = "2026-11-13T10:00:00.000Z";
    await writeFile(join(dir, "memory.json"), JSON.stringify({
      frank: { promptSeen: "x", lastIn: { from: "Jij", via: "screen", at, text: CDK.slice(6).join("\n") } },
      tess: { lastIn: { from: "Jij", via: "screen", at, text: "[m1-parser] CREW-1: done." } },
      bertus: { lastIn: { from: "Jij", via: "screen", at, text: "henkfrenk" } },
      kees: { lastIn: { from: "Jij", via: "screen", at, text: "Ask anything... \"Fix a TODO\"" } },
      dash: { lastIn: { from: "Jij", via: "dashboard", at, text: "$ ls" } },
    }));
    const cfg = {
      language: "nl", summaries: { lead: false }, backlog: false,
      personas: [{ agent: "m1-parser", name: "Pim" }, { agent: "crew-orch", name: "Noor", messagePrefixes: ["Noor hier."] }],
    };
    const crew = await createCrew({ project: dir, stateDir: dir, cfg, avatarUrl: () => null });
    await crew.markInformed("frank", "test");
    const mem = JSON.parse(await readFile(join(dir, "memory.json"), "utf8"));
    assert.equal(mem.frank.lastIn, undefined);
    assert.equal(mem.frank.promptSeen, undefined);
    assert.equal(mem.kees.lastIn, undefined);
    assert.equal(mem.tess.lastIn.from, "Pim");
    assert.equal(mem.bertus.lastIn.text, "henkfrenk");
    assert.equal(mem.dash.lastIn.text, "$ ls");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
