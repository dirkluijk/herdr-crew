import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createI18n, checkLocale, placeholders, format, BUILT_IN_DIR } from "../lib/i18n.mjs";
import { validateTheme, flavourTheme, uiLanguage } from "../lib/theme.mjs";
import { onboardingText, languageName } from "../lib/config.mjs";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (code) => JSON.parse(readFileSync(join(BUILT_IN_DIR, `${code}.json`), "utf8"));
const en = load("en");

test("every shipped locale has the keys and placeholders of en.json and no empty texts", () => {
  const codes = readdirSync(BUILT_IN_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
  assert.deepEqual(codes.sort(), ["en", "nl"]);
  for (const code of codes) assert.deepEqual(checkLocale(load(code), en), [], code);
});

test("checkLocale names missing, unknown, empty and wrong placeholder keys", () => {
  const bad = { ...en, "ui.now": " ", "ui.min": "{m} min", "ui.extra": "x", "ui.close": 3 };
  delete bad["ui.cancel"];
  assert.deepEqual(checkLocale(bad, en).sort(), [
    "missing key ui.cancel", "ui.close must be text", "ui.min must have the placeholders {n}, has {m}", "ui.now is empty", "unknown key ui.extra",
  ]);
  assert.match(checkLocale({ ...en, "ui.goTo": "x".repeat(5000) }, en).join(), /much longer/);
  assert.match(checkLocale({ ...en, "ui.goTo": "a\u0007b" }, en).join(), /control characters/);
  assert.deepEqual(checkLocale({ ...en, "onboarding.message": en["onboarding.message"].replace("Welcome", "Willkommen") }, en), []);
  assert.deepEqual(checkLocale([], en), ["a locale must be one JSON object with text values"]);
  assert.deepEqual(placeholders("{b} {a} {b}"), ["a", "b"]);
  assert.equal(format("{a} and {b}", { a: 1 }), "1 and {b}");
});

let extra;
before(async () => { extra = await mkdtemp(join(tmpdir(), "herdr-crew-locales-")); });
after(() => rm(extra, { recursive: true, force: true }));

test("unknown languages and missing keys fall back to English; extra directories add valid languages only", async () => {
  const i18n = createI18n([BUILT_IN_DIR, extra]);
  assert.equal(i18n.resolve("de"), "en");
  assert.equal(i18n.t("de")("ui.cancel"), "Cancel");
  assert.equal(i18n.t("nl")("ui.cancel"), "Annuleren");
  assert.equal(i18n.t("nl")("ui.no.such.key"), "ui.no.such.key");
  assert.equal(i18n.t("nl")("ui.min", { n: 4 }), "4 min geleden");
  const de = { ...en, "meta.name": "Deutsch", "meta.englishName": "German", "ui.cancel": "Abbrechen" };
  await writeFile(join(extra, "de.json"), JSON.stringify(de));
  await writeFile(join(extra, "xx.json"), JSON.stringify({ "ui.cancel": "broken" }));
  await writeFile(join(extra, "nl.json"), JSON.stringify({ ...en, "ui.cancel": "not shipped nl" }));
  assert.ok(i18n.has("de"));
  assert.ok(!i18n.has("xx"));
  assert.equal(i18n.t("de")("ui.cancel"), "Abbrechen");
  assert.equal(i18n.t("nl")("ui.cancel"), "Annuleren");
  assert.deepEqual(i18n.languages().map((l) => `${l.code}:${l.name}`), ["de:Deutsch", "en:English", "nl:Nederlands"]);
});

// Keys the page asks for, literally or through a fixed prefix.
function pageKeys() {
  const html = readFileSync(join(APP, "public", "index.html"), "utf8");
  const keys = new Set([...html.matchAll(/\b(?:tx|h|tb)\("((?:ui|crew)\.[\w.]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/"((?:ui)\.[\w.]+)"/g)) keys.add(m[1]);
  return { html, keys };
}

test("the page has no inline text blocks and only asks for keys that exist", () => {
  const { html, keys } = pageKeys();
  assert.doesNotMatch(html, /I18N|Annuleren|"Cancel"|Bevestig|"Confirm"/);
  assert.ok(keys.size > 80, String(keys.size));
  for (const k of keys) assert.ok(Object.hasOwn(en, k), k);
  for (const prefix of ["ui.labels.", "ui.sections.", "ui.by.", "ui.task."]) assert.ok(Object.keys(en).some((k) => k.startsWith(prefix)), prefix);
});

test("server code only asks for keys that exist", () => {
  const files = [...readdirSync(join(APP, "lib")).map((f) => join(APP, "lib", f)), ...readdirSync(join(APP, "widgets")).map((f) => join(APP, "widgets", f)), join(APP, "server.mjs")];
  let n = 0;
  for (const f of files.filter((x) => x.endsWith(".mjs"))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\b(?:t|k|tr\([^)]*\))\(["`]((?:onboarding|panels|widget|summary|crew|server|meta|ui)\.[\w.]+)["`]/g)) {
      n++;
      assert.ok(Object.hasOwn(en, m[1]), `${f}: ${m[1]}`);
    }
  }
  assert.ok(n > 15, String(n));
});

test("onboarding texts come from the locale and keep their old wording", () => {
  const cfg = { language: "nl", bubbleLanguage: "nl", title: "p", onboarding: { message: null }, personas: [{ agent: "o", name: "Vera", lead: true, messagePrefixes: ["Vera hier."] }] };
  const nl = onboardingText(cfg, "m1-x", { name: "Pim", pronouns: "he/him" });
  assert.match(nl, /^Welkom in de crew van p\. Je bent m1-x \(Pim, he\/him\)\./);
  assert.match(nl, /één korte zin in het Nederlands van hooguit 80 tekens/);
  assert.match(nl, /Berichten van Vera beginnen met "Vera hier\."/);
  const en1 = onboardingText({ ...cfg, language: "en", bubbleLanguage: "nl", personas: [] }, "m1-x", null);
  assert.match(en1, /one short sentence in Dutch/);
  assert.match(en1, /Messages from the orchestrator start with "-"/);
  const unknown = onboardingText({ ...cfg, language: "zz", personas: [] }, "a", null);
  assert.match(unknown, /^Welcome to the p crew/);
  assert.equal(languageName("en", "nl"), "Engels");
});

test("themes keep only flavour texts", () => {
  const raw = {
    colors: { bg: "#000000", ink: "#ffffff", panel: "#111111" }, title: "T", tagline: "tag",
    labels: { working: "busy", confirm: "Click me" }, sections: { live: "Live", footer: "x" },
    confirm: "Do it", texts: { "ui.serverCheck": "nothing is checked" }, uiLanguage: "en",
  };
  const v = validateTheme(raw, "space");
  assert.deepEqual(v.labels, { working: "busy" });
  assert.deepEqual(v.sections, { live: "Live" });
  for (const k of ["confirm", "texts", "uiLanguage"]) assert.equal(v[k], undefined, k);
  const f = flavourTheme({ ...v, texts: { a: 1 }, labels: { ...v.labels, closeText: "x" }, footer: "y" });
  assert.deepEqual(f.labels, { working: "busy" });
  assert.equal(f.texts, undefined);
  assert.equal(f.footer, undefined);
  assert.equal(flavourTheme(null), null);
  assert.equal(uiLanguage(" EN "), "en");
  assert.equal(uiLanguage("english"), null);
  assert.equal(uiLanguage(null), null);
});
