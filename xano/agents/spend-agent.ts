import { agent, input } from "@xanots/sdk";

/**
 * The Play 4 surface, on Xano's free model (no external credentials).
 *
 * The agent does one job: read a plain-language purchase request and extract
 * its fields as structured output (vendor, category, amount, and a one-line
 * summary). It does NOT decide whether the purchase may proceed. The
 * agent-check endpoint takes these fields and runs the same governed rule core
 * a human's `evaluate` call uses, so the decision is always the rule core's,
 * never the model's. That is the whole point of the play: an agent gets the
 * same answer, under the same controls and the same audit, as a person.
 */
export const spendAgent = agent({
  name: "spend_policy_agent",
  llm: {
    type: "xano-free",
    systemPrompt:
      "You read a corporate purchase request written in plain language and pull out its fields. " +
      "Return the vendor name exactly as written, the spending category, the amount in dollars as a " +
      "plain number, and one short sentence describing what the buyer wants. The categories are " +
      "software, travel, and hardware; choose the closest one. Never decide whether the purchase is " +
      "allowed or refused. Only extract the fields.",
    prompt: "Purchase request: {{ $args.request }}",
  },
  output: {
    schema: {
      vendor: input.text(),
      category: input.enum(["software", "travel", "hardware"]),
      amount: input.decimal(),
      explanation: input.text(),
    },
  },
});
