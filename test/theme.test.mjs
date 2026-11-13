import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateTheme } from "../lib/theme.mjs";
import { loadConfig } from "../lib/config.mjs";

const base = () => ({ name: "Night", colors: { bg: "#000", ink: "#ffffff", panel: "#11223344" } });

test("rejects non-objects and themes without bg, ink or panel", () => {
  assert.equal(validateTheme(null, "x"), null);
  assert.equal(validateTheme("theme", "x"), null);
  for (const k of ["bg", "ink", "panel"]) {
    const t = base();
    delete t.colors[k];
    assert.equal(validateTheme(t, "x"), null, k);
  }
});

test("keeps valid hex colours and drops bad ones", () => {
  const t = base();
  Object.assign(t.colors, {
    accent: " #AbC ", accent2: "red", accent3: "#1234567", bubble: "#gggggg", working: "url(x)",
    idle: "#000;background:url(x)", done: 123, unknown: "#abcdef",
  });
  t.colors.extra = "#fff";
  const v = validateTheme(t, "x");
  assert.deepEqual(v.colors, { bg: "#000", ink: "#ffffff", panel: "#11223344", accent: "#AbC", unknown: "#abcdef" });
});

test("colours follow the CSS hex lengths 3, 4, 6 and 8", () => {
  const keep = (c) => validateTheme({ ...base(), colors: { ...base().colors, accent: c } }, "x").colors.accent;
  for (const c of ["#abc", "#abcd", "#aabbcc", "#aabbccdd"]) assert.equal(keep(c), c);
  for (const c of ["#ab", "#12345", "#1234567", "#123456789", "#"]) assert.equal(keep(c), undefined, c);
});

test("a saved theme with an old 5 digit colour still loads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "herdr-crew-theme-"));
  try {
    const theme = { name: "old", colors: { bg: "#000", ink: "#fff", panel: "#111", accent: "#12345" } };
    await writeFile(join(dir, ".herdr-crew.json"), JSON.stringify({ theme }));
    assert.deepEqual((await loadConfig(dir)).theme, theme);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a required colour that is invalid rejects the theme", () => {
  const t = base();
  t.colors.bg = "black";
  assert.equal(validateTheme(t, "x"), null);
});

test("enums fall back to defaults on unknown values", () => {
  const v = validateTheme({ ...base(), background: "video", card: { border: "groove", shadow: "glow", avatarShape: "star", uppercase: "yes" } }, "x");
  assert.equal(v.background, "gradient");
  assert.equal(v.card.border, "solid");
  assert.equal(v.card.shadow, "glow");
  assert.equal(v.card.avatarShape, "circle");
  assert.equal(v.card.uppercase, false);
  const d = validateTheme(base(), "x");
  assert.deepEqual(d.card, { radius: 22, border: "solid", borderWidth: 1, shadow: "soft", avatarShape: "circle", uppercase: false });
  assert.equal(validateTheme({ ...base(), background: "dots", card: { border: "dashed", avatarShape: "hexagon", uppercase: true } }, "x").background, "dots");
});

test("numbers are clamped and rounded", () => {
  assert.equal(validateTheme({ ...base(), card: { radius: 99, borderWidth: -3 } }, "x").card.radius, 40);
  assert.equal(validateTheme({ ...base(), card: { radius: 99, borderWidth: -3 } }, "x").card.borderWidth, 0);
  assert.equal(validateTheme({ ...base(), card: { radius: "7.6" } }, "x").card.radius, 8);
  assert.equal(validateTheme({ ...base(), card: { radius: "wide" } }, "x").card.radius, 22);
});

test("text fields are cut to their maximum length and stripped of markup characters", () => {
  const v = validateTheme({
    ...base(), name: "n".repeat(100), title: "<b>T</b>{x}`y`\\z\u0007", tagline: "t".repeat(200),
    labels: { working: "w".repeat(30), idle: "", bogus: "x" }, sections: { live: "s".repeat(50), other: "x" }, avatarStyle: "a".repeat(500),
  }, "p".repeat(400));
  assert.equal(v.name.length, 60);
  assert.equal(v.title, "bT/bxyz");
  assert.equal(v.tagline.length, 120);
  assert.deepEqual(v.labels, { working: "w".repeat(24) });
  assert.deepEqual(v.sections, { live: "s".repeat(40) });
  assert.equal(v.avatarStyle.length, 400);
  assert.equal(v.prompt.length, 300);
});

test("the name falls back to the prompt", () => {
  const t = base();
  delete t.name;
  assert.equal(validateTheme(t, "retro arcade").name, "retro arcade");
});

test("fonts: stacks lose unsafe characters, Google fonts are filtered and capped at 3", () => {
  const v = validateTheme({ ...base(), font: { body: "Inter; } body { x: url(y)", heading: 42, google: ["Inter", "Bad;Font", "A", "Space Mono", "Lora", "Extra"] } }, "x");
  assert.equal(v.font.body, "Inter  body  x urly");
  assert.equal(v.font.heading, null);
  assert.deepEqual(v.font.google, ["Inter", "Space Mono", "Lora"]);
});

test("avatars always start empty", () => {
  assert.deepEqual(validateTheme({ ...base(), avatars: { a: "../../x.png" } }, "x").avatars, {});
});
