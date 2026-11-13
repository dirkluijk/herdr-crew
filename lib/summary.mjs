// Optional model calls through an Anthropic-compatible Messages API. Nothing happens without credentials.
import { redact } from "./screen.mjs";

export function modelEndpoint() {
  if (process.env.ANTHROPIC_FOUNDRY_API_KEY && process.env.ANTHROPIC_FOUNDRY_BASE_URL) {
    return { url: process.env.ANTHROPIC_FOUNDRY_BASE_URL.replace(/\/$/, ""), key: process.env.ANTHROPIC_FOUNDRY_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) return { url: "https://api.anthropic.com", key: process.env.ANTHROPIC_API_KEY };
  return null;
}

export async function complete({ model, system, user, maxTokens = 600, timeoutMs = 30000 }) {
  const ep = modelEndpoint();
  if (!ep) throw new Error("no model credentials");
  const res = await fetch(`${ep.url}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": ep.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    // Thinking off: otherwise the model can spend max_tokens on thinking and return a cut-off answer.
    body: JSON.stringify({ model, max_tokens: maxTokens, thinking: { type: "between_tools" }, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`model ${res.status}`);
  const j = await res.json();
  if (j.stop_reason !== "end_turn") throw new Error(`model stopped: ${j.stop_reason}`);
  return (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
}

const PROMPTS = {
  nl: {
    system: "Je schrijft het tekstwolkje van de orchestrator op een dashboard met AI-agents. Vat in twee korte alinea's, gescheiden door een lege regel (samen hooguit 100 woorden), samen. Eerste alinea: wat er net gebeurd, besloten of afgerond is. Tweede alinea: wie nu waarmee bezig is en wat de volgende stap is. Schrijf in de ik-vorm, concreet maar zonder nummers, paden of code. Geen aanhalingstekens, geen gedachtestreepjes, geen emoji. Geef alleen de tekst.",
    persona: "Persona", role: "rol", status: "Status", last: "Laatste bericht van de persona:",
  },
  en: {
    system: "You write the speech bubble of the orchestrator on a dashboard of AI agents. Summarise in two short paragraphs separated by a blank line (at most 100 words together). First: what just happened, was decided or finished. Second: who works on what now and what comes next. First person, concrete, without numbers, paths or code. No quotes, no dashes, no emoji. Return only the text.",
    persona: "Persona", role: "role", status: "Status", last: "Latest message of the persona:",
  },
};

export async function summarizeLead({ model, language, persona: p, context, status }) {
  const t = PROMPTS[language] ?? PROMPTS.en;
  const user = [`${t.persona}: ${p.name} (${p.pronouns ?? ""}), ${t.role}: ${p.role ?? ""}.`, `${t.status}: ${status}.`, t.last, context].join("\n");
  const text = await complete({ model, system: t.system, user, maxTokens: 1200 });
  return text ? redact(text.replace(/[—–]/g, ",").replace(/^["']|["']$/g, "").replace(/\n{3,}/g, "\n\n")).slice(0, 900) : null;
}
