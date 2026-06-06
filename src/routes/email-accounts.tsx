import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, TestTube2, Trash2 } from "lucide-react";
import {
  fetchEmailAccounts, createEmailAccount, updateEmailAccount, deleteEmailAccount, testEmailAccount,
} from "@/lib/outreach/db";
import type { EmailAccount } from "@/lib/outreach/types";
import { toast } from "sonner";

export const Route = createFileRoute("/email-accounts")({ component: EmailAccountsPage });

function EmailAccountsPage() {
  const [list, setList] = useState<EmailAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmailAccount | null>(null);
  const [form, setForm] = useState<Partial<EmailAccount>>({
    provider: "mock", name: "", sender_name: "", sender_email: "",
    daily_limit: 50, hourly_limit: 20, is_enabled: true,
  });

  async function refresh() { setList(await fetchEmailAccounts()); }
  useEffect(() => { refresh(); }, []);

  function startCreate() {
    setEditing(null);
    setForm({ provider: "mock", name: "", sender_name: "", sender_email: "", daily_limit: 50, hourly_limit: 20, is_enabled: true });
    setOpen(true);
  }
  function startEdit(a: EmailAccount) {
    setEditing(a); setForm(a); setOpen(true);
  }
  async function save() {
    try {
      if (editing) {
        await updateEmailAccount(editing.id, form);
        toast.success("Account updated");
      } else {
        await createEmailAccount(form);
        toast.success("Account added");
      }
      setOpen(false); refresh();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this email account?")) return;
    await deleteEmailAccount(id); refresh();
  }
  async function test(id: string) {
    const acc = list.find((a) => a.id === id);
    await testEmailAccount(id);
    const isReal = acc && ["resend", "sendgrid", "mailgun", "postmark"].includes(acc.provider) && acc.is_enabled && acc.smtp_password_secret;
    toast.success(isReal ? "Account looks configured (real provider)" : "Test OK (simulated)");
    refresh();
  }

  function looksLikeRawKey(v: string | null | undefined) {
    if (!v) return false;
    return /^(re_|SG\.|key-|xkeysib-|pk_|sk_)/.test(v) || v.length > 40;
  }

  return (
    <AppShell
      title="Email accounts"
      action={<Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Add account</Button>}
    >
      {list.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="text-lg font-medium mb-1">No sender accounts yet</div>
            <p className="text-sm text-muted-foreground mb-4">Add a sender account to launch campaigns.</p>
            <Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Add your first account</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <div className="text-sm text-muted-foreground">{a.sender_name} &lt;{a.sender_email}&gt;</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{a.provider}</Badge>
                    {a.is_enabled ? <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Enabled</Badge>
                                  : <Badge variant="outline" className="bg-slate-100">Disabled</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Daily limit: <b>{a.daily_limit}</b></div>
                  <div>Hourly limit: <b>{a.hourly_limit}</b></div>
                  <div>Status: <b>{a.connection_status}</b></div>
                  <div>Tested: {a.last_tested_at ? new Date(a.last_tested_at).toLocaleDateString() : "Never"}</div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => test(a.id)}><TestTube2 className="h-3 w-3 mr-1" />Test</Button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(a)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit account" : "Add email account"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Account name</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v as EmailAccount["provider"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock / Demo (simulated)</SelectItem>
                  <SelectItem value="resend">Resend (HTTP API)</SelectItem>
                  <SelectItem value="sendgrid">SendGrid (HTTP API)</SelectItem>
                  <SelectItem value="mailgun">Mailgun (HTTP API)</SelectItem>
                  <SelectItem value="postmark">Postmark (HTTP API)</SelectItem>
                  <SelectItem value="smtp" disabled>SMTP (not supported on edge runtime)</SelectItem>
                  <SelectItem value="gmail" disabled>Gmail OAuth (coming soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Sender name</Label><Input value={form.sender_name ?? ""} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} /></div>
            <div><Label>Sender email</Label><Input type="email" value={form.sender_email ?? ""} onChange={(e) => setForm({ ...form, sender_email: e.target.value })} /></div>
            <div><Label>Reply-to email</Label><Input type="email" value={form.reply_to_email ?? ""} onChange={(e) => setForm({ ...form, reply_to_email: e.target.value })} /></div>
            {(form.provider === "resend" || form.provider === "sendgrid" || form.provider === "mailgun" || form.provider === "postmark") && (
              <div className="col-span-2 rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="text-xs text-muted-foreground">
                  Store the provider API key as a backend secret (Project → Backend → Secrets) under a name like <code>RESEND_API_KEY</code>, then enter <b>just that name</b> below — not the key value itself. The server reads it at send time; the value is never exposed to the browser.
                </div>
                <div>
                  <Label>API key secret name</Label>
                  <Input
                    value={form.smtp_password_secret ?? ""}
                    placeholder={
                      form.provider === "resend" ? "e.g. RESEND_API_KEY" :
                      form.provider === "sendgrid" ? "e.g. SENDGRID_API_KEY" :
                      form.provider === "mailgun" ? "e.g. MAILGUN_API_KEY" :
                      "e.g. POSTMARK_SERVER_TOKEN"
                    }
                    onChange={(e) => setForm({ ...form, smtp_password_secret: e.target.value })}
                  />
                  {looksLikeRawKey(form.smtp_password_secret) && (
                    <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                      ⚠ This looks like an actual API key, not a secret name. Save the key as a backend secret (e.g. <code>RESEND_API_KEY</code>) and enter only the name here.
                    </div>
                  )}
                </div>
                {form.provider === "mailgun" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Mailgun domain</Label>
                      <Input value={form.smtp_host ?? ""} placeholder="mg.example.com" onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} />
                    </div>
                    <div>
                      <Label>Region</Label>
                      <Select value={form.smtp_username ?? "us"} onValueChange={(v) => setForm({ ...form, smtp_username: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us">US</SelectItem>
                          <SelectItem value="eu">EU</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div><Label>Daily limit</Label><Input type="number" value={form.daily_limit ?? 50} onChange={(e) => setForm({ ...form, daily_limit: +e.target.value })} /></div>
            <div><Label>Hourly limit</Label><Input type="number" value={form.hourly_limit ?? 20} onChange={(e) => setForm({ ...form, hourly_limit: +e.target.value })} /></div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div className="text-sm">Sending enabled</div>
              <Switch checked={form.is_enabled ?? true} onCheckedChange={(v) => setForm({ ...form, is_enabled: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
