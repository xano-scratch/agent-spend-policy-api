import { query, statements, s, c, ref, obj } from "@xanots/sdk";

import { agents } from "../tables/agents.js";
import { spendPolicies } from "../tables/spend-policies.js";
import { vendors } from "../tables/vendors.js";
import { spendRequests } from "../tables/spend-requests.js";
import { agentActions } from "../tables/agent-actions.js";
import { classify } from "../functions/classify.js";
import { spendApi } from "./spend.js";

/**
 * A PUBLIC sample credential for a throwaway environment, not a secret. It lets
 * the UI sign in as the seeded agents on a fresh ephemeral.
 */
const DEMO_PASSWORD = "demo-spend-2026";

/**
 * Seed one example request: run the real rule core, record the request, and
 * write the matching audit row. Returned as `statements(...)` so the stack
 * keeps its tuple type when spread into the seed stack.
 */
function seedExample(vendor: string, category: string, amount: number, note: string, tag: string) {
  const core = `core_${tag}`;
  const sr = `sr_${tag}`;
  return statements(
    s.function.run({
      fn: classify,
      input: { vendor: c.text(vendor), category: c.text(category), amount: c.decimal(amount) },
      as: core,
    }),
    s.db.add({
      table: spendRequests,
      row: {
        agent_id: ref("purchaser.id"),
        vendor_id: ref(`${core}.vendor_id`),
        category: c.text(category),
        amount: c.decimal(amount),
        memo: c.text(note),
        decision: ref(`${core}.decision`),
        firing_rule: ref(`${core}.firing_rule`),
        policy_version: ref(`${core}.policy_version`),
      },
      as: sr,
    }),
    s.db.add({
      table: agentActions,
      row: {
        agent_id: ref("purchaser.id"),
        spend_request_id: ref(`${sr}.id`),
        action: c.text("evaluate"),
        firing_rule: ref(`${core}.firing_rule`),
        decision: ref(`${core}.decision`),
        policy_version: ref(`${core}.policy_version`),
        detail: obj({
          actor: ref("purchaser.id"),
          vendor: c.text(vendor),
          category: c.text(category),
          amount: c.decimal(amount),
          note: c.text(note),
        }),
      },
    }),
  );
}

/**
 * Reset and seed the demo. Truncates every table (id sequences reset), then
 * writes the agents, the policies (one active version per category plus one
 * superseded software version, kept for audit), the vendors (one blocked), and
 * a few example requests. The examples run through the real `classify` rule
 * core, so the seeded trail matches exactly what the live endpoints produce.
 *
 * Public, so a fresh ephemeral or a fresh clone is one call away from browsable.
 */
export const seedQuery = query({
  name: "seed",
  verb: "POST",
  apiGroup: spendApi,
  auth: false,
  stack: [
    s.db.truncate({ table: agentActions, reset: true }),
    s.db.truncate({ table: spendRequests, reset: true }),
    s.db.truncate({ table: vendors, reset: true }),
    s.db.truncate({ table: spendPolicies, reset: true }),
    s.db.truncate({ table: agents, reset: true }),

    // Agents (the auth table).
    s.db.add({
      table: agents,
      row: { name: "Purchasing Agent", role: "purchaser", password: DEMO_PASSWORD },
      as: "purchaser",
    }),
    s.db.add({
      table: agents,
      row: { name: "Finance Approver", role: "approver", password: DEMO_PASSWORD },
      as: "approver",
    }),
    s.db.add({
      table: agents,
      row: { name: "Finance Admin", role: "admin", password: DEMO_PASSWORD },
      as: "admin",
    }),

    // Active policies, one per category.
    s.db.add({
      table: spendPolicies,
      row: {
        version: 1,
        active: true,
        category: "software",
        per_txn_limit: 5000,
        approval_threshold: 1000,
        notes: "Software and SaaS purchases.",
      },
    }),
    s.db.add({
      table: spendPolicies,
      row: {
        version: 1,
        active: true,
        category: "travel",
        per_txn_limit: 3000,
        approval_threshold: 500,
        notes: "Flights, hotels, and ground travel.",
      },
    }),
    s.db.add({
      table: spendPolicies,
      row: {
        version: 1,
        active: true,
        category: "hardware",
        per_txn_limit: 10000,
        approval_threshold: 2000,
        notes: "Laptops, servers, and peripherals.",
      },
    }),
    // A superseded software version, kept for audit.
    s.db.add({
      table: spendPolicies,
      row: {
        version: 0,
        active: false,
        category: "software",
        per_txn_limit: 2000,
        approval_threshold: 500,
        notes: "Superseded by version 1.",
      },
    }),

    // Vendors, one blocked.
    s.db.add({ table: vendors, row: { name: "Acme Software", category: "software", status: "allowed" } }),
    s.db.add({ table: vendors, row: { name: "Hooli Cloud", category: "software", status: "allowed" } }),
    s.db.add({ table: vendors, row: { name: "Globex Travel", category: "travel", status: "allowed" } }),
    s.db.add({ table: vendors, row: { name: "Initech Hardware", category: "hardware", status: "allowed" } }),
    s.db.add({
      table: vendors,
      row: {
        name: "Umbrella Supplies",
        category: "software",
        status: "blocked",
        block_reason: "Failed the security review.",
      },
    }),

    // Example requests, replayed through the real rule core.
    ...seedExample("Acme Software", "software", 400, "Team code editor seats", "ex1"),
    ...seedExample("Umbrella Supplies", "software", 250, "Log shipping tool", "ex2"),
    ...seedExample("Initech Hardware", "hardware", 3500, "Two engineering laptops", "ex3"),
    ...seedExample("Globex Travel", "travel", 4000, "Offsite flights", "ex4"),
  ],
  response: { ok: c.bool(true) },
});
