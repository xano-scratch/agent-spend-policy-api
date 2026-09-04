import { workspace } from "@xanots/sdk";

import { agents } from "./tables/agents.js";
import { spendPolicies } from "./tables/spend-policies.js";
import { vendors } from "./tables/vendors.js";
import { spendRequests } from "./tables/spend-requests.js";
import { agentActions } from "./tables/agent-actions.js";

import { classify } from "./functions/classify.js";
import { spendAgent } from "./agents/spend-agent.js";

import { spendApi } from "./api/spend.js";
import { loginQuery } from "./api/login.js";
import { evaluateQuery } from "./api/evaluate.js";
import { agentCheckQuery } from "./api/agent-check.js";
import { commitQuery } from "./api/commit.js";
import { actionsQuery } from "./api/actions.js";
import { policiesQuery } from "./api/policies.js";
import { seedQuery } from "./api/seed.js";

/**
 * Agent Spend-Policy Check API.
 *
 * A governed spend-policy layer an AI purchasing agent calls before it buys.
 * One versioned rule set decides every purchase; a person and an agent get the
 * same answer; every check lands in one audit trail. Auth is API-layer RBAC.
 */
export default workspace("agent-spend-policy-api")
  .registerTables([agents, spendPolicies, vendors, spendRequests, agentActions])
  .registerFunctions([classify])
  .registerAgents([spendAgent])
  .registerApiGroups([spendApi])
  .registerQueries([
    loginQuery,
    evaluateQuery,
    agentCheckQuery,
    commitQuery,
    actionsQuery,
    policiesQuery,
    seedQuery,
  ]);
