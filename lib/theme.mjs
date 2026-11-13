// Prompted themes: free text in, a validated JSON theme out. Only the theme text and the persona cards
// (name, pronouns, role, traits) go to a model; never screens, tasks or messages.
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { complete, modelEndpoint } from "./summary.mjs";

const COLOR_KEYS = ["bg", "bg2", "bg3", "panel", "ink", "muted", "accent", "accent2", "accent3", "bubble", "bubbleInk", "working", "idle", "done", "blocked", "unknown", "mascot", "closed"];
const STATUS_KEYS = ["working", "idle", "done", "blocked", "closed", "unknown", "mascot"];
const SECTION_KEYS = ["live", "closed", "widgets", "new"];
const ENUMS = {
  border: ["solid", "dashed", "dotted", "double", "none"],
  shadow: ["none", "soft", "hard", "glow"],
  avatarShape: ["circle", "rounded", "square", "hexagon"],
  background: ["gradient", "solid", "grid", "dots", "stripes", "scanlines"],
};

const color = (v) => (typeof v === "string" && /^#[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i.test(v.trim()) ? v.trim() : null);
const text = (v, max) => (typeof v === "string" ? v.replace(/[\x00-\x1f\x7f<>{}`\\]/g, "").trim().slice(0, max) : null);
const fontStack = (v) => (typeof v === "string" ? v.replace(/[^\w\s,"'-]/g, "").trim().slice(0, 160) || null : null);
const oneOf = (k, v) => (ENUMS[k].includes(v) ? v : null);
const num = (v, lo, hi) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : null);

export function validateTheme(t, prompt) {
  if (!t || typeof t !== "object") return null;
  const colors = {};
  for (const k of COLOR_KEYS) if (color(t.colors?.[k])) colors[k] = color(t.colors[k]);
  if (!colors.bg || !colors.ink || !colors.panel) return null;
  const labels = {};
  for (const k of STATUS_KEYS) if (text(t.labels?.[k], 24)) labels[k] = text(t.labels[k], 24);
  const sections = {};
  for (const k of SECTION_KEYS) if (text(t.sections?.[k], 40)) sections[k] = text(t.sections[k], 40);
  const google = (Array.isArray(t.font?.google) ? t.font.google : [])
    .map((f) => (typeof f === "string" && /^[A-Za-z0-9 ]{2,40}$/.test(f) ? f : null)).filter(Boolean).slice(0, 3);
  return {
    name: text(t.name, 60) ?? text(prompt, 60),
    prompt: text(prompt, 300),
    createdAt: new Date().toISOString(),
    title: text(t.title, 60),
    tagline: text(t.tagline, 120),
    colors,
    font: { body: fontStack(t.font?.body), heading: fontStack(t.font?.heading), google },
    card: {
      radius: num(t.card?.radius, 0, 40) ?? 22,
      border: oneOf("border", t.card?.border) ?? "solid",
      borderWidth: num(t.card?.borderWidth, 0, 6) ?? 1,
      shadow: oneOf("shadow", t.card?.shadow) ?? "soft",
      avatarShape: oneOf("avatarShape", t.card?.avatarShape) ?? "circle",
      uppercase: t.card?.uppercase === true,
    },
    background: oneOf("background", t.background) ?? "gradient",
    labels, sections,
    avatarStyle: text(t.avatarStyle, 400),
    avatars: {},
  };
}

const SCHEMA = `{
  "name": "short theme name",
  "title": "dashboard title in the theme, including the project name",
  "tagline": "one short line under the title",
  "colors": { ${COLOR_KEYS.map((k) => `"${k}": "#rrggbb"`).join(", ")} },
  "font": { "body": "CSS font stack", "heading": "CSS font stack", "google": ["at most 3 Google Fonts family names used in the stacks, or empty"] },
  "card": { "radius": 0-40, "border": "${ENUMS.border.join("|")}", "borderWidth": 0-6, "shadow": "${ENUMS.shadow.join("|")}", "avatarShape": "${ENUMS.avatarShape.join("|")}", "uppercase": true|false },
  "background": "${ENUMS.background.join("|")}",
  "labels": { ${STATUS_KEYS.map((k) => `"${k}": "status label"`).join(", ")} },
  "sections": { "live": "heading for active agents", "closed": "heading for agents that stopped", "widgets": "heading for widgets", "new": "heading for new agents" },
  "avatarStyle": "one paragraph describing a portrait style for avatars in this theme"
}`;

export async function generateTheme({ prompt, language, model, project }) {
  if (!modelEndpoint()) throw new Error("no model credentials (set ANTHROPIC_FOUNDRY_API_KEY and ANTHROPIC_FOUNDRY_BASE_URL, or ANTHROPIC_API_KEY)");
  const lang = language === "nl" ? "Dutch" : "English";
  const system = [
    "You design themes for a local web dashboard that shows AI coding agents as cards with avatars, status badges and speech bubbles.",
    "Return one JSON object and nothing else, matching this shape:", SCHEMA,
    `Write all labels, headings, title and tagline in ${lang}. Labels at most 24 characters, headings at most 40.`,
    "The 'bubble' colour is the speech bubble background, 'bubbleInk' its text; they need strong contrast. 'ink' on 'panel' and 'bg' must be readable (WCAG AA).",
    "Status colours working, idle, done, blocked must be clearly distinct from each other.",
    "Prefer system fonts; use Google Fonts only when the theme really needs a display face, and always end stacks with a generic family.",
  ].join("\n");
  const raw = await complete({ model, system, user: `Project name: ${project}\nTheme: ${prompt}`, maxTokens: 2000, timeoutMs: 60000 });
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const theme = validateTheme(JSON.parse(json), prompt);
  if (!theme) throw new Error("the model returned an unusable theme");
  return theme;
}

export function imageEndpoint() {
  if (process.env.OPENAI_FOUNDRY_API_KEY && process.env.OPENAI_FOUNDRY_BASE_URL) {
    return { url: process.env.OPENAI_FOUNDRY_BASE_URL.replace(/\/$/, ""), key: process.env.OPENAI_FOUNDRY_API_KEY, azure: true };
  }
  if (process.env.OPENAI_API_KEY) return { url: "https://api.openai.com/v1", key: process.env.OPENAI_API_KEY };
  return null;
}

// Generates one portrait per persona in the theme's style. Runs in the background; failures leave the default avatar.
export async function generateAvatars({ theme, personas, dir, model, onAvatar, log = console.log }) {
  const ep = imageEndpoint();
  if (!ep) return log("theme avatars skipped: no image API credentials");
  const slug = (theme.name ?? "theme").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "theme";
  const out = join(dir, "avatars", slug);
  await mkdir(out, { recursive: true });
  const queue = personas.filter((p) => !theme.avatars?.[p.agent]);
  const worker = async () => {
    for (let p; (p = queue.shift()); ) {
      const prompt = [
        `Square portrait avatar for a dashboard card, head and shoulders, centred, plain background. Style: ${theme.avatarStyle ?? theme.name}.`,
        `Character: ${p.name}${p.pronouns ? ` (${p.pronouns})` : ""}, ${p.role ?? "crew member"}.`,
        p.traits?.length ? `Personality: ${p.traits.join(", ")}.` : "",
        "No text, no letters, no logos.",
      ].join(" ");
      try {
        const res = await fetch(`${ep.url}/images/generations`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(ep.azure ? { "api-key": ep.key } : {}), authorization: `Bearer ${ep.key}` },
          body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1, quality: "low" }),
          signal: AbortSignal.timeout(180000),
        });
        if (!res.ok) throw new Error(`image ${res.status} ${(await res.text()).slice(0, 200)}`);
        const b64 = (await res.json()).data?.[0]?.b64_json;
        if (!b64) throw new Error("no image data");
        const file = `${slug}/${p.agent}.png`;
        await writeFile(join(dir, "avatars", file), Buffer.from(b64, "base64"));
        await onAvatar(p.agent, file);
        log(`theme avatar ready: ${p.agent}`);
      } catch (e) {
        log(`theme avatar failed for ${p.agent}: ${e.message}`);
      }
    }
  };
  await Promise.all([worker(), worker()]);
}
