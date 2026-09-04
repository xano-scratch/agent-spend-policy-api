import { query, input, s, c, ref, inp, expr, obj } from "@xanots/sdk";

import { agents } from "../tables/agents.js";
import { spendApi } from "./spend.js";

/**
 * Sign in as one of the seeded agents and mint a bearer token. Public, because
 * it is the door to the token every protected endpoint requires.
 *
 * The password is taken as `input.text` (not `input.password`) so it reaches
 * `check_password` as plaintext; taking it through `input.password` would hash
 * it a second time and no correct password would ever match.
 */
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: spendApi,
  auth: false,
  input: {
    name: input.text({ required: true, methods: ["trim"] }),
    password: input.text({ required: true }),
  },
  stack: [
    // `output` naming `password` is required — the column is internal and is
    // absent from the row otherwise.
    s.db.get({
      table: agents,
      fieldName: "name",
      fieldValue: inp("name"),
      output: ["id", "name", "role", "password"],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u", { safe: true }), "!=", c.null()),
      error: c.text("No agent with that name."),
      error_type: "notfound",
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error: c.text("That password is not right."),
      error_type: "unauthorized",
    }),
    s.security.create_auth_token({ table: agents, id: ref("u.id"), as: "token" }),
  ],
  response: {
    token: ref("token"),
    agent: obj({ id: ref("u.id"), name: ref("u.name"), role: ref("u.role") }),
  },
});
