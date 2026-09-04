import { table, f } from "@xanots/sdk";

import { agents } from "./agents.js";
import { vendors } from "./vendors.js";

/**
 * A proposed purchase and the decision the rule core reached for it. The
 * decision, the rule that fired, and the policy version are stored on the row,
 * so a request reads on its own without re-running the rules.
 *
 * `vendor_id` uses the `0` sentinel (an optional foreign key), which is what an
 * unknown vendor resolves to, rather than a null that later reads cannot match.
 */
export const spendRequests = table({
  name: "spend_requests",
  schema: {
    agent_id: f.tableRef(agents, { required: true }),
    vendor_id: f.tableRef(vendors, { required: true, default: 0 }),
    category: f.text({ required: true }),
    amount: f.decimal({ required: true }),
    memo: f.text(),
    decision: f.enum(["allowed", "refused", "needs_human_approval"], { required: true }),
    firing_rule: f.text({ required: true }),
    policy_version: f.int({ nullable: true }),
  },
});
