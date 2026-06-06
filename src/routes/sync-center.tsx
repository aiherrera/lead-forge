import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { fetchSyncJobs, fetchIntegrations, fetchSyncEvents, fetchSyncRules } from "@/lib/integrations/db";
import type { SyncJob, Integration, SyncEvent, SyncRule } from "@/lib/integrations/types";
import { PROVIDER_META, TRIGGER_TYPES } from "@/lib/integrations/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Play, RotateCcw, Ban } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runQueueNow, retrySyncJob, cancelSyncJob } from "@/lib/integrations/queue.functions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/sync-center")({ component: SyncCenterPage });

function SyncCenterPage() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [rules, setRules] = useState<SyncRule[]>([]);
  const [running, setRunning] = useState(false);

  const runQueue = useServerFn(runQueueNow);
  const retry = useServerFn(retrySyncJob);
  const cancel = useServerFn(cancelSyncJob);

  async function refresh() {
    setJobs(await fetchSyncJobs());
    setIntegrations(await fetchIntegrations());
    setEvents(await fetchSyncEvents());
    setRules(await fetchSyncRules());
  }
  useEffect(() => { refresh(); }, []);

  const counts = {
    total: jobs.length,
    pending: jobs.filter((j) => j.status === "pending").length,
    running: jobs.filter((j) => j.status === "running").length,
    success: jobs.filter((j) => j.status === "success").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    cancelled: jobs.filter((j) => j.status === "cancelled").length,
  };
  const active = integrations.filter((i) => i.is_enabled && i.status === "connected").length;

  async function onRunNow() {
    setRunning(true);
    try {
      const r = await runQueue();
      toast.success(`Queue run: ${r.succeeded} ok, ${r.failed} failed, ${r.retried} retried, ${r.permanentlyFailed} permanently failed`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Queue run failed");
    } finally { setRunning(false); }
  }
  async function onRetry(id: string) {
    await retry({ data: { jobId: id } });
    toast.success("Job re-queued");
    refresh();
  }
  async function onCancel(id: string) {
    await cancel({ data: { jobId: id } });
    toast.success("Job cancelled");
    refresh();
  }

  return (
    <AppShell title="Sync center" action={
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
        <Button size="sm" onClick={onRunNow} disabled={running}><Play className="h-4 w-4 mr-1" />{running ? "Running…" : "Run queue now"}</Button>
      </div>
    }>
      <p className="text-sm text-muted-foreground mb-4">
        Every sync attempt is queued, retried with exponential backoff (up to 5 attempts), and recorded here. Configure the cron schedule on the deployed app to process the queue automatically.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        <Kpi label="Total" value={counts.total} />
        <Kpi label="Pending" value={counts.pending} tone="blue" />
        <Kpi label="Running" value={counts.running} tone="amber" />
        <Kpi label="Succeeded" value={counts.success} tone="emerald" />
        <Kpi label="Failed" value={counts.failed} tone="rose" />
        <Kpi label="Cancelled" value={counts.cancelled} />
        <Kpi label="Active integrations" value={active} />
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Queue ({counts.pending + counts.running})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="errors">Errors ({counts.failed})</TabsTrigger>
          <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-3">
          <JobTable
            jobs={jobs.filter((j) => j.status === "pending" || j.status === "running")}
            integrations={integrations}
            empty="No pending jobs."
            actions={(j) => (
              <Button size="sm" variant="ghost" onClick={() => onCancel(j.id)}><Ban className="h-3.5 w-3.5 mr-1" />Cancel</Button>
            )}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <JobTable jobs={jobs.filter((j) => j.status === "success" || j.status === "cancelled")} integrations={integrations} empty="No completed jobs yet." />
        </TabsContent>
        <TabsContent value="errors" className="mt-3">
          <JobTable
            jobs={jobs.filter((j) => j.status === "failed")}
            integrations={integrations}
            empty="No failed jobs."
            actions={(j) => (
              <Button size="sm" variant="outline" onClick={() => onRetry(j.id)}><RotateCcw className="h-3.5 w-3.5 mr-1" />Retry</Button>
            )}
          />
        </TabsContent>

        <TabsContent value="rules" className="mt-3">
          <Card><CardContent className="p-0">
            {rules.length === 0 ? (
              <div className="text-sm text-muted-foreground p-6 text-center">No sync rules configured. Open an integration and add rules under <em>Sync rules</em>.</div>
            ) : (
              <div className="divide-y">
                {rules.map((r) => {
                  const intg = integrations.find((i) => i.id === r.integration_id);
                  return (
                    <div key={r.id} className="p-3 flex items-center gap-3 text-sm">
                      <div className="flex-1">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {intg?.name ?? "—"} ({intg ? PROVIDER_META[intg.provider].label : "—"}) ·{" "}
                          <Badge variant="outline" className="text-[10px]">{TRIGGER_TYPES.find((t) => t.value === r.trigger_type)?.label ?? r.trigger_type}</Badge>
                        </div>
                      </div>
                      <Badge variant="outline" className={r.is_enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>{r.is_enabled ? "Enabled" : "Disabled"}</Badge>
                      {intg && (
                        <Button asChild size="sm" variant="ghost"><Link to="/integrations/$id" params={{ id: intg.id }}>Open</Link></Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-3">
          <Card><CardContent className="p-0">
            {events.length === 0 ? (
              <div className="text-sm text-muted-foreground p-6 text-center">No log events yet.</div>
            ) : (
              <div className="divide-y">
                {events.slice(0, 200).map((e) => (
                  <div key={e.id} className="p-2.5 text-xs grid grid-cols-[140px_120px_1fr_140px] gap-2 items-center">
                    <Badge variant="outline" className="w-fit">{e.event_type}</Badge>
                    <span className="text-muted-foreground truncate">{integrations.find((i) => i.id === e.integration_id)?.name ?? "—"}</span>
                    <span className="truncate">{e.message ?? ""}</span>
                    <span className="text-muted-foreground text-right">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function JobTable({
  jobs, integrations, empty, actions,
}: { jobs: SyncJob[]; integrations: Integration[]; empty: string; actions?: (j: SyncJob) => React.ReactNode }) {
  if (jobs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">{empty}</CardContent></Card>;
  }
  return (
    <Card><CardContent className="p-0">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b bg-muted/40">
            <tr>
              <th className="text-left py-2 px-3">Integration</th>
              <th className="text-left">Target</th>
              <th className="text-left">Action</th>
              <th className="text-left">Status</th>
              <th className="text-left">Retries</th>
              <th className="text-left">Scheduled</th>
              <th className="text-left">Error</th>
              {actions && <th></th>}
            </tr>
          </thead>
          <tbody>
            {jobs.slice(0, 200).map((j) => {
              const intg = integrations.find((i) => i.id === j.integration_id);
              return (
                <tr key={j.id} className="border-b last:border-0">
                  <td className="py-2 px-3">{intg?.name ?? "—"}</td>
                  <td>{j.target_object}</td>
                  <td>{j.action}</td>
                  <td><StatusBadge status={j.status} /></td>
                  <td className="text-xs">{j.retry_count}</td>
                  <td className="text-xs">{new Date(j.scheduled_at).toLocaleString()}</td>
                  <td className="text-xs text-rose-600 max-w-xs truncate">{j.error_message ?? ""}</td>
                  {actions && <td className="text-right pr-3">{actions(j)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CardContent></Card>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: "emerald" | "rose" | "blue" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : tone === "blue" ? "text-blue-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <Card><CardContent className="p-3">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </CardContent></Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700 border-blue-200",
    running: "bg-amber-100 text-amber-800 border-amber-200",
    success: "bg-emerald-100 text-emerald-700 border-emerald-200",
    failed: "bg-rose-100 text-rose-700 border-rose-200",
    skipped: "bg-slate-100 text-slate-600 border-slate-200",
    cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return <Badge variant="outline" className={`text-[10px] ${map[status] ?? ""}`}>{status}</Badge>;
}
