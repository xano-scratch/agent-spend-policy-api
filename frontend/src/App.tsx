import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ApiError,
  agentCheck,
  commit,
  getActions,
  getPolicies,
  login,
  seed,
  setToken,
  type ActionsResponse,
  type AgentCheckResponse,
  type PoliciesResponse,
} from "@/lib/api";

// Sample credentials for the seeded agents on a throwaway environment. These
// are public demo values, not secrets.
const DEMO_PASSWORD = "demo-spend-2026";
const ROLES = [
  { key: "purchaser", name: "Purchasing Agent", blurb: "Can evaluate and commit allowed requests" },
  { key: "approver", name: "Finance Approver", blurb: "Can also commit over-threshold requests" },
  { key: "admin", name: "Finance Admin", blurb: "Full access" },
] as const;
type RoleKey = (typeof ROLES)[number]["key"];

const EXAMPLES = [
  "Buy $400 of software from Acme",
  "Buy $250 of software from Umbrella Supplies",
  "Buy $3500 of hardware from Initech Hardware",
  "Buy $4000 of travel from Globex Travel",
];

function initialTab(): string {
  if (typeof window === "undefined") return "ask";
  const h = window.location.hash.replace("#", "");
  return ["ask", "policy", "audit"].includes(h) ? h : "ask";
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function money(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return show(v);
  return "$" + n.toLocaleString("en-US");
}

function when(ms: unknown): string {
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!isFinite(n) || n <= 0) return "—";
  return new Date(n).toLocaleString();
}

function DecisionBadge({ decision }: { decision: unknown }) {
  const d = String(decision ?? "");
  if (d === "allowed")
    return (
      <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">allowed</Badge>
    );
  if (d === "refused") return <Badge variant="destructive">refused</Badge>;
  if (d === "needs_human_approval")
    return (
      <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400">needs approval</Badge>
    );
  return <Badge variant="secondary">{show(d)}</Badge>;
}

type DetailRecord = Record<string, unknown>;
function detailOf(row: unknown): DetailRecord {
  const d = (row as { detail?: unknown })?.detail;
  return d && typeof d === "object" ? (d as DetailRecord) : {};
}

export default function App() {
  const [role, setRole] = useState<RoleKey>("purchaser");
  const [actor, setActor] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [needsSeed, setNeedsSeed] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [policies, setPolicies] = useState<PoliciesResponse | null>(null);
  const [actions, setActions] = useState<ActionsResponse>([]);
  const [filter, setFilter] = useState<string>("");

  const signIn = useCallback(async (key: RoleKey) => {
    const def = ROLES.find((r) => r.key === key)!;
    const res = await login({ name: def.name, password: DEMO_PASSWORD });
    setToken(res.token as string);
    setRole(key);
    const a = res.agent as { name?: unknown; role?: unknown };
    setActor(`${show(a.name)} (${show(a.role)})`);
  }, []);

  const loadActions = useCallback(async (decision: string) => {
    const rows = await getActions(decision || undefined);
    setActions(rows);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const pol = await getPolicies();
      setPolicies(pol);
      await signIn("purchaser");
      await loadActions("");
      setNeedsSeed(false);
    } catch {
      // Most likely the environment has not been seeded yet.
      setNeedsSeed(true);
    } finally {
      setReady(true);
    }
  }, [signIn, loadActions]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const resetData = useCallback(async () => {
    setBanner("Loading sample data...");
    try {
      await seed();
      await bootstrap();
      setBanner("Sample data loaded.");
      setTimeout(() => setBanner(null), 2500);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Could not load sample data.");
    }
  }, [bootstrap]);

  const onFilter = useCallback(
    (d: string) => {
      setFilter(d);
      loadActions(d).catch(() => undefined);
    },
    [loadActions],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Header
          actor={actor}
          role={role}
          onRole={(k) => signIn(k).then(() => loadActions(filter)).catch(() => setNeedsSeed(true))}
          onReset={resetData}
        />

        {banner && (
          <div className="mt-4 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
            {banner}
          </div>
        )}

        {needsSeed && (
          <Card className="mt-6 border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-lg">No sample data yet</CardTitle>
              <CardDescription>
                This environment has no policies or agents loaded. Load the sample data to try it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={resetData}>
                <RefreshCw /> Load sample data
              </Button>
            </CardContent>
          </Card>
        )}

        {ready && !needsSeed && (
          <Tabs
            defaultValue={initialTab()}
            className="mt-6"
            onValueChange={(v) => {
              if (typeof window !== "undefined") window.location.hash = v;
            }}
          >
            <TabsList>
              <TabsTrigger value="ask">
                <Bot className="mr-1 size-4" /> Ask the agent
              </TabsTrigger>
              <TabsTrigger value="policy">
                <ShieldCheck className="mr-1 size-4" /> Policy &amp; vendors
              </TabsTrigger>
              <TabsTrigger value="audit">
                <ClipboardList className="mr-1 size-4" /> Audit trail
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ask">
              <AskScreen role={role} onChanged={() => loadActions(filter)} />
            </TabsContent>
            <TabsContent value="policy">
              <PolicyScreen policies={policies} />
            </TabsContent>
            <TabsContent value="audit">
              <AuditScreen actions={actions} filter={filter} onFilter={onFilter} />
            </TabsContent>
          </Tabs>
        )}

        <Footer />
      </div>
    </div>
  );
}

function Header({
  actor,
  role,
  onRole,
  onReset,
}: {
  actor: string;
  role: RoleKey;
  onRole: (k: RoleKey) => void;
  onReset: () => void;
}) {
  return (
    <header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-6" />
            <h1 className="text-2xl font-semibold tracking-tight">Agent Spend-Policy Check API</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A governed spend-policy layer an AI purchasing agent calls before it buys. The same
            rules and the same audit trail apply whether a human or an agent asks.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RefreshCw className="size-4" /> Reset sample data
          </Button>
          <ModeToggle />
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Signed in as</span>
          {ROLES.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={role === r.key ? "default" : "outline"}
              onClick={() => onRole(r.key)}
              title={r.blurb}
            >
              {r.name}
            </Button>
          ))}
          {actor && <span className="ml-auto text-xs text-muted-foreground">token: {actor}</span>}
        </div>
      </div>
    </header>
  );
}

function AskScreen({ role, onChanged }: { role: RoleKey; onChanged: () => void }) {
  const [request, setRequest] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<AgentCheckResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitMsg, setCommitMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const ask = useCallback(async () => {
    setBusy(true);
    setError(null);
    setCommitMsg(null);
    setResult(null);
    try {
      const res = await agentCheck({ request });
      setResult(res);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The agent could not be reached.");
    } finally {
      setBusy(false);
    }
  }, [request, onChanged]);

  const doCommit = useCallback(async () => {
    if (!result) return;
    setCommitMsg(null);
    try {
      const res = await commit({ spend_request_id: result.spend_request_id as number });
      const text = (res as { message?: unknown }).message;
      setCommitMsg({ ok: true, text: typeof text === "string" ? text : "Committed." });
      onChanged();
    } catch (e) {
      const text = e instanceof ApiError ? e.message : "Commit failed.";
      setCommitMsg({ ok: false, text });
      onChanged();
    }
  }, [result, onChanged]);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Ask the agent</CardTitle>
          <CardDescription>
            Describe a purchase in plain language. The agent pulls out the vendor, category, and
            amount, then calls the rule core for the decision.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={3}
            placeholder="Buy $400 of software from Acme"
          />
          <Button onClick={ask} disabled={busy || !request.trim()} className="w-full">
            {busy ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy ? "Asking the agent..." : "Ask the agent"}
          </Button>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setRequest(ex)}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-lg">Governed decision</CardTitle>
          <CardDescription>
            The decision comes from the rule core, not the model. The agent only relays it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && !result && (
            <p className="text-sm text-muted-foreground">Ask the agent to see a governed decision.</p>
          )}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <DecisionBadge decision={result.decision} />
                <span className="text-sm font-medium">{show(result.firing_rule)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm sm:grid-cols-4">
                <Field label="Vendor" value={show(result.vendor)} />
                <Field label="Category" value={show(result.category)} />
                <Field label="Amount" value={money(result.amount)} />
                <Field label="Policy version" value={show(result.policy_version)} />
              </div>

              <div className="rounded-md border border-border p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <Bot className="size-4" /> Agent explanation
                </div>
                <p>{show(result.explanation)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  The agent extracted the vendor, category, and amount. The decision is the rule
                  core's, not the model's. Request #{show(result.spend_request_id)}.
                </p>
              </div>

              {result.decision !== "refused" && (
                <div className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <Lock className="size-4" /> Commit this request
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {result.decision === "needs_human_approval"
                          ? "Over the approval threshold. A purchaser is refused; an approver can commit."
                          : "Within policy. Any signed-in agent can commit."}
                      </p>
                    </div>
                    <Button size="sm" onClick={doCommit}>
                      Commit as {ROLES.find((r) => r.key === role)!.name}
                    </Button>
                  </div>
                  {commitMsg && (
                    <div
                      className={
                        "mt-3 flex items-start gap-2 rounded-md border p-2 text-sm " +
                        (commitMsg.ok
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border-destructive/40 bg-destructive/10 text-destructive")
                      }
                    >
                      {commitMsg.ok ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0" />
                      )}
                      <span>{commitMsg.text}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function PolicyScreen({ policies }: { policies: PoliciesResponse | null }) {
  const pol = (policies?.policies ?? []) as Array<Record<string, unknown>>;
  const vend = (policies?.vendors ?? []) as Array<Record<string, unknown>>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active spend policy</CardTitle>
          <CardDescription>
            One active version per category. Older versions stay for audit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Per-txn limit</TableHead>
                <TableHead className="text-right">Approval over</TableHead>
                <TableHead className="text-right">Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pol.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium capitalize">{show(p.category)}</TableCell>
                  <TableCell className="text-right">{money(p.per_txn_limit)}</TableCell>
                  <TableCell className="text-right">{money(p.approval_threshold)}</TableCell>
                  <TableCell className="text-right">v{show(p.version)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="size-4" /> Vendors
          </CardTitle>
          <CardDescription>Allowed and blocked vendors. A blocked vendor is always refused.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vend.map((v, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{show(v.name)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{show(v.category)}</TableCell>
                  <TableCell>
                    {v.status === "blocked" ? (
                      <span title={show(v.block_reason)}>
                        <Badge variant="destructive">blocked</Badge>
                      </span>
                    ) : (
                      <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                        allowed
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const FILTERS = [
  { key: "", label: "All" },
  { key: "allowed", label: "Allowed" },
  { key: "needs_human_approval", label: "Needs approval" },
  { key: "refused", label: "Refused" },
];

function AuditScreen({
  actions,
  filter,
  onFilter,
}: {
  actions: ActionsResponse;
  filter: string;
  onFilter: (d: string) => void;
}) {
  const rows = actions as Array<Record<string, unknown>>;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Audit trail</CardTitle>
        <CardDescription>
          Every check, allow, and refusal is written here, whether a human or an agent asked.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => onFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Separator className="mb-3" />
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Firing rule</TableHead>
                  <TableHead className="text-right">Policy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const d = detailOf(r);
                  const req = [show(d.vendor), show(d.category), money(d.amount)]
                    .filter((x) => x !== "—")
                    .join(" · ");
                  return (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {when(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{show(r.action)}</span>
                      </TableCell>
                      <TableCell className="text-sm">{req || "—"}</TableCell>
                      <TableCell>
                        {r.decision ? <DecisionBadge decision={String(r.decision)} /> : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{show(r.firing_rule)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {r.policy_version != null ? `v${show(r.policy_version)}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
      <p>
        Built on Xano with XanoTS. Auth is API-layer role-based access control (an auth table plus
        per-endpoint role guards), not row-level security. The agent reads the request into
        structured fields, and the rule core makes the decision, so a person and an agent get the
        same governed answer.
      </p>
    </footer>
  );
}
