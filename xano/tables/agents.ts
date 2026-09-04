import { table, f } from "@xanots/sdk";

/**
 * The auth table. Access is API-layer role-based access control: this table
 * backs identity, a public `login` query mints a bearer token, and each
 * protected endpoint names this table as `auth:` and reads the caller with
 * `auth(...)`. There is no row-level security anywhere in this app.
 *
 * A `purchaser` may evaluate and request spend, and commit a request that is
 * within policy. An `approver` may also commit a request that needs approval.
 * An `admin` may do both.
 */
export const agents = table({
  name: "agents",
  auth: true,
  // `id` (int PK) + `created_at` (epochms) are auto-injected.
  schema: {
    name: f.text({ required: true, methods: ["trim"] }),
    role: f.enum(["purchaser", "approver", "admin"], { required: true }),
    // Hashes on write; `db.get` must name it in `output` to read it back.
    password: f.password({ required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "name" }] }],
});
