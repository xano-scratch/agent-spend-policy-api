// The one contract: paths and request/response *types* are derived from the
// xanots query defs. Never hand-type a URL or a request body — change a def and
// everything here follows.
//
// Lean defs are imported for their runtime `getPath()`/`verb`. The stack-heavy
// `agent-check` (its stack builds the AI agent graph via s.ai.agent.run) is
// referenced TYPES-ONLY through a `typeof import(...)` query, which the compiler
// erases — its verb + path live in ROUTES below, verified against the compiled
// bundle with `npx xanots routes xano/index.ts`.
import type { InferInput, InferResponse } from "@xanots/sdk";

import { loginQuery } from "../../../xano/api/login.js";
import { commitQuery } from "../../../xano/api/commit.js";
import { actionsQuery } from "../../../xano/api/actions.js";
import { policiesQuery } from "../../../xano/api/policies.js";
import { seedQuery } from "../../../xano/api/seed.js";

/**
 * The deployed Xano backend's base URL. Injected as `window.XANO_HOST` by
 * `xanots deploy <entry> --static <dir>`, or read from `VITE_XANO_HOST` in dev.
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// Plain metadata for the stack-heavy endpoint — no def import, no bundle cost.
// Keep in sync with `npx xanots routes xano/index.ts` (it prints verb + path).
const ROUTES = {
  agentCheck: { path: "/api:spend/agent-check", verb: "POST" },
} as const;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let authToken: string | null = null;
export function setToken(t: string | null): void {
  authToken = t;
}
export function getToken(): string | null {
  return authToken;
}

async function call<T>(
  path: string,
  verb: string,
  opts: { body?: unknown; auth?: boolean; query?: Record<string, string | undefined> } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let url = XANO_HOST + path;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) if (v) qs.set(k, v);
    const q = qs.toString();
    if (q) url += "?" + q;
  }
  const init: RequestInit = { method: verb, headers };
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  if (opts.auth && authToken) headers["authorization"] = "Bearer " + authToken;

  const res = await fetch(url, init);
  if (!res.ok) {
    let message = res.statusText || "Request failed";
    try {
      const data = (await res.json()) as { message?: unknown };
      if (typeof data?.message === "string" && data.message) message = data.message;
    } catch {
      // keep the status text
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

// ---- login (public) ----
export type LoginBody = InferInput<typeof loginQuery>;
export type LoginResponse = InferResponse<typeof loginQuery>;
export function login(body: LoginBody): Promise<LoginResponse> {
  return call<LoginResponse>(loginQuery.getPath(), loginQuery.verb, { body });
}

// ---- agent-check (auth; stack-heavy, so typed off the def but routed via ROUTES) ----
type AgentCheckDef = typeof import("../../../xano/api/agent-check.js").agentCheckQuery;
export type AgentCheckBody = InferInput<AgentCheckDef>;
export type AgentCheckResponse = InferResponse<AgentCheckDef>;
export function agentCheck(body: AgentCheckBody): Promise<AgentCheckResponse> {
  return call<AgentCheckResponse>(ROUTES.agentCheck.path, ROUTES.agentCheck.verb, { body, auth: true });
}

// ---- commit (auth) ----
export type CommitBody = InferInput<typeof commitQuery>;
export type CommitResponse = InferResponse<typeof commitQuery>;
export function commit(body: CommitBody): Promise<CommitResponse> {
  return call<CommitResponse>(commitQuery.getPath(), commitQuery.verb, { body, auth: true });
}

// ---- actions / the audit trail (auth) ----
export type ActionsResponse = InferResponse<typeof actionsQuery>;
export function getActions(decision?: string): Promise<ActionsResponse> {
  return call<ActionsResponse>(actionsQuery.getPath(), actionsQuery.verb, {
    auth: true,
    query: { decision },
  });
}

// ---- policies + vendors (public) ----
export type PoliciesResponse = InferResponse<typeof policiesQuery>;
export function getPolicies(): Promise<PoliciesResponse> {
  return call<PoliciesResponse>(policiesQuery.getPath(), policiesQuery.verb, {});
}

// ---- seed (public) ----
export function seed(): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>(seedQuery.getPath(), seedQuery.verb, { body: {} });
}
