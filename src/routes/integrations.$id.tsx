import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { fetchIntegration, fetchSyncJobs } from "@/lib/integrations/db";
import { PROVIDER_META, type Integration, type SyncJob } from "@/lib/integrations/types";
import { MappingEditor } from "@/components/integrations/MappingEditor";
import { SyncRulesEditor } from "@/components/integrations/SyncRulesEditor";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/integrations/$id")({ component: IntegrationDetailPage });

function IntegrationDetailPage() {
  const { id } = useParams({ from: "/integrations/$id" });
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [jobs, setJobs] = useState<SyncJob[]>([]);

  useEffect(() => {
    fetchIntegration(id).then(setIntegration);
    fetchSyncJobs({ integrationId: id }).then((j) => setJobs(j.slice(0, 50)));
  }, [id]);

  if (!integration) {
    return <AppShell title="Integration"><div className="text-sm text-muted-foreground">Loading…</div></AppShell>;
  }

  const meta = PROVIDER_META[integration.provider];

  return (
    <AppShell title={integration.name} action={
      <Button asChild variant="outline" size="sm"><Link to="/integrations"><ChevronLeft className="h-4 w-4 mr-1" />Back</Link></Button>
    }>
      <div className="flex items-center gap-3 mb-4">
        <Badge variant="outline">{meta.label}</Badge>
        <Badge variant="outline" className={integration.status === "connected" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : integration.status === "error" ? "bg-rose-50 text-rose-700 border-rose-200" : ""}>{integration.status}</Badge>
        {integration.is_enabled ? <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Enabled</Badge> : <Badge variant="outline">Disabled</Badge>}
      </div>

      <Tabs defaultValue="mapping">
        <TabsList>
          <TabsTrigger value="mapping">Field mapping</TabsTrigger>
          <TabsTrigger value="rules">Sync rules</TabsTrigger>
          <TabsTrigger value="jobs">Recent jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="mapping" className="mt-4">
          <MappingEditor integrationId={integration.id} providerLabel={meta.label} />
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <SyncRulesEditor integrationId={integration.id} />
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No sync jobs yet. Run a manual sync from Businesses or Pipeline.</div>
              ) : (
                <div className="divide-y">
                  {jobs.map((j) => (
                    <div key={j.id} className="p-3 grid grid-cols-[80px_1fr_auto] gap-3 items-center text-sm">
                      <Badge variant="outline" className={j.status === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : j.status === "failed" ? "bg-rose-50 text-rose-700 border-rose-200" : ""}>{j.status}</Badge>
                      <div className="truncate">
                        <span className="text-foreground">{j.action}</span>
                        <span className="text-muted-foreground"> · {j.target_object}</span>
                        {j.error_message && <span className="text-rose-700"> · {j.error_message}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
