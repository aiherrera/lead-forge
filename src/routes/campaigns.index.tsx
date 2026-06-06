import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, AlertTriangle } from "lucide-react";
import { fetchCampaigns, fetchAppSettings } from "@/lib/outreach/db";
import { CAMPAIGN_STATUS_META, type Campaign, type AppSettings } from "@/lib/outreach/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/campaigns/")({ component: CampaignsIndex });

function CampaignsIndex() {
  const [list, setList] = useState<Campaign[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCampaigns(), fetchAppSettings()]).then(([c, s]) => {
      setList(c);
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const filtered = status === "all" ? list : list.filter((c) => c.status === status);

  return (
    <AppShell
      title="Campaigns"
      action={
        <Link to="/campaigns/new">
          <Button><Plus className="h-4 w-4 mr-2" />New campaign</Button>
        </Link>
      }
    >
      {settings?.mock_mode && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <b>Simulation mode is ON.</b> Emails are not actually delivered.
            All sends are logged as <code>[SIMULATED]</code>. Toggle in{" "}
            <Link to="/email-settings" className="underline">Email settings</Link>.
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(CAMPAIGN_STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">{filtered.length} campaign(s)</div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-lg font-medium">No campaigns yet</div>
            <p className="text-sm text-muted-foreground max-w-md">
              Create a campaign to reach out to your leads. Choose an audience, pick a sender, draft your email, and send.
            </p>
            <Link to="/campaigns/new">
              <Button><Plus className="h-4 w-4 mr-2" />Create your first campaign</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const meta = CAMPAIGN_STATUS_META[c.status];
            return (
              <Link to="/campaigns/$id" params={{ id: c.id }} key={c.id}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <Stat label="Leads" value={c.total_leads} />
                    <Stat label="Sendable" value={c.sendable_count} />
                    <Stat label="Sent" value={c.sent_count} />
                    <Stat label="Bounced" value={c.bounced_count} />
                    <Stat label="Replied" value={c.replied_count} />
                    <Stat label="Unsubscribed" value={c.unsubscribed_count} />
                    <div className="pt-2 text-xs text-muted-foreground">
                      Created {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
