import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync, realpathSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addLocale, checkLocaleFile, languageRequestText, cleanLanguage, projectLocaleDir, projectLocaleDirs, legacyLocaleDir, localesDirProblem, EN_FILE } from "../lib/languages.mjs";
import { createI18n, BUILT_IN_DIR } from "../lib/i18n.mjs";

const en = JSON.parse(readFileSync(EN_FILE, "utf8"));
const de = { ...en, "meta.name": "Deutsch", "meta.englishName": "German", "ui.cancel": "Abbrechen", "ui.min": "vor {n} Min." };
let root, project, good, bad;
before(async () => {
  root = realpathSync(await mkdtemp(join(tmpdir(), "herdr-crew-lang-")));
  project = join(root, "project");
  await mkdir(project);
  good = join(root, "de.json");
  bad = join(root, "bad.json");
  await writeFile(good, JSON.stringify(de));
  await writeFile(bad, JSON.stringify({ ...de, "ui.min": "vor Min.", "ui.now": "" }));
});
after(() => rm(root, { recursive: true, force: true }));

test("checkLocaleFile reports JSON, key and placeholder problems", async () => {
  assert.deepEqual((await checkLocaleFile(good)).errors, []);
  assert.deepEqual((await checkLocaleFile(bad)).errors.sort(), ["ui.min must have the placeholders {n}, has none", "ui.now is empty"]);
  assert.match((await checkLocaleFile(join(root, "none.json"))).errors[0], /does not exist/);
  await writeFile(join(root, "broken.json"), "{");
  assert.match((await checkLocaleFile(join(root, "broken.json"))).errors[0], /not valid JSON/);
});

test("addLocale stores a valid project language and refuses the rest", async () => {
  assert.match((await addLocale({ project, code: "De", file: good })).errors[0], /lowercase/);
  assert.match((await addLocale({ project, code: "../x", file: good })).errors[0], /language code/);
  assert.match((await addLocale({ project, code: "nl", file: good })).errors[0], /ships with herdr-crew/);
  assert.equal((await addLocale({ project, code: "de", file: bad })).errors.length, 2);
  assert.ok(!existsSync(join(projectLocaleDir(project), "de.json")));
  assert.ok(!existsSync(join(legacyLocaleDir(project), "de.json")));
  let r = await addLocale({ project, code: "de", file: good, dir: legacyLocaleDir(project) });
  assert.deepEqual(r, { path: join(legacyLocaleDir(project), "de.json"), updated: false });
  assert.deepEqual(JSON.parse(await readFile(r.path, "utf8")), de);
  r = await addLocale({ project, code: "de", file: good, dir: legacyLocaleDir(project) });
  assert.equal(r.updated, true);
  const i18n = createI18n([BUILT_IN_DIR, legacyLocaleDir(project)]);
  assert.equal(i18n.t("de")("ui.min", { n: 2 }), "vor 2 Min.");
  assert.deepEqual(i18n.languages().find((l) => l.code === "de"), { code: "de", name: "Deutsch", englishName: "German", project: true });
});

test("the request to the lead quotes the language and gives the files and exact commands", () => {
  const text = languageRequestText({ language: "en", project: "/p", cli: "node /app/server.mjs", name: "German\u0007 please\nnow" });
  const lines = text.split("\n");
  assert.match(lines[0], /^From the crew dashboard: the user asks for a new dashboard language/);
  assert.equal(lines[1], "> German  please now");
  assert.ok(text.includes(`Translate ${EN_FILE} into that language and write the result to /p/.herdr-crew/locale-draft.json`));
  assert.match(text, /Keep every placeholder such as \{name\} unchanged/);
  assert.match(text, /keep confirmation and safety texts literal and complete/);
  assert.ok(lines.includes("node /app/server.mjs locale check /p/.herdr-crew/locale-draft.json"));
  assert.ok(lines.includes("node /app/server.mjs locale add <code> --file /p/.herdr-crew/locale-draft.json --project /p"));
  assert.match(languageRequestText({ language: "nl", project: "/p", cli: "c", name: "Duits" }), /^Via het crew-dashboard: de gebruiker vraagt een nieuwe taal/);
  assert.equal(cleanLanguage("x".repeat(100)).length, 61);
  assert.doesNotMatch(text, /[\u2013\u2014]/);
});

test("project languages go to .herdr-crew-locales or localesDir; the old .herdr-crew/locales still loads", async () => {
  assert.equal(projectLocaleDir(project), join(project, ".herdr-crew-locales"));
  assert.equal(projectLocaleDir(project, { localesDir: "i18n/dashboard" }), join(project, "i18n", "dashboard"));
  for (const bad of ["../elsewhere", "/etc", "", "~/x"]) {
    assert.equal(projectLocaleDir(project, { localesDir: bad }), join(project, ".herdr-crew-locales"), bad);
    assert.ok(localesDirProblem(bad), bad);
  }
  assert.equal(localesDirProblem(undefined), null);
  assert.deepEqual(projectLocaleDirs(project, {}), [join(project, ".herdr-crew-locales"), legacyLocaleDir(project)]);

  // de was stored in the old place by the test above; fr goes to the new one, and a newer de wins over the old one.
  assert.ok(existsSync(join(legacyLocaleDir(project), "de.json")));
  const fr = join(root, "fr.json");
  await writeFile(fr, JSON.stringify({ ...en, "meta.name": "Français", "meta.englishName": "French", "ui.cancel": "Annuler" }));
  const r = await addLocale({ project, code: "fr", file: fr, dir: projectLocaleDir(project) });
  assert.equal(r.path, join(project, ".herdr-crew-locales", "fr.json"));
  const i18n = createI18n([BUILT_IN_DIR, ...projectLocaleDirs(project, {})]);
  assert.equal(i18n.t("fr")("ui.cancel"), "Annuler");
  assert.equal(i18n.t("de")("ui.cancel"), "Abbrechen");
  await writeFile(join(root, "de2.json"), JSON.stringify({ ...de, "ui.cancel": "Abbrechen (neu)" }));
  await addLocale({ project, code: "de", file: join(root, "de2.json"), dir: projectLocaleDir(project) });
  assert.equal(createI18n([BUILT_IN_DIR, ...projectLocaleDirs(project, {})]).t("de")("ui.cancel"), "Abbrechen (neu)");
});
