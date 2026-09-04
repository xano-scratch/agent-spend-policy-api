import { query, s, c, ref, col, expr } from "@xanots/sdk";

import { spendPolicies } from "../tables/spend-policies.js";
import { vendors } from "../tables/vendors.js";
import { spendApi } from "./spend.js";

/**
 * The read surface for the UI: the active spend policy per category and the
 * full vendor allow / block list, so a reviewer can read the rules a decision
 * came from. Public, because the policy is not a secret.
 */
export const policiesQuery = query({
  name: "policies",
  verb: "GET",
  apiGroup: spendApi,
  auth: false,
  stack: [
    s.db.query({
      table: spendPolicies,
      where: expr(col("active"), "=", c.bool(true)),
      sort: [{ sortBy: "category", dir: "asc" }],
      as: "policies",
    }),
    s.db.query({
      table: vendors,
      sort: [{ sortBy: "name", dir: "asc" }],
      as: "vendors",
    }),
  ],
  response: {
    policies: ref("policies"),
    vendors: ref("vendors"),
  },
});
