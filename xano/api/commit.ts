import { query, input, s, c, ref, inp, auth, expr, and, obj } from "@xanots/sdk";

import { agents } from "../tables/agents.js";
import { spendRequests } from "../tables/spend-requests.js";
import { agentActions } from "../tables/agent-actions.js";
import { spendApi } from "./spend.js";

/**
 * Record a decision as committed, behind an API-layer role guard (RBAC, not
 * row-level security):
 *   - a refused request can be committed by nobody;
 *   - a request that needs approval requires an `approver` or `admin`, so a
 *     `purchaser` is refused;
 *   - an allowed request can be committed by any signed-in agent.
 *
 * The caller's role is read from their agent row (not assumed from the token),
 * so the guard is unambiguous. A refused attempt is still written to the audit
 * trail before the endpoint answers 403 — a governed system logs the denials,
 * not just the approvals.
 */
export const commitQuery = query({
  name: "commit",
  verb: "POST",
  apiGroup: spendApi,
  auth: agents,
  input: {
    spend_request_id: input.int({ required: true }),
  },
  stack: [
    // Field-match get binds null on a miss (get_by_id would 400 on a 0).
    s.db.get({
      table: spendRequests,
      fieldName: "id",
      fieldValue: inp("spend_request_id"),
      as: "sr",
    }),
    s.precondition({
      expr: expr(ref("sr", { safe: true }), "!=", c.null()),
      error: c.text("That spend request does not exist."),
      error_type: "notfound",
    }),
    // The caller's role, read from their row.
    s.db.get({
      table: agents,
      fieldName: "id",
      fieldValue: auth("id"),
      output: ["id", "name", "role"],
      as: "me",
    }),

    // Decide whether this caller may commit this request.
    s.set_var("allowed", c.bool(true)),
    s.set_var("reason", c.text("")),
    s.conditional({
      when: expr(ref("sr.decision"), "=", c.text("refused")),
      then: [
        s.update_var("allowed", c.bool(false)),
        s.update_var("reason", c.text("A refused request cannot be committed.")),
      ],
      elif: [
        {
          when: and(
            expr(ref("sr.decision"), "=", c.text("needs_human_approval")),
            expr(ref("me.role"), "=", c.text("purchaser")),
          ),
          then: [
            s.update_var("allowed", c.bool(false)),
            s.update_var(
              "reason",
              c.text("This request is over the approval threshold. An approver has to commit it."),
            ),
          ],
        },
      ],
    }),

    // Log the refusal, THEN answer 403, so the denial is on the trail too.
    s.conditional({
      when: expr(ref("allowed"), "=", c.bool(false)),
      then: [
        s.db.add({
          table: agentActions,
          row: {
            agent_id: auth("id"),
            spend_request_id: ref("sr.id"),
            action: c.text("refused"),
            firing_rule: ref("reason"),
            decision: ref("sr.decision"),
            policy_version: ref("sr.policy_version"),
            detail: obj({ actor: auth("id"), role: ref("me.role"), reason: ref("reason") }),
          },
        }),
      ],
    }),
    s.precondition({
      expr: expr(ref("allowed"), "=", c.bool(true)),
      error: ref("reason"),
      error_type: "accessdenied",
    }),

    // Allowed: record the commit.
    s.db.add({
      table: agentActions,
      row: {
        agent_id: auth("id"),
        spend_request_id: ref("sr.id"),
        action: c.text("commit"),
        firing_rule: ref("sr.firing_rule"),
        decision: ref("sr.decision"),
        policy_version: ref("sr.policy_version"),
        detail: obj({ actor: auth("id"), role: ref("me.role") }),
      },
      as: "aa",
    }),
  ],
  response: {
    ok: c.bool(true),
    message: c.text("Recorded as committed."),
    decision: ref("sr.decision"),
    spend_request_id: ref("sr.id"),
  },
});
