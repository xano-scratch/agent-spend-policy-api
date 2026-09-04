import { query, input, s, ref, inp, col, cmp } from "@xanots/sdk";

import { agents } from "../tables/agents.js";
import { agentActions } from "../tables/agent-actions.js";
import { spendApi } from "./spend.js";

/**
 * The audit query. Returns the agent_actions trail, newest first, optionally
 * filtered to one decision. Auth-gated: reading the governance trail is itself
 * a governed action.
 *
 * `decision` is an optional filter — `ignoreEmpty` drops the predicate when the
 * input is absent, so no filter returns the whole trail.
 */
export const actionsQuery = query({
  name: "actions",
  verb: "GET",
  apiGroup: spendApi,
  auth: agents,
  input: {
    decision: input.text(),
  },
  stack: [
    s.db.query({
      table: agentActions,
      where: cmp(col("decision"), "=", inp("decision"), { ignoreEmpty: true }),
      sort: [{ sortBy: "created_at", dir: "desc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
