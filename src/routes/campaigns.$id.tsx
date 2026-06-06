import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Play, Pause, Trash2, RefreshCw, Shield, Mail, SkipForward, MessageSquare, Ban } from "lucide-react";
import {
  fetchCampaign, fetchEmailJobs, fetchCampaignLeads, fetchSequenceSteps, fetchEmailEvents,
  updateCampaign, updateCampaignLead, deleteCampaign, addSuppression,
} from "@/lib/outreach/db";
import { processJob } from "@/lib/outreach/sender";
import { fetchBusinesses } from "@/lib/db";
import { CAMPAIGN_STATUS_META, EMAIL_JOB_STATUS_META, REPLY_OUTCOMES, type Campaign, type CampaignLead, type EmailJob, type SequenceStep, type EmailEvent } from "@/lib/outreach/types";
import type { Business, Category } from "@/lib/types";
import { fetchCategories } from "@/lib/db";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateCampaignCompliance } from "@/lib/outreach/compliance";
import { ComplianceCheckDialog } from "@/components/outreach/ComplianceCheckDialog";
import { OneOffEmailDialog } from "@/components/outreach/OneOffEmailDialog";
import { SequenceEditor } from "@/components/outreach/SequenceEditor";

export const Route = createFileRoute("/campaigns/$id")({ component: CampaignDetail });

function CampaignDetail() {
  const { id } = Route.useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [businesses, setBusinesses] = useState<Map<string, Business>>(new Map());
  const [categories, setCategories] = useState<Category[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [oneOffLead, setOneOffLead] = useState<Business | null>(null);

  async function refresh() {
    const [c, l, j, s, e, bs, cats] = await Promise.all([
      fetchCampaign(id), fetchCampaignLeads(id), fetchEmailJobs({ campaignId: id }),
      fetchSequenceSteps(id), fetchEmailEvents({ campaignId: id }), fetchBusinesses(), fetchCategories(),
    ]);
    setCampaign(c); setLeads(l); setJobs(j); setSteps(s); setEvents(e);
    setBusinesses(new Map(bs.map((b) => [b.id, b])));
    setCategories(cats);
  }
  useEffect(() => { refresh(); }, [id]);

  const complianceIssues = useMemo(() => {
    if (!campaign) return [];
    return validateCampaignCompliance(campaign, steps, { sendableCount: campaign.sendable_count });
  }, [campaign, steps]);

  if (!campaign) return <AppShell title="Campaign"><div>Loading…</div></AppShell>;

  const meta = CAMPAIGN_STATUS_META[campaign.status];
  const dueJobs = jobs.filter((j) => (j.status === "queued" || j.status === "scheduled") && new Date(j.scheduled_at).getTime() <= Date.now());

  async function processQueue() {
    setProcessing(true);
    try {
      let n = 0;
      for (const job of dueJobs.slice(0, 25)) {
        await processJob(job);
        n++;
      }
      toast.success(`Processed ${n} email(s)`);
      await refresh();
    } catch (e) {
      toast.error("Queue processing failed: " + (e instanceof Error ? e.message : String(e)));
    } finally { setProcessing(false); }
  }

  async function setStatus(s: Campaign["status"]) {
    await updateCampaign(id, { status: s });
    toast.success("Status updated");
    refresh();
  }
  async function remove() {
    if (!confirm("Delete this campaign? Email jobs and leads will be removed.")) return;
    await deleteCampaign(id);
    toast.success("Deleted");
    window.location.href = "/campaigns";
  }

  function toggleSelect(leadId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId); else next.add(leadId);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  }
  async function bulkAction(action: "skip" | "replied" | "not_interested" | "unsubscribe" | "resume") {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Apply "${action}" to ${ids.length} lead(s)?`)) return;
    const now = new Date().toISOString();
    try {
      for (const lid of ids) {
        const lead = leads.find((l) => l.id === lid);
        if (!lead) continue;
        if (action === "skip") {
          await updateCampaignLead(lid, { status: "skipped", skipped_at: now, skip_reason: "bulk_manual" });
        } else if (action === "replied") {
          await updateCampaignLead(lid, { status: "replied", replied_at: now, reply_outcome: "interested" });
        } else if (action === "not_interested") {
          await updateCampaignLead(lid, { status: "replied", replied_at: now, reply_outcome: "not_interested" });
        } else if (action === "unsubscribe") {
          const b = businesses.get(lead.business_id);
          await updateCampaignLead(lid, { status: "unsubscribed", unsubscribed_at: now });
          if (b?.email) {
            await addSuppression({ email: b.email, reason: "unsubscribed", source: "bulk_action", campaign_id: id, business_id: b.id });
          }
        } else if (action === "resume") {
          await updateCampaignLead(lid, { status: "queued", skipped_at: null, skip_reason: null });
        }
      }
      toast.success(`Applied to ${ids.length} lead(s)`);
      setSelected(new Set());
      refresh();
    } catch (e) {
      toast.error("Bulk action failed: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function startSending() {
    await updateCampaign(id, { status: "sending" });
    toast.success("Campaign is now sending");
    setComplianceOpen(false);
    refresh();
  }

  return (
    <AppShell
      title={campaign.name}
      action={
        <div className="flex items-center gap-2">
          <Link to="/campaigns"><Button variant="ghost"><ArrowLeft className="h-4 w-4 mr-2" />All campaigns</Button></Link>
          <Button variant="outline" onClick={() => setComplianceOpen(true)}>
            <Shield className="h-4 w-4 mr-2" />Safety check
            {complianceIssues.some((i) => i.severity === "error") && (
              <Badge variant="outline" className="ml-2 bg-rose-100 text-rose-700 text-[10px]">
                {complianceIssues.filter((i) => i.severity === "error").length}
              </Badge>
            )}
          </Button>
          {campaign.status === "sending" ? (
            <Button variant="outline" onClick={() => setStatus("paused")}><Pause className="h-4 w-4 mr-2" />Pause</Button>
          ) : campaign.status !== "completed" && campaign.status !== "archived" ? (
            <Button variant="outline" onClick={() => setComplianceOpen(true)}><Play className="h-4 w-4 mr-2" />Resume</Button>
          ) : null}
          <Button onClick={processQueue} disabled={processing || campaign.status === "paused" || dueJobs.length === 0}>
            <RefreshCw className={`h-4 w-4 mr-2 ${processing ? "animate-spin" : ""}`} />
            Process queue ({dueJobs.length})
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
        {campaign.email_type && <Badge variant="outline">{campaign.email_type}</Badge>}
        {jobs.some((j) => j.is_simulated) && <Badge variant="outline" className="bg-amber-100 text-amber-700">Simulated</Badge>}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="emails">Emails ({jobs.length})</TabsTrigger>
          <TabsTrigger value="sequence">Sequence ({steps.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Metric label="Leads" value={campaign.total_leads} />
            <Metric label="Sendable" value={campaign.sendable_count} />
            <Metric label="Sent" value={jobs.filter((j) => j.status === "sent").length} />
            <Metric label="Scheduled" value={jobs.filter((j) => j.status === "queued" || j.status === "scheduled").length} />
            <Metric label="Failed" value={jobs.filter((j) => j.status === "failed").length} />
            <Metric label="Bounced" value={jobs.filter((j) => j.status === "bounced").length} />
            <Metric label="Replied" value={leads.filter((l) => l.replied_at).length} />
            <Metric label="Unsubscribed" value={leads.filter((l) => l.unsubscribed_at).length} />
          </div>
          {events.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  {events.slice(0, 15).map((e) => (
                    <li key={e.id} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-32">{new Date(e.created_at).toLocaleString()}</span>
                      <Badge variant="outline">{e.event_type}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leads" className="space-y-3">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => bulkAction("skip")}>
                  <SkipForward className="h-3 w-3 mr-1" />Skip
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkAction("replied")}>
                  <MessageSquare className="h-3 w-3 mr-1" />Mark replied
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkAction("not_interested")}>
                  Not interested
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkAction("unsubscribe")}>
                  <Ban className="h-3 w-3 mr-1" />Unsubscribe
                </Button>
                <Button size="sm" variant="ghost" onClick={() => bulkAction("resume")}>Resume</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={leads.length > 0 && selected.size === leads.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Business</TableHead><TableHead>Email</TableHead>
                  <TableHead>Status</TableHead><TableHead>Reply</TableHead>
                  <TableHead>Last sent</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {leads.map((l) => {
                    const b = businesses.get(l.business_id);
                    return (
                      <TableRow key={l.id} data-state={selected.has(l.id) ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} />
                        </TableCell>
                        <TableCell className="font-medium">{b?.name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{b?.email ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                        <TableCell>
                          <Select value={l.reply_outcome ?? ""} onValueChange={async (v) => {
                            await updateCampaignLead(l.id, {
                              reply_outcome: v as CampaignLead["reply_outcome"],
                              replied_at: new Date().toISOString(),
                              status: "replied",
                            });
                            refresh();
                          }}>
                            <SelectTrigger className="w-44 h-8"><SelectValue placeholder="Mark…" /></SelectTrigger>
                            <SelectContent>
                              {REPLY_OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.last_email_sent_at ? new Date(l.last_email_sent_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" disabled={!b?.email}
                              onClick={() => b && setOneOffLead(b)}>
                              <Mail className="h-3 w-3 mr-1" />Email
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={async () => { await updateCampaignLead(l.id, { status: "skipped", skipped_at: new Date().toISOString(), skip_reason: "manual" }); refresh(); }}>
                              Skip
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Recipient</TableHead><TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead><TableHead>Scheduled</TableHead>
                  <TableHead>Sent</TableHead><TableHead>Failure</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {jobs.map((j) => {
                    const m = EMAIL_JOB_STATUS_META[j.status];
                    return (
                      <TableRow key={j.id}>
                        <TableCell className="text-sm">{j.recipient_email}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{j.subject}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={m.tone}>{m.label}</Badge>
                          {j.is_simulated && <Badge variant="outline" className="ml-1 bg-amber-50 text-amber-700 text-[10px]">SIM</Badge>}
                        </TableCell>
                        <TableCell className="text-xs">{new Date(j.scheduled_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{j.sent_at ? new Date(j.sent_at).toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-xs text-rose-700">{j.failure_reason ?? ""}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequence">
          <SequenceEditor campaignId={id} steps={steps} onChange={refresh} />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Sent" value={jobs.filter((j) => j.status === "sent").length} />
            <Metric label="Bounce rate" value={percent(jobs.filter((j) => j.status === "bounced").length, jobs.length)} suffix="%" />
            <Metric label="Reply rate" value={percent(leads.filter((l) => l.replied_at).length, leads.length)} suffix="%" />
            <Metric label="Unsubscribe rate" value={percent(leads.filter((l) => l.unsubscribed_at).length, leads.length)} suffix="%" />
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            Open and click tracking: <Badge variant="outline">Not connected yet</Badge>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Sending</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><b>Sender account:</b> {campaign.sender_account_id ?? "—"}</div>
              <div><b>Daily limit:</b> {campaign.daily_limit}</div>
              <div><b>Hourly limit:</b> {campaign.hourly_limit}</div>
              <div><b>Window:</b> {campaign.send_window_start} – {campaign.send_window_end}</div>
              <div><b>Stop on bounce rate:</b> {(campaign.stop_on_bounce_rate * 100).toFixed(0)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Compliance</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><b>Sender name:</b> {campaign.sender_name}</div>
              <div><b>Sender company:</b> {campaign.sender_company}</div>
              <div><b>Reply-to:</b> {campaign.reply_to_email ?? "—"}</div>
              <div><b>Physical address:</b> {campaign.compliance_address ?? "—"}</div>
              <div><b>Unsubscribe link:</b> {campaign.unsubscribe_enabled ? "Enabled" : "Disabled"}</div>
            </CardContent>
          </Card>
          <Button variant="destructive" onClick={remove}><Trash2 className="h-4 w-4 mr-2" />Delete campaign</Button>
        </TabsContent>
      </Tabs>

      <ComplianceCheckDialog
        open={complianceOpen}
        onOpenChange={setComplianceOpen}
        issues={complianceIssues}
        onConfirm={startSending}
        confirmLabel={campaign.status === "sending" ? "Continue sending" : "Start sending"}
      />
      <OneOffEmailDialog
        open={!!oneOffLead}
        onOpenChange={(v) => { if (!v) setOneOffLead(null); }}
        business={oneOffLead}
        category={oneOffLead?.category_id ? categories.find((c) => c.id === oneOffLead.category_id) ?? null : null}
        onSent={refresh}
      />
    </AppShell>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}{suffix}</div>
    </div>
  );
}
function percent(n: number, d: number) { return d === 0 ? "0" : ((n / d) * 100).toFixed(1); }
