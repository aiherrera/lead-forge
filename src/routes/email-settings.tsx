import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAppSettings, updateAppSettings, fetchEmailAccounts } from "@/lib/outreach/db";
import type { AppSettings, EmailAccount } from "@/lib/outreach/types";
import { toast } from "sonner";

export const Route = createFileRoute("/email-settings")({ component: EmailSettingsPage });

function EmailSettingsPage() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);

  useEffect(() => {
    Promise.all([fetchAppSettings(), fetchEmailAccounts()]).then(([a, b]) => { setS(a); setAccounts(b); });
  }, []);

  async function save(patch: Partial<AppSettings>) {
    setS(s ? { ...s, ...patch } : s);
    await updateAppSettings(patch);
    toast.success("Saved");
  }

  if (!s) return <AppShell title="Email settings"><div>Loading…</div></AppShell>;

  return (
    <AppShell title="Email settings">
      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader><CardTitle>Sending mode</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">Simulation mode</div>
                <div className="text-sm text-muted-foreground">When on, emails are queued, "sent", and logged but never actually delivered. All events are labeled SIMULATED.</div>
              </div>
              <Switch checked={s.mock_mode} onCheckedChange={(v) => save({ mock_mode: v })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Defaults</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Default sender account</Label>
              <Select value={s.default_sender_account_id ?? ""} onValueChange={(v) => save({ default_sender_account_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} — {a.sender_email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Default sender name</Label><Input defaultValue={s.default_sender_name ?? ""} onBlur={(e) => save({ default_sender_name: e.target.value })} /></div>
            <div><Label>Default sender company</Label><Input defaultValue={s.default_sender_company ?? ""} onBlur={(e) => save({ default_sender_company: e.target.value })} /></div>
            <div><Label>Default physical mailing address (compliance)</Label><Input defaultValue={s.default_compliance_address ?? ""} onBlur={(e) => save({ default_compliance_address: e.target.value })} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Safety</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Global daily cap</Label><Input type="number" defaultValue={s.global_daily_cap} onBlur={(e) => save({ global_daily_cap: +e.target.value })} /></div>
            <div><Label>Bounce alert threshold (0.05 = 5%)</Label><Input type="number" step="0.01" defaultValue={s.bounce_alert_rate} onBlur={(e) => save({ bounce_alert_rate: +e.target.value })} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Background queue worker</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Due email jobs are processed by a public worker endpoint. Point a scheduler (e.g. pg_cron, GitHub Actions, cron-job.org) at it to send queued emails every minute.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs break-all">
              POST {typeof window !== "undefined" ? window.location.origin : ""}/api/public/hooks/process-email-queue
              <br />Header: <span className="text-foreground">apikey: &lt;your Lovable Cloud anon key&gt;</span>
            </div>
            <p className="text-xs text-muted-foreground">Real HTTP-API providers (Resend, SendGrid, Mailgun, Postmark) are used when simulation is off and the lead's account has a configured API key secret.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
