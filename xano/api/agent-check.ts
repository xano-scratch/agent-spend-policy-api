import { query, input, s, c, ref, inp, auth, obj, expr, withFilters, fl } from "@xanots/sdk";

import { agents } from "../tables/agents.js";
import { spendRequests } from "../tables/spend-requests.js";
import { agentActions } from "../tables/agent-actions.js";
import { classify } from "../functions/classify.js";
import { spendAgent } from "../agents/spend-agent.js";
import { spendApi } from "./spend.js";

/**
 * The Play 4 surface. A signed-in agent sends a plain-language purchase
 * request. The LLM agent reads it and extracts the vendor, category, and
 * amount. The endpoint then runs the SAME `classify` rule core a human's
 * `evaluate` call runs through, records the request, and writes an audit row.
 *
 * The decision is never the model's. It always comes from the governed rule
 * core, so the same rules and the same trail apply whether a human or an agent
 * asks. Deterministic fallbacks (a keyword scan for the category, a digit scan
 * for the amount) fill any field the model leaves out, so a thin extraction
 * still produces a governed result instead of an error.
 */
export const agentCheckQuery = query({
  name: "agent-check",
  verb: "POST",
  apiGroup: spendApi,
  auth: agents,
  input: {
    request: input.text({ required: true }),
  },
  stack: [
    s.ai.agent.run({
      agent: spendAgent,
      args: { request: inp("request") },
      as: "run",
    }),

    // Vendor: what the agent read, or empty (which the rule core treats as an
    // unknown vendor).
    s.set_var("v_vendor", ref("run.result.vendor", { safe: true })),
    s.conditional({
      when: expr(ref("v_vendor"), "=", c.null()),
      then: [s.update_var("v_vendor", c.text(""))],
    }),

    // Category: what the agent read, else a keyword scan of the request.
    s.set_var("v_cat", ref("run.result.category", { safe: true })),
    s.conditional({
      when: expr(ref("v_cat"), "=", c.null()),
      then: [
        s.conditional({
          when: expr(withFilters(inp("request"), fl.icontains(c.text("software"))), "=", c.bool(true)),
          then: [s.update_var("v_cat", c.text("software"))],
          elif: [
            {
              when: expr(withFilters(inp("request"), fl.icontains(c.text("travel"))), "=", c.bool(true)),
              then: [s.update_var("v_cat", c.text("travel"))],
            },
            {
              when: expr(withFilters(inp("request"), fl.icontains(c.text("hardware"))), "=", c.bool(true)),
              then: [s.update_var("v_cat", c.text("hardware"))],
            },
          ],
          else: [s.update_var("v_cat", c.text(""))],
        }),
      ],
    }),

    // Amount: what the agent read, else the digits found in the request.
    s.set_var("v_amount", ref("run.result.amount", { safe: true })),
    s.conditional({
      when: expr(ref("v_amount"), "=", c.null()),
      then: [s.update_var("v_amount", c.decimal(0))],
    }),
    s.conditional({
      when: expr(ref("v_amount"), "<=", c.int(0)),
      then: [
        s.update_var(
          "v_amount",
          withFilters(c.regex("[^0-9]"), fl.regex_replace(c.text(""), inp("request")), fl.to_decimal()),
        ),
      ],
    }),

    // The governed decision, from the same rule core `evaluate` uses.
    s.function.run({
      fn: classify,
      input: { vendor: ref("v_vendor"), category: ref("v_cat"), amount: ref("v_amount") },
      as: "core",
    }),

    s.db.add({
      table: spendRequests,
      row: {
        agent_id: auth("id"),
        vendor_id: ref("core.vendor_id"),
        category: ref("core.category"),
        amount: ref("core.amount"),
        memo: inp("request"),
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
        action: c.text("agent_check"),
        firing_rule: ref("core.firing_rule"),
        decision: ref("core.decision"),
        policy_version: ref("core.policy_version"),
        detail: obj({
          actor: auth("id"),
          request: inp("request"),
          vendor: ref("core.vendor"),
          category: ref("core.category"),
          amount: ref("core.amount"),
          explanation: ref("run.result.explanation", { safe: true }),
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
    explanation: ref("run.result.explanation", { safe: true }),
    spend_request_id: ref("sr.id"),
  },
});
