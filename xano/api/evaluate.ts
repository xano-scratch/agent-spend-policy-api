import { query, input, s, c, ref, inp, auth, obj } from "@xanots/sdk";

import { agents } from "../tables/agents.js";
import { spendRequests } from "../tables/spend-requests.js";
import { agentActions } from "../tables/agent-actions.js";
import { classify } from "../functions/classify.js";
import { spendApi } from "./spend.js";

/**
 * The deterministic rule core, exposed to a signed-in caller. Runs the shared
 * `classify` function, records the proposed request with its decision, and
 * writes an audit row. This is the one auditable place a spend decision is
 * made; the agent-check endpoint routes through the very same function.
 */
export const evaluateQuery = query({
  name: "evaluate",
  verb: "POST",
  apiGroup: spendApi,
  auth: agents,
  input: {
    vendor: input.text({ required: true, methods: ["trim"] }),
    category: input.text({ required: true, methods: ["trim", "lower"] }),
    amount: input.decimal({ required: true }),
    memo: input.text(),
  },
  stack: [
    s.function.run({
      fn: classify,
      input: { vendor: inp("vendor"), category: inp("category"), amount: inp("amount") },
      as: "core",
    }),
    s.db.add({
      table: spendRequests,
      row: {
        agent_id: auth("id"),
        vendor_id: ref("core.vendor_id"),
        category: ref("core.category"),
        amount: ref("core.amount"),
        memo: inp("memo"),
        decision: ref("core.decision"),
        firing_rule: ref("core.firing_rule"),
        policy_version: ref("core.policy_version"),
      },
      as: "sr",
    }),
    s.db.add({
      table: agentActions,
      row: {
        agent_id: auth("id"),
        spend_request_id: ref("sr.id"),
        action: c.text("evaluate"),
        firing_rule: ref("core.firing_rule"),
        decision: ref("core.decision"),
        policy_version: ref("core.policy_version"),
        detail: obj({
          actor: auth("id"),
          vendor: ref("core.vendor"),
          category: ref("core.category"),
          amount: ref("core.amount"),
          memo: inp("memo"),
        }),
      },
    }),
  ],
  response: {
    decision: ref("core.decision"),
    firing_rule: ref("core.firing_rule"),
    policy_version: ref("core.policy_version"),
    vendor: ref("core.vendor"),
    category: ref("core.category"),
    amount: ref("core.amount"),
    spend_request_id: ref("sr.id"),
  },
});
