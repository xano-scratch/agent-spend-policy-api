import { table, f } from "@xanots/sdk";

/**
 * The vendor allow / block list. A blocked vendor is always refused, whatever
 * the amount or category, and the block reason is carried for the audit view.
 */
export const vendors = table({
  name: "vendors",
  schema: {
    name: f.text({ required: true, methods: ["trim"] }),
    category: f.text({ required: true, methods: ["trim", "lower"] }),
    status: f.enum(["allowed", "blocked"], { required: true }),
    // Empty for an allowed vendor.
    block_reason: f.text(),
  },
  index: [{ type: "btree", fields: [{ name: "name" }] }],
});
