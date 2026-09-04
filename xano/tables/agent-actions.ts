import { table, f } from "@xanots/sdk";

import { agents } from "./agents.js";
import { spendRequests } from "./spend-requests.js";

/**
 * The audit trail (the governance payoff). One row is written on every check,
 * every allowed commit, and every refusal, whether a person or an agent asked.
 *
 * The decision, firing rule, and policy version are denormalized onto the row
 * so the trail reads on its own, and `detail` carries the request context
 * (vendor, category, amount, the agent's plain-language ask) as JSON.
 */
export const agentActions = table({
  name: "agent_actions",
  schema: {
    agent_id: f.tableRef(agents, { required: true }),
    spend_request_id: f.tableRef(spendRequests, { required: true, default: 0 }),
    // evaluate | agent_check | commit | refused
    action: f.text({ required: true }),
    firing_rule: f.text(),
    decision: f.text(),
    policy_version: f.int({ nullable: true }),
    detail: f.json(),
  },
});
