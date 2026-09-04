import { defineFunction, input, s, c, ref, inp, col, expr, cmp } from "@xanots/sdk";

import { spendPolicies } from "../tables/spend-policies.js";
import { vendors } from "../tables/vendors.js";

/**
 * The deterministic rule core. Given a vendor, a category, and an amount, it
 * loads the active policy version and the vendor status, applies the spend
 * rules in a fixed order, and returns the decision, the exact rule that fired,
 * and the policy version.
 *
 * It is PURE: no auth, no writes. Every decision path in the app runs through
 * this one function, so the same rules apply whether a human calls `evaluate`
 * or the agent-check endpoint runs. The calling endpoint persists the request
 * and the audit row, because a function has no caller identity of its own.
 *
 * Rule order (first match wins):
 *   1. no active policy for the category  -> refused
 *   2. vendor not on the approved list    -> refused
 *   3. vendor is blocked                  -> refused
 *   4. amount over the per-transaction limit  -> refused
 *   5. amount over the approval threshold      -> needs_human_approval
 *   6. otherwise                               -> allowed
 */
export const classify = defineFunction({
  name: "classify_spend",
  input: {
    vendor: input.text({ required: true, methods: ["trim"] }),
    category: input.text({ required: true, methods: ["trim", "lower"] }),
    amount: input.decimal({ required: true }),
  },
  stack: [
    // The active policy for this category, if any.
    s.db.query({
      table: spendPolicies,
      where: [expr(col("category"), "=", inp("category")), expr(col("active"), "=", c.bool(true))],
      returnType: "single",
      as: "policy",
    }),

    // The vendor, matched case-insensitively by substring so "Acme" finds
    // "Acme Software". Skipped when no vendor was named, so an empty vendor
    // stays null (an unknown vendor) instead of matching the first row.
    s.set_var("vendor_row", c.null()),
    s.conditional({
      when: expr(inp("vendor"), "!=", c.text("")),
      then: [
        s.db.query({
          table: vendors,
          where: cmp(col("name"), "includes", inp("vendor")),
          returnType: "single",
          as: "vq",
        }),
        s.update_var("vendor_row", ref("vq")),
      ],
    }),

    // Defaults; the guards below only override them.
    s.set_var("decision", c.text("allowed")),
    s.set_var("firing_rule", c.text("Within policy")),
    s.set_var("policy_version", c.null()),
    s.set_var("vendor_id", c.int(0)),

    s.conditional({
      when: expr(ref("policy"), "=", c.null()),
      then: [
        s.update_var("decision", c.text("refused")),
        s.update_var("firing_rule", c.text("No active policy for this category")),
      ],
      else: [
        // policy is non-null here, so these reads are safe.
        s.update_var("policy_version", ref("policy.version")),
        s.conditional({
          when: expr(ref("vendor_row"), "=", c.null()),
          then: [
            s.update_var("decision", c.text("refused")),
            s.update_var("firing_rule", c.text("Vendor is not on the approved list")),
          ],
          else: [
            // vendor_row is non-null here.
            s.update_var("vendor_id", ref("vendor_row.id")),
            s.conditional({
              when: expr(ref("vendor_row.status"), "=", c.text("blocked")),
              then: [
                s.update_var("decision", c.text("refused")),
                s.update_var("firing_rule", c.text("Vendor is blocked")),
              ],
              elif: [
                {
                  when: expr(inp("amount"), ">", ref("policy.per_txn_limit")),
                  then: [
                    s.update_var("decision", c.text("refused")),
                    s.update_var("firing_rule", c.text("Amount over the per-transaction limit")),
                  ],
                },
                {
                  when: expr(inp("amount"), ">", ref("policy.approval_threshold")),
                  then: [
                    s.update_var("decision", c.text("needs_human_approval")),
                    s.update_var(
                      "firing_rule",
                      c.text("Amount over the approval threshold, needs human approval"),
                    ),
                  ],
                },
              ],
              // else: stays "allowed" / "Within policy"
            }),
          ],
        }),
      ],
    }),
  ],
  response: {
    decision: ref("decision"),
    firing_rule: ref("firing_rule"),
    policy_version: ref("policy_version"),
    vendor_id: ref("vendor_id"),
    // Echo the coerced inputs so callers persist canonical values.
    vendor: inp("vendor"),
    category: inp("category"),
    amount: inp("amount"),
  },
});
