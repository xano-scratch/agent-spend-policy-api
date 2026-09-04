import { table, f } from "@xanots/sdk";

/**
 * The versioned rule set. One active version at a time per category; older
 * versions are kept (active: false) so the audit trail can name the exact
 * policy version a past decision came from.
 *
 * Amounts are whole-dollar decimals. A request at or under `approval_threshold`
 * is allowed; over the threshold it needs human approval; over `per_txn_limit`
 * it is refused outright.
 */
export const spendPolicies = table({
  name: "spend_policies",
  schema: {
    version: f.int({ required: true }),
    active: f.bool({ required: true }),
    category: f.text({ required: true, methods: ["trim", "lower"] }),
    per_txn_limit: f.decimal({ required: true }),
    approval_threshold: f.decimal({ required: true }),
    notes: f.text(),
  },
  index: [{ type: "btree", fields: [{ name: "category" }] }],
});
