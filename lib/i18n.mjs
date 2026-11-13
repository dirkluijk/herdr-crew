// Dashboard and server texts from locale files: one flat JSON object per language (locales/<code>.json), with
// placeholders such as {name}. English is the reference and the fallback for unknown languages and missing keys.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const BUILT_IN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "locales");
export const LOCALE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;
const MAX_VALUE = 2000;

const list = (p) => (p.length ? p.map((x) => `{${x}}`).join(", ") : "none");
export const placeholders = (s) => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

export function format(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(params, k) && params[k] !== undefined && params[k] !== null ? String(params[k]) : m));
}

// Problems of a locale against the English reference: same keys, same placeholders, text values, nothing empty,
// no control characters other than new lines, and no value far longer than its English original.
export function checkLocale(dict, en) {
  if (!dict || typeof dict !== "object" || Array.isArray(dict)) return ["a locale must be one JSON object with text values"];
  const errors = [];
  for (const k of Object.keys(en)) if (!Object.hasOwn(dict, k)) errors.push(`missing key ${k}`);
  for (const [k, v] of Object.entries(dict)) {
    if (!Object.hasOwn(en, k)) { errors.push(`unknown key ${k}`); continue; }
    if (typeof v !== "string") { errors.push(`${k} must be text`); continue; }
    if (!v.trim()) { errors.push(`${k} is empty`); continue; }
    if (/[\x00-\x09\x0b-\x1f\x7f]/.test(v)) errors.push(`${k} has control characters`);
    if (v.length > Math.max(MAX_VALUE, en[k].length * 3)) errors.push(`${k} is much longer than the English text`);
    const want = placeholders(en[k]);
    const got = placeholders(v);
    if (want.join() !== got.join()) errors.push(`${k} must have the placeholders ${list(want)}, has ${list(got)}`);
  }
  return errors;
}

function readDir(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const code = f.replace(/\.json$/, "");
    if (!f.endsWith(".json") || !LOCALE_CODE.test(code)) continue;
    try { out.set(code, JSON.parse(readFileSync(join(dir, f), "utf8"))); } catch {}
  }
  return out;
}

const stamp = (dirs) => dirs.map((d) => { try { return `${d}:${statSync(d).mtimeMs}`; } catch { return `${d}:-`; } }).join("|");

// Later directories add languages; they never replace the shipped ones. Invalid files are skipped.
export function createI18n(dirs = [BUILT_IN_DIR]) {
  let seen = null;
  let locales = new Map();
  let extra = new Set();
  function load() {
    const s = stamp(dirs);
    if (s === seen) return;
    seen = s;
    const next = readDir(dirs[0]);
    const en = next.get("en") ?? {};
    const added = new Set();
    for (const dir of dirs.slice(1)) {
      for (const [code, dict] of readDir(dir)) if (!next.has(code) && !checkLocale(dict, en).length) { next.set(code, dict); added.add(code); }
    }
    locales = next;
    extra = added;
  }
  load();
  const en = () => locales.get("en") ?? {};
  const has = (code) => (load(), locales.has(code));
  const resolve = (code) => (has(code) ? code : "en");
  // English first, then the language: a key that is missing in the language shows in English.
  const dict = (code) => ({ ...en(), ...(locales.get(resolve(code)) ?? {}) });
  return {
    dirs,
    has,
    resolve,
    dict,
    t(code) {
      const d = dict(code);
      return (key, params) => format(d[key] ?? key, params);
    },
    languages: () => (load(), [...locales.entries()].map(([code, d]) => ({ code, name: d["meta.name"] ?? code, englishName: d["meta.englishName"] ?? code, project: extra.has(code) }))
      .sort((a, b) => a.code.localeCompare(b.code))),
    addDir(dir) { if (!dirs.includes(dir)) { dirs.push(dir); seen = null; } },
  };
}

// One shared instance for the server; tests can make their own.
export const i18n = createI18n();
export const tr = (language) => i18n.t(language);
