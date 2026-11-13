// New dashboard languages, made by the orchestrator from en.json like panels (no model call on the server).
// Project languages live in <project>/.herdr-crew/locales/<code>.json; the shipped ones in locales/ stay read only.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BUILT_IN_DIR, LOCALE_CODE, checkLocale, createI18n, tr } from "./i18n.mjs";
import { cleanPrompt } from "./panels.mjs";

export const MAX_LANGUAGE = 60;
export const EN_FILE = join(BUILT_IN_DIR, "en.json");
export const projectLocaleDir = (project) => join(project, ".herdr-crew", "locales");

const readEn = async () => JSON.parse(await readFile(EN_FILE, "utf8"));
const shipped = () => createI18n([BUILT_IN_DIR]).languages().map((l) => l.code);

// Problems with a locale file, checked against en.json. Returns { errors, dict }.
export async function checkLocaleFile(file) {
  let dict;
  try { dict = JSON.parse(await readFile(file, "utf8")); } catch (e) {
    return { errors: [e.code === "ENOENT" ? `${file} does not exist` : `${file} is not valid JSON: ${e.message}`] };
  }
  return { errors: checkLocale(dict, await readEn()), dict };
}

// Validates and stores a project language. Written through a temporary file and a rename, so a running dashboard
// never reads half a file and sees the new language on its next request.
export async function addLocale({ project, code, file }) {
  if (typeof code !== "string" || !LOCALE_CODE.test(code)) return { errors: ["the code must be a language code such as de, fr or pt-br, in lowercase"] };
  if (shipped().includes(code)) return { errors: [`${code} ships with herdr-crew and cannot be replaced from a project`] };
  const { errors, dict } = await checkLocaleFile(file);
  if (errors.length) return { errors };
  const dir = projectLocaleDir(project);
  await mkdir(dir, { recursive: true });
  const target = join(dir, `${code}.json`);
  const updated = existsSync(target);
  const tmp = join(dir, `.${code}.json.tmp`);
  await writeFile(tmp, JSON.stringify(dict, null, 2) + "\n");
  await rename(tmp, target);
  return { path: target, updated };
}

export const cleanLanguage = (v) => cleanPrompt(v).replace(/\n/g, " ").slice(0, MAX_LANGUAGE + 1);

export function languageRequestText({ language, project, cli, name }) {
  const t = tr(language);
  const draft = join(project, ".herdr-crew", "locale-draft.json");
  return [
    t("languages.head"),
    `> ${cleanLanguage(name)}`,
    t("languages.translate", { en: EN_FILE, draft }),
    t("languages.rules"),
    t("languages.commands"),
    `${cli} locale check ${draft}`,
    `${cli} locale add <code> --file ${draft} --project ${project}`,
    t("languages.end"),
  ].join("\n");
}
