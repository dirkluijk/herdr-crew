// Shared checks for widget options. Each returns an error message or null.
export const WIDGET_ID = /^[a-z0-9_-]{1,40}$/;

export const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
export const checkId = (v) => (v === undefined || (typeof v === "string" && WIDGET_ID.test(v)) ? null : "id must match [a-z0-9_-], at most 40 characters");
export const checkText = (name, v, max, required = false) =>
  (v === undefined && !required) || (typeof v === "string" && v.trim() && v.length <= max) ? null : `${name} must be text of at most ${max} characters`;
export const checkPath = (name, v, required = true) => {
  if (v === undefined && !required) return null;
  if (typeof v !== "string" || !v.trim()) return `${name} is required: a path relative to the project`;
  if (/^[/~]/.test(v) || v.split(/[\\/]/).includes("..")) return `${name} must be a path inside the project, without .. or a leading /`;
  return null;
};
export const checkKeys = (options, allowed) =>
  Object.keys(options).filter((k) => !allowed.includes(k)).map((k) => `option ${k} is unknown; use ${allowed.join(", ")}`);
export const collect = (...errors) => errors.flat().filter(Boolean);
