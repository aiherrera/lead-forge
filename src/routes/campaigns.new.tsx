import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Send, AlertTriangle, CheckCircle2 } from "lucide-react";
import { fetchBusinesses, fetchCategories } from "@/lib/db";
import { fetchSegments } from "@/lib/db";
import {
  fetchEmailAccounts, fetchAppSettings, createCampaign, createSequenceStep, insertCampaignLeads,
  insertEmailJobs, updateCampaign,
} from "@/lib/outreach/db";
import { resolveAudience } from "@/lib/outreach/audience";
import { renderForBusiness } from "@/lib/outreach/sender";
import { TEMPLATE_VARIABLES } from "@/lib/outreach/types";
import type { Business, Category } from "@/lib/types";
import type { EmailAccount, AppSettings, AudienceType } from "@/lib/outreach/types";
import type { SavedSegment } from "@/lib/segments";
import { toast } from "sonner";

export const Route = createFileRoute("/campaigns/new")({ component: NewCampaign });

const STEPS = ["Audience", "Sender", "Template", "Compliance", "Sending rules", "Review"];

function NewCampaign() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [segments, setSegments] = useState<SavedSegment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // form state
  const [name, setName] = useState("Untitled campaign");
  const [audienceType, setAudienceType] = useState<AudienceType>("ready");
  const [segmentId, setSegmentId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [onlyReady, setOnlyReady] = useState(true);

  const [senderAccountId, setSenderAccountId] = useState<string>("");
  const [subject, setSubject] = useState("Quick idea for {{businessName}}");
  const [previewText, setPreviewText] = useState("A 2-minute idea I think could help.");
  const [body, setBody] = useState(
`Hi {{firstName}},

I came across {{businessName}} in {{city}} and noticed you have a {{rating}}-star rating with {{reviewCount}} reviews — impressive.

I had a quick idea that might help you get even more bookings from your website. Want me to send the details?

Best,
{{senderName}}
{{senderCompany}}`,
  );
  const [signature, setSignature] = useState("");

  const [senderName, setSenderName] = useState("");
  const [senderCompany, setSenderCompany] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [complianceAddress, setComplianceAddress] = useState("");
  const [emailType, setEmailType] = useState<"commercial" | "transactional" | "manual_follow_up">("commercial");
  const [unsubscribeEnabled, setUnsubscribeEnabled] = useState(true);
  const [goal, setGoal] = useState("Book a 15-minute discovery call");

  const [sendMode, setSendMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledAt, setScheduledAt] = useState("");
  const [dailyLimit, setDailyLimit] = useState(50);
  const [hourlyLimit, setHourlyLimit] = useState(20);
  const [delayMin, setDelayMin] = useState(120);
  const [delayMax, setDelayMax] = useState(300);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("17:00");
  const [stopOnBounce, setStopOnBounce] = useState(0.05);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([fetchBusinesses(), fetchCategories(), fetchEmailAccounts(), fetchSegments(), fetchAppSettings()])
      .then(([b, c, a, s, st]) => {
        setBusinesses(b); setCategories(c); setAccounts(a); setSegments(s); setSettings(st);
        if (a.length > 0) setSenderAccountId(a[0].id);
        if (st.default_sender_name) setSenderName(st.default_sender_name);
        if (st.default_sender_company) setSenderCompany(st.default_sender_company);
        if (st.default_compliance_address) setComplianceAddress(st.default_compliance_address);
      });
  }, []);

  const breakdown = useMemo(() => {
    const segFilters = audienceType === "segment"
      ? segments.find((s) => s.id === segmentId)?.filters
      : undefined;
    return resolveAudience(
      businesses,
      audienceType,
      { segment_id: segmentId || null, category_id: categoryId || null, only_ready: onlyReady },
      new Set(),
      new Set(),
      segFilters,
    );
  }, [businesses, audienceType, segmentId, categoryId, onlyReady, segments]);

  const account = accounts.find((a) => a.id === senderAccountId);
  const previewBusiness = breakdown.sendable[0];
  const previewCategory = previewBusiness ? categories.find((c) => c.id === previewBusiness.category_id) ?? null : null;
  const preview = previewBusiness
    ? renderForBusiness(subject, body, previewBusiness, previewCategory, { sender_name: senderName, sender_company: senderCompany })
    : null;

  const warnings: string[] = [];
  if (emailType === "commercial" && !unsubscribeEnabled) warnings.push("Commercial emails require an unsubscribe link.");
  if (emailType === "commercial" && !complianceAddress.trim()) warnings.push("Commercial emails require a physical mailing address.");
  if (!senderAccountId) warnings.push("Pick a sender account.");
  if (!senderName.trim()) warnings.push("Sender name is required.");
  if (breakdown.sendable.length === 0) warnings.push("Audience is empty — no sendable leads.");
  if (preview && preview.missing.length > 0) warnings.push(`Some variables are missing in preview: ${preview.missing.join(", ")}`);

  async function handleCreate(launch: boolean) {
    if (warnings.length > 0 && launch) {
      toast.error(warnings[0]);
      return;
    }
    setSubmitting(true);
    try {
      const status = launch ? (sendMode === "scheduled" ? "scheduled" : "sending") : "draft";
      const campaign = await createCampaign({
        name, status, audience_type: audienceType,
        audience_config: { segment_id: segmentId || null, category_id: categoryId || null, only_ready: onlyReady },
        sender_account_id: senderAccountId || null,
        goal, email_type: emailType,
        sender_name: senderName, sender_company: senderCompany,
        reply_to_email: replyToEmail || null,
        compliance_address: complianceAddress,
        unsubscribe_enabled: unsubscribeEnabled,
        send_mode: sendMode,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        daily_limit: dailyLimit, hourly_limit: hourlyLimit,
        delay_seconds_min: delayMin, delay_seconds_max: delayMax,
        send_window_start: windowStart, send_window_end: windowEnd,
        stop_on_bounce_rate: stopOnBounce,
        total_leads: breakdown.total,
        sendable_count: breakdown.sendable.length,
        excluded_count: breakdown.total - breakdown.sendable.length,
      });

      // create the initial sequence step
      await createSequenceStep({
        campaign_id: campaign.id, step_number: 1, name: "Initial email",
        delay_days: 0, subject, body_text: body,
      });

      // create campaign_leads
      const leadRows = breakdown.sendable.map((b) => ({
        campaign_id: campaign.id, business_id: b.id, status: "queued" as const,
      }));
      await insertCampaignLeads(leadRows);

      if (launch) {
        // create email_jobs for the first step
        const baseTime = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
        const jobs = breakdown.sendable.map((b, i) => {
          const cat = categories.find((c) => c.id === b.category_id) ?? null;
          const r = renderForBusiness(subject, body, b, cat, { sender_name: senderName, sender_company: senderCompany });
          return {
            campaign_id: campaign.id, business_id: b.id,
            sender_account_id: senderAccountId || null,
            recipient_email: b.email ?? "",
            subject: r.subject, body_text: r.bodyText, body_html: r.bodyHtml,
            status: "queued" as const, is_simulated: settings?.mock_mode ?? true,
            scheduled_at: new Date(baseTime + i * (delayMin * 1000)).toISOString(),
          };
        });
        await insertEmailJobs(jobs);
        await updateCampaign(campaign.id, { last_activity_at: new Date().toISOString() });
      }

      toast.success(launch ? "Campaign launched" : "Saved as draft");
      nav({ to: "/campaigns/$id", params: { id: campaign.id } });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create campaign: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="New campaign">
      <div className="max-w-5xl mx-auto">
        <Input value={name} onChange={(e) => setName(e.target.value)}
          className="text-xl font-semibold mb-4 max-w-md" placeholder="Campaign name" />

        <div className="flex items-center gap-2 mb-6 overflow-x-auto">
          {STEPS.map((label, i) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
            }`}>
              <span className="font-medium">{i + 1}.</span>{label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <Card>
            <CardHeader><CardTitle>Choose audience</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Audience type</Label>
                <Select value={audienceType} onValueChange={(v) => setAudienceType(v as AudienceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ready">Ready-for-outreach leads only</SelectItem>
                    <SelectItem value="segment">Saved segment</SelectItem>
                    <SelectItem value="category">By category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {audienceType === "segment" && (
                <div>
                  <Label>Segment</Label>
                  <Select value={segmentId} onValueChange={setSegmentId}>
                    <SelectTrigger><SelectValue placeholder="Pick a segment" /></SelectTrigger>
                    <SelectContent>
                      {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {audienceType === "category" && (
                <div>
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Only ready-for-outreach leads</div>
                  <div className="text-sm text-muted-foreground">Exclude leads needing cleanup or contact info.</div>
                </div>
                <Switch checked={onlyReady} onCheckedChange={setOnlyReady} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t">
                <Stat label="Matched" value={breakdown.total} />
                <Stat label="Sendable" value={breakdown.sendable.length} tone="emerald" />
                <Stat label="No email" value={breakdown.excludedNoEmail} tone="amber" />
                <Stat label="Suppressed" value={breakdown.excludedSuppressed} tone="amber" />
                <Stat label="Duplicates" value={breakdown.excludedDuplicate} tone="amber" />
                <Stat label="Bad data" value={breakdown.excludedBadData} tone="amber" />
                <Stat label="Unsubscribed" value={breakdown.excludedUnsubscribed} tone="amber" />
                <Stat label="Do not contact" value={breakdown.excludedDoNotContact} tone="amber" />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Choose sender account</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {accounts.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                  No sender accounts yet. <a href="/email-accounts" className="underline">Add one</a> before launching.
                </div>
              ) : (
                <Select value={senderAccountId} onValueChange={setSenderAccountId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.sender_email} ({a.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {account && (
                <div className="text-sm text-muted-foreground">
                  Daily limit: {account.daily_limit} · Hourly limit: {account.hourly_limit}
                </div>
              )}
              {settings?.mock_mode && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  Simulation mode is on — emails won't actually be delivered. Toggle in Email settings.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Email template</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <Label>Preview text</Label>
                <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
              </div>
              <div>
                <Label>Body</Label>
                <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <div>
                <Label>Signature (optional)</Label>
                <Textarea rows={3} value={signature} onChange={(e) => setSignature(e.target.value)} />
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-xs">
                <div className="font-medium mb-1">Available variables (click to copy)</div>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button key={v} onClick={() => navigator.clipboard.writeText(`{{${v}}}`)}
                      className="px-2 py-0.5 rounded bg-background border hover:border-primary text-xs">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
              {preview && (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="text-xs text-muted-foreground">Live preview for: {previewBusiness?.name}</div>
                  <div className="font-medium">{preview.subject}</div>
                  <pre className="whitespace-pre-wrap text-sm">{preview.bodyText}</pre>
                  {preview.missing.length > 0 && (
                    <div className="text-xs text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Missing: {preview.missing.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Compliance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sender name *</Label><Input value={senderName} onChange={(e) => setSenderName(e.target.value)} /></div>
                <div><Label>Sender company</Label><Input value={senderCompany} onChange={(e) => setSenderCompany(e.target.value)} /></div>
                <div><Label>Reply-to email</Label><Input type="email" value={replyToEmail} onChange={(e) => setReplyToEmail(e.target.value)} /></div>
                <div>
                  <Label>Email type</Label>
                  <Select value={emailType} onValueChange={(v) => setEmailType(v as typeof emailType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="transactional">Transactional</SelectItem>
                      <SelectItem value="manual_follow_up">Manual follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Physical mailing address {emailType === "commercial" && <span className="text-rose-600">*</span>}</Label>
                <Textarea rows={2} value={complianceAddress} onChange={(e) => setComplianceAddress(e.target.value)} />
              </div>
              <div><Label>Campaign purpose</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Include unsubscribe link</div>
                  <div className="text-xs text-muted-foreground">Required for commercial emails.</div>
                </div>
                <Switch checked={unsubscribeEnabled} onCheckedChange={setUnsubscribeEnabled} disabled={emailType === "commercial"} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Sending rules</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Send mode</Label>
                <Select value={sendMode} onValueChange={(v) => setSendMode(v as "immediate" | "scheduled")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Send immediately on launch</SelectItem>
                    <SelectItem value="scheduled">Schedule for later</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {sendMode === "scheduled" && (
                <div><Label>Scheduled time</Label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Daily limit</Label><Input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(+e.target.value)} /></div>
                <div><Label>Hourly limit</Label><Input type="number" value={hourlyLimit} onChange={(e) => setHourlyLimit(+e.target.value)} /></div>
                <div><Label>Delay between emails (min seconds)</Label><Input type="number" value={delayMin} onChange={(e) => setDelayMin(+e.target.value)} /></div>
                <div><Label>Delay between emails (max seconds)</Label><Input type="number" value={delayMax} onChange={(e) => setDelayMax(+e.target.value)} /></div>
                <div><Label>Sending window start</Label><Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} /></div>
                <div><Label>Sending window end</Label><Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} /></div>
                <div><Label>Stop on bounce rate above</Label><Input type="number" step="0.01" value={stopOnBounce} onChange={(e) => setStopOnBounce(+e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader><CardTitle>Review and launch</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Campaign" value={name} />
                <Field label="Sender" value={account ? `${account.sender_name} <${account.sender_email}>` : "—"} />
                <Field label="Audience" value={`${audienceType}`} />
                <Field label="Email type" value={emailType} />
                <Field label="Sendable leads" value={String(breakdown.sendable.length)} />
                <Field label="Excluded" value={String(breakdown.total - breakdown.sendable.length)} />
                <Field label="Unsubscribe link" value={unsubscribeEnabled ? "Yes" : "No"} />
                <Field label="Send mode" value={sendMode + (scheduledAt ? ` (${scheduledAt})` : "")} />
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Sample personalized email</div>
                {preview ? (
                  <div className="rounded-lg border p-4 space-y-1 text-sm">
                    <div className="text-xs text-muted-foreground">To: {previewBusiness?.email}</div>
                    <div className="font-medium">{preview.subject}</div>
                    <pre className="whitespace-pre-wrap">{preview.bodyText}</pre>
                  </div>
                ) : <div className="text-sm text-muted-foreground">No sendable leads to preview.</div>}
              </div>
              {warnings.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-amber-900 mb-1">
                    <AlertTriangle className="h-4 w-4" /> Please fix before launching
                  </div>
                  <ul className="list-disc list-inside text-amber-900">
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Ready to launch
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between mt-6">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" disabled={submitting} onClick={() => handleCreate(false)}>Save draft</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>Next<ArrowRight className="h-4 w-4 ml-2" /></Button>
            ) : (
              <Button disabled={submitting || warnings.length > 0} onClick={() => handleCreate(true)}>
                <Send className="h-4 w-4 mr-2" />Launch campaign
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
