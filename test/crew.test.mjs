import { test } from "node:test";
import assert from "node:assert/strict";
import { briefedByLead } from "../lib/crew.mjs";

const lead = { agent: "crew-orch", name: "Noor", lead: true };
const fromLead = { lastIn: { from: "Noor", via: "screen", text: "Noor hier. You are milestone agent m5-panels" } };

test("a registered agent briefed by the lead counts as informed", () => {
  assert.equal(briefedByLead({ registered: true, mem: { ...fromLead }, lead }), true);
});

test("an unregistered agent still needs a persona", () => {
  assert.equal(briefedByLead({ registered: false, mem: { ...fromLead }, lead }), false);
});

test("messages from the user, another agent or the dashboard do not count", () => {
  for (const lastIn of [{ from: "Jij", via: "screen" }, { from: "Tess", via: "screen" }, { from: "Noor", via: "dashboard" }]) {
    assert.equal(briefedByLead({ registered: true, mem: { lastIn }, lead }), false);
  }
});

test("no lead, no last message or already informed gives false", () => {
  assert.equal(briefedByLead({ registered: true, mem: { ...fromLead }, lead: undefined }), false);
  assert.equal(briefedByLead({ registered: true, mem: {}, lead }), false);
  assert.equal(briefedByLead({ registered: true, mem: { ...fromLead, informedAt: "2026-11-13T12:00:00Z" }, lead }), false);
});
